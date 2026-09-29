"""Task 57 quality delta, bounded reconstruction, and VALIDATE_ONLY."""

from __future__ import annotations

import copy
import json
from typing import Any

import pytest

from spe_runtime.quality.engine import (
    FORBIDDEN_REPAIRS,
    MAX_AUTOMATIC_ATTEMPTS,
    MODES,
    REPAIR_OPERATIONS,
    evaluate_obligations,
    quality_delta,
    reconstruct,
    run_mode,
)

DIRECT = "Follow the objective directly. Do not invent examples."


def _authority_line(auth: dict[str, Any]) -> str:
    grants = auth.get("grants") or []
    joined = ",".join(grants) if grants else "none"
    return f"level={auth.get('level', 0)}; status={auth.get('status', 'NONE')}; grants={joined}"


def _protected(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "authority_state": {"grants": [], "level": 0, "status": "NONE"},
        "budget": None,
        "category": "C01",
        "desired_output": "a short note",
        "facts": [{"fact_id": "f1", "statement": "The user asked for a note"}],
        "goal": "Ship the note",
        "hard_constraints": [
            {"constraint_id": "c1", "statement": "Do not invent facts", "strength": "HARD"}
        ],
        "provenance": [{"provenance_id": "p1", "source": "user"}],
        "unknowns": [],
        "user_preferences": [],
    }
    base.update(overrides)
    return base


def _prompt(protected: dict[str, Any], *, extras: list[tuple[str, str]] | None = None) -> str:
    constraints = protected["hard_constraints"]
    facts = protected["facts"]
    unknowns = protected["unknowns"]
    sections = [
        ("Objective", protected["goal"]),
        (
            "Hard constraints",
            "\n".join(f"- {item['statement']}" for item in constraints) or "none",
        ),
        ("Budget", "none" if protected["budget"] is None else str(protected["budget"])),
        ("Facts", "\n".join(f"- {item['statement']}" for item in facts) or "none"),
        ("Provenance", "- user"),
        ("Authority", _authority_line(protected["authority_state"])),
        ("Deliverable", str(protected["desired_output"])),
    ]
    if unknowns:
        sections.append(
            (
                "Open questions",
                "\n".join(f"- {item['statement']} [UNKNOWN]" for item in unknowns),
            )
        )
    sections.append(("Effect: DIRECT", DIRECT))
    if extras:
        sections.extend(extras)
    return "\n\n".join(f"## {heading}\n{body}" for heading, body in sections)


def _subject(protected: dict[str, Any] | None = None, **overrides: Any) -> dict[str, Any]:
    pi = protected if protected is not None else _protected()
    prompt = overrides.pop("compiled_prompt", _prompt(pi))
    plan_prompt = overrides.pop("plan_prompt", prompt)
    subject: dict[str, Any] = {
        "compiled_prompt": prompt,
        "effect_plan": {
            "blocked_operations": [],
            "compiled_prompt": plan_prompt,
            "disposition": "BOUND",
            "effect_version": "k3.effect.g1r7r",
            "operations": ["DIRECT"],
            "protected_fields": {
                "authority_state": pi["authority_state"],
                "budget": pi["budget"],
                "desired_output": pi["desired_output"],
                "facts": pi["facts"],
                "goal": pi["goal"],
                "hard_constraints": pi["hard_constraints"],
                "provenance": pi["provenance"],
            },
            "renderable": True,
            "requirement_graph_digest": "gd-1",
            "schema_version": "prompt_effect_plan.v1",
            "sections": [{"code": "DIRECT", "text": DIRECT}],
            "selection_id": "sel-1",
            "techniques": ["ZERO_SHOT"],
        },
        "enforcement": "AVAILABLE",
        "k3": {"selection_id": "sel-1", "techniques": ["ZERO_SHOT"]},
        "proof_refs": ["proof-1"],
        "protected_intent": pi,
        "requirement_graph": {"graph_digest": "gd-1", "validity": "VALID"},
        "xcat": {"active_category": pi["category"], "taxonomy_version": "2"},
    }
    subject.update(overrides)
    return subject


def _replace_section(prompt: str, heading: str, body: str) -> str:
    chunks = prompt.split("\n\n")
    updated: list[str] = []
    found = False
    for chunk in chunks:
        if chunk.startswith(f"## {heading}\n"):
            updated.append(f"## {heading}\n{body}")
            found = True
        else:
            updated.append(chunk)
    if not found:
        updated.append(f"## {heading}\n{body}")
    return "\n\n".join(updated)


def _drop_section(prompt: str, heading: str) -> str:
    return "\n\n".join(chunk for chunk in prompt.split("\n\n") if not chunk.startswith(f"## {heading}\n"))


def test_modes_are_distinct_and_budget_is_one() -> None:
    assert MODES == ("DRY_RUN", "VALIDATE_ONLY", "EXECUTE")
    assert len(set(MODES)) == 3
    assert MAX_AUTOMATIC_ATTEMPTS == 1
    assert "CHANGE_USER_GOAL" not in REPAIR_OPERATIONS
    assert set(FORBIDDEN_REPAIRS).isdisjoint(REPAIR_OPERATIONS)


