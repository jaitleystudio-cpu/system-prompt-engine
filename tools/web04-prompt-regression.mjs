import { build } from "../apps/web/node_modules/esbuild/lib/main.js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { loadAndEvaluate } from "../apps/web/src/engine/wasm-host.mjs";
const source = await build({
  entryPoints: ["packages/web-runtime/src/index.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const api = await import(
  "data:text/javascript;base64," +
    Buffer.from(source.outputFiles[0].text).toString("base64")
);
const wasmBytes = new Uint8Array(readFileSync("apps/web/public/spe_wasm.wasm"));
const expectedSha256 = JSON.parse(
  readFileSync("apps/web/public/spe_wasm.sha256.json"),
).sha256;
const cases = [
  ["AI Assistant", "Support customers using only the supplied store policy."],
  ["Analysis", "Analyze the supplied survey without inferring causation."],
  ["Creative", "Write an original short story about a lighthouse."],
  [
    "Multilingual",
    "Translate the supplied letter into Telugu without commentary.",
  ],
  [
    "Website / 3D",
    "Build an accessible offline portfolio with reduced motion.",
  ],
  ["Writing", "Write a concise leave request email for Friday."],
  [
    "Coding",
    "Review the supplied authentication code. Do not invent files or executed tests.",
  ],
  ["Research", "Compare battery recycling approaches using primary evidence."],
  ["Business", "Create a launch plan with a $2,000 budget and two people."],
  ["Education", "Explain fractions to a 10-year-old."],
  ["Structured Data", "Return a JSON array using only supplied records."],
  ["Image", "Create an image brief for a brushed titanium desk lamp."],
  ["Video", "Create a 10-second shot sequence for a quiet forest."],
];
const results = [];
for (const [category, userRequest] of cases) {
  const intent = api.defaultIntentLens(userRequest);
  const fixture = api.buildAbiFixture({
    category,
    target: "any",
    userRequest,
    ...intent,
  });
  const out = await loadAndEvaluate({
    wasmBytes,
    expectedSha256,
    jsonText: JSON.stringify(fixture),
  });
  assert.equal(out.error, null);
  assert.equal(out.result.status, "VALID");
  assert.equal(out.result.disposition, "VALID");
  const rendered = api.renderPromptArtifact({
    category,
    target: "any",
    userRequest,
    envelopeOutput: out.result.output,
  });
  assert.equal(
    rendered.finalPrompt.split(userRequest).length - 1,
    1,
    "goal duplicated",
  );
  assert.ok(!rendered.finalPrompt.includes("## Techniques"));
  assert.ok(!rendered.finalPrompt.includes("Who is the primary audience?"));
  assert.ok(rendered.finalPrompt.includes("## Deliverable"));
  assert.ok(
    rendered.finalPrompt.split(/\s+/).length >= 350,
    "expanded prompt should provide substantial working detail",
  );
  assert.ok(rendered.finalPrompt.includes("## Acceptance checks"));
  assert.ok(
    rendered.finalPrompt.includes("fixed schema"),
    "expanded instructions must preserve concise or schema-only output requirements",
  );
  if (category === "Coding") {
    assert.ok(rendered.finalPrompt.includes("expected versus actual behavior"));
    assert.ok(
      rendered.finalPrompt.includes("fail before the fix and pass after it"),
    );
    assert.ok(!rendered.finalPrompt.includes("A concise solution"));
    assert.ok(
      rendered.finalPrompt.includes(
        "For a review, report findings and proposed fixes without assuming permission to edit.",
      ),
    );
  }
  if (category === "Structured Data")
    assert.ok(
      rendered.finalPrompt.includes(
        "Keep explanatory prose, Markdown fences and extra keys out",
      ),
    );
  assert.equal(rendered.review.goal, userRequest);
  assert.equal(
    rendered.review.decisions.find((d) => d.title === "Role").source,
    "Working default",
  );
  assert.deepEqual(
    rendered.review.questions,
    [],
    "do not invent unanswered questions",
  );
  results.push({
    category,
    userRequest,
    output: rendered.finalPrompt,
    status: out.result.status,
  });
}
const intent = api.defaultIntentLens("Assist clothing store customers.");
intent.confirmed[0].text =
  "Never invent refund policies. Ask for the order number first.";
for (const [id, text] of [
  ["brief-role", "a customer support assistant for an online clothing store"],
  ["brief-audience", "Customers asking about returns and delivery"],
  ["brief-format", "A concise reply and one next step"],
])
  intent.assumed.find((a) => a.id === id).text = text;
intent.unknowns[0].text = "Which policy version applies?";
const f = api.buildAbiFixture({
  userRequest: "Assist clothing store customers.",
  category: "AI Assistant",
  target: "claude",
  ...intent,
});
const o = await loadAndEvaluate({
  wasmBytes,
  expectedSha256,
  jsonText: JSON.stringify(f),
});
assert.equal(o.result.status, "VALID");
const reviewed = api.renderPromptArtifact({
  userRequest: "Assist clothing store customers.",
  category: "AI Assistant",
  target: "claude",
  envelopeOutput: o.result.output,
});
const prompt = reviewed.finalPrompt;
assert.equal(
  reviewed.review.decisions.find((d) => d.title === "Role").source,
  "Your brief",
);
assert.equal(
  reviewed.review.decisions.find((d) => d.title === "Deliverable").detail,
  "A concise reply and one next step",
);
assert.ok(
  reviewed.review.decisions.some(
    (d) =>
      d.source === "Your brief" &&
      d.detail.includes("Never invent refund policies"),
  ),
);
assert.deepEqual(reviewed.review.questions, ["Which policy version applies?"]);
for (const phrase of [
  "a customer support assistant",
  "Never invent refund policies",
  "Customers asking",
  "A concise reply",
  "Which policy version",
])
  assert.ok(prompt.includes(phrase), phrase);
assert.throws(() =>
  api.renderPromptArtifact({
    userRequest: "anything",
    target: "any",
    envelopeOutput: null,
  }),
);
const art = await api.buildSpeArtifact({
  user_request: "test",
  category: "Writing",
  target: "any",
  envelope: f,
  wasm: {
    status: "VALID",
    disposition: "VALID",
    reason_code: null,
    sha256: expectedSha256,
    imports: 0,
    network_mode: "NONE",
    used_ts_fallback: false,
  },
  rendered_prompt: prompt,
  intent,
});
assert.equal((await api.verifySpeArtifact(art)).integrity.state, "VERIFIED");
assert.equal(
  (await api.verifySpeArtifact({ ...art, rendered_prompt: "tampered" }))
    .integrity.state,
  "MISMATCH",
);
// Regression: the result's goal can be reordered; every other supplied fact/detail survives.
const rich = structuredClone(f);
rich.payload.facts.unshift({
  fact_id: "store-policy",
  statement: "Returns are accepted within 30 days with a receipt.",
  provenance_ids: ["p-user"],
});
rich.payload.user_preferences.push({
  preference_id: "brief-tone",
  statement: "Use warm, plain language without sales pressure.",
});
const richOutput = await loadAndEvaluate({
  wasmBytes,
  expectedSha256,
  jsonText: JSON.stringify(rich),
});
assert.equal(richOutput.result.status, "VALID");
const richPrompt = api.renderPromptArtifact({
  userRequest: "Assist clothing store customers.",
  category: "AI Assistant",
  target: "any",
  envelopeOutput: richOutput.result.output,
});
assert.equal(
  richPrompt.userRequest,
  "Assist clothing store customers.",
  "the goal must not become the first unrelated fact",
);
for (const phrase of [
  "Returns are accepted within 30 days",
  "Use warm, plain language",
])
  assert.ok(richPrompt.finalPrompt.includes(phrase), phrase);
const conflicting = structuredClone(f);
conflicting.payload.hard_constraints.push({
  constraint_id: "conflict-user",
  statement:
    "[CONFLICT] Exact 50 words and exact 100 words are both requested.",
  strength: "HARD",
});
const conflictOutput = await loadAndEvaluate({
  wasmBytes,
  expectedSha256,
  jsonText: JSON.stringify(conflicting),
});
assert.throws(
  () =>
    api.renderPromptArtifact({
      userRequest: "Assist clothing store customers.",
      target: "any",
      envelopeOutput: conflictOutput.result.output,
    }),
  /Resolve the marked conflict/,
);
assert.throws(
  () =>
    api.renderPromptArtifact({
      userRequest: "A different request",
      target: "any",
      envelopeOutput: o.result.output,
    }),
  /does not match/,
);
console.log(
  JSON.stringify(
    {
      passed: true,
      caseCount: cases.length,
      structuredBrief: prompt,
      artifactTamperRejected: true,
      returnedFactsPreserved: true,
      extraBriefDetailsPreserved: true,
      explicitConflictsBlocked: true,
      wrongRequestRejected: true,
      cases: results,
    },
    null,
    2,
  ),
);
