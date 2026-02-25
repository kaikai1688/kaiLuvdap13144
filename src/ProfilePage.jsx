import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "./firebase";
import {
  collection,
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
  const radius = 90;

  const points = TRAITS.map((trait, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
    const value = Number(values[trait] ?? 0);
    const rr = (Math.max(0, Math.min(5, value)) / 5) * radius;

    return {
      trait,
      x: center + Math.cos(angle) * rr,
      y: center + Math.sin(angle) * rr,
      lx: center + Math.cos(angle) * (radius + 24),
      ly: center + Math.sin(angle) * (radius + 24),
    };
  });

  return (
    <svg className="tf-radar" viewBox={`0 0 ${size} ${size}`}>
      {[1, 2, 3, 4, 5].map((lv) => {
        const rr = (lv / 5) * radius;
        const ring = TRAITS.map((_, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
          return `${center + Math.cos(angle) * rr},${center + Math.sin(angle) * rr}`;
        }).join(" ");
        return <polygon key={lv} points={ring} className="tf-radar-ring" />;
      })}

      {TRAITS.map((_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
        return <line key={i} x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} className="tf-radar-axis" />;
      })}

      <polygon points={points.map((p) => `${p.x},${p.y}`).join(" ")} className="tf-radar-shape" />

      {points.map((p) => (
        <g key={p.trait}>
          <circle cx={p.x} cy={p.y} r="3.8" className="tf-radar-dot" />
          <text x={p.lx} y={p.ly} textAnchor="middle" className="tf-radar-label">{p.trait}</text>
        </g>
      ))}
    </svg>
  );
}

function GeminiVerificationCard({ user, profile, onStatusChange }) {
  const [cameraOn, setCameraOn] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(profile?.geminiVerification?.status || "Not verified");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraOn(true);
      setVerifyStatus("Camera ready");
    } catch {
      setVerifyStatus("Camera access denied or unavailable");
    }
  }

  async function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  }

  async function runGeminiCheck() {
    if (!user) return;
    setVerifyStatus("Gemini verification in progress...");

    await new Promise((resolve) => setTimeout(resolve, 1200));
    const result = {
      status: cameraOn ? "Verified (prototype)" : "Pending camera capture",
      lastCheckedAt: new Date().toISOString(),
      note: cameraOn
        ? "Prototype integration: Gemini face-vs-ID check should be connected via secure backend endpoint."
        : "Turn on camera and hold student ID in frame.",
    };

    await setDoc(doc(db, "users", user.uid), {
      profile: {
        geminiVerification: result,
      },
    }, { merge: true });

    onStatusChange?.(result.status, result.note);
    setVerifyStatus(result.status);
  }

  return (
    <section className="tf-card tf-panel">
      <h3 className="tf-section-title">Student ID Verification</h3>
      <p className="tf-muted tf-small">Use camera and Gemini AI verification workflow.</p>

      <video className="tf-camera" ref={videoRef} autoPlay playsInline muted />

      <div className="tf-inline-actions">
        {!cameraOn ? (
          <button className="tf-btn" onClick={startCamera}>Enable Camera</button>
        ) : (
          <button className="tf-btn" onClick={stopCamera}>Stop Camera</button>
        )}
        <button className="tf-btn tf-btn-primary" onClick={runGeminiCheck}>Run Gemini Verification</button>
      </div>

      <p className="tf-muted">Status: {verifyStatus}</p>
    </section>
  );
}

