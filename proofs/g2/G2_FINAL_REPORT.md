# SPE Ω v2.4.1 — G2 TLA+/TLC SAFETY + LIVENESS REPORT

## FINAL VERDICT
G2_MODEL_CHECK_PASS

## SOURCE CUSTODY
G1R-V HEAD: `8e8b028ab399a9194e7dc54f71ae006ed938d491`
G2 branch: `cursor/g2-tla-tlc-modelcheck-0d6e`
G2 HEAD: _(see git after commit; pinned in source_identity.json / manifest)_
PR: _(opened by agent)_
PR #6: OPEN @ 4e6c694 — **UNTOUCHED**
Working contract SHA: `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3`
G1 status: **BOUND_AND_PASS** (custody WORKING_CONTRACT_BOUND; qualification VERIFIED_WITHIN_SCOPE)

## FORMAL MODEL
Module: `formal/SPELeaseCommit.tla`
Config files: `formal/cfg/C0_smoke.cfg` … `C7_maximal.cfg`, `C_safety_all.cfg`, `C6_liveness.cfg`
Original model hash: _(none — no *.tla at G1R-V HEAD)_
Final model hash: `15b20a8532d3375c2d59dc8608c9c8854ff5ec7ecfcdefdb32902f0e6127e562`
Model changed?: YES (authored for G2; no prior formal source in tree)
Reason: Bind finite TLC-checkable Ring-0 semantic lease/proof/commit FSM to current K2 `commit_semantic_patch` guards

## MODEL/RUNTIME CORRESPONDENCE
SemanticSnapshot: ABSTRACTED
ProofObligation: ABSTRACTED
ProofLedger: ABSTRACTED
SemanticProofLease: ABSTRACTED
ProofCarryingPatch: ABSTRACTED
VerificationReceipt: ABSTRACTED
Commit: ABSTRACTED
Verification status: EXACT (PASS/FAIL/UNKNOWN laws)
Lease consume: EXACT
Proof-type exact match: EXACT
Safety-critical mismatch: **NO**

## ABSTRACTION BOUNDARY
Abstracts: SHA-256/content digests, full JSON/prompt payloads, issuance secrets, wall-clock, network, G3 durability, multi-obligation tuples, delta scope subset (assumed in-scope when obligation binds).
Preserves: stale version rejection, ACTIVE/CONSUMED/REVOKED auth, base binding, exact proof type, PASS-only commit, atomic snapshot+ledger+consume, no double-commit, no self-verify.

## TOOLCHAIN
Java: OpenJDK 21.0.10+7-Ubuntu-124.04
TLA+/TLC: TLC2 2026.09.17.032053 (tla2tools v1.8.0 jar)
tla2tools.jar SHA: `9d36716ffb5e49d1ba8fae4651eba59f3189887e12eb90e204a42d2e6e993fef`
Workers: 4
Heap: 3559m
Other: deadlock checking ENABLED; jar fetched via `tools/tlc/fetch_tla2tools.sh` (not committed)

## SPECIFICATION FORM
Init: all leases NONE; version/ledger/commitCount 0; no patches/receipts
Next: IssueLease | ProposeFresh | ProposeStale | Verify | Revoke | CommitSuccess | CommitReject | TerminalStutter
vars: see module `vars`
Spec: `Init /\ [][Next]_vars`
Fairness (LiveSpec): `WF_vars(CommitSuccessAction)`
LiveSpec: `Init /\ [][NextLive]_vars /\ Fairness` (NextLive omits revoke/stale/FAIL-UNKNOWN)

## SAFETY PROPERTIES
| ID | Name | Symbol | Configs | Result |
|----|------|--------|---------|--------|
| S1 | TypeOK | TypeOK | all safety | PASS |
| S2 | SnapshotVersionMonotonic | SnapshotVersionMonotonic | all safety | PASS |
| S3 | StalePatchNeverCommits | StalePatchNeverCommits | all safety | PASS |
| S4 | LeaseBindsBaseSnapshot | LeaseBindsBaseSnapshot | all safety | PASS |
| S5 | OnlyActiveLeaseCommits | OnlyActiveLeaseCommits | all safety | PASS |
| S6 | RequiredObligationsSatisfied | RequiredObligationsSatisfied | all safety | PASS |
| S7 | RequiredProofTypeMatches | RequiredProofTypeMatches | all safety | PASS |
| S8 | FailNeverCommits | FailNeverCommits | all safety | PASS |
| S9 | UnknownNeverCommits | UnknownNeverCommits | all safety | PASS |
| S10 | StateProofAtomicity | StateProofAtomicity | all safety | PASS |
| S11 | FailedCommitNoMutation | FailedCommitNoMutation | all safety | PASS |
| S12 | LeaseConsumedAfterCommit | LeaseConsumedAfterCommit | all safety | PASS |
| S13 | ConsumedLeaseCannotReuse | ConsumedLeaseCannotReuse | named | PASS |
| S14 | NoDoubleCommit | NoDoubleCommit | all safety | PASS |
| S15 | PatchCannotSelfVerify | PatchCannotSelfVerify | all safety | PASS |

