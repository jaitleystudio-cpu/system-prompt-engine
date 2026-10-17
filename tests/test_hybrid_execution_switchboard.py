"""Comprehensive tests for SPE Ω Universal Local-First Hybrid Intelligence Architecture.

Verifies:
1. Device capability qualification (RAM, thermal, battery, context window, model inventory).
2. Cloud Gate policy enforcement (STRICT_OFFLINE, APPROVAL_REQUIRED, BOUNDED_HYBRID).
3. Budget escrow invariants (reservation, commit, release, over-budget refusal).
4. Data disclosure scopes and sensitive data leak prevention.
5. Hybrid Switchboard 6-mode compute placement (DETERMINISTIC, NEURAL, SPLIT, CLOUD, RECOVERY, BLOCKED).
6. Immutable SHA-256 Execution Placement Certificates.
7. End-to-end Wire Proxy hybrid switching and honest telemetry headers.
8. Drop-in SDK @spe.protect(hybrid=True) receipts and authority enforcement.
"""

from __future__ import annotations

import asyncio
import http.server
import json
import socket
import threading
import urllib.error
import urllib.request
import pytest

import spe
from spe_runtime.cost_engine.telemetry import (
    CostSource,
    TelemetryEvidence,
)
from spe_runtime.hybrid import (
    ApprovalRequiredError,
    BudgetEscrow,
    BudgetExceededError,
    CloudGate,
    DataDisclosureScope,
    DeviceCapabilityProfile,
    DeviceProfiler,
    EgressProhibitedError,
    ExecutionPlacementCertificate,
    ExecutionPlacementPlan,
    HybridPolicy,
    HybridSwitchboard,
    PlacementTarget,
    ProviderNotAllowlistedError,
    QualificationVerdict,
    SensitiveDataLeakageError,
    TaskRequirement,
)
from spe_runtime.runtime_gateway.wire_proxy import WireProxyServer


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# ---------------------------------------------------------------------------
# 1. Device Capability Qualification Tests
# ---------------------------------------------------------------------------

def test_device_qualification_happy_path():
    """Qualified device with sufficient memory and installed model selects LOCAL_NEURAL."""
    profile = DeviceCapabilityProfile(
        device_id="test-mac-m2",
        platform="macos",
        cpu_architecture="arm64",
        total_memory_mb=16384,
        available_memory_mb=8192,
        has_gpu_or_npu=True,
        gpu_device_name="Apple M2 GPU",
        battery_percentage=85.0,
        is_charging=False,
        is_thermal_throttled=False,
        installed_local_models=["llama3:8b", "qwen2.5:7b"],
        measured_local_tok_per_sec=42.0,
        max_context_tokens_local=8192,
    )
    verdict = profile.qualify_for_task(task_complexity_score=0.4, context_tokens=1024)
    assert verdict.qualified is True
    assert verdict.recommended_target == PlacementTarget.LOCAL_NEURAL
    assert verdict.memory_sufficient is True
    assert verdict.thermal_ok is True
    assert verdict.battery_sufficient is True


def test_device_qualification_low_memory_fails():
    """Device with inadequate RAM (< 2048 MB) fails local qualification."""
    profile = DeviceCapabilityProfile(
        device_id="test-phone-low-ram",
        platform="android",
        cpu_architecture="arm64",
        total_memory_mb=3072,
        available_memory_mb=1024,  # only 1GB available
        has_gpu_or_npu=False,
        installed_local_models=["tinyllama"],
    )
    verdict = profile.qualify_for_task(task_complexity_score=0.3, context_tokens=500, min_ram_mb=2048)
    assert verdict.qualified is False
    assert verdict.recommended_target == PlacementTarget.CLOUD_AUTHORIZED
    assert verdict.memory_sufficient is False
    assert "RAM" in verdict.reason


