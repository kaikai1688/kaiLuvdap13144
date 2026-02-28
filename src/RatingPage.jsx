// src/RatingPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "./firebase";
import { runAdminAggregationForProject } from "./adminCompute";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";


const TRAITS = [
  ["communication", "Communication"],
  ["conflictHandling", "Conflict Handling"],
  ["awareness", "Awareness"],
  ["supportiveness", "Supportiveness"],
  ["adaptability", "Adaptability"],
  ["alignment", "Alignment"],
  ["trustworthiness", "Trustworthiness"],
];

function computeTermFromDueDate(dueDateStr) {
  if (!dueDateStr) return "medium";
  const due = new Date(dueDateStr + "T00:00:00");
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return "short";
  if (diffDays <= 30) return "medium";
  return "long";
}

function StarRating({ value = 0, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`Rate ${n} star`}
            title={`${n} / 5`}
            style={{
              border: "1px solid rgba(0,0,0,.10)",
              background: "#fff",
              borderRadius: 999,
              width: 38,
              height: 38,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontSize: 18,
              lineHeight: 1,
              color: active ? "#f4b400" : "#b9bfd1",
              boxShadow: active ? "0 6px 14px rgba(244,180,0,.18)" : "none",
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export default function RatingPage({ user }) {
  const { projectId } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [ratings, setRatings] = useState({});

  const myUid = user?.uid;

  const targets = useMemo(() => members.filter((m) => m.uid !== myUid), [members, myUid]);

  const canRate = useMemo(() => {
    if (!project) return false;
    return (project.status || "current") === "completed";
  }, [project]);

  useEffect(() => {
    if (!user || !projectId) return;

    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setStatus("");

        // 1) Load project
        const projSnap = await getDoc(doc(db, "projects", projectId));
        if (!projSnap.exists()) {
          if (!cancelled) {
            setProject(null);
            setMembers([]);
            setRatings({});
            setStatus("Project not found.");
          }
          return;
        }

        const proj = { id: projSnap.id, ...projSnap.data() };
        if (cancelled) return;

        setProject(proj);

        const memberUids = Array.isArray(proj.memberUids) ? proj.memberUids : [];
        if (!memberUids.includes(user.uid)) {
          setMembers([]);
          setRatings({});
          setStatus("You are not a member of this project.");
          return;
        }

        // 2) Load members profile
        const people = [];
        for (const uid of memberUids) {
          const uSnap = await getDoc(doc(db, "users", uid));
          if (!uSnap.exists()) continue;
          const data = uSnap.data();
          people.push({
            uid,
            fullName: data?.profile?.fullName || data?.displayName || "User",
            username: data?.profile?.username || "",
          });
        }
        if (cancelled) return;
        setMembers(people);

        // 3) Block rating if not ended
        if ((proj.status || "current") !== "completed") {
          setRatings({});
          setStatus(
            "This project has NOT ended yet. Rating is only available after the owner clicks End Project."
          );
          return;
        }

        // 4) Ensure rating session exists (only after completed)
// 4) Ensure rating session exists (only after completed)
// IMPORTANT: do NOT force status back to "open" if it's already closed/expired.
const term = computeTermFromDueDate(proj.dueDate);
const ratingRef = doc(db, "projectRatings", projectId);
const ratingSnap = await getDoc(ratingRef);

if (!ratingSnap.exists()) {
  // Create only if missing
  await setDoc(
    ratingRef,
    {
      projectId,
      projectType: proj.projectType || "",
      term,
      memberUids,
      status: "open",
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
} else {
  // If exists, only update metadata — never reopen
  await setDoc(
    ratingRef,
    {
      projectType: proj.projectType || "",
      term,
      memberUids,
    },
    { merge: true }
  );
}


const rsnap = await getDoc(doc(db, "projectRatings", projectId));
if (rsnap.exists()) {
  const rdata = rsnap.data();
  const rstatus = String(rdata.status || "open");

  if (rstatus === "expired") {
    setStatus("Rating session expired. You can no longer submit ratings for this project.");
    setRatings({});
    return;
  }

  if (rstatus === "closed") {
    // Optional: allow viewing, but no edits
    setStatus("Rating session closed. Ratings are locked.");
    // You can still load previous submission if you want, but disable submit later.
  }
}
        // 5) Load my existing submission (if any)
        const subRef = doc(db, "projectRatings", projectId, "submissions", user.uid);
        const subSnap = await getDoc(subRef);

        if (cancelled) return;

        if (subSnap.exists()) {
          const saved = subSnap.data()?.targets || {};
          setRatings(saved);
          setStatus("Loaded your previous rating (you can update it).");
        } else {
          const init = {};
          for (const p of people) {
            if (p.uid === user.uid) continue;
            init[p.uid] = {};
            for (const [k] of TRAITS) init[p.uid][k] = 0;
          }
          setRatings(init);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus(e?.message || "Failed to load rating page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user, projectId]);

  function setOne(targetUid, traitKey, val) {
    setRatings((prev) => ({
      ...prev,
      [targetUid]: { ...(prev[targetUid] || {}), [traitKey]: val },
    }));
  }

  function validateAllFilled() {
    for (const t of targets) {
      for (const [key] of TRAITS) {
        const v = Number(ratings?.[t.uid]?.[key] || 0);
        if (v < 1 || v > 5) return false;
      }
    }
    return true;
  }

  async function submit() {
    console.log("SUBMIT clicked", { projectId, uid: user.uid });
    if (!user || !projectId) return;
    if (!project) return;

    // Hard block
    if ((project.status || "current") !== "completed") {
      setStatus("Project not ended yet. You cannot submit ratings now.");
      return;
    }

    const ratingSnap = await getDoc(doc(db, "projectRatings", projectId));
if (ratingSnap.exists()) {
  const rstatus = String(ratingSnap.data().status || "open");
  if (rstatus === "expired") {
    setStatus("Rating session expired. Submission not allowed.");
    return;
  }
  if (rstatus === "closed") {
    setStatus("Rating session closed. Submission not allowed.");
    return;
  }
}

    if (!project.memberUids?.includes(user.uid)) {
      setStatus("You are not a member of this project.");
      return;
    }

    if (targets.length === 0) {
      setStatus("No teammates to rate.");
      return;
    }

    if (!validateAllFilled()) {
      setStatus("Please rate ALL traits (1–5 stars) for every teammate.");
      return;
    }

    const ok = window.confirm("Confirm submit your ratings? You can edit later if needed.");
    if (!ok) return;

    try {
      setSaving(true);
      setStatus("Submitting...");

      const subRef = doc(db, "projectRatings", projectId, "submissions", user.uid);

      // 1) Save submission
      await setDoc(
        subRef,
        {
          raterUid: user.uid,
          targets: ratings,
          submittedAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log("SUBMIT saved to Firestore", subRef.path);

      // 2) Run admin aggregation (admin only). Non-admin will be skipped inside.
      // 2) Check quorum before running aggregation
try {
  const ratingRef = doc(db, "projectRatings", projectId);
  const ratingSnap = await getDoc(ratingRef);

  if (!ratingSnap.exists()) {
    setStatus("Ratings saved ✅ (No rating session doc found.)");
    return;
  }

  const ratingData = ratingSnap.data();
  const minSubmissions = Number(ratingData.minSubmissions || 0);
  const alreadyRan = Boolean(ratingData.aggregationRan);
  const statusNow = String(ratingData.status || "open");

  // If already closed/expired or aggregation already ran, stop here
  if (alreadyRan || statusNow !== "open") {
    setStatus("Ratings saved ✅ (Session already processed.)");
    return;
  }

  // Count current submissions
  const subsSnap = await getDocs(collection(db, "projectRatings", projectId, "submissions"));
  const submissionsCount = subsSnap.size;

  if (minSubmissions > 0 && submissionsCount < minSubmissions) {
    setStatus(
      `Ratings saved ✅ Waiting for more submissions (${submissionsCount}/${minSubmissions}).`
    );
    return;
  }

  // 3) Quorum reached → run aggregation ONCE (admin-only inside)
  setStatus("Quorum reached ✅ Running aggregation (admin only)...");

  const res = await runAdminAggregationForProject({
    projectId,
    currentUid: user.uid,
  });

  if (res?.ok) {
    // mark session processed
    await updateDoc(ratingRef, {
      aggregationRan: true,
      aggregatedAt: serverTimestamp(),
      aggregatedByUid: user.uid,
      status: "closed",
      closedAt: serverTimestamp(),
    });

    setStatus("Ratings saved ✅ Aggregation done ✅ Session closed ✅");
  } else {
    // not admin → keep open, don’t mark closed
    setStatus(
      "Ratings saved ✅ Quorum reached, but aggregation skipped (not admin). Ask admin to submit/trigger aggregation."
    );
  }

  return;
} catch (aggErr) {
  console.error(aggErr);
  setStatus("Ratings saved ✅ (Aggregation check failed, but rating saved.)");
  return;
}

      // 3) Redirect back to Projects with toast
     setStatus("Saved ✅ Please check Firestore: projectRatings > thisProject > submissions > yourUid");
return;
    } catch (e) {
      console.error(e);
      setStatus(e?.message || "Submit failed. Check rules/permissions.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="tf-card tf-panel">
      <h2 className="tf-h2">Rate Teammates</h2>

      {project && (
        <p className="tf-muted">
          Project: <b>{project.name || "Untitled"}</b> · Type:{" "}
          <b>{project.projectType || "-"}</b> · Status: <b>{project.status || "current"}</b>
        </p>
      )}

      {loading ? (
        <p className="tf-muted">Loading...</p>
      ) : !project ? (
        <p className="tf-muted">Project not found.</p>
      ) : !canRate ? (
        <>
          <p className="tf-muted" style={{ marginTop: 10 }}>
            This project has NOT ended yet. Rating is locked until the owner clicks <b>End Project</b>.
          </p>
          {status && (
            <p className="tf-muted" style={{ marginTop: 10 }}>
              {status}
            </p>
          )}
          <div className="tf-inline-actions" style={{ marginTop: 14 }}>
            <button className="tf-btn" onClick={() => nav("/projects")}>
              Back to Projects
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="tf-muted">Please rate each teammate using 1–5 stars for all 7 traits.</p>

          <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
            {targets.map((t) => (
              <div key={t.uid} className="tf-card" style={{ padding: 14 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{t.fullName}</div>
                  <div className="tf-muted tf-small">@{t.username || "no-username"}</div>
                </div>

                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  {TRAITS.map(([key, label]) => (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{label}</div>
                      <StarRating
                        value={Number(ratings?.[t.uid]?.[key] || 0)}
                        onChange={(v) => setOne(t.uid, key, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="tf-inline-actions" style={{ marginTop: 14 }}>
            <button className="tf-btn tf-btn-primary" onClick={submit} disabled={saving}>
              {saving ? "Submitting..." : "Submit Ratings"}
            </button>

            <button className="tf-btn" onClick={() => nav("/projects")} disabled={saving}>
              Back to Projects
            </button>
          </div>

          {status && (
            <p className="tf-muted" style={{ marginTop: 10 }}>
              {status}
            </p>
          )}
        </>
      )}
    </div>
  );
}