"""Comprehensive edge case test battery for Phase 1 repairs on candidate/2026-10-26."""

import asyncio
import http.server
import json
import urllib.error
import urllib.request
import uuid
from pathlib import Path
import pytest

import spe
from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.cost_engine.telemetry import (
    CostSource,
    PINNED_LOCAL_PRICE_TABLE,
    TelemetryEvidence,
    compute_pinned_cost,
)
from spe_runtime.csi.models import LatticeState
from spe_runtime.runtime_gateway.models import CapabilityType
from spe_runtime.runtime_gateway.wire_proxy import WireProxyServer


def find_free_port() -> int:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_edge_case_wire_proxy_error_handling():
    """Tests wire proxy 400 invalid JSON, 404 routes, 502 upstream connection errors, and malformed auth."""
    proxy_port = find_free_port()
    # Point upstream to a non-listening port to trigger 502
    dead_upstream_port = find_free_port()

    server = WireProxyServer(
        host="127.0.0.1",
        port=proxy_port,
        upstream_url=f"http://127.0.0.1:{dead_upstream_port}",
        api_key="edge-secret",
        require_auth=True,
    )
    server.start()

    try:
        base_url = server.base_url
        auth_hdr = f"Bearer {server.api_key}"

        # 1. 404 on unknown route
        req_404 = urllib.request.Request(
            f"{base_url}/unknown/endpoint",
            headers={"Authorization": auth_hdr},
        )
        with pytest.raises(urllib.error.HTTPError) as exc_404:
            urllib.request.urlopen(req_404)
        assert exc_404.value.code == 404

        # 2. 400 on invalid JSON
        req_400 = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=b"this is not json { [",
            headers={"Content-Type": "application/json", "Authorization": auth_hdr},
        )
        with pytest.raises(urllib.error.HTTPError) as exc_400:
            urllib.request.urlopen(req_400)
        assert exc_400.value.code == 400

        # 3. 401 on malformed Authorization header (e.g. Basic instead of Bearer)
        req_malformed_auth = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps({"messages": [{"role": "user", "content": "hi"}]}).encode(),
            headers={"Content-Type": "application/json", "Authorization": "Basic dXNlcjpwYXNz"},
        )
        with pytest.raises(urllib.error.HTTPError) as exc_basic:
            urllib.request.urlopen(req_malformed_auth)
        assert exc_basic.value.code == 401

        # 4. 502 when local upstream is down
        req_502 = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=json.dumps({"messages": [{"role": "user", "content": "forward me"}]}).encode(),
            headers={"Content-Type": "application/json", "Authorization": auth_hdr},
        )
        with pytest.raises(urllib.error.HTTPError) as exc_502:
            urllib.request.urlopen(req_502)
        assert exc_502.value.code == 502

    finally:
        server.stop()


def test_edge_case_wire_proxy_host_loopback_variants():
    """Tests loopback IP validation across localhost, 127.0.0.1, and rejection of remote hosts."""
    # Loopback variations must succeed
    s1 = WireProxyServer(host="localhost", port=find_free_port(), require_auth=False)
    assert s1.host == "localhost"

    s2 = WireProxyServer(host="127.0.0.1", port=find_free_port(), require_auth=False)
    assert s2.host == "127.0.0.1"

    # Remote hosts must be strictly rejected
    for bad_host in ["192.168.1.1", "10.0.0.1", "api.openai.com", "example.com", "8.8.8.8"]:
        with pytest.raises(ValueError):
            WireProxyServer(host=bad_host, port=find_free_port())


def test_edge_case_step_sync_and_caching():
    """Tests @spe.step on synchronous functions, compute salvaging via cache hit, and multi-dependency tracking."""
    spe.reset_step_context()

    execution_counts = {"fetch": 0, "hash": 0, "combine": 0}

    @spe.step("fetch_data", isolated=True)
    def fetch_data(key: str) -> str:
        execution_counts["fetch"] += 1
        return f"DATA_FOR_{key}"

    @spe.step("hash_data", depends_on=["fetch_data"])
    def hash_data(raw: str) -> str:
        execution_counts["hash"] += 1
        return f"HASH_{len(raw)}"

    @spe.step("combine_data", depends_on=["fetch_data", "hash_data"])
    def combine_data(raw: str, h: str) -> str:
        execution_counts["combine"] += 1
        return f"{raw}::{h}"

    # First run: all steps execute
    d1 = fetch_data("alpha")
    h1 = hash_data(d1)
    c1 = combine_data(d1, h1)

    assert d1 == "DATA_FOR_alpha"
    assert h1 == "HASH_14"
    assert c1 == "DATA_FOR_alpha::HASH_14"
    assert execution_counts == {"fetch": 1, "hash": 1, "combine": 1}

    # Second run with same inputs: compute salvage reuses valid registers without re-executing!
    d2 = fetch_data("alpha")
    h2 = hash_data(d2)
    c2 = combine_data(d2, h2)

    assert d2 == d1
    assert h2 == h1
    assert c2 == c1
    # Execution counts did not increase because compute was salvaged!
    assert execution_counts == {"fetch": 1, "hash": 1, "combine": 1}

    # Invalidate root step: fetch_data
    # Downstream steps hash_data and combine_data must be invalidated
    invalidated = spe.invalidate_step("fetch_data")
    assert spe.get_step_register("fetch_data").lattice_state == LatticeState.INVALID
    assert spe.get_step_register("hash_data").lattice_state == LatticeState.INVALID
    assert spe.get_step_register("combine_data").lattice_state == LatticeState.INVALID

    # After invalidation, calling hash_data fails closed because its dependency is invalid
    with pytest.raises(ValueError) as exc_dep:
        hash_data("DATA_FOR_alpha")
    assert "depends on invalid register" in str(exc_dep.value)


