// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  NavLink,
  useNavigate,
  useLocation,
  useOutletContext,
} from "react-router-dom";

import { auth, googleProvider, db } from "./firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import {
  collection,
  deleteField,
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

import HomePage from "./HomePage";
import MessagesPage from "./MessagesPage";
import ProfilePage from "./ProfilePage";
import ProjectsPage from "./ProjectsPage";
import RatingPage from "./RatingPage";
import RequireReady from "./RequireReady";
import "./AppShell.css";

const PREVIEW_SLIDES = [
  {
    title: "Built for student teams",
    subtitle: "Create projects and get matched by assignment, year and workstyle.",
    image:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Visual trait insights",
    subtitle: "Research based: Review 7 traits radar charts and confidence level.",
    image:
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Student ID verification",
    subtitle: "Prototype Gemini verification flow for face + student ID checks.",
    image:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
  },
];

function LoginPreview() {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSlide((prev) => (prev + 1) % PREVIEW_SLIDES.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="tf-preview-card">
      <div className="tf-preview-image-wrap">
        {PREVIEW_SLIDES.map((item, idx) => (
          <img
            key={item.title}
            src={item.image}
            alt={item.title}
            className={`tf-preview-image ${slide === idx ? "is-active" : ""}`}
            referrerPolicy="no-referrer"
          />
        ))}
      </div>

      <div className="tf-preview-caption">
        <h3>{PREVIEW_SLIDES[slide].title}</h3>
        <p>{PREVIEW_SLIDES[slide].subtitle}</p>
      </div>

      <div className="tf-preview-dots" aria-hidden="true">
        {PREVIEW_SLIDES.map((_, idx) => (
          <span key={idx} className={slide === idx ? "is-active" : ""} />
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="tf-bg">
      <div className="tf-container">
        <div className="tf-card tf-loading">
          <div className="tf-spinner" aria-hidden="true" />
          <div>
            <div className="tf-loading-title">Loading your profile</div>
            <div className="tf-muted">Setting things up...</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoggedOutView({ onLogin }) {
  return (
    <div className="tf-bg">
      <div className="tf-auth-wrap tf-auth-wrap-xl">
        <div className="tf-card tf-auth-card">
          <div className="tf-brand-lockup">
            <div className="tf-logo-mark">T</div>
            <div className="tf-logo-word">TeamFit</div>
          </div>

          <h1 className="tf-h1">Find Your Perfect Team</h1>
          <p className="tf-muted">
            Match with teammates who complement your workstyle. From FYP to creative projects —
            build your dream team effortlessly.
          </p>

          <button className="tf-btn tf-btn-primary tf-btn-lg" onClick={onLogin}>
            <span className="tf-google-dot" aria-hidden="true" />
            Continue with Google
          </button>

          <p className="tf-footnote">By continuing, you agree to TeamFit Terms and Privacy Policy.</p>
        </div>

        <LoginPreview />
      </div>
    </div>
  );
}

function ProfileMenu({ user, onGoProfile, onGoMessages, onLogout }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="tf-menu" ref={wrapRef}>
      <button className="tf-avatar-btn" onClick={() => setOpen((v) => !v)}>
        <img
          className="tf-avatar"
          src={user.photoURL || "https://www.gravatar.com/avatar/?d=mp"}
          alt="User avatar"
          referrerPolicy="no-referrer"
        />
      </button>

      {open && (
        <div className="tf-menu-pop">
          <button
            className="tf-menu-item"
            onClick={() => {
              setOpen(false);
              onGoProfile();
            }}
          >
            My Profile
          </button>
          <button
            className="tf-menu-item"
            onClick={() => {
              setOpen(false);
              onGoMessages();
            }}
          >
            My Messages
          </button>
          <div className="tf-menu-sep" />
          <button
            className="tf-menu-item danger"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

function LoggedInLayout({
  user,
  userData,
  profileReady,
  onLogout,
  ratingNotice,
  onRateNow,
  onDismissRating,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const gateMsg = location.state?.gateMsg || "";

  function goProfile() {
    navigate("/profile", { replace: false, state: {} });
  }

  function goMessages() {
    navigate("/messages", { replace: false });
  }

  return (
    <div className="tf-bg">
      <div className="tf-container tf-container-wide">
        <header className="tf-topbar tf-card tf-topbar-nav">
          <div className="tf-brand" style={{ cursor: "pointer" }} onClick={() => navigate("/home")}>
            <div className="tf-logo">T</div>
            <strong>TeamFit</strong>
          </div>

          <nav className="tf-nav-links">
            <NavLink
              to="/home"
              className={({ isActive }) => `tf-nav-btn ${isActive ? "is-active" : ""}`}
            >
              Home
            </NavLink>
            <NavLink
              to="/projects"
              className={({ isActive }) => `tf-nav-btn ${isActive ? "is-active" : ""}`}
            >
              Projects
            </NavLink>
            <NavLink
              to="/messages"
              className={({ isActive }) => `tf-nav-btn ${isActive ? "is-active" : ""}`}
            >
              Messages
            </NavLink>
          </nav>

          <div className="tf-actions">
            <ProfileMenu
              user={user}
              onGoProfile={goProfile}
              onGoMessages={goMessages}
              onLogout={onLogout}
            />
          </div>
        </header>

        {/* ✅ Persistent dismiss notification */}
        {ratingNotice && (
          <div
            className="tf-card tf-panel"
            style={{ marginTop: 12, borderColor: "#ffe3a4", background: "#fff4d9" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <b>Pending rating</b>
                <div style={{ marginTop: 4 }}>
                  Please rate your teammates for <b>{ratingNotice.projectName}</b> (project ended).
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button className="tf-btn tf-btn-primary" onClick={onRateNow}>
                  Rate Now
                </button>
                <button className="tf-btn" onClick={onDismissRating}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {gateMsg && (
          <div className="tf-card tf-panel" style={{ marginTop: 12 }}>
            <p style={{ margin: 0 }}>{gateMsg}</p>
          </div>
        )}

        <main className="tf-main-page">
          <Outlet context={{ user, userData, profileReady }} />
        </main>
      </div>
    </div>
  );
}

function useOutletCtx() {
  return useOutletContext();
}

function HomeRoute() {
  const { user, userData } = useOutletCtx();
  const navigate = useNavigate();
  return (
    <HomePage
      onGoProjects={() => navigate("/projects")}
      onGoProfile={() => navigate("/profile")}
      user={user}
      userData={userData}
    />
  );
}

function ProfileRoute() {
  const { user, userData } = useOutletCtx();
  return <ProfilePage user={user} userData={userData} />;
}

function ProjectsRoute() {
  const { user, userData, profileReady } = useOutletCtx();
  return (
    <RequireReady userData={userData} profileReady={profileReady}>
      <ProjectsPage user={user} />
    </RequireReady>
  );
}

function MessagesRoute() {
  const { user, userData, profileReady } = useOutletCtx();
  return (
    <RequireReady userData={userData} profileReady={profileReady}>
      <MessagesPage user={user} />
    </RequireReady>
  );
}

function RatingRoute() {
  const { user } = useOutletCtx();
  return <RatingPage user={user} />;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [userData, setUserData] = useState(null);

  // ratingNotice: { projectId, projectName }
  const [ratingNotice, setRatingNotice] = useState(null);

  // 1) auth + ensure user doc exists
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        setUserData(null);
        setLoadingProfile(false);
        return;
      }

      setLoadingProfile(true);

      const ref = doc(db, "users", nextUser.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await setDoc(
          ref,
          {
            displayName: nextUser.displayName ?? "",
            email: nextUser.email ?? "",
            photoURL: nextUser.photoURL ?? "",
            createdAt: serverTimestamp(),
            assessmentCompleted: false,
            traits: {
              communication: 0,
              conflictHandling: 0,
              awareness: 0,
              supportiveness: 0,
              adaptability: 0,
              alignment: 0,
              trustworthiness: 0,
            },
            profile: {
              fullName: nextUser.displayName ?? "",
              username: "",
              usernameLower: "",
              university: "",
              course: "",
              yearOfStudy: "1",
              studentIdStatus: "Not submitted",
              geminiVerification: {
                status: "Not verified",
                lastCheckedAt: null,
                note: "",
              },
            },
            ratingDismissed: {}, // ✅ store dismissed project IDs
            idVerification: deleteField(),
            traitCounts: deleteField(),
          },
          { merge: true }
        );
      }

      setLoadingProfile(false);
    });

    return () => unsub();
  }, []);

  // 2) live user doc
  useEffect(() => {
    if (!user) return undefined;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      setUserData(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [user]);

  const profileReady = useMemo(() => {
    const p = userData?.profile;
    return Boolean(p?.fullName && p?.username && p?.university && p?.course && p?.yearOfStudy);
  }, [userData]);

  // ✅ FIX: Always show Google account chooser (prevents reusing previous account automatically)
  async function handleLogin() {
    googleProvider.setCustomParameters({
      prompt: "select_account",
    });
    await signInWithPopup(auth, googleProvider);
  }

  async function handleLogout() {
    await signOut(auth);
  }

  // If we just submitted ratings, clear the banner immediately
  useEffect(() => {
    const ratedId = location.state?.ratedProjectId;
    if (!ratedId) return;

    setRatingNotice((prev) => (prev?.projectId === ratedId ? null : prev));
  }, [location.state]);

  // ✅ Check pending ratings (skip dismissed) and re-check on navigation
  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;

    async function checkPendingRatings() {
      try {
        const dismissedMap = userData?.ratingDismissed || {};

        const q = query(
          collection(db, "projects"),
          where("memberUids", "array-contains", user.uid),
          where("status", "==", "completed")
        );

        const snap = await getDocs(q);
        if (cancelled) return;

        for (const d of snap.docs) {
          const projectId = d.id;
          const proj = d.data();

          // skip dismissed
          if (dismissedMap && dismissedMap[projectId]) continue;

          const ratingSnap = await getDoc(doc(db, "projectRatings", projectId));
          if (!ratingSnap.exists()) continue;

          const ratingData = ratingSnap.data();
          if ((ratingData.status || "open") !== "open") continue;

          const subSnap = await getDoc(
            doc(db, "projectRatings", projectId, "submissions", user.uid)
          );
          if (subSnap.exists()) continue;

          if (!cancelled) {
            setRatingNotice({ projectId, projectName: proj.name || "Project" });
          }
          return; // show one notice only
        }

        if (!cancelled) setRatingNotice(null);
      } catch (e) {
        console.error(e);
        if (!cancelled) setRatingNotice(null);
      }
    }

    checkPendingRatings();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, userData?.ratingDismissed, location.key]);

  async function dismissNotice() {
    if (!user?.uid || !ratingNotice?.projectId) {
      setRatingNotice(null);
      return;
    }

    const pid = ratingNotice.projectId;

    // 1) hide immediately in UI
    setRatingNotice(null);

    // 2) persist dismissal in Firestore so it won't pop again
    try {
      await updateDoc(doc(db, "users", user.uid), {
        [`ratingDismissed.${pid}`]: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
    }
  }

  function rateNow() {
    if (!ratingNotice?.projectId) return;
    navigate(`/rate/${ratingNotice.projectId}`);
  }

  if (!authReady) return <LoadingState />;
  if (!user) return <LoggedOutView onLogin={handleLogin} />;
  if (loadingProfile) return <LoadingState />;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />

      <Route
        element={
          <LoggedInLayout
            user={user}
            userData={userData}
            profileReady={profileReady}
            onLogout={handleLogout}
            ratingNotice={ratingNotice}
            onRateNow={rateNow}
            onDismissRating={dismissNotice}
          />
        }
      >
        <Route path="/home" element={<HomeRoute />} />
        <Route path="/profile" element={<ProfileRoute />} />
        <Route path="/projects" element={<ProjectsRoute />} />
        <Route path="/messages" element={<MessagesRoute />} />
        <Route path="/rate/:projectId" element={<RatingRoute />} />
      </Route>

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
} 