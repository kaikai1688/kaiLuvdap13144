// src/AssessmentPage.jsx
import { useState } from "react";
import { db } from "./firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

export default function AssessmentPage({ user, onDone }) {
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

  async function saveAssessment() {
    if (!user) return;

    setStatus("Saving...");

    const ref = doc(db, "users", user.uid);
    await setDoc(
      ref,
      {
        traits,
        traitsUpdatedAt: serverTimestamp(),
        assessmentCompleted: true,
      },
      { merge: true }
    );

    setStatus("Saved ✅");

    // Move to next page (App.jsx will control this later)
    onDone?.();
  }

  const questions = [
    ["communication", "When I’m stuck, I ask a question instead of staying silent."],
    ["conflictHandling", "When there’s disagreement, I try to understand what others care about before responding."],
    ["awareness", "I keep track of progress and notice early if we’re falling behind."],
    ["supportiveness", "If a teammate is overloaded, I’m willing to help or back them up."],
    ["adaptability", "When plans change, I adjust quickly instead of resisting."],
    ["alignment", "Before starting work, I make sure everyone agrees on goals and roles."],
    ["trustworthiness", "If I commit to a task, I deliver it on time (or tell the team early if I can’t)."],
  ];

  return (
    <div style={{ maxWidth: 800 }}>
      <h2>Working Style Assessment (1–5)</h2>
      <p style={{ color: "#666" }}>
        1 = strongly disagree · 3 = neutral · 5 = strongly agree
      </p>

      {questions.map(([key, q]) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <label>
            {q}{" "}
            <input
              type="range"
              min="1"
              max="5"
              value={traits[key]}
              onChange={(e) =>
                setTraits((prev) => ({ ...prev, [key]: Number(e.target.value) }))
              }
            />{" "}
            <b>{traits[key]}</b>
          </label>
        </div>
      ))}

      <button onClick={saveAssessment}>Save & Continue</button>
      {status && <p style={{ marginTop: 10 }}>{status}</p>}
    </div>
  );
}