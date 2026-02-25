import { useEffect, useMemo, useState } from "react";
import { auth, googleProvider, db } from "./firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { deleteField, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import AssessmentPage from "./AssessmentPage";
import HomePage from "./HomePage";
import MessagesPage from "./MessagesPage";
import ProfilePage from "./ProfilePage";
import ProjectsPage from "./ProjectsPage";
import ProfilePage from "./ProfilePage";
import "./AppShell.css";

const PREVIEW_SLIDES = [
  {
    title: "Built for student teams",
    subtitle: "Create projects and get matched by assignment, year and workstyle.",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
    image:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
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

  useEffect(() => {
    const id = setInterval(() => {
      setSlide((prev) => (prev + 1) % PREVIEW_SLIDES.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="tf-preview-card">
      <div className="tf-preview-image-wrap">
        {PREVIEW_SLIDES.map((item, index) => (
          <img
            key={item.title}
            src={item.image}
            alt={item.title}
            className={`tf-preview-image ${slide === index ? "is-active" : ""}`}
            referrerPolicy="no-referrer"
          />
        ))}
      </div>

      <div className="tf-preview-caption">
        <h3>{PREVIEW_SLIDES[slide].title}</h3>
        <p>{PREVIEW_SLIDES[slide].subtitle}</p>
      </div>

      <div className="tf-preview-dots" aria-hidden="true">
        {PREVIEW_SLIDES.map((_, index) => (
          <span key={index} className={slide === index ? "is-active" : ""} />
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
          <div className="tf-logo">🤝</div>
          <h1 className="tf-h1">Build Full-Stack Web & Mobile Apps in minutes</h1>
          <p className="tf-muted">Continue with Google to start TeamFit matching.</p>

          <button className="tf-btn tf-btn-primary tf-btn-lg" onClick={onLogin}>
            <span className="tf-google-dot" aria-hidden="true" />
            Continue with Google
          </button>

          <p className="tf-footnote">
            By continuing, you agree to TeamFit Terms and Privacy Policy.
          </p>
        </div>

        <LoginPreview />
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

function LoggedInView(props) {
  const {
    user,
    userData,
    currentPage,
    setCurrentPage,
    gateMsg,
    goProfile,
    messages,
    onLogout,
    onAssessmentDone,
  } = props;

  return (
    <div className="tf-bg">
      <div className="tf-container tf-container-wide">
        <header className="tf-topbar tf-card tf-topbar-nav">
          <div className="tf-brand">
            <div className="tf-logo">T</div>
            <strong>TeamFit</strong>
          </div>

          <nav className="tf-nav-links">
            <button
              className={`tf-nav-btn ${currentPage === "home" ? "is-active" : ""}`}
              onClick={() => setCurrentPage("home")}
            >
              Home
            </button>
            <button
              className={`tf-nav-btn ${currentPage === "projects" ? "is-active" : ""}`}
              onClick={() => setCurrentPage("projects")}
            >
              Projects
            </button>
            <button
              className={`tf-nav-btn ${currentPage === "messages" ? "is-active" : ""}`}
              onClick={() => setCurrentPage("messages")}
            >
              Messages
            </button>
            <button
              className={`tf-nav-btn ${currentPage === "profile" ? "is-active" : ""}`}
              onClick={goProfile}
            >
              Profile
            </button>
          </nav>

          <div className="tf-actions">
            <img
              className="tf-avatar"
              src={user.photoURL || "https://www.gravatar.com/avatar/?d=mp"}
              alt="User avatar"
              referrerPolicy="no-referrer"
            />
            <button className="tf-btn tf-btn-ghost" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </header>

        {gateMsg && (
          <div className="tf-card tf-panel" style={{ marginTop: 12 }}>
            <p style={{ margin: 0 }}>{gateMsg}</p>
          </div>
        )}

        <main className="tf-main-page">
          {currentPage === "home" && (
            <HomePage
              onGoProjects={() => setCurrentPage("projects")}
              onGoProfile={goProfile}
            />
          )}
          {currentPage === "projects" && <ProjectsPage user={user} />}
          {currentPage === "messages" && <MessagesPage messages={messages} />}
          {currentPage === "profile" && <ProfilePage user={user} />}
        </main>

        {!userData?.assessmentCompleted && (
          <section className="tf-card tf-panel" style={{ marginTop: 16 }}>
            <h3 className="tf-section-title">Complete Assessment First</h3>
            <AssessmentPage user={user} onDone={onAssessmentDone} />
          </section>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [currentPage, setCurrentPage] = useState("home");
  const [userData, setUserData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [gateMsg, setGateMsg] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setMsg("");
      if (!nextUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setGateMsg("");

      if (!nextUser) {
        setLoadingProfile(false);
        return;
      }

      setLoadingProfile(true);

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
            usernameLower: "",
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
          profile: {
            name: nextUser.displayName ?? "",
            university: "",
            faculty: "",
            yearOfStudy: "Y1",
            confidenceLevel: 70,
          },
        });
      }

      setCurrentPage("home");
      setLoadingProfile(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => setUserData(snap.exists() ? snap.data() : null));
    if (!user) return undefined;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      setUserData(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const q = query(collection(db, "messages"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setMessages([
          {
            id: "r1",
            type: "received",
            title: "Team invite",
            body: "You were invited to join DataViz FYP team.",
          },
          {
            id: "s1",
            type: "sent",
            title: "Application sent",
            body: "You applied to Web Security group.",
          },
        ]);
        return;
      }

      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  const profileReady = useMemo(() => {
    const p = userData?.profile;
    return Boolean(p?.fullName && p?.username && p?.university && p?.course && p?.yearOfStudy);
  }, [userData]);

    const profile = userData?.profile;
    return Boolean(profile?.name && profile?.university && profile?.faculty);
  }, [userData]);

  function goProfile() {
    if (!userData?.assessmentCompleted) {
      setGateMsg("Please complete the assessment first before entering Profile.");
      setCurrentPage("home");
      return;
    }

    if (!profileReady) {
      setGateMsg("Please complete your bio info (name, university, faculty) first.");
      setCurrentPage("home");
      return;
    }

    setGateMsg("");
    setCurrentPage("profile");
  }

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

  function handleAssessmentDone() {
    setGateMsg("Assessment completed. Please fill in bio info, then open Profile.");
  }

  if (!user) {
    return <LoggedOutView onLogin={handleLogin} />;
  // Not logged in -> nice login page
  if (!user) {
    return (
      <div className="tf-bg">
        <div className="tf-auth-wrap tf-auth-wrap-xl">
          <div className="tf-card tf-auth-card">
            <div className="tf-logo">🤝</div>
            <h1 className="tf-h1">Build Full-Stack Web & Mobile Apps in minutes</h1>
            <p className="tf-muted">Continue with Google to start TeamFit matching.</p>
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
                <span className="tf-badge">Conflict Handling</span>
                <span className="tf-badge">Awareness</span>
                <span className="tf-badge">Supportiveness</span>
                <span className="tf-badge">Adaptability</span>
                <span className="tf-badge">Alignment</span>
                <span className="tf-badge">Trustworthiness</span>
              </div>
            </div>
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
  if (loadingProfile) {
    return <LoadingState />;
  }

  return (
    <LoggedInView
      user={user}
      userData={userData}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
      gateMsg={gateMsg}
      goProfile={goProfile}
      messages={messages}
      onLogout={handleLogout}
      onAssessmentDone={handleAssessmentDone}
    />
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
