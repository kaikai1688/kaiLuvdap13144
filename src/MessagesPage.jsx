import { useMemo, useState } from "react";

export default function MessagesPage({ messages = [] }) {
  const [tab, setTab] = useState("received");

  const sent = useMemo(() => messages.filter((m) => m.type === "sent"), [messages]);
  const received = useMemo(() => messages.filter((m) => m.type === "received"), [messages]);
  const list = tab === "sent" ? sent : received;

  return (
    <div className="tf-card tf-panel">
      <h2 className="tf-h2">Messages</h2>
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
    </div>
  );
}
