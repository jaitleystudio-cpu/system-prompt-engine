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
    TriOriginDiagnosticAdapter,
    ContinuationAuditorAdapter,
    ExchangeMeritRankerAdapter,
    ExchangeMissionMatcherAdapter,
    ExchangeSeoGovernorAdapter,
)
from spe_runtime.cli.main import main as cli_main
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


def test_kernel1_tri_origin_diagnostic_adapter_default_discrimination():
    """Verifies that TriOriginDiagnosticAdapter isolates Goal divergence under default canonical probe."""
    bundle = TriOriginDiagnosticAdapter.diagnose(
        discrepancy_id="DISC-E2E-01",
        target_origin="GOAL",
    )
    assert bundle["status"] == "DISCRIMINATED"
    assert bundle["is_identifiable"] is True
    assert bundle["discriminated_origins"] == ["GOAL"]
    assert "h-goal-DISC-E2E-01" in bundle["remaining_hypotheses"]
    assert "h-world-DISC-E2E-01" in bundle["eliminated_hypotheses"]
    assert "h-verifier-DISC-E2E-01" in bundle["eliminated_hypotheses"]
    assert len(bundle["precommitment_hash"]) == 64
    assert len(bundle["tamper_proof_seal"]) == 64
    assert bundle["regulatory_standard"] == "SPE-RGIC-T1-20261009"

    probe = bundle["selected_probe"]
    assert probe["id"] == "probe-spec-reconcile"
    assert probe["cost_nano_usd"] == 5_000_000
    assert probe["is_authorized"] is True
    assert probe["voi_score"] > 0


def test_kernel1_tri_origin_diagnostic_adapter_world_and_verifier_origins():
    """Verifies that TriOriginDiagnosticAdapter isolates World and Verifier origins respectively."""
    # World Model Dynamics isolation
    world_bundle = TriOriginDiagnosticAdapter.diagnose(
        discrepancy_id="DISC-WORLD-01",
        target_origin="WORLD",
    )
    assert world_bundle["status"] == "DISCRIMINATED"
    assert world_bundle["discriminated_origins"] == ["WORLD"]
    assert "h-world-DISC-WORLD-01" in world_bundle["remaining_hypotheses"]
    assert "h-goal-DISC-WORLD-01" in world_bundle["eliminated_hypotheses"]

    # Verifier Inadequacy isolation
    verifier_bundle = TriOriginDiagnosticAdapter.diagnose(
        discrepancy_id="DISC-VERIFIER-01",
        target_origin="VERIFIER",
    )
    assert verifier_bundle["status"] == "DISCRIMINATED"
    assert verifier_bundle["discriminated_origins"] == ["VERIFIER"]
    assert "h-verifier-DISC-VERIFIER-01" in verifier_bundle["remaining_hypotheses"]
    assert "h-goal-DISC-VERIFIER-01" in verifier_bundle["eliminated_hypotheses"]


def test_kernel1_tri_origin_diagnostic_adapter_unidentifiable_abstention():
    """Verifies that when hypotheses belong to an observational equivalence class, it honestly emits UNIDENTIFIABLE."""
    bundle = TriOriginDiagnosticAdapter.diagnose(
        discrepancy_id="DISC-AMBIG-01",
        simulate_unidentifiable=True,
    )
    assert bundle["status"] == "UNIDENTIFIABLE"
    assert bundle["is_identifiable"] is False
    assert len(bundle["remaining_hypotheses"]) == 2
    assert len(bundle["eliminated_hypotheses"]) == 0


def test_kernel1_tri_origin_diagnostic_adapter_anti_harking_tamper_rejection():
    """Verifies that post-hoc prediction alteration violates cryptographic precommitment and yields INVALID_RUN."""
    bundle = TriOriginDiagnosticAdapter.diagnose(
        discrepancy_id="DISC-TAMPER-01",
        simulate_tamper=True,
    )
    assert bundle["status"] == "INVALID_RUN"
    assert bundle["is_identifiable"] is False


def test_kernel1_tri_origin_diagnostic_adapter_retraction_cascade():
    """Verifies that assumption invalidation cascades along DAEDG to demote downstream capabilities."""
    bundle = TriOriginDiagnosticAdapter.diagnose(
        discrepancy_id="DISC-RETRACT-01",
        invalidated_node_id="M1",
    )
    assert bundle["retraction_cascade"] == ["C1", "QB"]

    # Direct custom DAG test
    custom_deps = {
        "OBS_1": [],
        "MECH_DB_POOL": ["OBS_1"],
        "CAP_TRANSACTIONS": ["MECH_DB_POOL"],
        "QUAL_PCI_DSS": ["CAP_TRANSACTIONS"],
    }
    demoted = TriOriginDiagnosticAdapter.retract_assumptions(
        dependencies=custom_deps,
        invalidated_node_id="MECH_DB_POOL",
    )
    assert demoted == ["CAP_TRANSACTIONS", "QUAL_PCI_DSS"]


