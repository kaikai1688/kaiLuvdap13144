// src/ProjectsPage.jsx
import { GoogleGenAI } from "@google/genai";
import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
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
  "Studio / Creative",
];

// --- Compatibility (Similarity 60% + Quality 40%) ---
function calcCompatibility(traitsA = {}, traitsB = {}) {
  // Similarity per trait: 1 - diff/4
  const sims = TRAITS.map((key) => {
    const diff = Math.abs(Number(traitsA[key] ?? 0) - Number(traitsB[key] ?? 0));
    return 1 - diff / 4;
  });
  const baseScore = (sims.reduce((a, b) => a + b, 0) / TRAITS.length) * 100;

  // Quality: avg trait level
  const qualityA = TRAITS.reduce((acc, key) => acc + Number(traitsA[key] ?? 0), 0) / TRAITS.length;
  const qualityB = TRAITS.reduce((acc, key) => acc + Number(traitsB[key] ?? 0), 0) / TRAITS.length;
  const qualityScore = ((qualityA + qualityB) / 2 / 5) * 100;

  // Weighted final
  return Math.round(baseScore * 0.6 + qualityScore * 0.4);
}

function getWorkstyleLabel(score) {
  if (score >= 85) return "Strategic Harmonizer";
  if (score >= 70) return "Adaptive Collaborator";
  if (score >= 55) return "Balanced Builder";
  return "Developing Teammate";
}

// --- Term (Option A): short<=7, medium 8-30, long>30 ---
function computeTermFromDueDate(dueDateStr) {
  const today = new Date();
  const due = new Date(dueDateStr);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return "short";
  if (diffDays <= 30) return "medium";
  return "long";
}

// Small capped boost (0..5) from topTraits average
function priorityBoost(candidateTraits = {}, topTraits = []) {
  if (!topTraits?.length) return 0;
  const avgTop =
    topTraits.reduce((acc, t) => acc + Number(candidateTraits?.[t] ?? 0), 0) / topTraits.length;
  return Math.round((avgTop / 5) * 5); // 0..5 points
}

// --- Gemini: get top 3 traits based on projectType + term (LOCAL ONLY) ---
async function getGeminiTopTraits({ projectType, term }) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing VITE_GEMINI_API_KEY in .env.local");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Pick TOP 3 collaboration traits for the project.

Project type: ${projectType}
Project term: ${term} (short<=7 days, medium=8-30 days, long>30 days)

Traits (choose ONLY from this list):
communication, conflictHandling, awareness, supportiveness, adaptability, alignment, trustworthiness

Return STRICT JSON ONLY (no markdown, no extra keys):
{
  "topTraits": ["trait1","trait2","trait3"],
  "rationale": {
    "trait1": "one sentence reason",
    "trait2": "one sentence reason",
    "trait3": "one sentence reason"
  }
}
Rules:
- topTraits must be exactly 3 distinct items.
- Use only allowed trait names.
`;

  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const raw = resp.text.trim();
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned);

  const allowed = new Set(TRAITS);
  const top = Array.isArray(parsed.topTraits) ? parsed.topTraits : [];
  const uniq = [...new Set(top)];
  if (uniq.length !== 3 || !uniq.every((t) => allowed.has(t))) {
    throw new Error("Gemini returned invalid topTraits");
  }

  return {
    topTraits: uniq,
    rationale: parsed.rationale || {},
  };
}

// --- Gemini: pairing advisor after matching (LOCAL ONLY) ---
async function getGeminiPairingAdvisor({
  projectType,
  term,
  dueDate,
  userName,
  candidateName,
  userTraits,
  candidateTraits,
  topTraits,
  baseScore,
  qualityScore,
  finalScore,
}) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing VITE_GEMINI_API_KEY in .env.local");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are "Gemini Advisor" for a student team matching app.
Use ONLY the numeric traits given. Don't invent facts.

Project: ${projectType}
Term: ${term}
Due date: ${dueDate}

User: ${userName}
Candidate: ${candidateName}

Top 3 prioritized traits for this project: ${topTraits.join(", ")}

User traits (1-5): ${JSON.stringify(userTraits)}
Candidate traits (1-5): ${JSON.stringify(candidateTraits)}

Scores:
baseSimilarityScore (0-100): ${baseScore}
qualityScore (0-100): ${qualityScore}
finalCompatibility (0-100): ${finalScore}

Return STRICT JSON ONLY:
{
  "workstyleLabel": "creative label (2-4 words)",
  "summary": "1-2 sentences fit summary",
  "strengths": ["one strength", "one strength"],
  "risks": ["one risk"],
  "actions": ["one concrete action", "one concrete action"]
}

Rules:
- Mention at least one strength from candidate's high traits (>=4) or topTraits.
- Mention one risk if any trait is low (<=2) OR if a topTrait is weak compared to user.
- Actions must be practical (roles, check-ins, communication plan).
No markdown.
`;

  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const raw = resp.text.trim();
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}

