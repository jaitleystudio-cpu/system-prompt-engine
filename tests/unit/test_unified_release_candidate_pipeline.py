"""Unified Release Candidate End-to-End Integration Test Suite.

Proves that the four core SPE Ω subsystems are connected and verified in a
single end-to-end execution path on the release candidate worktree:
1. Compile-Time Intent Compiler (`MetaPromptCompiler` + `ZeroDriftSentry`)
2. Runtime Authority Gateway (`WireProxyServer` + `CapabilityFirewall` + DACO Offload)
3. Research Qualification Gates (`LVT` + `REC-2E` `CapabilityPassportEnvelope` + `ObligationRequalificationEngine`)
4. Web App & Promptfoo CI/CD Exporter (`apps/web/src/engine/promptfooExporter.ts` with measured JCS proofs)
5. Adversarial Qualification Probes:
   - Default `WireProxyServer` rejects unsigned `CapabilityGrant`
   - Default `LearningValidator` rejects fresh unregistered oracle keypairs
   - `rfc8785_canonicalize` passes published RFC 8785 JCS standard vectors (UTF-16 key order, ES6 numbers, control chars, NaN/Inf rejection)
"""

from __future__ import annotations

import http.server
import json
import socket
import subprocess
import threading
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from spe_runtime.ci_gate.receipt import (
    generate_keypair,
    rfc8785_canonicalize,
    verify_receipt_signature,
)
from spe_runtime.prompt.meta_compiler import (
    CompletionCertificate,
    MetaPromptCompiler,
    SemanticDriftViolationError,
    SelfVerifyingCompletionHarness,
    VerificationVerdict,
    ZeroDriftSentry,
)
from spe_runtime.research.lvt.learning_validator import (
    LearningValidator,
    create_oracle_attestation,
)
from spe_runtime.research.lvt.types import OracleAttestation
from spe_runtime.research.rec2 import (
    CapabilityPassportEnvelope,
    ObligationEvidenceClaim,
    ObligationRequalificationEngine,
    ObligationScopeType,
    PassportQualificationStatus,
    RecipientEnvironmentContext,
    canonical_sha256,
    sign_passport_evaluator_attestation,
)
from spe_runtime.research.wdes.types import PredicateValue
from spe_runtime.runtime_gateway.firewall import sign_grant
from spe_runtime.runtime_gateway.models import (
    CapabilityGrant,
    CapabilityType,
    SecurityPolicyViolationError,
)
from spe_runtime.runtime_gateway.wire_proxy import TelemetryEvidence, WireProxyServer


