// src/ProjectsPage.jsx
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { GoogleGenAI } from "@google/genai";
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
  setDoc,
  Timestamp,
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

function calcCompatibilityWeighted(traitsA = {}, traitsB = {}, topTraits = []) {
  const topSet = new Set(Array.isArray(topTraits) ? topTraits : []);

  const WEIGHT_TOP = 1.6;
  const WEIGHT_NORMAL = 1.0;

  // similarity part (0..1), weighted
  let simSum = 0;
  let wSum = 0;

  for (const key of TRAITS) {
    const diff = Math.abs(Number(traitsA[key] ?? 0) - Number(traitsB[key] ?? 0)); // 0..4
    const sim = 1 - diff / 4; // 1..0

    const w = topSet.has(key) ? WEIGHT_TOP : WEIGHT_NORMAL;
    simSum += sim * w;
    wSum += w;
  }

  const baseScore = wSum > 0 ? (simSum / wSum) * 100 : 0;

  // quality part (still overall, but slightly favor top traits too)
  let qa = 0;
  let qb = 0;
  let qwSum = 0;

  for (const key of TRAITS) {
    const w = topSet.has(key) ? WEIGHT_TOP : WEIGHT_NORMAL;
    qa += Number(traitsA[key] ?? 0) * w;
    qb += Number(traitsB[key] ?? 0) * w;
    qwSum += w;
  }

  const qualityA = qwSum > 0 ? qa / qwSum : 0; // 0..5
  const qualityB = qwSum > 0 ? qb / qwSum : 0; // 0..5
  const qualityScore = ((qualityA + qualityB) / 2 / 5) * 100;

  // final score (keep your original 60/40 split)
  return Math.round(baseScore * 0.6 + qualityScore * 0.4);
}

function getWorkstyleLabel(score) {
  if (score >= 85) return "Strategic Harmonizer";
  if (score >= 70) return "Adaptive Collaborator";
  if (score >= 55) return "Balanced Builder";
  return "Developing Teammate";
}

function computeTermFromDueDate(dueDateStr) {
  const due = new Date(dueDateStr + "T00:00:00");
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return "short";
  if (diffDays <= 30) return "medium";
  return "long";
}

