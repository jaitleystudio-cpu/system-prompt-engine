"""
Comprehensive Test Battery for the SPE Ω Gap-Fix Production System Prompt Triad:
- Kernel 1: Research-Production Bridge Kernel (Trap 1 Fix)
- Kernel 2: Real Local Silicon & Inference Resilience Kernel (Trap 2 Fix)
- Kernel 3: First 60 Seconds Progressive Disclosure Kernel (Trap 3 Fix)
"""

from __future__ import annotations

import json
import socket
import time
import urllib.error
import urllib.request
import pytest

from spe_runtime.production_bridge import (
    AntiSelfCertificationError,
    ConservationBus,
    EvidenceClosureAdapter,
    HonestTaskProjection,
    MorphingEngine,
    ObligationDroppedError,
    PermissionEscalationError,
    ReleaseAuditorAdapter,
)
from spe_runtime.runtime_gateway.wire_proxy import (
    PagedAttentionKVAligner,
    WireProxyServer,
    align_context_with_truncation_guard,
    probe_local_daemons,
)
from spe_runtime.prompt.meta_compiler import (
    MetaPromptCompiler,
    SynthesisMode,
    TwoSpeedSynthesisResult,
)


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# ==============================================================================
# KERNEL 1: RESEARCH-PRODUCTION BRIDGE TESTS (TRAP 1 FIX)
# ==============================================================================

def test_kernel1_evidence_closure_adapter_honest_projection():
    """Verifies that unexecuted tasks are honestly projected as UNRESOLVED without self-certification."""
    projection = EvidenceClosureAdapter.project_honest_status(
        task_id="task-auth-001",
        syntax_valid=True,
        runtime_tested=False,
        env_tested=False,
        contract_id="contract-rgic-1234",
    )
    assert isinstance(projection, HonestTaskProjection)
    assert projection.syntax_generation == "PASS"
    assert projection.runtime_execution == "UNKNOWN"
    assert projection.real_world_environment == "UNKNOWN"
    assert projection.overall_status == "UNRESOLVED"
    assert "Syntax & Generation: PASS" in projection.summary_text
    assert "Runtime Execution: UNKNOWN" in projection.summary_text
    assert "Overall Status: UNRESOLVED" in projection.summary_text


def test_kernel1_anti_self_certification_law():
    """Enforces Anti-Self-Certification Law: Issuer(Receipt) != AgentUnderTest."""
    # Attempting self-certification must raise AntiSelfCertificationError
    with pytest.raises(AntiSelfCertificationError):
        EvidenceClosureAdapter.verify_receipt_authority(
            agent_id="agent-coder-99",
            receipt_issuer_id="agent-coder-99",
        )

    with pytest.raises(AntiSelfCertificationError):
        EvidenceClosureAdapter.verify_receipt_authority(
            agent_id="agent-coder-99",
            receipt_issuer_id="self",
        )

    # Valid external witness succeeds
    assert EvidenceClosureAdapter.verify_receipt_authority(
        agent_id="agent-coder-99",
        receipt_issuer_id="verifier-oracle-sec",
    ) is True


def test_kernel1_conservation_bus_obligation_preservation():
    """Enforces that task decomposition never drops required parent obligations."""
    parent_obs = {"sec.no_leak", "perf.p95_sub10ms", "audit.receipt"}

    # Dropped obligation raises ObligationDroppedError
    with pytest.raises(ObligationDroppedError):
        ConservationBus.validate_decomposition(
            parent_obligations=parent_obs,
            delegated_obligations={"sec.no_leak"},
            retained_obligations={"audit.receipt"},  # Missing perf.p95_sub10ms
        )

    # Complete coverage passes
    assert ConservationBus.validate_decomposition(
        parent_obligations=parent_obs,
        delegated_obligations={"sec.no_leak", "perf.p95_sub10ms"},
        retained_obligations={"audit.receipt"},
    ) is True


def test_kernel1_conservation_bus_permission_attenuation():
    """Enforces monotonic permission attenuation: A_child <= A_parent."""
    parent_perms = {"READ_FILE", "DATABASE_READ"}
    child_requested = {"READ_FILE", "DELETE_FILE", "NETWORK_EGRESS"}

    attenuated = ConservationBus.attenuate_permissions(parent_perms, child_requested)
    assert attenuated == {"READ_FILE"}
    assert "DELETE_FILE" not in attenuated
    assert "NETWORK_EGRESS" not in attenuated


def test_kernel1_conservation_bus_sticky_security_labels():
    """Enforces that sticky labels (AIR_GAPPED, CONFIDENTIAL) cannot be demoted across summaries."""
    current_labels = {"AIR_GAPPED", "CONFIDENTIAL", "STAGE_DEV"}
    new_labels = {"STAGE_PROD"}

    merged = ConservationBus.preserve_security_labels(current_labels, new_labels)
    assert "AIR_GAPPED" in merged
    assert "CONFIDENTIAL" in merged
    assert "STAGE_PROD" in merged