def test_satisfied_candidate_has_no_global_score() -> None:
    subject = _subject()
    obligations = evaluate_obligations(subject)
    assert all(item["status"] == "SATISFIED" for item in obligations)
    delta = quality_delta(subject, subject)
    assert delta["disposition"] == "NON_INFERIOR"
    assert "SAME_CANDIDATE" in delta["reason_codes"]
    blob = json.dumps(delta)
    for banned in ("quality_percentage", "quality_score", "confidence", "win_probability"):
        assert banned not in blob


def test_restoring_constraint_is_improved_without_protected_regression() -> None:
    base = _subject()
    dropped = _replace_section(base["compiled_prompt"], "Hard constraints", "- something else")
    before = _subject(compiled_prompt=dropped, plan_prompt=base["compiled_prompt"])
    after = _subject()
    delta = quality_delta(before, after)
    assert delta["disposition"] == "IMPROVED"
    assert "hard:c1" in delta["improved_obligation_ids"]
    assert delta["protected_regressions"] == []
    assert delta["proof_refs"]
    assert delta["unchanged_obligation_ids"]
    assert delta["protected_intent_digest"]


def test_longer_prompt_is_not_improved() -> None:
    before = _subject()
    longer = before["compiled_prompt"] + "\n\n## Notes\nextra words that add no obligation"
    after = _subject(compiled_prompt=longer, plan_prompt=before["compiled_prompt"])
    delta = quality_delta(before, after)
    assert delta["disposition"] == "NON_INFERIOR"
    assert delta["improved_obligation_ids"] == []
    assert "LENGTH_NOT_QUALITY" in delta["reason_codes"]


def test_dropped_constraint_is_regressed() -> None:
    before = _subject()
    after = _subject(
        compiled_prompt=_replace_section(before["compiled_prompt"], "Hard constraints", "- other"),
        plan_prompt=before["compiled_prompt"],
    )
    delta = quality_delta(before, after)
    assert delta["disposition"] == "REGRESSED"
    assert "hard:c1" in delta["protected_regressions"]
    assert delta["disposition"] != "IMPROVED"


def test_unknown_laundering_is_not_satisfied() -> None:
    pi = _protected(unknowns=[{"uncertainty_id": "u1", "statement": "launch date"}])
    good = _subject(pi)
    laundered = _subject(
        pi,
        compiled_prompt=_replace_section(
            good["compiled_prompt"], "Open questions", "- launch date [SATISFIED]"
        ),
        plan_prompt=good["compiled_prompt"],
    )
    statuses = {item["obligation_id"]: item for item in evaluate_obligations(laundered)}
    assert statuses["unknown:u1"]["status"] == "CONFLICT"
    assert "UNKNOWN_LAUNDERED" in statuses["unknown:u1"]["reason_codes"]
    delta = quality_delta(good, laundered)
    assert delta["disposition"] == "REGRESSED"
    assert "unknown:u1" in delta["protected_regressions"]


def test_authority_expansion_and_invented_fact_are_regressions() -> None:
    before = _subject()
    expanded = _replace_section(
        before["compiled_prompt"],
        "Authority",
        "level=3; status=GRANTED; grants=EXECUTE",
    )
    after = _subject(compiled_prompt=expanded, plan_prompt=before["compiled_prompt"])
    delta = quality_delta(before, after)
    assert delta["disposition"] == "REGRESSED"
    assert "authority:bound" in delta["protected_regressions"]

    invented = _replace_section(
        before["compiled_prompt"],
        "Facts",
        "- The user asked for a note\n- INVENTED FACT: revenue doubled",
    )
    fact_after = _subject(compiled_prompt=invented, plan_prompt=before["compiled_prompt"])
    fact_delta = quality_delta(before, fact_after)
    assert fact_delta["disposition"] == "REGRESSED"
    assert "fact:unauthorized" in fact_delta["protected_regressions"]


def test_protected_intent_mismatch_is_not_improvement() -> None:
    before = _subject()
    other = _protected(goal="A different goal")
    after = _subject(other)
    delta = quality_delta(before, after)
    assert delta["disposition"] == "UNRESOLVED"
    assert "PROTECTED_INTENT_MISMATCH" in delta["reason_codes"]
    assert delta["improved_obligation_ids"] == []


def test_reconstruction_restores_one_constraint_and_stops() -> None:
    base = _subject()
    broken = _subject(
        compiled_prompt=_replace_section(base["compiled_prompt"], "Hard constraints", "- other"),
        plan_prompt=base["compiled_prompt"],
    )
    result = reconstruct(broken, max_attempts=50, attempt_index=1)
    assert result["plan"]["attempt_index"] == 1
    assert result["plan"]["max_attempts"] == 1
    assert result["plan"]["repair_operations"] == ["RESTORE_MISSING_CONSTRAINT"]
    assert result["plan"]["disposition"] == "ACCEPTED"
    assert result["kept"] == "repaired"
    assert "Do not invent facts" in result["kept_subject"]["compiled_prompt"]
    assert result["kept_subject"]["protected_intent"] == broken["protected_intent"]
    assert result["quality_delta"]["disposition"] == "IMPROVED"
    assert result["quality_delta"]["protected_regressions"] == []
    again = reconstruct(result["kept_subject"])
    assert again["plan"]["disposition"] == "REFUSED"
    assert again["plan"]["attempt_index"] == 1


