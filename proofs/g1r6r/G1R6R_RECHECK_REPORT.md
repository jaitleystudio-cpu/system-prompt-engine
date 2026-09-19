# SPE Ω v2.4.1 — G1R-6 INDEPENDENT RECHECK REPORT

## FINAL VERDICT

**G1R6_RECHECK_PASS**

Findings H01–H03 were real audit defects; each was closed with minimum hardening during this recheck (not G1R-7 product work). No residual semantic integrity defect remains open.

## BYTE CUSTODY

| Artifact | Expected / Observed |
|----------|---------------------|
| Working contract | `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3` — MATCH |
| Pre-recheck binding | `39819d5614a903374339b4019d29768c94d0d7b526bbc4d83d388e29fdf6418f` — verified at review start |
| Pre-recheck manifest | `305fdfb8ff29339fbca01fbc7e8e4dfa16793ec6a08c0a62ed76375a7a715e9d` — verified |
| Pre-recheck report | `aca0a0b0882bbb52027ef602fba198d3a40f46674f871a827c84187db69ea20e` — verified |
| Binding copies (root / proofs/g1 / proofs/g1r6) | byte-identical at review start |

Post-recheck binding/manifest/report SHAs are regenerated for this recheck pack (see EVIDENCE IDENTITY).

## SOURCE SCOPE

Authorized production changes in G1R-6 lineage:
- `spe_runtime/prompt/{__init__,models,build}.py`
- `spe_runtime/error_registry.py` (K3 error codes)
- G1 maps / inventories / tests / proofs

G1R-6R hardening delta only:
- `spe_runtime/prompt/build.py` (NFC canonicalize before escape)
- `spe_runtime/prompt/models.py` (`slots=True`)
- `tests/unit/test_g1_runtime_binding.py` (K3 incompleteness gate)
- `tests/unit/test_g1r6r_k3_prompt_recheck.py` (adversarial recheck)

Unexpected / forbidden changes: **none**  
(omega / portable / C01 / C03 / K2 / K4 authority+privacy / K6 / K7 / working contract untouched)

PR #6: OPEN @ `4e6c694b5d8b9379c5acfbaac416dcfa89b1768e` — undisturbed.

## PROMPTARTIFACT WRITER

| Field | Value |
|-------|-------|
| Canonical writer | `spe_runtime/prompt/build.py::build_prompt_artifact` |
| Writer count | 1 |
| Duplicate semantic writers | 0 |
| Direct dataclass construction | DATA OBJECT only — not canonical SPE compilation |

## PROTECTED INTENT

| Kind | Result |
|------|--------|
| MUST | preserved as PROTECTED_CONSTRAINT |
| MUST_NOT | preserved as PROTECTED_CONSTRAINT |
| SHOULD | SHOULD_GUIDANCE — not upgraded |
| PREFERENCE | PREFERENCE — not upgraded |
| Context overwrite ("definitely use network") | context stays CONTEXT_DATA/UNKNOWN; MUST_NOT remains |

## INJECTION / SENTINEL TESTS

Cases exercised (all PASS — data cannot become structure):
- `«SPE_ESC:` / `»` fragments
- exact open/close sentinels
- nested open+fake MUST+close
- partial markers
- pre-escaped and double-prepped escaped forms
- fullwidth confusable equals
- CR/LF/NUL
- keyword soup (PROTECTED_CONSTRAINT / USER_CONFIRMED / AUTHORITY / PROOF / QUALIFICATION)
- very long marker-like strings

Encoding: one-way for sentinel-bearing inputs; escaped form never equals a sentinel (hex+length tag). Rebuilds of identical input do not accumulate escapes.

## DETERMINISM

| Check | Result |
|-------|--------|
| Content digest | stable |
| Segment order | kind rank → semantic_key → requirement_id |
| Cross-process stability | PASS (subprocess replay) |
| random/time/uuid/hash() | none in prompt package |
| NFC/NFD string context | render + digest byte-stable after H02 fix |

