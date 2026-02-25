import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

function resolvePartner(message, myUid) {
  if (!message?.participants) return "Unknown";
  return message.senderUid === myUid ? (message.receiverUsername || "User") : (message.senderUsername || "User");
}

export default function MessagesPage({ user }) {
  const [targetUsername, setTargetUsername] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("");
  const [activeConversation, setActiveConversation] = useState("");

  useEffect(() => {
    if (!user) return undefined;

    const q = query(collection(db, "messages"), where("participants", "array-contains", user.uid), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [user]);

  const conversations = useMemo(() => {
    const map = new Map();
    for (const m of messages) {
      if (!map.has(m.conversationId)) map.set(m.conversationId, []);
      map.get(m.conversationId).push(m);
    }
    return [...map.entries()].map(([conversationId, msgs]) => ({
      conversationId,
      messages: msgs,
      partner: resolvePartner(msgs[msgs.length - 1], user?.uid),
    }));
  }, [messages, user]);

  const activeMessages = useMemo(() => {
    if (!activeConversation) return [];
    const found = conversations.find((c) => c.conversationId === activeConversation);
    return found?.messages || [];
  }, [conversations, activeConversation]);

  const sentCount = useMemo(() => messages.filter((m) => m.senderUid === user?.uid).length, [messages, user]);
  const recvCount = useMemo(() => messages.filter((m) => m.senderUid !== user?.uid).length, [messages, user]);

  async function sendMessage() {
    if (!user || !targetUsername.trim() || !text.trim()) return;

    setStatus("");

    const normalized = targetUsername.trim().toLowerCase();
    const q = query(collection(db, "users"), where("profile.usernameLower", "==", normalized));
    const snap = await getDocs(q);

    if (snap.empty) {
      setStatus("User not found.");
      return;
    }

    const receiver = snap.docs[0];
    const receiverUid = receiver.id;
    const senderUsername = user.email?.split("@")[0] || "you";

    const conversationId = [user.uid, receiverUid].sort().join("_");

    await addDoc(collection(db, "messages"), {
      conversationId,
      senderUid: user.uid,
      senderUsername,
      receiverUid,
      receiverUsername: normalized,
      participants: [user.uid, receiverUid],
      text: text.trim(),
      createdAt: serverTimestamp(),
    });

    setActiveConversation(conversationId);
    setText("");
    setStatus("Message sent ✅");
  }

  return (
    <div className="tf-message-page">
      <section className="tf-message-sidebar tf-card tf-panel">
        <h3 className="tf-section-title">My Messages</h3>
        <div className="tf-muted tf-small" style={{ marginBottom: 8 }}>
          Received ({recvCount}) · Sent ({sentCount})
        </div>

        <div className="tf-conversation-list">
          {conversations.map((conv) => (
            <button
              key={conv.conversationId}
              className={`tf-conversation-item ${conv.conversationId === activeConversation ? "is-active" : ""}`}
              onClick={() => setActiveConversation(conv.conversationId)}
            >
              <b>{conv.partner}</b>
              <span className="tf-muted tf-small">{conv.messages.at(-1)?.text || "No message"}</span>
            </button>
          ))}
          {conversations.length === 0 && <p className="tf-muted">No conversations yet.</p>}
        </div>
      </section>

      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">Conversation</h3>

        <div className="tf-project-form">
          <label className="tf-field">
            <span>Username</span>
            <input value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} placeholder="Type username" />
          </label>
          <label className="tf-field">
            <span>Message</span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type message" />
          </label>
        </div>

        <button className="tf-btn tf-btn-primary" onClick={sendMessage}>Send</button>
        {status && <p className="tf-muted">{status}</p>}

        <div className="tf-chat-window">
          {activeMessages.map((m) => (
            <div key={m.id} className={`tf-chat-bubble ${m.senderUid === user?.uid ? "mine" : "other"}`}>
              <div className="tf-small">{m.senderUid === user?.uid ? "You" : (m.senderUsername || "User")}</div>
              <div>{m.text}</div>
            </div>
          ))}
          {activeMessages.length === 0 && <p className="tf-muted">Select a conversation or send first message.</p>}
        </div>
      </section>
    </div>
  );
}
