"""Task57R receipt custody: caller flags cannot mint ENFORCEMENT_VERIFIED."""

from __future__ import annotations

import pytest

from spe_runtime.quality.engine import (
    evaluate_from_k3,
    evaluate_obligations,
    quality_delta,
    reconstruct,
    repair_is_admissible,
    run_mode,
    subject_digest,
    subject_from_k3,
)
from tests.unit.test_quality_task57 import _drop_section, _protected, _replace_section, _subject


def _k3_output(subject: dict | None = None) -> dict:
    subject = subject if subject is not None else _subject()
    protected = subject["protected_intent"]
    binding = {
        "authority_state": protected["authority_state"],
        "budget": protected["budget"],
        "desired_output": protected["desired_output"],
        "facts": protected["facts"],
        "goal": protected["goal"],
        "hard_constraints": protected["hard_constraints"],
        "provenance": protected["provenance"],
    }
    return {
        "category_context": {
            "taxonomy_version": subject["xcat"]["taxonomy_version"],
            "xcat_id": f"CAT:{protected['category']}",
        },
        "prompt_effect_plan": subject["effect_plan"],
        "proof_refs": list(subject["proof_refs"]),
        "protected_binding": binding,
        "requirement_graph": subject["requirement_graph"],
        "selection_id": subject["k3"]["selection_id"],
        "techniques": list(subject["k3"]["techniques"]),
    }


def _verified_evidence(sha: str) -> dict:
    return {
        "imports": 0,
        "integrity_state": "VERIFIED",
        "runtime_path": "worker-wasm",
        "verified": True,
        "wasm_sha256": sha,
    }


def test_caller_flags_cannot_mint_verified() -> None:
    receipt = run_mode(
        {
            "artifact": _subject(),
            "enforcement": "AVAILABLE",
            "mode": "VALIDATE_ONLY",
            "proof_class": "ENFORCEMENT_VERIFIED",
            "wasm_available": True,
            "wasm_sha256": "ab" * 32,
        }
    )
    assert receipt["verdict"] == "PASS"
    assert receipt["proof_class"] != "ENFORCEMENT_VERIFIED"
    assert receipt["proof_class"] == "ENFORCEMENT_AVAILABLE"
    assert receipt["wasm_sha256"] == ""


def test_from_k3_builds_subject_without_ts_semantics() -> None:
    base = _subject()
    k3 = _k3_output(base)
    k3["protected_binding"] = {**k3["protected_binding"], "category": "C99"}
    subject = subject_from_k3(k3, base["compiled_prompt"])
    assert subject["protected_intent"]["goal"] == base["protected_intent"]["goal"]
    assert subject["protected_intent"]["category"] == "C01"
    assert subject["xcat"] == {"active_category": "C01", "taxonomy_version": "2"}
    assert subject["k3"] == base["k3"]
    assert subject["requirement_graph"]["graph_digest"] == "gd-1"
    assert subject["effect_plan"]["schema_version"] == "prompt_effect_plan.v1"
    assert subject["compiled_prompt"] == base["compiled_prompt"]
    assert "active_category" not in k3["category_context"]


def test_receipt_binds_subject_digest() -> None:
    base = _subject()
    result = evaluate_from_k3(
        {
            "compiled_prompt": base["compiled_prompt"],
            "k3_output": _k3_output(base),
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
            "spe_api": "quality",
        }
    )
    assert result["receipt"]["subject_digest"] == subject_digest(result["subject"])
    assert result["receipt"]["subject_digest"]


def test_receipt_binds_runtime_wasm_sha() -> None:
    base = _subject()
    sha = "cd" * 32
    result = evaluate_from_k3(
        {
            "compiled_prompt": base["compiled_prompt"],
            "k3_output": _k3_output(base),
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
            "runtime_evidence": _verified_evidence(sha),
            "spe_api": "quality",
            "proof_class": "ENFORCEMENT_VERIFIED",
            "wasm_sha256": "ab" * 32,
        }
    )
    receipt = result["receipt"]
    assert receipt["wasm_sha256"] == sha
    assert receipt["runtime_path"] == "worker-wasm"
    assert receipt["integrity_state"] == "VERIFIED"
    assert receipt["verdict"] == "PASS"
    assert receipt["proof_class"] == "ENFORCEMENT_VERIFIED"
    assert receipt["mode"] == "VALIDATE_ONLY"


