"""Sprint 3 unit/integration: CAT:C07 + AuthorityGrant + ExecutionIntent.

RED→GREEN: C07 never mints authority. recommendation + rendering + authority NONE
= BLOCKED. No external side effects except optional local temp-file fixture.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from spe_runtime.adapters.local_temp_file import write_local_temp_file
from spe_runtime.authority.models import AuthorityGrant
from spe_runtime.authority.validate import validate_grant_compatibility
from spe_runtime.categories.c01_decide.engine import decide
from spe_runtime.categories.c02_research.engine import research
from spe_runtime.categories.c03_communicate.engine import communicate
from spe_runtime.categories.c06_analyze.engine import analyze
from spe_runtime.categories.c07_execute.engine import (
    form_execution_intent,
    retry_form_execution_intent,
)
from spe_runtime.categories.c07_execute.validate import validate_c07_output
from spe_runtime.execution.models import ExecutionIntent, OutcomeState
from spe_runtime.execution.outcomes import retry_eligible, transition_outcome
from spe_runtime.xcat.handoff import HandoffResult, validate_handoff
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope, FailureRecord
from spe_runtime.xcat.reasons import ReasonCode


NOW = "2026-09-15T12:00:00+00:00"
LATER = "2026-09-15T18:00:00+00:00"
PAST = "2026-09-14T12:00:00+00:00"
FUTURE = "2026-09-16T12:00:00+00:00"


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _seed(**overrides) -> CrossCategoryEnvelope:
    base = dict(
        envelope_id="env-s3-001",
        goal_identity="goal-sprint3",
        facts=(),
        provenance=(),
        uncertainties=(),
        hard_constraints=(
            {
                "constraint_id": "c1",
                "statement": "never invent facts",
                "strength": "HARD",
            },
        ),
        user_preferences=(
            {"preference_id": "pref1", "statement": "prefer concise answers"},
        ),
        analysis=None,
        recommendation=None,
        rendering=None,
        authority_state=AuthorityState(level=0, status="NONE", grants=()),
        execution_grants=(),
        failures=(),
        taint_labels=("external_untrusted",),
        sensitivity_labels=("PII_NONE",),
        category_trace=(),
    )
    base.update(overrides)
    return CrossCategoryEnvelope(**base)


def _valid_grant(**overrides) -> AuthorityGrant:
    base = dict(
        grant_id="grant-001",
        principal="user:prawin",
        capability="WRITE_LOCAL_TEMP_FILE",
        target="local://tmp/spe-s3/",
        argument_constraints={
            "allowed_keys": ["filename", "content_b64_len_max"],
            "filename_suffix": ".txt",
            "content_b64_len_max": 1024,
            "nested": {"max_depth": 2, "tags": ["safe"]},
        },
        purpose="sprint3 local side-effect proof",
        issued_at=PAST,
        expires_at=FUTURE,
        use_limit=1,
        uses_consumed=0,
        revocation_state="ACTIVE",
    )
    base.update(overrides)
    return AuthorityGrant(**base)


def _envelope_with_send_recommendation(**overrides) -> CrossCategoryEnvelope:
    """recommendation SEND + C03 rendering + authority NONE."""
    env = _seed(
        recommendation={
            "action": "SEND",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
            "decision_id": "dec-001",
        },
        rendering={
            "format": "text",
            "body": "Recommend SEND (not authority).",
            "certainty": "CONDITIONAL",
        },
        authority_state=AuthorityState(level=0, status="NONE", grants=()),
        category_trace=("CAT:C02", "CAT:C06", "CAT:C01", "CAT:C03"),
    )
    if overrides:
        data = env.to_dict()
        # rebuild via constructor fields
        auth = overrides.pop("authority_state", env.authority_state)
        return CrossCategoryEnvelope(
            envelope_id=overrides.get("envelope_id", env.envelope_id),
            goal_identity=overrides.get("goal_identity", env.goal_identity),
            facts=overrides.get("facts", env.facts),
            provenance=overrides.get("provenance", env.provenance),
            uncertainties=overrides.get("uncertainties", env.uncertainties),
            hard_constraints=overrides.get("hard_constraints", env.hard_constraints),
            user_preferences=overrides.get("user_preferences", env.user_preferences),
            analysis=overrides.get("analysis", env.analysis),
            recommendation=overrides.get("recommendation", env.recommendation),
            rendering=overrides.get("rendering", env.rendering),
            authority_state=auth,
            execution_grants=overrides.get("execution_grants", env.execution_grants),
            failures=overrides.get("failures", env.failures),
            taint_labels=overrides.get("taint_labels", env.taint_labels),
            sensitivity_labels=overrides.get(
                "sensitivity_labels", env.sensitivity_labels
            ),
            category_trace=overrides.get("category_trace", env.category_trace),
        )
    return env


# ---------------------------------------------------------------------------
# Negatives 1–14
# ---------------------------------------------------------------------------


def test_01_missing_authority_blocks():
    """SEND + rendering + authority NONE / grant None => BLOCKED."""
    env = _envelope_with_send_recommendation()
    result = form_execution_intent(
        env,
        grant=None,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target="local://tmp/spe-s3/",
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        recommendation_ref="rec-send",
        decision_ref="dec-001",
        now=NOW,
    )
    assert result.status == "BLOCKED"
    assert result.intent is None
    assert ReasonCode.EXECUTION_MISSING_AUTHORITY in result.reason_codes or (
        ReasonCode.EXECUTION_MISSING_AUTHORITY.value in result.reason_codes
    )


def test_02_capability_mismatch_blocks():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant(capability="SEND_EMAIL")
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert result.status == "BLOCKED"
    codes = {getattr(c, "value", c) for c in result.reason_codes}
    assert ReasonCode.SCOPE_MISMATCH.value in codes


def test_03_target_drift_blocks():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant(target="local://tmp/spe-s3/")
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target="local://tmp/OTHER/",
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert result.status == "BLOCKED"
    codes = {getattr(c, "value", c) for c in result.reason_codes}
    assert ReasonCode.TARGET_DRIFT.value in codes


def test_04_argument_over_limit_blocks():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={
            "filename": "a.txt",
            "content_b64_len_max": 99999,  # over grant max 1024
            "extra_forbidden_key": "x",
        },
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert result.status == "BLOCKED"
    codes = {getattr(c, "value", c) for c in result.reason_codes}
    assert ReasonCode.ARGUMENT_DRIFT.value in codes


def test_05_expired_grant_blocks():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant(expires_at=PAST, issued_at="2026-09-13T12:00:00+00:00")
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert result.status == "BLOCKED"
    codes = {getattr(c, "value", c) for c in result.reason_codes}
    assert ReasonCode.AUTHORITY_EXPIRED.value in codes


def test_06_revoked_grant_blocks():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant(revocation_state="REVOKED")
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert result.status == "BLOCKED"
    codes = {getattr(c, "value", c) for c in result.reason_codes}
    assert ReasonCode.AUTHORITY_REVOKED.value in codes


def test_07_consumed_grant_blocks():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant(use_limit=1, uses_consumed=1)
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert result.status == "BLOCKED"
    codes = {getattr(c, "value", c) for c in result.reason_codes}
    assert ReasonCode.AUTHORITY_CONSUMED.value in codes


def test_08_c07_cannot_mutate_recommendation():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
        mutate_recommendation={
            "action": "EXECUTE",
            "certainty": "CERTAIN",
            "kind": "recommendation",
        },
    )
    assert result.status == "BLOCKED"
    assert result.envelope.recommendation == env.recommendation
    assert validate_c07_output(env, result.envelope) is False or result.status == "BLOCKED"


def test_09_c07_cannot_weaken_constraint():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
        weaken_constraints=True,
    )
    assert result.status == "BLOCKED"
    assert result.envelope.hard_constraints == env.hard_constraints


def test_10_c07_cannot_create_or_expand_authority():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
        expand_authority=True,
    )
    assert result.status == "BLOCKED"
    assert result.envelope.authority_state == env.authority_state
    assert result.envelope.authority_state.status == "NONE"


def test_11_operation_id_replaced_on_retry_blocked():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    first = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert first.status == "INTENT_FORMED"
    assert first.intent is not None
    retry = retry_form_execution_intent(
        env,
        first.intent,
        grant=grant,
        now=NOW,
        replace_operation_id="op-REPLACED-DIFFERENT",
    )
    assert retry.status == "BLOCKED"
    codes = {getattr(c, "value", c) for c in retry.reason_codes}
    assert ReasonCode.OPERATION_ID_REPLACED.value in codes


def test_12_unknown_to_failed_blind_retry_blocked():
    ok, new_state, codes = transition_outcome(
        OutcomeState.OUTCOME_UNKNOWN,
        OutcomeState.FAILED,
        evidence=None,
    )
    assert ok is False
    assert new_state is None or new_state == OutcomeState.OUTCOME_UNKNOWN
    code_vals = {getattr(c, "value", c) for c in codes}
    assert ReasonCode.UNKNOWN_OUTCOME_RETRY.value in code_vals
    assert retry_eligible(OutcomeState.OUTCOME_UNKNOWN) is False


def test_13_partial_to_success_blocked():
    ok, new_state, codes = transition_outcome(
        OutcomeState.PARTIAL,
        OutcomeState.COMPLETED,
        evidence={"claimed": "success"},
    )
    assert ok is False
    code_vals = {getattr(c, "value", c) for c in codes}
    assert ReasonCode.PARTIAL_TO_SUCCESS.value in code_vals


def test_14_tool_success_not_verified_success():
    """Adapter tool OK must not mint VERIFIED_SUCCESS / outcome COMPLETED alone."""
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    formed = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 64},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert formed.status == "INTENT_FORMED"
    assert formed.intent is not None
    adapter = write_local_temp_file(
        intent=formed.intent,
        content=b"hello-sprint3",
    )
    assert adapter.verified_success is False
    assert "VERIFIED_SUCCESS" not in (adapter.status, getattr(adapter, "outcome", ""))
    ok, _, codes = transition_outcome(
        OutcomeState.DISPATCHING,
        OutcomeState.COMPLETED,
        evidence={"tool_status": "OK", "verified": False},
    )
    # Tool success alone is insufficient for COMPLETED without verification evidence
    if adapter.status in ("OK", "WRITTEN"):
        code_vals = {getattr(c, "value", c) for c in codes}
        # Either transition blocked OR reason TOOL_SUCCESS_TO_OUTCOME present
        assert ok is False or ReasonCode.TOOL_SUCCESS_TO_OUTCOME.value in code_vals
        assert ReasonCode.TOOL_SUCCESS_TO_OUTCOME.value in code_vals or ok is False


# ---------------------------------------------------------------------------
# Positives
# ---------------------------------------------------------------------------


def test_pos_valid_grant_forms_intent():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "ok.txt", "content_b64_len_max": 32},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        recommendation_ref="rec-send",
        decision_ref="dec-001",
        now=NOW,
    )
    assert result.status == "INTENT_FORMED"
    assert result.intent is not None
    assert isinstance(result.intent, ExecutionIntent)
    assert result.intent.authority_grant_ref == grant.grant_id
    assert result.intent.action_type == "WRITE_LOCAL_TEMP_FILE"
    assert result.intent.canonical_target == grant.target
    assert result.envelope.authority_state == env.authority_state


def test_pos_target_args_match_and_unexpired():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    ok, reasons = validate_grant_compatibility(
        grant,
        capability="WRITE_LOCAL_TEMP_FILE",
        target=grant.target,
        arguments={"filename": "ok.txt", "content_b64_len_max": 32},
        now=NOW,
    )
    assert ok is True
    assert reasons == ()
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "ok.txt", "content_b64_len_max": 32},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert result.status == "INTENT_FORMED"
    assert grant.revocation_state == "ACTIVE"
    assert grant.uses_consumed < grant.use_limit


def test_pos_authority_unchanged_and_stable_op_id():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    first = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "ok.txt", "content_b64_len_max": 32},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        recommendation_ref="rec-send",
        decision_ref="dec-001",
        now=NOW,
    )
    assert first.status == "INTENT_FORMED"
    assert first.envelope.authority_state.status == "NONE"
    assert first.envelope.authority_state == env.authority_state
    retry = retry_form_execution_intent(
        first.envelope,
        first.intent,
        grant=grant,
        now=NOW,
    )
    assert retry.status == "INTENT_FORMED"
    assert retry.intent is not None
    assert retry.intent.operation_id == first.intent.operation_id


def test_pos_unknown_to_reconciliation_required():
    ok, new_state, codes = transition_outcome(
        OutcomeState.OUTCOME_UNKNOWN,
        OutcomeState.RECONCILIATION_REQUIRED,
        evidence={"reconcile": True},
    )
    assert ok is True
    assert new_state == OutcomeState.RECONCILIATION_REQUIRED
    assert codes == ()


def test_pos_not_executed_retry_eligible():
    assert retry_eligible(OutcomeState.NOT_EXECUTED) is True
    ok, new_state, _ = transition_outcome(
        OutcomeState.NOT_EXECUTED,
        OutcomeState.DISPATCHING,
        evidence={"dispatch": True},
    )
    assert ok is True
    assert new_state == OutcomeState.DISPATCHING


def test_pos_local_temp_file_digest_no_network(tmp_path: Path):
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    formed = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "proof.txt", "content_b64_len_max": 128},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert formed.status == "INTENT_FORMED"
    content = b"sprint3-local-only-proof"
    expected_digest = hashlib.sha256(content).hexdigest()
    adapter = write_local_temp_file(
        intent=formed.intent,
        content=content,
        directory=str(tmp_path),
    )
    assert adapter.network_used is False
    assert adapter.verified_success is False
    assert adapter.content_digest == expected_digest
    assert adapter.path is not None
    written = Path(adapter.path).read_bytes()
    assert written == content
    assert hashlib.sha256(written).hexdigest() == expected_digest


# ---------------------------------------------------------------------------
# Deep immutability
# ---------------------------------------------------------------------------


def test_deep_immutability_grant_and_intent():
    grant = _valid_grant()
    with pytest.raises(Exception):
        grant.argument_constraints["nested"]["tags"].append("mutated")  # type: ignore[index]
    env = _envelope_with_send_recommendation()
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "ok.txt", "content_b64_len_max": 32},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert result.status == "INTENT_FORMED"
    intent = result.intent
    assert intent is not None
    with pytest.raises(Exception):
        intent.canonical_arguments["filename"] = "hacked.txt"  # type: ignore[index]


# ---------------------------------------------------------------------------
# Full vertical fixture C02→C06→C01→C03→C07
# ---------------------------------------------------------------------------


def test_vertical_chain_send_plus_none_authority_blocks_c07():
    """Hard law: recommendation SEND + C03 rendering + authority NONE = C07 BLOCKED."""
    seed = _seed()
    after_c02 = research(
        seed,
        facts=(
            {
                "fact_id": "f1",
                "statement": "local temp write is available",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "fixture"},),
        uncertainties=(
            {"uncertainty_id": "u1", "description": "disk may be full"},
        ),
    )
    assert validate_handoff(seed, after_c02, "CAT:C02", "CAT:C02") == HandoffResult.VALID

    after_c06 = analyze(
        after_c02,
        analysis={"summary": "local write feasible", "kind": "analysis"},
    )
    assert validate_handoff(after_c02, after_c06, "CAT:C02", "CAT:C06") == HandoffResult.VALID

    after_c01 = decide(
        after_c06,
        recommendation={
            "action": "SEND",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
            "decision_id": "dec-vert-1",
        },
    )
    assert after_c01.authority_state.status == "NONE"
    assert after_c01.execution_grants == ()
    assert validate_handoff(after_c06, after_c01, "CAT:C06", "CAT:C01") == HandoffResult.VALID

    after_c03 = communicate(
        after_c01,
        rendering={
            "format": "text",
            "body": "Conditional SEND recommendation (not execution).",
            "certainty": "CONDITIONAL",
        },
    )
    assert validate_handoff(after_c01, after_c03, "CAT:C01", "CAT:C03") == HandoffResult.VALID

    # No grant → BLOCKED (hard law)
    blocked = form_execution_intent(
        after_c03,
        grant=None,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target="local://tmp/spe-s3/",
        canonical_arguments={"filename": "x.txt", "content_b64_len_max": 8},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        recommendation_ref="rec-send",
        decision_ref="dec-vert-1",
        now=NOW,
    )
    assert blocked.status == "BLOCKED"
    codes = {getattr(c, "value", c) for c in blocked.reason_codes}
    assert ReasonCode.EXECUTION_MISSING_AUTHORITY.value in codes
    assert after_c03.recommendation["action"] == "SEND"
    assert after_c03.authority_state.status == "NONE"

    # Valid external grant → INTENT_FORMED; authority on envelope still unchanged
    grant = _valid_grant()
    formed = form_execution_intent(
        after_c03,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "vert.txt", "content_b64_len_max": 64},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        recommendation_ref="rec-send",
        decision_ref="dec-vert-1",
        now=NOW,
    )
    assert formed.status == "INTENT_FORMED"
    assert formed.envelope.authority_state == after_c03.authority_state
    assert formed.envelope.recommendation == after_c03.recommendation
    assert "CAT:C07" in formed.envelope.category_trace
    assert validate_handoff(
        after_c03, formed.envelope, "CAT:C03", "CAT:C07"
    ) == HandoffResult.VALID
    # Distinctions hold
    assert formed.intent is not None
    assert after_c03.recommendation != formed.intent  # recommendation != execution
    assert formed.envelope.authority_state.status == "NONE"  # grant != envelope authority mint


# ---------------------------------------------------------------------------
# Attack cases
# ---------------------------------------------------------------------------


def test_attack_decision_drift_blocks():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        recommendation_ref="rec-send",
        decision_ref="dec-OTHER-NOT-IN-REC",
        now=NOW,
    )
    assert result.status == "BLOCKED"
    codes = {getattr(c, "value", c) for c in result.reason_codes}
    assert ReasonCode.DECISION_DRIFT.value in codes


def test_attack_illicit_authority_mint_via_c07():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    result = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
        illicit_authority=AuthorityState(
            level=9, status="GRANTED", grants=("WRITE_LOCAL_TEMP_FILE", "admin")
        ),
    )
    assert result.status == "BLOCKED"
    assert result.envelope.authority_state.status == "NONE"


def test_attack_arguments_digest_stable():
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    args = {"filename": "a.txt", "content_b64_len_max": 10}
    a = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments=args,
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    b = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments=dict(args),
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert a.status == "INTENT_FORMED" and b.status == "INTENT_FORMED"
    assert a.intent.arguments_digest == b.intent.arguments_digest
    assert a.intent.operation_id == b.intent.operation_id


def test_cost_law_no_paid_imports():
    """pyproject stays free/local — jsonschema + pytest only."""
    root = Path(__file__).resolve().parents[2]
    pyproject = (root / "pyproject.toml").read_text()
    forbidden = ("openai", "anthropic", "stripe", "boto3", "google-cloud", "azure")
    lower = pyproject.lower()
    for name in forbidden:
        assert name not in lower


# ---------------------------------------------------------------------------
# Merge-gate adversarial closures (G2/G3/G4/G5/G6/G8/G12/G15/G16/G17)
# ---------------------------------------------------------------------------


def test_mg_g2_execution_grants_expansion_never_allowed():
    """authorized=True must NOT bypass C07 ownership — no grant mint/broaden.

    G1R-2: replace_envelope rejects execution_grants; construct attack envelope
    via CrossCategoryEnvelope directly (not the generic mutator).
    """
    from spe_runtime.xcat.models import CrossCategoryEnvelope

    before = _envelope_with_send_recommendation()
    after = CrossCategoryEnvelope(
        envelope_id=before.envelope_id,
        goal_identity=before.goal_identity,
        facts=before.facts,
        provenance=before.provenance,
        uncertainties=before.uncertainties,
        hard_constraints=before.hard_constraints,
        user_preferences=before.user_preferences,
        analysis=before.analysis,
        recommendation=before.recommendation,
        rendering=before.rendering,
        authority_state=before.authority_state,
        execution_grants=(
            {"capability": "SEND_EMAIL", "authorized": True, "target": "*"},
        ),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=before.category_trace + ("CAT:C07",),
    )
    assert validate_c07_output(before, after) is False


def test_mg_g3_read_grant_send_action_refused():
    grant = _valid_grant(capability="READ")
    ok, reasons = validate_grant_compatibility(
        grant,
        capability="SEND",
        target=grant.target,
        arguments={"filename": "a.txt", "content_b64_len_max": 10},
        now=NOW,
    )
    assert ok is False
    assert ReasonCode.SCOPE_MISMATCH.value in reasons


def test_mg_g4_target_case_whitespace_alias_refused():
    grant = _valid_grant(target="local://tmp/spe-s3/")
    tricks = [
        "LOCAL://TMP/SPE-S3/",
        " local://tmp/spe-s3/ ",
        "file:///tmp/spe-s3/",
        "local://tmp/spe-s3",
        "local://tmp/spe-s3/../spe-s3/",
    ]
    for tgt in tricks:
        ok, reasons = validate_grant_compatibility(
            grant,
            capability=grant.capability,
            target=tgt,
            arguments={"filename": "a.txt", "content_b64_len_max": 10},
            now=NOW,
        )
        assert ok is False, tgt
        assert ReasonCode.TARGET_DRIFT.value in reasons


def test_mg_g5_amount_1000_ok_1001_refused_nested_extra():
    grant = _valid_grant(
        argument_constraints={
            "allowed_keys": ["filename", "content_b64_len_max", "amount", "meta"],
            "filename_suffix": ".txt",
            "content_b64_len_max": 1024,
            "amount_max": 1000,
        }
    )
    ok1000, _ = validate_grant_compatibility(
        grant,
        capability=grant.capability,
        target=grant.target,
        arguments={"filename": "a.txt", "content_b64_len_max": 10, "amount": 1000},
        now=NOW,
    )
    assert ok1000 is True
    ok1001, r1001 = validate_grant_compatibility(
        grant,
        capability=grant.capability,
        target=grant.target,
        arguments={"filename": "a.txt", "content_b64_len_max": 10, "amount": 1001},
        now=NOW,
    )
    assert ok1001 is False
    assert ReasonCode.ARGUMENT_DRIFT.value in r1001
    ok_nest, r_nest = validate_grant_compatibility(
        grant,
        capability=grant.capability,
        target=grant.target,
        arguments={
            "filename": "a.txt",
            "content_b64_len_max": 10,
            "meta": {"amount": 1001},
        },
        now=NOW,
    )
    assert ok_nest is False
    assert ReasonCode.ARGUMENT_DRIFT.value in r_nest
    ok_extra, r_extra = validate_grant_compatibility(
        grant,
        capability=grant.capability,
        target=grant.target,
        arguments={
            "filename": "a.txt",
            "content_b64_len_max": 10,
            "amount": 1,
            "unauthorized": True,
        },
        now=NOW,
    )
    assert ok_extra is False
    assert ReasonCode.ARGUMENT_DRIFT.value in r_extra


def test_mg_g6_expiry_boundaries_fail_closed():
    exp = "2026-09-15T12:00:00+00:00"
    grant = _valid_grant(expires_at=exp, issued_at="2026-09-14T12:00:00+00:00")
    ok_before, _ = validate_grant_compatibility(
        grant,
        capability=grant.capability,
        target=grant.target,
        arguments={"filename": "a.txt", "content_b64_len_max": 10},
        now="2026-09-15T11:59:59+00:00",
    )
    assert ok_before is True
    ok_exact, r_exact = validate_grant_compatibility(
        grant,
        capability=grant.capability,
        target=grant.target,
        arguments={"filename": "a.txt", "content_b64_len_max": 10},
        now=exp,
    )
    assert ok_exact is False
    assert ReasonCode.AUTHORITY_EXPIRED.value in r_exact
    ok_after, r_after = validate_grant_compatibility(
        grant,
        capability=grant.capability,
        target=grant.target,
        arguments={"filename": "a.txt", "content_b64_len_max": 10},
        now="2026-09-15T12:00:01+00:00",
    )
    assert ok_after is False
    assert ReasonCode.AUTHORITY_EXPIRED.value in r_after


def test_mg_g8_single_use_consume_and_retry_no_double_consume():
    from spe_runtime.authority.consume import consume_grant

    env = _envelope_with_send_recommendation()
    grant0 = _valid_grant(use_limit=1, uses_consumed=0)
    # 0 consumed → eligible
    first = form_execution_intent(
        env,
        grant=grant0,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant0.target,
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert first.status == "INTENT_FORMED"
    ok_c, grant1, _ = consume_grant(grant0)
    assert ok_c is True and grant1 is not None
    assert grant1.uses_consumed == 1
    assert grant0.uses_consumed == 0  # original immutable
    # 1 consumed → 2nd form refuse
    second = form_execution_intent(
        env,
        grant=grant1,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant1.target,
        canonical_arguments={"filename": "a.txt", "content_b64_len_max": 10},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert second.status == "BLOCKED"
    codes = set(second.reason_codes)
    assert ReasonCode.AUTHORITY_CONSUMED.value in codes
    # further consume refused (no double-consume)
    ok2, g2, r2 = consume_grant(grant1)
    assert ok2 is False and g2 is None
    assert ReasonCode.AUTHORITY_CONSUMED.value in r2


def test_mg_g12_completed_zero_redispatch():
    for proposed in (
        OutcomeState.DISPATCHING,
        OutcomeState.NOT_EXECUTED,
        OutcomeState.FAILED,
        OutcomeState.PARTIAL,
    ):
        ok, _, _ = transition_outcome(OutcomeState.COMPLETED, proposed)
        assert ok is False


def test_mg_g15_sandbox_traversal_symlink_refused(tmp_path: Path):
    from spe_runtime.execution.effect_ledger import EffectLedger

    sandbox = tmp_path / "sandbox"
    sandbox.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    formed = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "x.txt", "content_b64_len_max": 32},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert formed.status == "INTENT_FORMED"
    intent = formed.intent

    # ../ escape via directory
    trav = str(sandbox / ".." / "outside")
    r1 = write_local_temp_file(
        intent=intent,
        content=b"evil",
        directory=trav,
        sandbox_root=str(sandbox),
        effect_ledger=EffectLedger(),
    )
    assert r1.status == "REJECTED"
    assert ReasonCode.SANDBOX_ESCAPE.value in r1.reason_codes

    # absolute-style filename stripped / confined
    class AbsIntent:
        action_type = "WRITE_LOCAL_TEMP_FILE"
        operation_id = intent.operation_id + "-abs"
        canonical_arguments = {"filename": str(outside / "abs.txt")}

    r2 = write_local_temp_file(
        intent=AbsIntent(),
        content=b"x",
        directory=str(sandbox),
        sandbox_root=str(sandbox),
        effect_ledger=EffectLedger(),
    )
    assert r2.status == "WRITTEN"
    assert Path(r2.path).resolve().is_relative_to(sandbox.resolve())

    # symlink dir pointing outside
    link = sandbox / "linkdir"
    link.symlink_to(outside)
    r3 = write_local_temp_file(
        intent=intent,
        content=b"sym",
        directory=str(link),
        sandbox_root=str(sandbox),
        effect_ledger=EffectLedger(),
    )
    assert r3.status == "REJECTED"
    assert ReasonCode.SANDBOX_ESCAPE.value in r3.reason_codes

    # alt separators in filename
    class AltIntent:
        action_type = "WRITE_LOCAL_TEMP_FILE"
        operation_id = intent.operation_id + "-alt"
        canonical_arguments = {"filename": "..\\..\\evil.txt"}

    r4 = write_local_temp_file(
        intent=AltIntent(),
        content=b"x",
        directory=str(sandbox),
        sandbox_root=str(sandbox),
        effect_ledger=EffectLedger(),
    )
    # basename after norm → evil.txt inside sandbox OR reject; must not escape
    if r4.status == "WRITTEN":
        assert Path(r4.path).resolve().is_relative_to(sandbox.resolve())
    else:
        assert ReasonCode.SANDBOX_ESCAPE.value in r4.reason_codes


def test_mg_g16_duplicate_effect_campaign_zero_duplicates(tmp_path: Path):
    from spe_runtime.execution.effect_ledger import EffectLedger

    env = _envelope_with_send_recommendation()
    grant = _valid_grant()
    formed = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "dup.txt", "content_b64_len_max": 32},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert formed.status == "INTENT_FORMED"
    ledger = EffectLedger()
    r1 = write_local_temp_file(
        intent=formed.intent,
        content=b"one",
        directory=str(tmp_path),
        sandbox_root=str(tmp_path),
        effect_ledger=ledger,
    )
    r2 = write_local_temp_file(
        intent=formed.intent,
        content=b"two",
        directory=str(tmp_path),
        sandbox_root=str(tmp_path),
        effect_ledger=ledger,
    )
    assert r1.status == "WRITTEN"
    assert r2.status == "REJECTED"
    assert ReasonCode.DUPLICATE_EFFECT.value in r2.reason_codes
    assert Path(r1.path).read_bytes() == b"one"
    assert len(ledger) == 1


def test_mg_g17_positive_controls_amount_expiry_sandbox(tmp_path: Path):
    """Positive controls: lawful amount/target/expiry/sandbox still succeed."""
    from spe_runtime.execution.effect_ledger import EffectLedger

    grant = _valid_grant(
        argument_constraints={
            "allowed_keys": ["filename", "content_b64_len_max", "amount"],
            "filename_suffix": ".txt",
            "content_b64_len_max": 1024,
            "amount_max": 1000,
        }
    )
    ok, _ = validate_grant_compatibility(
        grant,
        capability=grant.capability,
        target=grant.target,
        arguments={"filename": "ok.txt", "content_b64_len_max": 8, "amount": 1000},
        now=NOW,
    )
    assert ok is True
    env = _envelope_with_send_recommendation()
    formed = form_execution_intent(
        env,
        grant=grant,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target=grant.target,
        canonical_arguments={"filename": "ok.txt", "content_b64_len_max": 8, "amount": 500},
        expected_effect="create local temp file",
        reversibility_class="REVERSIBLE",
        now=NOW,
    )
    assert formed.status == "INTENT_FORMED"
    adapter = write_local_temp_file(
        intent=formed.intent,
        content=b"pos",
        directory=str(tmp_path),
        sandbox_root=str(tmp_path),
        effect_ledger=EffectLedger(),
    )
    assert adapter.status == "WRITTEN"
    assert adapter.verified_success is False
    assert adapter.network_used is False