def test_device_qualification_thermal_throttling_guard():
    """Thermally throttled device refuses local neural compute to prevent hardware degradation."""
    profile = DeviceCapabilityProfile(
        device_id="test-hot-laptop",
        platform="linux",
        cpu_architecture="x86_64",
        total_memory_mb=32768,
        available_memory_mb=16384,
        has_gpu_or_npu=True,
        is_thermal_throttled=True,  # CPU/GPU overheating
        installed_local_models=["mistral:7b"],
    )
    verdict = profile.qualify_for_task(task_complexity_score=0.2, context_tokens=256)
    assert verdict.qualified is False
    assert verdict.thermal_ok is False
    assert "thermally throttled" in verdict.reason.lower()


def test_device_qualification_low_battery_discharging_guard():
    """Battery below 15% discharging prevents local battery drain; charging allows execution."""
    profile_discharging = DeviceCapabilityProfile(
        device_id="test-phone-dead-battery",
        platform="ios",
        cpu_architecture="arm64",
        total_memory_mb=8192,
        available_memory_mb=4096,
        has_gpu_or_npu=True,
        battery_percentage=12.0,
        is_charging=False,
        installed_local_models=["apple-foundation-model"],
    )
    verdict = profile_discharging.qualify_for_task(task_complexity_score=0.2, context_tokens=256)
    assert verdict.qualified is False
    assert verdict.battery_sufficient is False
    assert "15%" in verdict.reason

    # When plugged in to charger, same battery level passes
    profile_charging = DeviceCapabilityProfile(
        device_id="test-phone-plugged-in",
        platform="ios",
        cpu_architecture="arm64",
        total_memory_mb=8192,
        available_memory_mb=4096,
        has_gpu_or_npu=True,
        battery_percentage=12.0,
        is_charging=True,  # Charging!
        installed_local_models=["apple-foundation-model"],
    )
    verdict_charging = profile_charging.qualify_for_task(task_complexity_score=0.2, context_tokens=256)
    assert verdict_charging.qualified is True
    assert verdict_charging.battery_sufficient is True


def test_device_qualification_high_complexity_suggests_split():
    """Task exceeding local capability frontier (complexity > 0.75) recommends HYBRID_SPLIT."""
    profile = DeviceCapabilityProfile(
        device_id="test-workstation",
        platform="macos",
        cpu_architecture="arm64",
        total_memory_mb=32768,
        available_memory_mb=20480,
        has_gpu_or_npu=True,
        installed_local_models=["llama3:8b"],
    )
    verdict = profile.qualify_for_task(task_complexity_score=0.82, context_tokens=1000)
    assert verdict.qualified is False
    assert verdict.recommended_target == PlacementTarget.HYBRID_SPLIT


# ---------------------------------------------------------------------------
# 2. Cloud Gate & Budget Escrow Tests
# ---------------------------------------------------------------------------

def test_cloud_gate_strict_offline_guarantee():
    """STRICT_OFFLINE policy guarantees zero egress and zero cloud token spending ($0 hard limit)."""
    gate = CloudGate(policy=HybridPolicy.STRICT_OFFLINE, max_budget_usd=10.0)
    task = TaskRequirement(task_id="t-offline", prompt="Run query", estimated_tokens=100, complexity_score=0.9)

    eligible, reason = gate.check_eligibility(task, provider="openai", estimated_usd=0.01)
    assert eligible is False
    assert "STRICT_OFFLINE" in reason

    with pytest.raises(EgressProhibitedError):
        gate.open_gate(task, provider="openai", estimated_usd=0.01)


def test_cloud_gate_approval_required_policy():
    """APPROVAL_REQUIRED policy requires explicit authorization token."""
    gate = CloudGate(policy=HybridPolicy.APPROVAL_REQUIRED, max_budget_usd=10.0)
    task = TaskRequirement(task_id="t-approval", prompt="Heavy analysis", estimated_tokens=100, complexity_score=0.9)

    # Missing token raises ApprovalRequiredError
    with pytest.raises(ApprovalRequiredError):
        gate.open_gate(task, provider="openai", estimated_usd=0.02, approval_token=None)

    # Valid token opens gate and reserves escrow
    res = gate.open_gate(task, provider="openai", estimated_usd=0.02, approval_token="token-auth-valid-123")
    assert res.reserved_usd == 0.02
    assert gate.escrow.available_budget_usd == pytest.approx(9.98, 0.001)


