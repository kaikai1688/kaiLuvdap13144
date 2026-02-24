import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import {
  collection,
<<<<<<< codex/create-student-profile-with-id-verification-5wv2ps
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
=======
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
>>>>>>> main
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

<<<<<<< codex/create-student-profile-with-id-verification-5wv2ps
function RadarChart({ values }) {
  const size = 260;
  const center = size / 2;
  const radius = 88;

  const points = TRAITS.map((trait, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
    const value = Number(values[trait] ?? 0);
=======
const YEARS = ["Y1", "Y2", "Y3", "Y4"];

function RadarChart({ values }) {
  const size = 280;
  const center = size / 2;
  const radius = 96;

  const points = TRAITS.map((trait, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
    const value = values[trait] ?? 0;
>>>>>>> main
    const valueRadius = (Math.max(0, Math.min(5, value)) / 5) * radius;
    return {
      trait,
      x: center + Math.cos(angle) * valueRadius,
      y: center + Math.sin(angle) * valueRadius,
<<<<<<< codex/create-student-profile-with-id-verification-5wv2ps
      lx: center + Math.cos(angle) * (radius + 22),
      ly: center + Math.sin(angle) * (radius + 22),
    };
  });

  return (
    <svg className="tf-radar" viewBox={`0 0 ${size} ${size}`}>
=======
      labelX: center + Math.cos(angle) * (radius + 24),
      labelY: center + Math.sin(angle) * (radius + 24),
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg className="tf-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="7-trait radar chart">
>>>>>>> main
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

<<<<<<< codex/create-student-profile-with-id-verification-5wv2ps
      <polygon points={points.map((p) => `${p.x},${p.y}`).join(" ")} className="tf-radar-shape" />

      {points.map((p) => (
        <g key={p.trait}>
          <circle cx={p.x} cy={p.y} r="4" className="tf-radar-dot" />
          <text x={p.lx} y={p.ly} textAnchor="middle" className="tf-radar-label">
            {p.trait}
=======
      <polygon points={polygonPoints} className="tf-radar-shape" />

      {points.map((point) => (
        <g key={point.trait}>
          <circle cx={point.x} cy={point.y} r="4" className="tf-radar-dot" />
          <text x={point.labelX} y={point.labelY} className="tf-radar-label" textAnchor="middle">
            {point.trait}
>>>>>>> main
          </text>
        </g>
      ))}
    </svg>
  );
}

<<<<<<< codex/create-student-profile-with-id-verification-5wv2ps
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
=======
export default function ProfilePage({ user }) {
  const [profile, setProfile] = useState({
    name: "",
    university: "",
    faculty: "",
    yearOfStudy: "Y1",
    confidenceLevel: 70,
  });
  const [selectedYear, setSelectedYear] = useState("Y1");
  const [traits, setTraits] = useState(Object.fromEntries(TRAITS.map((k) => [k, 0])));
  const [status, setStatus] = useState("");
  const [scanStatus, setScanStatus] = useState("Not verified");

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setProfile((prev) => ({
          ...prev,
          name: data.profile?.name || user.displayName || "",
          university: data.profile?.university || "",
          faculty: data.profile?.faculty || "",
          yearOfStudy: data.profile?.yearOfStudy || "Y1",
          confidenceLevel: data.profile?.confidenceLevel ?? 70,
        }));
        setSelectedYear(data.profile?.yearOfStudy || "Y1");
      }
    }

    loadProfile();
  }, [user]);

  useEffect(() => {
    async function loadTraitsFromDatabase() {
      if (!user) return;

      const ratingsQuery = query(
        collection(db, "traitRatings"),
        where("uid", "==", user.uid),
        where("yearOfStudy", "==", selectedYear)
      );
      const ratingsSnap = await getDocs(ratingsQuery);

      if (!ratingsSnap.empty) {
        const aggregated = Object.fromEntries(TRAITS.map((t) => [t, 0]));
        ratingsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          TRAITS.forEach((trait) => {
            aggregated[trait] += Number(data[trait] ?? 0);
          });
        });
        const count = ratingsSnap.size;
        TRAITS.forEach((trait) => {
          aggregated[trait] = Number((aggregated[trait] / count).toFixed(2));
        });
        setTraits(aggregated);
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const userTraits = userSnap.data().traits || {};
        setTraits(Object.fromEntries(TRAITS.map((trait) => [trait, Number(userTraits[trait] ?? 0)])));
      }
    }

    loadTraitsFromDatabase();
  }, [selectedYear, user]);

  const overallScore = useMemo(() => {
    const sum = TRAITS.reduce((acc, key) => acc + Number(traits[key] || 0), 0);
    return (sum / TRAITS.length).toFixed(2);
  }, [traits]);

  async function saveProfile() {
    if (!user) return;
    setStatus("Saving profile...");

    const userRef = doc(db, "users", user.uid);
    await setDoc(
      userRef,
      {
        profile,
      },
      { merge: true }
    );

    setStatus("Profile saved ✅");
  }

  async function runGeminiIdVerification() {
    if (!user) return;

    setScanStatus("Gemini scan in progress...");
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const result = {
      verified: true,
      similarity: 0.91,
      checkedAt: new Date().toISOString(),
      note: "Prototype mode: connect this action to Gemini Vision API + camera feed for real verification.",
    };

    await updateDoc(doc(db, "users", user.uid), {
      idVerification: result,
    });

    setScanStatus(`Verified (${Math.round(result.similarity * 100)}% match)`);
  }

  return (
    <div className="tf-profile-grid">
      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">Student Profile</h3>

        <label className="tf-field">
          <span>Name</span>
          <input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
        </label>

        <label className="tf-field">
          <span>University</span>
          <input value={profile.university} onChange={(e) => setProfile((p) => ({ ...p, university: e.target.value }))} />
        </label>

        <label className="tf-field">
          <span>Faculty</span>
          <input value={profile.faculty} onChange={(e) => setProfile((p) => ({ ...p, faculty: e.target.value }))} />
        </label>

        <div>
          <div className="tf-field-label">Year of study filter</div>
          <div className="tf-year-row">
            {YEARS.map((year) => (
              <button
                key={year}
                type="button"
                className={`tf-btn ${selectedYear === year ? "tf-year-active" : ""}`}
                onClick={() => {
                  setSelectedYear(year);
                  setProfile((p) => ({ ...p, yearOfStudy: year }));
                }}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <label className="tf-field">
          <span>Confidence level: {profile.confidenceLevel}%</span>
          <input
            type="range"
            min="0"
            max="100"
            value={profile.confidenceLevel}
            onChange={(e) => setProfile((p) => ({ ...p, confidenceLevel: Number(e.target.value) }))}
          />
        </label>

        <button className="tf-btn tf-btn-primary" onClick={saveProfile}>Save profile</button>
>>>>>>> main
        {status && <p className="tf-muted">{status}</p>}
      </section>

      <section className="tf-card tf-panel">
<<<<<<< codex/create-student-profile-with-id-verification-5wv2ps
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
=======
        <h3 className="tf-section-title">7-trait Radar Chart</h3>
        <p className="tf-muted tf-small">Data source: traitRatings collection filtered by {selectedYear}. Falls back to users.traits if no rating is found.</p>
        <RadarChart values={traits} />
        <div className="tf-muted">Average trait score: <b>{overallScore}</b> / 5</div>
      </section>

      <section className="tf-card tf-panel tf-panel-wide">
        <h3 className="tf-section-title">Verify Student ID (Gemini AI)</h3>
        <p className="tf-muted tf-small">
          Gemini should compare the live face from camera with the face on the student ID the user is holding.
          This section stores scan result metadata and provides a prototype trigger.
        </p>
        <button className="tf-btn" onClick={runGeminiIdVerification}>Start Gemini ID Scan</button>
        <p>{scanStatus}</p>
>>>>>>> main
      </section>
    </div>
  );
}