def test_kernel1_morphing_engine_wpem_trigger_and_ast_fallback():
    """Verifies that MorphingEngine detects RAM/thermal stress and executes zero-token AST fallback."""
    # Under nominal conditions, no morphing
    assert MorphingEngine.should_morph_to_ast(free_ram_mb=4000, required_headroom_mb=1500, thermal_state="NOMINAL") is False

    # Under critical thermal state or low RAM headroom, morphing is triggered
    assert MorphingEngine.should_morph_to_ast(free_ram_mb=4000, required_headroom_mb=1500, thermal_state="CRITICAL") is True
    assert MorphingEngine.should_morph_to_ast(free_ram_mb=1000, required_headroom_mb=1500, thermal_state="NOMINAL") is True

    # Fallback solver execution is deterministic and $0 spend
    ast_res = MorphingEngine.execute_ast_fallback(
        "Goal: Build microservice rate limiter.\nInvariant: Never leak redis tokens.\nInvariant: Must return JSON."
    )
    assert ast_res["mode"] == "LOCAL_OFFLINE_DACO_AST_FALLBACK"
    assert ast_res["cost_nano_usd"] == 0
    assert ast_res["tokens_consumed"] == 0
    assert ast_res["airgap_enforced"] is True
    assert len(ast_res["detected_invariants"]) >= 2


# ==============================================================================
# KERNEL 2: REAL LOCAL SILICON & INFERENCE RESILIENCE TESTS (TRAP 2 FIX)
# ==============================================================================

def test_kernel2_multi_daemon_probing_nonblocking():
    """Verifies that probe_local_daemons executes with a 50ms connect timeout without hanging."""
    start_t = time.perf_counter()
    probed = probe_local_daemons(timeout_ms=50)
    elapsed = time.perf_counter() - start_t

    # Probing 4 endpoints at 50ms should complete rapidly (< 1.5s total even if ports refuse)
    assert elapsed < 2.0
    # On dev machine without Ollama running, it returns None or (name, url) cleanly
    assert probed is None or isinstance(probed, tuple)


def test_kernel2_paged_attention_truncation_guard():
    """Verifies that context limit exceeding preserves prefix invariant at token index 0."""
    kv_aligner = PagedAttentionKVAligner(block_size=32)
    invariants = ["CRITICAL_SAFETY_INVARIANT: Never reveal customer private keys or credentials."]
    huge_user_input = "Tell me a story. " * 800  # ~3200 tokens

    # Max context limit is 512 tokens
    layout, was_truncated = align_context_with_truncation_guard(
        kv_aligner=kv_aligner,
        invariant_clauses=invariants,
        user_input=huge_user_input,
        max_context_tokens=512,
    )
    assert was_truncated is True
    assert layout.prefix_tokens > 0
    # Invariant was preserved in compiled prefix
    assert "CRITICAL_SAFETY_INVARIANT" in layout.canonical_prefix


def test_kernel2_zero_panic_air_gapped_daco_fallback():
    """Verifies that if local upstream drops or crashes, WireProxy triggers Zero-Panic DACO fallback."""
    dead_upstream_port = find_free_port()
    proxy_port = find_free_port()

    # WireProxy configured with daco_fallback_on_error=True pointing to offline port
    proxy = WireProxyServer(
        host="127.0.0.1",
        port=proxy_port,
        upstream_url=f"http://127.0.0.1:{dead_upstream_port}",
        api_key="spe-local-fallback-token",
        require_auth=True,
        daco_fallback_on_error=True,
    )
    proxy.start()

    try:
        req = urllib.request.Request(
            f"{proxy.base_url}/chat/completions",
            data=json.dumps({"messages": [{"role": "user", "content": "summarize system prompt engine architecture"}]}).encode("utf-8"),
            headers={"Content-Type": "application/json", **proxy.auth_headers},
        )
        # Must return HTTP 200 without throwing 502 or crashing
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200
            assert resp.headers.get("x-spe-backend") == "LOCAL_OFFLINE_DACO_FALLBACK"
            assert resp.headers.get("x-spe-airgap-status") == "ENFORCED"
            assert resp.headers.get("x-spe-escrow-consumed-nanos") == "0"
            body = json.loads(resp.read().decode("utf-8"))
            content = body["choices"][0]["message"]["content"]
            assert "DACO Fallback" in content

    finally:
        proxy.stop()


# ==============================================================================
# KERNEL 3: FIRST 60 SECONDS PROGRESSIVE DISCLOSURE TESTS (TRAP 3 FIX)
# ==============================================================================

