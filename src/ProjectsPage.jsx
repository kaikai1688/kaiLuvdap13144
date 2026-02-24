import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useState } from "react";
import { db } from "./firebase";
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from "firebase/firestore";

const TRAITS = [
  "communication",
  "conflictHandling",
  "awareness",
  "supportiveness",
  "adaptability",
  "alignment",
  "trustworthiness",
];

const PROJECT_TYPES = [
  "Final Year Project",
  "School Assignment",
  "Lab Report",
  "Case Study & Presentation",
  "Community Service",
  "Studio or Creative Project",
];

function traitDistance(a = {}, b = {}) {
  return TRAITS.reduce((acc, t) => acc + Math.abs(Number(a[t] ?? 0) - Number(b[t] ?? 0)), 0);
}

export default function ProjectsPage({ user }) {
  const [form, setForm] = useState({ projectName: "", projectType: PROJECT_TYPES[0], teamSize: 3, date: "" });
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [status, setStatus] = useState("");
  const [matchedTeam, setMatchedTeam] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "projects"), where("ownerUid", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);
function traitDistance(a = {}, b = {}) {
  const sum = TRAITS.reduce((acc, t) => acc + Math.abs(Number(a[t] ?? 0) - Number(b[t] ?? 0)), 0);
  return sum;
}

export default function ProjectsPage({ user }) {
  const [form, setForm] = useState({
    projectName: "",
    projectType: "",
    teamSize: 3,
    date: "",
  });
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [status, setStatus] = useState("");
  const [matchedTeam, setMatchedTeam] = useState([]);

  async function handlePairing() {
    if (!user) return;
    if (!form.projectName.trim() || !form.projectType.trim() || !form.date || Number(form.teamSize) < 2) {
      setStatus("Please complete Project Name, Project Type, Team Size (Pax) and Date.");
      return;
    }

    setLoadingMatch(true);
    setStatus("Finding best-fit teammates...");
    setMatchedTeam([]);

    const meSnap = await getDoc(doc(db, "users", user.uid));
    const meData = meSnap.exists() ? meSnap.data() : {};
    const myYear = meData?.profile?.yearOfStudy || "Year 1";
    const myYear = meData?.profile?.yearOfStudy || "Y1";
    const myTraits = meData?.traits || {};

    const candidatesQuery = query(
      collection(db, "users"),
      where("assessmentCompleted", "==", true),
      where("profile.yearOfStudy", "==", myYear)
    );
    const candidatesSnap = await getDocs(candidatesQuery);

    const candidates = candidatesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((u) => u.id !== user.uid)
      .map((u) => ({ ...u, score: traitDistance(myTraits, u.traits) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, Math.max(1, Number(form.teamSize) - 1));

    await new Promise((resolve) => setTimeout(resolve, 1500));

    await addDoc(collection(db, "projects"), {
      ownerUid: user.uid,
      memberUids: [user.uid, ...candidates.map((c) => c.id)],
      name: form.projectName.trim(),
      projectType: form.projectType,
      dueDate: form.date,
      teamSize: Number(form.teamSize),
      requiredYear: myYear,
      status: "active",
      .map((u) => ({
        ...u,
        score: traitDistance(myTraits, u.traits),
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, Math.max(1, Number(form.teamSize) - 1));

    await new Promise((resolve) => setTimeout(resolve, 1800));

    await addDoc(collection(db, "projects"), {
      ownerUid: user.uid,
      name: form.projectName.trim(),
      projectType: form.projectType.trim(),
      dueDate: form.date,
      teamSize: Number(form.teamSize),
      requiredYear: myYear,
      matchedUids: candidates.map((c) => c.id),
      createdAt: serverTimestamp(),
    });

    setMatchedTeam(candidates);
    setLoadingMatch(false);
    setStatus(`Team formed with ${candidates.length} teammate(s).`);
  }

  async function markCompleted(id) {
    await updateDoc(doc(db, "projects", id), { status: "completed", completedAt: serverTimestamp() });
  }

  return (
    <div className="tf-card tf-panel">
      <h2 className="tf-h2">Projects</h2>
      <p className="tf-muted">Create Project: fill these features before pairing.</p>

      <div className="tf-project-form">
        <label className="tf-field">
          <span>Project Name</span>
          <input value={form.projectName} onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))} />
        </label>
        <label className="tf-field">
          <span>Project Type</span>
          <select value={form.projectType} onChange={(e) => setForm((p) => ({ ...p, projectType: e.target.value }))}>
            {PROJECT_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
          <input value={form.projectType} onChange={(e) => setForm((p) => ({ ...p, projectType: e.target.value }))} />
        </label>
        <label className="tf-field">
          <span>Team Size (Pax)</span>
          <input type="number" min="2" max="8" value={form.teamSize} onChange={(e) => setForm((p) => ({ ...p, teamSize: Number(e.target.value) }))} />
        </label>
        <label className="tf-field">
          <span>Due Date</span>
          <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
        </label>
      </div>

      <button className="tf-btn tf-btn-primary" onClick={handlePairing} disabled={loadingMatch}>
        {loadingMatch ? "Pairing in progress..." : "Start AI Pairing"}
      </button>

      {loadingMatch && (
        <div className="tf-radar-loader-wrap">
          <div className="tf-radar-loader" />
          <span className="tf-muted">Analyzing assignment, year, and personality fit...</span>
        </div>
      )}

      {status && <p>{status}</p>}

      {matchedTeam.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 8 }}>Matched teammates</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {matchedTeam.map((mate) => (
              <div key={mate.id} className="tf-message-item">
                <div style={{ fontWeight: 700 }}>{mate.profile?.fullName || mate.displayName || "Student"}</div>
                <div className="tf-muted tf-small">Year: {mate.profile?.yearOfStudy || "N/A"} · Similarity score: {mate.score}</div>
                <div style={{ fontWeight: 700 }}>{mate.profile?.name || mate.displayName || "Student"}</div>
                <div className="tf-muted tf-small">
                  Year: {mate.profile?.yearOfStudy || "N/A"} · Similarity score: {mate.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <h3>My Projects</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {projects.map((p) => (
            <div key={p.id} className="tf-message-item">
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div className="tf-muted tf-small">{p.projectType} · {p.status || "active"}</div>
              {p.status !== "completed" && (
                <button className="tf-btn" onClick={() => markCompleted(p.id)} style={{ marginTop: 8 }}>
                  Mark as Completed
                </button>
              )}
            </div>
          ))}
          {projects.length === 0 && <p className="tf-muted">No projects yet.</p>}
        </div>
      </div>
    </div>
  );
}
