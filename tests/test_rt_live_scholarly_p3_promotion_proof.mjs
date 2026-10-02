/**
 * Phase 3 promotion-proof oracles -- fail-closed LIVE_* HOLD.
 */
import { strict as assert } from "node:assert";
import { build } from "../apps/web/node_modules/esbuild/lib/main.js";

const bundleResult = await build({
  stdin: {
    contents: `export * from "./apps/web/src/engine/continuation/index.ts";`,
    resolveDir: process.cwd(),
    sourcefile: "virtual-rt-live-scholarly-p3.ts",
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
  getLiveFabricCapabilitySnapshot,
  mayPromoteLiveIndex,
  mayPromoteLiveRetraction,
  evaluateLivePromotionGate,
  countIdentityProviderAgreement,
  acquireLiveScholarlyEvidence,
  checkRetractionStatus,
} = engine;

let pass = 0;
let fail = 0;

function caseId(id, fn) {
  try {
    fn();
    pass += 1;
    console.log(`PASS ${id}`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL ${id}: ${err?.message || err}`);
  }
}

caseId("P3-A1-product-HOLD", () => {
  const c = getLiveFabricCapabilitySnapshot();
  assert.equal(c.liveIndex, "HOLD");
  assert.equal(c.liveRetraction, "HOLD");
  assert.equal(mayPromoteLiveIndex(), false);
  assert.equal(mayPromoteLiveRetraction(), false);
});

caseId("P3-B1-gate-no-evidence", () => {
  const g = evaluateLivePromotionGate(null);
  assert.equal(g.mayPromoteIndex, false);
  assert.ok(g.reasons.includes("NO_EVIDENCE_PACK"));
});

caseId("P3-B2-MUTANT-single-ne-multi", () => {
  const g = evaluateLivePromotionGate({
    identityProvidersAgreeing: 1,
    retractionStatus: "RETRACTION_SIGNAL",
    provenancePresent: true,
    mutantsGreen: true,
    independentLiveNetworkProof: true,
  });
  assert.equal(g.mayPromoteIndex, false);
  assert.ok(g.reasons.includes("NEED_GE2_PROVIDERS_IDENTITY_AGREE"));
});

caseId("P3-B3-MUTANT-no-signal-collapse", () => {
  const g = evaluateLivePromotionGate({
    identityProvidersAgreeing: 2,
    retractionStatus: "NO_SIGNAL_IN_QUERIED_SOURCES",
    provenancePresent: true,
    mutantsGreen: true,
    independentLiveNetworkProof: true,
    noSignalCollapsedToNotRetracted: true,
  });
  assert.equal(g.mayPromoteIndex, false);
  assert.ok(g.reasons.includes("NO_SIGNAL_COLLAPSE_TO_NOT_RETRACTED_FORBIDDEN"));
});

caseId("P3-B4-MUTANT-not-checked", () => {
  const g = evaluateLivePromotionGate({
    identityProvidersAgreeing: 2,
    retractionStatus: "NOT_CHECKED",
    provenancePresent: true,
    mutantsGreen: true,
    independentLiveNetworkProof: true,
  });
  assert.equal(g.mayPromoteIndex, false);
});

caseId("P3-B5-MUTANT-fixture-ne-independent-live", () => {
  const g = evaluateLivePromotionGate({
    identityProvidersAgreeing: 2,
    retractionStatus: "RETRACTION_SIGNAL",
    provenancePresent: true,
    mutantsGreen: true,
    independentLiveNetworkProof: false,
  });
  assert.equal(g.mayPromoteIndex, false);
  assert.ok(g.reasons.includes("INDEPENDENT_LIVE_NETWORK_PROOF_MISSING"));
  assert.equal(g.productLiveIndex, "HOLD");
});

caseId("P3-C1-injectable-multi-provider-retraction", () => {
  const r = acquireLiveScholarlyEvidence({
    needQuery: "doi:10.1038/nature00870",
    consent: true,
    providers: ["OPENALEX", "CROSSREF"],
    transport: {
      get(url) {
        if (/openalex/i.test(url)) {
          return {
            status: 200,
            body: JSON.stringify({
              results: [{
                doi: "https://doi.org/10.1038/nature00870",
                display_name: "RETRACTED ARTICLE: Pluripotency",
                is_retracted: true,
                type: "article",
              }],
            }),
          };
        }
        return {
          status: 200,
          body: JSON.stringify({
            message: {
              items: [{
                DOI: "10.1038/nature00870",
                title: ["RETRACTED ARTICLE: Pluripotency"],
                type: "journal-article",
                "updated-by": [{ type: "retraction" }],
              }],
            },
          }),
        };
      },
    },
  });
  assert.equal(r.status, "ACQUIRED_LIVE");
  const agree = countIdentityProviderAgreement(r.records);
  assert.ok(agree >= 2);
  assert.equal(r.retraction.status, "RETRACTION_SIGNAL");
  assert.equal(getLiveFabricCapabilitySnapshot().liveRetraction, "HOLD");
  assert.equal(
    evaluateLivePromotionGate({
      identityProvidersAgreeing: agree,
      retractionStatus: r.retraction.status,
      provenancePresent: r.records.length > 0,
      mutantsGreen: true,
      independentLiveNetworkProof: false,
    }).mayPromoteIndex,
    false,
  );
});

caseId("P3-C2-MUTANT-unknown-ne-pass", () => {
  const r = checkRetractionStatus({
    identifier: "doi:10.1234/example",
    providers: ["OPENALEX", "CROSSREF"],
  });
  assert.equal(r.status, "UNKNOWN");
  assert.notEqual(r.status, "PASS");
  assert.equal(r.liveVerified, false);
});

caseId("P3-C3-MUTANT-cache-ne-live", () => {
  const r = checkRetractionStatus({
    identifier: "doi:10.1234/example",
    cachedStatus: "NO_SIGNAL_IN_QUERIED_SOURCES",
    treatCacheAsLive: true,
  });
  assert.equal(r.mode, "CACHE");
  assert.notEqual(r.mode, "LIVE");
});

caseId("P3-B6-MUTANT-UNKNOWN-full-pack-ne-mayPromote", () => {
  const g = evaluateLivePromotionGate({
    identityProvidersAgreeing: 2,
    retractionStatus: "UNKNOWN",
    provenancePresent: true,
    mutantsGreen: true,
    independentLiveNetworkProof: true,
  });
  assert.equal(g.mayPromoteIndex, false);
  assert.equal(g.mayPromoteRetraction, false);
  assert.equal(g.productLiveIndex, "HOLD");
  assert.equal(g.productLiveRetraction, "HOLD");
  assert.ok(g.reasons.includes("UNKNOWN_NE_TERMINAL_OK"));
  assert.ok(!g.reasons.includes("GATE_MET_PRODUCT_CONSTANTS_STILL_HOLD"));
  assert.ok(!g.reasons.includes("FOUNDER_FLIP_REQUIRED_FOR_LIVE_YES"));
});

caseId("P3-B7-writer-receipt-independent-verifier-false", () => {
  const receipt = { independent_verifier_receipt: false };
  const g = evaluateLivePromotionGate({
    identityProvidersAgreeing: 2,
    retractionStatus: "RETRACTION_SIGNAL",
    provenancePresent: true,
    mutantsGreen: true,
    independentLiveNetworkProof: receipt.independent_verifier_receipt,
  });
  assert.equal(g.mayPromoteIndex, false);
  assert.equal(g.mayPromoteRetraction, false);
  assert.ok(g.reasons.includes("INDEPENDENT_LIVE_NETWORK_PROOF_MISSING"));
  assert.equal(g.productLiveIndex, "HOLD");
});

caseId("P3-C4-MUTANT-timeout-ne-clean", () => {
  const r = checkRetractionStatus({
    identifier: "doi:10.1234/example",
    providers: ["OPENALEX"],
    timedOut: true,
  });
  assert.equal(r.status, "SOURCE_UNAVAILABLE");
  assert.notEqual(r.status, "NOT_RETRACTED");
});

console.log(`\nRT_LIVE_SCHOLARLY_P3_ORACLES pass=${pass} fail=${fail}`);
process.exitCode = fail > 0 ? 1 : 0;
