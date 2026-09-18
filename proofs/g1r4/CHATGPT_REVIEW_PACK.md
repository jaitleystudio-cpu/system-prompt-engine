# SPE Ω v2.4.1 — G1R-4A review pack (for ChatGPT)

Paste this whole file into ChatGPT.

## Repo / PR
- Repo: https://github.com/jaitleystudio-cpu/system-prompt-engine
- Branch: cursor/g1r4a-proof-integrity-0d6e
- Repair PR: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/10
- Prior PR #9: superseded for integrity/patch-binding repair
- Working contract SHA: 68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3
- Base: 931128b384c3055ecef876124f787e5b8e67651b
- implementation_commit (suite): 6b404e040e9fc8640439cbadda9b57505e6cbdcb
- suite_tree: 2ea3d91b49258e093edae0aac7ffa248c32d8517
- reviewed_pr_head: EXTERNAL ONLY (do not self-embed tip)

## External review response

Prior G1R4A_REVIEW_BLOCKED accepted. Narrow repairs:

A. Exact patch binding — receipt.patch_id == patch.patch_id required; patch_id=None no longer skips comparison; Patch A cannot replay on Patch B; static mutation oracle detects None-skip pattern.

B. Evidence identity — non-self-referential model: implementation_commit + suite_run_commit + suite_tree + artifact_content_sha256. No committed claim that "this file's commit is the branch tip."

Also documented: trusted in-process verifier callables; issuance secret = ordinary public-API forge resistance only.

## Authoritative denominators

See proofs/g1r4/AUTHORITATIVE_TEST_MANIFEST.json

| Suite | Result |
|---|---|
| G1R-1 | 5/5 PASS |
| G1R-2 | 27/27 PASS |
| G1R-3 | 37/37 PASS |
| G1R-4 (+4A) | 44/44 PASS |
| Authoritative Python | 417 collected / 414 passed / 3 failed |
| Expected failures | exactly 3 (G1-B03) |
| UNOWNED | exactly 4 |

## Ownership

privacy_projection, spe_artifact_identity, prompt_artifact, qualification_evidence

protected_intent_contract → K0 owned. Ambient authority paths = 0.

## Boundary

G1R-5 / G2 / G3 / PR #6 merge / Sprint 7 / spe_runtime/omega/ — NOT STARTED / NOT AUTHORIZED

## Re-review gate

| Gate | Required |
|---|---|
| Direct forged PASS | Rejected |
| Tampered receipt ID / evidence / issuance | Rejected |
| patch_id=None mutation commit | Rejected |
| Patch A on Patch B | Rejected |
| Wrong proof type / obligation / snapshot | Rejected |
| FAIL / UNKNOWN / missing | Rejected |
| Atomicity + failed tx unchanged | PASS |
| G1R-1..3 regression | 0 |
| Evidence denominator disagreement | 0 |
| Self-referential tip metadata | 0 |
| Stale canonical artifacts | 0 |
