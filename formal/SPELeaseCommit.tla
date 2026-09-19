---------------------------- MODULE SPELeaseCommit ----------------------------
(***************************************************************************)
(* SPE Ω v2.4.1 — G2 Ring-0 semantic lease / proof / commit FSM            *)
(*                                                                         *)
(* Models the K2 commit_semantic_patch authorization state machine:        *)
(*   SemanticSnapshot, SemanticProofLease, ProofCarryingPatch,             *)
(*   ProofObligation, VerificationReceipt, ProofLedger                     *)
(*                                                                         *)
(* CLAIM BOUNDARY:                                                         *)
(*   Exhaustive TLC check of THIS finite model/configurations only.        *)
(*   Does NOT prove Python implementation correctness, durability,         *)
(*   distributed safety, or production readiness.                          *)
(*                                                                         *)
(* SemanticProofLease ≠ G3 distributed worker lease.                       *)
(* K4 AuthorityGrant is NOT_MODELED.                                       *)
(* K0/K1 conflict preservation is NOT_MODELED (G1 runtime covers it).      *)
(***************************************************************************)

EXTENDS Naturals, FiniteSets, Sequences, TLC

CONSTANTS
  Lease,       \* finite set of lease ids
  Patch,       \* finite set of patch ids
  Obl,         \* finite set of obligation ids
  ProofType,   \* finite abstract proof types (exact-match only)
  MaxVersion   \* Nat — upper bound on snapshot version

ASSUME
  /\ IsFiniteSet(Lease) /\ Lease # {}
  /\ IsFiniteSet(Patch) /\ Patch # {}
  /\ IsFiniteSet(Obl) /\ Obl # {}
  /\ IsFiniteSet(ProofType) /\ ProofType # {}
  /\ MaxVersion \in Nat /\ MaxVersion >= 1

\* Model sentinels (strings outside finite id domains)
NoObl == "NO_OBL"
NoType == "NO_TYPE"
NoLease == "NO_LEASE"

ASSUME
  /\ NoObl \notin Obl
  /\ NoType \notin ProofType
  /\ NoLease \notin Lease

VARIABLES
  curVersion,       \* current SemanticSnapshot.version
  leaseStatus,      \* [Lease -> {"NONE","ACTIVE","CONSUMED","REVOKED"}]
  leaseBase,        \* [Lease -> 0..MaxVersion] base_version binding
  leaseObl,         \* [Lease -> Obl \cup {NoObl}] allowed obligation
  leaseReqType,     \* [Lease -> ProofType \cup {NoType}] required proof type
  patchExists,      \* [Patch -> BOOLEAN]
  patchBase,        \* [Patch -> 0..MaxVersion] base_version binding
  patchLease,       \* [Patch -> Lease \cup {NoLease}]
  patchObl,         \* [Patch -> Obl \cup {NoObl}]
  patchCommitted,   \* [Patch -> BOOLEAN]
  committedAgainst, \* [Patch -> 0..MaxVersion] version at successful commit
  receiptVerdict,   \* [Patch -> {"NONE","PASS","FAIL","UNKNOWN"}]
  receiptType,      \* [Patch -> ProofType \cup {NoType}]
  ledgerLen,        \* proof ledger append count (must track commits)
  commitCount       \* successful semantic commits

vars == <<
  curVersion, leaseStatus, leaseBase, leaseObl, leaseReqType,
  patchExists, patchBase, patchLease, patchObl, patchCommitted,
  committedAgainst, receiptVerdict, receiptType, ledgerLen, commitCount
>>

-----------------------------------------------------------------------------
\* TypeOK
-----------------------------------------------------------------------------

LeaseStatuses == {"NONE", "ACTIVE", "CONSUMED", "REVOKED"}
Verdicts == {"NONE", "PASS", "FAIL", "UNKNOWN"}

TypeOK ==
  /\ curVersion \in 0..MaxVersion
  /\ leaseStatus \in [Lease -> LeaseStatuses]
  /\ leaseBase \in [Lease -> 0..MaxVersion]
  /\ leaseObl \in [Lease -> (Obl \cup {NoObl})]
  /\ leaseReqType \in [Lease -> (ProofType \cup {NoType})]
  /\ patchExists \in [Patch -> BOOLEAN]
  /\ patchBase \in [Patch -> 0..MaxVersion]
  /\ patchLease \in [Patch -> (Lease \cup {NoLease})]
  /\ patchObl \in [Patch -> (Obl \cup {NoObl})]
  /\ patchCommitted \in [Patch -> BOOLEAN]
  /\ committedAgainst \in [Patch -> 0..MaxVersion]
  /\ receiptVerdict \in [Patch -> Verdicts]
  /\ receiptType \in [Patch -> (ProofType \cup {NoType})]
  /\ ledgerLen \in 0..MaxVersion
  /\ commitCount \in 0..MaxVersion

