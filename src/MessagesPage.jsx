import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

function makeChatId(a, b) {
  return [a, b].sort().join("__");
}

export default function MessagesPage({ user }) {
  const [myUsername, setMyUsername] = useState("");
  const [people, setPeople] = useState([]);
  const [activeUid, setActiveUid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  // Load my username + list users (simple directory)
  useEffect(() => {
    if (!user) return;

    const unsubMe = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      setMyUsername(snap.data()?.profile?.username || "");
    });

    const unsubPeople = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.id !== user.uid && u.profile?.username);
      setPeople(list);
      if (!activeUid && list.length) setActiveUid(list[0].id);
    });

    return () => {
      unsubMe();
      unsubPeople();
    };
  }, [user, activeUid]);

  const activeUser = useMemo(() => people.find((p) => p.id === activeUid) || null, [people, activeUid]);
  const chatId = useMemo(() => (activeUid ? makeChatId(user.uid, activeUid) : null), [user.uid, activeUid]);

  // Real-time messages for selected chat
  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    });
    return () => unsub();
  }, [chatId]);

  async function send() {
    if (!text.trim() || !chatId || !activeUser) return;
    const payload = {
      text: text.trim(),
      createdAt: serverTimestamp(),
      senderUid: user.uid,
      senderUsername: myUsername || user.displayName || "Me",
      receiverUid: activeUser.id,
      receiverUsername: activeUser.profile?.username || "User",
    };
    setText("");
    await addDoc(collection(db, "chats", chatId, "messages"), payload);
  }

  return (
    <div className="tf-messages-page">
      <aside className="tf-chat-list tf-card">
        <div className="tf-chat-list-head">
          <h3>Messages</h3>
          <p className="tf-muted tf-small">Select a user to chat</p>
        </div>
        <div className="tf-chat-list-body">
          {people.length === 0 && <p className="tf-muted">No users found yet.</p>}
          {people.map((p) => (
            <button
              key={p.id}
              className={`tf-chat-person ${p.id === activeUid ? "is-active" : ""}`}
              onClick={() => setActiveUid(p.id)}
            >
              <div className="tf-chat-person-avatar">{(p.profile?.fullName || p.profile?.username || "U")[0]}</div>
              <div className="tf-chat-person-meta">
                <div className="tf-chat-person-name">{p.profile?.fullName || p.profile?.username}</div>
                <div className="tf-muted tf-small">@{p.profile?.username}</div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="tf-chat-thread tf-card">
        <header className="tf-chat-thread-head">
          <div>
            <div className="tf-chat-thread-title">{activeUser ? activeUser.profile?.fullName || activeUser.profile?.username : ""}</div>
            <div className="tf-muted tf-small">{activeUser ? `@${activeUser.profile?.username}` : ""}</div>
          </div>
        </header>

        <div className="tf-chat-thread-body">
          {!activeUser ? (
            <p className="tf-muted">Select a user to start chatting.</p>
          ) : (
            <>
              {messages.map((m) => {
                const mine = m.senderUid === user.uid;
                return (
                  <div key={m.id} className={`tf-bubble-row ${mine ? "is-mine" : ""}`}>
                    <div className={`tf-bubble ${mine ? "is-mine" : ""}`}>
                      <div className="tf-bubble-text">{m.text}</div>
                      <div className="tf-bubble-meta">{mine ? "You" : m.senderUsername}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </>
          )}
        </div>

        <footer className="tf-chat-thread-input">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={activeUser ? `Message @${activeUser.profile?.username}` : "Select a user"}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            disabled={!activeUser}
          />
          <button className="tf-btn tf-btn-primary" onClick={send} disabled={!activeUser}>
            Send
          </button>
        </footer>
      </section>
    </div>
  );
}
