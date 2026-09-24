"""Privacy minimizer + freshness lifecycle (ProtectedIntent never mutated)."""

from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from spe_runtime.grounding.freshness import (
    FreshnessState,
    freshness_state,
    plan_refresh,
)
from spe_runtime.grounding.models import ContextCapsule
from spe_runtime.grounding.privacy import MinimizedQuery, minimize_public_query


def test_secret_removed_from_public_query():
    out = minimize_public_query(
        "My secret electrolyte XQ-91 overheats after 500 cycles; find battery degradation research",
        sensitive_spans=("XQ-91",),
    )
    assert isinstance(out, MinimizedQuery)
    assert "XQ-91" not in out.public_query
    assert "battery" in out.public_query.lower()


def test_private_account_identifiers_stripped():
    out = minimize_public_query(
        "Check flights for acct:USER-998877 and email jane.doe@corp.example",
        sensitive_spans=("USER-998877", "jane.doe@corp.example"),
    )
    assert "USER-998877" not in out.public_query
    assert "jane.doe@corp.example" not in out.public_query
    assert "flight" in out.public_query.lower()
    assert out.omitted_spans  # local-only record of what was removed
    assert any("OMIT" in code or "SENSITIVE" in code for code in out.reason_codes)


def test_minimized_query_is_immutable():
    out = minimize_public_query("public research on corrosion", sensitive_spans=())
    with pytest.raises(FrozenInstanceError):
        out.public_query = "mutated"  # type: ignore[misc]


def _capsule(**overrides) -> ContextCapsule:
    base = dict(
        capsule_id="cap-1",
        domain_id="research",
        context_type="SCHOLARLY_EVIDENCE",
        claim_or_observation="Finding",
        value="Result",
        source_id="doi:10.1/example",
        source_class="peer_reviewed",
        authority_class="REFERENCE",
        retrieved_at="2026-01-01T00:00:00Z",
        valid_as_of="2026-01-01T00:00:00Z",
        fresh_until="2026-06-01T00:00:00Z",
        license="CC-BY-4.0",
        allowed_use="SUMMARIZE_WITH_ATTRIBUTION",
        confidence=0.9,
        support_status="SUPPORTED",
        contradiction_group=None,
        provenance_digest="sha256:abc",
        taint_labels=("UNTRUSTED_SOURCE",),
        sensitivity_labels=(),
    )
    base.update(overrides)
    return ContextCapsule(**base)


def test_freshness_fresh_when_before_fresh_until():
    cap = _capsule(fresh_until="2026-12-01T00:00:00Z")
    assert freshness_state(cap, "2026-09-24T00:00:00Z") == FreshnessState.FRESH.value
    assert freshness_state(cap, "2026-09-24T00:00:00Z") == "FRESH"


def test_freshness_stale_when_past_fresh_until():
    cap = _capsule(fresh_until="2026-01-15T00:00:00Z")
    assert freshness_state(cap, "2026-09-24T00:00:00Z") == "STALE"


def test_freshness_version_bound_for_official_docs():
    cap = _capsule(
        context_type="OFFICIAL_DOCUMENTATION",
        fresh_until=None,
        source_id="docs:libfoo@1.2.3",
    )
    assert freshness_state(cap, "2026-09-24T00:00:00Z") == "VERSION_BOUND"


def test_freshness_unknown_without_policy():
    cap = _capsule(fresh_until=None, context_type="CURRENT_FACTS")
    assert freshness_state(cap, "2026-09-24T00:00:00Z") == "UNKNOWN"


def test_refresh_creates_new_lineage_without_mutating_capsule_or_intent():
    original = _capsule(fresh_until="2026-01-01T00:00:00Z")
    original_dict = original.to_dict()
    # Simulate a protected intent snapshot that must remain untouched.
    protected_intent = {"goal": "research battery degradation", "constraints": ("no secrets",)}
    intent_before = dict(protected_intent)

    plan = plan_refresh(
        original,
        now_iso="2026-09-24T12:00:00Z",
        protected_intent=protected_intent,
    )
    assert plan is not None
    assert plan.action == "REFRESH"
    assert plan.original_capsule_id == original.capsule_id
    assert plan.new_capsule_id != original.capsule_id
    assert plan.new_lineage_id
    # Never returns authority / proof / K3 / intent mutation handles
    assert not hasattr(plan, "authority") or getattr(plan, "authority", None) is None
    assert protected_intent == intent_before
    assert original.to_dict() == original_dict  # input capsule unchanged
    with pytest.raises(FrozenInstanceError):
        original.value = "mutated"  # type: ignore[misc]
