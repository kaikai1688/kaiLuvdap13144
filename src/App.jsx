import { useEffect, useMemo, useRef, useState } from "react";
import { auth, googleProvider, db } from "./firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { deleteField, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import AssessmentPage from "./AssessmentPage";
import HomePage from "./HomePage";
import MessagesPage from "./MessagesPage";
import ProfilePage from "./ProfilePage";
import ProjectsPage from "./ProjectsPage";
import "./AppShell.css";

const PREVIEW_SLIDES = [
  {
    title: "Built for student teams",
    subtitle: "Create projects and get matched by assignment, year and workstyle.",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Research based insights",
    subtitle: "Research based: Review 7 traits radar charts and confidence level.",
    image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Student teamwork at scale",
    subtitle: "Move from profile to matching in a few guided steps.",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
  },
];

function LoginPreview() {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSlide((prev) => (prev + 1) % PREVIEW_SLIDES.length), 2600);
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

function UserMenu({ user, onProfile, onMessages, onSignOut }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="tf-user-menu" ref={rootRef}>
      <button className="tf-profile-chip" onClick={() => setOpen((v) => !v)}>
        {user.displayName?.[0] || "D"}
      </button>

      {open && (
        <div className="tf-menu-card">
          <div className="tf-menu-head">
            <div className="tf-menu-name">{user.displayName || "TeamFit User"}</div>
            <div className="tf-menu-mail">{user.email}</div>
          </div>
          <button className="tf-menu-item" onClick={() => { setOpen(false); onProfile(); }}>
            My Profile
          </button>
          <button className="tf-menu-item" onClick={() => { setOpen(false); onMessages(); }}>
            My Messages
          </button>
          <button className="tf-menu-item tf-danger" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("home");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setNotice("");

      if (!nextUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const userRef = doc(db, "users", nextUser.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await setDoc(userRef, {
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
          projects: {
            completedCount: 0,
          },
          idVerification: deleteField(),
          traitCounts: deleteField(),
        }, { merge: true });
      }

      setPage("home");
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => setUserData(snap.exists() ? snap.data() : null));
    return () => unsub();
  }, [user]);

  const profileReady = useMemo(() => {
    const p = userData?.profile;
    return Boolean(p?.fullName && p?.username && p?.university && p?.course && p?.yearOfStudy);
  }, [userData]);

  async function handleLogin() {
    await signInWithPopup(auth, googleProvider);
  }

  async function handleLogout() {
    await signOut(auth);
  }

  function openProjectsFromHome() {
    if (!profileReady || !userData?.assessmentCompleted) {
      setNotice("Please click Create Profile and complete profile + assessment first.");
      return;
    }
    setNotice("");
    setPage("projects");
  }

  function openProfile() {
    setNotice("");
    setPage("profile");
  }

  if (!user) {
    return (
      <div className="tf-bg tf-bg-auth">
        <div className="tf-auth-wrap tf-auth-wrap-xl">
          <div className="tf-card tf-auth-card tf-light-card">
            <div className="tf-auth-brand">TeamFit</div>
            <h1 className="tf-auth-title">Find Your Perfect Team</h1>
            <p className="tf-auth-subtitle">
              Match with teammates who complement your workstyle. From FYP to creative projects — build your dream team effortlessly.
            </p>

            <button className="tf-btn tf-btn-primary tf-btn-lg" onClick={handleLogin}>
              <span className="tf-google-dot" aria-hidden="true" />
              Continue with Google
            </button>
          </div>

          <LoginPreview />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="tf-bg tf-bg-app">
        <div className="tf-container">
          <div className="tf-card tf-loading"><div className="tf-spinner" />Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="tf-bg tf-bg-app">
      <div className="tf-container tf-container-wide">
        <header className="tf-topbar tf-topbar-light">
          <div className="tf-brand-row">
            <div className="tf-logo-icon">T</div>
            <div className="tf-brand-title">TeamUp</div>
          </div>

          <nav className="tf-nav-links tf-nav-light">
            <button className={`tf-nav-btn ${page === "home" ? "is-active" : ""}`} onClick={() => setPage("home")}>Home</button>
            <button className={`tf-nav-btn ${page === "projects" ? "is-active" : ""}`} onClick={openProjectsFromHome}>Projects</button>
            <button className={`tf-nav-btn ${page === "messages" ? "is-active" : ""}`} onClick={() => setPage("messages")}>Messages</button>
            <button className={`tf-nav-btn ${page === "profile" ? "is-active" : ""}`} onClick={openProfile}>Profile</button>
          </nav>

          <UserMenu
            user={user}
            onProfile={() => setPage("profile")}
            onMessages={() => setPage("messages")}
            onSignOut={handleLogout}
          />
        </header>

        {notice && <div className="tf-notice">{notice}</div>}

        <main className="tf-main-page">
          {page === "home" && <HomePage onGoProjects={openProjectsFromHome} onGoProfile={openProfile} />}
          {page === "projects" && <ProjectsPage user={user} userData={userData} />}
          {page === "messages" && <MessagesPage user={user} />}
          {page === "profile" && <ProfilePage user={user} onGoAssessment={() => setPage("assessment")} />}
          {page === "assessment" && <AssessmentPage user={user} onDone={() => setPage("profile")} />}
        </main>
      </div>
    </div>
  );
}
