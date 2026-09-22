import assert from "node:assert/strict";
import { build } from "../../apps/web/node_modules/esbuild/lib/main.js";
const result = await build({
  entryPoints: ["packages/human-perspective/src/index.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const api = await import(
  "data:text/javascript;base64," +
    Buffer.from(result.outputFiles[0].text).toString("base64")
);
const context = {
  surface: "WEB_HERO",
  audience_state: "new",
  task: "prepare a prompt",
  user_goal: "use my idea",
  emotional_moment: "exploring",
  urgency: "normal",
  expertise: "general",
  locale: "en",
  available_space: "body",
  disclosure_depth: "EXPERIENCE",
};
const candidate = (text) => ({
  id: "test",
  text,
  intent: {
    purpose: "GUIDE",
    meaning: text,
    tone: "premium_human",
    claim_refs: [],
  },
});
const bad = [
  ["The world’s best AI prompt compiler", "UNFOUNDED_SUPERLATIVE"],
  ["You have an exceptionally brilliant mind", "MANIPULATIVE_PRAISE"],
  ["Compile your semantic intent locally", "TECHNICAL_JARGON"],
  ["No internet needed", "NEGATIVE_FRAMING"],
  ["Unlock 10x productivity", "CLAIM_OVERREACH"],
  ["Understanding what you mean…", "CLAIM_OVERREACH"],
  ["You have no choice", "LOSS_OF_AGENCY"],
  ["Insanely good", "CULTURAL_RISK"],
  ["Unlock your potential", "BRAND_GENERICITY"],
];
for (const [text, risk] of bad)
  assert.ok(
    api.reviewCopy(candidate(text), context).risks.includes(risk),
    `${text}: expected ${risk}`,
  );
assert.equal(
  api.reviewCopy(candidate("WASM SHA-256"), {
    ...context,
    disclosure_depth: "PROOF",
  }).verdict,
  "PASS",
);
assert.equal(
  api.reviewCopy(candidate("WASM SHA-256"), context).verdict,
  "REVIEW_REQUIRED",
);
assert.equal(
  api.reviewCopy(
    {
      ...candidate("Your ideas stay with you"),
      intent: { ...candidate("").intent, claim_refs: ["inventedClaim"] },
    },
    context,
  ).verdict,
  "REVIEW_REQUIRED",
);
for (const [key, hero] of Object.entries(api.heroLibrary)) {
  assert.equal(
    api.reviewCopy(candidate(hero.title + " " + hero.accent), {
      ...context,
      available_space: "heading",
    }).verdict,
    "PASS",
    key,
  );
  assert.equal(
    api.reviewCopy(candidate(hero.support), {
      ...context,
      available_space: "support",
    }).verdict,
    "PASS",
    key + " support",
  );
}
assert.equal(
  api.reviewCopy(candidate(api.ui.mobileHeroSupport), {
    ...context,
    surface: "MOBILE_APP",
    available_space: "support",
  }).verdict,
  "PASS",
);
assert.equal(api.selectHero("Coding"), api.heroLibrary.builder);
assert.equal(api.selectHero("AI Assistant", true), api.heroLibrary.returning);
assert.equal(api.selectHero("AI Assistant"), api.heroLibrary.first);
const fixtures = [
  "WEB_HERO",
  "WEB_WORKSPACE",
  "MOBILE_APP",
  "DESKTOP_APP",
  "BROWSER_EXTENSION",
  "AI_PLUGIN",
  "CODING_PLUGIN",
  "ONBOARDING",
  "ERROR",
  "PRIVACY",
  "PROOF",
  "SETTINGS",
  "NOTIFICATION",
];
for (const surface of fixtures) {
  const output = api.actionForSurface({ ...context, surface });
  assert.equal(output.review.verdict, "PASS");
  assert.equal(output.fallback, false);
}
assert.equal(
  api.actionForSurface({ ...context, locale: "te-IN", surface: "MOBILE_APP" })
    .fallback,
  true,
);
assert.equal(
  api.errorCopy("WASM_INTEGRITY_MISMATCH").title,
  api.ui.integrityTitle,
);
assert.ok(
  !api.errorCopy("WASM_INTEGRITY_MISMATCH").support.includes("Try again"),
);
assert.equal(
  api.reviewCopy(candidate("Click here to unlock everything right now today"), {
    ...context,
    available_space: "action",
  }).verdict,
  "REVIEW_REQUIRED",
);
assert.throws(
  () => api.adaptCopy(candidate("Unlock 10x productivity"), context),
  /Copy review required/,
);
console.log(
  JSON.stringify({
    passed: true,
    adversarialCases: bad.length,
    surfaceFixtures: fixtures.length,
    heroVariants: Object.keys(api.heroLibrary).length,
    localeFallbackExplicit: true,
    diagnosticsContextSensitive: true,
  }),
);
// The release gate must reject both new unreviewed text and prohibited claims.
const { writeFileSync, unlinkSync } = await import("node:fs");
const { spawnSync } = await import("node:child_process");
const probe = "apps/web/src/CopyGateProbe.tsx";
let createdProbe = false;
try {
  writeFileSync(
    probe,
    "export const Probe = () => <p>Unlock 10x productivity</p>;\n",
    { flag: "wx" },
  );
  createdProbe = true;
  const gate = spawnSync(process.execPath, ["tools/copy-check.mjs"], {
    encoding: "utf8",
  });
  assert.equal(gate.status, 1);
  const report = JSON.parse(gate.stdout);
  assert.ok(report.violations.some((v) => v.reason === "UNREVIEWED_COPY"));
  assert.ok(
    report.violations.some((v) => v.reason.includes("CLAIM_OVERREACH")),
  );
} finally {
  if (createdProbe) unlinkSync(probe);
}
console.log(
  "PASS: build gate rejects unreviewed public strings and prohibited claims.",
);