def test_second_attempt_and_forbidden_repairs_are_refused() -> None:
    subject = _subject()
    second = reconstruct(subject, attempt_index=2)
    assert second["plan"]["disposition"] == "REFUSED"
    assert second["plan"]["attempt_index"] == 1
    assert second["kept"] == "original"
    for name in ("CHANGE_USER_GOAL", "INVENT_FACT", "INVENT_EXAMPLE", "MINT_AUTHORITY", "CHANGE_CATEGORY", "CHANGE_K3_TECHNIQUE", "EXECUTE_TOOL", "WEAKEN_CONSTRAINT"):
        refused = reconstruct(subject, requested_repair=name)
        assert refused["plan"]["disposition"] == "REFUSED"
        assert refused["kept_subject"]["protected_intent"]["goal"] == subject["protected_intent"]["goal"]
        assert refused["kept_subject"]["k3"]["techniques"] == ["ZERO_SHOT"]
        assert name not in refused["plan"]["repair_operations"]


def test_regressed_render_does_not_replace_original() -> None:
    base = _subject()
    missing_effect = _drop_section(base["compiled_prompt"], "Effect: DIRECT")
    worse_plan = _replace_section(base["compiled_prompt"], "Hard constraints", "- other")
    subject = _subject(compiled_prompt=missing_effect, plan_prompt=worse_plan)
    subject["effect_plan"]["compiled_prompt"] = worse_plan
    result = reconstruct(subject)
    assert result["kept"] == "original"
    assert result["plan"]["disposition"] in {"UNRESOLVED", "NO_IMPROVEMENT"}
    assert "Do not invent facts" in result["kept_subject"]["compiled_prompt"]
    assert result["quality_delta"]["disposition"] != "IMPROVED" or result["kept"] == "original"


def test_validate_only_pass_fail_unknown_and_no_execution() -> None:
    good = run_mode({"artifact": _subject(), "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY"})
    assert good["verdict"] == "PASS"
    assert good["proof_class"] == "ENFORCEMENT_AVAILABLE"
    assert good["execution_observed"] is False
    assert good["external_effect"] is False
    assert good["network"] is False
    assert good["credentials_used"] is False
    assert good["external_write"] is False
    assert good["outcome"] == "NOT_EXECUTED"
    assert good["authority_minted"] is False

    missing = _subject()
    missing["proof_refs"] = []
    unknown = run_mode({"artifact": missing, "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY"})
    assert unknown["verdict"] == "UNKNOWN"
    assert unknown["proof_class"] != "EXECUTION_OBSERVED"

    unavailable = run_mode(
        {"artifact": _subject(), "enforcement": "UNAVAILABLE", "mode": "VALIDATE_ONLY"}
    )
    assert unavailable["verdict"] == "FAIL"
    assert "ENFORCEMENT_UNAVAILABLE" in unavailable["reason_codes"]
    assert unavailable["verdict"] != "PASS"

    wasm = run_mode(
        {"artifact": _subject(), "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY", "wasm_available": False}
    )
    assert wasm["verdict"] == "FAIL"
    assert "ENFORCEMENT_UNAVAILABLE" in wasm["reason_codes"]


@pytest.mark.parametrize(
    "effect",
    ["network", "credential", "external_write", "execute"],
)
def test_validate_only_refuses_external_effects(effect: str) -> None:
    receipt = run_mode(
        {
            "artifact": _subject(),
            "enforcement": "AVAILABLE",
            "mode": "VALIDATE_ONLY",
            "proof_class": "EXECUTION_OBSERVED",
            "requested_effects": [effect],
        }
    )
    assert receipt["verdict"] == "FAIL"
    assert receipt["network"] is False
    assert receipt["credentials_used"] is False
    assert receipt["external_write"] is False
    assert receipt["external_effect"] is False
    assert receipt["execution_observed"] is False
    assert receipt["proof_class"] != "EXECUTION_OBSERVED"
    assert receipt["outcome"] == "NOT_EXECUTED"


def test_dry_run_is_not_validate_only_or_execute() -> None:
    dry = run_mode({"artifact": _subject(), "mode": "DRY_RUN"})
    validate = run_mode({"artifact": _subject(), "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY"})
    execute = run_mode({"artifact": _subject(), "mode": "EXECUTE"})
    assert dry["mode"] == "DRY_RUN"
    assert dry["verdict"] == "PREVIEW"
    assert dry["verdict"] != validate["verdict"]
    assert execute["mode"] == "EXECUTE"
    assert execute["verdict"] == "FAIL"
    assert execute["execution_authorized"] is False
    assert "EXECUTION_NOT_AUTHORIZED" in execute["reason_codes"]
    assert run_mode({"mode": "LOCAL_DRY_RUN", "artifact": _subject()})["reason_codes"] == [
        "UNSUPPORTED_MODE"
    ]


