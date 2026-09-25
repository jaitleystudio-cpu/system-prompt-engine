"""G1R-3 K0/K1 semantic foundation — provenance, protected intent, conflicts."""

from __future__ import annotations

import pytest

from spe_runtime.authority.models import AuthorityGrant
from spe_runtime.categories.c07_execute.engine import form_execution_intent
from spe_runtime.contract import (
    ContractValidity,
    ProtectedIntentContract,
    confirm_requirement,
    propose_requirement,
)
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.provenance import Provenance, may_overwrite
from spe_runtime.requirements import (
    ConflictType,
    RequirementAtom,
    RequirementGraph,
    RequirementKind,
    detect_conflicts,
)
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope


def _empty() -> ProtectedIntentContract:
    return ProtectedIntentContract()


def _propose(contract, **kwargs):
    return propose_requirement(contract, **kwargs)


# ---------------------------------------------------------------------------
# Provenance vocabulary
# ---------------------------------------------------------------------------


def test_provenance_is_str_enum_not_score():
    assert issubclass(Provenance, str)
    assert Provenance.USER_EXPLICIT.value == "USER_EXPLICIT"
    assert Provenance.INFERRED != Provenance.USER_CONFIRMED
    members = {p.name for p in Provenance}
    assert members == {
        "USER_EXPLICIT",
        "USER_CONFIRMED",
        "SYSTEM_REQUIRED",
        "INFERRED",
        "MODEL_PROPOSED",
        "SPE_SUGGESTED",
        "EXTERNAL_EVIDENCE",
        "UNKNOWN",
    }


def test_may_overwrite_protected_precedence():
    assert may_overwrite(Provenance.USER_EXPLICIT, Provenance.INFERRED) is False
    assert may_overwrite(Provenance.USER_CONFIRMED, Provenance.MODEL_PROPOSED) is False
    assert may_overwrite(Provenance.SYSTEM_REQUIRED, Provenance.SPE_SUGGESTED) is False
    assert may_overwrite(Provenance.INFERRED, Provenance.INFERRED) is True


# ---------------------------------------------------------------------------
# Negatives — inferred cannot overwrite
# ---------------------------------------------------------------------------


def test_inferred_cannot_overwrite_user_explicit():
    c = _propose(
        _empty(),
        semantic_key="budget",
        kind=RequirementKind.MUST,
        value=100,
        provenance=Provenance.USER_EXPLICIT,
    )
    c2 = _propose(
        c,
        semantic_key="budget",
        kind=RequirementKind.MUST,
        value=200,
        provenance=Provenance.INFERRED,
    )
    protected = c2.protected_for("budget")
    assert protected is not None
    assert protected.value == 100
    assert protected.provenance is Provenance.USER_EXPLICIT
    assert any(x.conflict_type is ConflictType.INFERENCE_CONFLICT for x in c2.conflicts)
    assert c2.validity is ContractValidity.CONFLICTED


def test_inferred_cannot_overwrite_user_confirmed():
    c = _propose(
        _empty(),
        semantic_key="dest",
        kind=RequirementKind.MUST,
        value="NYC",
        provenance=Provenance.INFERRED,
    )
    rid = next(iter(c.graph.nodes))
    c = confirm_requirement(c, rid)
    assert c.get(rid).provenance is Provenance.USER_CONFIRMED
    c2 = _propose(
        c,
        semantic_key="dest",
        kind=RequirementKind.MUST,
        value="LAX",
        provenance=Provenance.INFERRED,
    )
    assert c2.protected_for("dest").value == "NYC"
    assert c2.protected_for("dest").provenance is Provenance.USER_CONFIRMED


# ---------------------------------------------------------------------------
# propose cannot mint USER_CONFIRMED
# ---------------------------------------------------------------------------


def test_propose_cannot_mint_user_confirmed():
    with pytest.raises(SpeTypedError) as ei:
        _propose(
            _empty(),
            semantic_key="x",
            kind=RequirementKind.MUST,
            value=1,
            provenance=Provenance.USER_CONFIRMED,
        )
    assert ei.value.code is ErrorCode.K0_INVALID_PROVENANCE_TRANSITION
    assert ei.value.code.value == "K0_INVALID_PROVENANCE_TRANSITION"


