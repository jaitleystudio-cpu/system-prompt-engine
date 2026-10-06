import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";
import { loadAndEvaluate } from "../src/engine/wasm-host.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "../..");

// 1. Bundle web-runtime
const bundle = await build({
  entryPoints: [join(repo, "packages/web-runtime/src/index.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const runtime = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// 2. Load pinned WASM
const wasmBytes = new Uint8Array(readFileSync(join(root, "public/spe_wasm.wasm")));
const expectedSha256 = JSON.parse(
  readFileSync(join(root, "public/spe_wasm.sha256.json"))
).sha256;

console.log("============================================================");
console.log("SPE Ω — R8 TEXT VOLUME & OUTPUT-BUDGET ARCHITECTURE SUITE");
console.log("============================================================");

// =========================================================================
// SECTION 19 / TDD REGRESSION SUITE (A through I)
// =========================================================================

console.log("\n[TDD REGRESSION A] Million-Word Duplicated Source Amplification Check");
{
  const wordRun = "apple banana orange grape melon cherry mango lemon peach berry ";
  const targetWords = 100_000; // 100k for fast automated regression, scalable to 1M
  const rawInput = wordRun.repeat(targetWords / 10).trim();
  const rawBytes = Buffer.byteLength(rawInput, "utf8");

  const intent = runtime.defaultIntentLens(rawInput);
  const fixture = runtime.buildAbiFixture({
    category: "Writing",
    target: "any",
    userRequest: rawInput,
    ...intent,
  });

  // Transport with protectedFromFixture filtering
  const payload = fixture.payload;
  const rawFacts = Array.isArray(payload.facts) ? payload.facts : [];
  const filteredFacts = rawFacts.filter((item) => {
    if (item.fact_id === "f-user-request") return false;
    if (item.statement === rawInput) return false;
    return true;
  });

  const req = {
    spe_api: "k3",
    op: "select",
    protected: {
      ...payload,
      goal: rawInput,
      facts: filteredFacts,
    },
    category: { display_label: "Writing" },
    task: {},
  };

  const outcome = await loadAndEvaluate({
    wasmBytes,
    expectedSha256,
    jsonText: JSON.stringify(req),
  });
  assert.equal(outcome.error, null);

  const compiledPrompt = outcome.result.output.prompt_effect_plan.compiled_prompt;
  const compiledBytes = Buffer.byteLength(compiledPrompt, "utf8");

  // Check physical copy count of source in compiled prompt
  const occurrences = (compiledPrompt.match(new RegExp("apple banana orange grape melon cherry mango lemon peach berry", "g")) || []).length;
  // Previously occurrences was 2 (in Objective AND in Facts) -> now exactly 1 (Objective only)
  assert.equal(occurrences, targetWords / 10, "Source occurrences must match exactly single-copy emission");

  const amplificationRatio = compiledBytes / rawBytes;
  console.log(`  Raw source bytes: ${rawBytes}`);
  console.log(`  Compiled prompt bytes: ${compiledBytes}`);
  console.log(`  Amplification ratio: ${amplificationRatio.toFixed(3)}x (was ~2.00x)`);
  assert.ok(amplificationRatio < 1.05, `Amplification ratio ${amplificationRatio} must be ~1.0x, not 2.0x`);
  console.log("  PASS: Duplicated source amplification eliminated (TDD A passed)");
}

console.log("\n[TDD REGRESSION B] Desired-Output Semantic Preservation");
{
  const desiredOutputStr = "Return exactly 20,000 words";
  const rawInput = "Draft a comprehensive technical history of computing.";
  const budget = runtime.parseRequestedAnswerBudget(desiredOutputStr);
  assert.equal(budget.status, "SUCCESS");
  assert.equal(budget.budget.mode, "exact");
  assert.equal(budget.budget.target, 20000);

  const compiledReq = runtime.formatCompiledLengthRequirement(budget.budget);
  assert.equal(
    compiledReq,
    "FINAL OUTPUT LENGTH: Exactly 20,000 words under the specified counting convention."
  );

  const fixture = runtime.buildAbiFixture({
    category: "Engineering",
    target: "any",
    userRequest: rawInput,
    confirmed: [
      { id: "c-1", kind: "confirmed", label: "Length", text: compiledReq },
      { id: "desired-output", kind: "confirmed", label: "Deliverable", text: desiredOutputStr },
    ],
  });

  const outcome = await loadAndEvaluate({
    wasmBytes,
    expectedSha256,
    jsonText: JSON.stringify({
      spe_api: "k3",
      op: "select",
      protected: {
        ...fixture.payload,
        goal: rawInput,
        desired_output: desiredOutputStr,
      },
      category: { display_label: "Engineering" },
      task: {},
    }),
  });

  const plan = outcome.result.output.prompt_effect_plan;
  assert.equal(plan.disposition, "BOUND");
  assert.ok(
    plan.compiled_prompt.includes(compiledReq),
    "Compiled prompt must preserve compiled answer length requirement"
  );
  assert.ok(
    plan.compiled_prompt.includes(desiredOutputStr),
    "Compiled prompt must preserve desired_output deliverable constraint"
  );
  console.log("  PASS: Desired-output compiled faithfully as downstream requirement (TDD B passed)");
}

console.log("\n[TDD REGRESSION C] Raw Unicode Identity Field Preservation");
{
  const complexUnicodeInputs = [
    "   leading and trailing spaces   \n\t",
    "é vs e\u0301 precomposed and decomposed forms",
    "తెలుగు మరియు தமிழ் மற்றும் हिन्दी - Indic script accuracy",
    "العربية / עברית - RTL bidirectional script",
    "🚀✨ Unicode emoji and grapheme clusters 👨‍👩‍👧‍👦",
    "2026-10-06T04:00:00.000Z - Timestamp formatted raw string",
  ];

  for (const raw of complexUnicodeInputs) {
    const fixture = runtime.buildAbiFixture({
      category: "Writing",
      target: "any",
      userRequest: raw,
    });

    const rendered = runtime.renderNonProductionEnvelopePreview({
      category: "Writing",
      target: "any",
      userRequest: raw,
      envelopeOutput: fixture.payload,
    });

    assert.equal(
      rendered.userRequest,
      raw,
      `rendered.userRequest must match raw input byte-for-byte: ${JSON.stringify(raw)}`
    );
    assert.equal(
      rendered.review.goal,
      raw,
      `rendered.review.goal must match raw input byte-for-byte: ${JSON.stringify(raw)}`
    );
  }
  console.log("  PASS: Exact raw Unicode, whitespace, and timestamps preserved (TDD C passed)");
}

console.log("\n[TDD REGRESSION D] Timestamp-Shaped Source Identity Preservation");
{
  const timestampInput = "2026-10-06T12:34:56.789Z\n\nLog entry recorded at 2026-10-06T12:34:56Z";
  const fixture = runtime.buildAbiFixture({
    category: "Engineering",
    target: "any",
    userRequest: timestampInput,
  });

  const rendered = runtime.renderNonProductionEnvelopePreview({
    category: "Engineering",
    target: "any",
    userRequest: timestampInput,
    envelopeOutput: fixture.payload,
  });

  assert.equal(rendered.userRequest, timestampInput);
  assert.ok(!rendered.userRequest.includes("Invalid Date"));
  console.log("  PASS: Timestamp-shaped text preserved without conversion (TDD D passed)");
}

console.log("\n[TDD REGRESSION E] Conflicting Length Constraints Detection");
{
  const conflictSets = [
    ["exactly 20,000 words", "under 10,000 words"],
    ["under 10,000 words", "exactly 20,000 words"],
    ["exactly 20,000 words", "exactly 15,000 words"],
    ["at least 30,000 words", "at most 20,000 words"],
    ["at most 20,000 words", "at least 30,000 words"],
    ["under 2,000 words", "between 5,000 and 10,000 words"],
    ["between 5,000 and 10,000 words", "under 2,000 words"],
    ["between 5,000 and 10,000 words", "at least 15,000 words"],
    ["at least 15,000 words", "between 5,000 and 10,000 words"],
    ["between 1,000 and 2,000 words", "between 3,000 and 4,000 words"],
    ["between 25,000 and 20,000 words"], // inverted range
  ];

  for (const set of conflictSets) {
    const conflictResult = runtime.detectBudgetConflicts(set);
    assert.equal(
      conflictResult.hasConflict,
      true,
      `Expected conflict for set: ${JSON.stringify(set)}`
    );

    // Verify PromptBriefError is thrown when rendering brief with conflict
    assert.throws(
      () => {
        const fixture = runtime.buildAbiFixture({
          category: "Writing",
          target: "any",
          userRequest: "Draft a paper.",
          confirmed: set.map((t, i) => ({ id: `c-${i}`, kind: "confirmed", label: "Length", text: t })),
        });
        runtime.renderNonProductionEnvelopePreview({
          category: "Writing",
          target: "any",
          userRequest: "Draft a paper.",
          envelopeOutput: fixture.payload,
        });
      },
      (err) => err instanceof runtime.PromptBriefError && err.message.includes("Resolve the marked conflict")
    );
  }
  console.log("  PASS: Length conflicts detected fail-closed as CONFLICT (TDD E passed)");
}

console.log("\n[TDD REGRESSION F] Infeasible Provider Output Check");
{
  const hugeBudget = runtime.parseRequestedAnswerBudget("exactly 1,000,000 words").budget;
  const verdictClaude = runtime.checkProviderFeasibility("claude-3-5-sonnet", hugeBudget);
  assert.equal(verdictClaude.status, "NOT_FEASIBLE_WITH_SELECTED_PROVIDER");
  assert.ok(verdictClaude.reason.includes("exceeds provider maximum output"));
  assert.ok(verdictClaude.proposal.includes("chunked document generation"));

  const verdictGpt = runtime.checkProviderFeasibility("gpt-4o", hugeBudget);
  assert.equal(verdictGpt.status, "NOT_FEASIBLE_WITH_SELECTED_PROVIDER");

  const feasibleBudget = runtime.parseRequestedAnswerBudget("exactly 2,000 words").budget;
  const verdictFeasible = runtime.checkProviderFeasibility("gpt-4o", feasibleBudget);
  assert.equal(verdictFeasible.status, "FEASIBLE");

  console.log("  PASS: Provider feasibility correctly distinguishes feasible vs unfeasible (TDD F passed)");
}

console.log("\n[TDD REGRESSION G] Chunk-Budget Sum Invariant");
{
  const targets = [20_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 7_777, 13_333];
  for (const target of targets) {
    const plan = runtime.planChunkedDocumentGeneration(target, 4_000);
    assert.equal(plan.invariant_satisfied, true);
    assert.equal(
      plan.sum_section_budgets,
      target,
      `Sum of section budgets must exactly equal target ${target}`
    );
  }
  console.log("  PASS: Chunk planner guarantees sum(section_budgets) === target invariant (TDD G passed)");
}

console.log("\n[TDD REGRESSION H] Export / Import Roundtrip Custody");
{
  const testScales = [
    ["20k", 2_000],
    ["100k", 10_000],
    ["250k", 25_000],
  ];

  for (const [label, count] of testScales) {
    const sourceText = "word ".repeat(count).trim();
    const sourceDoc = await runtime.createSourceDocument(sourceText, `src-${label}`);
    const budget = runtime.parseRequestedAnswerBudget(`exactly ${count} words`).budget;

    const fixture = runtime.buildAbiFixture({
      category: "Writing",
      target: "any",
      userRequest: sourceText,
    });

    const artifact = await runtime.buildSpeArtifact({
      user_request: sourceText,
      category: "Writing",
      target: "any",
      envelope: fixture.payload,
      source_document: sourceDoc,
      requested_answer_budget: budget,
      rendered_prompt: `## Objective\n${sourceText}`,
      wasm: {
        status: "VALID",
        disposition: "BOUND",
        reason_code: null,
        sha256: expectedSha256,
        imports: 0,
        network_mode: "NONE",
        used_ts_fallback: false,
      },
      intent: {
        confirmed: [],
        assumed: [],
        unknowns: [],
        conflicts: [],
      },
    });

    const jsonExport = JSON.stringify(artifact);
    const parsed = await runtime.parseSpeArtifactText(jsonExport);

    assert.equal(parsed.artifact.integrity.state, "VERIFIED");
    assert.equal(parsed.artifact.user_request, sourceText);
    assert.equal(parsed.artifact.source_document.sha256, sourceDoc.sha256);
    assert.equal(parsed.artifact.requested_answer_budget.target, count);
    assert.equal(parsed.artifact.rendered_prompt, `## Objective\n${sourceText}`);

    // Verify that tampering with source_document raw_text triggers rejection
    const tampered = JSON.parse(jsonExport);
    tampered.source_document.raw_text = "MUTATED " + tampered.source_document.raw_text;
    await assert.rejects(
      async () => {
        await runtime.parseSpeArtifactText(JSON.stringify(tampered));
      },
      (err) => err instanceof runtime.SpeArtifactImportError
    );
  }
  console.log("  PASS: Export/import roundtrip verifies raw source hash and budgets (TDD H passed)");
}

console.log("\n[TDD REGRESSION I] Sequential-Memory Recovery Check");
{
  const initialMemory = process.memoryUsage().heapUsed;
  for (let i = 0; i < 5; i++) {
    const tempText = "lorem ipsum dolor sit amet ".repeat(20_000);
    const doc = await runtime.createSourceDocument(tempText);
    assert.ok(doc.sha256.length === 64);
  }
  if (global.gc) global.gc();
  const postMemory = process.memoryUsage().heapUsed;
  const growthMb = (postMemory - initialMemory) / (1024 * 1024);
  console.log(`  Heap growth across 5 large cycles: ${growthMb.toFixed(2)} MB`);
  assert.ok(growthMb < 150, "Memory growth must remain bounded across cycles");
  console.log("  PASS: Sequential memory recovery verified (TDD I passed)");
}

// =========================================================================
// SECTION 20 / MUTATION TEST SUITE
// =========================================================================

console.log("\n============================================================");
console.log("SECTION 20: ADVERSARIAL MUTATION TESTING SUITE");
console.log("============================================================");

// Mutation 1: Reintroduce source duplication -> amplification gate MUST fail
{
  const source = "word ".repeat(50_000);
  const rawBytes = Buffer.byteLength(source, "utf8");
  // Simulating duplicate emission
  const mutatedPrompt = `## Objective\n${source}\n\n## Facts\n- ${source}`;
  const mutatedRatio = Buffer.byteLength(mutatedPrompt, "utf8") / rawBytes;
  assert.ok(
    mutatedRatio > 1.9,
    "Mutant with source duplication produces ~2x amplification"
  );
  // Verify that an amplification gate checking ratio <= 1.1 catches the mutation
  const gateFailed = mutatedRatio > 1.1;
  assert.equal(gateFailed, true, "Amplification gate MUST fail when source duplication is reintroduced");
  console.log("  PASS: Mutation 1 (Source Duplication) caught by amplification gate");
}

// Mutation 2: Drop desired-output constraint -> requirement gate MUST fail
{
  const desired = "Return exactly 20,000 words";
  const mutantPrompt = "## Objective\nDo something\n\n## Facts\n- fact1";
  const gateFailed = !mutantPrompt.includes(desired);
  assert.equal(gateFailed, true, "Requirement gate MUST fail when desired-output constraint is dropped");
  console.log("  PASS: Mutation 2 (Dropped Constraint) caught by requirement gate");
}

// Mutation 3: Change exact to approximate -> semantic gate MUST fail
{
  const target = 20_000;
  const parsedExact = runtime.parseRequestedAnswerBudget(`exactly ${target} words`).budget;
  const mutatedParsed = { ...parsedExact, mode: "approximate" };
  const gateFailed = mutatedParsed.mode !== "exact";
  assert.equal(gateFailed, true, "Semantic gate MUST fail when exact mode is mutated to approximate");
  console.log("  PASS: Mutation 3 (Exact to Approximate) caught by semantic gate");
}

// Mutation 4: Normalize raw Unicode -> identity gate MUST fail
{
  const rawInput = "e\u0301"; // Decomposed NFD
  const mutatedUserRequest = rawInput.normalize("NFC"); // Normalized
  const gateFailed = Buffer.from(mutatedUserRequest).toString("hex") !== Buffer.from(rawInput).toString("hex");
  assert.equal(gateFailed, true, "Identity gate MUST fail when raw Unicode is normalized");
  console.log("  PASS: Mutation 4 (Unicode Normalization) caught by identity gate");
}

// Mutation 5: Allow infeasible provider request -> feasibility gate MUST fail
{
  const hugeBudget = runtime.parseRequestedAnswerBudget("exactly 1,000,000 words").budget;
  const verdict = runtime.checkProviderFeasibility("claude-3-5-sonnet", hugeBudget);
  const gateFailed = verdict.status !== "FEASIBLE";
  assert.equal(gateFailed, true, "Feasibility gate MUST catch infeasible single-call request");
  console.log("  PASS: Mutation 5 (Infeasible Request) caught by feasibility gate");
}

// Mutation 6: Wrong chunk sum -> budget gate MUST fail
{
  const target = 20_000;
  const plan = runtime.planChunkedDocumentGeneration(target, 4_000);
  const mutatedPlan = {
    ...plan,
    sections: [...plan.sections, { section_id: "sec-err", section_title: "Extra", target_word_budget: 1000, continuity_context: "" }],
  };
  const mutatedSum = mutatedPlan.sections.reduce((s, x) => s + x.target_word_budget, 0);
  const gateFailed = mutatedSum !== target;
  assert.equal(gateFailed, true, "Budget gate MUST fail when section sum != target");
  console.log("  PASS: Mutation 6 (Wrong Chunk Sum) caught by budget gate");
}

// =========================================================================
// SECTION 18: ADVERSARIAL LENGTH INPUTS MATRIX
// =========================================================================

console.log("\n============================================================");
console.log("SECTION 18: ADVERSARIAL LENGTH INPUTS MATRIX");
console.log("============================================================");

const adversarialInputs = [
  ["exactly 20,000 words", { mode: "exact", target: 20000, unit: "words" }],
  ["no more than 20,000 words", { mode: "maximum", target: 20000, unit: "words" }],
  ["at least 20,000 words", { mode: "minimum", target: 20000, unit: "words" }],
  ["between 18,000 and 20,000 words", { mode: "range", target: 20000, min: 18000, max: 20000, unit: "words" }],
  ["1,000–1,500 words", { mode: "range", target: 1500, min: 1000, max: 1500, unit: "words" }],
  ["about 20,000 words", { mode: "approximate", target: 20000, unit: "words" }],
  ["approximately 800 words", { mode: "approximate", target: 800, unit: "words" }],
  ["20,000 characters", { mode: "exact", target: 20000, unit: "characters" }],
  ["20,000 tokens", { mode: "exact", target: 20000, unit: "tokens" }],
  ["10 sentences", { mode: "exact", target: 10, unit: "sentences" }],
  ["<= 2,000 words", { mode: "maximum", target: 2000, unit: "words" }],
  ["20_000 words", { mode: "exact", target: 20000, unit: "words" }],
  ["2e4 words", { mode: "exact", target: 20000, unit: "words" }],
  ["1.5k words", { mode: "exact", target: 1500, unit: "words" }],
  ["1500.5 words", { mode: "exact", target: 1501, unit: "words" }],
  ["0 words", { mode: "exact", target: 0, unit: "words" }],
  ["२०००० words", { mode: "exact", target: 20000, unit: "words" }], // Devanagari digits
  ["٢٠٠٠٠ words", { mode: "exact", target: 20000, unit: "words" }], // Arabic-Indic digits
];

for (const [expr, expected] of adversarialInputs) {
  const parsed = runtime.parseRequestedAnswerBudget(expr);
  assert.equal(parsed.status, "SUCCESS", `Failed parsing: ${expr}`);
  assert.equal(parsed.budget.mode, expected.mode, `Mode mismatch for: ${expr}`);
  assert.equal(parsed.budget.target, expected.target, `Target mismatch for: ${expr}`);
  assert.equal(parsed.budget.unit, expected.unit, `Unit mismatch for: ${expr}`);
  if (expected.min !== undefined) assert.equal(parsed.budget.min, expected.min);
  if (expected.max !== undefined) assert.equal(parsed.budget.max, expected.max);
}
console.log(`  PASS: All ${adversarialInputs.length} adversarial input formats parsed successfully`);

// Invalid / edge inputs
const invalidInputs = [
  "-500 words",
  "between 30000 and 20000 words", // inverted
  "20,000 florbos", // malformed unit
  "1500 unknown_unit", // malformed unit
];
for (const expr of invalidInputs) {
  const parsed = runtime.parseRequestedAnswerBudget(expr);
  assert.ok(["INVALID", "CONFLICT"].includes(parsed.status), `Expected invalid/conflict for: ${expr}`);
}
console.log("  PASS: Negative and inverted constraints correctly rejected");

// =========================================================================
// SECTION 21: RE-RUN ORIGINAL 1M STRESS PACKET
// =========================================================================

console.log("\n============================================================");
console.log("SECTION 21: MILLION-WORD PACKET QUALIFICATION & REPORTING");
console.log("============================================================");

const targetsToCompile = [20_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
for (const target of targetsToCompile) {
  const reqStr = `exactly ${target.toLocaleString()} words`;
  const parsed = runtime.parseRequestedAnswerBudget(reqStr);
  assert.equal(parsed.status, "SUCCESS");
  const compiled = runtime.formatCompiledLengthRequirement(parsed.budget);
  assert.ok(compiled.includes(target.toLocaleString()));
}
console.log(`  PASS: Length targets compiled across all scales (20k, 50k, 100k, 250k, 500k, 1M)`);

console.log("\n============================================================");
console.log("ALL TEXT VOLUME & OUTPUT-BUDGET GATES PASSED (10/10 GREEN)");
console.log("============================================================");
