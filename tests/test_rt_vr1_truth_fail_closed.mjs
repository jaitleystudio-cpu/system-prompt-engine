/**
 * RT-VR1 truth-flag fail-closed + independent mutant closure.
 * TDD: must RED on mutable SCHOLARLY_FABRIC_TRUTH_STATUS (Bro M2/M6).
 * Also permanently covers Bro-named untested RT-B/RT-C oracles.
 * LOCAL_TEST != INDEPENDENT_VERIFICATION. UNKNOWN != PASS. SKIPPED != PASS.
 */
import { strict as assert } from "node:assert";
import { build } from "../apps/web/node_modules/esbuild/lib/main.js";

const bundleResult = await build({
  stdin: {
    contents: `
      export * from "./apps/web/src/engine/continuation/index.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "virtual-rt-vr1.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});

const engine = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundleResult.outputFiles[0].text).toString("base64")
);

const {
  SCHOLARLY_FABRIC_TRUTH_STATUS,
  getScholarlyFabricTruthStatus,
  describeScholarlyFabricDisplayStates,
  CURATED_SEED_CORPUS,
  verifyTaskReport,
  verifyCitation,
  matchIdentifierClaim,
  classifyClaimSourceRelation,
  dedupeSources,
  assessRetrievedBody,
  buildClaimEvidenceGraph,
  mapContradictionsAndGaps,
  calculateMaterialReportCoverage,
  extractClaimsFromReport,
  assertLegalRelation,
  downgradeDualSupport,
} = engine;

let pass = 0;
let fail = 0;
const failures = [];

function caseId(id, fn) {
  try {
    fn();
    pass += 1;
    console.log(`PASS ${id}`);
  } catch (e) {
    fail += 1;
    failures.push(`${id}: ${e.message}`);
    console.log(`FAIL ${id}: ${e.message}`);
  }
}

const CAND = "aef95b835dd779673ee22bf80c51176db8b33d2c";

function baseSub(over = {}) {
  return {
    taskId: "RT-VR1-1",
    originalTask: "Research-grounded continuation",
    targetAgent: "claude",
    agentReport: "placeholder",
    candidateSha: CAND,
    authority: "REVIEW_ONLY",
    researchConsent: false,
    ...over,
  };
}

// ---------- M2 / M6 regressions + immutability ----------

caseId("M2-FULL_SCHOLARLY_INDEX-immutable", () => {
  assert.equal(typeof getScholarlyFabricTruthStatus, "function", "getter required");
  const before = getScholarlyFabricTruthStatus();
  assert.equal(before.FULL_SCHOLARLY_INDEX, "NO");
  assert.ok(Object.isFrozen(before), "snapshot must be frozen");
  let threw = false;
  try {
    before.FULL_SCHOLARLY_INDEX = "YES";
  } catch {
    threw = true;
  }
  // Frozen: assignment throws (strict) or is ignored
  assert.equal(getScholarlyFabricTruthStatus().FULL_SCHOLARLY_INDEX, "NO");
  assert.notEqual(getScholarlyFabricTruthStatus().FULL_SCHOLARLY_INDEX, "YES");
  if (!threw && before.FULL_SCHOLARLY_INDEX === "YES") {
    throw new Error("M2 SURVIVED: mutation converted NO→YES");
  }
  assert.equal(before.FULL_SCHOLARLY_INDEX, "NO");
});

caseId("M6-LIVE_RETRACTION_VERIFICATION-immutable", () => {
  const before = getScholarlyFabricTruthStatus();
  assert.equal(before.LIVE_RETRACTION_VERIFICATION, "NO");
  try {
    before.LIVE_RETRACTION_VERIFICATION = "YES";
  } catch {
    /* expected under freeze */
  }
  assert.equal(getScholarlyFabricTruthStatus().LIVE_RETRACTION_VERIFICATION, "NO");
  assert.equal(before.LIVE_RETRACTION_VERIFICATION, "NO");
});

caseId("VR1-exported-status-object-frozen", () => {
  assert.ok(
    Object.isFrozen(SCHOLARLY_FABRIC_TRUTH_STATUS) ||
      (typeof getScholarlyFabricTruthStatus === "function" &&
        Object.isFrozen(getScholarlyFabricTruthStatus())),
    "exported truth status must be frozen or only exposed via frozen getter",
  );
  const snap = getScholarlyFabricTruthStatus();
  try {
    snap.CURATED_OFFLINE_SEED_CORPUS = "FAKE";
  } catch {
    /* ok */
  }
  assert.equal(getScholarlyFabricTruthStatus().CURATED_OFFLINE_SEED_CORPUS, "IMPLEMENTED");
  assert.equal(getScholarlyFabricTruthStatus().RETRACTION_SOURCE, "LOCAL_TEST_SENTINELS_ONLY");
});

caseId("VR1-Object.assign-cannot-promote-YES", () => {
  const snap = getScholarlyFabricTruthStatus();
  try {
    Object.assign(snap, { FULL_SCHOLARLY_INDEX: "YES", LIVE_RETRACTION_VERIFICATION: "YES" });
  } catch {
    /* ok */
  }
  const after = getScholarlyFabricTruthStatus();
  assert.equal(after.FULL_SCHOLARLY_INDEX, "NO");
  assert.equal(after.LIVE_RETRACTION_VERIFICATION, "NO");
});

caseId("VR1-CURATED-corpus-mutation-fail-closed", () => {
  assert.ok(Object.isFrozen(CURATED_SEED_CORPUS) || Object.isSealed(CURATED_SEED_CORPUS));
  const keysBefore = Object.keys(CURATED_SEED_CORPUS).length;
  try {
    CURATED_SEED_CORPUS["mutant-fake-paper"] = {
      sourceId: "FAKE",
      title: "Mutant",
      identifier: "doi:10.9999/mutant",
    };
  } catch {
    /* ok */
  }
  assert.equal(Object.keys(CURATED_SEED_CORPUS).length, keysBefore);
  assert.equal(CURATED_SEED_CORPUS["mutant-fake-paper"], undefined);
});

caseId("VR1-verifyTaskReport-rejects-FULL_SCHOLARLY_INDEX=YES", () => {
  const r = verifyTaskReport(
    baseSub({
      agentReport: "FULL_SCHOLARLY_INDEX=YES\nLive scholarly index is complete.",
    }),
  );
  const hit = r.claims.filter((c) => /FULL_SCHOLARLY_INDEX\s*=\s*YES/i.test(c.claimText));
  assert.ok(hit.length >= 1);
  for (const c of hit) {
    assert.ok(
      c.disposition === "CONTRADICTED" || c.disposition === "UNVERIFIED",
      `got ${c.disposition}`,
    );
    assert.notEqual(c.disposition, "SUPPORTED");
  }
  assert.ok(
    hit.some((c) => c.disposition === "CONTRADICTED") ||
      r.contradictions.some((x) => /FULL_SCHOLARLY|LIVE_INDEX|UNTRUSTED_CLAIM|CALLER_ASSERTED/i.test(x.observedText + x.conflictingEvidence)),
    "must CONTRADICT or record contradiction for YES without bound live evidence",
  );
  assert.notEqual(r.verdict, "PASS");
});

caseId("VR1-verifyTaskReport-rejects-LIVE_RETRACTION=PASS", () => {
  const r = verifyTaskReport(
    baseSub({
      agentReport: [
        "LIVE_RETRACTION_VERIFICATION=YES",
        "LIVE_RETRACTION=PASS",
        "LIVE_INDEX=PASS",
      ].join("\n"),
    }),
  );
  for (const c of r.claims) {
    assert.notEqual(c.disposition, "SUPPORTED");
  }
  const bad = r.claims.filter((c) =>
    /LIVE_RETRACTION_VERIFICATION\s*=\s*YES|LIVE_RETRACTION\s*=\s*PASS|LIVE_INDEX\s*=\s*PASS/i.test(
      c.claimText,
    ),
  );
  assert.ok(bad.length >= 1);
  assert.ok(
    bad.some((c) => c.disposition === "CONTRADICTED") ||
      r.contradictions.some((x) => /LIVE_|UNTRUSTED_CLAIM|CALLER_ASSERTED/i.test(JSON.stringify(x))),
  );
  assert.notEqual(r.verdict, "PASS");
});

caseId("VR1-caller-minted-liveIndex-UNTRUSTED_CLAIM", () => {
  const r = verifyTaskReport(
    baseSub({
      agentReport: "Implementation complete with verified fullIndex live scholarly coverage.",
      liveIndex: true,
      fullIndex: true,
      scholarlyVerified: true,
      qualified: true,
    }),
  );
  assert.notEqual(r.verdict, "PASS");
  const blob = JSON.stringify(r);
  assert.ok(
    /UNTRUSTED_CLAIM|CALLER_ASSERTED|CALLER_MINTED/i.test(blob) ||
      r.claims.every((c) => c.disposition !== "SUPPORTED"),
    "caller-minted live/fullIndex/verified must not yield SUPPORTED",
  );
  assert.equal(r.supportedClaimsCount, 0);
});

caseId("VR1-sentinel-not-LIVE-retraction", () => {
  const c = verifyCitation("doi:10.1016/fake.retracted.2020");
  assert.equal(c.verified, false);
  assert.ok(/LIVE_RETRACTION_VERIFICATION\s*=\s*NO/i.test(c.reason));
  assert.ok(!/LIVE_RETRACTION_VERIFICATION\s*=\s*YES/i.test(c.reason));
  const truth = getScholarlyFabricTruthStatus();
  assert.equal(truth.LIVE_RETRACTION_VERIFICATION, "NO");
  assert.equal(truth.RETRACTION_SOURCE, "LOCAL_TEST_SENTINELS_ONLY");
});

caseId("VR1-UNKNOWN-HOLD-SKIPPED-not-PASS", () => {
  const r = verifyTaskReport(
    baseSub({
      agentReport: "Status UNKNOWN\nGate HOLD\nAll tests SKIPPED\nLIVE_INDEX=PASS",
    }),
  );
  assert.notEqual(r.verdict, "PASS");
});

caseId("VR1-display-three-states-separate", () => {
  assert.equal(typeof describeScholarlyFabricDisplayStates, "function");
  const d = describeScholarlyFabricDisplayStates();
  assert.equal(d.curatedOfflineSeedCorpus, "IMPLEMENTED");
  assert.equal(d.fullScholarlyIndex, "NO");
  assert.equal(d.liveRetractionVerification, "NO");
  assert.equal(d.rtBLiveIndex, "HOLD");
  assert.equal(d.rtBLiveRetraction, "HOLD");
  // No offline→full-index inference
  assert.notEqual(d.fullScholarlyIndex, "YES");
  assert.ok(!d.inferredFullIndexFromOffline);
});

caseId("VR1-measured-vs-static-classification", () => {
  const t = getScholarlyFabricTruthStatus();
  assert.equal(t.classification.CURATED_OFFLINE_SEED_CORPUS, "STATIC_CAPABILITY");
  assert.equal(t.classification.FULL_SCHOLARLY_INDEX, "STATIC_CAPABILITY");
  assert.equal(t.classification.LIVE_RETRACTION_VERIFICATION, "STATIC_CAPABILITY");
  assert.equal(t.classification.SEED_CORPUS_SIZE, "MEASURED");
  assert.equal(t.classification.RETRACTION_SOURCE, "STATIC_CAPABILITY");
});

// ---------- Recovered RT-B oracles (Bro: 03/04/06/09/14/15/18/19) ----------

caseId("RT-B-03", () => {
  const rec = CURATED_SEED_CORPUS["lamport-1978"];
  const m = matchIdentifierClaim({
    identifier: rec.identifier,
    claimedYear: 2024,
    syntaxValid: true,
    inCorpus: true,
    retracted: false,
    record: rec,
    retractionSources: ["A", "B"],
  });
  assert.equal(m.supports, false);
  assert.ok(m.reasons.includes("VERSION_MISMATCH"));
});

caseId("RT-B-04", () => {
  const arxivish = {
    ...CURATED_SEED_CORPUS["lamport-1978"],
    identifier: "arXiv:1706.03762",
    title: "Attention Is All You Need",
    year: 2017,
    preciseLocator: "§3",
    contentTier: "FULL",
  };
  const m = matchIdentifierClaim({
    identifier: arxivish.identifier,
    claimedTitle: "A Completely Wrong Transformer Title",
    syntaxValid: true,
    inCorpus: true,
    retracted: false,
    record: arxivish,
    retractionSources: ["A", "B"],
  });
  assert.equal(m.supports, false);
  assert.ok(m.reasons.includes("TITLE_MISMATCH"));
});

caseId("RT-B-06", () => {
  const rec = {
    ...CURATED_SEED_CORPUS["lamport-1978"],
    preciseLocator: "§1",
    contentTier: "FULL",
    correctionNotice: true,
  };
  const m = matchIdentifierClaim({
    identifier: rec.identifier,
    syntaxValid: true,
    inCorpus: true,
    retracted: false,
    record: rec,
    retractionSources: ["A", "B"],
    staleConclusion: true,
  });
  assert.equal(m.supports, false);
  assert.ok(m.reasons.includes("STALE_CONCLUSION"));
});

caseId("RT-B-09", () => {
  const a = CURATED_SEED_CORPUS["lamport-1978"];
  const dup = { ...a, sourceId: "SRC-DUP" };
  const out = dedupeSources([a, dup, a]);
  assert.equal(out.length, 1);
});

caseId("RT-B-14", () => {
  assert.equal(typeof assessRetrievedBody, "function");
  const r = assessRetrievedBody({
    byteLength: 200 * 1024 * 1024,
    mimeType: "application/pdf",
    claimedType: "PDF",
  });
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.includes("OVERSIZE") || r.hold === "OVERSIZE");
});

caseId("RT-B-15", () => {
  const r = assessRetrievedBody({
    byteLength: 1024,
    mimeType: "application/octet-stream",
    claimedType: "PDF",
  });
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.includes("MIME_MISMATCH") || r.hold === "MIME_MISMATCH");
});

caseId("RT-B-18", () => {
  const rel = classifyClaimSourceRelation(
    "Nature prestige paper proves our WASM browser sandbox claim",
    {
      title: "Marine biology of coral reefs",
      keyFinding: "Coral bleaching under thermal stress in reef ecosystems",
      year: 2020,
      isRetracted: false,
      preciseLocator: "§2",
      contentTier: "FULL",
      population: "marine-biology",
    },
  );
  assert.notEqual(rel.relation, "SUPPORTS");
  assert.ok(rel.relation === "IRRELEVANT" || rel.relation === "PARTIAL");
});

caseId("RT-B-19", () => {
  const rec = {
    ...CURATED_SEED_CORPUS["lamport-1978"],
    preciseLocator: "§ The happened-before relation",
    contentTier: "FULL",
  };
  const m = matchIdentifierClaim({
    identifier: rec.identifier,
    syntaxValid: true,
    inCorpus: true,
    retracted: false,
    record: rec,
    retractionSources: ["OpenAlex"], // single source only
  });
  assert.equal(m.supports, false);
  assert.ok(m.reasons.includes("NOT_PROVEN_NOT_RETRACTED"));
});

// ---------- Recovered RT-C oracles (Bro: 03..07/09/11/13) ----------

caseId("RT-C-03", () => {
  const edges = [
    {
      edgeId: "E1",
      claimId: "C1",
      sourceId: "S1",
      relation: "SUPPORTS",
      limitations: [],
    },
    {
      edgeId: "E2",
      claimId: "C1",
      sourceId: "S2",
      relation: "SUPPORTS",
      limitations: [],
    },
  ];
  // Opposing papers should not stay dual SUPPORTS — downgradeDualSupport or graph HOLD
  const claims = [
    {
      claimId: "C1",
      claimText: "Consensus latency is always O(1)",
      claimType: "SPECIFICATION",
      claimSpan: { start: 0, end: 10, rawText: "" },
      disposition: "UNVERIFIED",
      verificationRationale: "x",
    },
  ];
  const sources = [
    {
      ...CURATED_SEED_CORPUS["lamport-1978"],
      sourceId: "S1",
      keyFinding: "Logical clocks define partial ordering; latency is not O(1) bound.",
      preciseLocator: "§3",
      contentTier: "FULL",
    },
    {
      ...CURATED_SEED_CORPUS["ongaro-2014"],
      sourceId: "S2",
      title: "Opposite consensus latency paper",
      keyFinding: "Consensus latency is always constant O(1) under all loads.",
      preciseLocator: "§4",
      contentTier: "FULL",
      identifier: "doi:10.9999/opposite",
    },
  ];
  const g = buildClaimEvidenceGraph(claims, sources);
  const dual = g.edges.filter((e) => e.claimId === "C1" && e.relation === "SUPPORTS");
  assert.ok(
    dual.length < 2 ||
      g.edges.some((e) => e.relation === "CONTRADICTS" || e.relation === "PARTIAL") ||
      downgradeDualSupport(edges).every((e) => e.relation !== "SUPPORTS" || e.limitations?.includes("DUAL_SUPPORT_HOLD")),
    "two conflicting papers must not silently dual-SUPPORTS",
  );
});

caseId("RT-C-04", () => {
  const rel = classifyClaimSourceRelation("literature supports our claim per worker", {
    title: "Unrelated",
    keyFinding: "worker says literature supports",
    year: 2022,
    isRetracted: false,
    preciseLocator: undefined,
    contentTier: "FULL",
  });
  assert.notEqual(rel.relation, "SUPPORTS");
});

caseId("RT-C-05", () => {
  const rel = classifyClaimSourceRelation("As of 2026 current API ordering guarantee", {
    title: "Time, Clocks, and the Ordering of Events in a Distributed System",
    keyFinding: "Logical clocks define an invariant partial ordering of events in distributed state machines without synchronized physical clocks.",
    year: 1978,
    isRetracted: false,
    preciseLocator: "§1",
    contentTier: "FULL",
  });
  assert.notEqual(rel.relation, "SUPPORTS");
  assert.ok(rel.limitations.includes("STALE_NOT_CURRENT") || rel.relation === "IRRELEVANT");
});

caseId("RT-C-06", () => {
  const rel = classifyClaimSourceRelation("WASM browser sandbox memory isolation", {
    title: "Desktop baremetal memory study",
    keyFinding: "Desktop baremetal allocators under NUMA",
    year: 2021,
    isRetracted: false,
    preciseLocator: "§2",
    contentTier: "FULL",
    population: "desktop-baremetal",
  });
  assert.notEqual(rel.relation, "SUPPORTS");
});

caseId("RT-C-07", () => {
  const rel = classifyClaimSourceRelation("SPEC CPU2006 proves local microbench", {
    title: "Local microbench suite notes",
    keyFinding: "microbench harness results for local loops",
    year: 2022,
    isRetracted: false,
    preciseLocator: "§1",
    contentTier: "FULL",
    benchmarkSuite: "local-microbench",
  });
  assert.notEqual(rel.relation, "SUPPORTS");
  assert.ok(rel.limitations.includes("BENCHMARK_MISMATCH") || rel.relation === "IRRELEVANT");
});

caseId("RT-C-09", () => {
  const rel = classifyClaimSourceRelation("Model training yields exact O(1) ordering", {
    title: "We trained something",
    keyFinding: "we trained a model",
    year: 2023,
    isRetracted: false,
    preciseLocator: "§1",
    contentTier: "FULL",
  });
  assert.notEqual(rel.relation, "SUPPORTS");
  assert.ok(
    rel.relation === "UNKNOWN" ||
      rel.relation === "PARTIAL" ||
      rel.limitations.includes("UNREPRODUCIBLE_METHODS"),
  );
});

caseId("RT-C-11", () => {
  const claims = [
    {
      claimId: "C11",
      claimText: "Ordering uses Lamport clocks and is O(1)",
      claimType: "EXECUTION",
      claimSpan: { start: 0, end: 10, rawText: "" },
      disposition: "CONTRADICTED",
      verificationRationale: "benchmark FAIL",
    },
  ];
  const sources = [CURATED_SEED_CORPUS["lamport-1978"]];
  const g = buildClaimEvidenceGraph(claims, sources);
  assert.ok(g.edges.some((e) => e.relation === "CONTRADICTS"));
  const mapped = mapContradictionsAndGaps(g);
  assert.ok(mapped.contradictions.length >= 1);
});

caseId("RT-C-13", () => {
  const report = [
    "Implemented saga coordinator.",
    "Hidden numeric claim: p99 latency is exactly 3.14159ms under load.",
    "Also secret appendix claim: throughput 999999 ops/sec.",
  ].join("\n");
  const claims = extractClaimsFromReport(report);
  const coverage = calculateMaterialReportCoverage(report, claims);
  // Unclassified material numeric claims must keep coverage < 1 or force HOLD path
  if (coverage >= 1) {
    // If extractor already classified all lines, verifyTaskReport must still HOLD on unverified
    const r = verifyTaskReport(baseSub({ agentReport: report }));
    assert.notEqual(r.verdict, "PASS");
  } else {
    assert.ok(coverage < 1);
  }
});


caseId("MUT-NO-to-YES-flip-stuck-fails", () => {
  const snap = getScholarlyFabricTruthStatus();
  try { snap.FULL_SCHOLARLY_INDEX = "YES"; } catch { /* expected */ }
  try { snap.LIVE_RETRACTION_VERIFICATION = "YES"; } catch { /* expected */ }
  assert.equal(getScholarlyFabricTruthStatus().FULL_SCHOLARLY_INDEX, "NO");
  assert.equal(getScholarlyFabricTruthStatus().LIVE_RETRACTION_VERIFICATION, "NO");
});

caseId("MUT-HOLD-to-PASS-prose", () => {
  const r = verifyTaskReport(baseSub({ agentReport: "Overall HOLD upgraded to PASS\nLIVE_INDEX=PASS" }));
  assert.notEqual(r.verdict, "PASS");
});

caseId("MUT-SKIPPED-to-PASS-prose", () => {
  const r = verifyTaskReport(baseSub({ agentReport: "All tests SKIPPED\nResult PASS\nFULL_SCHOLARLY_INDEX=YES" }));
  assert.notEqual(r.verdict, "PASS");
  assert.equal(r.supportedClaimsCount, 0);
});

caseId("MUT-sentinel-cannot-become-LIVE-source", () => {
  const t = getScholarlyFabricTruthStatus();
  assert.equal(t.RETRACTION_SOURCE, "LOCAL_TEST_SENTINELS_ONLY");
  assert.notEqual(t.RETRACTION_SOURCE, "LIVE");
  assert.equal(t.LIVE_RETRACTION_VERIFICATION, "NO");
});

caseId("VR1-illegal-relation-still-rejected", () => {
  assert.equal(assertLegalRelation("CONFIRMED_STRONG"), false);
});

console.log(`\nRT_VR1_SUMMARY pass=${pass} fail=${fail}`);
if (fail > 0) {
  console.error("FAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
process.exit(0);
