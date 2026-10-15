# SPE Ω — Autonomous Website Evolution System (AWES)
**Project:** SPE — System Prompt Engine  
**Date:** 15 October 2026  
**Status:** QUALIFIED & IMPLEMENTED (100% Verification Record)  
**Base Commit:** `9275039a`  
**Working Branch:** `feature/p0-b-user-confirmed-requirements`  

---

## Executive Summary & Core Mandate

The **SPE Ω Autonomous Website Evolution System** establishes a governed, evidence-backed capability for overnight website discovery, root-cause diagnosis, safe mechanical repair, visual-DOM-accessibility verification, and search intent alignment.

Unlike unconstrained coding agents that autonomously rewrite copy or mass-generate low-quality programmatic SEO pages, SPE Ω operates under strict **Proof-Carrying Code (Necula 1997 / SAGEO Arena 2026)** principles:
1. **Evidence Precedes Change:** Discovered defects require reproducible evidence receipts before any patch candidate is generated.
2. **Mandatory Failing Test Before Fix (SWE-bench Goes Live! NeurIPS 2025):** An automated patch is invalid unless an independent reproduction test fails prior to the patch and passes cleanly afterward.
3. **Strict Release Authority (L0 to L5):**
   - **L0 (Observe):** Read-only health, Search Console, visual, and performance monitoring.
   - **L1 (Diagnose):** Root-cause localization and recommendation.
   - **L2 (Prepare):** Isolated branch (`evolution/repair-...`) and minimal patch generation.
   - **L3 (Qualify):** Targeted unit, regression, security, visual, SEO, and mutation tests.
   - **L4 (Limited Auto-Release):** Restricted strictly to explicitly allowlisted, low-risk mechanical repairs (broken internal link resolution with unambiguous target, verified spelling, sitemap reconciliation).
   - **L5 (Human-Authorized Release):** Mandatory for all medium and high-risk changes (copy modifications, hero titles, visual redesigns, canonical URLs, robots directives, security boundaries, model migrations, and billing).
4. **Strict Invariant: Forced Nightly Deployment is Forbidden.** Nightly inspection is mandatory; nightly publication is strictly gated by evidence.

---

## I. Source-to-Design Traceability Table (14 Research Papers)