def test_vector_floors() -> None:
    quality = _quality_vectors()
    reconstruction = _reconstruction_vectors()
    validate = _validate_vectors()
    assert sum(1 for row in quality if row["kind"] == "normal") >= 30
    assert sum(1 for row in quality if row["kind"] == "adversarial") >= 25
    assert sum(1 for row in reconstruction if row["kind"] == "normal") >= 25
    assert sum(1 for row in reconstruction if row["kind"] == "adversarial") >= 20
    assert sum(1 for row in validate if row["kind"] == "normal") >= 20
    assert sum(1 for row in validate if row["kind"] == "adversarial") >= 20
    for row in quality:
        delta = quality_delta(row["before"], row["after"])
        assert delta["disposition"] == row["expect"], row["id"]
        assert "quality_percentage" not in json.dumps(delta)
    for row in reconstruction:
        result = reconstruct(
            row["subject"],
            attempt_index=row.get("attempt_index", 1),
            requested_repair=row.get("requested_repair"),
        )
        assert result["plan"]["disposition"] == row["expect"], row["id"]
        assert result["plan"]["attempt_index"] <= result["plan"]["max_attempts"]
        assert result["kept_subject"]["protected_intent"]["goal"] == row["subject"]["protected_intent"]["goal"]
    for row in validate:
        receipt = run_mode(row["request"])
        assert receipt["verdict"] == row["expect"], row["id"]
        assert receipt["execution_observed"] is False
        assert receipt["network"] is False
        assert receipt["external_effect"] is False