def test_model_proposed_stays_model_proposed():
    c = _propose(
        _empty(),
        semantic_key="color",
        kind=RequirementKind.SHOULD,
        value="blue",
        provenance=Provenance.MODEL_PROPOSED,
    )
    atom = next(iter(c.graph.nodes.values()))
    assert atom.provenance is Provenance.MODEL_PROPOSED
    assert atom.provenance is not Provenance.USER_CONFIRMED


def test_spe_suggested_stays_spe_suggested():
    c = _propose(
        _empty(),
        semantic_key="tone",
        kind=RequirementKind.PREFERENCE,
        value="formal",
        provenance=Provenance.SPE_SUGGESTED,
    )
    assert next(iter(c.graph.nodes.values())).provenance is Provenance.SPE_SUGGESTED


def test_external_evidence_cannot_become_user_explicit_via_propose():
    c = _propose(
        _empty(),
        semantic_key="observed",
        kind=RequirementKind.SHOULD,
        value="rain",
        provenance=Provenance.EXTERNAL_EVIDENCE,
    )
    atom = next(iter(c.graph.nodes.values()))
    assert atom.provenance is Provenance.EXTERNAL_EVIDENCE
    assert atom.provenance is not Provenance.USER_EXPLICIT


# ---------------------------------------------------------------------------
# confirm_requirement
# ---------------------------------------------------------------------------


def test_confirm_requirement_promotes_inferred():
    c = _propose(
        _empty(),
        semantic_key="lang",
        kind=RequirementKind.MUST,
        value="en",
        provenance=Provenance.INFERRED,
    )
    rid = next(iter(c.graph.nodes))
    c2 = confirm_requirement(c, rid)
    assert c2.get(rid).provenance is Provenance.USER_CONFIRMED
    assert c.get(rid).provenance is Provenance.INFERRED  # prior immutable


def test_confirm_requirement_is_only_path_to_user_confirmed():
    c = _propose(
        _empty(),
        semantic_key="mode",
        kind=RequirementKind.MUST,
        value="safe",
        provenance=Provenance.MODEL_PROPOSED,
    )
    rid = next(iter(c.graph.nodes))
    # propose path cannot
    with pytest.raises(SpeTypedError) as ei:
        _propose(
            c,
            semantic_key="mode",
            kind=RequirementKind.MUST,
            value="safe",
            provenance=Provenance.USER_CONFIRMED,
            source_ref=c.get(rid).source_ref,
        )
    assert ei.value.code is ErrorCode.K0_INVALID_PROVENANCE_TRANSITION
    # confirm path can
    c2 = confirm_requirement(c, rid)
    assert c2.get(rid).provenance is Provenance.USER_CONFIRMED


def test_user_confirmed_survives_round_trip_to_dict():
    c = _propose(
        _empty(),
        semantic_key="tz",
        kind=RequirementKind.MUST,
        value="UTC",
        provenance=Provenance.INFERRED,
    )
    rid = next(iter(c.graph.nodes))
    c = confirm_requirement(c, rid)
    d = c.to_dict()
    assert any(r["provenance"] == "USER_CONFIRMED" for r in d["requirements"])


# ---------------------------------------------------------------------------
# UNKNOWN → MUST rejected
# ---------------------------------------------------------------------------


def test_unknown_propose_as_must_rejected():
    with pytest.raises(SpeTypedError) as ei:
        _propose(
            _empty(),
            semantic_key="mystery",
            kind=RequirementKind.MUST,
            value="x",
            provenance=Provenance.UNKNOWN,
        )
    assert ei.value.code is ErrorCode.K1_INVALID_REQUIREMENT
    assert ei.value.code.value == "K1_INVALID_REQUIREMENT"


# ---------------------------------------------------------------------------
# confidence / repetition / handoff cannot upgrade
# ---------------------------------------------------------------------------


def test_high_confidence_does_not_upgrade_provenance():
    c = _propose(
        _empty(),
        semantic_key="a",
        kind=RequirementKind.SHOULD,
        value=1,
        provenance=Provenance.INFERRED,
        confidence=0.99,
    )
    atom = next(iter(c.graph.nodes.values()))
    assert atom.provenance is Provenance.INFERRED