## IMMUTABILITY

| Layer | Result |
|-------|--------|
| Top-level frozen | PASS |
| Nested | tuples + str + enums only; `slots=True` blocks `__dict__` bypass (H03 closed) |
| Source copy-on-write | PASS |

## CONFLICT PRESERVATION

MUST vs MUST_NOT conflict on same key → `ContractValidity.CONFLICTED` → `K3_PROMPT_CONFLICTED_SOURCE`. No single-side laundering.

## DOMAIN SEPARATION

| Boundary | Result |
|----------|--------|
| PromptArtifact → K2 proof | NO |
| PromptArtifact → K4 authority | NO |
| PromptArtifact → privacy permission | NO |
| PromptArtifact → K7 qualification | NO |
| prompt_content_digest → K6 artifact identity | NO |

## K3 COMPLETENESS

| Requirement | Status |
|-------------|--------|
| PromptArtifact | **IMPLEMENTED** |
| CognitivePlan (cognitive plan) | **MISSING** |
| PromptStrategy (prompt strategy) | **MISSING** |
| TechniqueSelection (technique selection) | **MISSING** |

Mechanical gate exists for missing K3 responsibilities: **YES**  
`test_g1_k3_required_responsibilities_complete` (intentionally RED until G1R-7)

## TEST REPLAY

| Suite | Result |
|-------|--------|
| G1R-6 | 30/30 PASS |
| G1R-6R adversarial | 10/10 PASS |
| G1R-5E historical | 4/4 PASS |
| Full Python (exclusions as G1R-6) | **480 collected / 476 passed / 4 failed / 0 skipped** |

Expected failures (exactly 4 after H01 gate):
1. `test_g1_no_unowned_required_ring0_responsibility`
2. `test_g1_k3_required_responsibilities_complete` ← new deliberate RED
3. `test_g1_artifact_lineage_owner_unique`
4. `test_g1_qualification_owner_unique`

## G1 GAP STATE

| Class | Count | Notes |
|-------|-------|-------|
| UNOWNED | 2 | spe_artifact_identity, qualification_evidence |
| MISSING | 7 | 3×K3 strategy + 2×K6 + 2×K7 |
| IMPLEMENTED | 24 | includes PromptArtifact |
| PARTIAL | 18 | unchanged |
| CONFLICTING | 1 | unchanged |

## BLOCKERS

| ID | Severity | Resolution |
|----|----------|------------|
| G1R6R-H01 | Audit | CLOSED — dedicated K3 incompleteness gate added (stays RED) |
| G1R6R-H02 | Integrity | CLOSED — NFC canonicalize string context before escape/render |
| G1R6R-H03 | Integrity | CLOSED — `slots=True` on frozen prompt models |

No open semantic integrity blockers.

## PROMOTION DECISION

**G1R-6: PASS_EXTERNAL**

Self-claim after recheck:
- G1R-6 PASS_EXTERNAL
- G1R-6R RECHECK_PASS
- G1 remains BOUND_WITH_GAPS (UNOWNED=2, MISSING=7)
- Do not claim K3 strategy layer complete

## NEXT TASK

Only after this recheck is accepted externally:

**G1R-7 — K3 CognitivePlan + PromptStrategy + TechniqueSelection**

DO NOT execute it in this turn.

## STOP

NO G1R-7. NO K6. NO K7. NO G2. NO G3. NO PR #6 MERGE.

---

### Identity

| Field | Value |
|-------|-------|
| Recheck branch | `cursor/g1r6r-prompt-recheck-0d6e` |
| Hardening commit | `5ebe61e9869d761a364a15e5c624da1418d05002` |
| Hardening tree | `9b2cf6f2bab2c3c4b538767af30a2f3e69f1e51c` |
| Suite-run commit | `5ebe61e9869d761a364a15e5c624da1418d05002` |
| Predecessor G1R-6 tip | `3e64172b3c670b368c135a4a2119443f73c88ff5` |
| Working contract | `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3` |