def test_budget_escrow_over_budget_refusal():
    """Budget escrow strictly refuses reservations when cumulative spend + active escrow exceeds cap."""
    escrow = BudgetEscrow(max_authorized_usd=0.05)
    r1 = escrow.reserve("task-1", 0.03)
    assert escrow.available_budget_usd == pytest.approx(0.02, 0.001)

    # Requesting 0.03 more exceeds 0.05 limit
    with pytest.raises(BudgetExceededError):
        escrow.reserve("task-2", 0.03)

    # Committing actual 0.025 for r1
    escrow.commit(r1.escrow_id, 0.025)
    assert escrow.spent_usd == pytest.approx(0.025, 0.001)
    assert escrow.available_budget_usd == pytest.approx(0.025, 0.001)

    # Releasing reservation on failure restores available funds
    r2 = escrow.reserve("task-3", 0.02)
    assert escrow.available_budget_usd == pytest.approx(0.005, 0.001)
    escrow.release(r2.escrow_id)
    assert escrow.available_budget_usd == pytest.approx(0.025, 0.001)


def test_cloud_gate_sensitive_data_and_provider_allowlist():
    """Cloud gate prevents sensitive data egress under LOCAL_ONLY scope and rejects non-allowlisted providers."""
    gate = CloudGate(
        policy=HybridPolicy.BOUNDED_HYBRID,
        max_budget_usd=1.0,
        allowed_providers=["openai", "together"],
        disclosure_scope=DataDisclosureScope.LOCAL_ONLY,
    )

    # 1. Non-allowlisted provider rejected
    task_safe = TaskRequirement(task_id="t-safe", prompt="Hello", estimated_tokens=50, complexity_score=0.9)
    with pytest.raises(ProviderNotAllowlistedError):
        gate.open_gate(task_safe, provider="unapproved-rogue-api", estimated_usd=0.005)

    # 2. Sensitive data rejected under LOCAL_ONLY
    task_sensitive = TaskRequirement(
        task_id="t-sens",
        prompt="Analyze user SSN: 123-45-6789",
        estimated_tokens=50,
        complexity_score=0.9,
        contains_sensitive_data=True,
    )
    with pytest.raises(SensitiveDataLeakageError):
        gate.open_gate(task_sensitive, provider="openai", estimated_usd=0.005)


# ---------------------------------------------------------------------------
# 3. Hybrid Switchboard Placement Tests
# ---------------------------------------------------------------------------

def test_switchboard_deterministic_ast_offload():
    """Math queries are routed to LOCAL_DETERMINISTIC ($0, zero neural tokens)."""
    switchboard = HybridSwitchboard()
    task = TaskRequirement(
        task_id="t-math",
        prompt="what is 450 * 32 / 4?",
        estimated_tokens=15,
        complexity_score=0.1,
    )
    plan = switchboard.plan(task)
    assert plan.target == PlacementTarget.LOCAL_DETERMINISTIC
    assert plan.estimated_cost_usd == 0.0
    assert "AST math offloader" in plan.justification


def test_switchboard_local_neural_on_qualified_device():
    """Qualified local device with local engine routes to LOCAL_NEURAL ($0 cloud tokens)."""
    profile = DeviceCapabilityProfile(
        device_id="dev-pc",
        platform="macos",
        cpu_architecture="arm64",
        total_memory_mb=16384,
        available_memory_mb=8192,
        has_gpu_or_npu=True,
        installed_local_models=["spe-zero-friction-local"],
    )
    profiler = DeviceProfiler(override_profile=profile)
    switchboard = HybridSwitchboard(profiler=profiler, local_upstream_url="http://127.0.0.1:11434")

    task = TaskRequirement(
        task_id="t-local",
        prompt="Summarize this 10-line text.",
        estimated_tokens=100,
        complexity_score=0.3,
    )
    plan = switchboard.plan(task)
    assert plan.target == PlacementTarget.LOCAL_NEURAL
    assert plan.estimated_cost_usd == 0.0
    assert plan.local_backend_url == "http://127.0.0.1:11434"