def test_kernel3_sixty_second_onboarding_contract_level0():
    """
    Verifies the First 60 Seconds Contract:
    - Renders in < 300 ms.
    - Zero jargon emitted.
    - Exact 4-part response format present.
    """
    compiler = MetaPromptCompiler()
    raw_prompt = "Build a customer feedback sentiment analysis microservice"

    t0 = time.perf_counter()
    result = compiler.synthesize_two_speed(raw_prompt)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    # 1. Latency under 300ms
    assert elapsed_ms < 300.0, f"Synthesis exceeded 300ms SLA: took {elapsed_ms:.2f}ms"

    rendered = result.rendered_output

    # 2. Exact 4-part response format
    assert "### 🛡️ 1. Your Protected Master Prompt" in rendered
    assert "### 🔒 2. Three Invariant Guarantees" in rendered
    assert "🚫 What It Will Never Do" in rendered
    assert "📋 Required Format" in rendered
    assert "⚠️ Honest Fallback" in rendered
    assert "### 📊 3. Verification Reality Check" in rendered
    assert "✅ Formally Verified Invariants:" in rendered
    assert "❓ Unverified (Missing Evidence):" in rendered
    assert "### ⚡ 4. Next Step (One-Click)" in rendered
    assert 'base_url="http://localhost:8080/v1"' in rendered
    assert "### 📦 3. One-Click .spe Bundle" in rendered

    # 3. ZERO JARGON INVARIANT
    assert "Bounded Horn SAT" not in rendered
    assert "Kleene 3-Valued Logic" not in rendered
    assert "Epistemic Manifold" not in rendered
    assert "H_∞" not in rendered
    assert "Lagrangian Multiplier" not in rendered


def test_kernel3_progressive_disclosure_level1_audit():
    """Verifies Level 1 disclosure (--audit) reveals RGIC-E1 minimal observation probe and test vectors."""
    compiler = MetaPromptCompiler()
    result = compiler.synthesize_two_speed("Build an order payment gateway", audit=True)

    rendered = result.rendered_output
    assert "## 🔬 LEVEL 1: EVIDENCE CLOSURE AUDIT (--audit)" in rendered
    assert "Minimal Observation Probe (a*):" in rendered
    assert "Missing Test Vectors:" in rendered
    assert "Runtime execution returncode == 0" in rendered
    assert result.audit_level is not None


def test_kernel3_progressive_disclosure_level2_pro():
    """Verifies Level 2 disclosure (/pro or --pro) reveals Epistemic Manifold, Horn SAT, and CEC proof."""
    compiler = MetaPromptCompiler()
    result = compiler.synthesize_two_speed("/pro Build high-throughput event streaming queue")

    assert result.mode == SynthesisMode.PRO
    rendered = result.rendered_output
    assert "SPE Ω PRO ARCHITECT PROOF STUDIO" in rendered
    assert "Epistemic Manifold Evaluation" in rendered
    assert "H_∞ = (P, M, T, R, V, C, A, S, Ω)" in rendered
    assert "Bounded Horn Clauses & Kleene-3 Truth Table" in rendered
    assert "RFC 8785 Content-Addressable Obligation Graph & Transition Witness" in rendered
    assert "CEC 100-Year Conservation Proof" in rendered


def test_kernel3_progressive_disclosure_level3_trace():
    """Verifies Level 3 disclosure (--trace) reveals Causal Proof Graph lineage DAG and 2PC state cuts."""
    compiler = MetaPromptCompiler()
    result = compiler.synthesize_two_speed("Build secure SQLite migration runner", trace=True)

    rendered = result.rendered_output
    assert "## 🧬 LEVEL 3: CAUSAL PROOF GRAPH TRACE (--trace)" in rendered
    assert "CPG Lineage DAG:" in rendered
    assert "2PC Escrow State: PREPARED ➔ COMMITTED" in rendered
    assert result.trace_graph is not None


def test_kernel1_release_auditor_adapter_full_audit():
    """Verifies that ReleaseAuditorAdapter executes full 500-case AEQ benchmark and returns tamper-evident bundle."""
    bundle = ReleaseAuditorAdapter.audit_release(target_agent="AutonomousFinancialTrader")

    assert bundle["verdict"] == "RELEASE_QUALIFIED"
    assert bundle["target_agent"] == "AutonomousFinancialTrader"
    assert bundle["total_cases_evaluated"] == 500
    assert bundle["overall_defect_detection_rate"] == 1.0
    assert bundle["anti_lucky_pass_status"] == "ENFORCED"
    assert bundle["regulatory_standard"] == "SPE-AEQ-20261009"
    assert len(bundle["tamper_proof_seal"]) == 64
    assert len(bundle["fault_families_audited"]) == 5
    assert bundle["hypotheses_verification"]["H1_defect_detection_ge_95"] is True
    assert bundle["hypotheses_verification"]["H2_zero_false_rejections"] is True
    assert bundle["hypotheses_verification"]["H3_statistically_superior_to_c"] is True


def test_kernel1_release_auditor_adapter_with_output_path(tmp_path):
    """Verifies that audit package is correctly saved to an air-gapped output file."""
    out_file = tmp_path / "release_audit.json"
    bundle = ReleaseAuditorAdapter.audit_release(
        target_agent="PaymentEscrowAgent",
        output_path=str(out_file),
        split_filter="DEV",
    )

    assert out_file.exists()
    saved = json.loads(out_file.read_text(encoding="utf-8"))
    assert saved["audit_id"] == bundle["audit_id"]
    assert saved["total_cases_evaluated"] == 200
    assert saved["verdict"] == "RELEASE_QUALIFIED"