def test_edge_case_authority_separation_strict_no_fallback():
    """Verifies that in PRODUCTION_EXTERNAL mode there is NO silent fallback to DEV_EPHEMERAL."""
    spe.set_authority_mode(spe.AuthorityMode.PRODUCTION_EXTERNAL)
    spe.clear_production_trust_roots()

    try:
        # Calling protect without trust root must FAIL CLOSED
        @spe.protect(intent="Unconfigured production task")
        def unconfigured_task():
            return "should_not_run"

        with pytest.raises(PermissionError) as exc_missing:
            unconfigured_task()
        assert "FAIL CLOSED" in str(exc_missing.value)

        # Calling grant_capability must never create an ephemeral key in PROD
        with pytest.raises(PermissionError) as exc_grant:
            spe.grant_capability("NETWORK")
        assert "Self-granting or ephemeral grant signing is strictly prohibited" in str(exc_grant.value)

    finally:
        spe.set_authority_mode(spe.AuthorityMode.DEV_EPHEMERAL)


def test_edge_case_honest_pinned_cost_engine():
    """Verifies honest pinned price calculation across unknown and standard models."""
    # Known model gpt-4o: prompt=$2.50/M, completion=$10.00/M
    cost, src, ev = compute_pinned_cost(prompt_tokens=1000, completion_tokens=500, model="gpt-4o")
    expected_cost = round((1000 * 2.50 / 1e6) + (500 * 10.00 / 1e6), 6)
    assert cost == expected_cost
    assert src == CostSource.LOCAL_PINNED_PRICE_TABLE
    assert ev == TelemetryEvidence.THEORETICAL_BOUND

    # Unknown model: falls back safely to pinned default table without crashing or inventing arbitrary numbers
    cost_unk, src_unk, ev_unk = compute_pinned_cost(prompt_tokens=1000, completion_tokens=500, model="some-unknown-model-xyz")
    assert cost_unk == expected_cost
    assert src_unk == CostSource.LOCAL_PINNED_PRICE_TABLE
    assert ev_unk == TelemetryEvidence.THEORETICAL_BOUND


def test_edge_case_loopback_domain_bypass_rejection():
    """Verifies that malicious domains masquerading as loopback IPs are strictly rejected."""
    malicious_endpoints = [
        "http://127.attacker.com:8000",
        "http://127.0.0.1.nip.io:8000",
        "http://localhost.attacker.com:8000",
        "http://127.1.1.1.evil.org",
    ]
    for url in malicious_endpoints:
        with pytest.raises(ValueError) as exc:
            WireProxyServer(host="127.0.0.1", port=find_free_port(), upstream_url=url)
        assert "Security Violation" in str(exc.value)


def test_edge_case_step_reexecution_invalidates_downstream_consumers():
    """Verifies that when an upstream step re-executes with new data, downstream consumers are invalidated."""
    spe.reset_step_context()

    @spe.step("customer_step")
    def customer_step(user_id: str) -> dict:
        return {"user_id": user_id, "score": 100 if user_id == "alice" else 500}

    @spe.step("risk_step", depends_on=["customer_step"])
    def risk_step(cust: dict) -> str:
        return f"RISK_{cust['user_id']}_{cust['score']}"

    # 1. Alice run
    c1 = customer_step("alice")
    r1 = risk_step(c1)
    assert r1 == "RISK_alice_100"

    reg_risk = spe.get_step_register("risk_step")
    assert reg_risk is not None and reg_risk.lattice_state == LatticeState.VALID

    # 2. Bob run: customer_step re-executes with new input
    c2 = customer_step("bob")
    assert c2["user_id"] == "bob"

    # Crucial assertion: the old risk_step register MUST have been invalidated in EAS!
    assert reg_risk.lattice_state == LatticeState.INVALID

    # 3. Running risk_step for Bob produces new result and registers new valid register
    r2 = risk_step(c2)
    assert r2 == "RISK_bob_500"
    reg_risk_new = spe.get_step_register("risk_step")
    assert reg_risk_new.lattice_state == LatticeState.VALID
    assert reg_risk_new.term == "RISK_bob_500"


def test_edge_case_step_unexecuted_dependency_fails():
    """Verifies that declaring a dependency on an unexecuted step raises ValueError."""
    spe.reset_step_context()

    @spe.step("consumer", depends_on=["unexecuted_prerequisite"])
    def consumer() -> str:
        return "should_not_run"

    with pytest.raises(ValueError) as exc:
        consumer()
    assert "depends on step 'unexecuted_prerequisite', which has not been executed or registered" in str(exc.value)