def test_switchboard_hybrid_split_for_intermediate_task():
    """Intermediate task (complexity 0.8) on low-resource device triggers HYBRID_SPLIT with subtasks."""
    profile = DeviceCapabilityProfile(
        device_id="dev-phone",
        platform="android",
        cpu_architecture="arm64",
        total_memory_mb=4096,
        available_memory_mb=1024,  # Low RAM
        has_gpu_or_npu=False,
    )
    profiler = DeviceProfiler(override_profile=profile)
    gate = CloudGate(policy=HybridPolicy.BOUNDED_HYBRID, max_budget_usd=1.0)
    switchboard = HybridSwitchboard(profiler=profiler, cloud_gate=gate)

    task = TaskRequirement(
        task_id="t-split",
        prompt="Extract entities, analyze dependencies, and synthesize strategic summary.",
        estimated_tokens=600,
        complexity_score=0.82,  # in (0.75, 0.90] -> triggers HYBRID_SPLIT
    )
    plan = switchboard.plan(task)
    assert plan.target == PlacementTarget.HYBRID_SPLIT
    assert plan.escrow_id is not None
    assert len(plan.subtask_splits) == 3
    assert plan.subtask_splits[0]["target"] == "LOCAL_DETERMINISTIC"
    assert plan.subtask_splits[1]["target"] == "CLOUD_AUTHORIZED"
    assert plan.subtask_splits[2]["target"] == "LOCAL_DETERMINISTIC"


def test_switchboard_strict_offline_fallback_to_local_recovery():
    """When task exceeds local specs under STRICT_OFFLINE, switchboard falls back to LOCAL_RECOVERY ($0)."""
    profile = DeviceCapabilityProfile(
        device_id="dev-low-ram",
        platform="linux",
        cpu_architecture="x86_64",
        total_memory_mb=2048,
        available_memory_mb=512,
        has_gpu_or_npu=False,
    )
    profiler = DeviceProfiler(override_profile=profile)
    gate = CloudGate(policy=HybridPolicy.STRICT_OFFLINE, max_budget_usd=0.0)
    switchboard = HybridSwitchboard(profiler=profiler, cloud_gate=gate)

    task = TaskRequirement(
        task_id="t-recovery",
        prompt="Huge reasoning problem",
        estimated_tokens=5000,
        complexity_score=0.95,
    )
    plan = switchboard.plan(task)
    assert plan.target == PlacementTarget.LOCAL_RECOVERY
    assert plan.estimated_cost_usd == 0.0
    assert "STRICT_OFFLINE" in plan.justification


def test_switchboard_execution_placement_certificate():
    """Certify generates immutable SHA-256 integrity-verified placement certificate."""
    gate = CloudGate(policy=HybridPolicy.BOUNDED_HYBRID, max_budget_usd=0.50)
    switchboard = HybridSwitchboard(cloud_gate=gate)

    plan = ExecutionPlacementPlan(
        plan_id="plan-test-1",
        task_id="task-test-1",
        target=PlacementTarget.LOCAL_NEURAL,
        policy=HybridPolicy.BOUNDED_HYBRID,
        disclosure_scope=DataDisclosureScope.LOCAL_ONLY,
        estimated_cost_usd=0.0,
    )
    cert = switchboard.certify(plan, actual_spent_usd=0.0)
    assert cert.certificate_id.startswith("cert-")
    assert cert.selected_target == PlacementTarget.LOCAL_NEURAL
    assert cert.budget_spent_usd == 0.0
    assert cert.budget_remaining_usd == 0.50
    assert len(cert.integrity_hash) == 64  # SHA-256


