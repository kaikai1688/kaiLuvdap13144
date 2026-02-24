import { useEffect, useMemo, useState } from "react";
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
    title: "Visual trait insights",
    subtitle: "Review 7-trait radar charts with year filters and confidence level.",
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
          <img key={item.title} src={item.image} alt={item.title} className={`tf-preview-image ${slide === idx ? "is-active" : ""}`} referrerPolicy="no-referrer" />
        ))}
      </div>
      <div className="tf-preview-caption">
        <h3>{PREVIEW_SLIDES[slide].title}</h3>
        <p>{PREVIEW_SLIDES[slide].subtitle}</p>
      </div>
      <div className="tf-preview-dots" aria-hidden="true">
        {PREVIEW_SLIDES.map((_, idx) => <span key={idx} className={slide === idx ? "is-active" : ""} />)}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("home");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setMsg("");
      if (!nextUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const ref = doc(db, "users", nextUser.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          displayName: nextUser.displayName ?? "",
          email: nextUser.email ?? "",
          photoURL: nextUser.photoURL ?? "",
          createdAt: serverTimestamp(),
          projectsCompleted: 0,
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
            university: "",
            course: "",
            yearOfStudy: "Year 1",
            studentIdStatus: "Not submitted",
          },
          // cleanup deprecated fields
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
    if (!user) return;
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

  function openProfile() {
    setPage("profile");
    setMsg("");
  }

  function openProjects() {
    if (!userData?.assessmentCompleted || !profileReady) {
      setMsg("Please complete profile details and working style assessment first.");
      return;
    }
    setMsg("");
    setPage("projects");
  }

  if (!user) {
    return (
      <div className="tf-bg">
        <div className="tf-auth-wrap tf-auth-wrap-xl">
          <div className="tf-card tf-auth-card">
            <div className="tf-logo">🤝</div>
            <h1 className="tf-h1">Build Full-Stack Web & Mobile Apps in minutes</h1>
            <p className="tf-muted">Continue with Google to start TeamFit matching.</p>
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
      <div className="tf-bg"><div className="tf-container"><div className="tf-card tf-loading"><div className="tf-spinner" /><div>Loading...</div></div></div></div>
    );
  }

  return (
    <div className="tf-bg">
      <div className="tf-container tf-container-wide">
        <header className="tf-topbar tf-card tf-topbar-nav">
          <div className="tf-brand"><div className="tf-logo">T</div><strong>TeamFit</strong></div>
          <nav className="tf-nav-links">
            <button className={`tf-nav-btn ${page === "home" ? "is-active" : ""}`} onClick={() => setPage("home")}>Home</button>
            <button className={`tf-nav-btn ${page === "projects" ? "is-active" : ""}`} onClick={openProjects}>Projects</button>
            <button className={`tf-nav-btn ${page === "messages" ? "is-active" : ""}`} onClick={() => setPage("messages")}>Messages</button>
            <button className={`tf-nav-btn ${page === "profile" ? "is-active" : ""}`} onClick={openProfile}>Profile</button>
          </nav>
          <div className="tf-actions">
            <img className="tf-avatar" src={user.photoURL || "https://www.gravatar.com/avatar/?d=mp"} alt="avatar" referrerPolicy="no-referrer" />
            <button className="tf-btn tf-btn-ghost" onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        {msg && <div className="tf-card tf-panel"><p style={{ margin: 0 }}>{msg}</p></div>}

        <main className="tf-main-page">
          {page === "home" && <HomePage onGoProjects={openProjects} onGoProfile={openProfile} />}
          {page === "projects" && <ProjectsPage user={user} />}
          {page === "messages" && <MessagesPage user={user} />}
          {page === "profile" && <ProfilePage user={user} onGoAssessment={() => setPage("assessment")} />}
          {page === "assessment" && <AssessmentPage user={user} onDone={() => setPage("profile")} />}
        </main>
      </div>
    </div>
  );
}
