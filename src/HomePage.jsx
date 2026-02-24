export default function HomePage({ onGoProjects, onGoProfile }) {
  return (
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
