"""Tests for SPE Ω Adoption Gateway & Zero-Friction Runtime Suite:
1. Zero-Friction Wire Proxy (Real local upstream pass-through, honest telemetry, CORS/Auth, CapabilityFirewall).
2. 1-Line Async SDK (Pre-commit invariant ordering, DEV vs PROD authority separation, @spe.step ESSA salvaging).
3. 60-Second Instant Repo Auditor (Potential Optimization Exposure, multi-factor risk model).
"""

from __future__ import annotations

import asyncio
import http.server
import json
import socket
import threading
import urllib.error
import urllib.request
from pathlib import Path
import pytest

import spe
from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.csi.models import LatticeState
from spe_runtime.developer.repo_audit import RepoAuditor
from spe_runtime.runtime_gateway.wire_proxy import (
    CostSource,
    ProxyMetrics,
    TelemetryEvidence,
    WireProxyServer,
)


class MockLocalUpstreamHandler(http.server.BaseHTTPRequestHandler):
    """Local mock HTTP backend simulating Ollama, llama.cpp, or vLLM."""

    def log_message(self, format: str, *args) -> None:
        pass

    def do_POST(self) -> None:
        content_length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(content_length).decode("utf-8")
        req_json = json.loads(raw)
        messages = req_json.get("messages", [])
        last_content = messages[-1].get("content", "") if messages else ""

        resp_data = {
            "id": "chatcmpl-local-ollama-9876",
            "object": "chat.completion",
            "created": 1700000000,
            "model": req_json.get("model", "llama3-local"),
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": f"[Observed Local Engine Output] {last_content}",
                },
                "finish_reason": "stop",
            }],
            "usage": {
                "prompt_tokens": 64,
                "completion_tokens": 16,
                "total_tokens": 80,
                "prompt_tokens_details": {
                    "cached_tokens": 32,
                },
            },
        }
        payload = json.dumps(resp_data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_wire_proxy_real_local_upstream_passthrough():
    """Tests WireProxy forwarding to a real local HTTP upstream backend and honest telemetry."""
    upstream_port = find_free_port()
    proxy_port = find_free_port()

    # 1. Start local mock upstream server (Ollama / vLLM mock on 127.0.0.1)
    mock_server = http.server.HTTPServer(("127.0.0.1", upstream_port), MockLocalUpstreamHandler)
    mock_thread = threading.Thread(target=mock_server.serve_forever, daemon=True)
    mock_thread.start()

    # 2. Configure Wire Proxy with verified local upstream
    proxy_server = WireProxyServer(
        host="127.0.0.1",
        port=proxy_port,
        upstream_url=f"http://127.0.0.1:{upstream_port}",
        api_key="spe-local-test-token",
        require_auth=True,
    )
    proxy_server.start()

    try:
        base_url = proxy_server.base_url

        # A. Missing bearer token returns 401 Unauthorized
        req_unauth = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps({"messages": [{"role": "user", "content": "ping"}]}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with pytest.raises(urllib.error.HTTPError) as exc_auth:
            urllib.request.urlopen(req_unauth)
        assert exc_auth.value.code == 401

        # B. Real forwarding to local upstream with Bearer auth
        forward_payload = {
            "model": "llama3-local",
            "messages": [
                {"role": "user", "content": "What is causal serializability?"}
            ],
        }
        req_auth = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps(forward_payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {proxy_server.api_key}",
                "Origin": "http://127.0.0.1:3000",
            },
        )
        with urllib.request.urlopen(req_auth) as resp:
            assert resp.status == 200
            # CORS restricted (no wildcard *)
            assert resp.headers.get("Access-Control-Allow-Origin") == "http://127.0.0.1:3000"
            assert resp.headers.get("Access-Control-Allow-Origin") != "*"
            # Honest evidence headers
            assert resp.headers.get("x-spe-evidence") == TelemetryEvidence.OBSERVED_USAGE.value
            assert resp.headers.get("x-spe-backend") == f"http://127.0.0.1:{upstream_port}"
            assert resp.headers.get("x-spe-cost-source") in (
                CostSource.BACKEND_REPORTED.value,
                CostSource.LOCAL_PINNED_PRICE_TABLE.value,
            )

            data = json.loads(resp.read().decode())
            content = data["choices"][0]["message"]["content"]
            assert "[Observed Local Engine Output]" in content
            assert "What is causal serializability?" in content
            assert data["spe_metadata"]["upstream_observed"] is True
            assert data["spe_metadata"]["cached_tokens"] == 32

    finally:
        proxy_server.stop()
        mock_server.shutdown()
        mock_server.server_close()


def test_wire_proxy_security_invariants_and_offline_mock():
    """Tests loopback validation, non-local URL rejection, CapabilityFirewall, and LOCAL_OFFLINE_MOCK."""
    # 1. Non-local upstream URL must be rejected immediately (zero cloud egress)
    with pytest.raises(ValueError) as exc_url:
        WireProxyServer(host="127.0.0.1", port=find_free_port(), upstream_url="https://api.openai.com/v1")
    assert "Security Violation" in str(exc_url.value)
    assert "local loopback endpoint" in str(exc_url.value)

    # 2. Non-loopback host bind must be rejected immediately
    with pytest.raises(ValueError) as exc_host:
        WireProxyServer(host="0.0.0.0", port=find_free_port())
    assert "Security Violation" in str(exc_host.value)

    # 3. Test offline mode (upstream_url=None) -> LOCAL_OFFLINE_MOCK with SIMULATED_BACKEND
    proxy_port = find_free_port()
    server = WireProxyServer(host="127.0.0.1", port=proxy_port, upstream_url=None)
    server.start()

    try:
        base_url = server.base_url
        auth_hdr = f"Bearer {server.api_key}"

        # GET /models
        req_models = urllib.request.Request(
            f"{base_url}/models",
            headers={"Authorization": auth_hdr},
        )
        with urllib.request.urlopen(req_models) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode())
            assert any(m["id"] == "spe-omega-supercompiler" for m in data["data"])

        # Offline Mock Chat Completion
        req_chat = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps({
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": "offline agent prompt"}],
            }).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": auth_hdr},
        )
        with urllib.request.urlopen(req_chat) as resp:
            assert resp.status == 200
            assert resp.headers.get("x-spe-backend") == "LOCAL_OFFLINE_MOCK"
            assert resp.headers.get("x-spe-evidence") == "SIMULATED_BACKEND"
            assert resp.headers.get("x-spe-aligned") == "true"
            data = json.loads(resp.read().decode())
            # Real dynamic cache hit rate, NOT hardcoded 0.95
            assert "cache_hit_rate" in data["spe_metadata"]

        # DACO Math Offload ($0 tokens, theoretical bound)
        req_daco = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps({
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": "calculate 250 * 4 + 100"}],
            }).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": auth_hdr},
        )
        with urllib.request.urlopen(req_daco) as resp:
            assert resp.status == 200
            assert resp.headers.get("x-spe-offloaded") == "true"
            assert resp.headers.get("x-spe-evidence") == TelemetryEvidence.THEORETICAL_BOUND.value
            assert resp.headers.get("x-spe-cost-source") == CostSource.LOCAL_PINNED_PRICE_TABLE.value
            data = json.loads(resp.read().decode())
            assert data["choices"][0]["message"]["content"] == "1100.0"

        # CapabilityFirewall Block: DROP TABLE / DELETE_FILE
        req_blocked = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps({
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": "DROP TABLE users;"}],
            }).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": auth_hdr},
        )
        with urllib.request.urlopen(req_blocked) as resp:
            assert resp.status == 200
            assert resp.headers.get("x-spe-blocked") == "true"
            data = json.loads(resp.read().decode())
            assert data["spe_decision"] == "BLOCKED_BY_FIREWALL"
            assert "blocked by CapabilityFirewall" in data["choices"][0]["message"]["content"]

        # Terminal Ticker nomenclature check
        ticker = server.metrics.render_terminal_ticker()
        assert "SPE ADOPTION GATEWAY" in ticker
        assert "LOCAL AIR-GAPPED & SAFE" in ticker

    finally:
        server.stop()


