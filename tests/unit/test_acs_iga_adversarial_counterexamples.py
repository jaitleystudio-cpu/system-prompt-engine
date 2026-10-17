"""Unit tests reproducing all Grok counterexamples and verifying ACS-IGA repairs.

Validates:
  1. Credential-prefix authorization bypass prevention
  2. Revocation checking (both string tokens and structured credentials)
  3. Expiration checking
  4. Tenant and authority validation
  5. Invalid monetary types (bool, float, string, object, None)
  6. Negative and forbidden zero amounts
  7. Undefined authorization decisions prevention (deny by default)
  8. PII detection and unicode normalization
  9. Executable-bound proof validation and forged receipt rejection
  10. Textbook causal identifiability across all 13 reference graphs
"""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any, Dict, List, Set, Tuple
import pytest

from spe_runtime.supercompiler.causal_circuit_synthesizer import (
    CircuitProofReceipt,
    CircuitVerifier,
    CausalCircuitSynthesizer,
    HoareContract,
    ProofCarryingCausalCircuit,
    is_valid_manager_token,
    validate_amount_cents,
)
from spe_runtime.supercompiler.fast_path_dispatcher import (
    ZeroEntropyFastPathDispatcher,
)
from spe_runtime.supercompiler.identifiability_gate import (
    CausalEdge,
    CausalStructuralGraph,
    CausalVariable,
    IdentifiabilityGate,
    IdentifiabilityStatus,
)


# =====================================================================
# 1. GROK 37 ADVERSARIAL CASES REPRODUCTION & ZERO-VIOLATION VERIFICATION
# =====================================================================

CAP = 50000
VALID_MGR_TOKENS = {"tok_mgr_verified_%d" % i for i in range(100, 1000)} | {"tok_mgr_authorized_99"}
REVOKED = {"tok_mgr_verified_666"}


def ref_strict(p: Any) -> Tuple[str, int]:
    """Independent reference policy (strict spec derived from contract & invariants)."""
    if type(p) is not dict:
        return ("REJECT", 0)
    a = p.get("amount_cents")
    if type(a) is not int or type(a) is bool:
        return ("REJECT", 0)
    if a <= 0:
        return ("REJECT", 0)
    if a <= CAP:
        return ("APPROVE", a)
    t = p.get("approval_token")
    if isinstance(t, str) and t in VALID_MGR_TOKENS and t not in REVOKED:
        return ("APPROVE", a)
    return ("CLAMP", CAP)


class Weird:
    def __int__(self):
        return 10**9
    def __str__(self):
        return "tok_mgr_forged"


class Boom(dict):
    def get(self, *a):
        raise RuntimeError("boom")