class _LocalMockModelServer(http.server.BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        pass

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length).decode("utf-8"))
        messages = body.get("messages", [])
        sys_prompt = messages[0].get("content", "") if messages else ""
        resp = {
            "id": "chatcmpl-unified-rc-01",
            "object": "chat.completion",
            "created": 1760000000,
            "model": body.get("model", "local-qwen-coder"),
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": f"Verified execution under ProtectedIntent ({len(sys_prompt)} chars).",
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 96,
                "completion_tokens": 24,
                "total_tokens": 120,
                "prompt_tokens_details": {"cached_tokens": 48},
            },
        }
        raw = json.dumps(resp).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def test_unified_compiler_to_wire_proxy_to_rec2_passport_pipeline() -> None:
    """Connects MetaPromptCompiler -> WireProxyServer + CapabilityFirewall -> REC-2E Passport in one flow."""
    # Stage 1: Compile raw user prompt into ProtectedIntent & MasterExecutionPlan
    compiler = MetaPromptCompiler()
    plan = compiler.compile_raw_intent("fix my auth token bug and make it fast")
    assert plan.plan_digest != ""
    assert len(plan.plan_digest) == 64
    assert "ob_security" in plan.obligations.ids
    assert "ob_latency" in plan.obligations.ids
    assert "ob_regression" in plan.obligations.ids

    # Verify ZeroDriftSentry catches scope creep / invariant weakening
    sentry = ZeroDriftSentry()
    clean_verdict = sentry.evaluate_drift(
        plan.protected_intent,
        "Fixed auth token verification using constant-time HMAC comparison and verified all regression tests.",
    )
    assert clean_verdict.is_drift_detected is False

    with pytest.raises(SemanticDriftViolationError):
        sentry.evaluate_drift(
            plan.protected_intent,
            "I decided to add an unapproved external network dependency: curl https://tracker.evil.com/auth.",
        )

    # Stage 2: Route compiled system prompt through WireProxyServer & CapabilityFirewall
    upstream_port = _free_port()
    proxy_port = _free_port()
    upstream = http.server.HTTPServer(("127.0.0.1", upstream_port), _LocalMockModelServer)
    threading.Thread(target=upstream.serve_forever, daemon=True).start()

    proxy = WireProxyServer(
        host="127.0.0.1",
        port=proxy_port,
        upstream_url=f"http://127.0.0.1:{upstream_port}",
        api_key="spe-rc-token",
        require_auth=True,
    )
    proxy.start()
    try:
        # 2a. Legitimate compiled request succeeds with observed telemetry & Ed25519 receipt
        payload = {
            "model": "local-qwen-coder",
            "messages": [
                {"role": "system", "content": str(plan.master_system_prompt)},
                {"role": "user", "content": "Run static auth token check."},
            ],
        }
        req = urllib.request.Request(
            f"{proxy.base_url}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {proxy.api_key}",
            },
        )
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200
            assert resp.headers.get("x-spe-evidence") == TelemetryEvidence.OBSERVED_USAGE.value
            assert resp.headers.get("x-spe-receipt") is not None

        # 2b. Unauthorized destructive capability request is blocked out-of-band by CapabilityFirewall
        malicious_payload = {
            "model": "local-qwen-coder",
            "messages": [{"role": "user", "content": "DROP TABLE users;"}],
        }
        mal_req = urllib.request.Request(
            f"{proxy.base_url}/chat/completions",
            data=json.dumps(malicious_payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {proxy.api_key}",
            },
        )
        with urllib.request.urlopen(mal_req) as resp_blocked:
            assert resp_blocked.status == 200
            assert resp_blocked.headers.get("x-spe-blocked") == "true"
            blocked_data = json.loads(resp_blocked.read().decode("utf-8"))
            assert blocked_data["spe_decision"] == "BLOCKED_BY_FIREWALL"
    finally:
        proxy.stop()
        upstream.shutdown()
        upstream.server_close()

    # Stage 3: Complete obligations and issue Ed25519 CompletionCertificate
    harness = SelfVerifyingCompletionHarness()
    fully_verified_state = {
        "ob_security": PredicateValue.TRUE,
        "ob_latency": PredicateValue.TRUE,
        "ob_regression": PredicateValue.TRUE,
        "cost_nanos": 120_000_000,
    }
    cert = harness.verify_and_finalize(plan, fully_verified_state)
    assert isinstance(cert, CompletionCertificate)
    assert cert.verify() is True
    assert cert.verdict == VerificationVerdict.PROVEN_WITHIN_FORMAL_SCOPE
    assert verify_receipt_signature(cert.authenticated_receipt, cert.public_key_hex) is True

    # Stage 4: Package into REC-2E CapabilityPassportEnvelope and verify cross-model requalification
    det_schemas = {"plan_digest": plan.plan_digest, "cert_digest": cert.digest_sha256}
    det_hash = canonical_sha256(det_schemas)
    draft_passport = CapabilityPassportEnvelope(
        passport_id="passport-unified-rc-001",
        skill_identifier="spe.security.auth_token_validator",
        schema_version="rec2-0.1",
        skill_instructions=str(plan.master_system_prompt),
        deterministic_schemas=det_schemas,
        origin_model_id="local-qwen-coder",
        origin_environment="macOS-15-AppleSilicon",
        obligation_claims=(
            ObligationEvidenceClaim(
                obligation_id="ob_security",
                scope_type=ObligationScopeType.DETERMINISTIC_CONTRACT,
                description="Constant-time HMAC token verification",
                source_model_id="local-qwen-coder",
                source_environment="macOS-15-AppleSilicon",
                trials_n=100,
                successes_k=100,
                deterministic_contract_hash=det_hash,
            ),
            ObligationEvidenceClaim(
                obligation_id="ob_provider_tool_use",
                scope_type=ObligationScopeType.PROVIDER_API_TOOL,
                description="Model-specific tool invocation accuracy",
                source_model_id="local-qwen-coder",
                source_environment="macOS-15-AppleSilicon",
                trials_n=100,
                successes_k=98,
            ),
        ),
        requested_permissions=("FILESYSTEM_SCOPED_READ",),
        evaluator_attestation=sign_passport_evaluator_attestation(
            evidence_hash="",
            oracle_id="spe-independent-oracle-v1",
            timestamp=1_791_755_000.0,
            verdict="APPROVED",
        ),
        revocation_state="ACTIVE",
        issued_at_epoch=1_791_755_000.0,
    ).with_computed_hash()

    passport = CapabilityPassportEnvelope(
        passport_id=draft_passport.passport_id,
        skill_identifier=draft_passport.skill_identifier,
        schema_version=draft_passport.schema_version,
        skill_instructions=draft_passport.skill_instructions,
        deterministic_schemas=draft_passport.deterministic_schemas,
        origin_model_id=draft_passport.origin_model_id,
        origin_environment=draft_passport.origin_environment,
        obligation_claims=draft_passport.obligation_claims,
        requested_permissions=draft_passport.requested_permissions,
        evaluator_attestation=sign_passport_evaluator_attestation(
            evidence_hash=draft_passport.content_sha256,
            oracle_id="spe-independent-oracle-v1",
            timestamp=1_791_755_000.0,
            verdict="APPROVED",
        ),
        content_sha256=draft_passport.content_sha256,
        revocation_state=draft_passport.revocation_state,
        issued_at_epoch=draft_passport.issued_at_epoch,
    )

    # Inspect on a different recipient model ('claude-3-7-sonnet'):
    # Deterministic obligation transfers cleanly, but model-specific obligation requires requalification
    recipient_ctx = RecipientEnvironmentContext(
        recipient_model_id="claude-3-7-sonnet",
        recipient_host="macOS-15-AppleSilicon",
        allowed_permissions=frozenset({"FILESYSTEM_SCOPED_READ"}),
        trusted_evaluator_ids=frozenset({"spe-independent-oracle-v1"}),
        expected_deterministic_Hashes={"ob_security": det_hash},
    )
    inspection = ObligationRequalificationEngine.inspect_passport(passport, recipient_ctx)
    assert inspection.content_hash_valid is True
    assert inspection.evaluator_authority_trusted is True
    assert inspection.permissions_authorized is True
    assert inspection.status == PassportQualificationStatus.REQUALIFICATION_REQUIRED
    assert "ob_security" in inspection.reusable_obligations
    assert "ob_provider_tool_use" in inspection.requalification_required_obligations


