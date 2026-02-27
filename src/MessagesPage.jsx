// src/MessagesPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "./firebase";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

function makeChatId(a, b) {
  return [a, b].sort().join("__");
}

export default function MessagesPage({ user }) {
  const [tab, setTab] = useState("messages"); // "messages" | "inbox"

  const [myUsername, setMyUsername] = useState("");
  const [people, setPeople] = useState([]);
  const [activeUid, setActiveUid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  // Inbox state
  const [incoming, setIncoming] = useState([]); // toUid == me
  const [outgoing, setOutgoing] = useState([]); // fromUid == me
  const [inboxStatus, setInboxStatus] = useState("");

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
    // ✅ do NOT include activeUid here, it causes unnecessary re-subscribes
  }, [user]);

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

  // Inbox listeners
  useEffect(() => {
    if (!user) return;

    const qIn = query(
      collection(db, "connectionRequests"),
      where("toUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubIn = onSnapshot(qIn, (snap) => {
      setIncoming(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const qOut = query(
      collection(db, "connectionRequests"),
      where("fromUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubOut = onSnapshot(qOut, (snap) => {
      setOutgoing(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubIn();
      unsubOut();
    };
  }, [user]);

  async function send() {
    if (!text.trim() || !chatId || !activeUser) return;

    const messageText = text.trim();
    const payload = {
      text: messageText,
      createdAt: serverTimestamp(),
      senderUid: user.uid,
      senderUsername: myUsername || user.displayName || "Me",
      receiverUid: activeUser.id,
      receiverUsername: activeUser.profile?.username || "User",
    };

    setText("");

    // chat metadata doc
    await setDoc(
      doc(db, "chats", chatId),
      {
        members: [user.uid, activeUser.id],
        memberMap: { [user.uid]: true, [activeUser.id]: true },
        updatedAt: serverTimestamp(),
        lastMessage: messageText,
        lastSenderUid: user.uid,
      },
      { merge: true }
    );

    await addDoc(collection(db, "chats", chatId, "messages"), payload);
  }

  async function acceptRequest(req) {
    try {
      setInboxStatus("Accepting...");

      // 1) mark request accepted
      await updateDoc(doc(db, "connectionRequests", req.id), {
        status: "accepted",
        updatedAt: serverTimestamp(),
        decidedAt: serverTimestamp(),
      });

      // 2) add me (User B) into the project memberUids
      await updateDoc(doc(db, "projects", req.projectId), {
        memberUids: arrayUnion(user.uid),
      });

      setInboxStatus("Accepted ✅ Project added to your Current Projects.");
    } catch (e) {
      console.error(e);
      setInboxStatus(e?.message || "Accept failed");
    }
  }

  async function rejectRequest(req) {
    try {
      setInboxStatus("Rejecting...");

      await updateDoc(doc(db, "connectionRequests", req.id), {
        status: "rejected",
        updatedAt: serverTimestamp(),
        decidedAt: serverTimestamp(),
      });

      setInboxStatus("Rejected ❌ (saved as history)");
    } catch (e) {
      console.error(e);
      setInboxStatus(e?.message || "Reject failed");
    }
  }

  const incomingPending = useMemo(() => incoming.filter((r) => r.status === "pending"), [incoming]);
  const incomingHistory = useMemo(() => incoming.filter((r) => r.status !== "pending"), [incoming]);

  return (
    <div className="tf-messages-page">
      <aside className="tf-chat-list tf-card">
        <div className="tf-chat-list-head">
          <h3>Messages</h3>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="tf-btn" onClick={() => setTab("messages")} disabled={tab === "messages"}>
              Messages
            </button>
            <button className="tf-btn" onClick={() => setTab("inbox")} disabled={tab === "inbox"}>
              Inbox
            </button>
          </div>

          {tab === "inbox" && (
            <p className="tf-muted tf-small" style={{ marginTop: 8 }}>
              Connection requests & history
            </p>
          )}
          {tab === "messages" && <p className="tf-muted tf-small">Select a user to chat</p>}
        </div>

        <div className="tf-chat-list-body">
          {tab === "messages" && (
            <>
              {people.length === 0 && <p className="tf-muted">No users found yet.</p>}
              {people.map((p) => (
                <button
                  key={p.id}
                  className={`tf-chat-person ${p.id === activeUid ? "is-active" : ""}`}
                  onClick={() => setActiveUid(p.id)}
                >
                  <div className="tf-chat-person-avatar">
                    {(p.profile?.fullName || p.profile?.username || "U")[0]}
                  </div>
                  <div className="tf-chat-person-meta">
                    <div className="tf-chat-person-name">{p.profile?.fullName || p.profile?.username}</div>
                    <div className="tf-muted tf-small">@{p.profile?.username}</div>
                  </div>
                </button>
              ))}
            </>
          )}

          {tab === "inbox" && (
            <>
              {inboxStatus && <p className="tf-muted">{inboxStatus}</p>}

              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <b>Pending</b>
                  {incomingPending.length === 0 ? (
                    <p className="tf-muted">No pending requests.</p>
                  ) : (
                    incomingPending.map((r) => (
                      <div key={r.id} className="tf-project-item" style={{ marginTop: 8 }}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div>
                            <b>{r.projectName || "Project"}</b>
                            <div className="tf-muted tf-small">
                              {r.fromName || r.fromUid} wants to connect with you.
                            </div>
                          </div>

                          <div className="tf-inline-actions">
                            <button className="tf-btn tf-btn-primary" onClick={() => acceptRequest(r)}>
                              Accept
                            </button>
                            <button className="tf-btn" onClick={() => rejectRequest(r)}>
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <b>History</b>
                  {incomingHistory.length === 0 ? (
                    <p className="tf-muted">No history yet.</p>
                  ) : (
                    incomingHistory.map((r) => (
                      <div key={r.id} className="tf-project-item" style={{ marginTop: 8 }}>
                        <div>
                          <b>{r.projectName || "Project"}</b>
                          <div className="tf-muted tf-small">
                            From: {r.fromName || r.fromUid} · Status:{" "}
                            {r.status === "accepted" ? "accepted ✅" : "rejected ❌"}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <b>My sent requests (history)</b>
                  {outgoing.length === 0 ? (
                    <p className="tf-muted">No sent requests yet.</p>
                  ) : (
                    outgoing.map((r) => (
                      <div key={r.id} className="tf-project-item" style={{ marginTop: 8 }}>
                        <div>
                          <b>{r.projectName || "Project"}</b>
                          <div className="tf-muted tf-small">
                            To: {r.toName || r.toUid} · Status:{" "}
                            {r.status === "pending"
                              ? "pending"
                              : r.status === "accepted"
                              ? "accepted ✅"
                              : "rejected ❌"}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      <section className="tf-chat-thread tf-card">
        {tab === "messages" ? (
          <>
            <header className="tf-chat-thread-head">
              <div>
                <div className="tf-chat-thread-title">
                  {activeUser ? activeUser.profile?.fullName || activeUser.profile?.username : ""}
                </div>
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
          </>
        ) : null /* ✅ removed the Inbox placeholder box */}
      </section>
    </div>
  );
}