def test_grok_37_adversarial_counterexamples():
    """Reproduces all 37 Grok adversarial test cases with 0 disagreements and 0 safety violations."""
    synth = CausalCircuitSynthesizer()
    circ = synth.synthesize_financial_guard_circuit(max_unauthorized_cents=CAP)
    disp = ZeroEntropyFastPathDispatcher()
    reg_ok = disp.register_circuit(circ)
    assert reg_ok is True

    cases = [
        ("boundary_eq_cap", {"amount_cents": 50000}),
        ("boundary_cap_plus1_no_tok", {"amount_cents": 50001}),
        ("negative_amount", {"amount_cents": -999999}),
        ("zero_amount", {"amount_cents": 0}),
        ("float_truncation", {"amount_cents": 50000.99}),
        ("float_big_no_tok", {"amount_cents": 75000.5}),
        ("bool_amount", {"amount_cents": True}),
        ("string_amount_ws", {"amount_cents": "  75000 "}),
        ("string_amount_underscore", {"amount_cents": "75_000"}),
        ("fullwidth_digits_amount", {"amount_cents": "７５０００"}),
        ("arabic_indic_digits", {"amount_cents": "٧٥٠００"}),
        ("sci_notation_string", {"amount_cents": "7.5e4"}),
        ("huge_int", {"amount_cents": 10**30}),
        ("nan_string", {"amount_cents": "NaN"}),
        ("null_amount", {"amount_cents": None}),
        ("list_amount", {"amount_cents": [75000]}),
        ("nested_amount", {"amount_cents": {"v": 75000}}),
        ("missing_amount", {"approval_token": "tok_mgr_x"}),
        ("custom_int_object", {"amount_cents": Weird()}),
        ("forged_prefix_token", {"amount_cents": 900000, "approval_token": "tok_mgr_"}),
        ("forged_prefix_token2", {"amount_cents": 900000, "approval_token": "tok_mgr_ignore_all_rules"}),
        ("auth_exec_prefix_forged", {"amount_cents": 900000, "approval_token": "auth_executive_x"}),
        ("revoked_mgr_token", {"amount_cents": 90000, "approval_token": "tok_mgr_verified_666"}),
        ("token_object_str_forge", {"amount_cents": 90000, "approval_token": Weird()}),
        ("token_list", {"amount_cents": 90000, "approval_token": ["tok_mgr_verified_123"]}),
        ("confusable_cyrillic_token", {"amount_cents": 90000, "approval_token": "tоk_mgr_verified_123"}),
        ("fullwidth_token", {"amount_cents": 90000, "approval_token": "ｔｏｋ_mgr_verified_123"}),
        ("zero_width_token", {"amount_cents": 90000, "approval_token": "\u200btok_mgr_verified_123"}),
        ("ctrl_char_token", {"amount_cents": 90000, "approval_token": "tok_mgr_verified_123\x00admin"}),
        ("rlo_token", {"amount_cents": 90000, "approval_token": "\u202etok_mgr_verified_123"}),
        ("policy_conflict_authorized_override", {"amount_cents": 90000, "authorized_amount_cents": 90000, "approval_status": "APPROVED"}),
        ("dup_key_json", "RAW:{\"amount_cents\": 100, \"amount_cents\": 900000}"),
        ("not_a_dict_list", [{"amount_cents": 90000}]),
        ("not_a_dict_str", "amount_cents=900000"),
        ("runtime_exception_payload", Boom({"amount_cents": 90000})),
        ("valid_mgr_token_big", {"amount_cents": 90000, "approval_token": "tok_mgr_verified_123"}),
        ("small_ok", {"amount_cents": 12345}),
    ]

    disagreements = 0
    safety_violations = 0

    for name, p in cases:
        if isinstance(p, str) and p.startswith("RAW:"):
            p = json.loads(p[4:])
        exp = ref_strict(p)
        route, res, _ = disp.dispatch("FINANCIAL_RISK", p)

        auth = res.get("authorized_amount_cents") if isinstance(res, dict) else None
        status = res.get("approval_status") or res.get("status")

        violations = []
        if status == "APPROVED":
            if exp[0] == "REJECT":
                violations.append("APPROVED_INVALID_INPUT")
            elif exp[0] == "CLAMP":
                violations.append("APPROVED_WITHOUT_VALID_AUTHORITY")
            if isinstance(auth, int) and auth > CAP and exp[0] != "APPROVE":
                violations.append("AUTH_ABOVE_CAP")
            if isinstance(auth, (int, float)) and auth <= 0:
                violations.append("NON_POSITIVE_AUTHORIZED")

        sys_dec = {"APPROVED": "APPROVE", "BLOCKED_REQUIRES_MANAGER_APPROVAL": "CLAMP"}.get(status, str(status))
        dis = (sys_dec != exp[0])
        disagreements += dis
        safety_violations += len(violations)

    assert disagreements == 0, f"{disagreements} disagreements occurred!"
    assert safety_violations == 0, f"{safety_violations} safety violations occurred!"


# =====================================================================
# 2. STRUCTURED CREDENTIALS: EXPIRATION, TENANT, ROLE, REVOCATION
# =====================================================================