def test_missing_runtime_evidence_not_verified() -> None:
    base = _subject()
    result = evaluate_from_k3(
        {
            "compiled_prompt": base["compiled_prompt"],
            "k3_output": _k3_output(base),
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
            "proof_class": "ENFORCEMENT_VERIFIED",
            "wasm_available": True,
        }
    )
    receipt = result["receipt"]
    assert receipt["verdict"] == "PASS"
    assert receipt["proof_class"] == "ENFORCEMENT_AVAILABLE"
    assert receipt["integrity_state"] == "ABSENT"
    assert receipt["wasm_sha256"] == ""


def test_execute_never_becomes_observed() -> None:
    base = _subject()
    receipt = run_mode(
        {
            "artifact": _subject(),
            "mode": "EXECUTE",
            "proof_class": "EXECUTION_OBSERVED",
            "runtime_evidence": _verified_evidence("ef" * 32),
        }
    )
    assert receipt["proof_class"] != "EXECUTION_OBSERVED"
    assert receipt["execution_observed"] is False
    assert receipt["verdict"] == "FAIL"
    witnessed = evaluate_from_k3(
        {
            "compiled_prompt": base["compiled_prompt"],
            "k3_output": _k3_output(base),
            "mode": "EXECUTE",
            "op": "from_k3",
            "proof_class": "EXECUTION_OBSERVED",
            "runtime_evidence": _verified_evidence("ef" * 32),
        }
    )
    assert witnessed["receipt"]["proof_class"] != "EXECUTION_OBSERVED"
    assert witnessed["receipt"]["execution_observed"] is False


def _missing_constraint(subject: dict | None = None) -> dict:
    base = subject if subject is not None else _subject()
    return _subject(
        base["protected_intent"],
        compiled_prompt=_replace_section(base["compiled_prompt"], "Hard constraints", "- other"),
        plan_prompt=base["compiled_prompt"],
    )


def test_constraint_prefix_collision_is_not_satisfaction() -> None:
    base = _subject()
    prompt = _replace_section(base["compiled_prompt"], "Hard constraints", "- Do not invent facts extra")
    subject = _subject(compiled_prompt=prompt, plan_prompt=base["compiled_prompt"])
    hard = next(item for item in evaluate_obligations(subject) if item["obligation_id"] == "hard:c1")
    assert hard["status"] == "UNSATISFIED"
    result = reconstruct(subject)
    assert result["plan"]["allowed_sections"] == ["Hard constraints"]
    assert result["plan"]["disposition"] == "ACCEPTED"
    hard_body = result["kept_subject"]["compiled_prompt"].split("## Hard constraints\n", 1)[1].split("\n\n", 1)[0]
    assert "- Do not invent facts" in hard_body.split("\n")
    assert result["kept_subject"]["compiled_prompt"].split("## Objective\n", 1)[1].startswith(base["protected_intent"]["goal"])


def test_duplicate_heading_is_not_a_lawful_repair() -> None:
    base = _subject()
    prompt = base["compiled_prompt"] + "\n\n## Hard constraints\n- Do not invent facts"
    subject = _subject(compiled_prompt=prompt, plan_prompt=base["compiled_prompt"])
    sections = [item for item in evaluate_obligations(subject) if item["obligation_id"] == "artifact:sections"]
    assert sections and sections[0]["status"] != "SATISFIED"
    assert reconstruct(subject)["plan"]["disposition"] != "ACCEPTED"


def test_right_constraint_text_in_wrong_section_stays_missing() -> None:
    base = _subject()
    prompt = _replace_section(base["compiled_prompt"], "Hard constraints", "- other")
    prompt = _replace_section(prompt, "Facts", "- The user asked for a note\n- Do not invent facts")
    subject = _subject(compiled_prompt=prompt, plan_prompt=base["compiled_prompt"])
    hard = next(item for item in evaluate_obligations(subject) if item["obligation_id"] == "hard:c1")
    assert hard["status"] == "UNSATISFIED"
    result = reconstruct(subject)
    assert result["plan"]["allowed_sections"] == ["Hard constraints"]
    assert "## Objective\n" + base["protected_intent"]["goal"] in result["kept_subject"]["compiled_prompt"]


