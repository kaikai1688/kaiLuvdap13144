import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

const TRAITS = [
  "communication",
  "conflictHandling",
  "awareness",
  "supportiveness",
  "adaptability",
  "alignment",
  "trustworthiness",
];

const YEARS = ["Y1", "Y2", "Y3", "Y4"];

function RadarChart({ values }) {
  const size = 280;
  const center = size / 2;
  const radius = 96;

  const points = TRAITS.map((trait, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
    const value = values[trait] ?? 0;
    const valueRadius = (Math.max(0, Math.min(5, value)) / 5) * radius;
    return {
      trait,
      x: center + Math.cos(angle) * valueRadius,
      y: center + Math.sin(angle) * valueRadius,
      labelX: center + Math.cos(angle) * (radius + 24),
      labelY: center + Math.sin(angle) * (radius + 24),
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg className="tf-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="7-trait radar chart">
      {[1, 2, 3, 4, 5].map((level) => {
        const r = (level / 5) * radius;
        const ringPoints = TRAITS.map((_, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
          return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
        }).join(" ");
        return <polygon key={level} points={ringPoints} className="tf-radar-ring" />;
      })}

      {TRAITS.map((_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + Math.cos(angle) * radius}
            y2={center + Math.sin(angle) * radius}
            className="tf-radar-axis"
          />
        );
      })}

      <polygon points={polygonPoints} className="tf-radar-shape" />

      {points.map((point) => (
        <g key={point.trait}>
          <circle cx={point.x} cy={point.y} r="4" className="tf-radar-dot" />
          <text x={point.labelX} y={point.labelY} className="tf-radar-label" textAnchor="middle">
            {point.trait}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function ProfilePage({ user }) {
  const [profile, setProfile] = useState({
    name: "",
    university: "",
    faculty: "",
    yearOfStudy: "Y1",
    confidenceLevel: 70,
  });
  const [selectedYear, setSelectedYear] = useState("Y1");
  const [traits, setTraits] = useState(Object.fromEntries(TRAITS.map((k) => [k, 0])));
  const [status, setStatus] = useState("");
  const [scanStatus, setScanStatus] = useState("Not verified");

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setProfile((prev) => ({
          ...prev,
          name: data.profile?.name || user.displayName || "",
          university: data.profile?.university || "",
          faculty: data.profile?.faculty || "",
          yearOfStudy: data.profile?.yearOfStudy || "Y1",
          confidenceLevel: data.profile?.confidenceLevel ?? 70,
        }));
        setSelectedYear(data.profile?.yearOfStudy || "Y1");
      }
    }

    loadProfile();
  }, [user]);

  useEffect(() => {
    async function loadTraitsFromDatabase() {
      if (!user) return;

      const ratingsQuery = query(
        collection(db, "traitRatings"),
        where("uid", "==", user.uid),
        where("yearOfStudy", "==", selectedYear)
      );
      const ratingsSnap = await getDocs(ratingsQuery);

      if (!ratingsSnap.empty) {
        const aggregated = Object.fromEntries(TRAITS.map((t) => [t, 0]));
        ratingsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          TRAITS.forEach((trait) => {
            aggregated[trait] += Number(data[trait] ?? 0);
          });
        });
        const count = ratingsSnap.size;
        TRAITS.forEach((trait) => {
          aggregated[trait] = Number((aggregated[trait] / count).toFixed(2));
        });
        setTraits(aggregated);
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const userTraits = userSnap.data().traits || {};
        setTraits(Object.fromEntries(TRAITS.map((trait) => [trait, Number(userTraits[trait] ?? 0)])));
      }
    }

    loadTraitsFromDatabase();
  }, [selectedYear, user]);

  const overallScore = useMemo(() => {
    const sum = TRAITS.reduce((acc, key) => acc + Number(traits[key] || 0), 0);
    return (sum / TRAITS.length).toFixed(2);
  }, [traits]);

  async function saveProfile() {
    if (!user) return;
    setStatus("Saving profile...");

    const userRef = doc(db, "users", user.uid);
    await setDoc(
      userRef,
      {
        profile,
      },
      { merge: true }
    );

    setStatus("Profile saved ✅");
  }

  async function runGeminiIdVerification() {
    if (!user) return;

    setScanStatus("Gemini scan in progress...");
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const result = {
      verified: true,
      similarity: 0.91,
      checkedAt: new Date().toISOString(),
      note: "Prototype mode: connect this action to Gemini Vision API + camera feed for real verification.",
    };

    await updateDoc(doc(db, "users", user.uid), {
      idVerification: result,
    });

    setScanStatus(`Verified (${Math.round(result.similarity * 100)}% match)`);
  }

  return (
    <div className="tf-profile-grid">
      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">Student Profile</h3>

        <label className="tf-field">
          <span>Name</span>
          <input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
        </label>

        <label className="tf-field">
          <span>University</span>
          <input value={profile.university} onChange={(e) => setProfile((p) => ({ ...p, university: e.target.value }))} />
        </label>

        <label className="tf-field">
          <span>Faculty</span>
          <input value={profile.faculty} onChange={(e) => setProfile((p) => ({ ...p, faculty: e.target.value }))} />
        </label>

        <div>
          <div className="tf-field-label">Year of study filter</div>
          <div className="tf-year-row">
            {YEARS.map((year) => (
              <button
                key={year}
                type="button"
                className={`tf-btn ${selectedYear === year ? "tf-year-active" : ""}`}
                onClick={() => {
                  setSelectedYear(year);
                  setProfile((p) => ({ ...p, yearOfStudy: year }));
                }}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <label className="tf-field">
          <span>Confidence level: {profile.confidenceLevel}%</span>
          <input
            type="range"
            min="0"
            max="100"
            value={profile.confidenceLevel}
            onChange={(e) => setProfile((p) => ({ ...p, confidenceLevel: Number(e.target.value) }))}
          />
        </label>

        <button className="tf-btn tf-btn-primary" onClick={saveProfile}>Save profile</button>
        {status && <p className="tf-muted">{status}</p>}
      </section>

      <section className="tf-card tf-panel">
        <h3 className="tf-section-title">7-trait Radar Chart</h3>
        <p className="tf-muted tf-small">Data source: traitRatings collection filtered by {selectedYear}. Falls back to users.traits if no rating is found.</p>
        <RadarChart values={traits} />
        <div className="tf-muted">Average trait score: <b>{overallScore}</b> / 5</div>
      </section>

      <section className="tf-card tf-panel tf-panel-wide">
        <h3 className="tf-section-title">Verify Student ID (Gemini AI)</h3>
        <p className="tf-muted tf-small">
          Gemini should compare the live face from camera with the face on the student ID the user is holding.
          This section stores scan result metadata and provides a prototype trigger.
        </p>
        <button className="tf-btn" onClick={runGeminiIdVerification}>Start Gemini ID Scan</button>
        <p>{scanStatus}</p>
      </section>
    </div>
  );
}
