# SPE Ω — Global Hero Intelligence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an autonomous, research-backed system that continuously researches, generates, validates, and evidence-gates plain-English hero headlines, supporting copy, and CTAs nightly (02:17 AM IST), enforcing the strict invariant that forced nightly publication is forbidden and new copy is published only when qualified through Always Valid Inference (AVI) without ever making ungrounded claims.

**Architecture:** Two-Clock decoupled architecture separating Clock A (Nightly Research & Generation with semantic promise contract and ISO 24495-1 plain-English validation) from Clock B (Evidence-Gated Publication using 2025 Marketing Science LOLA and mixture-martingale sequential testing with SRM safety stops). Zero external network calls; 100% offline WebAssembly and client-side execution ($0.00 spend).

**Tech Stack:** TypeScript, React, WebAssembly, Always Valid Inference (e-values/martingales), Flesch-Kincaid / ISO 24495-1 NLP heuristics, Node.js 24 ESM, Python 3.12 / pytest parity.

---

### Task 1: Canonical Product-Promise Contract & Surface Inventory

**Files:**
- Create: `apps/web/src/engine/heroIntelligence/productPromiseContract.ts`
- Create: `apps/web/src/engine/heroIntelligence/surfaceInventory.ts`
- Test: `apps/web/scripts/test-global-hero-intelligence.mjs`

**Step 1: Write the failing test for promise contract and surface inventory**
Test that any headline implying ungrounded capabilities (e.g. "Run Claude 4.5 in your browser without API keys") or using forbidden buzzwords ("supercharge", "revolutionary", "limitless") is rejected with defined violation codes, while grounded capabilities ("100% on-device WebAssembly", "Stop AI agent regressions") pass with grounding score = 1.0. Also test that surface inventory assigns strict constraints (`LOCKED`, `LEGAL_PROTECTED`, `SEO_PROTECTED`, `DYNAMIC_CANDIDATE`, `EXPERIMENT_ELIGIBLE`).

**Step 2: Run test to verify it fails**
Run: `node apps/web/scripts/test-global-hero-intelligence.mjs`
Expected: FAIL (module not found).

**Step 3: Implement `productPromiseContract.ts` and `surfaceInventory.ts`**
Define `SHIPPED_CAPABILITIES`, `FORBIDDEN_PROMISES`, `BANNED_BUZZWORDS`, `verifyCopyAgainstPromiseContract()`, and surface inventory schema.

**Step 4: Run test to verify it passes**
Run: `node apps/web/scripts/test-global-hero-intelligence.mjs`
Expected: PASS.

**Step 5: Commit**
`git add apps/web/src/engine/heroIntelligence/productPromiseContract.ts apps/web/src/engine/heroIntelligence/surfaceInventory.ts`

---

### Task 2: Promise-Preserving Headline Generator & Semantic Verifier

**Files:**
- Create: `apps/web/src/engine/heroIntelligence/semanticPromiseVerifier.ts`
- Create: `apps/web/src/engine/heroIntelligence/headlineGenerator.ts`

**Step 1: Write test for generator and verifier**
Add tests for 12 distinct communication strategies (Action-Oriented, Problem/Solution, Before/After, Simplicity, Privacy, Portability, Builder, Speed, Transparency, Cost-Awareness, Creative, Invariant-Reliability). Verify that all generated copy is factually grounded and passes the promise contract.

**Step 2: Run test to verify it fails**
Run: `node apps/web/scripts/test-global-hero-intelligence.mjs`

**Step 3: Implement `semanticPromiseVerifier.ts` and `headlineGenerator.ts`**
Implement deterministic generation across the 12 strategies, binding each candidate to concrete capability keys and computing semantic grounding scores.

**Step 4: Run test to verify it passes**
Run: `node apps/web/scripts/test-global-hero-intelligence.mjs`
Expected: PASS.

**Step 5: Commit**
`git add apps/web/src/engine/heroIntelligence/semanticPromiseVerifier.ts apps/web/src/engine/heroIntelligence/headlineGenerator.ts`

---

### Task 3: Plain-English & Global Comprehension Validator

**Files:**
- Create: `apps/web/src/engine/heroIntelligence/comprehensionValidator.ts`

**Step 1: Write tests for ISO 24495-1 plain language and global accessibility**
Add tests for Flesch-Kincaid Grade Level $\le 8.5$, Flesch Reading Ease $\ge 60$, detection of American idioms/slang ("silver bullet", "hit the ground running", "under the hood"), and mobile viewport line-wrap safety (375px display width).

**Step 2: Run test to verify it fails**
Run: `node apps/web/scripts/test-global-hero-intelligence.mjs`

**Step 3: Implement `comprehensionValidator.ts`**
Implement syllable counting, grade scoring, idiom dictionary checks, and mobile wrapping length heuristics.

