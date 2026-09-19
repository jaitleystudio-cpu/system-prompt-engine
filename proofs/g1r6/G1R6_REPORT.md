# G1R-6 REPORT — K3 PromptArtifact semantic ownership

## FINAL VERDICT

**G1R6_IMPLEMENTATION_PRESENT**  
**G1R6_REVIEW_PENDING**

Not G1R6_PASS (external review required).

## SOURCE IDENTITY

| Field | Value |
|------|-------|
| Starting tip | `f3a7302f97a469f7369270c6198118b26ab72497` |
| Starting tree | `1e79fcc17527052a36c8e1dcd3b2f7dc0f29868c` |
| Branch | `cursor/g1r6-k3-prompt-artifact-0d6e` |
| Implementation commit | `ce279b3705f331e370a231693d2321daabb22e1e` |
| Implementation tree | `faac7cbc594b9a34d47c2fd5e4d63a6a905bc2b2` |
| Suite-run commit | `ce279b3705f331e370a231693d2321daabb22e1e` |
| Suite tree | `faac7cbc594b9a34d47c2fd5e4d63a6a905bc2b2` |
| Base SHA | `931128b384c3055ecef876124f787e5b8e67651b` |

## WORKING CONTRACT INTEGRITY

SHA-256 unchanged: `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3`  
`specs/spe-omega-v2.4.1/RING0_WORKING_CONTRACT.json` not edited.

## K3 PROMPTARTIFACT RESPONSIBILITY

Contract assigns PromptArtifact to **K3** (Strategy + Prompt).  
G1R-6 implements **PromptArtifact only** — not cognitive plan, prompt strategy, or technique selection.

## EXISTING SURFACE / DUPLICATE CHECK

Discovery: `proofs/g1r6/k3_prompt_existing_surface.json`  
- No `spe_runtime/prompt/` before G1R-6  
- C01 = recommendation writer; C03 = rendering writer — neither is PromptArtifact  
- No duplicate PromptArtifact writer introduced

## PROMPTARTIFACT TYPE SYSTEM

`spe_runtime/prompt/models.py`:
- `PromptSegmentKind`, `PromptSourceBinding`, `PromptSegment`, `PromptArtifact` (frozen)
- Deep immutability via frozen dataclasses + tuple segments

## CANONICAL WRITER

`spe_runtime/prompt/build.py::build_prompt_artifact` — sole writer.  
No `from_raw` / `create_unchecked` / `mint_prompt` / `prompt_factory`.

## SOURCE CONTRACT BINDING

Bound to deterministic contract content digest, requirement IDs/kinds/values digest, provenance markers.  
Not bound to Python object ids.

## PROTECTED INTENT PRESERVATION

MUST / MUST_NOT preserved as `PROTECTED_CONSTRAINT`.  
SHOULD remains `SHOULD_GUIDANCE`.  
PREFERENCE not upgraded.  
Context cannot delete or override protected constraints.

## INSTRUCTION / CONTEXT BOUNDARY

Structural sentinels with deterministic escape (`«SPE_ESC:…»`) so context cannot counterfeit section delimiters.  
Context segments carry `CONTEXT_DATA` + `UNKNOWN` provenance only.

## PROVENANCE BOUNDARY

Categorical provenance preserved; MODEL_PROPOSED / UNKNOWN never promoted to USER_CONFIRMED / protected truth.

## PROMPT != AUTHORITY

No AuthorityGrant mint; no authority_state change; no execution grants.

## PROMPT != PROOF

No proof_receipt / verification_receipt / PASS|FAIL verdict fields.

## PROMPT != QUALIFICATION

No production_ready / qualified / certified claims.

## PROMPTARTIFACT != .SPE ARTIFACT

`prompt_content_digest` (prefix `pad-`) ≠ `spe_artifact_identity`.  
No spe_artifact_id / lineage_id / export_identity / package_signature fields.

## DETERMINISM

Canonical JSON via `spe_runtime/portability/canonical.py` + `content_digest`.  
Sorted requirement and context-key ordering. Repeated builds byte-stable.

## COPY-ON-WRITE / IMMUTABILITY

Source contract / context maps unchanged after compile. Nested artifact mutation rejected.

## ADVERSARIAL TESTS

`tests/unit/test_g1r6_k3_prompt_artifact.py` — **30/30** including mutation oracle for protected-constraint preservation guard.

## WRITER AUDIT

```
semantic_fact: prompt_artifact
canonical_owner: K3
writer_modules: ["spe_runtime/prompt/build.py"]
duplicate_writer: false
```

Global duplicate canonical writers = 0; ambient authority paths = 0.

## TEST DENOMINATORS

Implementation suite @ `ce279b3705f331`:

| Metric | Value |
|--------|-------|
| collected | 469 |
| passed | 466 |
| failed | 3 |
| skipped | 0 |
| G1R-1 | 5/5 |
| G1R-2 | 27/27 |
| G1R-3 | 37/37 |
| G1R-4 | 44/44 |
| G1R-5 | 18/18 |
| G1R-5E (historical scope) | 4/4 |
| G1R-6 | 30/30 |
| G1 binding | 11/14 |

## OWNERSHIP BEFORE / AFTER

| | Before | After |
|--|--------|-------|
| UNOWNED | 3 | 2 |
| facts | prompt_artifact, spe_artifact_identity, qualification_evidence | spe_artifact_identity, qualification_evidence |

MISSING Ring-0 requirements: 8 → 7 (PromptArtifact → IMPLEMENTED; cognitive plan / prompt strategy / technique selection remain MISSING).

## EXPECTED REMAINING G1 FAILURES

Exactly 3:

1. `test_g1_no_unowned_required_ring0_responsibility`
2. `test_g1_artifact_lineage_owner_unique`
3. `test_g1_qualification_owner_unique`

## EVIDENCE IDENTITY

Split model: `implementation_validation` pinned to implementation commit/tree; evidence pack `EXTERNAL_ONLY`.  
Manifest: `proofs/g1r6/AUTHORITATIVE_TEST_MANIFEST.json`  
`artifact_content_sha256` = SHA-256 UTF-8 canonical JSON excluding that field.

## BOUNDARY

C01 / C03 / K2 / K4 / K6 / K7 / omega / portable / G2 / G3 / PR #6 untouched for product scope.  
G1R-5E tests scoped to historical `proofs/g1r5/*` so live binding may advance.

## NOT STARTED

cognitive plan · prompt strategy · technique selection · spe_artifact_identity · qualification_evidence · G2 · G3 · .spe packaging · full prompt engine

---

Self-verdict: **G1R6_IMPLEMENTATION_PRESENT** · **G1R6_REVIEW_PENDING**  
STOP for external review.
