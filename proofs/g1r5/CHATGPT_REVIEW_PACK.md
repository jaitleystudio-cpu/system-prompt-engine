# SPE Ω v2.4.1 — G1R-5 review pack (for ChatGPT)

Paste this whole file into ChatGPT.

## Repo / PR
- Repo: https://github.com/jaitleystudio-cpu/system-prompt-engine
- Branch: cursor/g1r5-k3-privacy-projection-0d6e
- Base: 931128b384c3055ecef876124f787e5b8e67651b
- Working contract SHA: 68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3
- implementation_commit / suite_run_commit: ce0d9f7250d07d22fe8f1722cb5635d0c9fdc4fd
- suite_tree: 8f53d36a35307c808798b82622713623c772838f
- reviewed_pr_head: EXTERNAL ONLY
- Prior: G1R-4 external PASS retained

## Contract correction
Brief said K3. RING0_WORKING_CONTRACT assigns privacy projection to K4. Contract wins. Implementation owner = K4.

## What was implemented
Sole writer: spe_runtime/privacy/project.py::project_privacy
Types: PrivacyClass, ProjectionAction, ProjectionScope, PrivacyDirective, PrivacyProjectionEntry, PrivacyProjection
Invariants: no semantic mutation, no authority mint, provenance preserved, fail-closed UNKNOWN, non-interference, deterministic identity, scope binding

## Denominators
G1R-1 5/5 · G1R-2 27/27 · G1R-3 37/37 · G1R-4 44/44 · G1R-5 18/18
Authoritative Python: 435 / 432 / 3
Expected failures: exactly the 3 G1-B03 tests for remaining unowned facts

## Ownership
Before UNOWNED=4 (included privacy_projection)
After UNOWNED=3: spe_artifact_identity, prompt_artifact, qualification_evidence
canonical privacy writers=1 · duplicates=0 · ambient=0

## Claim boundary
G1R5_IMPLEMENTATION_PRESENT · G1R5_REVIEW_PENDING
G1 still BOUND_WITH_GAPS · G2/G3/PR6/Sprint7/omega NOT STARTED

## Do not authorize
G1R-6, .spe, K7, G2, G3 from this pack alone.