export default function ProjectsPage({ user }) {
  const [form, setForm] = useState({
    projectName: "",
    projectType: PROJECT_TYPES[0],
    teamSize: 3,
    dueDate: "",
  });

  const [status, setStatus] = useState("");
  const [loadingPairing, setLoadingPairing] = useState(false);
  const [myProjects, setMyProjects] = useState([]);
  const [pairedMembers, setPairedMembers] = useState([]);
  const [advisor, setAdvisor] = useState("");

  useEffect(() => {
    if (!user) return undefined;
    const q = query(collection(db, "projects"), where("memberUids", "array-contains", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setMyProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  const currentProjects = useMemo(
    () => myProjects.filter((p) => (p.status || "current") === "current"),
    [myProjects]
  );
  const completedProjects = useMemo(() => myProjects.filter((p) => p.status === "completed"), [myProjects]);

  async function startPairing() {
    if (!user) return;

    if (!form.projectName.trim() || !form.projectType || !form.dueDate || Number(form.teamSize) < 2) {
      setStatus("Please fill Project Name, Project Type, Team Size (min 2, include), and Due Date.");
      return;
    }

    setLoadingPairing(true);
    setStatus("Pairing in progress...");
    setPairedMembers([]);
    setAdvisor("");

    const term = computeTermFromDueDate(form.dueDate);

    // 1) Ask Gemini for top 3 traits (local-only). Fallback to empty if fails.
    let priority = { topTraits: [], rationale: {} };
    try {
      priority = await getGeminiTopTraits({ projectType: form.projectType, term });
      console.log("Gemini topTraits:", priority.topTraits, priority.rationale);
    } catch (e) {
      console.warn("Gemini topTraits failed (fallback to none):", e);
    }

    // 2) Load my traits
    const myUserSnap = await getDoc(doc(db, "users", user.uid));
    const myUserData = myUserSnap.exists() ? myUserSnap.data() : {};
    const myTraits = myUserData?.traits || {};

    // 3) Join or create project
    const existingQ = query(
      collection(db, "projects"),
      where("name", "==", form.projectName.trim()),
      where("projectType", "==", form.projectType),
      where("status", "==", "current")
    );
    const existingSnap = await getDocs(existingQ);

    let projectId;
    let existingMembers = [user.uid];

    if (!existingSnap.empty) {
      const target = existingSnap.docs[0];
      projectId = target.id;
      existingMembers = target.data().memberUids || [];

      await updateDoc(doc(db, "projects", projectId), {
        memberUids: arrayUnion(user.uid),
        teamSize: Number(form.teamSize),
        dueDate: form.dueDate,
      });
    } else {
      const created = await addDoc(collection(db, "projects"), {
        ownerUid: user.uid,
        name: form.projectName.trim(),
        projectType: form.projectType,
        teamSize: Number(form.teamSize),
        dueDate: form.dueDate,
        status: "current",
        memberUids: [user.uid],
        createdAt: serverTimestamp(),
      });
      projectId = created.id;
    }

    // 4) Pick best candidates (requires users read rules to allow signed-in reads)
    const usersSnap = await getDocs(collection(db, "users"));
    const candidates = usersSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((u) => u.id !== user.uid && !existingMembers.includes(u.id) && u.assessmentCompleted)
      .map((u) => {
        const base = calcCompatibility(myTraits, u.traits || {});
        const qualityA =
          TRAITS.reduce((acc, key) => acc + Number(myTraits[key] ?? 0), 0) / TRAITS.length;
        const qualityB =
          TRAITS.reduce((acc, key) => acc + Number((u.traits || {})[key] ?? 0), 0) / TRAITS.length;
        const qualityScore = Math.round(((qualityA + qualityB) / 2 / 5) * 100);

        const boost = priorityBoost(u.traits || {}, priority.topTraits);
        const final = Math.min(100, base + boost);

        return {
          ...u,
          compatibility: final,
          baseScore: base,
          qualityScore,
          priorityBoost: boost,
          workstyleType: getWorkstyleLabel(final), // fallback label
        };
      })
      .sort((a, b) => b.compatibility - a.compatibility)
      .slice(0, Math.max(0, Number(form.teamSize) - 1));

    if (candidates.length > 0) {
      await updateDoc(doc(db, "projects", projectId), {
        memberUids: arrayUnion(...candidates.map((c) => c.id)),
      });

      // 5) Gemini Advisor for the top candidate (local-only). Fallback to simple advice if fails.
      const top = candidates[0];

      try {
        const advice = await getGeminiPairingAdvisor({
          projectType: form.projectType,
          term,
          dueDate: form.dueDate,
          userName: myUserData?.profile?.fullName || myUserData?.displayName || "You",
          candidateName: top.profile?.fullName || "Candidate",
          userTraits: myTraits,
          candidateTraits: top.traits || {},
          topTraits: priority.topTraits,
          baseScore: top.baseScore,
          qualityScore: top.qualityScore,
          finalScore: top.compatibility,
        });

        // apply Gemini label if returned
        top.workstyleType = advice.workstyleLabel || top.workstyleType;

        setAdvisor(
          `Gemini Advisor: ${advice.summary}\n\nStrengths: ${advice.strengths?.join("; ")}\nRisk: ${
            advice.risks?.join("; ") || "None"
          }\nActions: ${advice.actions?.join("; ")}`
        );
      } catch (e) {
        console.warn("Gemini advisor failed (fallback):", e);
        // fallback text if Gemini fails
        setAdvisor(
          `Gemini Advisor: Good match. Prioritize ${priority.topTraits.join(", ") || "clear communication"} and set clear roles early.`
        );
      }
    }

    setPairedMembers(candidates);
    setLoadingPairing(false);
    setStatus("Pairing successful ✅");
  }

  async function removeTeammate(projectId, teammateUid) {
    await updateDoc(doc(db, "projects", projectId), {
      memberUids: arrayRemove(teammateUid),
    });
  }

  async function endProject(projectId) {
    await updateDoc(doc(db, "projects", projectId), {
      status: "completed",
      endedAt: serverTimestamp(),
    });
  }

  async function undoEnd(projectId) {
    await updateDoc(doc(db, "projects", projectId), {
      status: "current",
    });
  }

  return (
    <div className="tf-project-page">
      <section className="tf-card tf-panel">
        <h2 className="tf-h2">Create Project</h2>

        <div className="tf-project-form">
          <label className="tf-field">
            <span>Project Name (official project name)</span>
            <input
              value={form.projectName}
              onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))}
            />
          </label>

          <label className="tf-field">
            <span>Project Type</span>
            <select
              value={form.projectType}
              onChange={(e) => setForm((p) => ({ ...p, projectType: e.target.value }))}
            >
              {PROJECT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="tf-field">
            <span>Team Size (Include Yourself)</span>
            <input
              type="number"
              min="2"
              max="12"
              value={form.teamSize}
              onChange={(e) => setForm((p) => ({ ...p, teamSize: Number(e.target.value) }))}
            />
          </label>

          <label className="tf-field">
            <span>Due Date</span>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
            />
          </label>
        </div>

        <button className="tf-btn tf-btn-primary" onClick={startPairing}>
          {loadingPairing ? "Pairing..." : "Start Pairing"}
        </button>

        {loadingPairing && (
          <div className="tf-radar-loader-wrap">
            <div className="tf-radar-loader" />
            <span className="tf-muted">Pairing in progress...</span>
          </div>
        )}

        {status && <p className="tf-muted">{status}</p>}
      </section>

      {pairedMembers.length > 0 && (
        <section className="tf-team-grid">
          {pairedMembers.map((m) => (
            <article key={m.id} className="tf-team-card">
              <div className="tf-team-avatar">{(m.profile?.fullName || "U")[0]}</div>
              <div className="tf-team-name">{m.profile?.fullName || "Unknown user"}</div>
              <div className="tf-muted tf-small">
                {m.profile?.course || "Course"} · Year {m.profile?.yearOfStudy || "-"}
              </div>
              <div className="tf-badge-row">
                <span className="tf-mini-chip">{m.workstyleType}</span>
                <span className="tf-mini-chip">
                  {m.compatibility}% compatible {m.priorityBoost ? `(+${m.priorityBoost})` : ""}
                </span>
              </div>
            </article>
          ))}
          {advisor && <div className="tf-advisor-box">{advisor}</div>}
        </section>
      )}

      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">Current Projects</h3>
        <div className="tf-project-list">
          {currentProjects.length === 0 && <p className="tf-muted">No current projects.</p>}

          {currentProjects.map((project) => (
            <div key={project.id} className="tf-project-item">
              <div className="tf-project-item-head">
                <div>
                  <b>{project.name}</b>
                  <div className="tf-muted tf-small">
                    {project.projectType} · {project.memberUids?.length || 0}/{project.teamSize} teammates
                  </div>
                </div>
                <button className="tf-btn" onClick={() => endProject(project.id)}>
                  End Project
                </button>
              </div>

              {project.ownerUid === user.uid && (
                <div className="tf-member-row">
                  {(project.memberUids || [])
                    .filter((uid) => uid !== user.uid)
                    .map((uid) => (
                      <button
                        key={uid}
                        className="tf-btn tf-btn-light"
                        onClick={() => removeTeammate(project.id, uid)}
                      >
                        Remove teammate {uid.slice(0, 5)}...
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">Completed Projects</h3>
        <div className="tf-project-list">
          {completedProjects.length === 0 && <p className="tf-muted">No completed projects.</p>}

          {completedProjects.map((project) => (
            <div key={project.id} className="tf-project-item">
              <div className="tf-project-item-head">
                <div>
                  <b>{project.name}</b>
                  <div className="tf-muted tf-small">{project.projectType}</div>
                </div>
                <button className="tf-btn" onClick={() => undoEnd(project.id)}>
                  Undo
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}