"""Comprehensive tests for SPE Ω Causal-Serializable Intelligence Fabric (CSI)."""

import pytest

from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.csi import (
    CausalCommitEngine,
    EffectBarrierViolation,
    EpistemicMVCCEngine,
    IrreversibleEffectBarrier,
    LatticeState,
    ModelTarget,
    PageFaultInterrupt,
    SemanticInstruction,
    SemanticMicrocodeCompiler,
    SemanticMMU,
    SemanticTransaction,
)
from spe_runtime.runtime_gateway.firewall import CapabilityFirewall, sign_grant
from spe_runtime.runtime_gateway.models import CapabilityGrant, CapabilityType


def test_s_mmu_allocation_and_transitive_invalidation():
    mmu = SemanticMMU()

    # Step 1: Allocate registers: price_A -> ranking -> recommendation
    reg_price = mmu.allocate_register("evidence.price_A", 450.0)
    reg_ranking = mmu.allocate_register("claim.ranking", "Supplier A is #1", dependencies=["evidence.price_A"])
    reg_rec = mmu.allocate_register("decision.rec", "Buy from Supplier A", dependencies=["claim.ranking"])
    # Orthogonal register that does NOT depend on price_A
    reg_auth = mmu.allocate_register("authority.mgr_approval", True)

    assert reg_price.version == 1
    assert reg_ranking.lattice_state == LatticeState.VALID
    assert reg_rec.lattice_state == LatticeState.VALID
    assert reg_auth.lattice_state == LatticeState.VALID

    # Step 2: Upstream price changes (450 -> 520)
    new_price, invalidated = mmu.update_register("evidence.price_A", 520.0)

    assert new_price.version == 2
    # Transitive consumers must be invalidated
    assert "claim.ranking" in invalidated
    assert "decision.rec" in invalidated
    # Orthogonal verified facts must remain VALID!
    assert "authority.mgr_approval" not in invalidated

    assert mmu.get_register("claim.ranking").lattice_state == LatticeState.INVALID
    assert mmu.get_register("decision.rec").lattice_state == LatticeState.INVALID
    assert mmu.get_register("authority.mgr_approval").lattice_state == LatticeState.VALID


def test_s_mmu_working_set_paging_and_fault_resolution():
    mmu = SemanticMMU()
    mmu.allocate_register("root.fact1", "fact1")
    mmu.allocate_register("root.fact2", "fact2", dependencies=["root.fact1"])
    mmu.allocate_register("unrelated.fact99", "noise")

    # Page working set for root.fact2
    ws = mmu.page_working_set(goal_register_ids=["root.fact2"], pinned_obligations=["NEVER_LEAK_PII"])

    assert "root.fact2" in ws.registers
    assert "root.fact1" in ws.registers
    # Unrelated fact must NOT be paged!
    assert "unrelated.fact99" not in ws.registers
    assert "NEVER_LEAK_PII" in ws.pinned_obligations

    # Accessing un-paged register triggers PageFaultInterrupt
    with pytest.raises(PageFaultInterrupt):
        ws.get_register("unrelated.fact99")

    # S-MMU dynamically resolves page fault
    resolved_reg = mmu.resolve_page_fault(ws, "unrelated.fact99")
    assert resolved_reg.term == "noise"
    assert ws.get_register("unrelated.fact99").term == "noise"


def test_epistemic_mvcc_stale_read_detection_and_commit():
    mmu = SemanticMMU()
    mmu.allocate_register("stock.count", 10)

    mvcc = EpistemicMVCCEngine(mmu)

    # Transaction 1 starts and reads stock.count at version 1
    tx1 = mvcc.begin_transaction()
    r1 = mvcc.read(tx1, "stock.count")
    assert r1.version == 1

    # Outside transaction updates stock.count to 5 (version 2)
    mmu.update_register("stock.count", 5)

    # Transaction 1 proposes write based on stale read
    mvcc.write(tx1, "order.reservation", "Reserved 8 units")

    # Commit must fail with Stale Epistemic Read violation!
    with pytest.raises(ValueError) as exc:
        mvcc.commit(tx1)
    assert "Stale Epistemic Read" in str(exc.value)
    assert tx1.aborted is True

    # Transaction 2 starts fresh and succeeds
    tx2 = mvcc.begin_transaction()
    r2 = mvcc.read(tx2, "stock.count")
    assert r2.version == 2
    mvcc.write(tx2, "order.reservation", "Reserved 3 units")
    committed = mvcc.commit(tx2)
    assert committed is True
    assert mmu.get_register("order.reservation").version == 1