def test_kernel1_tri_origin_diagnostic_adapter_file_persistence(tmp_path):
    """Verifies that diagnostic artifacts are correctly serialized to disk."""
    out_file = tmp_path / "diagnosis.json"
    bundle = TriOriginDiagnosticAdapter.diagnose(
        discrepancy_id="DISC-PERSIST-01",
        output_path=str(out_file),
    )
    assert out_file.exists()
    saved = json.loads(out_file.read_text(encoding="utf-8"))
    assert saved["record_id"] == bundle["record_id"]
    assert saved["discrepancy_id"] == "DISC-PERSIST-01"
    assert saved["status"] == "DISCRIMINATED"
    assert saved["tamper_proof_seal"] == bundle["tamper_proof_seal"]


def test_cli_diagnose_command_e2e(tmp_path):
    """Verifies CLI execution of spe diagnose including flags, strict mode, and JSON formatting."""
    # 1. Normal run with output file
    out_file = tmp_path / "cli_diag.json"
    ret = cli_main(["diagnose", "DISC-CLI-01", "--origin", "WORLD", "--out", str(out_file)])
    assert ret == 0
    assert out_file.exists()
    data = json.loads(out_file.read_text(encoding="utf-8"))
    assert data["status"] == "DISCRIMINATED"
    assert data["discriminated_origins"] == ["WORLD"]

    # 2. Strict mode on clean run passes
    ret_strict = cli_main(["diagnose", "DISC-CLI-STRICT", "--origin", "GOAL", "--strict"])
    assert ret_strict == 0

    # 3. Strict mode on unidentifiable fails with exit code 1
    ret_strict_fail = cli_main(["diagnose", "DISC-CLI-FAIL", "--unidentifiable", "--strict"])
    assert ret_strict_fail == 1

    # 4. Strict mode on tamper fails with exit code 1
    ret_tamper_fail = cli_main(["diagnose", "DISC-CLI-TAMPER", "--tamper", "--strict"])
    assert ret_tamper_fail == 1

    # 5. JSON flag
    ret_json = cli_main(["diagnose", "DISC-CLI-JSON", "--json"])
    assert ret_json == 0


def test_kernel1_tri_origin_diagnostic_adapter_empty_probes_rejection():
    """Verifies that TriOriginDiagnosticAdapter rejects empty candidate probe lists with ValueError."""
    with pytest.raises(ValueError, match="Candidate probes list cannot be empty"):
        TriOriginDiagnosticAdapter.diagnose(
            discrepancy_id="DISC-EMPTY-PROBES",
            candidate_probes=[],
        )


def test_kernel1_tri_origin_diagnostic_adapter_joint_gv_origin():
    """Verifies that TriOriginDiagnosticAdapter handles compound Goal + Verifier failure origins."""
    bundle = TriOriginDiagnosticAdapter.diagnose(
        discrepancy_id="DISC-JOINT-01",
        target_origin="G+V",
    )
    assert bundle["status"] == "UNIDENTIFIABLE" or bundle["status"] == "DISCRIMINATED"
    # Canonical canonical probes do not model compound H_GV by default so it recognizes unmodeled or unidentifiable
    assert len(bundle["precommitment_hash"]) == 64
    assert len(bundle["tamper_proof_seal"]) == 64


def test_kernel1_tri_origin_diagnostic_adapter_circular_daedg_safeguard():
    """Verifies that circular dependencies do not overwrite target node state or corrupt demotion."""
    circular_deps = {
        "ALPHA": ["BETA"],
        "BETA": ["ALPHA"],
    }
    demoted = TriOriginDiagnosticAdapter.retract_assumptions(
        dependencies=circular_deps,
        invalidated_node_id="ALPHA",
    )
    # ALPHA must not be in demoted list
    assert "ALPHA" not in demoted
    assert "BETA" in demoted


