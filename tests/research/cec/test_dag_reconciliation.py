"""
SPE Ω — CEC Monotone Join Lattice & DAG Reconciliation Tests.
Tests parallel worker partitioning, Kleene-3 conjunction merging,
missing delegation detection, and conflicting verdict resolution.
"""

import pytest
from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.research.cec import (
    ConservedContract,
    ObligationRecord,
    Disposition,
    InformationLabel,
    TransitionValidator,
    HandoffProtocol,
)


def make_parent_contract() -> ConservedContract:
    obs = {}
    for i in range(1, 5):
        oid = f"OBL-0{i}"
        obs[oid] = ObligationRecord(
            obligation_id=oid,
            requirement_ref=f"spec://rule_{i}",
            predicate_spec={"rule_id": i},
            disposition=Disposition.OPEN,
            is_mandatory=True,
        )
    return ConservedContract(
        contract_id="parent-dag-root",
        protected_intent_ref="intent://parallel-pipeline",
        root_commitment="sha256-parent-root",
        obligations=obs,
        permitted_authorities={"READ_DATA", "WRITE_LOGS"},
        information_label=InformationLabel.RESTRICTED,
    )


def test_parallel_worker_split_and_reconcile():
    """Verifies that parallel workers independently verifying subsets cleanly merge back into parent."""
    sk, pk = generate_keypair()
    parent = make_parent_contract()

    # Worker 1 takes OBL-01, OBL-02
    w1_child, _ = HandoffProtocol.delegate_task(
        parent=parent,
        child_agent_id="worker-1",
        delegated_obligation_ids={"OBL-01", "OBL-02"},
        delegated_authorities={"READ_DATA"},
        signing_key=sk,
        public_key=pk,
    )
    # Worker 2 takes OBL-03, OBL-04
    w2_child, _ = HandoffProtocol.delegate_task(
        parent=parent,
        child_agent_id="worker-2",
        delegated_obligation_ids={"OBL-03", "OBL-04"},
        delegated_authorities={"READ_DATA"},
        signing_key=sk,
        public_key=pk,
    )

    # Worker 1 succeeds on both
    w1_child.obligations["OBL-01"] = ObligationRecord(
        obligation_id="OBL-01",
        requirement_ref="spec://rule_1",
        predicate_spec={"rule_id": 1},
        disposition=Disposition.VERIFIED,
        witness_receipt_ref="receipt://w1/01",
    )
    w1_child.obligations["OBL-02"] = ObligationRecord(
        obligation_id="OBL-02",
        requirement_ref="spec://rule_2",
        predicate_spec={"rule_id": 2},
        disposition=Disposition.VERIFIED,
        witness_receipt_ref="receipt://w1/02",
    )

    # Worker 2 succeeds on 03, fails on 04
    w2_child.obligations["OBL-03"] = ObligationRecord(
        obligation_id="OBL-03",
        requirement_ref="spec://rule_3",
        predicate_spec={"rule_id": 3},
        disposition=Disposition.VERIFIED,
        witness_receipt_ref="receipt://w2/03",
    )
    w2_child.obligations["OBL-04"] = ObligationRecord(
        obligation_id="OBL-04",
        requirement_ref="spec://rule_4",
        predicate_spec={"rule_id": 4},
        disposition=Disposition.FAILED,
    )

    merged, ok, errs = TransitionValidator.reconcile_dag_join(
        parent=parent,
        children=[w1_child, w2_child],
        expected_delegated_ids={"OBL-01", "OBL-02", "OBL-03", "OBL-04"},
    )

    assert ok is True
    assert len(errs) == 0
    assert merged.obligations["OBL-01"].disposition == Disposition.VERIFIED
    assert merged.obligations["OBL-02"].disposition == Disposition.VERIFIED
    assert merged.obligations["OBL-03"].disposition == Disposition.VERIFIED
    assert merged.obligations["OBL-04"].disposition == Disposition.FAILED


def test_missing_delegated_obligation_in_worker_result():
    """Detects when a worker silently omits one of its delegated obligations."""
    parent = make_parent_contract()

    # Child contract only returns OBL-01, drops OBL-02
    child_incomplete = ConservedContract(
        contract_id="c-w1-incomplete",
        protected_intent_ref=parent.protected_intent_ref,
        root_commitment=parent.root_commitment,
        obligations={
            "OBL-01": ObligationRecord(
                obligation_id="OBL-01",
                requirement_ref="spec://rule_1",
                predicate_spec={"rule_id": 1},
                disposition=Disposition.VERIFIED,
                witness_receipt_ref="receipt://w1/01",
            )
        },
        permitted_authorities={"READ_DATA"},
        parent_contract_id=parent.contract_id,
    )

    merged, ok, errs = TransitionValidator.reconcile_dag_join(
        parent=parent,
        children=[child_incomplete],
        expected_delegated_ids={"OBL-01", "OBL-02"},  # OBL-02 was expected
    )

    assert ok is False
    assert any("Expected delegated obligations missing from child results" in e and "OBL-02" in e for e in errs)


def test_kleene_3_conjunction_on_conflicting_verdicts():
    """When two overlapping workers report conflicting verdicts, FAILED dominates (Kleene lower bound)."""
    parent = make_parent_contract()

    # Child 1 says OBL-01 is VERIFIED
    c1 = ConservedContract(
        contract_id="c-1",
        protected_intent_ref=parent.protected_intent_ref,
        root_commitment=parent.root_commitment,
        obligations={
            "OBL-01": ObligationRecord(
                obligation_id="OBL-01",
                requirement_ref="spec://rule_1",
                predicate_spec={"rule_id": 1},
                disposition=Disposition.VERIFIED,
                witness_receipt_ref="receipt://c1/01",
            )
        },
        permitted_authorities=set(),
        parent_contract_id=parent.contract_id,
    )

    # Child 2 says OBL-01 FAILED
    c2 = ConservedContract(
        contract_id="c-2",
        protected_intent_ref=parent.protected_intent_ref,
        root_commitment=parent.root_commitment,
        obligations={
            "OBL-01": ObligationRecord(
                obligation_id="OBL-01",
                requirement_ref="spec://rule_1",
                predicate_spec={"rule_id": 1},
                disposition=Disposition.FAILED,
            )
        },
        permitted_authorities=set(),
        parent_contract_id=parent.contract_id,
    )

    merged, ok, errs = TransitionValidator.reconcile_dag_join(parent, [c1, c2])
    assert ok is True
    # Invariant: Safety-critical failure dominates optimistic pass
    assert merged.obligations["OBL-01"].disposition == Disposition.FAILED
