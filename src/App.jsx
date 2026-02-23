// src/App.jsx
import { useEffect, useState } from "react";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import AssessmentPage from "./AssessmentPage";
import CreateProjectPage from "./CreateProjectPage";
import "./Login.css";

export default function App() {
  const [user, setUser] = useState(null);

  // stage: "assessment" (must do first) -> "project"
  const [stage, setStage] = useState("assessment");

  // We will load from Firestore to know if assessment is already completed
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (!u) {
        setStage("assessment");
        setLoadingProfile(false);
        return;
      }

      setLoadingProfile(true);

      // Create/load user profile
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await setDoc(ref, {
          displayName: u.displayName ?? "",
          email: u.email ?? "",
          photoURL: u.photoURL ?? "",
          createdAt: serverTimestamp(),
          traits: null,
          traitCounts: null,
          projectsCompleted: 0,
          assessmentCompleted: false,
        });
        setStage("assessment");
      } else {
        const data = snap.data();
        // If already completed, skip assessment
        setStage(data?.assessmentCompleted ? "project" : "assessment");
      }

      setLoadingProfile(false);
    });

    return () => unsub();
  }, []);

  async function handleLogin() {
    await signInWithPopup(auth, googleProvider);
  }

  async function handleLogout() {
    await signOut(auth);
  }

  // Not logged in -> nice login page
  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">🤝</div>
          <h1>Welcome to TeamFit</h1>
          <p style={{ color: "#666" }}>
            Find teammates that fit your working style.
          </p>

          <button className="google-btn" onClick={handleLogin}>
            Continue with Google
          </button>

          <p style={{ marginTop: 14, color: "#888", fontSize: 12 }}>
            (Hackathon prototype: Google sign-in only)
          </p>
        </div>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        Loading profile...
      </div>
    );
  }

  // Logged in -> enforce flow
  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          Signed in as <b>{user.displayName}</b>
          <div style={{ color: "#666", fontSize: 12 }}>{user.email}</div>
        </div>
        <button onClick={handleLogout}>Sign out</button>
      </div>

      <hr style={{ margin: "18px 0" }} />

      {stage === "assessment" ? (
        <AssessmentPage
          user={user}
          onDone={() => {
            // after save in AssessmentPage, move to project page
            setStage("project");
          }}
        />
      ) : (
        <CreateProjectPage user={user} />
      )}
    </div>
  );
}