def test_kernel1_tri_origin_diagnostic_adapter_diamond_topological_sort():
    """Verifies that diamond epistemic derivations are demoted in strict topological order."""
    diamond_deps = {
        "ROOT": [],
        "MID_A": ["ROOT"],
        "LEAF_C": ["ROOT", "MID_A"],
    }
    demoted = TriOriginDiagnosticAdapter.retract_assumptions(
        dependencies=diamond_deps,
        invalidated_node_id="ROOT",
    )
    assert demoted == ["MID_A", "LEAF_C"]


# ==============================================================================
# KERNEL 1: CONTINUATION AUDITOR ADAPTER TESTS (WDIC-VCT & CWC)
# ==============================================================================

def test_kernel1_continuation_auditor_adapter_anti_omission():
    """
    Verifies that unasserted requirements remain UNVERIFIED despite 126 passing tests (Anti-Omission Law).
    Ensures that the 6-clause Next Task Contract is synthesized with S-Capsule literature and skills.
    """
    raw_report = (
        "TASK: Implement secure session recovery.\n"
        "RESULT: Implementation completed successfully.\n"
        "TESTS: 126 passed. 0 failed. 3 skipped.\n"
        "FILES: session.py recovery.py test_recovery.py\n"
        "COMMIT: 4f8a9b2c\n"
        "R-01 Session Serialization: passed with full test coverage.\n"
    )

    bundle = ContinuationAuditorAdapter.audit_and_continue(
        report_text=raw_report,
        task_id="task-recovery-001",
        mission_id="MISSION-AUTH-01",
        requirements=["R-01", "R-17"],
        baseline_ref="4f8a9b2c",
    )

    # 1. Audit counts and verdict
    assert bundle["verdict"] == "DEFICIT_DETECTED"
    assert bundle["total_requirements"] == 2
    assert bundle["verified_count"] == 1
    assert bundle["unverified_count"] == 1
    assert bundle["contradicted_count"] == 0
    assert bundle["anti_omission_status"] == "ENFORCED"

    # 2. Deficit targets omitted R-17
    assert bundle["deficit"]["open_requirements"] == ["R-17"]
    assert bundle["deficit"]["deficit_count"] == 1

    # 3. Next Task Contract validation
    contract = bundle["next_task_contract"]
    assert contract is not None
    assert "R-17" in contract["task_title"]
    assert contract["baseline_ref"] == "4f8a9b2c"
    assert contract["allowed_files"] == ["session.py", "recovery.py", "test_recovery.py"]
    assert len(contract["execution_steps"]) >= 4
    assert len(contract["stop_boundaries"]) >= 3
    assert "```spe-task" in contract["markdown"]

    # 4. S-Capsule and active skills attached
    assert bundle["empirical_blueprint"] is not None
    assert "arXiv" in bundle["empirical_blueprint"]["identifier"] or "doi" in bundle["empirical_blueprint"]["identifier"]
    assert len(bundle["skills_injected"]) > 0

    # 5. Distinguishing witness probe
    assert bundle["distinguishing_probe"] is not None
    assert bundle["distinguishing_probe"]["cost_nano_usd"] == 0

    # 6. Strict zero-cost economics
    assert bundle["cost_nano_usd"] == 0
    assert bundle["estimated_savings_tokens"] >= 4000
    assert bundle["estimated_savings_usd"] > 0.0
    assert len(bundle["tamper_proof_seal"]) == 64


def test_kernel1_continuation_auditor_adapter_scope_boundary_violation():
    """Verifies that unauthorized modification of prohibited files triggers BLOCKED_CONTRADICTION."""
    raw_report = (
        "TASK: Update config\n"
        "RESULT: Done\n"
        "TESTS: 20 passed. 0 failed.\n"
        "FILES: session.py .env\n"
        "R-01 passed.\n"
    )

    bundle = ContinuationAuditorAdapter.audit_and_continue(
        report_text=raw_report,
        requirements=["R-01"],
        prohibited_files=[".env", "secrets.json"],
    )

    assert bundle["verdict"] == "BLOCKED_CONTRADICTION"
    assert bundle["contradicted_count"] >= 1
    assert any(c["status"] == "CONTRADICTED" for c in bundle["claims"])
    assert bundle["next_task_contract"] is not None
    assert "Repair Contradiction" in bundle["next_task_contract"]["task_title"]


