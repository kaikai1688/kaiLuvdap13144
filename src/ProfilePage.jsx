// src/ProfilePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import AssessmentPage from "./AssessmentPage";

const TRAITS = [
  "communication",
  "conflictHandling",
  "awareness",
  "supportiveness",
  "adaptability",
  "alignment",
  "trustworthiness",
];

function RadarChart({ values = {} }) {
  const size = 280;
  const center = size / 2;
  const radius = 96;

  const points = TRAITS.map((trait, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
    const value = Number(values?.[trait] ?? 0);
    const valueRadius = (Math.max(0, Math.min(5, value)) / 5) * radius;

    return {
      trait,
      x: center + Math.cos(angle) * valueRadius,
      y: center + Math.sin(angle) * valueRadius,
      lx: center + Math.cos(angle) * (radius + 22),
      ly: center + Math.sin(angle) * (radius + 22),
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg className="tf-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="7-trait radar chart">
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

      <polygon points={polygonPoints} className="tf-radar-shape" />

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

function GeminiVerificationCard({ user, profile, onStatusChange }) {
  const [cameraOn, setCameraOn] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(profile?.geminiVerification?.status || "Not verified");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
      setVerifyStatus("Camera ready");
    } catch {
      setVerifyStatus("Camera access denied or unavailable");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function runGeminiCheck() {
    if (!user) return;
    setVerifyStatus("Gemini verification in progress...");

    // Prototype placeholder: real flow must be done on secure backend.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const result = {
      status: cameraOn ? "Verified (prototype)" : "Pending camera capture",
      lastCheckedAt: new Date().toISOString(),
      note: cameraOn
        ? "Prototype: connect Gemini face-vs-ID via secure backend endpoint."
        : "Turn on camera and hold student ID in frame.",
    };

    // ✅ IMPORTANT: use dotted path update so we don't overwrite the whole profile object
    await updateDoc(doc(db, "users", user.uid), {
      "profile.geminiVerification": result,
      profileUpdatedAt: serverTimestamp(),
    });

    onStatusChange?.(result.status, result.note);
    setVerifyStatus(result.status);
  }

  return (
    <section className="tf-card tf-panel">
      <h3 className="tf-section-title">Student ID Verification</h3>
      <p className="tf-muted tf-small">Use camera + prototype Gemini workflow.</p>

      <video className="tf-camera" ref={videoRef} autoPlay playsInline muted />

      <div className="tf-inline-actions">
        {!cameraOn ? (
          <button className="tf-btn" onClick={startCamera}>
            Enable Camera
          </button>
        ) : (
          <button className="tf-btn" onClick={stopCamera}>
            Stop Camera
          </button>
        )}
        <button className="tf-btn tf-btn-primary" onClick={runGeminiCheck}>
          Run Gemini Verification
        </button>
      </div>

      <p className="tf-muted">Status: {verifyStatus}</p>
    </section>
  );
}

export default function ProfilePage({ user, userData }) {
  const [profile, setProfile] = useState({
    fullName: "",
    username: "",
    university: "",
    course: "",
    yearOfStudy: "1",
    studentIdStatus: "Not submitted",
    geminiVerification: { status: "Not verified", lastCheckedAt: null, note: "" },
  });

  const [projectsCompleted, setProjectsCompleted] = useState(0);
  const [status, setStatus] = useState("");
  const [showAssessment, setShowAssessment] = useState(false);

  // Live user doc (for profile fields + traits)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setProfile((prev) => ({
        ...prev,
        fullName: data.profile?.fullName || user.displayName || "",
        username: data.profile?.username || "",
        university: data.profile?.university || "",
        course: data.profile?.course || "",
        yearOfStudy: String(data.profile?.yearOfStudy || "1"),
        studentIdStatus: data.profile?.studentIdStatus || "Not submitted",
        geminiVerification: data.profile?.geminiVerification || prev.geminiVerification,
      }));
    });
    return () => unsub();
  }, [user]);

  // Count completed projects
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "projects"),
      where("ownerUid", "==", user.uid),
      where("status", "==", "completed")
    );
    const unsub = onSnapshot(q, (snap) => setProjectsCompleted(snap.size));
    return () => unsub();
  }, [user]);

  const traits = useMemo(() => userData?.traits || {}, [userData]);

  const overallAvg = useMemo(() => {
    const sum = TRAITS.reduce((acc, t) => acc + Number(traits[t] || 0), 0);
    return sum ? sum / TRAITS.length : 0;
  }, [traits]);

  const overallText = useMemo(() => {
    const score = overallAvg;
    return score ? score.toFixed(2) : "0.00";
  }, [overallAvg]);

  const confidence = useMemo(() => {
    if (!projectsCompleted) return null;
    const traitBased = overallAvg * 16; // ~0..80
    const projectBonus = Math.min(20, projectsCompleted * 5);
    return Math.round(Math.min(100, traitBased + projectBonus));
  }, [overallAvg, projectsCompleted]);

  async function saveProfile() {
    if (!user) return;

    // (Optional) clear previous messages
    setStatus("");

    if (
      !profile.fullName.trim() ||
      !profile.username.trim() ||
      !profile.university.trim() ||
      !profile.course.trim()
    ) {
      setStatus("Please complete all required profile fields.");
      return;
    }

    const normalizedUsername = profile.username.trim().toLowerCase();

    try {
      // Check username uniqueness
      const usernameQ = query(
        collection(db, "users"),
        where("profile.usernameLower", "==", normalizedUsername)
      );
      const usernameSnap = await getDocs(usernameQ);
      const exists = usernameSnap.docs.some((d) => d.id !== user.uid);

      if (exists) {
        setStatus("Username already exists. Please choose another one.");
        return;
      }

      setStatus("Saving profile...");

      // ✅ IMPORTANT FIX:
      // Use updateDoc + dotted paths so we DON'T overwrite the whole "profile" map
      // (which would wipe geminiVerification, etc.)
      await updateDoc(doc(db, "users", user.uid), {
        "profile.fullName": profile.fullName.trim(),
        "profile.username": profile.username.trim(),
        "profile.usernameLower": normalizedUsername,
        "profile.university": profile.university.trim(),
        "profile.course": profile.course.trim(),
        "profile.yearOfStudy": String(profile.yearOfStudy),
        "profile.studentIdStatus": profile.studentIdStatus,
        profileUpdatedAt: serverTimestamp(),

        // cleanup old unused fields (root-level)
        idVerification: deleteField(),
        traitCounts: deleteField(),
      });

      setStatus("Profile saved ✅");
    } catch (err) {
      console.error(err);
      setStatus(err?.message || "Save failed. Please check Firestore rules/permissions.");
    }
  }

  return (
    <div className="tf-profile-page">
      <section className="tf-card tf-panel tf-panel-wide tf-profile-main-card">
        <h2 className="tf-h2">Edit Your Profile</h2>
        <p className="tf-muted">Let teammates know who you are and how you work.</p>

        <div className="tf-project-form">
          <label className="tf-field">
            <span>Full Name *</span>
            <input
              value={profile.fullName}
              onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
            />
          </label>

          <label className="tf-field">
            <span>Username *</span>
            <input
              value={profile.username}
              onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
            />
          </label>

          <label className="tf-field">
            <span>College / University *</span>
            <input
              value={profile.university}
              onChange={(e) => setProfile((p) => ({ ...p, university: e.target.value }))}
            />
          </label>

          <label className="tf-field">
            <span>Course *</span>
            <input
              value={profile.course}
              onChange={(e) => setProfile((p) => ({ ...p, course: e.target.value }))}
            />
          </label>

          <label className="tf-field">
            <span>Year of Study</span>
            <select
              value={String(profile.yearOfStudy)}
              onChange={(e) => setProfile((p) => ({ ...p, yearOfStudy: e.target.value }))}
            >
              {Array.from({ length: 9 }).map((_, i) => {
                const year = String(i + 1);
                return (
                  <option key={year} value={year}>
                    Year {year}
                  </option>
                );
              })}
              <option value="10">Year 10+</option>
            </select>
          </label>

          <label className="tf-field">
            <span>Student ID Status</span>
            <select
              value={profile.studentIdStatus}
              onChange={(e) => setProfile((p) => ({ ...p, studentIdStatus: e.target.value }))}
            >
              <option>Not submitted</option>
              <option>Pending review</option>
              <option>Verified</option>
            </select>
          </label>
        </div>

        <div className="tf-inline-actions">
          <button className="tf-btn tf-btn-primary" onClick={saveProfile}>
            Save Profile
          </button>
          {status && <p className="tf-muted">{status}</p>}
        </div>
      </section>

      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">Workstyle</h3>

        {userData?.assessmentCompleted ? (
          <>
            <RadarChart values={traits} />
            <p className="tf-muted">
              Overall score: <b>{overallText}</b> / 5
            </p>
          </>
        ) : (
          <>
            <p className="tf-muted">Complete assessment to reveal your radar chart.</p>
            <button className="tf-btn" onClick={() => setShowAssessment((v) => !v)}>
              Complete Assessment
            </button>
            {showAssessment && (
              <div style={{ marginTop: 12 }}>
                <AssessmentPage
                  user={user}
                  onDone={() => {
                    setShowAssessment(false);
                    setStatus("Assessment completed ✅");
                  }}
                />
              </div>
            )}
          </>
        )}
      </section>

      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">Confidence Level</h3>
        {confidence === null ? (
          <p className="tf-muted">Complete at least one project to generate confidence level.</p>
        ) : (
          <p className="tf-muted">
            Confidence: <b>{confidence}%</b> (workstyle score + completed projects)
          </p>
        )}
        <p className="tf-muted tf-small" style={{ marginTop: 8 }}>
          Projects completed: <b>{projectsCompleted}</b>
        </p>
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