def test_pre_commit_invariant_ordering_law():
    """Verifies the exact ordering law: Execute -> Stage -> Verify Invariants -> Commit -> Effect.
    
    If invariant fails, transaction is aborted BEFORE commit (never committed).
    """
    mvcc = spe._get_or_create_mvcc()
    initial_committed_count = len(mvcc.committed_log)

    # 1. Failing Invariant: transaction must ABORT before commit
    @spe.protect(
        intent="Order payment verification",
        invariant_check=lambda res: res.get("verified") is True,
    )
    def failing_payment_pipeline():
        return {"verified": False, "amount": 500}

    with pytest.raises(ValueError) as exc:
        failing_payment_pipeline()

    assert "Behavioral Invariant Guard Violated" in str(exc.value)
    # The transaction must NEVER have been committed!
    assert len(mvcc.committed_log) == initial_committed_count
    assert hasattr(exc.value, "_spe_salvaged_registers")

    # 2. Passing Invariant: transaction commits only AFTER verification passes
    @spe.protect(
        intent="Order payment verification success",
        invariant_check=lambda res: res.get("verified") is True,
        return_result_wrapper=True,
    )
    def successful_payment_pipeline():
        return {"verified": True, "amount": 500}

    res = successful_payment_pipeline()
    assert res.data["verified"] is True
    assert res.receipt.invariants_satisfied is True
    # Committed count must now have increased by exactly 1
    assert len(mvcc.committed_log) == initial_committed_count + 1


