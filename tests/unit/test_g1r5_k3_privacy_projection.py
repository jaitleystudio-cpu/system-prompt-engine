"""G1R-5 K4 privacy projection — adversarial ownership + invariant tests.

Contract owner for privacy_projection is K4 (RING0_WORKING_CONTRACT).
"""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

import pytest

from spe_runtime.authority.models import AuthorityGrant
from spe_runtime.contract import ProtectedIntentContract, propose_requirement
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.privacy import (
    PrivacyClass,
    PrivacyDirective,
    PrivacyProjection,
    ProjectionAction,
    ProjectionScope,
    project_privacy,
)
from spe_runtime.provenance import Provenance
from spe_runtime.requirements import RequirementKind
from spe_runtime.proof.types import content_digest

ROOT = Path(__file__).resolve().parents[2]
SENSITIVE = "SENSITIVE_SENTINEL_DO_NOT_LEAK_9F2C"


def _directives(*pairs: tuple[str, PrivacyClass, ProjectionAction | None]):
    out = []
    for key, cls, act in pairs:
        out.append(PrivacyDirective(field_key=key, privacy_class=cls, action=act))
    return tuple(out)


def test_deterministic_privacy_projection_identity():
    fields = {"budget": 100, "note": "ok"}
    dirs = _directives(
        ("budget", PrivacyClass.PUBLIC, None),
        ("note", PrivacyClass.PUBLIC, None),
    )
    a = project_privacy(
        source_id="src-1",
        source_fields=fields,
        directives=dirs,
        scope=ProjectionScope.USER_VISIBLE,
    )
    b = project_privacy(
        source_id="src-1",
        source_fields=dict(fields),
        directives=dirs,
        scope=ProjectionScope.USER_VISIBLE,
    )
    assert a.projection_id == b.projection_id
    assert a.projection_id.startswith("priv-")


def test_changed_policy_changes_identity():
    fields = {"budget": 100}
    a = project_privacy(
        source_id="src-1",
        source_fields=fields,
        directives=_directives(("budget", PrivacyClass.PUBLIC, None)),
        scope=ProjectionScope.EXPORT,
    )
    b = project_privacy(
        source_id="src-1",
        source_fields=fields,
        directives=_directives(("budget", PrivacyClass.USER_PRIVATE, None)),
        scope=ProjectionScope.EXPORT,
    )
    assert a.projection_id != b.projection_id


def test_changed_scope_changes_identity():
    fields = {"budget": 100}
    dirs = _directives(("budget", PrivacyClass.USER_PRIVATE, None))
    a = project_privacy(
        source_id="src-1", source_fields=fields, directives=dirs, scope=ProjectionScope.INTERNAL
    )
    b = project_privacy(
        source_id="src-1", source_fields=fields, directives=dirs, scope=ProjectionScope.EXPORT
    )
    assert a.projection_id != b.projection_id
    assert a.entries[0].action is ProjectionAction.INCLUDE
    assert b.entries[0].action is ProjectionAction.OMIT


def test_source_semantic_state_unchanged_nested():
    contract = propose_requirement(
        ProtectedIntentContract(),
        semantic_key="budget",
        kind=RequirementKind.MUST,
        value=100,
        provenance=Provenance.USER_EXPLICIT,
    )
    before = {
        "validity": contract.validity.value,
        "nodes": {k: (n.semantic_key, n.value, n.provenance.value) for k, n in contract.graph.nodes.items()},
    }
    fields = {"budget": 100, "nested": {"secret": SENSITIVE}}
    project_privacy(
        source_id="snap-x",
        source_fields=fields,
        directives=_directives(
            ("budget", PrivacyClass.PUBLIC, None),
            ("nested", PrivacyClass.USER_PRIVATE, None),
        ),
        scope=ProjectionScope.EXPORT,
    )
    after = {
        "validity": contract.validity.value,
        "nodes": {k: (n.semantic_key, n.value, n.provenance.value) for k, n in contract.graph.nodes.items()},
    }
    assert before == after
    assert fields["nested"]["secret"] == SENSITIVE


