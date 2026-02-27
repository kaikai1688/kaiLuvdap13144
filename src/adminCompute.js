// src/adminCompute.js
import { GoogleGenAI } from "@google/genai";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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

function computeTop3ByAverage(bucketTraitAverages = {}) {
  return [...TRAITS]
    .sort((a, b) => Number(bucketTraitAverages[b] || 0) - Number(bucketTraitAverages[a] || 0))
    .slice(0, 3);
}

// Optional: use Gemini to pick top 3 (fallback to math if no key / parsing fails)
async function geminiPickTop3({ projectType, term, bucketTraitAverages }) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are optimizing teammate matching priorities.
Bucket: ${projectType} / ${term} term

Trait averages (1..5) from completed projects:
${TRAITS.map((t) => `${t}: ${Number(bucketTraitAverages[t] || 0).toFixed(2)}`).join("\n")}

Pick the BEST 3 traits to prioritize for matching in this bucket.
Return STRICT JSON ONLY in this format:
{"topTraits":["trait1","trait2","trait3"],"reason":"1-2 sentences"}

Allowed traits:
${TRAITS.join(", ")}

No markdown. JSON only.
`.trim();

  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text =
    (resp?.text || resp?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    const topTraits = Array.isArray(parsed.topTraits) ? parsed.topTraits : null;
    if (!topTraits || topTraits.length !== 3) return null;
    if (!topTraits.every((t) => TRAITS.includes(t))) return null;

    return { topTraits, reason: String(parsed.reason || "").slice(0, 250) };
  } catch {
    return null;
  }
}

export async function runAdminAggregationForProject({ projectId, currentUid }) {
  try {
    console.log("ADMIN AGG START", { projectId, currentUid });

    // 0) Admin allowlist
    const adminSnap = await getDoc(doc(db, "config", "admins"));
    const isAdmin = adminSnap.exists() && adminSnap.data()?.adminMap?.[currentUid] === true;
    if (!isAdmin) return { ok: false, message: "Not admin — aggregation skipped." };

    // 1) Load rating session (must exist)
    const ratingSnap = await getDoc(doc(db, "projectRatings", projectId));
    if (!ratingSnap.exists()) return { ok: false, message: "projectRatings doc not found." };

    const rating = ratingSnap.data();

    // ✅ IMPORTANT: memberUids fallback from projects doc (more reliable)
    let memberUids = Array.isArray(rating.memberUids) ? rating.memberUids : [];
    if (memberUids.length === 0) {
      const projSnap = await getDoc(doc(db, "projects", projectId));
      const proj = projSnap.exists() ? projSnap.data() : null;
      memberUids = Array.isArray(proj?.memberUids) ? proj.memberUids : [];
    }

    const projectType = rating.projectType || "Unknown";
    const term = rating.term || "medium";

    // 2) Load submissions
    const subsSnap = await getDocs(collection(db, "projectRatings", projectId, "submissions"));
    const submissions = subsSnap.docs.map((d) => d.data());
    if (submissions.length === 0) return { ok: false, message: "No submissions yet." };

    console.log("AGG: loaded", { members: memberUids.length, submissions: submissions.length });

    // 3) Aggregate received scores per target
    const sums = {};
    const counts = {};

    for (const sub of submissions) {
      const targets = sub.targets || {};
      for (const targetUid of Object.keys(targets)) {
        if (!memberUids.includes(targetUid)) continue;

        sums[targetUid] = sums[targetUid] || {};
        counts[targetUid] = counts[targetUid] || 0;

        const traitObj = targets[targetUid] || {};
        let hasAny = false;

        for (const trait of TRAITS) {
          const v = Number(traitObj[trait] || 0);
          if (v >= 1 && v <= 5) {
            sums[targetUid][trait] = Number(sums[targetUid][trait] || 0) + v;
            hasAny = true;
          }
        }

        if (hasAny) counts[targetUid] += 1;
      }
    }

    // 4) Write per-user summaries (don’t let one fail stop all)
    for (const uid of memberUids) {
      const n = Number(counts[uid] || 0);
      if (n <= 0) continue;

      try {
        const avgByTrait = {};
        for (const trait of TRAITS) {
          avgByTrait[trait] = Number(sums[uid]?.[trait] || 0) / n;
        }

        console.log("AGG: writing traitHistory for uid =", uid);
        await setDoc(
          doc(db, "users", uid, "traitHistory", projectId),
          {
            projectId,
            projectType,
            term,
            numRaters: n,
            avgByTrait,
            createdAt: serverTimestamp(),
            computedBy: "frontend-admin",
            computedAt: new Date().toISOString(),
            computedVersion: 1,
          },
          { merge: true }
        );

        // Load last 3 histories
        const lastQ = query(
          collection(db, "users", uid, "traitHistory"),
          orderBy("createdAt", "desc"),
          limit(3)
        );
        const lastSnap = await getDocs(lastQ);
        const last = lastSnap.docs.map((d) => d.data()).filter(Boolean);

        // Compute peer
        const peer = {};
        for (const trait of TRAITS) peer[trait] = 0;

        let used = 0;
        for (const h of last) {
          const abt = h.avgByTrait || {};
          for (const trait of TRAITS) peer[trait] += Number(abt[trait] || 0);
          used += 1;
        }
        if (used > 0) {
          for (const trait of TRAITS) peer[trait] = peer[trait] / used;
        }

        const peerWeight = used <= 0 ? 0 : used === 1 ? 0.3 : used === 2 ? 0.5 : 0.7;

        const userSnap = await getDoc(doc(db, "users", uid));
        const selfTraits = userSnap.exists() ? userSnap.data()?.traits || {} : {};

        const final = {};
        for (const trait of TRAITS) {
          const selfV = Number(selfTraits[trait] || 0);
          const peerV = Number(peer[trait] || 0);
          final[trait] = selfV * (1 - peerWeight) + peerV * peerWeight;
        }

        console.log("AGG: writing traitsPeer/traitsFinal for uid =", uid);
        await setDoc(
          doc(db, "users", uid),
          {
            traitsPeer: peer,
            traitsFinal: final,
            traitsPeerUpdatedAt: serverTimestamp(),
            computedBy: "frontend-admin",
            computedAt: new Date().toISOString(),
            computedVersion: 1,
          },
          { merge: true }
        );
      } catch (err) {
        console.error("AGG: failed writing for uid =", uid, err);
        // continue to next uid
      }
    }

    // 5) Update traitModels bucket
    const bucketTraitAverages = {};
    for (const trait of TRAITS) bucketTraitAverages[trait] = 0;

    let memberCount = 0;
    for (const uid of memberUids) {
      const n = Number(counts[uid] || 0);
      if (n <= 0) continue;
      memberCount += 1;
      for (const trait of TRAITS) {
        bucketTraitAverages[trait] += Number(sums[uid]?.[trait] || 0) / n;
      }
    }
    if (memberCount > 0) {
      for (const trait of TRAITS) bucketTraitAverages[trait] = bucketTraitAverages[trait] / memberCount;
    }

    const bucketId = `${projectType}__${term}`;
    const gem = await geminiPickTop3({ projectType, term, bucketTraitAverages });
    const topTraits = gem?.topTraits || computeTop3ByAverage(bucketTraitAverages);

    console.log("AGG: writing traitModels bucketId =", bucketId);
    await setDoc(
      doc(db, "traitModels", bucketId),
      {
        bucketId,
        projectType,
        term,
        topTraits,
        bucketTraitAverages,
        reason: gem?.reason || "Computed by averages (fallback).",
        updatedAt: serverTimestamp(),
        computedBy: "frontend-admin",
        computedAt: new Date().toISOString(),
        computedVersion: 1,
      },
      { merge: true }
    );

    // 6) Close rating session (optional)
    await setDoc(
      doc(db, "projectRatings", projectId),
      {
        status: "closed",
        closedAt: serverTimestamp(),
        closedBy: currentUid,
        computedBy: "frontend-admin",
      },
      { merge: true }
    );

    console.log("ADMIN AGG DONE", { bucketId });
    return { ok: true, message: "Aggregation completed (admin)." };
  } catch (e) {
    console.error("ADMIN AGG FAILED", e);
    return { ok: false, message: e?.message || "Aggregation failed." };
  }
}