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

export default function MessagesPage({ user }) {
  const [targetUsername, setTargetUsername] = useState("");
  const [chatText, setChatText] = useState("");
  const [allMessages, setAllMessages] = useState([]);
  const [sendStatus, setSendStatus] = useState("");

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
    setSendStatus("");

    const receiverUsername = targetUsername.trim().toLowerCase();
    const receiverQuery = query(
      collection(db, "users"),
      where("profile.usernameLower", "==", receiverUsername)
    );
    const receiverSnap = await getDocs(receiverQuery);

    if (receiverSnap.empty) {
      setSendStatus("Username not found.");
      return;
    }

    const receiverUid = receiverSnap.docs[0].id;
    const conversationId = [user.uid, receiverUid].sort().join("_");

    await addDoc(collection(db, "messages"), {
      conversationId,
      senderUid: user.uid,
      receiverUid,
      receiverUsername,
      participants: [user.uid, receiverUid],
      text: chatText.trim(),
      createdAt: serverTimestamp(),
    });

    setChatText("");
    setSendStatus("Message sent ✅");
  }

  return (
    <div className="tf-card tf-panel">
      <h2 className="tf-h2">Messages</h2>
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
      {sendStatus && <p className="tf-muted">{sendStatus}</p>}

      <div className="tf-year-row" style={{ marginTop: 12 }}>
        <span className="tf-btn">Sent ({sent.length})</span>
        <span className="tf-btn">Received ({received.length})</span>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {allMessages.map((m) => (
          <div key={m.id} className="tf-message-item">
            <div style={{ fontWeight: 700 }}>
              {m.senderUid === user?.uid ? "You" : (m.receiverUsername || "User")} → {m.senderUid === user?.uid ? (m.receiverUsername || "User") : "You"}
            </div>
            <div>{m.text}</div>
          </div>
        ))}
        {allMessages.length === 0 && <p className="tf-muted">No conversations yet.</p>}
      </div>
    </div>
  );
}