def test_shallow_and_deep_source_mutation_impossible():
    nested = {"x": [1, {"y": SENSITIVE}]}
    fields = {"nested": nested}
    before = deepcopy(fields)
    dig_before = content_digest(fields, prefix="fld-")
    project_privacy(
        source_id="s",
        source_fields=fields,
        directives=_directives(("nested", PrivacyClass.USER_PRIVATE, None)),
        scope=ProjectionScope.USER_VISIBLE,
    )
    assert fields == before
    assert content_digest(fields, prefix="fld-") == dig_before


def test_unknown_classification_fails_closed_omit():
    proj = project_privacy(
        source_id="s",
        source_fields={"secret": SENSITIVE},
        directives=(),  # missing → UNKNOWN
        scope=ProjectionScope.USER_VISIBLE,
    )
    assert proj.entries[0].privacy_class is PrivacyClass.UNKNOWN
    assert proj.entries[0].action is ProjectionAction.OMIT
    view = json.dumps(proj.serialized_view())
    assert SENSITIVE not in view


def test_conflicting_privacy_rules_deterministic():
    with pytest.raises(SpeTypedError) as ei:
        project_privacy(
            source_id="s",
            source_fields={"budget": 1},
            directives=(
                PrivacyDirective("budget", PrivacyClass.PUBLIC),
                PrivacyDirective("budget", PrivacyClass.USER_PRIVATE),
            ),
            scope=ProjectionScope.INTERNAL,
        )
    assert ei.value.code is ErrorCode.K4_PRIVACY_CONFLICT


def test_hidden_data_not_leaked_into_view_or_identity():
    proj = project_privacy(
        source_id="s",
        source_fields={"budget": 100, "ssn": SENSITIVE},
        directives=_directives(
            ("budget", PrivacyClass.PUBLIC, None),
            ("ssn", PrivacyClass.USER_PRIVATE, None),
        ),
        scope=ProjectionScope.EXPORT,
    )
    blob = json.dumps(proj.to_canonical_payload()) + json.dumps(proj.serialized_view())
    assert SENSITIVE not in blob
    assert "ssn" not in proj.serialized_view()["fields"]


def test_hidden_data_not_leaked_into_errors():
    with pytest.raises(SpeTypedError) as ei:
        project_privacy(
            source_id="s",
            source_fields={"ssn": SENSITIVE},
            directives=(
                PrivacyDirective("ssn", PrivacyClass.USER_PRIVATE, ProjectionAction.INCLUDE),
            ),
            scope=ProjectionScope.EXPORT,
        )
    assert ei.value.code is ErrorCode.PRIVACY_ESCALATION
    assert SENSITIVE not in str(ei.value)
    assert SENSITIVE not in repr(ei.value)


def test_privacy_projection_cannot_mint_or_widen_authority():
    proj = project_privacy(
        source_id="s",
        source_fields={"x": 1},
        directives=_directives(("x", PrivacyClass.PUBLIC, None)),
        scope=ProjectionScope.INTERNAL,
    )
    assert isinstance(proj, PrivacyProjection)
    assert not isinstance(proj, AuthorityGrant)
    assert not hasattr(proj, "grant_id")
    assert not hasattr(proj, "capability")


def test_provenance_preserved_no_trust_upgrade():
    proj = project_privacy(
        source_id="s",
        source_fields={"budget": 100},
        directives=_directives(("budget", PrivacyClass.PUBLIC, None)),
        scope=ProjectionScope.INTERNAL,
        source_provenance={"budget": Provenance.MODEL_PROPOSED},
    )
    assert proj.entries[0].provenance is Provenance.MODEL_PROPOSED
    # projection must not rewrite provenance labels
    assert proj.entries[0].provenance is not Provenance.USER_EXPLICIT
    assert proj.entries[0].provenance is not Provenance.USER_CONFIRMED


