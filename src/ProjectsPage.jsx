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
  setDoc,
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
  "Studio or Creative Project",
];

function calcCompatibility(traitsA, traitsB) {
  const sims = TRAITS.map((key) => {
    const diff = Math.abs(Number(traitsA[key] ?? 0) - Number(traitsB[key] ?? 0));
    return 1 - diff / 4;
  });
  const baseScore = (sims.reduce((a, b) => a + b, 0) / 7) * 100;

  const qualityA = TRAITS.reduce((acc, key) => acc + Number(traitsA[key] ?? 0), 0) / 7;
  const qualityB = TRAITS.reduce((acc, key) => acc + Number(traitsB[key] ?? 0), 0) / 7;
  const qualityScore = ((qualityA + qualityB) / 2 / 5) * 100;

  return Math.round(baseScore * 0.6 + qualityScore * 0.4);
}

function getWorkstyleLabel(score) {
  if (score >= 85) return "Strategic Harmonizer";
  if (score >= 70) return "Adaptive Collaborator";
  if (score >= 55) return "Balanced Builder";
  return "Developing Teammate";
}

function getGeminiAdvisor(score, target) {
  if (score >= 80) {
    return `Gemini Advisor: Great fit with ${target}. Strong compatibility for this project scope.`;
  }
  if (score >= 60) {
    return `Gemini Advisor: Good fit with ${target}. Set clear roles early to improve alignment.`;
  }
  return `Gemini Advisor: Moderate fit with ${target}. Communicate frequently and review responsibilities weekly.`;
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
  const completedProjects = useMemo(
    () => myProjects.filter((p) => p.status === "completed"),
    [myProjects]
  );

  async function startPairing() {
    if (!user) return;
    if (!form.projectName.trim() || !form.projectType || !form.dueDate || Number(form.teamSize) < 2) {
      setStatus("Please fill Project Name, Project Type, Team Size, and Due Date.");
      return;
    }

    setLoadingPairing(true);
    setStatus("Pairing in progress...");
    setPairedMembers([]);
    setAdvisor("");

    const myUserSnap = await getDoc(doc(db, "users", user.uid));
    const myUserData = myUserSnap.exists() ? myUserSnap.data() : {};

    const existingQ = query(
      collection(db, "projects"),
      where("name", "==", form.projectName.trim()),
      where("projectType", "==", form.projectType),
      where("status", "==", "current")
    );
    const existingSnap = await getDocs(existingQ);

    let projectRefId;
    let existingMembers = [user.uid];

    if (!existingSnap.empty) {
      const target = existingSnap.docs[0];
      projectRefId = target.id;
      existingMembers = target.data().memberUids || [];

      await updateDoc(doc(db, "projects", target.id), {
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
      projectRefId = created.id;
    }

    const usersSnap = await getDocs(collection(db, "users"));
    const candidates = usersSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((u) => u.id !== user.uid && !existingMembers.includes(u.id) && u.assessmentCompleted)
      .map((u) => {
        const score = calcCompatibility(myUserData.traits || {}, u.traits || {});
        return {
          ...u,
          compatibility: score,
          workstyleType: getWorkstyleLabel(score),
        };
      })
      .sort((a, b) => b.compatibility - a.compatibility)
      .slice(0, Math.max(0, Number(form.teamSize) - 1));

    if (candidates.length > 0) {
      await updateDoc(doc(db, "projects", projectRefId), {
        memberUids: arrayUnion(...candidates.map((c) => c.id)),
      });
    }

    await setDoc(doc(db, "users", user.uid), {
      projects: {
        completedCount: completedProjects.length,
      },
    }, { merge: true });

    setPairedMembers(candidates);

    if (candidates[0]) {
      setAdvisor(getGeminiAdvisor(candidates[0].compatibility, candidates[0].profile?.fullName || "candidate"));
    }

    setLoadingPairing(false);
    setStatus("Pairing successful.");
  }

  async function removeTeammate(projectId, teammateUid) {
    await updateDoc(doc(db, "projects", projectId), {
      memberUids: arrayRemove(teammateUid),
    });
  }

  async function endProject(projectId) {
    await updateDoc(doc(db, "projects", projectId), { status: "completed", endedAt: serverTimestamp() });
  }

  async function undoEnd(projectId) {
    await updateDoc(doc(db, "projects", projectId), { status: "current" });
  }

  return (
    <div className="tf-project-page">
      <section className="tf-card tf-panel">
        <h2 className="tf-h2">Create Project</h2>

        <div className="tf-project-form">
          <label className="tf-field">
            <span>Project Name (official project name)</span>
            <input value={form.projectName} onChange={(e) => setForm((prev) => ({ ...prev, projectName: e.target.value }))} />
          </label>

          <label className="tf-field">
            <span>Project Type</span>
            <select value={form.projectType} onChange={(e) => setForm((prev) => ({ ...prev, projectType: e.target.value }))}>
              {PROJECT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>

          <label className="tf-field">
            <span>Team Size</span>
            <input type="number" min="2" max="12" value={form.teamSize} onChange={(e) => setForm((prev) => ({ ...prev, teamSize: Number(e.target.value) }))} />
          </label>

          <label className="tf-field">
            <span>Due Date</span>
            <input type="date" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
          </label>
        </div>

        <button className="tf-btn tf-btn-primary" onClick={startPairing}>
          {loadingPairing ? "Pairing..." : "Start Pairing"}
        </button>

        {loadingPairing && (
          <div className="tf-radar-loader-wrap">
            <div className="tf-radar-loader" />
            <span className="tf-muted">Gemini + Vertex AI pairing in progress...</span>
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
              <div className="tf-muted tf-small">{m.profile?.course || "Course"} · Year {m.profile?.yearOfStudy || "-"}</div>
              <div className="tf-badge-row">
                <span className="tf-mini-chip">{m.workstyleType}</span>
                <span className="tf-mini-chip">{m.compatibility}% compatible</span>
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
                  <div className="tf-muted tf-small">{project.projectType} · {project.memberUids?.length || 0}/{project.teamSize} teammates</div>
                </div>
                <button className="tf-btn" onClick={() => endProject(project.id)}>End Project</button>
              </div>

              {project.ownerUid === user.uid && (
                <div className="tf-member-row">
                  {(project.memberUids || []).filter((uid) => uid !== user.uid).map((uid) => (
                    <button key={uid} className="tf-btn tf-btn-light" onClick={() => removeTeammate(project.id, uid)}>
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
                <button className="tf-btn" onClick={() => undoEnd(project.id)}>Undo</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