def test_kernel1_continuation_auditor_adapter_regression_triggers_repair():
    """Verifies that failing test runs trigger regression repair priority."""
    raw_report = (
        "TASK: Optimize memory\n"
        "RESULT: Failed assertion\n"
        "TESTS: 50 passed. 3 failed.\n"
        "FILES: cache.py\n"
        "R-01 passed.\n"
    )

    bundle = ContinuationAuditorAdapter.audit_and_continue(
        report_text=raw_report,
        requirements=["R-01"],
    )

    assert bundle["verdict"] == "BLOCKED_CONTRADICTION"
    assert "TEST_REGRESSION" in bundle["deficit"]["contradicted_requirements"]
    assert bundle["next_task_contract"] is not None
    assert "TEST_REGRESSION" in bundle["next_task_contract"]["task_title"]


def test_kernel1_continuation_auditor_adapter_qualified_all_passed():
    """Verifies that fully verified tasks emit QUALIFIED with zero remaining deficit."""
    raw_report = (
        "TASK: Build microcode\n"
        "RESULT: All specifications asserted\n"
        "TESTS: 100 passed. 0 failed.\n"
        "FILES: kernel.py\n"
        "R-01 passed and asserted.\n"
        "R-02 passed and asserted.\n"
    )

    bundle = ContinuationAuditorAdapter.audit_and_continue(
        report_text=raw_report,
        requirements=["R-01", "R-02"],
    )

    assert bundle["verdict"] == "QUALIFIED"
    assert bundle["verified_count"] == 2
    assert bundle["unverified_count"] == 0
    assert bundle["contradicted_count"] == 0
    assert bundle["deficit"]["deficit_count"] == 0
    assert bundle["next_task_contract"] is None
    assert bundle["next_task_markdown"] == ""


def test_kernel1_continuation_auditor_adapter_dependency_invalidation():
    """Verifies that CWC selectively invalidates proofs when their dependent files change."""
    verified_obs = {
        "PROOF-AUTH": ["session.py", "token.py"],
        "PROOF-STORAGE": ["storage.py"],
    }

    raw_report = (
        "TASK: Storage enhancement\n"
        "RESULT: Storage updated\n"
        "TESTS: 10 passed. 0 failed.\n"
        "FILES: storage.py\n"
    )

    bundle = ContinuationAuditorAdapter.audit_and_continue(
        report_text=raw_report,
        verified_obligations=verified_obs,
    )

    # PROOF-AUTH depends on session.py and token.py (untouched) -> reusable
    assert "PROOF-AUTH" in bundle["reusable_proofs"]
    # PROOF-STORAGE depends on storage.py (modified) -> invalidated
    assert "PROOF-STORAGE" in bundle["invalidated_proofs"]


def test_kernel1_continuation_cli_command_battery(tmp_path):
    """Verifies that `spe continue` and `spe continue-task` execute with zero exit code and correct artifacts."""
    out_json = tmp_path / "cli_continuation.json"
    out_contract = tmp_path / "cli_contract.md"

    # 1. Standard execution with file outputs
    ret = cli_main([
        "continue",
        "--out", str(out_json),
        "--out-contract", str(out_contract),
    ])
    assert ret == 0
    assert out_json.exists()
    assert out_contract.exists()

    data = json.loads(out_json.read_text(encoding="utf-8"))
    assert data["verdict"] == "DEFICIT_DETECTED"
    assert data["cost_nano_usd"] == 0
    assert data["estimated_savings_tokens"] >= 4000
    assert data["next_task_contract"] is not None

    contract_md = out_contract.read_text(encoding="utf-8")
    assert "```spe-task" in contract_md
    assert "EXECUTION PLAN:" in contract_md

    # 2. Strict mode on clean run passes
    ret_strict = cli_main(["continue", "--strict"])
    assert ret_strict == 0

    # 3. Strict mode on contradiction fails with exit code 1
    contra_file = tmp_path / "failing_report.txt"
    contra_file.write_text("RESULT: Failed\nTESTS: 10 passed. 2 failed.\nFILES: file.py\n", encoding="utf-8")
    ret_strict_fail = cli_main(["continue", str(contra_file), "--strict"])
    assert ret_strict_fail == 1

    # 4. JSON flag execution
    ret_json = cli_main(["continue", "--json"])
    assert ret_json == 0

    # 5. continue-task alias execution
    ret_alias = cli_main(["continue-task", "--json"])
    assert ret_alias == 0