def test_invalid_scope_typed_error():
    with pytest.raises(SpeTypedError) as ei:
        project_privacy(
            source_id="s",
            source_fields={"x": 1},
            directives=_directives(("x", PrivacyClass.PUBLIC, None)),
            scope="NOT_A_SCOPE",
        )
    assert ei.value.code is ErrorCode.K4_PRIVACY_INVALID_SCOPE


def test_invalid_privacy_class_typed_error():
    with pytest.raises(SpeTypedError) as ei:
        project_privacy(
            source_id="s",
            source_fields={"x": 1},
            directives=(PrivacyDirective("x", "TOP_SECRET"),),  # type: ignore[arg-type]
            scope=ProjectionScope.INTERNAL,
        )
    assert ei.value.code is ErrorCode.K4_PRIVACY_INVALID_DIRECTIVE


def test_scope_binding_enforced():
    fields = {"token": SENSITIVE}
    dirs = _directives(("token", PrivacyClass.USER_PRIVATE, None))
    internal = project_privacy(
        source_id="s", source_fields=fields, directives=dirs, scope=ProjectionScope.INTERNAL
    )
    export = project_privacy(
        source_id="s", source_fields=fields, directives=dirs, scope=ProjectionScope.EXPORT
    )
    assert internal.scope is ProjectionScope.INTERNAL
    assert export.scope is ProjectionScope.EXPORT
    assert internal.projection_id != export.projection_id
    # Cannot treat export projection as internal-equivalent
    assert internal.serialized_view()["fields"]["token"] == SENSITIVE
    assert "token" not in export.serialized_view()["fields"]


def test_canonical_writer_unique_and_exported():
    import spe_runtime.privacy as pkg
    import spe_runtime.privacy.project as project_mod

    assert pkg.project_privacy is project_mod.project_privacy
    assert "project_privacy" in pkg.__all__
    # No alternate public mint helpers
    for name in ("mint_privacy_projection", "build_privacy_projection", "create_privacy_projection"):
        assert not hasattr(pkg, name)


def test_mutation_removing_private_include_guard_is_detected():
    """Static oracle: INCLUDE of USER_PRIVATE outside INTERNAL must be gated."""
    from pathlib import Path
    import re
    import spe_runtime.privacy.project as project_mod

    src = Path(project_mod.__file__).read_text(encoding="utf-8")
    assert "PRIVACY_ESCALATION" in src
    assert re.search(r"USER_PRIVATE", src)
    assert "cannot INCLUDE USER_PRIVATE outside INTERNAL scope" in src


def test_k3_cannot_mutate_k0_k1_truth():
    """Projection is orthogonal to K0 contract — values unchanged."""
    c = propose_requirement(
        ProtectedIntentContract(),
        semantic_key="budget",
        kind=RequirementKind.MUST,
        value=100,
        provenance=Provenance.USER_EXPLICIT,
    )
    before = c.protected_for("budget").value
    project_privacy(
        source_id="s",
        source_fields={"budget": before},
        directives=_directives(("budget", PrivacyClass.USER_PRIVATE, ProjectionAction.REDACT)),
        scope=ProjectionScope.USER_VISIBLE,
        source_provenance={"budget": Provenance.USER_EXPLICIT},
    )
    assert c.protected_for("budget").value == 100
    assert c.protected_for("budget").provenance is Provenance.USER_EXPLICIT


def test_error_code_wire_strings():
    assert ErrorCode.K4_PRIVACY_CONFLICT.value == "K4_PRIVACY_CONFLICT"
    assert ErrorCode.K4_PRIVACY_INVALID_DIRECTIVE.value == "K4_PRIVACY_INVALID_DIRECTIVE"
    assert ErrorCode.K4_PRIVACY_INVALID_SCOPE.value == "K4_PRIVACY_INVALID_SCOPE"
    assert ErrorCode.K4_PRIVACY_PROJECTION_FAILED.value == "K4_PRIVACY_PROJECTION_FAILED"