def test_objective_change_while_fixing_constraint_is_rejected() -> None:
    before = _missing_constraint()
    after_prompt = _replace_section(_subject()["compiled_prompt"], "Objective", "A different goal")
    after = dict(before)
    after["compiled_prompt"] = after_prompt
    assert repair_is_admissible(before, after, "RESTORE_MISSING_CONSTRAINT", ["MISSING_CONSTRAINT"], ["hard:c1"]) is False


def test_facts_change_while_fixing_output_contract_is_rejected() -> None:
    base = _subject()
    before = _subject(
        compiled_prompt=_drop_section(base["compiled_prompt"], "Deliverable"),
        plan_prompt=base["compiled_prompt"],
    )
    after_prompt = _replace_section(base["compiled_prompt"], "Facts", "- invented revenue")
    after = dict(before)
    after["compiled_prompt"] = after_prompt
    assert (
        repair_is_admissible(
            before,
            after,
            "RESTORE_AUTHORIZED_OUTPUT_CONTRACT",
            ["MISSING_OUTPUT_CONTRACT"],
            ["output:deliverable"],
        )
        is False
    )


def test_identity_drift_blocks_an_otherwise_minimal_repair() -> None:
    before = _missing_constraint()
    after = dict(before)
    after["compiled_prompt"] = _subject()["compiled_prompt"]
    assert repair_is_admissible(before, after, "RESTORE_MISSING_CONSTRAINT", ["MISSING_CONSTRAINT"], ["hard:c1"]) is True
    for key, value in (
        ("xcat", {"active_category": "C09", "taxonomy_version": "2"}),
        ("k3", {"selection_id": "sel-1", "techniques": ["FEW_SHOT"]}),
    ):
        drifted = dict(after)
        drifted[key] = value
        assert repair_is_admissible(before, drifted, "RESTORE_MISSING_CONSTRAINT", ["MISSING_CONSTRAINT"], ["hard:c1"]) is False
    authority = dict(after)
    authority["protected_intent"] = {
        **after["protected_intent"],
        "authority_state": {"grants": ["EXECUTE"], "level": 2, "status": "GRANTED"},
    }
    assert repair_is_admissible(before, authority, "RESTORE_MISSING_CONSTRAINT", ["MISSING_CONSTRAINT"], ["hard:c1"]) is False


def test_unrelated_protected_regression_blocks_repair() -> None:
    before = _missing_constraint()
    fixed = _subject()["compiled_prompt"]
    damaged = _replace_section(fixed, "Facts", "- unrelated invented fact")
    after = dict(before)
    after["compiled_prompt"] = damaged
    assert repair_is_admissible(before, after, "RESTORE_MISSING_CONSTRAINT", ["MISSING_CONSTRAINT"], ["hard:c1"]) is False


def test_render_from_bound_plan_requires_final_drift_cause() -> None:
    base = _subject()
    missing = _subject(
        compiled_prompt=_drop_section(base["compiled_prompt"], "Effect: DIRECT"),
        plan_prompt=base["compiled_prompt"],
    )
    result = reconstruct(missing)
    assert result["plan"]["disposition"] == "ACCEPTED"
    assert result["plan"]["cause_codes"] == ["FINAL_RENDER_DRIFT_FROM_BOUND_EFFECT_PLAN"]
    unauthorized = dict(missing)
    unauthorized["effect_plan"] = {
        **missing["effect_plan"],
        "protected_fields": {**missing["effect_plan"]["protected_fields"], "goal": "other"},
    }
    refused = reconstruct(unauthorized)
    assert refused["plan"]["disposition"] == "UNRESOLVED"
    assert refused["kept"] == "original"