def test_repeated_inference_does_not_become_confirmed():
    c = _empty()
    for _ in range(5):
        c = _propose(
            c,
            semantic_key="repeat",
            kind=RequirementKind.SHOULD,
            value="same",
            provenance=Provenance.INFERRED,
        )
    atom = next(iter(c.graph.nodes.values()))
    assert atom.provenance is Provenance.INFERRED
    assert atom.provenance is not Provenance.USER_CONFIRMED


def test_category_handoff_does_not_upgrade_provenance():
    c = _propose(
        _empty(),
        semantic_key="h",
        kind=RequirementKind.SHOULD,
        value=2,
        provenance=Provenance.INFERRED,
        category_handoff="CAT:C02→CAT:C06",
    )
    assert next(iter(c.graph.nodes.values())).provenance is Provenance.INFERRED


def test_tool_output_does_not_upgrade_provenance():
    c = _propose(
        _empty(),
        semantic_key="tool",
        kind=RequirementKind.SHOULD,
        value=3,
        provenance=Provenance.SPE_SUGGESTED,
        tool_output={"ok": True},
    )
    assert next(iter(c.graph.nodes.values())).provenance is Provenance.SPE_SUGGESTED


# ---------------------------------------------------------------------------
# Positives — kinds distinct, coexistence
# ---------------------------------------------------------------------------


def test_user_explicit_preserved():
    c = _propose(
        _empty(),
        semantic_key="name",
        kind=RequirementKind.MUST,
        value="Ada",
        provenance=Provenance.USER_EXPLICIT,
    )
    assert c.protected_for("name").value == "Ada"
    assert c.validity is ContractValidity.VALID


def test_preference_distinct_from_must():
    assert RequirementKind.PREFERENCE is not RequirementKind.MUST
    c = _propose(
        _empty(),
        semantic_key="style",
        kind=RequirementKind.PREFERENCE,
        value="minimal",
        provenance=Provenance.USER_EXPLICIT,
    )
    assert next(iter(c.graph.nodes.values())).kind is RequirementKind.PREFERENCE


def test_should_distinct_from_must():
    assert RequirementKind.SHOULD is not RequirementKind.MUST


def test_must_not_survives_update():
    c = _propose(
        _empty(),
        semantic_key="leak",
        kind=RequirementKind.MUST_NOT,
        value="pii",
        provenance=Provenance.USER_EXPLICIT,
    )
    c2 = _propose(
        c,
        semantic_key="other",
        kind=RequirementKind.SHOULD,
        value=1,
        provenance=Provenance.INFERRED,
    )
    assert any(n.kind is RequirementKind.MUST_NOT for n in c2.graph.nodes.values())


def test_nonconflicting_inference_coexists_unbound():
    c = _propose(
        _empty(),
        semantic_key="budget",
        kind=RequirementKind.MUST,
        value=100,
        provenance=Provenance.USER_EXPLICIT,
    )
    c2 = _propose(
        c,
        semantic_key="currency",
        kind=RequirementKind.SHOULD,
        value="USD",
        provenance=Provenance.INFERRED,
    )
    assert c2.protected_for("budget").value == 100
    inferred = [n for n in c2.graph.nodes.values() if n.semantic_key == "currency"]
    assert len(inferred) == 1
    assert inferred[0].provenance is Provenance.INFERRED
    assert c2.validity is ContractValidity.VALID


# ---------------------------------------------------------------------------
# Conflicts
# ---------------------------------------------------------------------------


def test_must_and_must_not_same_fact_conflict():
    c = _propose(
        _empty(),
        semantic_key="ship",
        kind=RequirementKind.MUST,
        value="express",
        provenance=Provenance.USER_EXPLICIT,
    )
    c2 = _propose(
        c,
        semantic_key="ship",
        kind=RequirementKind.MUST_NOT,
        value="express",
        provenance=Provenance.SYSTEM_REQUIRED,
    )
    assert any(x.conflict_type is ConflictType.MUST_MUST_NOT for x in c2.conflicts)
    assert c2.validity is ContractValidity.CONFLICTED
    assert c2.validity is not ContractValidity.VALID