def _quality_vectors() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    base = _subject()
    rows.append({"id": "q-same", "kind": "normal", "before": base, "after": copy.deepcopy(base), "expect": "NON_INFERIOR"})
    restored_before = _subject(
        compiled_prompt=_replace_section(base["compiled_prompt"], "Hard constraints", "- other"),
        plan_prompt=base["compiled_prompt"],
    )
    rows.append({"id": "q-restore-constraint", "kind": "normal", "before": restored_before, "after": copy.deepcopy(base), "expect": "IMPROVED"})
    longer = _subject(compiled_prompt=base["compiled_prompt"] + "\n\n## Notes\npadding", plan_prompt=base["compiled_prompt"])
    rows.append({"id": "q-longer", "kind": "normal", "before": base, "after": longer, "expect": "NON_INFERIOR"})
    shorter = _subject()
    shorter_prompt = _drop_section(shorter["compiled_prompt"] + "\n\n## Notes\npadding", "Notes")
    rows.append(
        {
            "id": "q-shorter",
            "kind": "normal",
            "before": _subject(compiled_prompt=base["compiled_prompt"] + "\n\n## Notes\npadding", plan_prompt=base["compiled_prompt"]),
            "after": _subject(compiled_prompt=shorter_prompt, plan_prompt=base["compiled_prompt"]),
            "expect": "NON_INFERIOR",
        }
    )
    unknown_pi = _protected(unknowns=[{"uncertainty_id": "u1", "statement": "launch date"}])
    unknown_good = _subject(unknown_pi)
    rows.append({"id": "q-unknown-kept", "kind": "normal", "before": unknown_good, "after": copy.deepcopy(unknown_good), "expect": "NON_INFERIOR"})
    missing_unknown = _subject(
        unknown_pi,
        compiled_prompt=_drop_section(unknown_good["compiled_prompt"], "Open questions"),
        plan_prompt=unknown_good["compiled_prompt"],
    )
    rows.append({"id": "q-unknown-restored", "kind": "normal", "before": missing_unknown, "after": unknown_good, "expect": "IMPROVED"})
    rows.append({"id": "q-output-present", "kind": "normal", "before": base, "after": copy.deepcopy(base), "expect": "NON_INFERIOR"})
    missing_output = _subject(
        compiled_prompt=_drop_section(base["compiled_prompt"], "Deliverable"),
        plan_prompt=base["compiled_prompt"],
    )
    rows.append({"id": "q-output-restored", "kind": "normal", "before": missing_output, "after": copy.deepcopy(base), "expect": "IMPROVED"})
    missing_effect = _subject(
        compiled_prompt=_drop_section(base["compiled_prompt"], "Effect: DIRECT"),
        plan_prompt=base["compiled_prompt"],
    )
    rows.append({"id": "q-effect-restored", "kind": "normal", "before": missing_effect, "after": copy.deepcopy(base), "expect": "IMPROVED"})
    for index in range(21):
        goal = f"Ship note {index}"
        pi = _protected(goal=goal)
        subject = _subject(pi)
        rows.append(
            {
                "id": f"q-goal-{index}",
                "kind": "normal",
                "before": subject,
                "after": copy.deepcopy(subject),
                "expect": "NON_INFERIOR",
            }
        )
    rows.append(
        {
            "id": "a-missing-constraint",
            "kind": "adversarial",
            "before": base,
            "after": _subject(
                compiled_prompt=_replace_section(base["compiled_prompt"], "Hard constraints", "- other"),
                plan_prompt=base["compiled_prompt"],
            ),
            "expect": "REGRESSED",
        }
    )
    rows.append(
        {
            "id": "a-unknown-laundered",
            "kind": "adversarial",
            "before": unknown_good,
            "after": _subject(
                unknown_pi,
                compiled_prompt=_replace_section(unknown_good["compiled_prompt"], "Open questions", "- launch date [SATISFIED]"),
                plan_prompt=unknown_good["compiled_prompt"],
            ),
            "expect": "REGRESSED",
        }
    )
    rows.append(
        {
            "id": "a-authority",
            "kind": "adversarial",
            "before": base,
            "after": _subject(
                compiled_prompt=_replace_section(base["compiled_prompt"], "Authority", "level=3; status=GRANTED; grants=EXECUTE"),
                plan_prompt=base["compiled_prompt"],
            ),
            "expect": "REGRESSED",
        }
    )
    rows.append(
        {
            "id": "a-invented-fact",
            "kind": "adversarial",
            "before": base,
            "after": _subject(
                compiled_prompt=_replace_section(base["compiled_prompt"], "Facts", "- The user asked for a note\n- secret revenue"),
                plan_prompt=base["compiled_prompt"],
            ),
            "expect": "REGRESSED",
        }
    )
    rows.append({"id": "a-longer", "kind": "adversarial", "before": base, "after": longer, "expect": "NON_INFERIOR"})
    other = _subject(_protected(goal="Changed goal"))
    rows.append({"id": "a-intent-mismatch", "kind": "adversarial", "before": base, "after": other, "expect": "UNRESOLVED"})
    conflicted = copy.deepcopy(base)
    conflicted["requirement_graph"] = {"graph_digest": "gd-1", "validity": "CONFLICTED"}
    conflicted_after = copy.deepcopy(conflicted)
    rows.append({"id": "a-conflict", "kind": "adversarial", "before": conflicted, "after": conflicted_after, "expect": "UNRESOLVED"})
    malformed = copy.deepcopy(base)
    malformed["compiled_prompt"] = {"not": "a prompt"}
    rows.append({"id": "a-malformed", "kind": "adversarial", "before": base, "after": malformed, "expect": "UNRESOLVED"})
    no_proof = copy.deepcopy(base)
    no_proof["proof_refs"] = []
    improved_without_proof = copy.deepcopy(restored_before)
    improved_without_proof["proof_refs"] = []
    after_without_proof = copy.deepcopy(base)
    after_without_proof["proof_refs"] = []
    rows.append(
        {
            "id": "a-missing-proof",
            "kind": "adversarial",
            "before": improved_without_proof,
            "after": after_without_proof,
            "expect": "UNRESOLVED",
        }
    )
    unbound = copy.deepcopy(base)
    unbound["effect_plan"] = {**unbound["effect_plan"], "protected_fields": {**unbound["effect_plan"]["protected_fields"], "goal": "other"}}
    rows.append({"id": "a-unbound", "kind": "adversarial", "before": unbound, "after": copy.deepcopy(unbound), "expect": "NON_INFERIOR"})
    category = copy.deepcopy(base)
    category["xcat"] = {"active_category": "C09", "taxonomy_version": "2"}
    rows.append({"id": "a-category", "kind": "adversarial", "before": base, "after": category, "expect": "UNRESOLVED"})
    k3 = copy.deepcopy(base)
    k3["k3"] = {"selection_id": "sel-1", "techniques": ["FEW_SHOT"]}
    rows.append({"id": "a-k3", "kind": "adversarial", "before": base, "after": k3, "expect": "UNRESOLVED"})
    rows.append(
        {
            "id": "a-output-missing",
            "kind": "adversarial",
            "before": base,
            "after": missing_output,
            "expect": "REGRESSED",
        }
    )
    rows.append(
        {
            "id": "a-effect-missing",
            "kind": "adversarial",
            "before": base,
            "after": missing_effect,
            "expect": "REGRESSED",
        }
    )
    waived = _subject(
        compiled_prompt=_replace_section(
            base["compiled_prompt"],
            "Hard constraints",
            "- Do not invent facts\nwaive: Do not invent facts",
        ),
        plan_prompt=base["compiled_prompt"],
    )
    rows.append({"id": "a-waived", "kind": "adversarial", "before": base, "after": waived, "expect": "REGRESSED"})
    claim = _subject(
        compiled_prompt=base["compiled_prompt"] + "\n\n## Notes\nbrowsing happened",
        plan_prompt=base["compiled_prompt"],
    )
    rows.append({"id": "a-claim", "kind": "adversarial", "before": base, "after": claim, "expect": "REGRESSED"})
    for index in range(10):
        bad = _subject(
            compiled_prompt=_replace_section(base["compiled_prompt"], "Objective", f"other {index}"),
            plan_prompt=base["compiled_prompt"],
        )
        rows.append({"id": f"a-goal-drift-{index}", "kind": "adversarial", "before": base, "after": bad, "expect": "REGRESSED"})
    return rows


