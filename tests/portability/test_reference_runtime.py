"""ReferenceRuntime wraps existing SPE; offline; no XCAT semantic change."""

from __future__ import annotations

from spe_runtime.portability.conformance import ReferenceRuntime
from spe_runtime.xcat.handoff import HandoffResult
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope


def _env(**over):
    base = dict(
        envelope_id="rt-1",
        goal_identity="g",
        facts=({"fact_id": "f1", "statement": "s", "provenance_ids": ["p1"]},),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
        hard_constraints=(
            {"constraint_id": "c1", "statement": "hard", "strength": "HARD"},
        ),
        user_preferences=(),
        analysis=None,
        recommendation=None,
        rendering=None,
        authority_state=AuthorityState(level=0, status="NONE", grants=()),
        execution_grants=(),
        failures=(),
        taint_labels=("external_untrusted",),
        sensitivity_labels=("USER_PRIVATE",),
        category_trace=("CAT:C02",),
    )
    base.update(over)
    return CrossCategoryEnvelope(**base)


def test_offline_network_none():
    rt = ReferenceRuntime()
    assert rt.network_mode == "NONE"
    assert rt.network_used() is False
    assert rt.declaration.network_mode == "NONE"
    assert rt.declaration.status in {"IMPLEMENTING", "CONFORMANCE_PARTIAL"}


def test_export_import_round_trip_preserves_semantics():
    rt = ReferenceRuntime()
    env = _env()
    data = rt.export_envelope(env)
    back = rt.import_envelope(data)
    assert back.envelope_id == env.envelope_id
    assert back.to_dict()["provenance"] == env.to_dict()["provenance"]
    assert back.authority_state.status == "NONE"
    assert list(back.sensitivity_labels) == ["USER_PRIVATE"]


def test_handoff_delegates_xcat_unchanged():
    rt = ReferenceRuntime()
    before = _env()
    after = _env(category_trace=("CAT:C02", "CAT:C06"))
    # Valid path
    assert rt.validate_handoff(before, after, "CAT:C02", "CAT:C06") == HandoffResult.VALID
    # Provenance loss still REFUSE (XCAT semantics unchanged)
    after_bad = _env(provenance=(), category_trace=("CAT:C02", "CAT:C06"))
    assert (
        rt.validate_handoff(before, after_bad, "CAT:C02", "CAT:C06")
        == HandoffResult.REFUSE
    )