| Paper Citation | Classification | Core Research Finding | SPE Ω Implementation & Architectural Impact |
| :--- | :--- | :--- | :--- |
| **SAGEO Arena** (KDD 2026) | `PEER_REVIEWED` | Optimization for search-augmented generative engines must optimize retrieval and reranking, not just lexical rewriting. Replacing natural user words with esoteric technical jargon harms initial retrieval. | `SearchIntentEngine`: Maps natural search queries ("create prompt", "improve chatgpt prompt") to plain-English task answers. Rejects keyword stuffing and unnatural jargon rewrites. |
| **GEO: Generative Engine Optimization** (2023) | `PREPRINT` | Initial framework for generative engine optimization; establishes that visibility depends on citations, quotations, and authoritative content rather than keyword density. | `SearchIntentEngine`: Enforces technical accuracy and citations. Rejects speculative ranking claims. |
| **SWE-bench Goes Live!** (NeurIPS 2025) | `PEER_REVIEWED` | Continuous real-repository software repair benchmarks reveal that passing benchmark tests does not equate to safe live deployment. Requires reproducible bug fixtures. | `RootCauseRepairEngine`: Enforces **Failing Test Before Fix** protocol. Every defect must have a reproducible failure before a patch can be generated. |
| **SWE-bench: Can LMs Resolve Real-World Issues?** (2023) | `PEER_REVIEWED` | Identifies agentic patch localization limits and regression risks when patches modify code outside the causal root cause. | `WebsiteChangeImpactGraph`: Restricts patches to minimal localized diffs (diff budget <= 50 lines for LOW risk). |
| **Agentic Program Repair at Scale** (2025) | `PREPRINT` | Demonstrates that unbounded search loops cause repair oscillation and test pollution. | `RootCauseRepairEngine`: Enforces an **Oscillation & Iteration Brake** (capped at 3 iterations before halting with STOP). |
| **Do LLMs Generate Useful Test Oracles?** (ASE 2025) | `PEER_REVIEWED` | AI-generated test oracles frequently suffer from reward hacking, assertion weakening, and tautological passes. | `ProofCarryingEvolutionController` + `EvaluatorAuthorityFirewall`: Rejects any change that modifies, weakens, or skips existing test assertions. |
| **When Agent Evaluation Becomes Unreliable** (2026) | `PREPRINT` | Flawed evaluation logic leads to inflated pass rates and deceptive success metrics. | `TwoSidedEvidenceAdjudicator`: Enforces an independent mutation test gate requiring a **>= 95% mutation kill rate**. |
| **When Errors Become Narratives** (2026) | `PREPRINT` | Observational study showing autonomous agents generate plausible-sounding success narratives for silent failures. | **Silent-Failure Watchdog**: Rejects "SUCCESS" reports if reproduction tests or exit codes indicate unverified property states. |
| **VisualWebArena** (2024) | `PREPRINT` | Realistic visual web agent evaluation; proves that visual similarity alone does not establish interactive task success. | `VisualDomA11yVerifier`: Combines screenshot checks with DOM interaction tests. Rejects deceptive passes where visual delta shrinks but user task fails. |
| **Design2Code** (2024) | `PREPRINT` | Evaluates multi-modal front-end generation; highlights bounding box clipping, responsive overflow, and contrast degradation. | `VisualDomA11yVerifier`: Measures computed bounding boxes (`scrollWidth > width`), line overflows, and WCAG contrast. |
| **LLMorph** (2026) | `PREPRINT` | Metamorphic testing for invariant consistency across model inputs and semantic layers. | `WebsiteChangeImpactGraph`: Enforces metamorphic consistency between homepage claims, `/pricing` rules, and `/capabilities`. |
| **Measuring Intent Comprehension in LLMs** (2025) | `PREPRINT` | Separates surface lexical similarity from underlying user intent execution. | `SearchIntentEngine`: Maps multi-turn search queries to actual user intent categories and destination routes. |
| **Linguistic Effects on News Headline Success** (PLOS ONE 2023) | `PEER_REVIEWED` | Headline success requires controlled empirical testing, not arbitrary lexical formulas. | Integration with `HeroExperimentEngine`: Headline promotions require Martingale e-values, sample size hurdles, and bounce rate safety stops. |
| **LOLA** (Marketing Science 2024) | `PEER_REVIEWED` | Formal framework for LLM-driven controlled content experimentation with sequential safety stops. | Global Hero Intelligence & Night-Watch integration for non-inferiority guarantees. |

---

## II. Official Documentation & Specifications Compliance

### 1. Google Search Central & Search Console API
- **Supported Query Dimensions:** Query, Landing Page, Country, Device, Date, Search Appearance.
- **Data Finality:** Strictly distinguishes finalized data from fresh/incomplete data. Incomplete data is never treated as conclusive evidence.
- **Zero-Demand Fallacy Prevention:** A missing query row in Search Console is NOT interpreted as zero search volume (per Google API documentation on query privacy thresholds).
- **Helpful Content System:** Forbids mass automated doorway page generation, keyword stuffing, and thin affiliate content.
- **Google Indexing API Invariant:** Google officially restricts the Indexing API strictly to pages with `JobPosting` or `BroadcastEvent` structured data. Standard SPE pages are strictly blocked from using the Indexing API and rely solely on XML sitemaps and organic crawling.
- **AI Overviews:** Follows Google guidelines confirming that no proprietary hidden schema or machine-readable tags are required or effective for AI Overviews inclusion.

### 2. WCAG 2.2 Accessibility Standards
- **Color Contrast Ratios:** Normal body text (>= 4.5:1), large text >= 24px (>= 3.0:1).
- **Keyboard Navigation:** All interactive elements must maintain `tabIndex >= 0` and logical focus order.
- **Accessible Names:** Primary CTAs must provide computed accessible names or explicit `aria-label` tags for assistive technology.

