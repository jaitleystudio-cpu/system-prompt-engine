"""F3E quality consumption of AUTO-XCAT. UNKNOWN is not PASS."""

from __future__ import annotations

from spe_runtime.k3.selector import select_prompt_techniques
from spe_runtime.quality.engine import evaluate_from_k3, evaluate_obligations, subject_from_k3


def _prompt(goal: str) -> str:
    return f"## Objective\n{goal}\n"


def test_recovered_auto_route_binds_category() -> None:
    goal = "Write the memo."
    k3 = select_prompt_techniques({"goal": goal}, {"display_label": "AI Assistant"}, {})
    assert k3["category_context"]["xcat_id"] is None
    subject = subject_from_k3(k3, _prompt(goal))
    assert subject["protected_intent"]["category"] == "C03"
    assert subject["xcat"]["active_category"] == "C03"
    assert "auto_disposition" not in subject["xcat"]
    binding = next(item for item in evaluate_obligations(subject) if item["obligation_id"] == "bind:xcat")
    assert binding["status"] == "SATISFIED"


def test_hold_auto_route_is_unknown_not_pass() -> None:
    goal = "Summarize the supplied notes."
    k3 = select_prompt_techniques({"goal": goal}, {"display_label": "AI Assistant"}, {})
    subject = subject_from_k3(k3, _prompt(goal))
    assert subject["protected_intent"]["category"] == ""
    assert subject["xcat"]["active_category"] == ""
    assert subject["xcat"]["auto_disposition"] == "NEEDS_DISAMBIGUATION"
    binding = next(item for item in evaluate_obligations(subject) if item["obligation_id"] == "bind:xcat")
    assert binding["status"] == "UNKNOWN"
    assert binding["reason_codes"] == ["AUTO_XCAT_NEEDS_DISAMBIGUATION"]
    result = evaluate_from_k3(
        {
            "compiled_prompt": _prompt(goal),
            "k3_output": k3,
            "mode": "VALIDATE_ONLY",
        }
    )
    assert result["receipt"]["verdict"] == "UNKNOWN"
    assert result["receipt"]["verdict"] != "PASS"


def test_protocol_hold_does_not_invent_a_category() -> None:
    goal = "Write a function."
    k3 = select_prompt_techniques({"goal": goal}, {"display_label": "Coding"}, {})
    subject = subject_from_k3(k3, _prompt(goal))
    assert subject["xcat"]["active_category"] == ""
    assert subject["xcat"]["auto_disposition"] == "PROTOCOL_HOLD"
    binding = next(item for item in evaluate_obligations(subject) if item["obligation_id"] == "bind:xcat")
    assert binding["status"] == "UNKNOWN"
    assert "CATEGORY_MISMATCH" not in binding["reason_codes"]


def test_explicit_xcat_id_still_wins() -> None:
    goal = "Write a function."
    k3 = select_prompt_techniques(
        {"goal": goal},
        {"display_label": "Coding", "xcat_id": "CAT:C02"},
        {},
    )
    subject = subject_from_k3(k3, _prompt(goal))
    assert subject["xcat"] == {"active_category": "C02", "taxonomy_version": "2"}
    assert subject["protected_intent"]["category"] == "C02"