# ---------------------------------------------------------------------------
# 4. Wire Proxy End-to-End Hybrid Switching Tests
# ---------------------------------------------------------------------------

class UpstreamEchoHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format: str, *args):
        pass

    def do_POST(self):
        len_h = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(len_h).decode("utf-8")
        req = json.loads(body)
        messages = req.get("messages", [])
        last = messages[-1].get("content", "") if messages else ""

        resp = {
            "id": "chatcmpl-echo-hybrid",
            "object": "chat.completion",
            "created": 1700000000,
            "model": req.get("model", "echo-model"),
            "choices": [{"index": 0, "message": {"role": "assistant", "content": f"Echo: {last}"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 40, "completion_tokens": 10, "total_tokens": 50, "prompt_tokens_details": {"cached_tokens": 0}},
        }
        raw_resp = json.dumps(resp).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw_resp)))
        self.end_headers()
        self.wfile.write(raw_resp)


def test_wire_proxy_hybrid_placement_headers():
    """Wire proxy evaluates switchboard and attaches honest placement headers."""
    upstream_port = find_free_port()
    proxy_port = find_free_port()

    # 1. Start mock upstream
    u_srv = http.server.HTTPServer(("127.0.0.1", upstream_port), UpstreamEchoHandler)
    u_thr = threading.Thread(target=u_srv.serve_forever, daemon=True)
    u_thr.start()

    # 2. Configure proxy with bounded hybrid policy
    gate = CloudGate(policy=HybridPolicy.BOUNDED_HYBRID, max_budget_usd=1.0)
    sb = HybridSwitchboard(cloud_gate=gate, local_upstream_url=f"http://127.0.0.1:{upstream_port}")

    proxy = WireProxyServer(
        host="127.0.0.1",
        port=proxy_port,
        upstream_url=f"http://127.0.0.1:{upstream_port}",
        api_key="spe-hybrid-token",
        switchboard=sb,
        require_auth=True,
    )
    proxy.start()

    try:
        base_url = proxy.base_url
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {proxy.api_key}",
        }

        # Case A: Math expression -> LOCAL_DETERMINISTIC ($0)
        req_math = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps({"messages": [{"role": "user", "content": "evaluate 120 + 80"}]}).encode("utf-8"),
            headers=headers,
        )
        with urllib.request.urlopen(req_math) as resp:
            assert resp.status == 200
            assert resp.headers.get("x-spe-placement-target") == PlacementTarget.LOCAL_DETERMINISTIC.value
            assert resp.headers.get("x-spe-offloaded") == "true"

        # Case B: Standard reasoning -> Forwarded with placement cert
        req_chat = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps({"messages": [{"role": "user", "content": "Explain hybrid switching"}]}).encode("utf-8"),
            headers=headers,
        )
        with urllib.request.urlopen(req_chat) as resp:
            assert resp.status == 200
            target = resp.headers.get("x-spe-placement-target")
            assert target in (PlacementTarget.LOCAL_NEURAL.value, PlacementTarget.CLOUD_AUTHORIZED.value)
            assert resp.headers.get("x-spe-placement-cert") is not None
            assert float(resp.headers.get("x-spe-budget-remaining-usd", "0")) > 0.0

    finally:
        proxy.stop()
        u_srv.shutdown()