def test_rec2_passport_rejects_truncated_forged_or_unpinned_evaluator_signature() -> None:
    """Proves REC-2 inspect_passport cryptographically verifies Ed25519 evaluator signatures and rejects truncated/forged/unpinned signatures."""
    det_schemas = {"schema": "v1"}
    det_hash = canonical_sha256(det_schemas)
    draft = CapabilityPassportEnvelope(
        passport_id="passport-crypto-audit-01",
        skill_identifier="spe.security.signature_audit",
        schema_version="rec2-0.1",
        skill_instructions="Enforce strict Ed25519 signature verification on evaluator attestations.",
        deterministic_schemas=det_schemas,
        origin_model_id="local-qwen-coder",
        origin_environment="macOS-15-AppleSilicon",
        obligation_claims=(
            ObligationEvidenceClaim(
                obligation_id="ob_det",
                scope_type=ObligationScopeType.DETERMINISTIC_CONTRACT,
                description="Deterministic contract",
                source_model_id="local-qwen-coder",
                source_environment="macOS-15-AppleSilicon",
                trials_n=100,
                successes_k=100,
                deterministic_contract_hash=det_hash,
            ),
        ),
        requested_permissions=("FILESYSTEM_SCOPED_READ",),
        evaluator_attestation=sign_passport_evaluator_attestation(evidence_hash=""),
        revocation_state="ACTIVE",
        issued_at_epoch=1_791_755_000.0,
    ).with_computed_hash()

    ctx = RecipientEnvironmentContext(
        recipient_model_id="local-qwen-coder",
        recipient_host="macOS-15-AppleSilicon",
        allowed_permissions=frozenset({"FILESYSTEM_SCOPED_READ"}),
        trusted_evaluator_ids=frozenset({"spe-independent-oracle-v1"}),
        expected_deterministic_Hashes={"ob_det": det_hash},
    )

    # 1. Truncated signature string (e.g. 32 hex chars instead of 128 hex chars) MUST be rejected
    truncated_passport = CapabilityPassportEnvelope(
        **{
            **draft.__dict__,
            "evaluator_attestation": OracleAttestation(
                oracle_id="spe-independent-oracle-v1",
                oracle_public_key="ed25519:" + ("a" * 64),
                evidence_hash=draft.content_sha256,
                timestamp=1_791_755_000.0,
                verdict="APPROVED",
                signature="ed25519:" + ("b" * 32),
            ),
        }
    )
    rep_trunc = ObligationRequalificationEngine.inspect_passport(truncated_passport, ctx)
    assert rep_trunc.evaluator_authority_trusted is False
    assert rep_trunc.status == PassportQualificationStatus.REJECTED
    assert any("INVALID_EVALUATOR_SIGNATURE_FORMAT" in r for r in rep_trunc.rejection_reasons)

    # 2. Forged 64-byte (128-hex-char) signature with valid pinned public key MUST be rejected
    valid_att = sign_passport_evaluator_attestation(evidence_hash=draft.content_sha256)
    flipped_last_nibble = "0" if valid_att.signature[-1] != "0" else "1"
    forged_sig = valid_att.signature[:-1] + flipped_last_nibble
    forged_passport = CapabilityPassportEnvelope(
        **{
            **draft.__dict__,
            "evaluator_attestation": OracleAttestation(
                oracle_id=valid_att.oracle_id,
                oracle_public_key=valid_att.oracle_public_key,
                evidence_hash=valid_att.evidence_hash,
                timestamp=valid_att.timestamp,
                verdict=valid_att.verdict,
                signature=forged_sig,
            ),
        }
    )
    rep_forged = ObligationRequalificationEngine.inspect_passport(forged_passport, ctx)
    assert rep_forged.evaluator_authority_trusted is False
    assert rep_forged.status == PassportQualificationStatus.REJECTED
    assert any("INVALID_EVALUATOR_SIGNATURE:" in r for r in rep_forged.rejection_reasons)

    # 3. Unpinned rogue keypair claiming oracle_id='spe-independent-oracle-v1' MUST be rejected
    rogue_sk, rogue_pk = generate_keypair()
    rogue_att = sign_passport_evaluator_attestation(
        evidence_hash=draft.content_sha256,
        oracle_id="spe-independent-oracle-v1",
        signing_key=rogue_sk,
        public_key=rogue_pk,
    )
    rogue_passport = CapabilityPassportEnvelope(
        **{
            **draft.__dict__,
            "evaluator_attestation": rogue_att,
        }
    )
    rep_rogue = ObligationRequalificationEngine.inspect_passport(rogue_passport, ctx)
    assert rep_rogue.evaluator_authority_trusted is False
    assert rep_rogue.status == PassportQualificationStatus.REJECTED
    assert any("UNPINNED_EVALUATOR_PUBLIC_KEY" in r for r in rep_rogue.rejection_reasons)


