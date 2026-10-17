#!/usr/bin/env node
/**
 * Test Suite for SPE Ω — Global Hero Intelligence (Promise-Preserving Copy Evolution)
 * Verifies:
 * 1. Canonical Product-Promise Contract & Surface Inventory
 * 2. Promise-Preserving Headline Generator & Semantic Verifier
 * 3. ISO 24495-1 Plain-English & Global Comprehension Validator
 * 4. Evidence-Gated Experiment Engine & Always Valid Inference (AVI)
 * 5. Invariant: FORCED NIGHTLY PUBLICATION IS FORBIDDEN (Evidence hurdle retention)
 */

import assert from "node:assert/strict";

console.log("══════════════════════════════════════════════════════════════════════════");
console.log("🧠 SPE Ω — GLOBAL HERO INTELLIGENCE VERIFICATION BATTERY");
console.log("   Mandate: Promise-Preserving Copy Evolution · Always Valid Inference");
console.log("══════════════════════════════════════════════════════════════════════════\n");

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function run() {
  // ─── PART 1: PRODUCT-PROMISE CONTRACT & SURFACE INVENTORY ────────────────
  const {
    SHIPPED_CAPABILITIES,
    FORBIDDEN_PROMISES,
    BANNED_BUZZWORDS,
    verifyCopyAgainstPromiseContract,
  } = await import("../src/engine/heroIntelligence/productPromiseContract.ts");

  const {
    SURFACE_INVENTORY,
    getSurfaceConstraints,
  } = await import("../src/engine/heroIntelligence/surfaceInventory.ts");

  test("1.1: Shipped capabilities registry contains verified core capabilities", () => {
    assert.ok(SHIPPED_CAPABILITIES.BROWSER_WASM_COMPILATION, "WASM compilation must be present");
    assert.ok(SHIPPED_CAPABILITIES.AIR_GAP_ZERO_EGRESS, "Air gap zero egress must be present");
    assert.ok(SHIPPED_CAPABILITIES.INVARIANT_GUARDRAILS, "Invariant guardrails must be present");
    assert.ok(SHIPPED_CAPABILITIES.CONFLICT_DETECTION, "Conflict detection must be present");
    assert.ok(SHIPPED_CAPABILITIES.MULTI_AGENT_PORTABILITY, "Multi-agent portability must be present");
    assert.ok(SHIPPED_CAPABILITIES.ZERO_COMPUTE_COST, "Zero compute cost must be present");
  });

  test("1.2: Promise verifier rejects ungrounded capability claims", () => {
    const ungrounded = verifyCopyAgainstPromiseContract({
      headline: "Run Claude 4.5 and GPT-5 inside your browser without API keys",
      support: "Our neural network weights are loaded locally into WebAssembly.",
      cta: "Generate Free AI Output",
    });
    assert.equal(ungrounded.valid, false);
    assert.ok(
      ungrounded.violations.some((v) => v.code === "ERR_UNSHIPPED_CAPABILITY"),
      "Must flag unshipped capability",
    );
  });

  test("1.3: Promise verifier rejects forbidden marketing buzzwords and slop", () => {
    const buzzword = verifyCopyAgainstPromiseContract({
      headline: "Supercharge your workflow with revolutionary magic prompts",
      support: "Unleash limitless AI possibilities with our game-changing engine.",
      cta: "Get Superhuman AI",
    });
    assert.equal(buzzword.valid, false);
    assert.ok(
      buzzword.violations.some((v) => v.code === "ERR_FORBIDDEN_BUZZWORD"),
      "Must flag forbidden buzzwords",
    );
  });

  test("1.4: Grounded and verified product promises pass with score 1.0", () => {
    const grounded = verifyCopyAgainstPromiseContract({
      headline: "Turn rough ideas into structured prompts for any AI.",
      support: "100% on-device WebAssembly compiler. Zero prompt bytes leave your machine.",
      cta: "Make my prompt",
    });
    assert.equal(grounded.valid, true);
    assert.equal(grounded.violations.length, 0);
    assert.equal(grounded.groundingScore, 1.0);
    assert.ok(grounded.verifiedClaims.length >= 2);
  });

  test("1.5: Surface inventory enforces immutability on locked and legal surfaces", () => {
    const legal = getSurfaceConstraints("LEGAL_PRIVACY_TERMS");
    assert.equal(legal.classification, "LOCKED");
    assert.equal(legal.experimentEligible, false);

    const seo = getSurfaceConstraints("GLOBAL_PAGE_TITLE");
    assert.equal(seo.classification, "SEO_PROTECTED");
    assert.equal(seo.experimentEligible, false);

    const hero = getSurfaceConstraints("HERO_HEADLINE");
    assert.equal(hero.classification, "DYNAMIC_CANDIDATE");
    assert.equal(hero.experimentEligible, true);
    assert.ok(hero.maxCharsPerLine <= 45);
  });

  // ─── PART 2: PROMISE-PRESERVING HEADLINE GENERATOR & SEMANTIC VERIFIER ───
  const {
    COMMUNICATION_STRATEGIES,
    generateCandidateVariants,
  } = await import("../src/engine/heroIntelligence/headlineGenerator.ts");

  const {
    verifyCandidateCopy,
  } = await import("../src/engine/heroIntelligence/semanticPromiseVerifier.ts");

  test("2.1: Generator produces candidates across 12 distinct communication strategies", () => {
    const candidates = generateCandidateVariants();
    assert.equal(candidates.length, 12, "Must generate exactly 12 candidate strategies");
    const strategyKeys = candidates.map((c) => c.strategy);
    for (const strat of Object.keys(COMMUNICATION_STRATEGIES)) {
      assert.ok(strategyKeys.includes(strat), `Strategy ${strat} must be generated`);
    }
  });

  test("2.2: All 12 generated candidates pass semantic promise verification", () => {
    const candidates = generateCandidateVariants();
    for (const c of candidates) {
      const result = verifyCandidateCopy(c);
      assert.ok(result.valid, `Candidate for ${c.strategy} must be valid: ${result.violations.join(", ")}`);
      assert.equal(result.groundingScore, 1.0, `Grounding score must be 1.0 for ${c.strategy}`);
    }
  });

  // ─── PART 3: ISO 24495-1 PLAIN-ENGLISH & GLOBAL COMPREHENSION VALIDATOR ──
  const {
    validateComprehension,
  } = await import("../src/engine/heroIntelligence/comprehensionValidator.ts");

  test("3.1: Comprehension validator enforces readability grade <= 8.5 and ease >= 60", () => {
    const good = validateComprehension({
      title: "Your idea.",
      accent: "A clear prompt.",
      support: "Turn rough notes into clear instructions for AI. Everything runs on your device.",
    });
    assert.ok(good.passed, `Plain English must pass: ${good.issues.join(", ")}`);
    assert.ok(good.fleschGrade <= 8.5, `Grade ${good.fleschGrade} should be <= 8.5`);
    assert.ok(good.readingEase >= 60, `Ease ${good.readingEase} should be >= 60`);
  });

  test("3.2: Comprehension validator flags confusing idioms and colloquialisms", () => {
    const idiomCopy = validateComprehension({
      title: "Hit the ground running.",
      accent: "There is no silver bullet.",
      support: "Touch base under the hood with a ballpark figure for your AI stack.",
    });
    assert.equal(idiomCopy.passed, false);
    assert.ok(idiomCopy.idiomsDetected.length >= 2, "Must detect idioms");
    assert.ok(idiomCopy.issues.some((i) => i.includes("Idiom detected")));
  });

  test("3.3: Comprehension validator flags mobile line-overflow risks", () => {
    const longLine = validateComprehension({
      title: "Supercalifragilisticexpialidociousunbrokenmonolithicwordthatwillbreakmobile",
      accent: "Another extremely long line without natural spaces or line wrap points",
      support: "Short support text.",
    });
    assert.equal(longLine.overflowRisk, true);
    assert.equal(longLine.passed, false);
  });

  // ─── PART 4: EVIDENCE-GATED EXPERIMENT ENGINE & ALWAYS VALID INFERENCE ───
  const {
    HeroExperimentEngine,
    AlwaysValidInference,
  } = await import("../src/engine/heroIntelligence/heroExperimentEngine.ts");

  test("4.1: Always Valid Inference computes martingale e-values without peeking bias", () => {
    const avi = new AlwaysValidInference();
    // Neutral data: 50 conversions in 500 exposures for A, 51 in 500 for B
    const neutralE = avi.calculateEValue({
      control: { exposures: 500, conversions: 50 },
      treatment: { exposures: 500, conversions: 51 },
    });
    assert.ok(neutralE.eValue < 20, "Neutral result must not cross qualification hurdle of 20");
    assert.equal(neutralE.qualified, false);

    // Strong genuine lift: 50/1000 (5%) vs 95/1000 (9.5%)
    const strongE = avi.calculateEValue({
      control: { exposures: 1000, conversions: 50 },
      treatment: { exposures: 1000, conversions: 95 },
    });
    assert.ok(strongE.eValue >= 20, `Strong lift must exceed hurdle: eValue=${strongE.eValue}`);
    assert.equal(strongE.qualified, true);
  });

  test("4.2: Sample Ratio Mismatch (SRM) detection flags corrupted traffic allocation", () => {
    const avi = new AlwaysValidInference();
    // Severe SRM: expected 50/50, observed 800 vs 200
    const srm = avi.checkSampleRatioMismatch(800, 200, 0.5);
    assert.equal(srm.hasMismatch, true, "Should flag severe traffic imbalance");
    assert.ok(srm.pValue < 0.001, "p-value must be < 0.001");

    // Balanced: 505 vs 495
    const balanced = avi.checkSampleRatioMismatch(505, 495, 0.5);
    assert.equal(balanced.hasMismatch, false);
    assert.ok(balanced.pValue > 0.05);
  });

  test("4.3: Strict Invariant: Forced nightly publication is forbidden (Copy is retained on insufficient evidence)", () => {
    const engine = new HeroExperimentEngine({
      baseline: {
        title: "Your idea.",
        accent: "A clear prompt.",
        support: "Turn rough notes into clear instructions for AI. Everything runs on your device.",
        cta: "Make my prompt",
      },
    });

    // Enqueue candidate
    const candidate = {
      title: "Clear prompts.",
      accent: "No guesswork.",
      support: "Turn rough notes into structured prompts for any AI. 100% on-device.",
      cta: "Build my prompt",
      strategy: "SIMPLICITY_FOCUS",
    };

    engine.enqueueCandidate(candidate);

    // Run Clock B with insufficient sample size (n=50 < 200)
    engine.recordObservation("control", true);
    engine.recordObservation("candidate", true);

    const adjudication = engine.adjudicateEvidence({
      durationHours: 24, // < 72h
    });

    assert.equal(adjudication.action, "RETAIN_EXISTING");
    assert.equal(adjudication.copyPublished, false);
    assert.ok(adjudication.reason.includes("Insufficient sample size") || adjudication.reason.includes("duration"));
    assert.equal(engine.getActiveHeadline().title, "Your idea.");
  });

  test("4.4: Candidate is promoted ONLY when meeting all statistical and safety gates", () => {
    const engine = new HeroExperimentEngine({
      baseline: {
        title: "Your idea.",
        accent: "A clear prompt.",
        support: "Turn rough notes into clear instructions for AI. Everything runs on your device.",
        cta: "Make my prompt",
      },
    });

    const candidate = {
      title: "Stop AI agents",
      accent: "from guessing.",
      support: "Lock your boundaries before your coding agent hallucinates. Free and local.",
      cta: "Protect my prompt",
      strategy: "PROBLEM_SOLUTION",
    };

    engine.enqueueCandidate(candidate);

    // Simulate 1000 exposures with statistically significant lift
    for (let i = 0; i < 1000; i++) {
      engine.recordObservation("control", i < 50); // 5.0%
      engine.recordObservation("candidate", i < 95); // 9.5%
    }

    const adjudication = engine.adjudicateEvidence({
      durationHours: 96, // > 72h
    });

    assert.equal(adjudication.action, "PROMOTE_CANDIDATE");
    assert.equal(adjudication.copyPublished, true);
    assert.equal(engine.getActiveHeadline().title, "Stop AI agents");
  });

  test("4.5: Safety stop immediately halts and rolls back if bounce rate increases", () => {
    const engine = new HeroExperimentEngine({
      baseline: {
        title: "Your idea.",
        accent: "A clear prompt.",
        support: "Turn rough notes into clear instructions for AI. Everything runs on your device.",
        cta: "Make my prompt",
      },
    });

    const candidate = {
      title: "Experimental copy",
      accent: "that users dislike.",
      support: "Testing negative reaction.",
      cta: "Try it",
      strategy: "ACTION_ORIENTED",
    };

    engine.enqueueCandidate(candidate);

    // Record high bounces on candidate
    for (let i = 0; i < 300; i++) {
      engine.recordBounce("control", i < 60); // 20% bounce
      engine.recordBounce("candidate", i < 120); // 40% bounce (+20% delta > +5% threshold)
    }

    const adjudication = engine.adjudicateEvidence({
      durationHours: 75,
    });

    assert.equal(adjudication.action, "SAFETY_STOP_ROLLBACK");
    assert.equal(adjudication.copyPublished, false);
    assert.equal(engine.getActiveHeadline().title, "Your idea.");
  });

  console.log(`\n══════════════════════════════════════════════════════════════════════════`);
  console.log(`🎯 SCORECARD: ${passed} / ${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`══════════════════════════════════════════════════════════════════════════\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