def _reconstruction_vectors() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    base = _subject()
    broken = _subject(
        compiled_prompt=_replace_section(base["compiled_prompt"], "Hard constraints", "- other"),
        plan_prompt=base["compiled_prompt"],
    )
    rows.append({"id": "r-constraint", "kind": "normal", "subject": broken, "expect": "ACCEPTED"})
    unknown_pi = _protected(unknowns=[{"uncertainty_id": "u1", "statement": "launch date"}])
    unknown_good = _subject(unknown_pi)
    missing_unknown = _subject(
        unknown_pi,
        compiled_prompt=_drop_section(unknown_good["compiled_prompt"], "Open questions"),
        plan_prompt=unknown_good["compiled_prompt"],
    )
    rows.append({"id": "r-unknown", "kind": "normal", "subject": missing_unknown, "expect": "ACCEPTED"})
    invented = _subject(
        compiled_prompt=_replace_section(base["compiled_prompt"], "Facts", "- The user asked for a note\n- secret revenue"),
        plan_prompt=base["compiled_prompt"],
    )
    rows.append({"id": "r-remove-fact", "kind": "normal", "subject": invented, "expect": "ACCEPTED"})
    missing_effect = _subject(
        compiled_prompt=_drop_section(base["compiled_prompt"], "Effect: DIRECT"),
        plan_prompt=base["compiled_prompt"],
    )
    rows.append({"id": "r-effect", "kind": "normal", "subject": missing_effect, "expect": "ACCEPTED"})
    rows.append({"id": "r-noop", "kind": "normal", "subject": base, "expect": "NOT_TRIGGERED"})
    conflicted = copy.deepcopy(base)
    conflicted["requirement_graph"] = {"graph_digest": "gd-1", "validity": "CONFLICTED"}
    rows.append({"id": "r-conflict", "kind": "normal", "subject": conflicted, "expect": "UNRESOLVED"})
    for index in range(19):
        pi = _protected(goal=f"Restore {index}")
        good = _subject(pi)
        bad = _subject(
            pi,
            compiled_prompt=_replace_section(good["compiled_prompt"], "Hard constraints", "- missing"),
            plan_prompt=good["compiled_prompt"],
        )
        rows.append({"id": f"r-normal-{index}", "kind": "normal", "subject": bad, "expect": "ACCEPTED"})
    rows.append({"id": "a-attempt-2", "kind": "adversarial", "subject": broken, "attempt_index": 2, "expect": "REFUSED"})
    rows.append(
        {
            "id": "a-change-goal",
            "kind": "adversarial",
            "subject": broken,
            "requested_repair": "CHANGE_USER_GOAL",
            "expect": "REFUSED",
        }
    )
    rows.append(
        {
            "id": "a-change-k3",
            "kind": "adversarial",
            "subject": broken,
            "requested_repair": "CHANGE_K3_TECHNIQUE",
            "expect": "REFUSED",
        }
    )
    rows.append(
        {
            "id": "a-invent-example",
            "kind": "adversarial",
            "subject": broken,
            "requested_repair": "INVENT_EXAMPLE",
            "expect": "REFUSED",
        }
    )
    rows.append(
        {
            "id": "a-mint",
            "kind": "adversarial",
            "subject": broken,
            "requested_repair": "MINT_AUTHORITY",
            "expect": "REFUSED",
        }
    )
    rows.append(
        {
            "id": "a-change-category",
            "kind": "adversarial",
            "subject": broken,
            "requested_repair": "CHANGE_CATEGORY",
            "expect": "REFUSED",
        }
    )
    rows.append(
        {
            "id": "a-weaken",
            "kind": "adversarial",
            "subject": broken,
            "requested_repair": "WEAKEN_CONSTRAINT",
            "expect": "REFUSED",
        }
    )
    worse = _subject(compiled_prompt=_drop_section(base["compiled_prompt"], "Effect: DIRECT"), plan_prompt=_replace_section(base["compiled_prompt"], "Hard constraints", "- other"))
    worse["effect_plan"]["compiled_prompt"] = _replace_section(base["compiled_prompt"], "Hard constraints", "- other")
    rows.append({"id": "a-worse-render", "kind": "adversarial", "subject": worse, "expect": "UNRESOLVED"})
    equal = copy.deepcopy(base)
    rows.append({"id": "a-equal", "kind": "adversarial", "subject": equal, "expect": "NOT_TRIGGERED"})
    reentry = copy.deepcopy(broken)
    reentry["prior_reconstruction_attempts"] = 1
    rows.append({"id": "a-reentry", "kind": "adversarial", "subject": reentry, "expect": "REFUSED"})
    for name in ("INVENT_FACT", "INVENT_RETRIEVAL_RESULT", "EXECUTE_TOOL"):
        rows.append(
            {
                "id": f"a-forbidden-{name}",
                "kind": "adversarial",
                "subject": broken,
                "requested_repair": name,
                "expect": "REFUSED",
            }
        )
    for index in range(7):
        rows.append(
            {
                "id": f"a-loop-{index}",
                "kind": "adversarial",
                "subject": broken,
                "attempt_index": 2 + index,
                "expect": "REFUSED",
            }
        )
    return rows