export default function ProfilePage({ user, onGoAssessment }) {
  const [userData, setUserData] = useState(null);
  const [projectsCompleted, setProjectsCompleted] = useState(0);
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState({
    fullName: "",
    username: "",
    university: "",
    course: "",
    yearOfStudy: "1",
    studentIdStatus: "Not submitted",
    geminiVerification: {
      status: "Not verified",
      lastCheckedAt: null,
      note: "",
    },
  });

  useEffect(() => {
    if (!user) return undefined;

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
        yearOfStudy: data.profile?.yearOfStudy || "1",
        studentIdStatus: data.profile?.studentIdStatus || "Not submitted",
        geminiVerification: data.profile?.geminiVerification || prev.geminiVerification,
      }));
    });

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    const q = query(collection(db, "projects"), where("memberUids", "array-contains", user.uid), where("status", "==", "completed"));
    const unsub = onSnapshot(q, (snap) => setProjectsCompleted(snap.size));
    return () => unsub();
  }, [user]);

  const traits = useMemo(() => userData?.traits || {}, [userData]);

  const overallScore = useMemo(() => {
    const sum = TRAITS.reduce((acc, trait) => acc + Number(traits[trait] ?? 0), 0);
    const avg = sum / TRAITS.length;
    return Number.isFinite(avg) ? avg : 0;
  }, [traits]);

  const confidencePercent = useMemo(() => {
    if (projectsCompleted < 1) return null;
    const traitPart = (overallScore / 5) * 70;
    const projectPart = Math.min(30, projectsCompleted * 6);
    return Math.round(Math.min(100, traitPart + projectPart));
  }, [overallScore, projectsCompleted]);

  async function saveProfile() {
    if (!user) return;

    if (!profile.fullName.trim() || !profile.username.trim() || !profile.university.trim() || !profile.course.trim()) {
      setStatus("Please complete all required fields.");
      return;
    }

    const normalized = profile.username.trim().toLowerCase();
    const q = query(collection(db, "users"), where("profile.usernameLower", "==", normalized));
    const snap = await getDocs(q);

    if (snap.docs.some((d) => d.id !== user.uid)) {
      setStatus("Username already exists. Please use another one.");
      return;
    }

    setStatus("Saving profile...");

    await setDoc(doc(db, "users", user.uid), {
      profile: {
        fullName: profile.fullName.trim(),
        username: profile.username.trim(),
        usernameLower: normalized,
        university: profile.university.trim(),
        course: profile.course.trim(),
        yearOfStudy: profile.yearOfStudy,
        studentIdStatus: profile.studentIdStatus,
        geminiVerification: profile.geminiVerification,
        updatedAt: serverTimestamp(),
      },
    }, { merge: true });

    setStatus("Profile saved ✅");
  }

  return (
    <div className="tf-profile-page">
      <section className="tf-card tf-panel tf-panel-wide tf-profile-main-card">
        <div className="tf-profile-head">
          <div className="tf-profile-icon">◉</div>
          <div>
            <h2 className="tf-h2">Edit Your Profile</h2>
            <p className="tf-muted">Let teammates know who you are and how you work</p>
          </div>
        </div>

        <h3 className="tf-section-title">Basic Info</h3>

        <div className="tf-project-form">
          <label className="tf-field">
            <span>Full Name *</span>
            <input value={profile.fullName} onChange={(e) => setProfile((prev) => ({ ...prev, fullName: e.target.value }))} />
          </label>

          <label className="tf-field">
            <span>Username *</span>
            <input value={profile.username} onChange={(e) => setProfile((prev) => ({ ...prev, username: e.target.value }))} />
          </label>

          <label className="tf-field">
            <span>College / University</span>
            <input value={profile.university} onChange={(e) => setProfile((prev) => ({ ...prev, university: e.target.value }))} />
          </label>

          <label className="tf-field">
            <span>Course</span>
            <input value={profile.course} onChange={(e) => setProfile((prev) => ({ ...prev, course: e.target.value }))} />
          </label>

          <label className="tf-field">
            <span>Year of Study (for current course)</span>
            <select value={profile.yearOfStudy} onChange={(e) => setProfile((prev) => ({ ...prev, yearOfStudy: e.target.value }))}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                <option key={v} value={String(v)}>{v}</option>
              ))}
              <option value="11+">More than 10</option>
            </select>
          </label>

          <label className="tf-field">
            <span>Student ID Status</span>
            <select value={profile.studentIdStatus} onChange={(e) => setProfile((prev) => ({ ...prev, studentIdStatus: e.target.value }))}>
              <option>Not submitted</option>
              <option>Pending review</option>
              <option>Verified</option>
            </select>
          </label>
        </div>

        <div className="tf-inline-actions">
          <button className="tf-btn tf-btn-primary" onClick={saveProfile}>Save Profile</button>
        </div>
        {status && <p className="tf-muted">{status}</p>}
      </section>

      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">Workstyle</h3>
        {userData?.assessmentCompleted ? (
          <>
            <RadarChart values={traits} />
            <p className="tf-muted">Overall score: <b>{overallScore.toFixed(2)}</b> out of 7 traits</p>
          </>
        ) : (
          <button className="tf-btn tf-btn-primary" onClick={onGoAssessment}>Complete Assessment</button>
        )}
      </section>

      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">Confidence Level</h3>
        {confidencePercent === null ? (
          <p className="tf-muted">Complete at least one project to unlock confidence level.</p>
        ) : (
          <p className="tf-muted">Confidence level: <b>{confidencePercent}%</b></p>
        )}
      </section>

      <GeminiVerificationCard
        user={user}
        profile={profile}
        onStatusChange={(nextStatus, note) => {
          setProfile((prev) => ({
            ...prev,
            geminiVerification: {
              ...(prev.geminiVerification || {}),
              status: nextStatus,
              note,
              lastCheckedAt: new Date().toISOString(),
            },
          }));
        }}
      />
    </div>
  );
}
