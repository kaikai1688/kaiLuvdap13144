<<<<<<< codex/create-student-profile-with-id-verification-5wv2ps
import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

export default function MessagesPage({ user }) {
  const [targetUsername, setTargetUsername] = useState("");
  const [chatText, setChatText] = useState("");
  const [allMessages, setAllMessages] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "messages"), where("participants", "array-contains", user.uid), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setAllMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  const sent = useMemo(() => allMessages.filter((m) => m.senderUid === user?.uid), [allMessages, user]);
  const received = useMemo(() => allMessages.filter((m) => m.senderUid !== user?.uid), [allMessages, user]);

  async function sendMessage() {
    if (!user || !chatText.trim() || !targetUsername.trim()) return;
    const conversationId = [user.uid, targetUsername.trim().toLowerCase()].sort().join("_");

    await addDoc(collection(db, "messages"), {
      conversationId,
      senderUid: user.uid,
      targetUsername: targetUsername.trim().toLowerCase(),
      participants: [user.uid, targetUsername.trim().toLowerCase()],
      text: chatText.trim(),
      createdAt: serverTimestamp(),
    });

    setChatText("");
  }
=======
import { useMemo, useState } from "react";

export default function MessagesPage({ messages = [] }) {
  const [tab, setTab] = useState("received");

  const sent = useMemo(() => messages.filter((m) => m.type === "sent"), [messages]);
  const received = useMemo(() => messages.filter((m) => m.type === "received"), [messages]);
  const list = tab === "sent" ? sent : received;
>>>>>>> main

  return (
    <div className="tf-card tf-panel">
      <h2 className="tf-h2">Messages</h2>
<<<<<<< codex/create-student-profile-with-id-verification-5wv2ps
      <p className="tf-muted tf-small">Two-way real-time chat synced with Firestore onSnapshot.</p>

      <div className="tf-project-form">
        <label className="tf-field">
          <span>Chat with username</span>
          <input value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} placeholder="e.g. ali123" />
        </label>
        <label className="tf-field">
          <span>Your message</span>
          <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Type message..." />
        </label>
      </div>

      <button className="tf-btn tf-btn-primary" onClick={sendMessage}>Send</button>

      <div className="tf-year-row" style={{ marginTop: 12 }}>
        <span className="tf-btn">Sent ({sent.length})</span>
        <span className="tf-btn">Received ({received.length})</span>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {allMessages.map((m) => (
          <div key={m.id} className="tf-message-item">
            <div style={{ fontWeight: 700 }}>
              {m.senderUid === user?.uid ? "You" : m.targetUsername} → {m.senderUid === user?.uid ? m.targetUsername : "You"}
            </div>
            <div>{m.text}</div>
          </div>
        ))}
        {allMessages.length === 0 && <p className="tf-muted">No conversations yet.</p>}
      </div>
=======
      <div className="tf-year-row" style={{ marginTop: 10 }}>
        <button
          type="button"
          className={`tf-btn ${tab === "received" ? "tf-year-active" : ""}`}
          onClick={() => setTab("received")}
        >
          Received ({received.length})
        </button>
        <button
          type="button"
          className={`tf-btn ${tab === "sent" ? "tf-year-active" : ""}`}
          onClick={() => setTab("sent")}
        >
          Sent ({sent.length})
        </button>
      </div>

      {list.length === 0 ? (
        <p className="tf-muted">No {tab} messages yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {list.map((m) => (
            <div key={m.id} className="tf-message-item">
              <div style={{ fontWeight: 700 }}>{m.title}</div>
              <div className="tf-muted tf-small">{m.body}</div>
            </div>
          ))}
        </div>
      )}
>>>>>>> main
    </div>
  );
}