def test_spe_step_dependency_tracking_and_selective_invalidation():
    """Tests @spe.step registering immutable ESSA registers ($v0, $v1, ...),
    dependency graph propagation, and selective invalidation with compute salvaging.
    """
    spe.reset_step_context()

    # Define multi-step agent pipeline
    @spe.step("retrieve_customer")
    async def retrieve_customer(cust_id: str) -> dict:
        return {"cust_id": cust_id, "score": 750, "balance": 1500}

    @spe.step("calculate_risk", depends_on=["retrieve_customer"])
    async def calculate_risk(cust: dict) -> dict:
        return {"tier": "TIER_1", "approved_limit": cust["balance"] * 5}

    @spe.step("prepare_action", depends_on=["calculate_risk"])
    async def prepare_action(risk: dict) -> str:
        return f"GRANT_CREDIT_{risk['approved_limit']}"

    @spe.step("audit_trail", isolated=True)  # independent step with no dependencies
    async def audit_trail() -> str:
        return "AUDIT_RECORD_OK"

    async def run_pipeline():
        c = await retrieve_customer("cust_42")
        r = await calculate_risk(c)
        a = await prepare_action(r)
        aud = await audit_trail()
        return a, aud

    act, audit_rec = asyncio.run(run_pipeline())
    assert act == "GRANT_CREDIT_7500"
    assert audit_rec == "AUDIT_RECORD_OK"

    # Verify initial valid state in EAS
    r_cust = spe.get_step_register("retrieve_customer")
    r_risk = spe.get_step_register("calculate_risk")
    r_act = spe.get_step_register("prepare_action")
    r_aud = spe.get_step_register("audit_trail")

    assert r_cust is not None and r_cust.lattice_state == LatticeState.VALID
    assert r_risk is not None and r_risk.lattice_state == LatticeState.VALID
    assert r_act is not None and r_act.lattice_state == LatticeState.VALID
    assert r_aud is not None and r_aud.lattice_state == LatticeState.VALID

    # Now selectively invalidate retrieve_customer!
    # Expected: calculate_risk and prepare_action transitively invalidated.
    # Expected: audit_trail preserved in LatticeState.VALID!
    invalidated_ids = spe.invalidate_step("retrieve_customer")
    assert r_cust.reg_id in invalidated_ids
    assert r_risk.reg_id in invalidated_ids
    assert r_act.reg_id in invalidated_ids
    assert r_aud.reg_id not in invalidated_ids

    assert r_cust.lattice_state == LatticeState.INVALID
    assert r_risk.lattice_state == LatticeState.INVALID
    assert r_act.lattice_state == LatticeState.INVALID
    assert r_aud.lattice_state == LatticeState.VALID

    # Genuine compute salvage: salvage_valid_registers preserves unrelated registers
    salvaged = spe.salvage_valid_registers()
    assert r_aud.reg_id in salvaged
    assert r_cust.reg_id not in salvaged
    assert r_risk.reg_id not in salvaged

    # Re-executing calculate_risk directly while dependency is invalid fails closed
    with pytest.raises(ValueError) as exc_dep:
        asyncio.run(calculate_risk({"score": 750, "balance": 1500}))
    assert "depends on invalid register" in str(exc_dep.value)


