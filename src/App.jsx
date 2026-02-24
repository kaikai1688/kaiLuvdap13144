// src/App.jsx
import { useEffect, useState } from "react";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import AssessmentPage from "./AssessmentPage";
import ProfilePage from "./ProfilePage";
import "./AppShell.css";

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
      <div className="tf-bg">
        <div className="tf-auth-wrap">
          <div className="tf-card tf-auth-card">
            <div className="tf-logo">🤝</div>
            <h1 className="tf-h1">Find your perfect team</h1>
            <p className="tf-muted">
              Match with teammates who complement your workstyle. From FYP to creative projects — build your dream team effortlessly.
            </p>

            <button className="tf-btn tf-btn-primary tf-btn-lg" onClick={handleLogin}>
              <span className="tf-google-dot" aria-hidden="true" />
              Continue with Google
            </button>

            <p className="tf-footnote">
              Hackathon prototype · Google sign-in only
            </p>
          </div>

          <div className="tf-auth-side">
            <div className="tf-card tf-side-card">
              <div className="tf-side-title">How it works</div>
              <ul className="tf-list">
                <li>Quick assessment (2–3 minutes)</li>
                <li>Create your profile</li>
                <li>Get matched by working style</li>
              </ul>

              <div className="tf-badges">
                <span className="tf-badge">Communication</span>
                <span className="tf-badge">Adaptability</span>
                <span className="tf-badge">Trust</span>
                <span className="tf-badge">Alignment</span>
                <span className="tf-badge">Alignment</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div className="tf-bg">
        <div className="tf-container">
          <div className="tf-card tf-loading">
            <div className="tf-spinner" aria-hidden="true" />
            <div>
              <div className="tf-loading-title">Loading your profile</div>
              <div className="tf-muted">Setting things up…</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged in -> enforce flow
  return (
    <div className="tf-bg">
      <div className="tf-container">
        <header className="tf-topbar tf-card">
          <div className="tf-user">
            <img
              className="tf-avatar"
              src={user.photoURL || "https://www.gravatar.com/avatar/?d=mp"}
              alt="User avatar"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="tf-user-name">
                {user.displayName || "Signed in"}
              </div>
              <div className="tf-user-email">{user.email}</div>
            </div>
          </div>

          <div className="tf-actions">
            <span className="tf-chip">
              {stage === "assessment" ? "Step 1 · Assessment" : "Step 2 · Profile"}
            </span>
            <button className="tf-btn tf-btn-ghost" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </header>

        <main className="tf-card tf-main">
          {stage === "assessment" ? (
            <>
              <div className="tf-main-head">
                <div>
                  <div className="tf-kicker">Before you start</div>
                  <h2 className="tf-h2">Working style assessment</h2>
                  <p className="tf-muted">
                    Answer a few questions so we can match you with teammates who fit.
                  </p>
                </div>
                <div className="tf-progress" aria-hidden="true">
                  <div className="tf-progress-bar" style={{ width: "50%" }} />
                </div>
              </div>

              <div className="tf-divider" />

              <AssessmentPage
                user={user}
                onDone={() => {
                  // after save in AssessmentPage, move to project page
                  setStage("project");
                }}
              />
            </>
          ) : (
            <>
              <div className="tf-main-head">
                <div>
                  <div className="tf-kicker">Next step</div>
                  <h2 className="tf-h2">Create your profile</h2>
                  <p className="tf-muted">
                    Set up your student details, review your trait radar, and verify your student ID.
                  </p>
                </div>
                <div className="tf-progress" aria-hidden="true">
                  <div className="tf-progress-bar" style={{ width: "100%" }} />
                </div>
              </div>

              <div className="tf-divider" />

              <ProfilePage user={user} />
            </>
          )}
        </main>

        <footer className="tf-footer">
          <span className="tf-muted">TeamFit · Prototype</span>
        </footer>
      </div>
    </div>
  );
}