def test_task57r_guard_mutants_are_killed() -> None:
    """Outcome checks for the Task57R guards. A mutant that accepts these is dead."""
    base = _subject()
    killed = 0
    caller = run_mode(
        {
            "artifact": base,
            "enforcement": "AVAILABLE",
            "mode": "VALIDATE_ONLY",
            "proof_class": "ENFORCEMENT_VERIFIED",
            "wasm_available": True,
        }
    )
    assert caller["proof_class"] != "ENFORCEMENT_VERIFIED"
    killed += 1
    assert run_mode(
        {"artifact": base, "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY", "wasm_available": True}
    )["proof_class"] != "ENFORCEMENT_VERIFIED"
    killed += 1
    expanded = _subject(
        compiled_prompt=_replace_section(base["compiled_prompt"], "Authority", "level=3; status=GRANTED; grants=EXECUTE"),
        plan_prompt=base["compiled_prompt"],
    )
    assert quality_delta(base, expanded)["disposition"] != "IMPROVED"
    killed += 1
    unknown_pi = _protected(unknowns=[{"uncertainty_id": "u1", "statement": "launch date"}])
    good_unknown = _subject(unknown_pi)
    laundered = _subject(
        unknown_pi,
        compiled_prompt=_replace_section(good_unknown["compiled_prompt"], "Open questions", "- launch date"),
        plan_prompt=good_unknown["compiled_prompt"],
    )
    assert quality_delta(good_unknown, laundered)["disposition"] != "IMPROVED"
    killed += 1
    for label, drifted in (
        ("protected", _subject(_protected(goal="other goal"))),
        ("graph", {**base, "requirement_graph": {"graph_digest": "other", "validity": "VALID"}}),
        ("xcat", {**base, "xcat": {"active_category": "C09", "taxonomy_version": "2"}}),
        ("k3", {**base, "k3": {"selection_id": "sel-9", "techniques": ["FEW_SHOT"]}}),
    ):
        assert quality_delta(base, drifted)["disposition"] != "IMPROVED", label
        killed += 1
    before = _missing_constraint()
    escaped = dict(before)
    escaped["compiled_prompt"] = _replace_section(_subject()["compiled_prompt"], "Objective", "other")
    assert repair_is_admissible(before, escaped, "RESTORE_MISSING_CONSTRAINT", ["MISSING_CONSTRAINT"], ["hard:c1"]) is False
    killed += 1
    assert reconstruct(before, attempt_index=2)["plan"]["disposition"] == "REFUSED"
    killed += 1
    longer = _subject(compiled_prompt=base["compiled_prompt"] + "\n\n## Notes\nmore", plan_prompt=base["compiled_prompt"])
    assert quality_delta(base, longer)["disposition"] != "IMPROVED"
    killed += 1
    regressed = _subject(
        compiled_prompt=_replace_section(base["compiled_prompt"], "Hard constraints", "- other"),
        plan_prompt=base["compiled_prompt"],
    )
    assert quality_delta(base, regressed)["disposition"] != "IMPROVED"
    killed += 1
    assert killed == 12


def _from_k3(subject: dict, **extra: object) -> dict:
    payload = {
        "compiled_prompt": subject["compiled_prompt"],
        "k3_output": _k3_output(subject),
        "mode": "VALIDATE_ONLY",
        "op": "from_k3",
        "spe_api": "quality",
    }
    payload.update(extra)
    return evaluate_from_k3(payload)


def test_from_k3_returns_accepted_repair_for_missing_constraint() -> None:
    result = _from_k3(_missing_constraint())
    reconstruction = result["reconstruction"]
    assert reconstruction["kept"] == "repaired"
    assert reconstruction["plan"]["disposition"] == "ACCEPTED"
    assert reconstruction["quality_delta"]["disposition"] == "IMPROVED"
    assert reconstruction["quality_delta"]["protected_regressions"] == []
    assert result["quality_delta"]["disposition"] == "IMPROVED"
    assert result["receipt"]["subject_digest"] == subject_digest(reconstruction["kept_subject"])
    assert result["receipt"]["subject_digest"] != subject_digest(result["subject"])
    assert reconstruction["plan"]["attempt_index"] <= 1
    assert reconstruction["plan"]["max_attempts"] == 1