**Step 4: Run test to verify it passes**
Run: `node apps/web/scripts/test-global-hero-intelligence.mjs`
Expected: PASS.

**Step 5: Commit**
`git add apps/web/src/engine/heroIntelligence/comprehensionValidator.ts`

---

### Task 4: Evidence-Gated Experiment Engine & Two-Clock State Machine

**Files:**
- Create: `apps/web/src/engine/heroIntelligence/heroExperimentEngine.ts`
- Create: `apps/web/src/engine/heroIntelligence/index.ts`
- Create: `apps/web/scripts/nightly-hero-sync.mjs`

**Step 1: Write tests for Two-Clock state machine and Always Valid Inference (AVI)**
Test:
1. Clock A generates and enqueues valid candidates.
2. Clock B refuses to publish when sample size $< 200$ or duration $< 72$h.
3. Clock B detects Sample Ratio Mismatch (SRM) ($\chi^2$ test $p < 0.001$) and aborts experiment.
4. Clock B halts and rolls back if candidate bounce rate exceeds control by $> 5\%$.
5. Clock B only promotes when e-value exceeds hurdle ($\ge 20$), otherwise retains existing copy.
6. The strict invariant "FORCED NIGHTLY PUBLICATION IS FORBIDDEN" is mathematically upheld.

**Step 2: Run test to verify it fails**
Run: `node apps/web/scripts/test-global-hero-intelligence.mjs`

**Step 3: Implement `heroExperimentEngine.ts`, `index.ts`, and `nightly-hero-sync.mjs`**
Implement mixture martingale / e-value sequential probability ratio test, SRM check, safety boundaries, state transitions, and CLI runner.

**Step 4: Run test to verify it passes**
Run: `node apps/web/scripts/test-global-hero-intelligence.mjs`
Expected: PASS.

**Step 5: Commit**
`git add apps/web/src/engine/heroIntelligence/ apps/web/scripts/nightly-hero-sync.mjs`

---

### Task 5: Content Owner Integration & Landing Surface Wiring

**Files:**
- Modify: `packages/human-perspective/src/copy.ts`
- Modify: `apps/web/src/landing/useDailyHero.ts`
- Modify: `apps/web/src/landing/Hero.tsx`

**Step 1: Wire `useDailyHero` with `heroExperimentEngine`**
Integrate `getActiveHeroCopy()` so that when an experiment is active, users receive the assigned arm (A or B) deterministically or fallback to the daily reviewed headlines without any visual flicker, CLS, or layout shift.

**Step 2: Verify copy check and type check**
Run: `node tools/copy-inventory.mjs`
Update `tests/copy/reviewed-inventory.json` if needed.
Run: `npm --prefix apps/web run spe:copy-check`
Run: `npx tsc --noEmit`

**Step 3: Commit**
`git add packages/human-perspective/src/copy.ts apps/web/src/landing/useDailyHero.ts apps/web/src/landing/Hero.tsx`

---

### Task 6: Python Parity Kernel & Test Suite

**Files:**
- Create: `spe_runtime/governance/hero_intelligence.py`
- Create: `tests/unit/test_hero_intelligence.py`

**Step 1: Write Python pytest test suite**
Test promise contract verification, ISO plain-language heuristics, AVI e-value calculations, and SRM detection in Python.

**Step 2: Run pytest to verify it fails**
Run: `./.venv/bin/pytest tests/unit/test_hero_intelligence.py`

**Step 3: Implement `hero_intelligence.py`**
Implement identical validation, promise verification, and sequential test mathematics in Python.

**Step 4: Run pytest to verify it passes**
Run: `./.venv/bin/pytest tests/unit/test_hero_intelligence.py`
Expected: All tests PASS.

**Step 5: Commit**
`git add spe_runtime/governance/hero_intelligence.py tests/unit/test_hero_intelligence.py`

---

### Task 7: Interactive Verification Artifact & Final Quality Gates

**Files:**
- Create: Artifact `spe_global_hero_intelligence_preview.html`
- Verify: Full test battery, WASM hash invariance, clean build, git push.

**Step 1: Build interactive HTML preview**
Visual demonstration of the Two-Clock state machine, 12 communication strategies, real-time promise verifier, and sequential AVI e-value experiment dashboard.

**Step 2: Execute all quality gates**
1. WASM hash invariant: `shasum -a 256 packages/web-runtime/src/spe_core.wasm` must match `ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d`.
2. Language Perspective Gate: `npm --prefix apps/web run spe:copy-check` (0 violations).
3. TypeScript compiler: `npx tsc --noEmit` (0 errors).
4. Vite build: `npm --prefix apps/web run build` (clean build).
5. JS test suite: `node apps/web/scripts/test-global-hero-intelligence.mjs`.
6. Python test suite: `./.venv/bin/pytest tests/unit/test_hero_intelligence.py`.

**Step 3: Git commit & push**
Push to `origin/feature/p0-b-user-confirmed-requirements`.