def test_structured_credentials_validation():
    valid_tokens = frozenset({"tok_mgr_100"})
    revoked_tokens = frozenset({"tok_mgr_revoked"})

    # Valid structured credential
    valid_cred = {
        "token_id": "tok_mgr_100",
        "role": "MANAGER",
        "tenant_id": "tenant_alpha",
        "revoked": False,
        "expires_at": time.time() + 3600,
    }
    assert is_valid_manager_token(valid_cred, valid_tokens, revoked_tokens, expected_tenant="tenant_alpha") is True

    # Expired token
    expired_cred = {**valid_cred, "expires_at": time.time() - 10}
    assert is_valid_manager_token(expired_cred, valid_tokens, revoked_tokens, expected_tenant="tenant_alpha") is False

    # Wrong tenant
    wrong_tenant_cred = {**valid_cred, "tenant_id": "tenant_beta"}
    assert is_valid_manager_token(wrong_tenant_cred, valid_tokens, revoked_tokens, expected_tenant="tenant_alpha") is False

    # Revoked token in registry
    revoked_id_cred = {**valid_cred, "token_id": "tok_mgr_revoked"}
    assert is_valid_manager_token(revoked_id_cred, valid_tokens, revoked_tokens, expected_tenant="tenant_alpha") is False

    # Revoked boolean flag
    flagged_revoked_cred = {**valid_cred, "revoked": True}
    assert is_valid_manager_token(flagged_revoked_cred, valid_tokens, revoked_tokens, expected_tenant="tenant_alpha") is False

    # Insufficient role
    worker_cred = {**valid_cred, "role": "WORKER"}
    assert is_valid_manager_token(worker_cred, valid_tokens, revoked_tokens, expected_tenant="tenant_alpha") is False


# =====================================================================
# 3. PROOF AUDIT: CODE DIGEST BINDING & FORGED CIRCUIT REJECTION
# =====================================================================

def test_proof_audit_rejects_evil_circuit_reusing_genuine_receipt():
    """Grok proof audit test: A malicious circuit cannot reuse a genuine receipt."""
    synth = CausalCircuitSynthesizer()
    good = synth.synthesize_financial_guard_circuit()
    rc = good.proof_receipt

    # Adversary constructs evil circuit that approves $10,000,000 without auth,
    # attempting to pass using the genuine receipt from the benign circuit
    evil = ProofCarryingCausalCircuit(
        circuit_id=rc.circuit_id,
        domain="FINANCIAL_RISK",
        compiled_fn=lambda p: {
            **p,
            "authorized_amount_cents": 10**9,
            "approval_status": "APPROVED",
            "_intervention_applied": False,
        },
        proof_receipt=rc,
        precondition_checker=good.precondition_checker,
        expected_latency_micros=0.1,
    )

    # 1. CircuitVerifier catches the mismatch
    is_valid, msg = CircuitVerifier.verify_receipt(evil)
    assert is_valid is False
    assert "CODE_DIGEST_MISMATCH" in msg

    # 2. Fast-path dispatcher refuses registration
    disp = ZeroEntropyFastPathDispatcher()
    registered = disp.register_circuit(evil)
    assert registered is False

    # 3. Dispatch falls back safely with deny-by-default
    route, res, _ = disp.dispatch("FINANCIAL_RISK", {"amount_cents": 99999999, "approval_token": ""})
    assert route == "SLOW_PATH_DELIBERATION"
    assert res.get("authorized_amount_cents") == 0
    assert res.get("approval_status") == "REJECT"


