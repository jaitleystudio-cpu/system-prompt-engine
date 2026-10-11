# SPE Ω — LVT-2 Research Evidence Integrity Design

**Status:** Local research design only; no GitHub production integration. **Owner:** Existing SPE LVT. **Design class:** Architectural protocol versioning and fail-closed migration, not a new evaluator/proof authority.

## Problem statement
The candidate LVT-0 module can mark a threshold-only effect as statistically significant and compute held-out retention by subtracting the training baseline from the held-out candidate score. The schema accepts aggregate-only verdicts without item/family identifiers or externally trusted provenance. Old tests intentionally fabricate aggregate scores to assert `QUALIFIED`. Thus passing LVT-0 tests is not external proof of improved prompt quality.

## Goals
- Pair all held-out candidate/base observations by the same item ID.
- Reject train/heldout ID, family ID and declared content-digest overlaps.
- Prevent repeated examples from one source family inflating significance or effect floor.
- Use an explicit family-level one-sided exact sign test, with corrected alpha, a separate preregistered minimum macro effect, and minimum number of families.
- Preserve data reproducibility through canonical hash, without claiming signatures or external custody.
- Never issue production `QUALIFIED` from untrusted/self-declared data.
- Preserve local/no-network design and existing SPE authority and proof owners.

## Input contract
`StudyProtocol`, `Observation`, `run_study()` in `lvt2_gate.py`. Each `Observation` has `item_id`, `family_id`, claimed `content_sha256`, baseline/candidate score and (train only) shuffled control. Study declares evaluator and generator IDs, oracle/model digests, alpha, multiplicity, independent family count floor and effect floor. These source identity fields are *claims*, not attestations.

## Evaluation algorithm
1. Reject malformed or ambiguous data (IDs, scores, digests, protocol, overlaps, mock-self identity).
2. Compute baseline and candidate on identical held-out items. Group paired deltas by family and average *within* each family.
3. Count positive/negative independent family deltas (ties excluded); compute one-sided exact `Binom(n,.5)` tail probability.
4. Require at least 20 heldout families (the research-only configured minimum); require alpha adjusted by declared multiplicity; require positive training control and positive family-macro held-out effect above predeclared threshold.
5. Emit only `RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED`, `INCONCLUSIVE`, `REJECTED`, or invalid-input exception. Never produce `QUALIFIED` or confer authority.
6. Bind deterministic result to exact record set and protocol through canonical SHA-256; enable independent recomputation. No raw user prompt storage or network.

## Safety/privacy and error semantics
No runtime model calls, telemetry, tools, cloud, writable secrets, or authority escalation. Caller-submitted IDs and digests do NOT prove independent sampling, authorized oracle, preregistration, data authenticity, near-duplicate absence, causal validity, or market leadership. Human-independent qualification requires a distinct future external protocol.

## Integration boundary
The old LVT-0 `LearningValidator` still accepts mock aggregates. For production this must become fail-closed rather than remaining a parallel shortcut. Version V1 fixtures as `MOCK_EVIDENCE_ONLY` and review migration. The new gate is a *research* component only until the old release path is retired or tightly gated. Existing `CSC`, `WDIC-VCT`, `AuthorityGrant`, proof receipts, and frozen contracts remain separate authorities.

## Acceptance tests
`tests/test_lvt2.py` (27 tests) and `tests/test_cli.py` (3 tests). The four mutation probes must fail against injected false heldout baseline, micro-averaging, leaked families, and forged production qualification. Include independent `scipy.stats.binomtest` cross-check; reproduce seeded synthetic calibration. Full repository qualification is a separate gate.