def test_from_k3_keeps_original_when_repair_regresses() -> None:
    base = _subject()
    weakened = _replace_section(base["compiled_prompt"], "Hard constraints", "- other")
    subject = _subject(
        compiled_prompt=_drop_section(base["compiled_prompt"], "Effect: DIRECT"),
        plan_prompt=weakened,
    )
    subject["effect_plan"]["compiled_prompt"] = weakened
    result = _from_k3(subject)
    reconstruction = result["reconstruction"]
    assert reconstruction["kept"] == "original"
    assert reconstruction["plan"]["disposition"] != "ACCEPTED"
    assert result["receipt"]["subject_digest"] == subject_digest(reconstruction["kept_subject"])


def test_from_k3_no_deficit_is_not_triggered() -> None:
    result = _from_k3(_subject())
    assert result["reconstruction"]["kept"] == "original"
    assert result["reconstruction"]["plan"]["disposition"] == "NOT_TRIGGERED"
    assert result["receipt"]["subject_digest"] == subject_digest(result["subject"])


def test_from_k3_unrepairable_deficit_stays_unresolved() -> None:
    subject = _subject()
    subject["requirement_graph"] = {"graph_digest": "gd-1", "validity": "CONFLICTED"}
    result = _from_k3(subject)
    assert result["reconstruction"]["kept"] == "original"
    assert result["reconstruction"]["plan"]["disposition"] == "UNRESOLVED"


def test_from_k3_reconstructs_once(monkeypatch: pytest.MonkeyPatch) -> None:
    import spe_runtime.quality.engine as engine

    calls = {"n": 0}
    real = engine.reconstruct

    def wrapped(subject, **kwargs):
        calls["n"] += 1
        return real(subject, **kwargs)

    monkeypatch.setattr(engine, "reconstruct", wrapped)
    result = _from_k3(_missing_constraint())
    assert calls["n"] == 1
    assert result["reconstruction"]["plan"]["attempt_index"] <= 1
    assert result["reconstruction"]["plan"]["max_attempts"] == 1


def test_f1_from_k3_mutants_are_killed(monkeypatch: pytest.MonkeyPatch) -> None:
    """F1–F3 and F10 are illegal from_k3 outcomes. The real engine must reject them."""
    import spe_runtime.quality.engine as engine

    killed: list[str] = []
    repaired = _from_k3(_missing_constraint())
    assert repaired["reconstruction"]["kept"] == "repaired"
    assert "reconstruction" in repaired and repaired["reconstruction"]["plan"]["disposition"] == "ACCEPTED"
    killed.append("F1")

    calls = {"n": 0}
    real = engine.reconstruct

    def wrapped(subject, **kwargs):
        calls["n"] += 1
        return real(subject, **kwargs)

    monkeypatch.setattr(engine, "reconstruct", wrapped)
    once = _from_k3(_missing_constraint())
    assert calls["n"] == 1
    assert once["reconstruction"]["plan"]["max_attempts"] == 1
    assert once["reconstruction"]["plan"]["attempt_index"] <= 1
    killed.append("F2")

    assert repaired["receipt"]["subject_digest"] == subject_digest(repaired["reconstruction"]["kept_subject"])
    assert repaired["receipt"]["subject_digest"] != subject_digest(repaired["subject"])
    killed.append("F3")

    base = _subject()
    weakened = _replace_section(base["compiled_prompt"], "Hard constraints", "- other")
    regressing = _subject(
        compiled_prompt=_drop_section(base["compiled_prompt"], "Effect: DIRECT"),
        plan_prompt=weakened,
    )
    regressing["effect_plan"]["compiled_prompt"] = weakened
    blocked = _from_k3(regressing)
    assert blocked["reconstruction"]["kept"] == "original"
    assert blocked["reconstruction"]["plan"]["disposition"] != "ACCEPTED"
    assert blocked["reconstruction"]["quality_delta"]["disposition"] != "IMPROVED" or blocked["reconstruction"]["quality_delta"]["protected_regressions"]
    killed.append("F10")
    assert killed == ["F1", "F2", "F3", "F10"]

