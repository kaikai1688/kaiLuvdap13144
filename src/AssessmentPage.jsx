import { useState } from "react";
import { db } from "./firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

const QUESTIONS = [
  ["communication", "I communicate clearly with teammates during tasks."],
  ["conflictHandling", "I handle disagreements calmly and constructively."],
  ["awareness", "I stay aware of team progress and blockers."],
  ["supportiveness", "I support teammates when they need help."],
  ["adaptability", "I adapt quickly when project plans change."],
  ["alignment", "I align my work with shared goals and timelines."],
  ["trustworthiness", "I am reliable with commitments and deadlines."],
];

export default function AssessmentPage({ user, onDone, locked = false }) {
  const [traits, setTraits] = useState({
    communication: 3,
    conflictHandling: 3,
    awareness: 3,
    supportiveness: 3,
    adaptability: 3,
    alignment: 3,
    trustworthiness: 3,
  });

  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveAssessment() {
  if (!user) return;
  if (saving) return;
  if (locked) {
    setStatus("Assessment is locked after peer ratings begin.");
    return;
  }

    try {
      setSaving(true);
      setStatus("Saving assessment...");

      await setDoc(
        doc(db, "users", user.uid),
        {
          traits,
          assessmentCompleted: true,
          traitsUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setStatus("Assessment saved ✅");
      onDone?.();
    } catch (e) {
      console.error(e);
      setStatus(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tf-card tf-panel" style={{ position: "relative", zIndex: 20, pointerEvents: "auto" }}>
      <h2 className="tf-h2">Working Style Assessment</h2>
      <p className="tf-muted">Likert scale: 1 (lowest) to 5 (highest).</p>

      <div style={{ display: "grid", gap: 14 }}>
        {QUESTIONS.map(([key, q]) => (
          <div key={key} className="tf-likert-row">
            <div className="tf-likert-question">{q}</div>

            <div className="tf-likert-options" style={{ pointerEvents: "auto" }}>
              {[1, 2, 3, 4, 5].map((score) => {
                const active = traits[key] === score;
                return (
                  <button
                    key={score}
                    type="button"
                    className={`tf-likert-dot ${active ? "is-active" : ""}`}
                    onClick={() => setTraits((prev) => ({ ...prev, [key]: score }))}
                    aria-label={`${key} score ${score}`}
                    style={{ pointerEvents: "auto", position: "relative", zIndex: 30 }}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="tf-btn tf-btn-primary"
        onClick={saveAssessment}
        disabled={saving}
        style={{ marginTop: 14, pointerEvents: "auto", position: "relative", zIndex: 30 }}
      >
        {saving ? "Saving..." : "Submit Assessment"}
      </button>

      {status && <p className="tf-muted" style={{ marginTop: 10 }}>{status}</p>}
    </div>
  );
}