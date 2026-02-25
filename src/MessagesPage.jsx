import { useMemo, useState } from "react";

export default function MessagesPage({ messages = [] }) {
  const [tab, setTab] = useState("received");

  const filtered = useMemo(() => {
    if (tab === "all") return messages;
    return messages.filter((m) => (tab === "received" ? m.type === "received" : m.type === "sent"));
  }, [messages, tab]);

  return (
    <div className="tf-card tf-panel">
      <h2 className="tf-h2">Messages</h2>
      <p className="tf-muted">Prototype inbox (read-only demo).</p>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="tf-btn" onClick={() => setTab("received")}>
          Received
        </button>
        <button className="tf-btn" onClick={() => setTab("sent")}>
          Sent
        </button>
        <button className="tf-btn" onClick={() => setTab("all")}>
          All
        </button>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {filtered.map((m) => (
          <div key={m.id} className="tf-message-item">
            <div style={{ fontWeight: 700 }}>{m.title}</div>
            <div className="tf-muted tf-small" style={{ marginTop: 4 }}>
              {m.body}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="tf-muted">No messages.</p>}
      </div>
    </div>
  );
}