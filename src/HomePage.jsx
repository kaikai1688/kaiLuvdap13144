export default function HomePage({ onGoProjects, onGoProfile }) {
  return (
    <div className="tf-home-wrap">
      <section className="tf-home-hero">
        <div className="tf-pill">✨ Smart teammate matching for students</div>
        <h1 className="tf-home-title">
          Find your <span>perfect team</span>
        </h1>
        <p className="tf-home-sub">
          Match with teammates who complement your workstyle. From FYP to creative projects — build your dream team effortlessly.
        </p>

        <div className="tf-home-actions">
          <button className="tf-btn tf-btn-primary tf-btn-lg" onClick={onGoProjects}>
            Create Project
          </button>
          <button className="tf-btn tf-btn-lg" onClick={onGoProfile}>
            View Profile
          </button>
        </div>
      </section>

      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">Project Type Explanation</h3>
        <p className="tf-muted tf-small">
          We support Final Year Project, School Assignment, Lab Report, Case Study & Presentation,
          Community Service, and Studio/Creative Project. Each type helps AI prioritize teammates with similar context.
        </p>
      </section>

      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">Workstyle Assessment Background</h3>
        <p className="tf-muted tf-small">
          Our 7-trait model is inspired by established collaboration and personality frameworks such as McKinsey 7S,
          Big Five personality dimensions, Belbin team roles, and Google team dynamics research.
        </p>
      </section>

      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">How It Works — Four Simple Steps to your ideal team</h3>
        <ol className="tf-steps">
          <li><b>Create your profile</b> — Fill in bio, course, and year details.</li>
          <li><b>Complete assessment</b> — Answer the 7-trait workstyle test.</li>
          <li><b>Create a project</b> — Choose project type and team size.</li>
          <li><b>Start matching</b> — Get teammates with similar assignment context and compatible traits.</li>
        </ol>
        <div className="tf-cta-block">
          <h4>Ready to find your dream team?</h4>
          <p className="tf-muted">Create your profile now and start matching with teammates who complement your workstyle.</p>
          <button className="tf-btn tf-btn-primary" onClick={onGoProfile}>Get Started</button>
        </div>
      </section>
    <div className="tf-home-hero">
      <div className="tf-pill">✨ Smart teammate matching for students</div>
      <h1 className="tf-home-title">
        Find your <span>perfect team</span>
      </h1>
      <p className="tf-home-sub">
        Match with teammates who complement your workstyle. From FYP to creative projects — build your dream team effortlessly.
      </p>

      <div className="tf-home-actions">
        <button className="tf-btn tf-btn-primary tf-btn-lg" onClick={onGoProjects}>
          Create Project
        </button>
        <button className="tf-btn tf-btn-lg" onClick={onGoProfile}>
          View Profile
        </button>
      </div>

      <div className="tf-home-foot tf-muted">500+ students matched · Join the community</div>
    </div>
  );
}
