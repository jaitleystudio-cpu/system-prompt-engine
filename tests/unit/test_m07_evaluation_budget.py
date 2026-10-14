"""M07 static preregistration never authorizes unverified paid evaluation."""
from copy import deepcopy
import json
from pathlib import Path

import pytest

from tools.competition.promptfoo.m07_evaluation_budget import assess

ROOT = Path(__file__).resolve().parents[2]
BASE = json.loads((ROOT / "tools/competition/promptfoo/m07_plan.json").read_text())


def test_original_mission_plan_is_blocked_without_faking_prices():
    r = assess(BASE)
    assert r["run_permission"] == "DENIED"
    assert r["model_evaluation"] == "NOT_RUN"
    assert r["worst_case_model_inference_usd"] is None
    assert r["total_model_calls_upper_bound"] == 60
    assert "NO_FRESH_BLIND_HOLDOUTS" in r["blockers"]
    assert "OWNER_SIGNED_BUDGET_AUTHORIZATION_NOT_VERIFIED" in r["blockers"]


def test_hypothetical_complete_budget_does_not_grant_spend_authority():
    p = deepcopy(BASE)
    p["target"].update(model_id="model-pinned", model_version="snapshot-1",
                       max_optimizer_suggestion_calls=6)
    p["splits"]["FRESH_HELD_OUT"] = 10
    p["pricing"].update(usd_per_million_input_tokens="5",
                        usd_per_million_output_tokens="15",
                        owner_approved_usd_cap="15")
    p["suggestion_pricing"] = {"usd_per_million_input_tokens": "5",
                               "usd_per_million_output_tokens": "15"}
    p["observed_buyer_demand"] = True
    r = assess(p)
    assert r["total_model_calls_upper_bound"] == 86
    assert r["worst_case_model_inference_usd"] == "6.164480"
    assert r["run_permission"] == "DENIED"
    assert r["competitive_verdict"] == "NOT_ADJUDICATED"


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), True, -1, "invalid"])
def test_bad_prices_fail_closed(bad):
    p = deepcopy(BASE)
    p["pricing"].update(usd_per_million_input_tokens=bad,
                        usd_per_million_output_tokens="1")
    with pytest.raises(ValueError):
        assess(p)


def test_reused_exposed_holdout_rejected():
    p = deepcopy(BASE)
    p["original_exposed_holdouts_reused"] = True
    assert "EXPOSED_HOLDOUT_CONTAMINATION_RISK" in assess(p)["blockers"]


def test_echo_is_not_a_real_model():
    p = deepcopy(BASE)
    p["target"]["promptfoo_provider"] = "echo"
    assert "ECHO_IS_NOT_REAL_MODEL_EVIDENCE" in assess(p)["blockers"]


def test_unbounded_trials_rejected():
    p = deepcopy(BASE)
    p["target"]["trials"] = 100000000
    with pytest.raises(ValueError):
        assess(p)


def test_noncanonical_splits_rejected():
    p = deepcopy(BASE)
    p["splits"] = {"DEV": 10, "VAL": 3, "HELD_OUT": 5}
    with pytest.raises(ValueError):
        assess(p)


def test_boolean_case_count_rejected():
    p = deepcopy(BASE)
    p["splits"]["DEV"] = True
    with pytest.raises(ValueError):
        assess(p)


def test_insufficient_cost_ceiling_detected():
    p = deepcopy(BASE)
    p["pricing"].update(usd_per_million_input_tokens="5",
                        usd_per_million_output_tokens="15",
                        owner_approved_usd_cap="0")
    assert "BUDGET_INSUFFICIENT_FOR_WORST_CASE" in assess(p)["blockers"]


def test_weak_commercial_case_is_explicit():
    p = deepcopy(BASE)
    p["commercial_hypothesis"] = " "
    assert "NO_COMMERCIAL_HYPOTHESIS" in assess(p)["blockers"]


def test_unpriced_optimizer_calls_cannot_be_hidden():
    p = deepcopy(BASE)
    p["target"]["max_optimizer_suggestion_calls"] = 6
    p["pricing"].update(usd_per_million_input_tokens="5",
                        usd_per_million_output_tokens="15",
                        owner_approved_usd_cap="50")
    r = assess(p)
    assert r["worst_case_model_inference_usd"] is None
    assert "OPTIMIZER_SUGGESTION_PRICES_UNVERIFIED" in r["blockers"]
    assert r["run_permission"] == "DENIED"