def test_authority_separation_dev_vs_production():
    """Tests DEV_EPHEMERAL vs PRODUCTION_EXTERNAL separation.
    
    In DEV_EPHEMERAL: ephemeral key generated, explicit DEV receipt, never enterprise-qualified.
    In PRODUCTION_EXTERNAL: trust root injected externally, fails closed if missing, no self-grants.
    """
    try:
        # 1. DEV_EPHEMERAL mode
        spe.set_authority_mode(spe.AuthorityMode.DEV_EPHEMERAL)
        assert spe.get_authority_mode() == spe.AuthorityMode.DEV_EPHEMERAL

        @spe.protect(intent="Dev agent test", return_result_wrapper=True)
        def dev_agent():
            return "dev_ok"

        res_dev = dev_agent()
        assert res_dev.receipt.authority_mode == "DEV_EPHEMERAL"
        assert res_dev.receipt.enterprise_qualified is False

        # In dev mode, self-signing grant is permitted for ergonomics
        grant = spe.grant_capability("DATABASE_READ", resource_scope="*")
        assert grant.grant_id.startswith("grant-sdk-")

        # 2. PRODUCTION_EXTERNAL mode without trust root: MUST FAIL CLOSED!
        spe.set_authority_mode(spe.AuthorityMode.PRODUCTION_EXTERNAL)
        spe.clear_production_trust_roots()

        @spe.protect(
            intent="Production agent test",
            capabilities=["DATABASE_READ"],
            return_result_wrapper=True,
        )
        def prod_agent_unconfigured():
            return "prod_should_fail"

        with pytest.raises(PermissionError) as exc_fail_closed:
            prod_agent_unconfigured()
        assert "Production trust root missing: FAIL CLOSED" in str(exc_fail_closed.value)

        # In production mode, self-granting is strictly prohibited
        with pytest.raises(PermissionError) as exc_self_grant:
            spe.grant_capability("DATABASE_READ")
        assert "Self-granting or ephemeral grant signing is strictly prohibited" in str(exc_self_grant.value)

        # 3. PRODUCTION_EXTERNAL mode with external trust root injected
        _, external_pk = generate_keypair()
        spe.set_production_trust_root("corp-external-trust", external_pk.hex())

        @spe.protect(intent="Production enterprise workflow", return_result_wrapper=True)
        def prod_enterprise_agent():
            return "enterprise_ok"

        res_prod = prod_enterprise_agent()
        assert res_prod.receipt.authority_mode == "PRODUCTION_EXTERNAL"
        assert res_prod.receipt.enterprise_qualified is True

    finally:
        # Restore dev mode
        spe.set_authority_mode(spe.AuthorityMode.DEV_EPHEMERAL)


def test_repo_auditor_scan_and_diff(tmp_path: Path):
    """Tests RepoAuditor with Potential Optimization Exposure, multi-factor risk, and clean nomenclature."""
    test_src = tmp_path / "app"
    test_src.mkdir()

    code_file = test_src / "agent.py"
    code_file.write_text(
        "from openai import OpenAI\n\n"
        "client = OpenAI(api_key='sk-123')\n\n"
        "def run_query(q):\n"
        "    return client.chat.completions.create(model='gpt-4o', messages=[{'role': 'user', 'content': q}])\n"
    )

    auditor = RepoAuditor()
    report = auditor.scan_path(tmp_path)

    assert report.files_scanned == 1
    assert report.total_raw_calls == 2
    assert report.total_potential_optimization_exposure_usd > 0
    # Backward compatibility alias
    assert report.total_estimated_monthly_waste_usd == report.total_potential_optimization_exposure_usd
    assert report.governance_score_percent < 100.0

    md = report.to_markdown()
    assert "# SPE Ω — 60-Second AI Instruction & Inference Audit" in md
    assert "Potential Optimization Exposure" in md
    assert "SPE Zero-Friction Runtime" in md
    assert "Trojan Horse" not in md
    assert "Monopoly" not in md
    assert "base_url=\"http://localhost:8080/v1\"" in md