def _validate_vectors() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    good = {"artifact": _subject(), "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY"}
    rows.append({"id": "v-pass", "kind": "normal", "request": good, "expect": "PASS"})
    for index in range(19):
        pi = _protected(goal=f"Validate {index}")
        rows.append(
            {
                "id": f"v-normal-{index}",
                "kind": "normal",
                "request": {"artifact": _subject(pi), "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY"},
                "expect": "PASS",
            }
        )
    malformed = copy.deepcopy(good)
    malformed["artifact"] = {**_subject(), "compiled_prompt": None}
    rows.append({"id": "a-malformed", "kind": "adversarial", "request": malformed, "expect": "FAIL"})
    unknown = {"artifact": {**_subject(), "proof_refs": []}, "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY"}
    rows.append({"id": "a-unknown-proof", "kind": "adversarial", "request": unknown, "expect": "UNKNOWN"})
    rows.append(
        {
            "id": "a-enforcement",
            "kind": "adversarial",
            "request": {"artifact": _subject(), "enforcement": "UNAVAILABLE", "mode": "VALIDATE_ONLY"},
            "expect": "FAIL",
        }
    )
    for effect in ("network", "credential", "external_write", "execute"):
        rows.append(
            {
                "id": f"a-{effect}",
                "kind": "adversarial",
                "request": {
                    "artifact": _subject(),
                    "enforcement": "AVAILABLE",
                    "mode": "VALIDATE_ONLY",
                    "requested_effects": [effect],
                },
                "expect": "FAIL",
            }
        )
    rows.append(
        {
            "id": "a-observed",
            "kind": "adversarial",
            "request": {
                "artifact": _subject(),
                "enforcement": "AVAILABLE",
                "mode": "VALIDATE_ONLY",
                "proof_class": "EXECUTION_OBSERVED",
                "requested_effects": ["execute"],
            },
            "expect": "FAIL",
        }
    )
    rows.append({"id": "a-dry", "kind": "adversarial", "request": {"artifact": _subject(), "mode": "DRY_RUN"}, "expect": "PREVIEW"})
    rows.append({"id": "a-execute", "kind": "adversarial", "request": {"artifact": _subject(), "mode": "EXECUTE"}, "expect": "FAIL"})
    rows.append(
        {
            "id": "a-missing-plan",
            "kind": "adversarial",
            "request": {"artifact": {**_subject(), "effect_plan": None}, "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY"},
            "expect": "FAIL",
        }
    )
    mismatched = _subject()
    mismatched["xcat"] = {"active_category": "C02", "taxonomy_version": "2"}
    rows.append(
        {
            "id": "a-category",
            "kind": "adversarial",
            "request": {"artifact": mismatched, "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY"},
            "expect": "FAIL",
        }
    )
    intent = _subject()
    intent["effect_plan"]["protected_fields"] = {**intent["effect_plan"]["protected_fields"], "goal": "other"}
    rows.append(
        {
            "id": "a-intent",
            "kind": "adversarial",
            "request": {"artifact": intent, "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY"},
            "expect": "FAIL",
        }
    )
    graph = _subject()
    graph["requirement_graph"] = {"graph_digest": "other", "validity": "VALID"}
    rows.append(
        {
            "id": "a-graph",
            "kind": "adversarial",
            "request": {"artifact": graph, "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY"},
            "expect": "FAIL",
        }
    )
    rows.append(
        {
            "id": "a-wasm",
            "kind": "adversarial",
            "request": {"artifact": _subject(), "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY", "wasm_available": False},
            "expect": "FAIL",
        }
    )
    rows.append(
        {
            "id": "a-mode",
            "kind": "adversarial",
            "request": {"artifact": _subject(), "mode": "MAYBE"},
            "expect": "FAIL",
        }
    )
    k3 = _subject()
    k3["k3"] = {"selection_id": "sel-1", "techniques": ["FEW_SHOT"]}
    rows.append(
        {
            "id": "a-k3",
            "kind": "adversarial",
            "request": {"artifact": k3, "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY"},
            "expect": "FAIL",
        }
    )
    rows.append(
        {
            "id": "a-dry-network",
            "kind": "adversarial",
            "request": {"artifact": _subject(), "mode": "DRY_RUN", "requested_effects": ["network"]},
            "expect": "REFUSED",
        }
    )
    rows.append(
        {
            "id": "a-execute-grant",
            "kind": "adversarial",
            "request": {
                "artifact": _subject(
                    _protected(authority_state={"grants": ["EXECUTE"], "level": 1, "status": "GRANTED"})
                ),
                "mode": "EXECUTE",
            },
            "expect": "FAIL",
        }
    )
    dropped = _subject()
    dropped["compiled_prompt"] = _replace_section(dropped["compiled_prompt"], "Hard constraints", "- other")
    rows.append(
        {
            "id": "a-unsatisfied",
            "kind": "adversarial",
            "request": {"artifact": dropped, "enforcement": "AVAILABLE", "mode": "VALIDATE_ONLY"},
            "expect": "FAIL",
        }
    )
    return rows


