"""Tests for SPE Ω 1-Line Drop-In Developer SDK."""

import pytest

import spe
from spe_runtime.runtime_gateway.models import CapabilityType


def test_sdk_audit_savings():
    report = spe.audit_savings(task_count=500)
    assert report.net_cost_reduction_percent >= 70.0
    assert report.spe_optimized_cost_usd < report.baseline_naive_cost_usd
    assert report.projected_annual_savings_100k_tasks_usd > 0.0


def test_sdk_deterministic_math_offload():
    @spe.protect(intent="Calculate invoice total with 0 tokens", max_budget_usd=0.01)
    def calculate_invoice(expr: str) -> float:
        # If not offloaded, this would call an LLM
        return -1.0

    # Deterministic expression offloaded locally at zero token cost!
    result = calculate_invoice("150 * 3 + 45")
    assert result == 495.0


def test_sdk_capability_guard_allow_and_deny():
    # Attempting an action with ungranted capability will be blocked
    @spe.protect(
        intent="Delete temporary production cache",
        max_budget_usd=0.10,
        capabilities=["DELETE_FILE"],
        resource="/etc/critical.conf",
    )
    def dangerous_action() -> str:
        return "deleted"

    # Should raise PermissionError because DELETE_FILE on /etc/critical.conf is not granted
    with pytest.raises(PermissionError) as exc_info:
        dangerous_action()
    assert "SPE Capability Guard Blocked Execution" in str(exc_info.value)

    # Now grant the capability explicitly
    spe.grant_capability(
        capability="DELETE_FILE",
        resource_scope="/tmp/scratch/*",
        action_scope="*",
        budget_usd=50.0,
    )

    @spe.protect(
        intent="Delete scratch temp file",
        max_budget_usd=0.10,
        capabilities=["DELETE_FILE"],
        resource="/tmp/scratch/temp_123.txt",
    )
    def safe_action() -> str:
        return "deleted_safe"

    res = safe_action()
    assert res == "deleted_safe"


def test_sdk_invariant_verification_guard():
    @spe.protect(
        intent="Format user greeting safely",
        max_budget_usd=0.02,
        invariant_check=lambda out: "DROP TABLE" not in out and len(out) > 0,
    )
    def agent_reply(user_name: str) -> str:
        if "evil" in user_name:
            return "DROP TABLE users;"
        return f"Hello, {user_name}!"

    # Clean input passes invariant
    assert agent_reply("Alice") == "Hello, Alice!"

    # Injection violating invariant is intercepted and blocked
    with pytest.raises(ValueError) as exc:
        agent_reply("evil_hacker")
    assert "SPE Behavioral Invariant Guard Violated" in str(exc.value)


def test_sdk_wrap_and_execute_guarded():
    def mock_llm_extractor(text: str) -> dict:
        return {"entities": ["Server-A", "10.0.0.1"], "status": "active"}

    # Test spe.wrap
    wrapped_fn = spe.wrap(mock_llm_extractor, intent="Network entity extractor", max_budget_usd=0.05)
    res_wrapped = wrapped_fn("Inspect interface eth0 on Server-A")
    assert res_wrapped.data["status"] == "active"
    assert res_wrapped.receipt.intent == "Network entity extractor"
    assert res_wrapped.receipt.decision == "ALLOWED"

    # Test spe.execute_guarded direct call
    res_direct = spe.execute_guarded(
        mock_llm_extractor,
        "Check status of Server-B",
        intent="Direct entity audit",
        max_budget_usd=0.02,
    )
    assert isinstance(res_direct, spe.SPEResult)
    assert res_direct["status"] == "active"
    assert res_direct.receipt.invariants_satisfied is True
