--------------------------- MODULE SPE_LEASE_RECOVERY ---------------------------
EXTENDS Naturals, FiniteSets

\* G2 model: SPE v2.4.1 lease/recovery semantics.
\* At-most-once effects (effect_ledger), no blind retry (outcomes),
\* honest commit (verified evidence only), recovery via reconciliation.

CONSTANTS MaxOps, MaxClock
VARIABLES op, outcome, lease, claims, verified, wentUnknown, reconciled

vars == <<op, outcome, lease, claims, verified, wentUnknown, reconciled>>

NOT_EXECUTED == 1
DISPATCHING == 2
OUTCOME_UNKNOWN == 3
PARTIAL == 4
COMPLETED == 5
FAILED == 6
RECONCILIATION_REQUIRED == 7

NOT_LEASED == 1
LEASED == 2

TypeOK ==
  /\ op \in [1..MaxOps -> {TRUE, FALSE}]
  /\ outcome \in [1..MaxOps -> 1..7]
  /\ lease \in [1..MaxOps -> 1..2]
  /\ claims \subseteq (1..MaxOps) \times (0..MaxClock)
  /\ verified \in [0..MaxClock -> {TRUE, FALSE}]
  /\ wentUnknown \in [1..MaxOps -> {TRUE, FALSE}]
  /\ reconciled \in [1..MaxOps -> {TRUE, FALSE}]

Init ==
  /\ op = [i \in 1..MaxOps |-> FALSE]
  /\ outcome = [i \in 1..MaxOps |-> NOT_EXECUTED]
  /\ lease = [i \in 1..MaxOps |-> NOT_LEASED]
  /\ claims = {}
  /\ verified = [t \in 0..MaxClock |-> FALSE]
  /\ wentUnknown = [i \in 1..MaxOps |-> FALSE]
  /\ reconciled = [i \in 1..MaxOps |-> FALSE]

AcquireLease(i) ==
  /\ ~op[i]
  /\ lease[i] = NOT_LEASED
  /\ op' = [op EXCEPT ![i] = TRUE]
  /\ lease' = [lease EXCEPT ![i] = LEASED]
  /\ UNCHANGED <<outcome, claims, verified, wentUnknown, reconciled>>

Dispatch(i) ==
  /\ op[i]
  /\ lease[i] = LEASED
  /\ outcome[i] = NOT_EXECUTED
  /\ outcome' = [outcome EXCEPT ![i] = DISPATCHING]
  /\ UNCHANGED <<op, lease, claims, verified, wentUnknown, reconciled>>

ResultUnknown(i) ==
  /\ outcome[i] = DISPATCHING
  /\ outcome' = [outcome EXCEPT ![i] = OUTCOME_UNKNOWN]
  /\ wentUnknown' = [wentUnknown EXCEPT ![i] = TRUE]
  /\ UNCHANGED <<op, lease, claims, verified, reconciled>>

\* At-most-once guard mirrors effect_ledger.claim(): an op claims AT MOST ONE slot
Claim(i, t) ==
  /\ outcome[i] = DISPATCHING
  /\ \A s \in 0..MaxClock : <<i, s>> \notin claims
  /\ claims' = claims \cup {<<i, t>>}
  /\ UNCHANGED <<op, outcome, lease, verified, wentUnknown, reconciled>>

\* Evidence becomes verified (an external verification step)
Verify(t) ==
  /\ t \in 0..MaxClock
  /\ verified' = [verified EXCEPT ![t] = TRUE]
  /\ UNCHANGED <<op, outcome, lease, claims, wentUnknown, reconciled>>

\* Honest commit: only a claimed AND verified attempt may complete
Complete(i, t) ==
  /\ outcome[i] = DISPATCHING
  /\ <<i, t>> \in claims
  /\ verified[t]
  /\ outcome' = [outcome EXCEPT ![i] = COMPLETED]
  /\ UNCHANGED <<op, lease, claims, verified, wentUnknown, reconciled>>

Fail(i) ==
  /\ outcome[i] \in {NOT_EXECUTED, DISPATCHING}
  /\ outcome' = [outcome EXCEPT ![i] = FAILED]
  /\ UNCHANGED <<op, lease, claims, verified, wentUnknown, reconciled>>

\* UNKNOWN may only move forward via reconciliation - never straight to terminal
Reconcile(i) ==
  /\ outcome[i] = OUTCOME_UNKNOWN
  /\ outcome' = [outcome EXCEPT ![i] = RECONCILIATION_REQUIRED]
  /\ reconciled' = [reconciled EXCEPT ![i] = TRUE]
  /\ UNCHANGED <<op, lease, claims, verified, wentUnknown>>

ResolveAfterReconcile(i, t) ==
  /\ outcome[i] = RECONCILIATION_REQUIRED
  /\ <<i, t>> \in claims
  /\ verified[t]
  /\ outcome' = [outcome EXCEPT ![i] = COMPLETED]
  /\ UNCHANGED <<op, lease, claims, verified, wentUnknown, reconciled>>

ResolveFailedAfterReconcile(i) ==
  /\ outcome[i] = RECONCILIATION_REQUIRED
  /\ outcome' = [outcome EXCEPT ![i] = FAILED]
  /\ UNCHANGED <<op, lease, claims, verified, wentUnknown, reconciled>>

Next ==
  \/ \E i \in 1..MaxOps : AcquireLease(i)
  \/ \E i \in 1..MaxOps : Dispatch(i)
  \/ \E i \in 1..MaxOps : ResultUnknown(i)
  \/ \E i \in 1..MaxOps, t \in 0..MaxClock : Claim(i, t)
  \/ \E t \in 0..MaxClock : Verify(t)
  \/ \E i \in 1..MaxOps, t \in 0..MaxClock : Complete(i, t)
  \/ \E i \in 1..MaxOps : Fail(i)
  \/ \E i \in 1..MaxOps : Reconcile(i)
  \/ \E i \in 1..MaxOps, t \in 0..MaxClock : ResolveAfterReconcile(i, t)
  \/ \E i \in 1..MaxOps : ResolveFailedAfterReconcile(i)

Spec == Init /\ [][Next]_vars

\* ------------------------- SAFETY INVARIANTS -------------------------

AtMostOnce ==
  /\ \A i \in 1..MaxOps :
       Cardinality({t \in 0..MaxClock : <<i, t>> \in claims}) <= 1

NoBlindRetry ==
  /\ \A i \in 1..MaxOps :
       (wentUnknown[i] /\ outcome[i] \in {COMPLETED, FAILED}) => reconciled[i]

HonestCommit ==
  /\ \A i \in 1..MaxOps :
       (outcome[i] = COMPLETED) =>
         \E t \in 0..MaxClock : <<i, t>> \in claims /\ verified[t]

LeaseDiscipline ==
  /\ \A i \in 1..MaxOps :
       (outcome[i] = DISPATCHING) => lease[i] = LEASED

Inv == TypeOK /\ AtMostOnce /\ NoBlindRetry /\ HonestCommit /\ LeaseDiscipline

=============================================================================
