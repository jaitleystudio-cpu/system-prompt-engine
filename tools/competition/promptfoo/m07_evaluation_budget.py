"""M07: non-executing SPE/Promptfoo fairness and worst-case API budget gate.

This calculates a proposal only; it never calls a model, proves an evaluator
independent, validates signed receipts, or authorizes real API spending.
"""
from __future__ import annotations

import argparse
from decimal import Decimal, InvalidOperation, ROUND_UP
import json
from pathlib import Path
from typing import Any

SPLITS = ("DEV", "VAL", "FRESH_HELD_OUT")


def _money(value: Any, label: str) -> Decimal:
    if isinstance(value, bool) or value is None or isinstance(value, (dict, list)):
        raise ValueError(f"{label}: numeric value required")
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"{label}: invalid number") from exc
    if not amount.is_finite() or amount < 0:
        raise ValueError(f"{label}: nonfinite/negative value")
    return amount


def _count(value: Any, label: str, allow_zero: bool = False) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < (0 if allow_zero else 1):
        raise ValueError(f"{label}: invalid integer")
    return value


def assess(plan: dict[str, Any]) -> dict[str, Any]:
    """Compute the capped call envelope and always withhold execution authority."""
    if plan.get("schema") != "spe.promptfoo.m07.budget_plan.v1":
        raise ValueError("unknown plan schema")
    split = plan.get("splits")
    if not isinstance(split, dict) or set(split) != set(SPLITS):
        raise ValueError("expected DEV/VAL/FRESH_HELD_OUT splits")
    counts = {k: _count(split[k], k, allow_zero=(k == "FRESH_HELD_OUT")) for k in SPLITS}
    target = plan.get("target")
    if not isinstance(target, dict):
        raise ValueError("target model specifications required")
    calls = _count(target.get("max_calls_per_case_per_arm"), "max_calls_per_case_per_arm")
    trials = _count(target.get("trials"), "trials")
    inp = _count(target.get("max_input_tokens"), "max_input_tokens")
    out = _count(target.get("max_output_tokens"), "max_output_tokens")
    suggestion = _count(target.get("max_optimizer_suggestion_calls"), "max_optimizer_suggestion_calls", True)
    if calls > 10 or trials > 10 or inp > 250000 or out > 50000 or suggestion > 10000:
        raise ValueError("experiment resource ceiling exceeded")
    pricing = plan.get("pricing")
    if not isinstance(pricing, dict):
        raise ValueError("pricing disclosure required")
    input_rate = pricing.get("usd_per_million_input_tokens")
    output_rate = pricing.get("usd_per_million_output_tokens")
    one_call = None
    if input_rate is not None and output_rate is not None:
        one_call = (Decimal(inp)*_money(input_rate, "input_price")
                    + Decimal(out)*_money(output_rate, "output_price"))/Decimal(1000000)
    suggestion_rates = plan.get("suggestion_pricing")
    suggestion_one_call = Decimal(0) if suggestion == 0 else None
    if suggestion and isinstance(suggestion_rates, dict):
        if suggestion_rates.get("usd_per_million_input_tokens") is not None and suggestion_rates.get("usd_per_million_output_tokens") is not None:
            suggestion_one_call = (
                Decimal(inp)*_money(suggestion_rates["usd_per_million_input_tokens"], "suggestion_input_price")
                + Decimal(out)*_money(suggestion_rates["usd_per_million_output_tokens"], "suggestion_output_price")
            )/Decimal(1000000)
    total_cases = sum(counts.values())
    paired_calls = total_cases*2*trials*calls
    total_calls = paired_calls+suggestion
    estimated = (one_call*paired_calls+suggestion_one_call*suggestion
                 if one_call is not None and suggestion_one_call is not None else None)
    owner_cap = pricing.get("owner_approved_usd_cap")
    budget = _money(owner_cap, "owner_approved_usd_cap") if owner_cap is not None else None

    blockers = []
    model_id = target.get("model_id")
    if not isinstance(model_id, str) or not model_id.strip() or model_id.upper() in ("UNKNOWN", "UNSELECTED", "ECHO"):
        blockers.append("REAL_TARGET_MODEL_NOT_PINNED")
    if target.get("promptfoo_provider") == "echo" or target.get("spe_provider") == "echo":
        blockers.append("ECHO_IS_NOT_REAL_MODEL_EVIDENCE")
    version = target.get("model_version")
    if not isinstance(version, str) or not version.strip():
        blockers.append("MODEL_VERSION_NOT_PINNED")
    if counts["FRESH_HELD_OUT"] == 0:
        blockers.append("NO_FRESH_BLIND_HOLDOUTS")
    if plan.get("original_exposed_holdouts_reused") is not False:
        blockers.append("EXPOSED_HOLDOUT_CONTAMINATION_RISK")
    # Boolean attestations from input JSON cannot certify custodian independence.
    blockers += ["INDEPENDENT_CUSTODIAN_ATTESTATION_NOT_VERIFIED",
                 "OWNER_SIGNED_BUDGET_AUTHORIZATION_NOT_VERIFIED"]
    if estimated is None:
        blockers.append("MODEL_PRICES_UNVERIFIED")
    if suggestion and suggestion_one_call is None:
        blockers.append("OPTIMIZER_SUGGESTION_PRICES_UNVERIFIED")
    if budget is None:
        blockers.append("OWNER_BUDGET_CAP_MISSING")
    elif estimated is not None and budget < estimated:
        blockers.append("BUDGET_INSUFFICIENT_FOR_WORST_CASE")
    hypothesis = plan.get("commercial_hypothesis")
    if not isinstance(hypothesis, str) or not hypothesis.strip():
        blockers.append("NO_COMMERCIAL_HYPOTHESIS")
    if plan.get("observed_buyer_demand") is not True:
        blockers.append("BUYER_DEMAND_NOT_MEASURED")

    return {
        "mission": "M07",
        "scope": "STATIC_NON_EXECUTING_BUDGET_AND_FAIRNESS_PREFLIGHT",
        "split_counts": counts,
        "total_cases": total_cases,
        "paired_model_calls_upper_bound": paired_calls,
        "optimizer_suggestion_calls_upper_bound": suggestion,
        "total_model_calls_upper_bound": total_calls,
        "worst_case_model_inference_usd": (
            str(estimated.quantize(Decimal("0.000001"), rounding=ROUND_UP))
            if estimated is not None else None
        ),
        "does_not_include": ["CI_minutes", "taxes", "data_egress", "human_review", "hosting", "search", "other_provider_fees"],
        "blockers": sorted(set(blockers)),
        "run_permission": "DENIED",
        "model_evaluation": "NOT_RUN",
        "competitive_verdict": "NOT_ADJUDICATED",
        "profitability": "NOT_ESTABLISHED",
        "advisory_only": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Non-executing, fail-closed M07 preregistration gate")
    parser.add_argument("--plan", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        result = assess(json.loads(args.plan.read_text(encoding="utf-8")))
    except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        result = {"mission": "M07", "run_permission": "DENIED", "model_evaluation": "NOT_RUN", "validation_error": str(exc)}
    encoded = json.dumps(result, indent=2, sort_keys=True)+"\n"
    if args.output:
        args.output.write_text(encoded, encoding="utf-8")
    print(encoded, end="")
    return 0 if "validation_error" not in result else 2


if __name__ == "__main__":
    raise SystemExit(main())
