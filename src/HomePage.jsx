const PROJECT_TYPES = [
  {
    title: "Final Year Project",
    desc: "Find dedicated partners for your capstone thesis or FYP.",
  },
  {
    title: "School Assignment",
    desc: "Team up for group assignments and coursework.",
  },
  {
    title: "Lab Report",
    desc: "Collaborate on laboratory experiments and reports.",
  },
  {
    title: "Case Study & Presentation",
    desc: "Build compelling presentations and case analyses together.",
  },
  {
    title: "Community Service",
    desc: "Join forces for meaningful community impact projects.",
  },
  {
    title: "Studio / Creative",
    desc: "Collaborate on art, design, film, and creative works.",
  },
];

const STEPS = [
  {
    title: "Set Up Your Profile",
    desc: "Tell us your skills, workstyle, and project interests.",
  },
  {
    title: "Complete Assessment",
    desc: "Answer the workstyle questions to generate your 7-trait profile.",
  },
  {
    title: "Create or Join Project",
    desc: "Enter project details and let TeamFit suggest compatible teammates.",
  },
  {
    title: "Connect & Collaborate",
    desc: "Message your teammates and coordinate tasks until project completion.",
  },
];

export default function HomePage({ onGoProjects, onGoProfile }) {
  return (
    <div className="tf-home-layout">
      <section className="tf-hero-card">
        <div>
          <div className="tf-hero-badge">✨ Smart teammate matching for students</div>
          <h1 className="tf-hero-title">
            Find your <span>perfect team</span>
          </h1>
          <p className="tf-hero-sub">
            Match with teammates who complement your workstyle. From FYP to creative projects — build your dream team effortlessly.
          </p>
          <div className="tf-home-actions">
            <button className="tf-btn tf-btn-primary tf-btn-lg" onClick={onGoProjects}>
              Find Teammates
            </button>
            <button className="tf-btn tf-btn-light tf-btn-lg" onClick={onGoProfile}>
              Create Profile
            </button>
          </div>
        </div>

        <div className="tf-hero-image-wrap">
          <img
            src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80"
            alt="Students collaborating"
            className="tf-hero-image"
            referrerPolicy="no-referrer"
          />
        </div>
      </section>

      <section className="tf-section-block">
        <div className="tf-section-kicker">PROJECT TYPES</div>
        <h2 className="tf-section-title-main">Every project needs the right team</h2>
        <div className="tf-type-grid">
          {PROJECT_TYPES.map((item) => (
            <article key={item.title} className="tf-type-card">
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tf-section-block">
        <div className="tf-section-kicker">ASSESSMENT BACKGROUND</div>
        <h2 className="tf-section-title-main">The essentials, done right</h2>
        <div className="tf-bg-grid">
          <div className="tf-bg-card">
            <h3>McKinsey 7S</h3>
            <p>Focuses on strategy, structure, systems and alignment inside teams.</p>
          </div>
          <div className="tf-bg-card">
            <h3>Big Five</h3>
            <p>Personality dimensions support stable teamwork behavior prediction.</p>
          </div>
          <div className="tf-bg-card">
            <h3>Belbin + Google Dynamics</h3>
            <p>Combines role diversity and psychological safety for practical team fit.</p>
          </div>
        </div>
      </section>

      <section className="tf-section-block">
        <div className="tf-section-kicker">HOW IT WORKS</div>
        <h2 className="tf-section-title-main">Four Simple Steps to your ideal team</h2>
        <div className="tf-steps-grid">
          {STEPS.map((step, index) => (
            <div key={step.title} className="tf-step-card">
              <div className="tf-step-number">{String(index + 1).padStart(2, "0")}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="tf-cta-banner">
        <h3>Ready to find your dream team?</h3>
        <p>Create your profile now and start matching with teammates who complement your workstyle.</p>
        <button className="tf-btn tf-btn-light tf-btn-lg" onClick={onGoProfile}>
          Get Started
        </button>
      </section>
    </div>
  );
}