## LIVENESS PROPERTIES
| ID | Name | Fairness | Antecedent reachable? | Configs | Result |
|----|------|----------|----------------------|---------|--------|
| L1 | ValidCommit ~> patchCommitted | WF_vars(CommitSuccessAction) | YES (C6 path + M6 teeth) | C6 | PASS |
| L2 | committed ~> lease CONSUMED | none (atomic) | YES | C6 | PASS |
| L3 | REVOKED => []REVOKED | none | YES (Revoke coverage) | C6 | PASS |
| L4 | CONSUMED => []CONSUMED | none | YES | C6 | PASS |

## DEADLOCK
Checking: ENABLED
Unexpected deadlocks: NO
Result: PASS (intentional TerminalStutter for finite completion)

## CONFIGURATION MATRIX
| Config | Distinct states | Generated | Depth | Exit | Result |
|--------|-----------------|-----------|-------|------|--------|
| C0_smoke | 28 | 91 | 5 | 0 | PASS |
| C1_stale_patch | 365 | 2275 | 7 | 0 | PASS |
| C2_competing_patches | 3633 | 21785 | 9 | 0 | PASS |
| C3_multiple_leases | 6113 | 37681 | 9 | 0 | PASS |
| C4_obligations_types | 137505 | 857546 | 9 | 0 | PASS |
| C5_verdicts | 2025 | 13440 | 7 | 0 | PASS |
| C6_liveness | 5 | 9 | 5 | 0 | PASS |
| C7_maximal | 236513 | 1507106 | 9 | 0 | PASS |
| C_safety_all | 137505 | 857546 | 9 | 0 | PASS |

## COVERAGE
Actions reached: IssueLease, ProposeFreshPatch, ProposeStalePatch, Verify, RevokeLease, CommitSuccess, CommitReject, TerminalStutter (all non-zero executions in C5/C1)
Zero-covered actions: NONE among intended major transitions
Vacuity findings: L1 rewritten to leads-to (prior `[]ValidCommit` from Init was vacuous); M6 confirms non-vacuity

## MUTATION CHECKS
Stale-patch mutant: KILLED (StalePatchNeverCommits)
Atomicity mutant: KILLED (StateProofAtomicity)
Lease-binding mutant: KILLED (LeaseBindsBaseSnapshot)
UNKNOWN-as-PASS mutant: KILLED (UnknownNeverCommits)
Consumed-lease mutant: KILLED (AllSafety / OnlyActiveLeaseCommits)
Liveness mutant: KILLED (ValidContinuouslyEnabledCommitEventuallyResolves)
Attempted: 6
Killed: 6
Survived: 0

## COUNTEREXAMPLES
Canonical model: count 0
Mutants: count 6
Locations: `proofs/g2/counterexamples/*_counterexample.log`

## G1 REGRESSION
Python collected: 672
passed: 672
failed: 0
skipped: 0
exit: 0
compileall: exit 0
Production spe_runtime changes during G2: **NONE**

## RUST / WASM
Shared ABI change: NO
Rebuilt: NO
Reason: G2 formal-model-only scope

## CLAIM QUALIFICATION
Subject: SPELeaseCommit finite TLA+ model
Exact formal-model scope: Ring-0 semantic lease/proof/commit under recorded C0–C7 / C_safety_all / C6
Evidence: TLC safety+liveness logs, mutation kills, correspondence matrix
Earned claim: MODEL_CHECKED_WITHIN_DECLARED_FINITE_SCOPE
Limitations: finite configs only; cryptographic issuance / scope subset / K0-K1 / K4 not claimed

## EXACT EARNED G2 CLAIM
The declared SPE Ring-0 semantic lease/proof/commit TLA+ model (`SPELeaseCommit`) was exhaustively checked by TLC over the recorded finite configurations (C0–C7, C_safety_all, C6). No counterexample was found for the declared safety invariants or liveness properties under the recorded fairness assumption `WF_vars(CommitSuccessAction)`. Designed mutants that weaken stale-patch, atomicity, lease-binding, UNKNOWN→PASS, consumed-lease, and fairness guards were all killed by TLC.

## NOT EARNED
Python formally verified: NO
Production qualified: NO
Durable Ring-1: NO
Crash-safe: NO
Distributed concurrency verified: NO
Live providers: NO
Chaos: NO
Users: NO
Security red team: NO
Independent full-system replication: NO
World #1: NOT PROVEN

## PROMOTION DECISION
G1: BOUND_AND_PASS
G2: MODEL_CHECKED_WITHIN_DECLARED_FINITE_SCOPE

## NEXT TASK
G3 — DURABLE RING-1 EXECUTION + CRASH/CONCURRENCY PROOF
DO NOT EXECUTE IT.

## STOP
STOP AFTER G2.
NO G3 EXECUTION.
NO G4-G9.
NO SPRINT 7.
NO PR #6 MERGE.
NO production feature expansion.