def test_edge_case_step_failure_invalidates_register():
    """Verifies that if a step fails execution or invariant check, its register is marked INVALID."""
    spe.reset_step_context()

    @spe.step("guarded_step", invariant_check=lambda x: x > 0)
    def guarded_step(val: int) -> int:
        if val == -999:
            raise RuntimeError("Fatal hardware interrupt")
        return val

    # Succeeded once
    assert guarded_step(10) == 10
    reg = spe.get_step_register("guarded_step")
    assert reg.lattice_state == LatticeState.VALID

    # Fails invariant check
    with pytest.raises(ValueError) as exc_inv:
        guarded_step(-5)
    assert "violated step invariant check" in str(exc_inv.value)
    assert reg.lattice_state == LatticeState.INVALID

    # Re-executes and raises exception
    with pytest.raises(RuntimeError):
        guarded_step(-999)
    assert reg.lattice_state == LatticeState.INVALID


def test_edge_case_step_decorator_without_arguments():
    """Verifies that @spe.step works seamlessly without parentheses."""
    spe.reset_step_context()

    @spe.step
    def simple_add(x: int, y: int) -> int:
        return x + y

    res = simple_add(3, 4)
    assert res == 7
    reg = spe.get_step_register("simple_add")
    assert reg is not None
    assert reg.term == 7
    assert reg.lattice_state == LatticeState.VALID


def test_edge_case_upstream_http_error_relayed():
    """Verifies that upstream HTTP errors (e.g. 400 Bad Request) are relayed faithfully, not masked as 502."""
    upstream_port = find_free_port()
    proxy_port = find_free_port()

    class UpstreamErrorMock(http.server.BaseHTTPRequestHandler):
        def log_message(self, format: str, *args):
            pass
        def do_POST(self):
            err_body = json.dumps({
                "error": {
                    "message": "Invalid temperature parameter",
                    "type": "invalid_request_error",
                    "code": 400,
                }
            }).encode()
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err_body)))
            self.end_headers()
            self.wfile.write(err_body)

    mock_s = http.server.HTTPServer(("127.0.0.1", upstream_port), UpstreamErrorMock)
    import threading
    t = threading.Thread(target=mock_s.serve_forever, daemon=True)
    t.start()

    proxy = WireProxyServer(
        host="127.0.0.1",
        port=proxy_port,
        upstream_url=f"http://127.0.0.1:{upstream_port}",
        require_auth=False,
    )
    proxy.start()

    try:
        req = urllib.request.Request(
            f"{proxy.base_url}/chat/completions",
            data=json.dumps({"messages": [{"role": "user", "content": "hi"}]}).encode(),
            headers={"Content-Type": "application/json"},
        )
        with pytest.raises(urllib.error.HTTPError) as exc_http:
            urllib.request.urlopen(req)
        # Upstream status code 400 must be preserved!
        assert exc_http.value.code == 400
        data = json.loads(exc_http.value.read().decode())
        assert data["error"]["message"] == "Invalid temperature parameter"
    finally:
        proxy.stop()
        mock_s.shutdown()
        mock_s.server_close()


def test_edge_case_install_production_grant():
    """Verifies that an externally signed grant can be installed in PRODUCTION_EXTERNAL mode."""
    spe.set_authority_mode(spe.AuthorityMode.PRODUCTION_EXTERNAL)
    spe.clear_production_trust_roots()

    try:
        from spe_runtime.runtime_gateway.firewall import sign_grant
        from spe_runtime.runtime_gateway.models import CapabilityGrant, CapabilityType

        sk, pk = generate_keypair()
        issuer = "enterprise-external-ca"
        spe.set_production_trust_root(issuer, pk.hex())

        grant = CapabilityGrant(
            grant_id=f"grant-corp-{uuid.uuid4().hex[:8]}",
            capability=CapabilityType.DATABASE_READ,
            resource_scope="users_*",
            action_scope="read",
            issuer=issuer,
            approval_identity="sec-admin@corp.internal",
            expiration_iso="2035-01-01T00:00:00Z",
            nonce=f"nonce-corp-{uuid.uuid4().hex[:8]}",
            signature="",
            amount_budget=10.0,
            remaining_budget=10.0,
        )
        signed = sign_grant(grant, sk, pk)

        # Installing externally signed grant into production firewall
        spe.install_production_grant(signed)

        @spe.protect(
            intent="Read user profile",
            capabilities=["DATABASE_READ"],
            resource="users_table",
            action="read",
            return_result_wrapper=True,
        )
        def read_user():
            return {"name": "Alice"}

        res = read_user()
        assert res.data["name"] == "Alice"
        assert res.receipt.authority_mode == "PRODUCTION_EXTERNAL"
        assert res.receipt.enterprise_qualified is True

    finally:
        spe.set_authority_mode(spe.AuthorityMode.DEV_EPHEMERAL)