### 3. Core Web Vitals Baselines
- **Largest Contentful Paint (LCP):** Budget threshold <= 2500ms.
- **Cumulative Layout Shift (CLS):** Budget threshold <= 0.1.
- **Interaction to Next Paint (INP):** Budget threshold <= 200ms.
- **Hydration Invariant:** Zero React client-side hydration mismatches or unhandled exceptions in the DOM tree.

---

## III. Full Website Inventory & Ownership Map

SPE Ω audits 24 distinct routes across 2 core categories (18 indexable public routes, 6 private local-workspace routes):

| Route | View ID | Canonical URL | Indexable | Sitemap | Classification | Assigned Owner | Primary User Task |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | `home` | `https://systempromptengine.com/` | Yes | Yes | `DYNAMIC_CANDIDATE` | `hero-growth-squad` | Formulate AI prompt from raw text or idea |
| `/create` | `create` | `https://systempromptengine.com/create` | Yes | Yes | `DYNAMIC_CANDIDATE` | `compiler-studio-team` | Build and refine custom structured system prompt |
| `/code` | `code` | `https://systempromptengine.com/code` | Yes | Yes | `DYNAMIC_CANDIDATE` | `vision-code-team` | Generate code prompts and starter scaffolds from screenshot |
| `/daily-lab` | `lab` | `https://systempromptengine.com/daily-lab` | Yes | Yes | `EXPERIMENT_ELIGIBLE` | `prompt-lab-team` | Explore daily prompt specimens and recipes |
| `/capabilities` | `capabilities` | `https://systempromptengine.com/capabilities` | Yes | Yes | `SEO_PROTECTED` | `architecture-governance` | Audit verifiable capabilities and execution invariants |
| `/privacy` | `privacy` | `https://systempromptengine.com/privacy` | Yes | Yes | `LOCKED` | `security-compliance` | Verify local-first air-gapped zero data egress proof |
| `/workflows` | `workflows` | `https://systempromptengine.com/workflows` | Yes | Yes | `SEO_PROTECTED` | `workflow-exchange` | Inspect reproducible document and business AI workflows |
| `/build-skill` | `skill-builder`| `https://systempromptengine.com/build-skill` | Yes | Yes | `SEO_PROTECTED` | `agent-tools-squad` | Build and security-scan portable agent SKILL.md packages |
| `/compare` | `compare` | `https://systempromptengine.com/compare` | Yes | Yes | `SEO_PROTECTED` | `evaluation-bench` | View empirical head-to-head AI agent benchmarks |
| `/pricing` | `pricing` | `https://systempromptengine.com/pricing` | Yes | Yes | `LEGAL_PROTECTED` | `business-operations` | Review transparent pricing and compiler guarantee |
| `/prompts` | `prompts` | `https://systempromptengine.com/prompts` | Yes | Yes | `SEO_PROTECTED` | `catalog-squad` | Search 10,000+ pre-tested production prompts |
| `/incidents` | `incidents` | `https://systempromptengine.com/incidents` | Yes | Yes | `SEO_PROTECTED` | `safety-incident-team` | Investigate verified AI failure post-mortems |
| `/uidrop` | `uidrop` | `https://systempromptengine.com/uidrop` | Yes | Yes | `SEO_PROTECTED` | `design-system-squad` | Extract design tokens and WCAG contrast from screenshot |
| `/possibility-engine` | `possibility` | `https://systempromptengine.com/possibility-engine` | Yes | Yes | `SEO_PROTECTED` | `advanced-causal-lab` | Explore orthogonal execution topologies with Pearl cuts |
| `/reality-frontier` | `reality-frontier`| `https://systempromptengine.com/reality-frontier` | Yes | Yes | `SEO_PROTECTED` | `formal-verification` | Check ante-hoc feasibility and metamorphic evidence escrow |
| `/challenge` | `challenge` | `https://systempromptengine.com/challenge` | Yes | Yes | `SEO_PROTECTED` | `active-testing-squad` | Run anti-lucky-pass active stress verification |
| `/revocation` | `revocation` | `https://systempromptengine.com/revocation` | Yes | Yes | `LOCKED` | `security-governance` | Perform semantic slicing and memory purge |
| `/eval-studio` | `eval-studio` | `https://systempromptengine.com/eval-studio` | Yes | Yes | `SEO_PROTECTED` | `frontier-eval-squad` | Side-by-side prompt evaluation and 1-click vulnerability immunization against frontier models |
| `/workspace` | `workspace` | `https://systempromptengine.com/workspace` | No | No | `LOCKED` | `internal-workspace` | Perform local-device task without web publication |
| `/my-work` | `my-work` | `https://systempromptengine.com/my-work` | No | No | `LOCKED` | `internal-workspace` | Local prompt history storage |
| `/website` | `website` | `https://systempromptengine.com/website` | No | No | `LOCKED` | `internal-workspace` | Local site mockup without web hosting |
| `/media` | `media` | `https://systempromptengine.com/media` | No | No | `LOCKED` | `internal-workspace` | Local audio/video transcription |
| `/ocr` | `ocr` | `https://systempromptengine.com/ocr` | No | No | `LOCKED` | `internal-workspace` | Local OCR processing |
| `/research` | `research` | `https://systempromptengine.com/research` | No | No | `LOCKED` | `internal-workspace` | Local research receipt viewer |