def test_kernel1_continuation_large_raw_report_no_os_error():
    """Verifies that large multi-line raw reports (>1000 chars) do not trigger OSError: File name too long."""
    large_report = (
        "TASK: Large comprehensive refactor\n"
        "RESULT: Succeeded with all assertions intact\n"
        "TESTS: 250 passed. 0 failed. 0 skipped.\n"
        "FILES: service.py model.py router.py test_router.py\n"
        "COMMIT: aabbccddeeff00112233445566778899aabbccdd\n"
        "R-01: passed and verified\n"
        + ("LOG: " + ("x" * 200) + "\n") * 5
    )
    assert len(large_report) > 1000

    bundle = ContinuationAuditorAdapter.audit_and_continue(
        report_text=large_report,
        requirements=["R-01"],
    )
    assert bundle["verdict"] == "QUALIFIED"
    assert bundle["verified_count"] == 1


def test_kernel1_continuation_exit_code_failure_regression():
    """Verifies that non-zero exit code triggers TEST_REGRESSION and blocks qualification."""
    raw_report = (
        "TASK: Execute test battery\n"
        "COMMAND: pytest tests/\n"
        "EXIT_CODE: 1\n"
        "TESTS: 50 passed\n"
        "FILES: core.py\n"
        "R-01: passed\n"
    )

    bundle = ContinuationAuditorAdapter.audit_and_continue(
        report_text=raw_report,
        requirements=["R-01"],
    )
    assert bundle["verdict"] == "BLOCKED_CONTRADICTION"
    assert "TEST_REGRESSION" in bundle["deficit"]["contradicted_requirements"]


def test_kernel1_continuation_multiline_bulleted_files_prohibited_catch():
    """Verifies that bulleted multi-line FILES entries catch prohibited file modifications."""
    raw_report = (
        "TASK: Update configuration and secrets\n"
        "RESULT: Changes committed\n"
        "FILES:\n"
        "  - service.py\n"
        "  - .env\n"
        "TESTS: 10 passed\n"
        "R-01: passed\n"
    )

    bundle = ContinuationAuditorAdapter.audit_and_continue(
        report_text=raw_report,
        requirements=["R-01"],
        prohibited_files=[".env"],
    )
    assert bundle["verdict"] == "BLOCKED_CONTRADICTION"
    assert any(c["requirement_id"] == "SCOPE_SECURITY" for c in bundle["claims"])


def test_kernel1_continuation_auth_probe_no_attribute_error():
    """Verifies that auth reports generate distinguishing probes without AttributeError."""
    raw_report = (
        "TASK: Implement auth token verification\n"
        "RESULT: Auth token verification completed\n"
        "TESTS: 20 passed. 0 failed.\n"
        "FILES: auth.py token.py\n"
        "R-01 Auth Verification: passed\n"
    )

    bundle = ContinuationAuditorAdapter.audit_and_continue(
        report_text=raw_report,
        requirements=["R-01", "R-AUTH-EXPIRY"],
    )
    assert bundle["verdict"] == "DEFICIT_DETECTED"
    assert bundle["distinguishing_probe"] is not None
    assert bundle["distinguishing_probe"]["probe_type"] in ["NEGATIVE_TEST", "NEGATIVE_ASSERTION"]


def test_kernel1_continuation_cli_stdin_support(monkeypatch):
    """Verifies that spe continue reads agent reports from stdin when piped or passed -."""
    import io
    stdin_content = (
        "TASK: Pipe review\n"
        "RESULT: Piped through stdin successfully\n"
        "TESTS: 30 passed. 0 failed.\n"
        "FILES: pipeline.py\n"
        "R-01: passed\n"
    )
    monkeypatch.setattr("sys.stdin", io.StringIO(stdin_content))

    ret = cli_main(["continue", "-", "--json"])
    assert ret == 0


# ==============================================================================
# EXCHANGE: EVIDENCE PASSPORT, MERIT RANKING, MISSION FIT & SEO GOVERNOR TESTS
# ==============================================================================

def test_kernel1_exchange_merit_ranker_unpurchasable_top3():
    """Verifies unpurchasable Top-3 merit ranking, Wilson intervals, and sponsored isolation."""
    candidates = [
        {
            "name": "@skill/alpha-merit",
            "trials_n": 300,
            "successes": 290,
            "tested_environment": {"host_runtime": "Claude Code", "trials_n": 300},
            "security_audit": {"static_analysis": "PASSED_SAFE", "exfiltration_risk": "ZERO_DETECTED"},
        },
        {
            "name": "@skill/beta-merit",
            "trials_n": 100,
            "successes": 95,
            "tested_environment": {"host_runtime": "Cursor", "trials_n": 100},
            "security_audit": {"static_analysis": "PASSED_SAFE", "exfiltration_risk": "ZERO_DETECTED"},
        },
        {
            "name": "@skill/gamma-sponsored",
            "trials_n": 100,
            "successes": 100,
            "is_sponsored": True,
            "sponsor_bid_usd": 1000.0,
            "security_audit": {"static_analysis": "PASSED_SAFE", "exfiltration_risk": "ZERO_DETECTED"},
        },
        {
            "name": "@skill/delta-malicious",
            "trials_n": 50,
            "successes": 50,
            "security_audit": {"static_analysis": "FAILED_RISK", "unauthorized_network_egress": True},
        },
    ]

    res = ExchangeMeritRankerAdapter.rank_catalog(candidates)
    assert res["ranked_count"] == 2
    assert res["sponsored_count"] == 1
    assert res["disqualified_count"] == 1

    top_names = [p["target_identifier"] for p in res["top_3"]]
    assert "@skill/alpha-merit" in top_names
    assert "@skill/beta-merit" in top_names
    assert "@skill/gamma-sponsored" not in top_names
    assert "@skill/delta-malicious" not in top_names


