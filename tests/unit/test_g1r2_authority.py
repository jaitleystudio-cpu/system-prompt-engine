"""G1R-2 authority hardening — A1 replace_envelope + A2 X09 fail-closed."""

from __future__ import annotations

import pytest

from spe_runtime.authority import (
    AuthorityEvent,
    apply_authority_event,
    validate_authority_event,
)
from spe_runtime.categories._common import replace_envelope
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.xcat.invariants import validate_authority_non_escalation
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope


def _env(**overrides) -> CrossCategoryEnvelope:
    base = dict(
        envelope_id="env-auth-1",
        goal_identity="goal-auth",
        authority_state=AuthorityState(level=1, status="GRANTED", grants=("read",)),
    )
    base.update(overrides)
    return CrossCategoryEnvelope(**base)


def _grant_event(**overrides) -> AuthorityEvent:
    base = dict(
        kind="EXTERNAL_GRANT",
        subject="operator",
        target="env-auth-1",
        scope=("write",),
        max_level=3,
        revocation_state="ACTIVE",
    )
    base.update(overrides)
    return AuthorityEvent(**base)


# ---------------------------------------------------------------------------
# A1 — replace_envelope cannot write authority
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "kwargs",
    [
        {"authority_state": AuthorityState(level=9, status="GRANTED", grants=("god",))},
        {"authority_event": object()},
        {"grant": {"id": "g"}},
        {"permission": "admin"},
        {"consent": True},
        {"execution_grants": ({"capability": "SEND", "authorized": True},)},
    ],
)
def test_replace_envelope_rejects_authority_controlled_kwargs(kwargs):
    env = _env()
    with pytest.raises(SpeTypedError) as ei:
        replace_envelope(env, **kwargs)
    assert ei.value.code is ErrorCode.GENERIC_AUTHORITY_MUTATION
    assert ei.value.code.value == "K4_GENERIC_AUTHORITY_MUTATION"


def test_replace_envelope_rejects_authority_state_injection():
    env = _env()
    with pytest.raises(SpeTypedError) as ei:
        replace_envelope(
            env,
            authority_state=AuthorityState(level=9, status="GRANTED", grants=("admin",)),
        )
    assert ei.value.code is ErrorCode.GENERIC_AUTHORITY_MUTATION


def test_replace_envelope_allows_non_authority_fields():
    env = _env()
    after = replace_envelope(env, category_trace=("CAT:C01",))
    assert after.category_trace == ("CAT:C01",)
    assert after.authority_state == env.authority_state


# ---------------------------------------------------------------------------
# A2 — X09 fail-closed for nontyped events
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "bad_event",
    [None, {}, object(), "yes", {"type": "EXTERNAL_GRANT", "by": "operator"}, []],
)
def test_x09_rejects_nontyped_authority_events(bad_event):
    before = _env()
    after = _env(
        authority_state=AuthorityState(
            level=5, status="GRANTED", grants=("read", "write", "admin")
        )
    )
    assert validate_authority_non_escalation(before, after, bad_event) is False
    assert validate_authority_event(bad_event, before, after) is False


def test_x09_rejects_confused_deputy_authority_object():
    """Confused deputy: any truthy object must NOT authorize escalation."""
    before = _env()
    after = _env(
        authority_state=AuthorityState(level=9, status="GRANTED", grants=("god",))
    )
    assert validate_authority_non_escalation(before, after, object()) is False


def test_typed_authority_event_authorizes_escalation():
    before = _env()
    after = _env(
        authority_state=AuthorityState(
            level=3, status="GRANTED", grants=("read", "write")
        )
    )
    event = _grant_event()
    assert validate_authority_event(event, before, after) is True
    assert validate_authority_non_escalation(before, after, event) is True


def test_x09_rejects_wrong_kind():
    before = _env()
    after = _env(
        authority_state=AuthorityState(level=3, status="GRANTED", grants=("read", "write"))
    )
    event = _grant_event(kind="INTERNAL_MINT")
    assert validate_authority_event(event, before, after) is False


def test_x09_rejects_wrong_target():
    before = _env()
    after = _env(
        authority_state=AuthorityState(level=3, status="GRANTED", grants=("read", "write"))
    )
    event = _grant_event(target="other-env")
    assert validate_authority_event(event, before, after) is False


def test_x09_rejects_revoked_event():
    before = _env()
    after = _env(
        authority_state=AuthorityState(level=3, status="GRANTED", grants=("read", "write"))
    )
    event = _grant_event(revocation_state="REVOKED")
    assert validate_authority_event(event, before, after) is False


def test_x09_rejects_empty_subject():
    before = _env()
    after = _env(
        authority_state=AuthorityState(level=3, status="GRANTED", grants=("read", "write"))
    )
    event = _grant_event(subject="")
    assert validate_authority_event(event, before, after) is False


def test_x09_rejects_level_above_max():
    before = _env()
    after = _env(
        authority_state=AuthorityState(level=9, status="GRANTED", grants=("read", "write"))
    )
    event = _grant_event(max_level=3)
    assert validate_authority_event(event, before, after) is False


def test_x09_rejects_grants_outside_scope():
    before = _env()
    after = _env(
        authority_state=AuthorityState(
            level=3, status="GRANTED", grants=("read", "write", "admin")
        )
    )
    event = _grant_event(scope=("write",), max_level=3)
    assert validate_authority_event(event, before, after) is False


def test_x09_rejects_negative_max_level():
    before = _env()
    after = _env(
        authority_state=AuthorityState(level=0, status="GRANTED", grants=("read",))
    )
    event = _grant_event(max_level=-1, scope=())
    # Escalation may or may not apply; validator itself must reject
    assert validate_authority_event(event, before, after) is False


def test_x09_stable_authority_ok_without_event():
    before = _env()
    after = _env(authority_state=before.authority_state)
    assert validate_authority_non_escalation(before, after, None) is True


# ---------------------------------------------------------------------------
# Canonical writer
# ---------------------------------------------------------------------------


def test_apply_authority_event_is_canonical_writer():
    before = _env()
    event = _grant_event()
    after = apply_authority_event(before, event)
    assert after.authority_state.level == 3
    assert set(after.authority_state.grants) == {"read", "write"}
    assert after.envelope_id == before.envelope_id


def test_apply_authority_event_rejects_invalid_event():
    before = _env()
    event = _grant_event(target="wrong")
    with pytest.raises(SpeTypedError):
        apply_authority_event(before, event)


# ---------------------------------------------------------------------------
# Semantic lease != authority (light stub)
# ---------------------------------------------------------------------------


def test_semantic_lease_is_not_authority():
    """A lease-shaped object must not authorize X09 escalation."""

    class SemanticLeaseStub:
        def __init__(self) -> None:
            self.snapshot_id = "snap-1"
            self.scope = ("write",)
            self.authority_grant = None  # leases do not carry authority

    before = _env()
    after = _env(
        authority_state=AuthorityState(level=5, status="GRANTED", grants=("read", "write"))
    )
    lease = SemanticLeaseStub()
    assert lease.authority_grant is None
    assert validate_authority_non_escalation(before, after, lease) is False
    assert not isinstance(lease, AuthorityEvent)