def test_mutants_killed() -> None:
    """Each mutant is an illegal outcome the real engine must reject."""
    base = _subject()
    dropped = _subject(
        compiled_prompt=_replace_section(base["compiled_prompt"], "Hard constraints", "- other"),
        plan_prompt=base["compiled_prompt"],
    )
    improved = quality_delta(dropped, base)
    assert "quality_percentage" not in improved  # Q1
    longer = quality_delta(
        base,
        _subject(compiled_prompt=base["compiled_prompt"] + "\n\n## Notes\nmore", plan_prompt=base["compiled_prompt"]),
    )
    assert longer["disposition"] != "IMPROVED"  # Q2
    regressed = quality_delta(base, dropped)
    assert regressed["disposition"] != "IMPROVED"  # Q3
    unknown_pi = _protected(unknowns=[{"uncertainty_id": "u1", "statement": "launch date"}])
    good_unknown = _subject(unknown_pi)
    laundered = _subject(
        unknown_pi,
        compiled_prompt=_replace_section(good_unknown["compiled_prompt"], "Open questions", "- launch date [SATISFIED]"),
        plan_prompt=good_unknown["compiled_prompt"],
    )
    assert quality_delta(good_unknown, laundered)["disposition"] != "IMPROVED"  # Q4
    expanded = quality_delta(
        base,
        _subject(
            compiled_prompt=_replace_section(base["compiled_prompt"], "Authority", "level=2; status=GRANTED; grants=EXECUTE"),
            plan_prompt=base["compiled_prompt"],
        ),
    )
    assert expanded["disposition"] != "IMPROVED"  # Q5
    invented = quality_delta(
        base,
        _subject(
            compiled_prompt=_replace_section(base["compiled_prompt"], "Facts", "- The user asked for a note\n- invented revenue"),
            plan_prompt=base["compiled_prompt"],
        ),
    )
    assert invented["disposition"] != "IMPROVED"  # Q6
    assert quality_delta(base, _subject(_protected(goal="other goal")))["disposition"] != "IMPROVED"  # Q7
    unbounded = reconstruct(dropped, max_attempts=99)
    assert unbounded["plan"]["max_attempts"] == 1  # R1
    assert reconstruct(dropped, attempt_index=2)["plan"]["disposition"] == "REFUSED"  # R2
    goal_repair = reconstruct(dropped, requested_repair="CHANGE_USER_GOAL")
    assert goal_repair["kept_subject"]["protected_intent"]["goal"] == "Ship the note"  # R3
    k3_repair = reconstruct(dropped, requested_repair="CHANGE_K3_TECHNIQUE")
    assert k3_repair["kept_subject"]["k3"]["techniques"] == ["ZERO_SHOT"]  # R4
    example_repair = reconstruct(dropped, requested_repair="INVENT_EXAMPLE")
    assert "invented example" not in example_repair["kept_subject"]["compiled_prompt"].lower()  # R5
    worse = _subject(
        compiled_prompt=_drop_section(base["compiled_prompt"], "Effect: DIRECT"),
        plan_prompt=_replace_section(base["compiled_prompt"], "Hard constraints", "- other"),
    )
    worse["effect_plan"]["compiled_prompt"] = _replace_section(base["compiled_prompt"], "Hard constraints", "- other")
    worse_result = reconstruct(worse)
    assert worse_result["kept"] == "original"  # R6
    for effect, flag in (
        ("execute", "external_effect"),
        ("network", "network"),
        ("credential", "credentials_used"),
    ):
        receipt = run_mode(
            {
                "artifact": base,
                "enforcement": "AVAILABLE",
                "mode": "VALIDATE_ONLY",
                "requested_effects": [effect],
            }
        )
        assert receipt[flag] is False
        assert receipt["outcome"] == "NOT_EXECUTED"
    unavailable = run_mode({"artifact": base, "enforcement": "UNAVAILABLE", "mode": "VALIDATE_ONLY"})
    assert unavailable["verdict"] != "PASS"  # V4
    fabricated = run_mode(
        {
            "artifact": base,
            "enforcement": "AVAILABLE",
            "mode": "VALIDATE_ONLY",
            "proof_class": "EXECUTION_OBSERVED",
            "requested_effects": ["execute"],
        }
    )
    assert fabricated["proof_class"] != "EXECUTION_OBSERVED"  # V5
    assert fabricated["execution_observed"] is False