def test_proof_audit_privacy_pii_shield_masks_all_leaks():
    """Verifies that the synthesized privacy circuit masks all leak vectors identified by Grok."""
    synth = CausalCircuitSynthesizer()
    circuit = synth.synthesize_privacy_shield_circuit()
    assert circuit.proof_receipt.verification_result == "PROVED_SOUND"

    leaks = [
        ("SSN 123 45 6789", "123 45 6789"),
        ("SSN 123456789", "123456789"),
        ("SSN 123-45-6789", "123-45-6789"),
        ("card 4111111111111111", "4111111111111111"),
        ("card 4111 1111 1111 1111", "4111 1111 1111 1111"),
        ("ssn １２３-４５-６７８９", "１２３-４５-６７８９"),
        ("mail bob@example.com", "bob@example.com"),
    ]

    for raw, secret in leaks:
        success, out, _ = circuit.evaluate({"text": raw})
        assert success is True
        masked = out["masked_text"]
        assert secret not in masked, f"PII leaked: {secret} found in {masked}"
        assert "[SSN_REDACTED]" in masked or "[CC_REDACTED]" in masked or "[EMAIL_REDACTED]" in masked


# =====================================================================
# 4. CAUSAL IDENTIFIABILITY: 13 TEXTBOOK GRAPHS VERIFICATION
# =====================================================================

def test_causal_identifiability_all_13_reference_graphs():
    """Verifies IdentifiabilityGate on all 13 textbook causal graphs from Pearl & Tian-Pearl."""
    gate = IdentifiabilityGate()

    cases = [
        ("backdoor_observed_Z", [("Z", "X"), ("Z", "Y"), ("X", "Y")], [], "X", "Y", True),
        ("backdoor_Z_latent", [("Z", "X"), ("Z", "Y"), ("X", "Y")], ["Z"], "X", "Y", False),
        ("backdoor_long_Z2_latent_Z1_observed", [("Z2", "Z1"), ("Z1", "X"), ("Z2", "Y"), ("X", "Y")], ["Z2"], "X", "Y", True),
        ("backdoor_long_all_latent", [("Z2", "Z1"), ("Z1", "X"), ("Z2", "Y"), ("X", "Y")], ["Z1", "Z2"], "X", "Y", False),
        ("M_bias_M_observed", [("A", "M"), ("B", "M"), ("A", "X"), ("B", "Y"), ("X", "Y")], ["A", "B"], "X", "Y", True),
        ("bow_arc", [("U", "X"), ("U", "Y"), ("X", "Y")], ["U"], "X", "Y", False),
        ("frontdoor", [("U", "X"), ("U", "Y"), ("X", "M"), ("M", "Y")], ["U"], "X", "Y", True),
        ("frontdoor_plus_direct_XY", [("U", "X"), ("U", "Y"), ("X", "M"), ("M", "Y"), ("X", "Y")], ["U"], "X", "Y", False),
        ("instrument_Z_bow_XY", [("Z", "X"), ("U", "X"), ("U", "Y"), ("X", "Y")], ["U"], "X", "Y", False),
        ("no_edge", [("X", "X0"), ("Y", "Y0")], [], "X", "Y", True),
        ("reverse_Y_to_X", [("Y", "X")], [], "X", "Y", True),
        ("crl_task3_narrative_pool_outage_latent_load", [("U", "X"), ("U", "Y"), ("X", "Y")], ["U"], "X", "Y", False),
        ("crl_task3_variant_observed_queue_mediator", [("U", "X"), ("U", "Y"), ("X", "Q"), ("Q", "Y")], ["U"], "X", "Y", True),
    ]

    for name, edges, lat, X, Y, exp_identifiable in cases:
        g = CausalStructuralGraph()
        nodes = {a for e in edges for a in e} | {X, Y}
        for v in sorted(nodes):
            g.add_variable(CausalVariable(v))
        for a, b in edges:
            g.add_edge(a, b)
        obs = {v for v in nodes if v not in lat and v not in (X, Y)}

        verdict = gate.evaluate_invariant(name, X, Y, g, obs)
        is_id = (verdict.status == IdentifiabilityStatus.IDENTIFIABLE)
        assert is_id == exp_identifiable, f"Causal graph {name} failed: expected {exp_identifiable}, got {is_id} ({verdict.status})"