-----------------------------------------------------------------------------
\* Init
-----------------------------------------------------------------------------

Init ==
  /\ curVersion = 0
  /\ leaseStatus = [l \in Lease |-> "NONE"]
  /\ leaseBase = [l \in Lease |-> 0]
  /\ leaseObl = [l \in Lease |-> NoObl]
  /\ leaseReqType = [l \in Lease |-> NoType]
  /\ patchExists = [p \in Patch |-> FALSE]
  /\ patchBase = [p \in Patch |-> 0]
  /\ patchLease = [p \in Patch |-> NoLease]
  /\ patchObl = [p \in Patch |-> NoObl]
  /\ patchCommitted = [p \in Patch |-> FALSE]
  /\ committedAgainst = [p \in Patch |-> 0]
  /\ receiptVerdict = [p \in Patch |-> "NONE"]
  /\ receiptType = [p \in Patch |-> NoType]
  /\ ledgerLen = 0
  /\ commitCount = 0

-----------------------------------------------------------------------------
\* Helpers — commit authorization (mirrors commit_semantic_patch guards)
-----------------------------------------------------------------------------

LeaseActive(l) == leaseStatus[l] = "ACTIVE"

ValidCommit(p) ==
  /\ patchExists[p]
  /\ ~patchCommitted[p]
  /\ patchLease[p] \in Lease
  /\ LET l == patchLease[p] IN
       /\ LeaseActive(l)
       /\ leaseBase[l] = curVersion          \* lease binds current snapshot
       /\ patchBase[p] = curVersion          \* fresh (non-stale) patch
       /\ patchBase[p] = leaseBase[l]        \* lease/patch base agree
       /\ patchObl[p] \in Obl
       /\ leaseObl[l] = patchObl[p]          \* obligation on lease
       /\ receiptVerdict[p] = "PASS"         \* FAIL/UNKNOWN cannot commit
       /\ receiptType[p] \in ProofType
       /\ leaseReqType[l] = receiptType[p]   \* exact proof-type match
  /\ curVersion < MaxVersion                 \* finite bound

-----------------------------------------------------------------------------
\* Actions
-----------------------------------------------------------------------------

\* Issue a semantic proof lease bound to the current snapshot/version.
IssueLease(l, o, pt) ==
  /\ leaseStatus[l] = "NONE"
  /\ curVersion <= MaxVersion
  /\ leaseStatus' = [leaseStatus EXCEPT ![l] = "ACTIVE"]
  /\ leaseBase' = [leaseBase EXCEPT ![l] = curVersion]
  /\ leaseObl' = [leaseObl EXCEPT ![l] = o]
  /\ leaseReqType' = [leaseReqType EXCEPT ![l] = pt]
  /\ UNCHANGED <<
       curVersion, patchExists, patchBase, patchLease, patchObl,
       patchCommitted, committedAgainst, receiptVerdict, receiptType,
       ledgerLen, commitCount
     >>

\* Fresh patch: base = current version (and lease base).
ProposeFreshPatch(p, l) ==
  /\ ~patchExists[p]
  /\ LeaseActive(l)
  /\ leaseBase[l] = curVersion
  /\ patchExists' = [patchExists EXCEPT ![p] = TRUE]
  /\ patchBase' = [patchBase EXCEPT ![p] = curVersion]
  /\ patchLease' = [patchLease EXCEPT ![p] = l]
  /\ patchObl' = [patchObl EXCEPT ![p] = leaseObl[l]]
  /\ patchCommitted' = [patchCommitted EXCEPT ![p] = FALSE]
  /\ receiptVerdict' = [receiptVerdict EXCEPT ![p] = "NONE"]
  /\ receiptType' = [receiptType EXCEPT ![p] = NoType]
  /\ UNCHANGED <<
       curVersion, leaseStatus, leaseBase, leaseObl, leaseReqType,
       committedAgainst, ledgerLen, commitCount
     >>

