"""Governing-state proof. Caller strings are not evidence."""

from __future__ import annotations

import json
from pathlib import Path

from spe_runtime.k3.selector import select_prompt_techniques
from spe_runtime.quality.engine import evaluate_from_k3, governing_proof_refs, quality_delta, reconstruct
from spe_runtime.xcat.migration import CURRENT_TAXONOMY_VERSION
from tests.unit.test_quality_task57 import _subject
from tests.unit.test_quality_task57r import _from_k3, _missing_constraint

REPO = Path(__file__).resolve().parents[2]


def _live_protected() -> dict:
    goal = "Write a four-week launch checklist. Budget must remain $2000. Do not invent extra spend."
    return {
        "goal": goal,
        "hard_constraints": [
            {
                "constraint_id": "c-preserve-intent",
                "statement": "Preserve the user's stated goal without inventing obligations",
                "strength": "HARD",
            }
        ],
        "budget": None,
        "facts": [{"fact_id": "f-user-request", "statement": goal}],
        "authority_state": {"grants": [], "level": 0, "status": "NONE"},
        "provenance": [{"provenance_id": "p-user", "source": "user"}],
    }


def _live_k3() -> dict:
    return select_prompt_techniques(_live_protected(), {"display_label": "Research"}, {})


def _corrupt(prompt: str, statement: str) -> str:
    bullet = f"- {statement}"
    return prompt.replace(f"## Hard constraints\n{bullet}", "## Hard constraints\nnone", 1)


def test_registry_is_the_taxonomy_owner() -> None:
    registry = json.loads((REPO / "data" / "category_registry_v1.json").read_text())
    assert registry["version"] == CURRENT_TAXONOMY_VERSION
    assert registry["taxonomy"] == "DOMAIN"


def test_real_k3_shape_accepts_one_constraint_restore() -> None:
    k3 = _live_k3()
    assert "proof_refs" not in k3
    assert "taxonomy_version" not in k3["category_context"]
    compiled = k3["prompt_effect_plan"]["compiled_prompt"]
    statement = "Preserve the user's stated goal without inventing obligations"
    result = evaluate_from_k3(
        {
            "compiled_prompt": _corrupt(compiled, statement),
            "k3_output": k3,
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
            "spe_api": "quality",
        }
    )
    reconstruction = result["reconstruction"]
    assert reconstruction["kept"] == "repaired"
    assert reconstruction["plan"]["disposition"] == "ACCEPTED"
    assert reconstruction["quality_delta"]["disposition"] == "IMPROVED"
    assert reconstruction["quality_delta"]["protected_regressions"] == []
    assert reconstruction["plan"]["attempt_index"] <= 1
    assert reconstruction["plan"]["max_attempts"] == 1
    assert result["receipt"]["verdict"] == "PASS"
    kept = reconstruction["kept_subject"]["compiled_prompt"]
    assert statement in kept
    assert result["subject"]["xcat"]["taxonomy_version"] == CURRENT_TAXONOMY_VERSION
    assert result["subject"]["xcat"]["active_category"] == "C02"
    assert result["subject"]["proof_refs"] == governing_proof_refs(result["subject"])
    assert all(not item.startswith("browsing") for item in result["subject"]["proof_refs"])
    assert "citations exist" not in " ".join(result["subject"]["proof_refs"])


def test_caller_fake_proof_refs_do_not_improve() -> None:
    k3 = _live_k3()
    k3["proof_refs"] = ["fake"]
    compiled = k3["prompt_effect_plan"]["compiled_prompt"]
    statement = "Preserve the user's stated goal without inventing obligations"
    result = evaluate_from_k3(
        {
            "compiled_prompt": _corrupt(compiled, statement),
            "k3_output": k3,
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
        }
    )
    assert "fake" not in result["subject"]["proof_refs"]
    before = _missing_constraint()
    after = _subject(before["protected_intent"], plan_prompt=before["effect_plan"]["compiled_prompt"])
    before["proof_refs"] = ["fake"]
    after["proof_refs"] = ["fake"]
    assert quality_delta(before, after)["disposition"] != "IMPROVED"