def test_conflicted_contract_not_valid():
    c = _propose(
        _empty(),
        semantic_key="k",
        kind=RequirementKind.MUST,
        value="a",
        provenance=Provenance.USER_EXPLICIT,
    )
    c = _propose(
        c,
        semantic_key="k",
        kind=RequirementKind.MUST_NOT,
        value="a",
        provenance=Provenance.USER_EXPLICIT,
        source_ref="other",
    )
    assert c.validity is ContractValidity.CONFLICTED


def test_empty_contract_incomplete():
    assert _empty().validity is ContractValidity.INCOMPLETE


def test_two_preferences_not_hard_conflict():
    c = _propose(
        _empty(),
        semantic_key="theme",
        kind=RequirementKind.PREFERENCE,
        value="dark",
        provenance=Provenance.USER_EXPLICIT,
    )
    c2 = _propose(
        c,
        semantic_key="theme",
        kind=RequirementKind.PREFERENCE,
        value="light",
        provenance=Provenance.USER_EXPLICIT,
        source_ref="alt",
    )
    hard = [x for x in c2.conflicts if x.severity.value == "HARD"]
    assert hard == []
    assert c2.validity is ContractValidity.VALID


def test_duplicate_equivalent_requirement_not_false_conflict():
    c = _propose(
        _empty(),
        semantic_key="dup",
        kind=RequirementKind.MUST,
        value=1,
        provenance=Provenance.USER_EXPLICIT,
    )
    c2 = _propose(
        c,
        semantic_key="dup",
        kind=RequirementKind.MUST,
        value=1,
        provenance=Provenance.USER_EXPLICIT,
    )
    assert len(c2.graph.nodes) == 1
    assert c2.conflicts == ()
    assert c2.validity is ContractValidity.VALID


def test_requirement_graph_records_conflict_edge():
    c = _propose(
        _empty(),
        semantic_key="ship",
        kind=RequirementKind.MUST,
        value="express",
        provenance=Provenance.USER_EXPLICIT,
    )
    c2 = _propose(
        c,
        semantic_key="ship",
        kind=RequirementKind.MUST_NOT,
        value="express",
        provenance=Provenance.SYSTEM_REQUIRED,
    )
    assert any(e.edge_type.value == "CONFLICTS_WITH" for e in c2.graph.edges.values())


def test_conflict_preserves_both_provenances():
    c = _propose(
        _empty(),
        semantic_key="budget",
        kind=RequirementKind.MUST,
        value=100,
        provenance=Provenance.USER_EXPLICIT,
    )
    c2 = _propose(
        c,
        semantic_key="budget",
        kind=RequirementKind.MUST,
        value=200,
        provenance=Provenance.INFERRED,
    )
    provenances = {n.provenance for n in c2.graph.nodes.values() if n.semantic_key == "budget"}
    assert Provenance.USER_EXPLICIT in provenances
    assert Provenance.INFERRED in provenances


def test_inference_cannot_launder_explicit_conflict():
    c = _propose(
        _empty(),
        semantic_key="x",
        kind=RequirementKind.MUST,
        value="a",
        provenance=Provenance.USER_EXPLICIT,
    )
    c = _propose(
        c,
        semantic_key="x",
        kind=RequirementKind.MUST,
        value="b",
        provenance=Provenance.INFERRED,
    )
    # Attempt to re-propose inference does not clear conflict or overwrite
    c2 = _propose(
        c,
        semantic_key="x",
        kind=RequirementKind.MUST,
        value="b",
        provenance=Provenance.INFERRED,
    )
    assert c2.protected_for("x").value == "a"
    assert c2.validity is ContractValidity.CONFLICTED


# ---------------------------------------------------------------------------
# Requirement identity / graph
# ---------------------------------------------------------------------------


def test_requirement_identity_deterministic():
    a = RequirementAtom.create(
        semantic_key="k",
        kind=RequirementKind.MUST,
        value={"n": 1},
        provenance=Provenance.USER_EXPLICIT,
        source_ref="s1",
    )
    b = RequirementAtom.create(
        semantic_key="k",
        kind=RequirementKind.MUST,
        value={"n": 1},
        provenance=Provenance.INFERRED,  # provenance excluded from id
        source_ref="s1",
    )
    assert a.requirement_id == b.requirement_id
    assert a.requirement_id.startswith("req-")
    assert len(a.requirement_id) == 4 + 32