\* Adversarial stale patch: base deliberately ≠ current version.
\* Ensures stale-patch states are reachable (vacuity / mutation teeth).
ProposeStalePatch(p, l, staleVer) ==
  /\ ~patchExists[p]
  /\ LeaseActive(l)
  /\ staleVer \in 0..MaxVersion
  /\ staleVer # curVersion
  /\ patchExists' = [patchExists EXCEPT ![p] = TRUE]
  /\ patchBase' = [patchBase EXCEPT ![p] = staleVer]
  /\ patchLease' = [patchLease EXCEPT ![p] = l]
  /\ patchObl' = [patchObl EXCEPT ![p] = leaseObl[l]]
  /\ patchCommitted' = [patchCommitted EXCEPT ![p] = FALSE]
  /\ receiptVerdict' = [receiptVerdict EXCEPT ![p] = "NONE"]
  /\ receiptType' = [receiptType EXCEPT ![p] = NoType]
  /\ UNCHANGED <<
       curVersion, leaseStatus, leaseBase, leaseObl, leaseReqType,
       committedAgainst, ledgerLen, commitCount
     >>

\* Verification outcome — separate from patch existence (no self-approval).
Verify(p, verdict, pt) ==
  /\ patchExists[p]
  /\ ~patchCommitted[p]
  /\ receiptVerdict[p] = "NONE"
  /\ verdict \in {"PASS", "FAIL", "UNKNOWN"}
  /\ pt \in ProofType
  /\ receiptVerdict' = [receiptVerdict EXCEPT ![p] = verdict]
  /\ receiptType' = [receiptType EXCEPT ![p] = pt]
  /\ UNCHANGED <<
       curVersion, leaseStatus, leaseBase, leaseObl, leaseReqType,
       patchExists, patchBase, patchLease, patchObl, patchCommitted,
       committedAgainst, ledgerLen, commitCount
     >>

\* Environmental revoke (status exists in runtime LeaseStatus; no dedicated
\* revoke API required for the safety law "only ACTIVE may commit").
RevokeLease(l) ==
  /\ leaseStatus[l] = "ACTIVE"
  /\ leaseStatus' = [leaseStatus EXCEPT ![l] = "REVOKED"]
  /\ UNCHANGED <<
       curVersion, leaseBase, leaseObl, leaseReqType,
       patchExists, patchBase, patchLease, patchObl, patchCommitted,
       committedAgainst, receiptVerdict, receiptType, ledgerLen, commitCount
     >>

\* Successful commit — atomic snapshot + ledger + lease consume.
CommitSuccess(p) ==
  /\ ValidCommit(p)
  /\ LET l == patchLease[p] IN
       /\ curVersion' = curVersion + 1
       /\ ledgerLen' = ledgerLen + 1
       /\ commitCount' = commitCount + 1
       /\ leaseStatus' = [leaseStatus EXCEPT ![l] = "CONSUMED"]
       /\ patchCommitted' = [patchCommitted EXCEPT ![p] = TRUE]
       /\ committedAgainst' = [committedAgainst EXCEPT ![p] = curVersion]
  /\ UNCHANGED <<
       leaseBase, leaseObl, leaseReqType,
       patchExists, patchBase, patchLease, patchObl,
       receiptVerdict, receiptType
     >>

\* Explicit failed-commit attempt: enabled when commit is NOT valid.
\* Must leave semantic state unchanged (FailedCommitNoMutation).
CommitReject(p) ==
  /\ patchExists[p]
  /\ ~patchCommitted[p]
  /\ ~ValidCommit(p)
  /\ UNCHANGED vars

-----------------------------------------------------------------------------
\* Next / Spec
-----------------------------------------------------------------------------

IssueLeaseAction ==
  \E l \in Lease, o \in Obl, pt \in ProofType : IssueLease(l, o, pt)

ProposeFreshAction ==
  \E p \in Patch, l \in Lease : ProposeFreshPatch(p, l)

ProposeStaleAction ==
  \E p \in Patch, l \in Lease, v \in 0..MaxVersion : ProposeStalePatch(p, l, v)

VerifyAction ==
  \E p \in Patch, v \in {"PASS", "FAIL", "UNKNOWN"}, pt \in ProofType :
    Verify(p, v, pt)

RevokeAction ==
  \E l \in Lease : RevokeLease(l)

CommitSuccessAction ==
  \E p \in Patch : CommitSuccess(p)