def test_causal_commit_challenge_and_c4_certificate():
    engine = CausalCommitEngine()
    tx = SemanticTransaction(tx_id="tx-c4-test", snapshot_timestamp=0.0)

    prereqs = {"user_authorized": True, "balance_sufficient": True}

    def decision_fn(env: dict) -> str:
        if env.get("user_authorized") and env.get("balance_sufficient"):
            return "PROCEED_TRANSFER"
        return "DENY_TRANSFER"

    # Evaluates grounded decision
    cert = engine.evaluate_causal_grounding(
        tx=tx,
        candidate_decision="PROCEED_TRANSFER",
        prerequisites=prereqs,
        decision_evaluator=decision_fn,
    )

    assert cert.is_grounded is True
    assert cert.sensitivity_passed is True
    assert cert.invariance_passed is True
    assert len(cert.signature_hex) > 0
    assert tx.c4_certificate == cert

    # Case 2: Hallucinated / ungrounded decision (inverting prereqs does NOT change outcome)
    bad_fn = lambda env: "PROCEED_TRANSFER"  # Ignores inputs completely!
    cert_bad = engine.evaluate_causal_grounding(
        tx=tx,
        candidate_decision="PROCEED_TRANSFER",
        prerequisites=prereqs,
        decision_evaluator=bad_fn,
    )
    assert cert_bad.sensitivity_passed is False
    assert cert_bad.is_grounded is False


def test_irreversible_effect_barrier_with_2pc_escrow():
    mmu = SemanticMMU()
    mmu.allocate_register("user.kyc", "VERIFIED")

    # Set up firewall and authorized grant
    sk, pk = generate_keypair()
    issuer = "spe-treasury"
    firewall = CapabilityFirewall(verify_signatures=True)
    firewall.register_trust_root(issuer, pk.hex())

    grant = CapabilityGrant(
        grant_id="grant-wire",
        capability=CapabilityType.PAYMENT,
        resource_scope="finance:*",
        action_scope="auto_approved,payment",
        issuer=issuer,
        approval_identity="cfo-01",
        expiration_iso="2035-01-01T00:00:00Z",
        nonce="nonce-wire-01",
        signature="",
        amount_budget=1000.0,
        remaining_budget=1000.0,
    )
    sign_grant(grant, sk, pk)
    firewall.install_grant(grant)

    barrier = IrreversibleEffectBarrier(mmu=mmu, firewall=firewall)
    mvcc = EpistemicMVCCEngine(mmu)

    tx = mvcc.begin_transaction()
    mvcc.read(tx, "user.kyc")

    # Generate C^4 certificate
    causal_engine = CausalCommitEngine()
    causal_engine.evaluate_causal_grounding(
        tx,
        "PAY",
        {"kyc": True},
        lambda e: "PAY" if e.get("kyc") else "BLOCK",
    )

    proposal = mvcc.propose_effect(
        tx=tx,
        action="payment",
        target_resource="finance:wire",
        payload={"beneficiary": "Acme Corp"},
        amount_usd=250.0,
        authority_grant_id="grant-wire",
    )

    # Successful execution under barrier
    receipt = barrier.commit_effect(
        proposal=proposal,
        tx=tx,
        executor_fn=lambda p: {"wire_id": "WIRE-999"},
    )
    assert receipt["status"] == "EFFECT_COMMITTED"
    assert receipt["execution_result"]["wire_id"] == "WIRE-999"
    # Remaining budget must be debited
    assert firewall.grants["grant-wire"].remaining_budget == 750.0

    # Test Stale Register Barrier Block
    mmu.update_register("user.kyc", "REVOKED")
    proposal_stale = mvcc.propose_effect(
        tx=tx,
        action="payment",
        target_resource="finance:wire",
        payload={"beneficiary": "Acme Corp"},
        amount_usd=100.0,
        authority_grant_id="grant-wire",
    )
    with pytest.raises(EffectBarrierViolation) as exc_info:
        barrier.commit_effect(proposal_stale, tx, lambda p: {})
    assert "Barrier Gate 1 Failed: Stale register" in str(exc_info.value)


def test_semantic_microcode_compiler_multi_target():
    compiler = SemanticMicrocodeCompiler()
    instructions = [
        SemanticInstruction("REQUIRE_AUTHORITY", {"scope": "finance:read", "max_budget": 50.0}),
        SemanticInstruction("INFER_RELATION", {"subject": "vendor", "predicate": "cheapest", "object": "Acme"}),
        SemanticInstruction("ASSERT_INVARIANT", {"rule": "never exceed approved amount"}),
        SemanticInstruction("PROPOSE_EFFECT", {"action": "create_invoice", "target": "db:invoices"}),
    ]

    # Target 1: Claude XML
    claude_code = compiler.compile(instructions, ModelTarget.CLAUDE_XML)
    assert "<semantic_machine" in claude_code.system_text
    assert "<op id=\"01\" code=\"REQUIRE_AUTHORITY\">" in claude_code.system_text
    assert "<scope>finance:read</scope>" in claude_code.system_text

    # Target 2: OpenAI Markdown
    openai_code = compiler.compile(instructions, ModelTarget.OPENAI_MARKDOWN)
    assert "# SPE Ω Semantic Machine Instructions" in openai_code.system_text
    assert "1. **REQUIRE_AUTHORITY**" in openai_code.system_text
    assert openai_code.grammar_or_schema is not None
    assert openai_code.grammar_or_schema["tools"][0]["name"] == "create_invoice"

    # Target 3: Llama GBNF
    llama_code = compiler.compile(instructions, ModelTarget.LLAMA_GBNF)
    assert "root ::= operation+" in llama_code.system_text
    assert "REQUIRE_AUTHORITY" in llama_code.system_text