def test_wire_proxy_approval_required_blocks_without_token():
    """Wire proxy with APPROVAL_REQUIRED blocks heavy reasoning requests without approval token."""
    proxy_port = find_free_port()
    # Mock profiler reporting device cannot run locally
    low_profile = DeviceCapabilityProfile(
        device_id="low-device",
        platform="linux",
        cpu_architecture="x86_64",
        total_memory_mb=1024,
        available_memory_mb=256,
        has_gpu_or_npu=False,
    )
    profiler = DeviceProfiler(override_profile=low_profile)
    gate = CloudGate(policy=HybridPolicy.APPROVAL_REQUIRED, max_budget_usd=1.0)
    sb = HybridSwitchboard(profiler=profiler, cloud_gate=gate)

    proxy = WireProxyServer(
        host="127.0.0.1",
        port=proxy_port,
        api_key="spe-approval-token",
        switchboard=sb,
        require_auth=True,
    )
    proxy.start()

    try:
        base_url = proxy.base_url
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {proxy.api_key}",
        }

        # Request heavy task without approval token
        req = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps({"messages": [{"role": "user", "content": "Complex multi-step task requiring cloud tokens"}]}).encode("utf-8"),
            headers=headers,
        )
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200
            body = json.loads(resp.read().decode("utf-8"))
            assert resp.headers.get("x-spe-blocked") == "true"
            assert resp.headers.get("x-spe-placement-target") == PlacementTarget.BLOCKED.value
            assert "APPROVAL_REQUIRED" in body["spe_reason"]

    finally:
        proxy.stop()


# ---------------------------------------------------------------------------
# 5. SDK @spe.protect(hybrid=True) Tests
# ---------------------------------------------------------------------------

def test_sdk_protect_hybrid_async():
    """Async function guarded with @spe.protect(hybrid=True) records placement target in receipt."""
    gate = CloudGate(policy=HybridPolicy.BOUNDED_HYBRID, max_budget_usd=5.0)
    sb = HybridSwitchboard(cloud_gate=gate)

    @spe.protect(
        intent="finance_audit",
        hybrid=True,
        switchboard=sb,
        return_result_wrapper=True,
    )
    async def perform_audit(ledger_query: str):
        await asyncio.sleep(0.01)
        return {"audit_status": "VERIFIED", "query": ledger_query}

    res = asyncio.run(perform_audit("Check accounts receivable"))
    assert res["audit_status"] == "VERIFIED"
    receipt = res.receipt
    assert receipt.placement_target in (PlacementTarget.LOCAL_NEURAL.value, PlacementTarget.LOCAL_DETERMINISTIC.value, PlacementTarget.CLOUD_AUTHORIZED.value)
    assert receipt.hybrid_policy == HybridPolicy.BOUNDED_HYBRID.value
    assert receipt.placement_cert_id is not None



def test_sdk_protect_hybrid_sync_math_offload():
    """Sync function guarded with @spe.protect(hybrid=True) offloads math and records LOCAL_DETERMINISTIC."""
    gate = CloudGate(policy=HybridPolicy.STRICT_OFFLINE)
    sb = HybridSwitchboard(cloud_gate=gate)

    @spe.protect(
        intent="math_evaluator",
        hybrid=True,
        switchboard=sb,
        return_result_wrapper=True,
    )
    def compute_sum(expr: str):
        return f"result of {expr}"

    res = compute_sum("500 * 20")
    # Deterministic AST offloader evaluates directly to 10000
    assert res.data == 10000
    receipt = res.receipt
    assert receipt.deterministic_offloaded is True
    assert receipt.cost_usd == 0.0
    assert receipt.placement_target == PlacementTarget.LOCAL_DETERMINISTIC.value
    assert receipt.hybrid_policy == HybridPolicy.STRICT_OFFLINE.value


# ---------------------------------------------------------------------------
# 6. Rigorous Edge Case Tests
# ---------------------------------------------------------------------------

def test_edge_case_empty_and_whitespace_prompt():
    """Empty or whitespace prompts are safely handled without crash."""
    sb = HybridSwitchboard()
    task = TaskRequirement(task_id="t-empty", prompt="   \n\t  ", estimated_tokens=0, complexity_score=0.0)
    plan = sb.plan(task)
    assert plan.target in (PlacementTarget.LOCAL_NEURAL, PlacementTarget.LOCAL_DETERMINISTIC)
    assert plan.estimated_cost_usd == 0.0