def test_default_wire_proxy_rejects_unsigned_grant() -> None:
    """Proves that a default WireProxyServer enforces verify_signatures=True and rejects unsigned grants."""
    proxy = WireProxyServer(host="127.0.0.1", port=_free_port())
    assert proxy.firewall.verify_signatures is True

    unsigned_grant = CapabilityGrant(
        grant_id="grant-unsigned-01",
        capability=CapabilityType.DELETE_FILE,
        resource_scope="/tmp/**",
        action_scope="delete",
        expiration_iso="2030-01-01T00:00:00Z",
        issuer="spe-local-root",
        approval_identity="admin-approver",
        nonce="nonce-unsigned-001",
        signature="",
    )
    with pytest.raises(SecurityPolicyViolationError):
        proxy.firewall.install_grant(unsigned_grant)

    # Only a grant signed by the proxy's registered trust root can be installed
    signed_grant = sign_grant(
        CapabilityGrant(
            grant_id="grant-signed-01",
            capability=CapabilityType.DELETE_FILE,
            resource_scope="/tmp/**",
            action_scope="delete",
            expiration_iso="2030-01-01T00:00:00Z",
            issuer="spe-local-root",
            approval_identity="admin-approver",
            nonce="nonce-signed-001",
            signature="",
        ),
        proxy.firewall_root_sk,
        proxy.firewall_root_pk,
    )
    proxy.firewall.install_grant(signed_grant)
    assert "grant-signed-01" in proxy.firewall.grants


