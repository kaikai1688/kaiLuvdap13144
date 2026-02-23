// src/CreateProjectPage.jsx
import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

export default function CreateProjectPage({ user }) {
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("");

  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "projects"),
      where("ownerUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [user]);

  async function createProject() {
    if (!user) return;

    if (!name.trim() || !dueDate) {
      setStatus("Please fill in Project Name and Due Date.");
      return;
    }

    setStatus("Creating...");

    await addDoc(collection(db, "projects"), {
      name: name.trim(),
      dueDate, // OK as string for MVP
      ownerUid: user.uid,
      memberUids: [user.uid],
      createdAt: serverTimestamp(),
      status: "active",
    });

    setStatus("Project created ✅");
    setName("");
    setDueDate("");
  }

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>
        <h2 style={{ marginBottom: 12 }}>Create Project</h2>

        <div
          style={{
            border: "1px solid #e7e7ee",
            borderRadius: 14,
            padding: 16,
            background: "white",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
                Project Name
              </div>
              <input
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
                placeholder="e.g., MPU Group Assignment"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
                Project Due Date
              </div>
              <input
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                }}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <button
              onClick={createProject}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #dadce0",
                background: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Create Project
            </button>

            {status && <p style={{ margin: 0 }}>{status}</p>}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 10 }}>My Projects</h3>

          {projects.length === 0 ? (
            <p style={{ color: "#666" }}>No projects yet. Create one above.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {projects.map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: "1px solid #e7e7ee",
                    borderRadius: 12,
                    padding: 12,
                    background: "white",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{p.name}</div>
                  <div style={{ color: "#666", fontSize: 13 }}>
                    Due: {p.dueDate} · Status: {p.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}