async function withTimeout(promise, ms, label = "Timed out") {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

async function geminiAdvisorForMatch({ candidateName, projectType, term, myTraits, theirTraits }) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return `Gemini Advisor: Good fit with ${candidateName}. Set clear roles early and communicate often.`;
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are an advisor for student team matching.
Project type: ${projectType}
Project term: ${term} (short/medium/long)

My traits (1..5):
${TRAITS.map((t) => `${t}: ${Number(myTraits?.[t] ?? 0)}`).join("\n")}

Candidate traits (1..5):
${TRAITS.map((t) => `${t}: ${Number(theirTraits?.[t] ?? 0)}`).join("\n")}

Write 3-6 short lines (line breaks) as "Gemini Advisor:".
- Compliment strong traits.
- Warn low trait gaps and give 1 practical action.
- Mention deadline/term relevance.
Do NOT output markdown, just plain text.
`;

  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = resp?.text || resp?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text?.trim() || `Gemini Advisor: Good fit with ${candidateName}. Set clear roles early.`;
}

export default function ProjectsPage({ user }) {
  const navigate = useNavigate();

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

  // ✅ Option 1 UI states
  const [bucketTopTraits, setBucketTopTraits] = useState([]);
  const [bucketReason, setBucketReason] = useState("");
  const [bucketUpdatedAt, setBucketUpdatedAt] = useState(null); // Date or null
  const [bucketConfidence, setBucketConfidence] = useState("Low");
  const [modelStatus, setModelStatus] = useState("");

  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeProjectName, setActiveProjectName] = useState("");
  const [outgoingForActiveProject, setOutgoingForActiveProject] = useState([]);

  useEffect(() => {
    if (!user) return undefined;
    const q = query(collection(db, "projects"), where("memberUids", "array-contains", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setMyProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || !activeProjectId) return;
    const q = query(
      collection(db, "connectionRequests"),
      where("fromUid", "==", user.uid),
      where("projectId", "==", activeProjectId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setOutgoingForActiveProject(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user, activeProjectId]);

  const currentProjects = useMemo(
    () => myProjects.filter((p) => (p.status || "current") === "current"),
    [myProjects]
  );
  const completedProjects = useMemo(() => myProjects.filter((p) => p.status === "completed"), [myProjects]);

  const outgoingPending = useMemo(
    () => outgoingForActiveProject.filter((r) => r.status === "pending"),
    [outgoingForActiveProject]
  );
  const outgoingAccepted = useMemo(
    () => outgoingForActiveProject.filter((r) => r.status === "accepted"),
    [outgoingForActiveProject]
  );
  const outgoingRejected = useMemo(
    () => outgoingForActiveProject.filter((r) => r.status === "rejected"),
    [outgoingForActiveProject]
  );

  async function sendConnectRequest(candidate, projectId) {
    if (!user || !projectId) return;

    const existingQ = query(
      collection(db, "connectionRequests"),
      where("fromUid", "==", user.uid),
      where("toUid", "==", candidate.id),
      where("projectId", "==", projectId),
      where("status", "==", "pending")
    );
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      setStatus("You already sent a pending request to this user for this project.");
      return;
    }

    await addDoc(collection(db, "connectionRequests"), {
      projectId,
      projectName: activeProjectName || form.projectName.trim(),
      projectType: form.projectType,
      dueDate: form.dueDate,

      fromUid: user.uid,
      fromName: user.displayName || "User A",
      toUid: candidate.id,
      toName: candidate.profile?.fullName || candidate.profile?.username || "User B",

      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setStatus(`Connect request sent ✅`);
  }

  async function startPairing() {
    if (!user) return;

    if (!form.projectName.trim() || !form.projectType || !form.dueDate || Number(form.teamSize) < 2) {
      setStatus("Please fill Project Name, Project Type, Team Size (min 2), and Due Date.");
      return;
    }

    setLoadingPairing(true);
    setStatus("Pairing in progress...");
    setPairedMembers([]);
    setAdvisor("");

    // ✅ reset model UI (correct place)
    setBucketTopTraits([]);
    setBucketReason("");
    setBucketUpdatedAt(null);
    setBucketConfidence("Low");
    setModelStatus("");

    try {
      const term = computeTermFromDueDate(form.dueDate);

      // 0) Load bucket model (topTraits) for this projectType + term
      const bucketId = `${form.projectType}__${term}`;
      let topTraits = [];

      try {
        const modelRef = doc(db, "traitModels", bucketId);
        const modelSnap = await getDoc(modelRef);

        if (!modelSnap.exists()) {
          setModelStatus(`No model found for ${bucketId}. Trying to auto-create...`);

          await setDoc(
            modelRef,
            {
              bucketId,
              projectType: form.projectType,
              term,
              topTraits: ["communication", "alignment", "trustworthiness"],
              reason: "Auto-created default (no data yet).",
              bucketTraitAverages: {},
              updatedAt: serverTimestamp(),
              computedBy: "frontend-admin-autocreate",
              computedVersion: 1,
            },
            { merge: true }
          );

          setModelStatus(`Auto-created model for ${bucketId} ✅`);
          topTraits = ["communication", "alignment", "trustworthiness"];

          // ✅ set default explanation UI (correct branch)
          setBucketReason("Auto-created default (no data yet).");
          setBucketUpdatedAt(new Date());
          setBucketConfidence("Low");
        } else {
          const data = modelSnap.data();

          if (Array.isArray(data.topTraits) && data.topTraits.length === 3) {
            topTraits = data.topTraits.filter((t) => TRAITS.includes(t));
          }

          // ✅ set explanation UI from model doc
          setBucketReason(String(data.reason || ""));
          setBucketUpdatedAt(data.updatedAt?.toDate ? data.updatedAt.toDate() : null);

          const hasAverages =
            data.bucketTraitAverages &&
            Object.keys(data.bucketTraitAverages).some(
              (k) => Number(data.bucketTraitAverages[k] || 0) > 0
            );

          setBucketConfidence(hasAverages ? "High" : "Low");
        }
      } catch (e) {
        console.error("Failed to load/create trait model:", e);
        setModelStatus(`Model auto-create failed (likely not admin / rules blocked). Check console.`);
        topTraits = [];
      }

      setBucketTopTraits(topTraits);

      const myUserSnap = await getDoc(doc(db, "users", user.uid));
      const myUserData = myUserSnap.exists() ? myUserSnap.data() : {};
      const myTraits = myUserData?.traits || {};

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

      setActiveProjectId(projectId);
      setActiveProjectName(form.projectName.trim());

      const usersSnap = await getDocs(collection(db, "users"));
      const candidates = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.id !== user.uid && !existingMembers.includes(u.id) && u.assessmentCompleted)
        .map((u) => {
          const score = calcCompatibilityWeighted(myTraits, u.traits || {}, topTraits);
          return { ...u, compatibility: score, workstyleType: getWorkstyleLabel(score) };
        })
        .sort((a, b) => b.compatibility - a.compatibility)
        .slice(0, Math.max(0, Number(form.teamSize) - 1));

      setPairedMembers(candidates);

      if (candidates.length > 0) {
        const top = candidates[0];
        const candidateName = top.profile?.fullName || top.profile?.username || "candidate";

        try {
          const aiText = await withTimeout(
            geminiAdvisorForMatch({
              candidateName,
              projectType: form.projectType,
              term,
              myTraits,
              theirTraits: top.traits || {},
            }),
            6500,
            "Gemini advisor timed out"
          );
          setAdvisor(aiText);
        } catch {
          setAdvisor(`Gemini Advisor: Good fit with ${candidateName}.`);
        }
      } else {
        setAdvisor("Gemini Advisor: No suitable candidates found yet. Try again later.");
      }

      setStatus("Pairing successful ✅");
    } catch (err) {
      console.error(err);
      setStatus(err?.message || "Pairing failed.");
    } finally {
      setLoadingPairing(false);
    }
  }

  async function removeTeammate(projectId, teammateUid) {
    await updateDoc(doc(db, "projects", projectId), {
      memberUids: arrayRemove(teammateUid),
    });
  }

  async function endProject(projectId) {
    if (!user) return;

    const ok = window.confirm("End this project now? This will open teammate ratings.");
    if (!ok) return;

    try {
      const projSnap = await getDoc(doc(db, "projects", projectId));
      if (!projSnap.exists()) {
        setStatus("Project not found.");
        return;
      }

      const proj = projSnap.data();

      if (proj.ownerUid !== user.uid) {
        setStatus("Only the project owner can end this project.");
        return;
      }

      if ((proj.status || "current") === "completed") {
        navigate(`/rate/${projectId}`);
        return;
      }

      await updateDoc(doc(db, "projects", projectId), {
        status: "completed",
        endedAt: serverTimestamp(),
      });

      const memberUids = Array.isArray(proj.memberUids) ? proj.memberUids : [user.uid];
      const term = computeTermFromDueDate(proj.dueDate);

      // --- rating session meta (quorum + expiry) ---
      const memberCount = Array.isArray(memberUids) ? memberUids.length : 0;
      const minSubmissions = Math.max(2, Math.ceil(0.6 * memberCount)); // 60% quorum, min 2
      const closeAtDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const closeAt = Timestamp.fromDate(closeAtDate);

      await setDoc(
        doc(db, "projectRatings", projectId),
        {
          projectId,
          projectType: proj.projectType || "",
          term,
          memberUids,

          // session control
          status: "open",
          memberCount,
          minSubmissions,
          closeAt,
          aggregationRan: false,

          endedByUid: user.uid,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      navigate(`/rate/${projectId}`);
    } catch (e) {
      console.error(e);
      setStatus(e?.message || "End project failed.");
    }
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
            <span>Team Size</span>
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
        {modelStatus && <p className="tf-muted tf-small">{modelStatus}</p>}
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
                <span className="tf-mini-chip">{m.compatibility}% compatible</span>
              </div>

              <div className="tf-inline-actions" style={{ marginTop: 10 }}>
                <button
                  className="tf-btn tf-btn-primary"
                  onClick={() => sendConnectRequest(m, activeProjectId)}
                  disabled={!activeProjectId}
                >
                  Connect
                </button>
              </div>
            </article>
          ))}

          {bucketTopTraits.length > 0 && (
            <div className="tf-advisor-box">
              <b>Priority traits for this project:</b> {bucketTopTraits.join(", ")}
              {"\n"}
              <b>Model confidence:</b> {bucketConfidence}
              {bucketUpdatedAt ? `  ·  Updated: ${bucketUpdatedAt.toLocaleString()}` : ""}
              {"\n"}
              {bucketReason ? `Reason: ${bucketReason}` : ""}
              {"\n"}
              {"\n"}
              {advisor || ""}
            </div>
          )}

          {bucketTopTraits.length === 0 && advisor && <div className="tf-advisor-box">{advisor}</div>}
        </section>
      )}

      {activeProjectId && (
        <section className="tf-card tf-panel">
          <h3 className="tf-section-title">
            Inbox — <b>{activeProjectName || "This project"}</b>
          </h3>
          <p className="tf-muted tf-small">Status updates for your connect requests.</p>

          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <b>Pending</b>
              {outgoingPending.length === 0 ? (
                <p className="tf-muted">No pending invites.</p>
              ) : (
                outgoingPending.map((r) => (
                  <div key={r.id} className="tf-project-item" style={{ marginTop: 8 }}>
                    <b>{r.toName || r.toUid}</b>
                    <div className="tf-muted tf-small">Status: pending</div>
                  </div>
                ))
              )}
            </div>

            <div>
              <b>Accepted</b>
              {outgoingAccepted.length === 0 ? (
                <p className="tf-muted">No accepted invites yet.</p>
              ) : (
                outgoingAccepted.map((r) => (
                  <div key={r.id} className="tf-project-item" style={{ marginTop: 8 }}>
                    <b>{r.toName || r.toUid}</b>
                    <div className="tf-muted tf-small">Status: accepted ✅</div>
                  </div>
                ))
              )}
            </div>

            <div>
              <b>Rejected</b>
              {outgoingRejected.length === 0 ? (
                <p className="tf-muted">No rejected invites.</p>
              ) : (
                outgoingRejected.map((r) => (
                  <div key={r.id} className="tf-project-item" style={{ marginTop: 8 }}>
                    <b>{r.toName || r.toUid}</b>
                    <div className="tf-muted tf-small">Status: rejected ❌</div>
                  </div>
                ))
              )}
            </div>
          </div>
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

                <button className="tf-btn tf-btn-primary" onClick={() => navigate(`/rate/${project.id}`)}>
                  Edit Ratings
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}