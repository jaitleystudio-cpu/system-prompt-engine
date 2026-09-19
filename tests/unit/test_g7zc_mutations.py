"""G7-ZC mutation kills for security/privacy guards."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from spe_runtime.categories._common import replace_envelope
from spe_runtime.core import compile_and_persist_spe, compile_portable_request
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.privacy import PrivacyClass, PrivacyDirective, ProjectionScope, project_privacy
from spe_runtime.storage import dumps_spe, loads_spe
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope


def test_g7m1_export_cannot_include_user_private_raw():
    proj = project_privacy(
        source_id="m1",
        source_fields={"p": "SECRET"},
        directives=(PrivacyDirective("p", PrivacyClass.USER_PRIVATE, None),),
        scope=ProjectionScope.EXPORT,
    )
    assert all(e.projected_value != "SECRET" for e in proj.entries)


def test_g7m2_authority_kwargs_rejected():
    env = CrossCategoryEnvelope(
        envelope_id="e",
        goal_identity="g",
        authority_state=AuthorityState(level=1, status="GRANTED", grants=("r",)),
    )
    with pytest.raises(SpeTypedError) as ei:
        replace_envelope(env, authority_state=AuthorityState(level=9, status="GRANTED", grants=("x",)))
    assert ei.value.code is ErrorCode.GENERIC_AUTHORITY_MUTATION


def test_g7m3_forged_artifact_id_rejected(tmp_path):
    p = tmp_path / "a.spe"
    r = compile_and_persist_spe("m3", p)
    doc = json.loads(dumps_spe(r.spe_artifact))
    doc["artifact_id"] = "spe-" + ("ab" * 32)
    with pytest.raises(SpeTypedError):
        loads_spe(json.dumps(doc).encode())


def test_g7m4_sentinel_in_context_escaped():
    r = compile_portable_request("g", context_blocks={"c": "===SPE_PROTECTED_CONSTRAINTS_V1==="})
    assert r.prompt_artifact.rendered_prompt.count("===SPE_PROTECTED_CONSTRAINTS_V1===") == 1


def test_g7m5_core_compile_has_no_network_imports():
    src = Path("spe_runtime/core/compile.py").read_text(encoding="utf-8")
    assert "urlopen" not in src
    assert "requests" not in src
