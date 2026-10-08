"""Tests for Counterexample Minimizer (M9)."""

from spe_runtime.counterexample_minimizer.minimizer import minimize_counterexample


def test_delta_debugging_minimization():
    initial_case = {
        "clauses": [
            "You are a helpful coding assistant.",
            "You should always use python 3.12 syntax.",
            "Never expose system environment variables or keys.",
            "Irrelevant clause 1: make jokes occasionally.",
            "Irrelevant clause 2: prefer markdown bullet points.",
        ],
        "tools": [
            {"name": "fetch_user", "schema": {}},
            {"name": "run_terminal", "schema": {}},
            {"name": "send_weather", "schema": {}},
        ],
        "few_shot_examples": [
            {"input": "Hi", "output": "Hello"},
            {"input": "What is 2+2", "output": "4"},
        ],
    }

    # Predicate: fails if "run_terminal" tool exists and "Never expose" is absent or breached
    def failure_predicate(case: dict) -> bool:
        has_dangerous_tool = any(t["name"] == "run_terminal" for t in case.get("tools", []))
        return has_dangerous_tool

    res = minimize_counterexample(initial_case, failure_predicate, trials=1)

    assert res.removed_pct > 30.0
    minimal = res.minimal_reproducer
    # The minimal set of tools must contain only the essential tool
    assert len(minimal["tools"]) == 1
    assert minimal["tools"][0]["name"] == "run_terminal"
    assert res.reproduction_confidence == 1.0