def test_wire_proxy_2pc_nanousd_escrow_and_proof_headers():
    """
    Verifies Gap 2 Drop-in Proxy 2PC Financial Escrow and Cryptographic Proof Headers:
    - 2PC Escrow locks ceiling budget in integer NanoUSD (1 USD = 10^9 Nanos)
    - DACO offload commits 0 nanos and refunds 100% of escrow
    - Exact financial conservation: Ledger.balance + spent == initial_balance
    - Injects x-spe-receipt, x-spe-airgap-status, x-spe-invariants-verified
    """
    proxy_port = find_free_port()
    initial_nanos = 1_000_000_000  # $1.00 USD
    server = WireProxyServer(
        host="127.0.0.1",
        port=proxy_port,
        upstream_url=None,
        initial_ledger_balance_nanos=initial_nanos,
    )
    server.start()

    try:
        base_url = server.base_url
        auth_hdr = f"Bearer {server.api_key}"

        # 1. Test DACO request with 2PC Escrow ceiling
        req_daco = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps({
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": "compute (45 * 20) + 100"}],
            }).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": auth_hdr,
                "x-spe-max-budget-nanos": "25000000",  # 25M nanos ($0.025)
            },
        )
        with urllib.request.urlopen(req_daco) as resp:
            assert resp.status == 200
            assert resp.headers.get("x-spe-offloaded") == "true"
            assert resp.headers.get("x-spe-technique") == "DACO_AST_OFFLOAD"
            assert resp.headers.get("x-spe-airgap-status") == "ENFORCED"
            assert resp.headers.get("x-spe-receipt").startswith("sha256:")
            assert resp.headers.get("x-spe-invariants-verified") is not None
            assert int(resp.headers.get("x-spe-invariants-verified")) >= 3

            # 2PC Escrow Headers
            escrow_id = resp.headers.get("x-spe-escrow-id")
            assert escrow_id is not None
            assert resp.headers.get("x-spe-escrow-consumed-nanos") == "0"
            assert resp.headers.get("x-spe-escrow-refunded-nanos") == "25000000"

            data = json.loads(resp.read().decode())
            assert data["choices"][0]["message"]["content"] == "1000.0"

        # Financial conservation check on ledger
        assert server.escrow.ledger.balance == initial_nanos
        assert server.escrow.total_spent_nanos == 0

        # 2. Test Offline Mock request with 2PC Escrow
        req_mock = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps({
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": "summarize this text safely"}],
            }).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": auth_hdr,
                "x-spe-max-budget-nanos": "15000000",
            },
        )
        with urllib.request.urlopen(req_mock) as resp:
            assert resp.status == 200
            assert resp.headers.get("x-spe-backend") == "LOCAL_OFFLINE_MOCK"
            assert resp.headers.get("x-spe-airgap-status") == "ENFORCED"
            assert resp.headers.get("x-spe-receipt").startswith("sha256:")
            assert resp.headers.get("x-spe-escrow-consumed-nanos") == "0"
            assert resp.headers.get("x-spe-escrow-refunded-nanos") == "15000000"

        # Ledger remains exactly balanced
        assert server.escrow.ledger.balance == initial_nanos

    finally:
        server.stop()


def test_wire_proxy_tool_capability_firewall_out_of_band():
    """
    Verifies that Wire Proxy inspects declared tools and blocks destructive tool calls
    out-of-band when no CapabilityGrant exists, aborting 2PC escrow cleanly.
    """
    proxy_port = find_free_port()
    initial_nanos = 500_000_000
    server = WireProxyServer(
        host="127.0.0.1",
        port=proxy_port,
        upstream_url=None,
        initial_ledger_balance_nanos=initial_nanos,
    )
    server.start()

    try:
        base_url = server.base_url
        auth_hdr = f"Bearer {server.api_key}"

        # Request with ungranted destructive tool definition
        payload = {
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": "clean up old log files"}],
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "delete_file",
                        "description": "Delete a file from disk",
                    },
                }
            ],
        }
        req = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": auth_hdr,
                "x-spe-max-budget-nanos": "30000000",
            },
        )
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200
            assert resp.headers.get("x-spe-blocked") == "true"
            assert resp.headers.get("x-spe-firewall-decision") == "DENY"
            assert resp.headers.get("x-spe-escrow-aborted") == "true"

            data = json.loads(resp.read().decode())
            assert data["spe_decision"] == "BLOCKED_BY_FIREWALL"
            assert "CapabilityFirewall" in data["choices"][0]["message"]["content"]

        # 100% refund confirmed: ledger balance untouched despite abort
        assert server.escrow.ledger.balance == initial_nanos

    finally:
        server.stop()

