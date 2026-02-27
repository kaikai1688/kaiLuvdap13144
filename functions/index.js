const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const TRAITS = [
  "communication",
  "conflictHandling",
  "awareness",
  "supportiveness",
  "adaptability",
  "alignment",
  "trustworthiness",
];

// helper: average arrays
function mean(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function bucketKey(projectType, term) {
  return `${projectType || "Unknown"}__${term || "medium"}`;
}

function clampTrait(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(5, n));
}

/**
 * Trigger when a submission is created/updated.
 * When all members submitted, aggregate and close rating session.
 */
exports.onRatingSubmissionWrite = functions.firestore
  .document("projectRatings/{projectId}/submissions/{raterUid}")
  .onWrite(async (change, context) => {
    const { projectId } = context.params;

    // ignore deletes
    if (!change.after.exists) return null;

    const ratingRef = db.doc(`projectRatings/${projectId}`);
    const ratingSnap = await ratingRef.get();
    if (!ratingSnap.exists) return null;

    const rating = ratingSnap.data() || {};
    if ((rating.status || "open") !== "open") return null;

    const memberUids = Array.isArray(rating.memberUids) ? rating.memberUids : [];
    if (memberUids.length === 0) return null;

    // check if all members submitted
    const subsSnap = await ratingRef.collection("submissions").get();
    const submittedUids = new Set(subsSnap.docs.map((d) => d.id));
    const allSubmitted = memberUids.every((uid) => submittedUids.has(uid));

    if (!allSubmitted) {
      // not done yet
      return null;
    }

    // Prevent double-processing (race condition)
    // Mark "closing" with transaction
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(ratingRef);
      if (!fresh.exists) return;
      const freshData = fresh.data() || {};
      if ((freshData.status || "open") !== "open") return;

      tx.update(ratingRef, {
        status: "closed",
        closedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // Re-fetch after closing to proceed safely
    const subsSnap2 = await ratingRef.collection("submissions").get();
    const submissions = subsSnap2.docs.map((d) => ({ raterUid: d.id, ...d.data() }));

    // Aggregate: for each target uid, collect scores from raters
    // targetTraitScores[targetUid][trait] = [scores...]
    const targetTraitScores = {};
    let numRaters = 0;

    for (const sub of submissions) {
      const targets = sub.targets || {};
      numRaters += 1;

      for (const targetUid of Object.keys(targets)) {
        if (!memberUids.includes(targetUid)) continue; // safety
        if (!targetTraitScores[targetUid]) targetTraitScores[targetUid] = {};
        for (const trait of TRAITS) {
          const v = clampTrait(targets?.[targetUid]?.[trait]);
          if (!targetTraitScores[targetUid][trait]) targetTraitScores[targetUid][trait] = [];
          targetTraitScores[targetUid][trait].push(v);
        }
      }
    }

    // For each user in project, compute avgByTrait from scores received
    // and write into users/{uid}/traitHistory/{projectId}
    const batch = db.batch();

    for (const uid of memberUids) {
      const byTrait = {};
      for (const trait of TRAITS) {
        const arr = targetTraitScores?.[uid]?.[trait] || [];
        byTrait[trait] = Number(mean(arr).toFixed(2)); // store 2dp
      }

      const histRef = db.doc(`users/${uid}/traitHistory/${projectId}`);
      batch.set(
        histRef,
        {
          projectId,
          projectType: rating.projectType || "",
          term: rating.term || "medium",
          avgByTrait: byTrait,
          numRaters,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();

    // Update each user's traitsPeer + traitsFinal (based on last 3 history docs)
    for (const uid of memberUids) {
      await recomputeUserTraits(uid);
    }

    // Update bucket model (traitModels/{projectType__term})
    await updateTraitModel(rating.projectType || "", rating.term || "medium");

    return null;
  });

async function recomputeUserTraits(uid) {
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return;

  const userData = userSnap.data() || {};
  const traitsSelf = userData.traits || {}; // your existing self-assessment
  const histSnap = await userRef.collection("traitHistory").orderBy("createdAt", "desc").limit(3).get();

  const histories = histSnap.docs.map((d) => d.data());
  const n = histories.length;

  // Compute traitsPeer = avg of last N projects
  const peer = {};
  for (const trait of TRAITS) {
    const vals = histories.map((h) => Number(h?.avgByTrait?.[trait] || 0)).filter((x) => x > 0);
    peer[trait] = vals.length ? Number(mean(vals).toFixed(2)) : 0;
  }

  // Blend weights: gradually shift from self to peer
  // 0 projects -> 100% self
  // 1 -> 70/30
  // 2 -> 50/50
  // 3+ -> 30/70
  let wPeer = 0;
  if (n === 1) wPeer = 0.3;
  else if (n === 2) wPeer = 0.5;
  else if (n >= 3) wPeer = 0.7;

  const wSelf = 1 - wPeer;

  const final = {};
  for (const trait of TRAITS) {
    const s = Number(traitsSelf?.[trait] || 0);
    const p = Number(peer?.[trait] || 0);
    final[trait] = Number((s * wSelf + p * wPeer).toFixed(2));
  }

  await userRef.set(
    {
      traitsPeer: peer,
      traitsFinal: final,
      traitsFinalUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function updateTraitModel(projectType, term) {
  const key = bucketKey(projectType, term);
  const modelRef = db.doc(`traitModels/${key}`);

  // Find recent traitHistory docs across all users for this bucket.
  // Simple approach: collection group query
  const histSnap = await db
    .collectionGroup("traitHistory")
    .where("projectType", "==", projectType)
    .where("term", "==", term)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const rows = histSnap.docs.map((d) => d.data());
  if (!rows.length) return;

  const meanByTrait = {};
  for (const trait of TRAITS) {
    const vals = rows.map((r) => Number(r?.avgByTrait?.[trait] || 0)).filter((x) => x > 0);
    meanByTrait[trait] = vals.length ? Number(mean(vals).toFixed(2)) : 0;
  }

  // Pick top 3 traits by mean value
  const sorted = [...TRAITS].sort((a, b) => (meanByTrait[b] || 0) - (meanByTrait[a] || 0));
  const topTraits = sorted.slice(0, 3);

  await modelRef.set(
    {
      projectType,
      term,
      meanByTrait,
      topTraits,
      dataPoints: rows.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}