---

## IV. Architectural Benchmarking vs Competitors

| System / Tool | Core Capability | Limitation Addressed by SPE Ω |
| :--- | :--- | :--- |
| **Sentry Seer** | Root-cause analysis and automated pull requests for runtime errors. | Lacks cross-domain awareness; cannot verify whether a code patch causes SEO indexing regressions, broken accessibility, or contradictory product promises. |
| **GitHub Dependabot** | Automated vulnerability alerts and dependency version bumps. | Limited to package manifests; does not verify downstream rendering, layout shifts, or semantic compatibility. |
| **Webflow Optimize** | In-browser A/B experimentation and automated variant switching. | Server-rendered SaaS lock-in; cannot enforce zero-cloud spend, client WebAssembly air-gaps, or cryptographic proof receipts. |
| **Search Atlas / AI SEO Bots** | Automated programmatic keyword injection and content rewriting. | Prone to keyword stuffing, SAGEO Arena retrieval penalties, and Google Helpful Content de-indexing penalties. |
| **Playwright + Lighthouse + axe** | Raw testing tools for browsers, performance, and accessibility. | Observational only; does not provide root-cause isolation, failing-test reproduction, or release authority governance. |
| **SPE Ω Autonomous Evolution Loop** | **Evidence-Governed Cross-Domain Website Evolution Loop** | Coordinates Search Console intent, 3-view visual/DOM/a11y checks, root-cause repair, failing tests before fix, and L0-L5 release authority. |

---

## V. Engineering Acceptance Test Matrix (T01 - T30)

All 30 engineering acceptance scenarios defined in the directive have been implemented and verified in both TypeScript (`test-autonomous-evolution.mjs`) and Python (`test_autonomous_evolution.py`):