def test_kernel1_exchange_mission_matcher_permission_and_conflict_closure():
    """Verifies permission boundary enforcement, conflict closure, and honest abstention."""
    catalog = [
        {
            "name": "@skill/drizzle-orm",
            "capabilities": ["Drizzle ORM", "Database Migrations"],
            "permissions": ["LOCAL_AST_ONLY"],
            "authority_domain": "database_migration",
            "limitation": "Requires schema input",
            "tested_environment": {"trials_n": 200},
            "performance_metrics": {"wilson_lower_bound_95": 0.942},
            "validity_window": {"status": "CURRENT"},
        },
        {
            "name": "@skill/prisma-competing",
            "capabilities": ["Database Migrations"],
            "permissions": ["LOCAL_AST_ONLY"],
            "authority_domain": "database_migration",  # Collision!
            "limitation": "Schema lock",
            "tested_environment": {"trials_n": 150},
            "performance_metrics": {"wilson_lower_bound_95": 0.890},
            "validity_window": {"status": "CURRENT"},
        },
    ]

    res = ExchangeMissionMatcherAdapter.match_mission(
        mission_intent="Build database migrations using Drizzle ORM, local AST only",
        catalog=catalog,
        runtime="Claude Code",
    )

    assert res["status"] == "QUALIFIED_MATCH"
    assert res["conflict_check_passed"] is True
    # Competing migration handler excluded to prevent domain collision
    recommended = [r["skill_identifier"] for r in res["recommendations"]]
    assert "@skill/drizzle-orm" in recommended
    assert "@skill/prisma-competing" not in recommended


def test_kernel1_exchange_seo_governor_sanctuary_and_indexability():
    """Verifies Google scaled content defense classification and 100% ad-free private sanctuary."""
    from spe_runtime.research.exchange.seo_governor import AdSanctuaryViolationError

    # 1. Scaled content indexability check
    res_pub = ExchangeSeoGovernorAdapter.classify_indexability(
        route="/exchange/skills/sample",
        trials_n=150,
        has_evidence_passport=True,
        has_reproducible_benchmark=True,
    )
    assert res_pub["status"] == "INDEXABLE"
    assert res_pub["robots_directive"] == "index, follow"

    # Thin stub (< 10 trials) must be noindex
    res_thin = ExchangeSeoGovernorAdapter.classify_indexability(
        route="/exchange/skills/thin-stub",
        trials_n=4,
        has_evidence_passport=True,
    )
    assert res_thin["status"] == "NON_INDEXABLE"
    assert res_thin["robots_directive"] == "noindex, follow"

    # 2. Ad sanctuary enforcement
    assert ExchangeSeoGovernorAdapter.enforce_ad_sanctuary(
        route="/exchange/skills/sample",
        has_ads=True,
    ) is True

    # Ads in private workspace strictly raise AdSanctuaryViolationError
    with pytest.raises(AdSanctuaryViolationError):
        ExchangeSeoGovernorAdapter.enforce_ad_sanctuary(
            route="/workspace/mission-001",
            has_ads=True,
        )


def test_kernel1_exchange_cli_dispatch():
    """Verifies that `spe exchange` subcommands execute with zero exit code."""
    # Rank
    assert cli_main(["exchange", "rank", "--json"]) == 0

    # Match
    assert cli_main(["exchange", "match", "Build database migrations with Next.js", "--json"]) == 0

    # Passport
    assert cli_main(["exchange", "passport", "@skill/test-pass", "--json"]) == 0

    # SEO check
    assert cli_main(["exchange", "seo-check", "/exchange", "--json"]) == 0





