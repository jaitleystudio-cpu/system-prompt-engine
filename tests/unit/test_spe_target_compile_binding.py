"""Executable proofs + fail-closed attacks for SPE → formatTargetModelPrompt.

Proofs: mandatory obligations, ProtectedIntent, authority, constraints,
evidence IDs, unknowns, STOP conditions.

Attacks that must fail closed: tampered .spe, wrong manifest, missing section,
duplicate section, stale hash, unknown target, future format, malicious field,
adapter dropping one constraint, adapter changing authority, adapter inventing
evidence.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from spe_runtime.adapters.spe_target_compile import (
    CANONICAL_COMPILER_BLOB,
    CANONICAL_COMPILER_PATH,
    CANONICAL_COMPILER_SHA,
    CANONICAL_COMPILER_SOURCE_SHA,
    CANONICAL_COMPILER_SYMBOL,
    TARGET_EXPORT_MODELS,
    TargetCompileError,
    assert_canonical_compiler_bytes,
    compile_spe_for_target,
    deserialize_spe,
    invoke_format_target_model_prompt,
    recover_intermediate,
    resolve_target_model,
    semantic_compare,
)
from spe_runtime.portability.spe_artifact import (
    SPE_FORMAT_V1,
    build_spe_artifact,
    dumps_spe_artifact,
    verify_integrity,
)

T0 = "2026-10-04T00:00:00Z"
ROOT = Path(__file__).resolve().parents[2]


def _artifact(**overrides) -> dict:
    base = {
        "user_request": "Draft a launch checklist. Budget must remain $2000.",
        "category": "AI Assistant",
        "target": "any",
        "envelope": {
            "network_mode": "NONE",
            "payload": {
                "authority_state": {"grants": [], "level": 0, "status": "NONE"},
                "hard_constraints": [
                    {
                        "constraint_id": "budget-cap",
                        "statement": "Budget must remain $2000.",
                        "strength": "HARD",
                    },
                    {
                        "constraint_id": "one-page",
                        "statement": "Deliverable is one page.",
                        "strength": "HARD",
                    },
                ],
                "facts": [
                    {
                        "fact_id": "f-user-request",
                        "statement": "Draft a launch checklist. Budget must remain $2000.",
                        "provenance_ids": ["p-user"],
                    },
                    {
                        "fact_id": "f-budget",
                        "statement": "Budget ceiling is exactly 2000 USD.",
                        "provenance_ids": ["p-user"],
                    },
                ],
                "provenance": [{"provenance_id": "p-user", "source": "test"}],
                "uncertainties": [{"id": "unc-1", "statement": "Launch date unknown"}],
                "execution_grants": [],
            },
        },
        "wasm": {
            "status": None,
            "disposition": None,
            "reason_code": None,
            "sha256": None,
            "imports": None,
            "network_mode": "NONE",
            "used_ts_fallback": False,
        },
        "rendered_prompt": "Draft a launch checklist under budget.",
        "intent": {
            "confirmed": [
                {"id": "goal", "label": "Goal", "text": "Draft a launch checklist"},
                {"id": "budget", "label": "Must follow", "text": "Budget must remain $2000."},
            ],
            "assumed": [],
            "unknowns": [
                {"id": "u-date", "label": "Questions", "text": "What is the launch date?"}
            ],
            "conflicts": [],
        },
        "lineage": {
            "engine": "spe_runtime",
            "abi": "spe.universal-abi.v1",
            "ui": "none",
            "not_a_release": True,
        },
    }
    base.update(overrides)
    return build_spe_artifact(base, spe_format=SPE_FORMAT_V1, created_at_utc=T0)


def test_required_targets_preserve_all_surfaces():
    art = _artifact()
    text = dumps_spe_artifact(art)
    for target in (
        "Claude Code",
        "OpenAI Codex",
        "Cursor",
        "Grok",
        "Local Coder",
        "Generic",
    ):
        result = compile_spe_for_target(text, target)
        prompt = result["prompt"]
        ir = result["intermediate"]
        assert result["target"] in TARGET_EXPORT_MODELS
        assert ir["protected_intent_text"] in prompt
        assert "Budget must remain $2000." in prompt
        assert "budget-cap" in prompt
        assert "one-page" in prompt
        assert "Deliverable is one page." in prompt
        assert "f-user-request" in prompt
        assert "f-budget" in prompt
        assert "What is the launch date?" in prompt
        assert "Launch date unknown" in prompt
        for stop in ir["stop_conditions"]:
            assert stop in prompt
        assert result["authority"] == ir["authority"]
        assert result["authority"]["status"] == "NONE"
        assert result["authority"]["level"] == 0
        assert result["compiler"]["symbol"] == CANONICAL_COMPILER_SYMBOL
        assert result["compiler"]["defining_sha"] == CANONICAL_COMPILER_SHA
        assert (ROOT / CANONICAL_COMPILER_PATH).is_file()


def test_semantic_compare_after_reopen_roundtrip():
    art = _artifact()
    text = dumps_spe_artifact(art)
    a = compile_spe_for_target(text, "grok")
    b = compile_spe_for_target(text, "grok")
    compare = semantic_compare(a, b)
    assert compare["equal"] is True
    assert compare["protected_intent"] is True
    assert compare["authority"] is True
    assert compare["constraints"] is True
    assert compare["evidence_ids"] is True
    assert compare["unknowns"] is True
    assert compare["stop_conditions"] is True


def test_attack_tampered_spe_stale_hash():
    art = _artifact()
    tampered = copy.deepcopy(art)
    tampered["rendered_prompt"] = "mutated without recomputing integrity"
    with pytest.raises(TargetCompileError) as exc:
        compile_spe_for_target(tampered, "claude")
    assert exc.value.code == "STALE_HASH"


def test_attack_future_format():
    art = _artifact()
    future = copy.deepcopy(art)
    future["spe_format"] = "spe.artifact.v9"
    with pytest.raises(TargetCompileError) as exc:
        compile_spe_for_target(future, "claude")
    assert exc.value.code == "FUTURE_FORMAT"


def test_attack_missing_section():
    art = _artifact()
    broken = copy.deepcopy(art)
    del broken["intent"]
    # integrity still old — deserialize should fail missing section or stale
    with pytest.raises(TargetCompileError) as exc:
        compile_spe_for_target(broken, "claude")
    assert exc.value.code in {"MISSING_SECTION", "STALE_HASH", "TAMPERED_SPE"}


def test_attack_duplicate_section_ids():
    art = _artifact()
    dup = copy.deepcopy(art)
    dup["envelope"]["payload"]["hard_constraints"].append(
        {
            "constraint_id": "budget-cap",
            "statement": "duplicate id",
            "strength": "HARD",
        }
    )
    # recompute integrity so only duplicate check fires
    dup.pop("integrity", None)
    from spe_runtime.portability.spe_artifact import compute_integrity

    dup["integrity"] = compute_integrity(dup)
    dup["integrity"]["state"] = "COMPUTED"
    with pytest.raises(TargetCompileError) as exc:
        compile_spe_for_target(dup, "claude")
    assert exc.value.code == "DUPLICATE_SECTION"


def test_attack_unknown_target():
    art = _artifact()
    with pytest.raises(TargetCompileError) as exc:
        compile_spe_for_target(dumps_spe_artifact(art), "not-a-real-model")
    assert exc.value.code == "UNKNOWN_TARGET"


def test_attack_malicious_field():
    art = _artifact()
    bad = copy.deepcopy(art)
    bad["envelope"]["payload"]["hard_constraints"] = "not-a-list"
    bad.pop("integrity", None)
    from spe_runtime.portability.spe_artifact import compute_integrity

    bad["integrity"] = compute_integrity(bad)
    bad["integrity"]["state"] = "COMPUTED"
    with pytest.raises(TargetCompileError) as exc:
        compile_spe_for_target(bad, "cursor")
    assert exc.value.code in {"MALICIOUS_FIELD", "STALE_HASH", "TAMPERED_SPE"}


def test_attack_adapter_dropping_constraint_fails_closed():
    art = _artifact()
    text = dumps_spe_artifact(art)

    def drop_constraint(ir):
        ir["requirements"] = [c for c in ir["requirements"] if c["constraint_id"] != "one-page"]
        ir["test_gates"] = [g for g in ir["test_gates"] if "one-page" not in g]
        ir["stop_conditions"] = [s for s in ir["stop_conditions"] if "one-page" not in s]
        return ir

    with pytest.raises(TargetCompileError) as exc:
        compile_spe_for_target(text, "codex", mutate_intermediate=drop_constraint)
    assert exc.value.code == "CONSTRAINT_DROPPED"


def test_attack_adapter_changing_authority_fails_closed():
    art = _artifact()
    text = dumps_spe_artifact(art)

    def escalate(ir):
        ir["authority"] = {"grants": ["DEPLOY"], "level": 99, "status": "ROOT"}
        return ir

    with pytest.raises(TargetCompileError) as exc:
        compile_spe_for_target(text, "grok", mutate_intermediate=escalate)
    assert exc.value.code == "AUTHORITY_CHANGED"


def test_attack_adapter_inventing_evidence_fails_closed():
    art = _artifact()
    text = dumps_spe_artifact(art)

    def invent(ir):
        ir["evidence_lines"] = list(ir["evidence_lines"]) + [
            "[EVIDENCE:f-invented] I made this up (provenance=none)"
        ]
        return ir

    with pytest.raises(TargetCompileError) as exc:
        compile_spe_for_target(text, "local_coder", mutate_intermediate=invent)
    assert exc.value.code == "EVIDENCE_INVENTED"


def test_wrong_manifest_style_integrity_mismatch_via_deserialize():
    """Wrong/stale integrity hash is refused before compile."""
    art = _artifact()
    wrong = copy.deepcopy(art)
    wrong["integrity"] = {
        "algorithm": "SHA-256",
        "content_sha256": "0" * 64,
        "state": "COMPUTED",
    }
    with pytest.raises(TargetCompileError) as exc:
        deserialize_spe(wrong)
    assert exc.value.code == "STALE_HASH"


def test_format_target_model_prompt_symbol_parity_smoke():
    """The adapter calls the canonical TS function, not a Python rewrite."""
    assert assert_canonical_compiler_bytes() == CANONICAL_COMPILER_BLOB
    prompt = invoke_format_target_model_prompt(
        "claude",
        "mission",
        "abc123",
        "protected",
        ["step-a"],
        ["[EVIDENCE:e1] fact"],
        [],
        ["[UNKNOWN:u1] gap"],
        ["gate-1"],
        ["stop-1"],
    )
    assert "Target Profile: CLAUDE" in prompt
    assert "Authority Level: ADVISORY_ONLY" in prompt
    assert '### ProtectedIntent (Immutable)\n"protected"' in prompt
    assert "Role: Claude Code / Anthropic Senior Systems Engineer" in prompt
    assert "Kernel TargetModelId mapping: claude" in prompt
    assert "MUST_NOT deploy, merge, host, release" in prompt
    assert "Do not invent tools beyond the continuation contract." in prompt
    assert resolve_target_model("Claude Code") == "claude"
    assert resolve_target_model("OpenAI Codex") == "codex"
    assert resolve_target_model("Local Coder") == "local_coder"
    ts = (ROOT / CANONICAL_COMPILER_PATH).read_text(encoding="utf-8")
    assert "export function formatTargetModelPrompt" in ts
    assert "def format_target_model_prompt" not in ts
    assert CANONICAL_COMPILER_SHA == "2536c469a43bd8fe43c5342fb58a8b8270a2143f"
    assert CANONICAL_COMPILER_SOURCE_SHA == "5011b5409c86cc7f5426a49d963b72a648bc2765"
    assert not (ROOT / "spe_runtime/adapters/target_model_prompt.py").exists()


def test_recover_intermediate_keeps_protected_intent_bytes():
    art = verify_integrity(_artifact())
    ir = recover_intermediate(art)
    assert ir["protected_intent"]["confirmed"][0]["id"] == "goal"
    assert ir["protected_intent_text"] == art["user_request"]
    assert {c["constraint_id"] for c in ir["requirements"]} == {"budget-cap", "one-page"}
    assert {e["fact_id"] for e in ir["evidence"]} == {"f-user-request", "f-budget"}


def test_saved_package_extras_reach_prompt_and_drop_fails_closed():
    """mustNot, privacy, and rollback from the saved package are not compiler defaults.

    Deleting one extra in the adapter must fail closed and name that field.
    A package with no extras still compiles (covered by the target sweep).
    """
    art = _artifact()
    patched = copy.deepcopy(art)
    patched["envelope"]["payload"]["extras"] = {
        "mustNot": ["MUST_NOT spend beyond the saved cap."],
        "privacy": ["Privacy: do not export the saved customer list."],
        "rollback": ["Rollback: restore the saved baseline if the gate fails."],
    }
    patched["envelope"]["payload"]["hard_constraints"].extend(
        [
            {
                "constraint_id": "no-spend",
                "statement": "MUST_NOT spend beyond the saved cap.",
                "strength": "HARD",
                "kind": "MUST_NOT",
            },
            {
                "constraint_id": "no-export",
                "statement": "Privacy: do not export the saved customer list.",
                "strength": "HARD",
                "kind": "PRIVACY",
            },
            {
                "constraint_id": "revert-sha",
                "statement": "Rollback: restore the saved baseline if the gate fails.",
                "strength": "HARD",
                "kind": "ROLLBACK",
            },
        ]
    )
    patched.pop("integrity", None)
    from spe_runtime.portability.spe_artifact import compute_integrity

    patched["integrity"] = compute_integrity(patched)
    result = compile_spe_for_target(patched, "grok")
    prompt = result["prompt"]
    assert "MUST_NOT spend beyond the saved cap." in prompt
    assert "Privacy: do not export the saved customer list." in prompt
    assert "Rollback: restore the saved baseline if the gate fails." in prompt
    assert "no-spend" in prompt
    assert "no-export" in prompt
    assert "revert-sha" in prompt
    # Saved mustNot replaces the compiler default instead of dropping the package text.
    assert "MUST_NOT deploy, merge, host, release" not in prompt
    assert result["intermediate"]["extras"]["mustNot"]
    assert result["intermediate"]["extras"]["privacy"]
    assert result["intermediate"]["extras"]["rollback"]

    def drop_privacy(ir):
        ir["extras"]["privacy"] = []
        return ir

    with pytest.raises(TargetCompileError) as exc:
        compile_spe_for_target(patched, "grok", mutate_intermediate=drop_privacy)
    assert exc.value.code == "EXTRAS_DROPPED"
    assert "privacy" in exc.value.reason
