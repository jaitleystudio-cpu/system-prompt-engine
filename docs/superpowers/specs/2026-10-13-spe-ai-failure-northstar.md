# SPE Ω — AI Failure Intelligence North Star (R0 Evidence Integrity)

Date: 2026-10-13  
State: EXPERIMENTAL / DRAFT / NO PUBLICATION AUTHORITY  
Owner: existing SPE Failure Genome + Proof/Quality/Replay + SEO/content owners. No new semantic engine.

## North-star promise

"When AI fails, SPE shows what is reported, what is confirmed, what can be
reproduced, what may be causal, what repair has survived independent tests,
and what remains UNKNOWN."

Do not promise world-first discovery, universal failure diagnosis, perfect
repair, or search ranking. Proven public utility is the goal.

## Architecture preservation

- ProtectedIntent -> Requirement Graph -> XCAT -> K3 -> Quality Delta remains canonical.
- Rust/WASM semantic and .spe contracts remain unchanged.
- Failure Genome, Counterexample Minimizer, Prompt Bisect, Causal Proof Graph,
  Replay Capsule, Model Atlas and existing benchmark/LVT/G6-H owners stay in place.
- Gilden performs monitoring and research within separately approved authority;
  SPE owns product pages, evidence and bounded prompt solutions. No Gilden2.
- No new client telemetry, credential access, remote API payments, deployment,
  main merge, or public publishing authorization in this work.

## Event-to-answer lifecycle (proposed, not yet production-integrated)

1. DISCOVER: consume permitted primary-source notices and original research.
   Preserve actual occurrence time (if known), published time, SPE observed time.
2. TRIAGE: sources are untrusted data, never executable instructions. Validate
   source format, model revision, privacy/consent, event identity and timestamps.
3. CONFIRM: independent source review/attestation by existing authorized owner.
4. REPRODUCE: matched model revision, input, tools, seed/configuration, replay
   capsule, oracle, raw logs, repeated runs and negative controls. A mock
   runner or is_verified_by_reproduction bool cannot satisfy this.
5. DIAGNOSE: competing causes, counterexamples, confounders, ablations;
   causal attribution remains a hypothesis until discriminating evidence exists.
6. REPAIR: minimal lawful proposal, unchanged ProtectedIntent, matched
   baseline/candidate, held-out regression and adverse impact checks.
7. REVIEW: independently adjudicate source and experimental custody.
8. PUBLISH: only via existing authorized publishing owner; version, retract,
   localize, correct and preserve public change history.
9. RECHECK: model/incident drift triggers reassessment, never silent upgrade.

## Public claim levels

- REPORTED: a source reported a claim, no endorsement.
- SOURCE_CONFIRMED: publication and quoted facts independently checked.
- REPRODUCED_WITHIN_SCOPE: independently checked observed failure in a declared
  environment. Does not prove internal provider causation.
- CAUSAL_EVIDENCE_SUPPORTED: causal explanation supported by controlled tests,
  with alternatives and limits.
- REPAIR_VALIDATED_WITHIN_SCOPE: evaluated on paired, held-out cases with
  explicit regressions and relevant human evidence where required.
- VERIFIED_WORLD_BEST: never auto-issued; requires credible cross-competitor
  evaluation, independent replication and separate commercial approval.

Unknown stays UNKNOWN. Publishability is independent from claim level.

## R0 implementation in this branch

- incident_review.py adds an immutable preflight record and basic source,
  privacy, version and timestamp checks. It returns only HOLD or
  READY_FOR_INDEPENDENT_REVIEW, never permission to publish.
- evidence_generator.py's hardcoded Failure Genome, Model Passport and
  competitor comparison values are *synthetic fixtures*, not benchmarks.
  The direct render/export paths now reject requests unless fixture_only=True.
  Fixture previews are HTML-escaped, explicitly labeled SYNTHETIC, non-indexable,
  and omit claims, scores, payload dumps, canonical/public URLs and scripts.
- Unit tests cover fake scores, missing evidence, replay-flag false authority,
  malformed sources, local/private URLs, consent, missing timestamps,
  inverted timestamps, duplicate references and HTML injection.

This is a safety foundation, NOT live event monitoring or verified causal repair.

## Proposed R1 gates (not claims of achieved performance)

A. No bypass: 100% of synthetic/unknown incident fixtures fail public
   promotion; private/secret material is excluded.
B. No unauthorized public asset: default generator calls refuse before writes.
C. Primary source precision: zero critical false confirmations in the frozen
   adversarial corpus and independent source audit.
D. Replay: exact model revision and controls, replay artifacts, negative
   controls, and independent verifier record with zero false VERIFIED states.
E. Causal study: each root-cause claim states alternative hypotheses and
   discriminating ablation; otherwise labeled NOT_PROVEN.
F. Repair: paired held-out outcome improves over existing SPE baseline with
   preregistered effect size and no critical regressions.
G. Privacy/security: zero unexpected egress, 100% critical secret-redaction
   checks and no unconsented public failure records.
H. Reliability: calibrated p50/p95/p99 latency from authenticated source
   observation to publication, plus rollback/correction tests.
I. Human value: G6-H blinded ratings are collected/locked by independent
   humans, never fabricated or self-certified.
J. Existing CI: required full regression, Rust/WASM parity, LVT/authority and
   candidate branch release gates PASS before any release-review proposal.

Latency goals do not guarantee that a late source can reveal an event at onset.
Search indexing and ranking are controlled by external search engines.

## Negative and adversarial experiments (required before R1)

- Fabricated official-looking press release, forged timestamps, source edits.
- Source prompt injection and malicious HTML; unsafe links/SSRF/IP literals.
- Repeated identical incident marketed as "new"; wrong model version.
- Mock runner passes and toggles legacy reproduction flag.
- Cause incorrectly inferred from observed output without controls.
- Repair improves visible tasks while failing hidden held-out cases.
- Fake competitor scores and unreviewed model passports.
- Private user prompt or secrets embedded in a public reproducer.
- Fast retraction/correction invalidates previously published conclusion.
- Sparse regional feed causes a false "SPE was first" claim.
- 503 / interrupted source / empty feed triggers UNKNOWN, not confirmation.

## R0 exit and next boundary

This branch must remain DRAFT. Require exact-commit CI and independent review.
Owner may authorize a narrow R1 integration only after validating that the
existing publishing/receipt owners can be used without introducing duplicate
authority. No autonomous deploy, spend, merge, or production claim.

Relevant foundations: OWASP GenAI 2025 (https://genai.owasp.org/llm-top-10/),
NIST AI RMF (https://www.nist.gov/itl/ai-risk-management-framework),
Google robots metadata (https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).