def test_wrong_taxonomy_category_graph_k3_effect_or_intent_is_not_improved() -> None:
    def stale(mutator) -> tuple[dict, dict]:
        before = _missing_constraint()
        after = _subject(before["protected_intent"], plan_prompt=before["effect_plan"]["compiled_prompt"])
        mutator(before)
        mutator(after)
        return before, after

    mutations = {
        "taxonomy": lambda subject: subject["xcat"].update({"taxonomy_version": "9"}),
        "category": lambda subject: subject["xcat"].update({"active_category": "C09"}),
        "graph": lambda subject: subject.update({"requirement_graph": {"graph_digest": "other", "validity": "VALID"}}),
        "k3": lambda subject: subject.update({"k3": {"selection_id": "sel-other", "techniques": list(subject["k3"]["techniques"])}}),
        "effect": lambda subject: subject.update({"effect_plan": {**subject["effect_plan"], "selection_id": "sel-other"}}),
        "intent": lambda subject: subject.update({"protected_intent": {**subject["protected_intent"], "goal": "other goal"}}),
    }
    for name, mutator in mutations.items():
        before, after = stale(mutator)
        assert quality_delta(before, after)["disposition"] != "IMPROVED", name


def test_missing_proof_is_not_satisfied_and_external_claim_is_rejected() -> None:
    missing = _subject(proof_refs=[])
    assert quality_delta(missing, missing)["disposition"] != "IMPROVED"
    claimed = _subject()
    claimed["proof_refs"] = governing_proof_refs(claimed) + ["browsing happened"]
    assert quality_delta(claimed, claimed)["disposition"] != "IMPROVED"
    assert reconstruct(_missing_constraint(), attempt_index=2)["plan"]["disposition"] == "REFUSED"


def test_f3_mutants_are_killed() -> None:
    killed = []
    fake = _from_k3(_missing_constraint(), **{})
    payload_subject = fake["subject"]
    payload_subject["proof_refs"] = ["fake"]
    assert quality_delta(payload_subject, _subject())["disposition"] != "IMPROVED"
    killed.append("F3-01")
    wrong_tax = _subject()
    wrong_tax["xcat"] = {"active_category": "C01", "taxonomy_version": "9"}
    wrong_tax["proof_refs"] = governing_proof_refs(wrong_tax)
    assert quality_delta(wrong_tax, _subject())["disposition"] != "IMPROVED"
    killed.append("F3-02")
    wrong_cat = _subject()
    wrong_cat["xcat"] = {"active_category": "C09", "taxonomy_version": CURRENT_TAXONOMY_VERSION}
    wrong_cat["proof_refs"] = governing_proof_refs(wrong_cat)
    assert quality_delta(wrong_cat, _subject())["disposition"] != "IMPROVED"
    killed.append("F3-03")
    wrong_graph = _subject()
    wrong_graph["requirement_graph"] = {"graph_digest": "other", "validity": "VALID"}
    wrong_graph["proof_refs"] = governing_proof_refs(wrong_graph)
    assert quality_delta(wrong_graph, _subject())["disposition"] != "IMPROVED"
    killed.append("F3-04")
    wrong_k3 = _subject()
    wrong_k3["k3"] = {"selection_id": "other", "techniques": ["ZERO_SHOT"]}
    wrong_k3["proof_refs"] = governing_proof_refs(wrong_k3)
    assert quality_delta(wrong_k3, _subject())["disposition"] != "IMPROVED"
    killed.append("F3-05")
    wrong_effect = _subject()
    wrong_effect["effect_plan"] = {**wrong_effect["effect_plan"], "selection_id": "other"}
    wrong_effect["proof_refs"] = governing_proof_refs(wrong_effect)
    assert quality_delta(wrong_effect, _subject())["disposition"] != "IMPROVED"
    killed.append("F3-06")
    wrong_intent = _subject(protected={**_subject()["protected_intent"], "goal": "other"})
    assert quality_delta(wrong_intent, _subject())["disposition"] != "IMPROVED"
    killed.append("F3-07")
    browsing = _subject()
    browsing["proof_refs"] = governing_proof_refs(browsing) + ["browsing happened"]
    assert quality_delta(browsing, browsing)["disposition"] != "IMPROVED"
    killed.append("F3-08")
    absent = _subject(proof_refs=[])
    assert quality_delta(absent, _subject())["disposition"] != "IMPROVED"
    killed.append("F3-09")
    assert reconstruct(_missing_constraint(), attempt_index=2)["plan"]["max_attempts"] == 1
    assert reconstruct(_missing_constraint(), attempt_index=2)["plan"]["disposition"] == "REFUSED"
    killed.append("F3-10")
    assert len(killed) == 10