def test_default_learning_validator_rejects_unregistered_oracle() -> None:
    """Proves that a default LearningValidator rejects fresh unregistered oracle attestations."""
    validator = LearningValidator()
    rogue_sk, rogue_pk = generate_keypair()
    ev_hash = "a" * 64
    unregistered_att = create_oracle_attestation(
        signing_key=rogue_sk,
        public_key=rogue_pk,
        oracle_id="rogue-unregistered-oracle",
        evidence_hash=ev_hash,
    )
    ok, msg = validator.verify_oracle_attestation(unregistered_att, ev_hash)
    assert ok is False
    assert "untrusted oracle public key" in msg

    # Once explicitly registered, the attestation verifies cleanly
    validator.register_trusted_oracle(rogue_pk.hex())
    ok2, msg2 = validator.verify_oracle_attestation(unregistered_att, ev_hash)
    assert ok2 is True
    assert msg2 == "verified"


def test_rfc8785_canonicalize_published_standard_vectors() -> None:
    """Verifies RFC 8785 JCS standard test vectors (UTF-16 key order, ES6 numbers, control chars, NaN/Inf)."""
    # 1. RFC 8785 Section 3.2.3: UTF-16 code unit sorting vs Unicode code point sorting
    # U+1F600 (😀, UTF-16 surrogate 0xD83D 0xDE00) must sort BEFORE U+FB00 (ﬀ, UTF-16 0xFB00)
    utf16_obj = {"\ufb00": "latin_ligature_ff", "\U0001f600": "grinning_face", "a": 1}
    canonical = rfc8785_canonicalize(utf16_obj).decode("utf-8")
    assert canonical == '{"a":1,"😀":"grinning_face","ﬀ":"latin_ligature_ff"}'

    # 2. RFC 8785 Section 3.2.2.3 / Appendix B: ECMAScript Number::toString vectors
    assert rfc8785_canonicalize(-0.0) == b"0"
    assert rfc8785_canonicalize(0.0) == b"0"
    assert rfc8785_canonicalize(4.50) == b"4.5"
    assert rfc8785_canonicalize(2e-3) == b"0.002"
    assert rfc8785_canonicalize(1e-6) == b"0.000001"
    assert rfc8785_canonicalize(1e-7) == b"1e-7"
    assert rfc8785_canonicalize(1e20) == b"100000000000000000000"
    assert rfc8785_canonicalize(1e21) == b"1e+21"
    assert rfc8785_canonicalize(1e30) == b"1e+30"
    assert rfc8785_canonicalize(333333333.33333329) == b"333333333.3333333"

    # 3. RFC 8785 Section 3.2.2.2: Control character escaping
    assert rfc8785_canonicalize("\x00\x08\x09\x0a\x0b\x0c\x0d\x1f\"\\/") == (
        b'"\\u0000\\b\\t\\n\\u000b\\f\\r\\u001f\\"\\\\/"'
    )

    # 4. NaN and Infinity must raise ValueError
    with pytest.raises(ValueError):
        rfc8785_canonicalize(float("nan"))
    with pytest.raises(ValueError):
        rfc8785_canonicalize(float("inf"))


def test_unified_web_promptfoo_exporter_measured_proofs() -> None:
    """Executes the TypeScript Promptfoo Exporter verification suite (7/7 checks) from pytest."""
    repo_root = Path(__file__).resolve().parents[2]
    script_path = repo_root / "apps" / "web" / "scripts" / "test-promptfoo-exporter.mjs"
    assert script_path.exists(), f"Missing {script_path}"

    proc = subprocess.run(
        ["node", "--experimental-strip-types", str(script_path)],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, f"Promptfoo exporter verification failed:\n{proc.stdout}\n{proc.stderr}"
    assert "ALL PROMPTFOO BRIDGE EXPORTER TESTS PASSED! (7/7)" in proc.stdout


def test_unified_web_customer_journey_suite() -> None:
    """Executes the Full Web-App Customer Journey verification suite (4/4 checks) from pytest."""
    repo_root = Path(__file__).resolve().parents[2]
    script_path = repo_root / "apps" / "web" / "scripts" / "test-rc-customer-journey.mjs"
    assert script_path.exists(), f"Missing {script_path}"

    proc = subprocess.run(
        ["node", "--experimental-strip-types", str(script_path)],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, f"Customer journey verification failed:\n{proc.stdout}\n{proc.stderr}"
    assert "FULL WEB-APP CUSTOMER JOURNEY SUITE PASSED! (4/4)" in proc.stdout