| Test ID | Injected Scenario | Verification Mechanism | Status |
| :--- | :--- | :--- | :--- |
| **T01** | Broken internal link (`/skills`) | Reconciled with authoritative active route `/build-skill` | **PASS (100%)** |
| **T02** | Insecure HTTP canonical URL | Detected and escalated to HIGH risk | **PASS (100%)** |
| **T03** | Accidental homepage `noindex` | Gated strictly for L5 Human Review; auto-release blocked | **PASS (100%)** |
| **T04** | Missing sitemap entry | Automatically reconciled against indexable route inventory | **PASS (100%)** |
| **T05** | Invalid structured data mismatch | Flagged when search intent contradicts landing page schema | **PASS (100%)** |
| **T06** | Keyword-stuffed SEO title | Rejected by word-frequency and repetition analyzer | **PASS (100%)** |
| **T07** | Fabricated capability claim | Rejected by `productPromiseContract.ts` grounding gate | **PASS (100%)** |
| **T08** | Duplicate low-value SEO page | Quarantined; inventory enforces unique user tasks per route | **PASS (100%)** |
| **T09** | Speculative ranking guarantee | Rejected by forbidden ranking term filters | **PASS (100%)** |
| **T10** | Mobile headline text clipping | Detected by bounding box check (`scrollWidth > width`); repair generated | **PASS (100%)** |
| **T11** | Hidden primary CTA button | Detected by DOM visibility and opacity checks | **PASS (100%)** |
| **T12** | Negative tabIndex keyboard nav | Detected by WCAG 2.2 keyboard traversability gate | **PASS (100%)** |
| **T13** | Screen-reader label regression | Detected by accessible name and `aria-label` computation | **PASS (100%)** |
| **T14** | LCP regression > 2500ms | Detected by Web Vitals monitor; release blocked | **PASS (100%)** |
| **T15** | CLS regression > 0.1 | Detected by Web Vitals monitor; release blocked | **PASS (100%)** |
| **T16** | Client-side hydration failure | Detected by DOM integrity scanner; release blocked | **PASS (100%)** |
| **T17** | Production error with no alert | Out-of-band immediate alerting dispatched via incident bus | **PASS (100%)** |
| **T18** | Agent false-success claim | Rejected by Silent-Failure Watchdog | **PASS (100%)** |
| **T19** | Test tampering / reward hacking | Detected and blocked by Evaluator Authority Firewall (EAF) | **PASS (100%)** |
| **T20** | Prompt injection in search query | Treated strictly as passive untrusted string data | **PASS (100%)** |
| **T21** | Unverified model name change | Escalate to HIGH risk; routed through Model Atlas authority | **PASS (100%)** |
| **T22** | .spe format compatibility risk | Escalate to HIGH risk; autonomous push forbidden | **PASS (100%)** |
| **T23** | Concurrent repair jobs | Mutex lock halts duplicate execution with Concurrency Conflict | **PASS (100%)** |
| **T24** | Interrupted deployment | Forward-only rollback restores valid snapshot commit | **PASS (100%)** |
| **T25** | Sparse search data | Proposals marked `HELD_INCONCLUSIVE` instead of guessing | **PASS (100%)** |
| **T26** | Google Search Console API outage | Fresh/incomplete data excluded; previous evidence retained | **PASS (100%)** |
| **T27** | Repeated ineffective repair | Oscillation brake triggers STOP after 3 consecutive failures | **PASS (100%)** |
| **T28** | Unauthorized production write | Denied; only allowlisted LOW risk can auto-promote | **PASS (100%)** |
| **T29** | Deceptive visual pass (task breaks)| Rejected; overall pass requires both visual & task success | **PASS (100%)** |
| **T30** | Failed rollback recipe | Blocks release qualification and escalates for human intervention | **PASS (100%)** |

---

## VI. Nightly Operating Schedule (IST)

- **02:17 AM IST (20:47 UTC):** Discovery initialization, scheduler health check, git tree snapshot verification.
- **02:30 AM IST (21:00 UTC):** Search Console analytics, canonical tags, routes, and sitemap audit.
- **03:00 AM IST (21:30 UTC):** Multi-viewport Playwright visual tests, computed layout checks, WCAG 2.2 a11y audits.
- **03:30 AM IST (22:00 UTC):** Sentry error log inspection, security advisories, and dependency checks.
- **04:00 AM IST (22:30 UTC):** Defect prioritization and mandatory reproduction test synthesis.
- **04:30 AM IST (23:00 UTC):** Bounded minimal patch generation in isolated worktree branches.
- **05:00 AM IST (23:30 UTC):** Targeted and regression test qualification with anti-mutation controls.
- **05:30 AM IST (00:00 UTC):** Release authority evaluation (L4 auto-promote for allowlisted LOW risk; L5 PR for others).
- **06:00 AM IST (00:30 UTC):** Final health ledger attestation and morning summary publication.