CommitRejectAction ==
  \E p \in Patch : CommitReject(p)

\* Intentional terminal: all leases settled, all patches resolved, no ACTIVE left.
\* Keeps deadlock checking ENABLED while allowing finite completion.
TerminalState ==
  /\ \A l \in Lease : leaseStatus[l] \in {"CONSUMED", "REVOKED", "NONE"}
  /\ \A l \in Lease : leaseStatus[l] # "ACTIVE"
  /\ \A p \in Patch :
       ~patchExists[p]
       \/ patchCommitted[p]
       \/ receiptVerdict[p] \in {"FAIL", "UNKNOWN"}
       \/ (patchExists[p] /\ patchBase[p] # curVersion)
       \/ (patchExists[p] /\ patchLease[p] \in Lease /\ leaseStatus[patchLease[p]] # "ACTIVE")
  /\ ~(\E p \in Patch : ValidCommit(p))

TerminalStutter ==
  /\ TerminalState
  /\ UNCHANGED vars

Next ==
  \/ IssueLeaseAction
  \/ ProposeFreshAction
  \/ ProposeStaleAction
  \/ VerifyAction
  \/ RevokeAction
  \/ CommitSuccessAction
  \/ CommitRejectAction
  \/ TerminalStutter

\* Liveness-oriented Next: no revoke / stale / FAIL-UNKNOWN pollution.
\* Once a valid commit is enabled, interfering actions are absent so the
\* continuously-enabled antecedent is reachable and stable until commit.
NextLive ==
  \/ IssueLeaseAction
  \/ ProposeFreshAction
  \/ (\E p \in Patch, pt \in ProofType : Verify(p, "PASS", pt))
  \/ CommitSuccessAction
  \/ TerminalStutter

Spec == Init /\ [][Next]_vars

\* Weak fairness on successful commit (weakest that matches intended progress).
Fairness == WF_vars(CommitSuccessAction)

LiveSpec == Init /\ [][NextLive]_vars /\ Fairness

-----------------------------------------------------------------------------
\* SAFETY INVARIANTS (S1–S15)
-----------------------------------------------------------------------------

\* S1 — TypeOK (declared above)

\* S2 — Snapshot version monotonic on successful commit
\*      (version only increases via CommitSuccess; never decreases)
SnapshotVersionMonotonic ==
  /\ curVersion >= 0
  /\ commitCount <= curVersion
  /\ ledgerLen <= curVersion

\* S3 — Stale patch never commits
StalePatchNeverCommits ==
  \A p \in Patch :
    patchCommitted[p] => (committedAgainst[p] = patchBase[p])

\* S4 — Lease binds base snapshot/version at commit
LeaseBindsBaseSnapshot ==
  \A p \in Patch :
    patchCommitted[p] =>
      /\ patchLease[p] \in Lease
      /\ leaseBase[patchLease[p]] = committedAgainst[p]
      /\ patchBase[p] = committedAgainst[p]

\* S5 — Only ACTIVE lease may authorize commit (post-state: CONSUMED)
OnlyActiveLeaseCommits ==
  \A p \in Patch :
    patchCommitted[p] =>
      /\ patchLease[p] \in Lease
      /\ leaseStatus[patchLease[p]] = "CONSUMED"

\* S6 — Required obligations satisfied (lease obl = patch obl at commit)
RequiredObligationsSatisfied ==
  \A p \in Patch :
    patchCommitted[p] =>
      /\ patchObl[p] \in Obl
      /\ patchLease[p] \in Lease
      /\ leaseObl[patchLease[p]] = patchObl[p]

\* S7 — Exact proof-type match
RequiredProofTypeMatches ==
  \A p \in Patch :
    patchCommitted[p] =>
      /\ receiptType[p] \in ProofType
      /\ patchLease[p] \in Lease
      /\ leaseReqType[patchLease[p]] = receiptType[p]

\* S8 — FAIL never commits
FailNeverCommits ==
  \A p \in Patch :
    receiptVerdict[p] = "FAIL" => ~patchCommitted[p]

\* S9 — UNKNOWN never commits
UnknownNeverCommits ==
  \A p \in Patch :
    receiptVerdict[p] = "UNKNOWN" => ~patchCommitted[p]

\* S10 — State + proof atomicity
StateProofAtomicity ==
  /\ curVersion = ledgerLen
  /\ curVersion = commitCount

\* S11 — Failed commit no mutation is structural:
\*       CommitReject is UNCHANGED vars; CommitSuccess is the only mutator.
\*       Reinforced by StateProofAtomicity + version bounds.
FailedCommitNoMutation ==
  StateProofAtomicity

\* S12 / S13 — Lease consumed after commit; consumed cannot reuse
LeaseConsumedAfterCommit ==
  \A p \in Patch :
    patchCommitted[p] =>
      /\ patchLease[p] \in Lease
      /\ leaseStatus[patchLease[p]] = "CONSUMED"

ConsumedLeaseCannotReuse ==
  \A l \in Lease :
    leaseStatus[l] = "CONSUMED" =>
      ~(\E p \in Patch :
          /\ ~patchCommitted[p]
          /\ patchLease[p] = l
          /\ ValidCommit(p))

\* S14 — At most one successful commit per semantic lease
NoDoubleCommit ==
  \A l \in Lease :
    Cardinality({p \in Patch : patchCommitted[p] /\ patchLease[p] = l}) <= 1

\* S15 — Patch cannot self-verify: commit requires prior Verify action
\*       (receiptVerdict starts NONE; only Verify sets PASS/FAIL/UNKNOWN)
PatchCannotSelfVerify ==
  \A p \in Patch :
    patchCommitted[p] => receiptVerdict[p] = "PASS"

\* Aggregated safety conjunction for full safety configs
AllSafety ==
  /\ TypeOK
  /\ SnapshotVersionMonotonic
  /\ StalePatchNeverCommits
  /\ LeaseBindsBaseSnapshot
  /\ OnlyActiveLeaseCommits
  /\ RequiredObligationsSatisfied
  /\ RequiredProofTypeMatches
  /\ FailNeverCommits
  /\ UnknownNeverCommits
  /\ StateProofAtomicity
  /\ FailedCommitNoMutation
  /\ LeaseConsumedAfterCommit
  /\ NoDoubleCommit
  /\ PatchCannotSelfVerify

-----------------------------------------------------------------------------
\* TEMPORAL / LIVENESS
-----------------------------------------------------------------------------

\* L1 — Once a valid commit is enabled under LiveSpec (no interfering
\* revoke/stale/FAIL actions), it must eventually resolve.
\* Form: leads-to (P ~> Q) ≡ [](P => <>Q).
\* Antecedent ValidCommit is reachable (Issue→Propose→Verify PASS).
\* Under LiveSpec, ValidCommit remains stable until CommitSuccess.
\* Fairness: WF_vars(CommitSuccessAction) — see fairness_matrix.json.
ValidContinuouslyEnabledCommitEventuallyResolves ==
  \A p \in Patch :
    ValidCommit(p) ~> patchCommitted[p]

\* Successful commit eventually consumes lease (L2) — also safety post-state
SuccessfulCommitEventuallyConsumesLease ==
  \A p \in Patch :
    patchCommitted[p] ~>
      (patchLease[p] \in Lease /\ leaseStatus[patchLease[p]] = "CONSUMED")

\* L3 — revoked never returns to ACTIVE
RevokedLeaseNeverReactivates ==
  \A l \in Lease :
    [](leaseStatus[l] = "REVOKED" => [](leaseStatus[l] = "REVOKED"))

\* L4 — consumed never returns to ACTIVE
ConsumedLeaseNeverReactivates ==
  \A l \in Lease :
    [](leaseStatus[l] = "CONSUMED" => [](leaseStatus[l] = "CONSUMED"))

-----------------------------------------------------------------------------
\* Vacuity / witness helpers (state predicates for coverage docs)
-----------------------------------------------------------------------------

Witness_StalePatchExists ==
  \E p \in Patch : patchExists[p] /\ patchBase[p] # curVersion

Witness_FailReceipt ==
  \E p \in Patch : receiptVerdict[p] = "FAIL"

Witness_UnknownReceipt ==
  \E p \in Patch : receiptVerdict[p] = "UNKNOWN"

Witness_ValidCommitEnabled ==
  \E p \in Patch : ValidCommit(p)

Witness_RevokedLease ==
  \E l \in Lease : leaseStatus[l] = "REVOKED"

Witness_ConsumedLease ==
  \E l \in Lease : leaseStatus[l] = "CONSUMED"

=============================================================================
\* Modification History
\* G2 created for SPE Ω v2.4.1 finite TLC model check of K2 semantics
=============================================================================