def test_edge_case_zero_budget_blocks_cloud_escalation():
    """Zero budget ($0.00) under BOUNDED_HYBRID blocks cloud escalation."""
    gate = CloudGate(policy=HybridPolicy.BOUNDED_HYBRID, max_budget_usd=0.0)
    profile = DeviceCapabilityProfile(
        device_id="dev-phone",
        platform="android",
        cpu_architecture="arm64",
        total_memory_mb=2048,
        available_memory_mb=512,
        has_gpu_or_npu=False,
    )
    profiler = DeviceProfiler(override_profile=profile)
    sb = HybridSwitchboard(profiler=profiler, cloud_gate=gate)

    task = TaskRequirement(task_id="t-zero-budget", prompt="Solve hard problem", estimated_tokens=500, complexity_score=0.95)
    plan = sb.plan(task)
    assert plan.target == PlacementTarget.BLOCKED
    assert "exceeds remaining budget" in plan.justification



def test_edge_case_exact_complexity_boundary():
    """Complexity exactly at 0.75 boundary qualifies for local neural if specs allow."""
    profile = DeviceCapabilityProfile(
        device_id="dev-boundary",
        platform="macos",
        cpu_architecture="arm64",
        total_memory_mb=16384,
        available_memory_mb=8192,
        has_gpu_or_npu=True,
        installed_local_models=["llama3:8b"],
    )
    verdict = profile.qualify_for_task(task_complexity_score=0.75, context_tokens=1000)
    assert verdict.qualified is True
    assert verdict.recommended_target == PlacementTarget.LOCAL_NEURAL

    # Complexity 0.7501 exceeds 0.75 threshold
    verdict_above = profile.qualify_for_task(task_complexity_score=0.7501, context_tokens=1000)
    assert verdict_above.qualified is False
    assert verdict_above.recommended_target == PlacementTarget.HYBRID_SPLIT


def test_edge_case_certificate_tamper_proofing():
    """Altering any field in the certificate breaks SHA-256 verification."""
    import hashlib
    cert = ExecutionPlacementCertificate.create(
        certificate_id="cert-tamper-1",
        plan_id="plan-tamper-1",
        task_id="task-tamper-1",
        selected_target=PlacementTarget.LOCAL_NEURAL,
        policy=HybridPolicy.BOUNDED_HYBRID,
        budget_spent_usd=0.0,
        budget_remaining_usd=1.0,
        evidence_class=TelemetryEvidence.OBSERVED_USAGE,
        cost_source=CostSource.LOCAL_PINNED_PRICE_TABLE,
        timestamp_iso="2026-10-09T00:00:00Z",
    )
    # Check original hash
    raw_orig = f"{cert.certificate_id}|{cert.plan_id}|{cert.task_id}|{cert.selected_target.value}|{cert.policy.value}|{cert.budget_spent_usd}|{cert.budget_remaining_usd}|{cert.evidence_class.value}|{cert.cost_source.value}|{cert.timestamp_iso}"
    assert hashlib.sha256(raw_orig.encode("utf-8")).hexdigest() == cert.integrity_hash

    # Tampered budget value produces different hash
    raw_tampered = f"{cert.certificate_id}|{cert.plan_id}|{cert.task_id}|{cert.selected_target.value}|{cert.policy.value}|999.0|{cert.budget_remaining_usd}|{cert.evidence_class.value}|{cert.cost_source.value}|{cert.timestamp_iso}"
    assert hashlib.sha256(raw_tampered.encode("utf-8")).hexdigest() != cert.integrity_hash


def test_edge_case_provider_case_insensitivity():
    """Provider allowlist check is case-insensitive ('OpenAI' vs 'openai')."""
    gate = CloudGate(policy=HybridPolicy.BOUNDED_HYBRID, max_budget_usd=1.0, allowed_providers=["OpenAI", "Anthropic"])
    task = TaskRequirement(task_id="t-case", prompt="Hello", estimated_tokens=10, complexity_score=0.2)
    eligible, reason = gate.check_eligibility(task, provider="openai", estimated_usd=0.001)
    assert eligible is True
    assert reason is None

