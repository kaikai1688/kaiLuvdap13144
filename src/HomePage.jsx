export default function HomePage({ onGoProjects, onGoProfile }) {
  return (
    <div className="tf-card tf-panel">
      <h2 className="tf-h2">Welcome to TeamFit</h2>
      <p className="tf-muted">
        Prototype: complete your assessment + profile, then explore Projects and Messages.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button className="tf-btn tf-btn-primary" onClick={onGoProjects}>
          Go to Projects
        </button>
        <button className="tf-btn" onClick={onGoProfile}>
          Open Profile
        </button>
      </div>

      <div className="tf-home-foot tf-muted" style={{ marginTop: 14 }}>
        500+ students matched · Join the community
      </div>
    </div>
  );
}