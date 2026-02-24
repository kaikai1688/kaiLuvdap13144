import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
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

function RadarChart({ values }) {
  const size = 260;
  const center = size / 2;
  const radius = 88;

  const points = TRAITS.map((trait, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
    const value = Number(values[trait] ?? 0);
    const valueRadius = (Math.max(0, Math.min(5, value)) / 5) * radius;
    return {
      trait,
      x: center + Math.cos(angle) * valueRadius,
      y: center + Math.sin(angle) * valueRadius,
      lx: center + Math.cos(angle) * (radius + 22),
      ly: center + Math.sin(angle) * (radius + 22),
    };
  });

  return (
    <svg className="tf-radar" viewBox={`0 0 ${size} ${size}`}>
      {[1, 2, 3, 4, 5].map((level) => {
        const r = (level / 5) * radius;
        const ringPoints = TRAITS.map((_, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
          return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
        }).join(" ");
        return <polygon key={level} points={ringPoints} className="tf-radar-ring" />;
      })}

      {TRAITS.map((_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + Math.cos(angle) * radius}
            y2={center + Math.sin(angle) * radius}
            className="tf-radar-axis"
          />
        );
      })}

      <polygon points={points.map((p) => `${p.x},${p.y}`).join(" ")} className="tf-radar-shape" />

      {points.map((p) => (
        <g key={p.trait}>
          <circle cx={p.x} cy={p.y} r="4" className="tf-radar-dot" />
          <text x={p.lx} y={p.ly} textAnchor="middle" className="tf-radar-label">
            {p.trait}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function ProfilePage({ user, onGoAssessment }) {
  const [profile, setProfile] = useState({
    fullName: "",
    username: "",
    university: "",
    course: "",
    yearOfStudy: "Year 1",
    studentIdStatus: "Not submitted",
  });
  const [userData, setUserData] = useState(null);
  const [projectsCompleted, setProjectsCompleted] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setUserData(data);
      setProfile((prev) => ({
        ...prev,
        fullName: data.profile?.fullName || user.displayName || "",
        username: data.profile?.username || "",
        university: data.profile?.university || "",
        course: data.profile?.course || "",
        yearOfStudy: data.profile?.yearOfStudy || "Year 1",
        studentIdStatus: data.profile?.studentIdStatus || "Not submitted",
      }));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "projects"), where("ownerUid", "==", user.uid), where("status", "==", "completed"));
    const unsub = onSnapshot(q, (snap) => setProjectsCompleted(snap.size));
    return () => unsub();
  }, [user]);

  const traits = useMemo(() => userData?.traits || {}, [userData]);
  const overallScore = useMemo(() => {
    const sum = TRAITS.reduce((acc, t) => acc + Number(traits[t] || 0), 0);
    return sum ? (sum / TRAITS.length).toFixed(2) : "0.00";
  }, [traits]);

  const confidence = useMemo(() => {
    if (!projectsCompleted) return null;
    const traitBased = Number(overallScore) * 16;
    const projectBonus = Math.min(20, projectsCompleted * 5);
    return Math.round(Math.min(100, traitBased + projectBonus));
  }, [overallScore, projectsCompleted]);

  async function saveProfile() {
    if (!user) return;
    if (!profile.fullName.trim() || !profile.username.trim() || !profile.university.trim() || !profile.course.trim()) {
      setStatus("Please complete all required profile fields.");
      return;
    }

    const usernameQ = query(collection(db, "users"), where("profile.username", "==", profile.username.trim()));
    const usernameSnap = await getDocs(usernameQ);
    const exists = usernameSnap.docs.some((d) => d.id !== user.uid);
    if (exists) {
      setStatus("Username already exists. Please choose another one.");
      return;
    }

    setStatus("Saving profile...");
    await setDoc(
      doc(db, "users", user.uid),
      {
        profile: {
          fullName: profile.fullName.trim(),
          username: profile.username.trim(),
          university: profile.university.trim(),
          course: profile.course.trim(),
          yearOfStudy: profile.yearOfStudy,
          studentIdStatus: profile.studentIdStatus,
          updatedAt: serverTimestamp(),
        },
        // cleanup old unused fields
        idVerification: deleteField(),
        traitCounts: deleteField(),
      },
      { merge: true }
    );
    setStatus("Profile saved ✅");
  }

  return (
    <div className="tf-profile-grid">
      <section className="tf-card tf-panel tf-panel-wide">
        <h2 className="tf-h2">Edit Your Profile</h2>
        <p className="tf-muted">Let teammates know who you are and how you work.</p>

        <div className="tf-project-form">
          <label className="tf-field">
            <span>Full Name</span>
            <input value={profile.fullName} onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))} />
          </label>
          <label className="tf-field">
            <span>Username</span>
            <input value={profile.username} onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))} />
          </label>
          <label className="tf-field">
            <span>College / University</span>
            <input value={profile.university} onChange={(e) => setProfile((p) => ({ ...p, university: e.target.value }))} />
          </label>
          <label className="tf-field">
            <span>Course</span>
            <input value={profile.course} onChange={(e) => setProfile((p) => ({ ...p, course: e.target.value }))} />
          </label>
          <label className="tf-field">
            <span>Year of Study (in this course)</span>
            <select value={profile.yearOfStudy} onChange={(e) => setProfile((p) => ({ ...p, yearOfStudy: e.target.value }))}>
              <option>Year 1</option>
              <option>Year 2</option>
              <option>Year 3</option>
              <option>Year 4</option>
            </select>
          </label>
          <label className="tf-field">
            <span>Student ID Verification</span>
            <select value={profile.studentIdStatus} onChange={(e) => setProfile((p) => ({ ...p, studentIdStatus: e.target.value }))}>
              <option>Not submitted</option>
              <option>Pending review</option>
              <option>Verified</option>
            </select>
          </label>
        </div>

        <button className="tf-btn tf-btn-primary" onClick={saveProfile}>Save Profile</button>
        {status && <p className="tf-muted">{status}</p>}
      </section>

      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">Workstyle</h3>
        {userData?.assessmentCompleted ? (
          <>
            <RadarChart values={traits} />
            <p className="tf-muted">Overall score: <b>{overallScore}</b> / 5</p>
          </>
        ) : (
          <>
            <p className="tf-muted">Complete assessment to reveal your 7-trait radar chart.</p>
            <button className="tf-btn" onClick={onGoAssessment}>Complete Assessment</button>
          </>
        )}
      </section>

      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">Confidence Level</h3>
        {confidence === null ? (
          <p className="tf-muted">Complete at least one project to generate confidence level.</p>
        ) : (
          <p className="tf-muted">Confidence: <b>{confidence}%</b> (based on workstyle score + projects completed)</p>
        )}
      </section>
    </div>
  );
}