def test_requirement_graph_cow_with_node():
    g = RequirementGraph()
    atom = RequirementAtom.create(
        semantic_key="k",
        kind=RequirementKind.MUST,
        value=1,
        provenance=Provenance.USER_EXPLICIT,
    )
    g2 = g.with_node(atom)
    assert atom.requirement_id not in g.nodes
    assert atom.requirement_id in g2.nodes
    g3 = g2.with_node(atom)
    assert g3 is g2  # idempotent


def test_detect_conflicts_standalone():
    g = RequirementGraph()
    a = RequirementAtom.create(
        semantic_key="k",
        kind=RequirementKind.MUST,
        value="v",
        provenance=Provenance.USER_EXPLICIT,
    )
    b = RequirementAtom.create(
        semantic_key="k",
        kind=RequirementKind.MUST_NOT,
        value="v",
        provenance=Provenance.SYSTEM_REQUIRED,
        source_ref="b",
    )
    g = g.with_node(a).with_node(b)
    conflicts = detect_conflicts(g)
    assert any(c.conflict_type is ConflictType.MUST_MUST_NOT for c in conflicts)


# ---------------------------------------------------------------------------
# Authority separation
# ---------------------------------------------------------------------------


def test_confirmation_does_not_grant_authority():
    c = _propose(
        _empty(),
        semantic_key="action",
        kind=RequirementKind.MUST,
        value="send",
        provenance=Provenance.INFERRED,
    )
    rid = next(iter(c.graph.nodes))
    c = confirm_requirement(c, rid)
    assert c.get(rid).provenance is Provenance.USER_CONFIRMED
    # No AuthorityGrant minted
    assert not isinstance(c, AuthorityGrant)
    assert not hasattr(c, "grant_id")
    d = c.to_dict()
    assert "authority" not in d
    assert "execution_grants" not in d


def test_confirmation_does_not_authorize_execution():
    c = _propose(
        _empty(),
        semantic_key="file",
        kind=RequirementKind.MUST,
        value="/tmp/x",
        provenance=Provenance.INFERRED,
    )
    rid = next(iter(c.graph.nodes))
    c = confirm_requirement(c, rid)
    env = CrossCategoryEnvelope(
        envelope_id="env-g1r3",
        goal_identity="goal",
        authority_state=AuthorityState(level=0, status="NONE", grants=()),
    )
    result = form_execution_intent(
        env,
        grant=None,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target="/tmp/x",
        canonical_arguments={"path": "/tmp/x", "content": "hi"},
        expected_effect="write",
    )
    assert result.status == "BLOCKED"


def test_conflict_does_not_mutate_authority():
    env = CrossCategoryEnvelope(
        envelope_id="env-c",
        goal_identity="g",
        authority_state=AuthorityState(level=1, status="GRANTED", grants=("read",)),
    )
    before = env.authority_state
    c = _propose(
        _empty(),
        semantic_key="k",
        kind=RequirementKind.MUST,
        value="a",
        provenance=Provenance.USER_EXPLICIT,
    )
    _propose(
        c,
        semantic_key="k",
        kind=RequirementKind.MUST_NOT,
        value="a",
        provenance=Provenance.SYSTEM_REQUIRED,
    )
    assert env.authority_state == before


# ---------------------------------------------------------------------------
# Proof separation
# ---------------------------------------------------------------------------


def test_to_dict_has_no_proof_fields_on_valid_contract():
    c = _propose(
        _empty(),
        semantic_key="ok",
        kind=RequirementKind.MUST,
        value=1,
        provenance=Provenance.USER_EXPLICIT,
    )
    assert c.validity is ContractValidity.VALID
    d = c.to_dict()
    forbidden = {
        "proof",
        "verified_success",
        "verification_receipt",
        "proof_ledger",
        "semantic_snapshot",
        "verified",
    }
    assert forbidden.isdisjoint(d.keys())
    for req in d["requirements"]:
        assert forbidden.isdisjoint(req.keys())


def test_error_code_wire_strings():
    assert ErrorCode.K0_INVALID_PROVENANCE_TRANSITION.value == "K0_INVALID_PROVENANCE_TRANSITION"
    assert ErrorCode.K1_INVALID_REQUIREMENT.value == "K1_INVALID_REQUIREMENT"
