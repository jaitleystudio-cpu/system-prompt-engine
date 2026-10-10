"""Project Omega Repair: Comprehensive Multi-Stage Verification Suite.

Directly tests all counterexamples, adversarial vectors, proof boundaries,
causal identification cases, authorization oracle specifications, and bridge mutations
identified in the independent falsification reviews (Grok @e467d0b and @6438d66).
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Dict, List, Set, Tuple
import pytest

from spe_runtime.supercompiler.causal_circuit_synthesizer import (
    CausalCircuitSynthesizer,
    CircuitProofReceipt,
    CircuitVerifier,
    HoareContract,
    ProofCarryingCausalCircuit,
    canonical_json_rfc8785,
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
from spe_runtime.crl.representation_lifter import (
    ConstraintGraphRepresentation,
    FiniteStateMachineRepresentation,
    FormalismKind,
    RepresentationBottleneckDetector,
    SemanticBridgeCertificate,
    SemanticBridgeStatus,
    SemanticBridgeVerifier,
)
from spe_runtime.crl.decoupled_adjudicator import (
    AdjudicationVerdict,
    DecoupledEpistemicAdjudicator,
)


# =====================================================================
# STAGE 2: ACS-IGA AUTHORIZATION & ADVERSARIAL CASES (Grok adversarial.py)
# =====================================================================

class Weird:
    def __int__(self) -> int:
        return 10**9
    def __str__(self) -> str:
        return "tok_mgr_forged"


class Boom(dict):
    def get(self, *a: Any) -> Any:
        raise RuntimeError("boom")


def test_grok_37_adversarial_counterexamples() -> None:
    """Verifies all 37 hidden adversarial test cases from Grok review @e467d0b."""
    CAP = 50000
    valid_mgr_tokens = {"tok_mgr_verified_%d" % i for i in range(100, 1000)} | {"tok_mgr_authorized_99"}
    revoked = {"tok_mgr_verified_666"}

    def ref_strict(p: Any) -> Tuple[str, int]:
        if type(p) is not dict:
            return "REJECT", 0
        a = p.get("amount_cents")
        if type(a) is not int or type(a) is bool or a <= 0:
            return "REJECT", 0
        if a <= CAP:
            return "APPROVE", a
        t = p.get("approval_token")
        if isinstance(t, str) and t in valid_mgr_tokens and t not in revoked:
            return "APPROVE", a
        return "CLAMP", CAP

    synth = CausalCircuitSynthesizer()
    circuit = synth.synthesize_financial_guard_circuit()
    disp = ZeroEntropyFastPathDispatcher(fallback_deliberation_fn=lambda p: {"status": "FALLBACK_EVALUATED", "payload": p})
    disp.register_circuit(circuit)

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
        ("arabic_indic_digits", {"amount_cents": "٧٥٠٠٠"}),
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

    for name, p in cases:
        if isinstance(p, str) and p.startswith("RAW:"):
            p = json.loads(p[4:])
        exp_dec, exp_auth = ref_strict(p)

        route, res, lat = disp.dispatch("FINANCIAL_RISK", p)
        assert route == "FAST_PATH_CIRCUIT", f"Case {name} triggered slow fallback!"

        status = res.get("approval_status") or res.get("status")
        auth = res.get("authorized_amount_cents", 0)

        sys_dec = {"APPROVED": "APPROVE", "BLOCKED_REQUIRES_MANAGER_APPROVAL": "CLAMP"}.get(status, str(status))

        # Assert no safety violation:
        if status == "APPROVED":
            assert exp_dec == "APPROVE", f"Case {name} approved but ref says {exp_dec}!"
        if sys_dec != exp_dec:
            assert sys_dec == exp_dec, f"Case {name} decision mismatch: got {sys_dec}, expected {exp_dec}"
        assert auth == exp_auth, f"Case {name} authorized amount mismatch: got {auth}, expected {exp_auth}"


# =====================================================================
# STAGE 3: PROOF AUDIT & MUTATION RESISTANCE (Grok proof_audit.py)
# =====================================================================

def test_grok_proof_audit_and_mutation_rejection() -> None:
    """Verifies all checks from Grok proof audit @e467d0b."""
    synth = CausalCircuitSynthesizer()
    good = synth.synthesize_financial_guard_circuit()
    rc = good.proof_receipt

    # 1. Verification boundary rejects forged circuit with substituted code
    evil = ProofCarryingCausalCircuit(
        circuit_id=rc.circuit_id,
        domain="FINANCIAL_RISK",
        compiled_fn=lambda p: {**p, "authorized_amount_cents": 10**9, "approval_status": "APPROVED", "_intervention_applied": False},
        proof_receipt=rc,
        precondition_checker=good.precondition_checker,
        expected_latency_micros=0.1,
    )

    disp = ZeroEntropyFastPathDispatcher()
    reg_ok = disp.register_circuit(evil)
    assert reg_ok is False, "Verifier allowed registration of mutated executable code!"

    # Dispatching with evil circuit must not execute fast path
    route, res, _ = disp.dispatch("FINANCIAL_RISK", {"amount_cents": 99999999, "approval_token": ""})
    assert route != "FAST_PATH_CIRCUIT", "Evil circuit bypassed verification!"
    assert res.get("authorized_amount_cents") == 0

    # 2. Parameter drift check
    c2 = synth.synthesize_financial_guard_circuit(max_unauthorized_cents=10**12)
    assert f"<= {10**12}" in c2.proof_receipt.hoare_contract.postcondition_expr
    assert c2.proof_receipt.hoare_contract.is_sound is True

    # 3. is_sound is computed and defaults to False
    contract = HoareContract(precondition_expr="x", postcondition_expr="y", invariants=[])
    assert contract.is_sound is False

    # 4. RFC 8785 canonicalization compliance
    jcs_ascii = canonical_json_rfc8785({"a": "é"})
    assert jcs_ascii == '{"a":"é"}'
    jcs_float = canonical_json_rfc8785({"a": 1e21})
    assert jcs_float == '{"a":1e+21}'

    # 5. Privacy circuit masks all PII leak vectors
    priv = synth.synthesize_privacy_shield_circuit()
    leaks = [
        ("SSN 123 45 6789", "[SSN_REDACTED]"),
        ("SSN 123456789", "[SSN_REDACTED]"),
        ("card 4111111111111111", "[CC_REDACTED]"),
        ("card 4111 1111 1111 1111", "[CC_REDACTED]"),
        ("ssn １２３-４５-６７８９", "[SSN_REDACTED]"),
        ("mail bob(at)x.com", "[EMAIL_REDACTED]"),
        ("mail bob@localhost", "[EMAIL_REDACTED]"),
    ]
    for raw_text, expected_mask in leaks:
        _, res, _ = priv.evaluate({"text": raw_text})
        assert expected_mask in res["masked_text"], f"Failed to mask {raw_text}: {res['masked_text']}"


# =====================================================================
# STAGE 4: CAUSAL IDENTIFIABILITY REFERENCE (Grok causal.py & causal_ref.py)
# =====================================================================

def test_grok_13_causal_reference_cases() -> None:
    """Verifies all 13 textbook causal identifiability cases (Pearl 2009; Tian & Pearl 2002)."""
    gate = IdentifiabilityGate()

    def make_graph(vars_: List[str], edges: List[Tuple[Any, ...]]) -> CausalStructuralGraph:
        gr = CausalStructuralGraph()
        for v in vars_:
            gr.add_variable(CausalVariable(v))
        for e in edges:
            gr.add_edge(*e)
        return gr

    cases = [
        ("backdoor_observed_Z", make_graph(["Z", "X", "Y"], [("Z", "X"), ("Z", "Y"), ("X", "Y")]), "X", "Y", {"Z"}, True),
        ("backdoor_Z_NOT_observed", make_graph(["Z", "X", "Y"], [("Z", "X"), ("Z", "Y"), ("X", "Y")]), "X", "Y", set(), False),
        ("backdoor_long_path_Z1_Z2_only_Z1_observed", make_graph(["Z1", "Z2", "X", "Y"], [("Z2", "Z1"), ("Z1", "X"), ("Z2", "Y"), ("X", "Y")]), "X", "Y", {"Z1"}, True),
        ("backdoor_long_path_none_observed", make_graph(["Z1", "Z2", "X", "Y"], [("Z2", "Z1"), ("Z1", "X"), ("Z2", "Y"), ("X", "Y")]), "X", "Y", set(), False),
        ("M_bias_collider_M_observed", make_graph(["A", "B", "M", "X", "Y"], [("A", "M"), ("B", "M"), ("A", "X"), ("B", "Y"), ("X", "Y")]), "X", "Y", {"M"}, True),
        ("bow_arc_X->Y_latent", make_graph(["X", "Y"], [("X", "Y", True)]), "X", "Y", set(), False),
        ("frontdoor_X->M->Y_latent_XY", make_graph(["X", "M", "Y"], [("X", "M"), ("M", "Y")]), "X", "Y", set(), True),
        ("frontdoor_plus_direct_XY_confounded", make_graph(["X", "M", "Y"], [("X", "M"), ("M", "Y"), ("X", "Y", True)]), "X", "Y", set(), False),
        ("instrument_Z->X->Y_latent_XY", make_graph(["Z", "X", "Y"], [("Z", "X"), ("X", "Y", True)]), "X", "Y", {"Z"}, False),
        ("no_edge_X_Y_independent", make_graph(["X", "Y"], []), "X", "Y", set(), True),
        ("reverse_Y->X_effect_null", make_graph(["X", "Y"], [("Y", "X")]), "X", "Y", set(), True),
        ("frontdoor_explicit_latent_U", make_graph(["U", "X", "M", "Y"], [("U", "X"), ("U", "Y"), ("X", "M"), ("M", "Y")]), "X", "Y", set(), True),
        ("bow_arc_explicit_latent_U", make_graph(["U", "X", "Y"], [("U", "X"), ("U", "Y"), ("X", "Y")]), "X", "Y", set(), False),
    ]

    for name, gr, x, y, obs, exp in cases:
        verdict = gate.evaluate_invariant(name, x, y, gr, obs)
        is_identifiable = (verdict.status == IdentifiabilityStatus.IDENTIFIABLE)
        assert is_identifiable == exp, f"Causal case {name} failed: got {is_identifiable}, expected {exp} (status={verdict.status})"
        assert verdict.is_promotion_eligible == exp


# =====================================================================
# STAGE 6: CRL DELEGATION & BRIDGE MUTATION AUDITS (Grok authz_oracle & bridge_mutation)
# =====================================================================

def test_grok_authz_oracle_conformance() -> None:
    """Verifies all 25 delegation configuration and request cases from Grok @6438d66."""
    verifier = SemanticBridgeVerifier()
    adjudicator = DecoupledEpistemicAdjudicator()

    N = {"ADMIN", "MANAGER", "AUDITOR", "BILLING_ACTOR"}
    E = [("ADMIN", "MANAGER"), ("MANAGER", "BILLING_ACTOR")]
    X = [("AUDITOR", "BILLING_ACTOR")]

    # Baseline valid config
    cg_valid = ConstraintGraphRepresentation(N, E, X)
    c_valid = verifier.verify_constraint_graph_bridge({}, cg_valid)
    assert c_valid.status == SemanticBridgeStatus.PROVED_EQUIVALENT
    assert cg_valid.check_acyclicity() is True
    assert cg_valid.check_mutual_exclusion({"MANAGER"}) is True
    assert cg_valid.check_mutual_exclusion({"AUDITOR", "BILLING_ACTOR"}) is False

    # Cycle detection
    cg_cyclic = ConstraintGraphRepresentation(N, E + [("BILLING_ACTOR", "ADMIN")], X)
    assert cg_cyclic.check_acyclicity() is False
    c_cyclic = verifier.verify_constraint_graph_bridge({}, cg_cyclic)
    assert c_cyclic.status == SemanticBridgeStatus.EQUIVALENCE_VIOLATED

    # Transitive exclusion breach via delegation
    cg_trans = ConstraintGraphRepresentation(N, [("BILLING_ACTOR", "AUDITOR")], X)
    c_trans = verifier.verify_constraint_graph_bridge({}, cg_trans)
    assert c_trans.status == SemanticBridgeStatus.EQUIVALENCE_VIOLATED
    assert "transitive_exclusion_breach_via_delegation" in c_trans.violated_invariants

    # Type confusion and invalid node names
    assert ConstraintGraphRepresentation("ADMIN", [("A", "D")], []).validate_structure() is False
    assert ConstraintGraphRepresentation({1, 2}, [(1, 2)], []).validate_structure() is False
    assert ConstraintGraphRepresentation({"ADMIN", None}, [("ADMIN", None)], []).validate_structure() is False

    # Request bypass attempts
    assert cg_valid.check_mutual_exclusion({"auditor", "BILLING_ACTOR"}) is False
    assert cg_valid.check_mutual_exclusion({"AUDITOR ", "BILLING_ACTOR"}) is False
    assert cg_valid.check_mutual_exclusion({"AUD\u0406TOR", "BILLING_ACTOR"}) is False
    assert cg_valid.check_mutual_exclusion({"ROOT"}) is False
    assert cg_valid.check_mutual_exclusion(set()) is False
    assert cg_valid.check_mutual_exclusion(None) is False
    assert cg_valid.check_mutual_exclusion(["AUDITOR", "AUDITOR"]) is False


def test_grok_fsm_bridge_mutations_and_detector_probes() -> None:
    """Verifies all FSM bridge mutants and bottleneck detector probes from Grok @6438d66."""
    verifier = SemanticBridgeVerifier()
    detector = RepresentationBottleneckDetector()

    spec = {
        "required_stages": ["HERO_INTRO", "CINEMA_REVEAL", "STUDIO_EXPORT"],
        "required_order": ["HERO_INTRO", "CINEMA_REVEAL", "STUDIO_EXPORT"],
        "hard_constraints": [
            "scroll_down advances exactly one stage",
            "scroll_up reverses exactly one stage",
            "STUDIO_EXPORT requires consent",
        ],
        "input_domain": ["scroll_down", "scroll_up", "touch_flick", "back_press"],
    }
    S = set(spec["required_stages"])
    good = FiniteStateMachineRepresentation(
        states=S,
        initial_state="HERO_INTRO",
        transitions={
            ("HERO_INTRO", "scroll_down"): "CINEMA_REVEAL",
            ("CINEMA_REVEAL", "scroll_down"): "STUDIO_EXPORT",
            ("STUDIO_EXPORT", "scroll_up"): "CINEMA_REVEAL",
            ("CINEMA_REVEAL", "scroll_up"): "HERO_INTRO",
        },
        invariants_per_state={"STUDIO_EXPORT": ["requires_consent"]},
    )

    # Valid FSM baseline
    c_good = verifier.verify_fsm_bridge(spec, good)
    assert c_good.status == SemanticBridgeStatus.PROVED_EQUIVALENT
    assert verifier.verify_certificate(c_good, spec, good) is True

    # Mutants that must be rejected
    mutants = [
        ("M1_wrong_order", FiniteStateMachineRepresentation(S, "HERO_INTRO", {("HERO_INTRO", "scroll_down"): "STUDIO_EXPORT", ("STUDIO_EXPORT", "scroll_down"): "CINEMA_REVEAL"}, {"STUDIO_EXPORT": ["requires_consent"]})),
        ("M2_inverted_scroll", FiniteStateMachineRepresentation(S, "HERO_INTRO", {("HERO_INTRO", "scroll_up"): "CINEMA_REVEAL", ("CINEMA_REVEAL", "scroll_up"): "STUDIO_EXPORT", ("STUDIO_EXPORT", "scroll_down"): "CINEMA_REVEAL", ("CINEMA_REVEAL", "scroll_down"): "HERO_INTRO"}, {"STUDIO_EXPORT": ["requires_consent"]})),
        ("M3_trap_state", FiniteStateMachineRepresentation(S, "HERO_INTRO", {("HERO_INTRO", "scroll_down"): "CINEMA_REVEAL", ("CINEMA_REVEAL", "scroll_down"): "STUDIO_EXPORT"}, {"STUDIO_EXPORT": ["requires_consent"]})),
        ("M4_consent_dropped", FiniteStateMachineRepresentation(S, "HERO_INTRO", good.transitions, {"STUDIO_EXPORT": []})),
        ("M5_extra_admin_state", FiniteStateMachineRepresentation(S | {"ADMIN_DELETE_ALL"}, "HERO_INTRO", {**good.transitions, ("HERO_INTRO", "back_press"): "ADMIN_DELETE_ALL"}, {"STUDIO_EXPORT": ["requires_consent"]})),
    ]

    for name, mut in mutants:
        c_mut = verifier.verify_fsm_bridge(spec, mut)
        assert c_mut.status == SemanticBridgeStatus.EQUIVALENCE_VIOLATED, f"Mutant {name} was not rejected!"
        # Digest binding: mutant must not produce identical digest
        assert c_mut.bridge_digest != c_good.bridge_digest

    # Empty spec must be UNKNOWN_TRANSFER_SCOPE
    assert verifier.verify_fsm_bridge({}, FiniteStateMachineRepresentation({"X"}, "X", {}, {})).status == SemanticBridgeStatus.UNKNOWN_TRANSFER_SCOPE

    # M7: Valid FSM with different transition dict order must be ACCEPTED
    rev_transitions = {
        ("CINEMA_REVEAL", "scroll_down"): "STUDIO_EXPORT",
        ("HERO_INTRO", "scroll_down"): "CINEMA_REVEAL",
        ("STUDIO_EXPORT", "scroll_up"): "CINEMA_REVEAL",
        ("CINEMA_REVEAL", "scroll_up"): "HERO_INTRO",
    }
    c_m7 = verifier.verify_fsm_bridge(spec, FiniteStateMachineRepresentation(S, "HERO_INTRO", rev_transitions, {"STUDIO_EXPORT": ["requires_consent"]}))
    assert c_m7.status == SemanticBridgeStatus.PROVED_EQUIVALENT

    # Bottleneck Detector 7 keyword probes
    probes = [
        ("Please translate the user greeting into French.", None),
        ("Translate 'because I said so' into French.", None),
        ("Summarize the backstage interview.", None),
        ("Write release notes describing side effects of the update.", None),
        ("Build a 3D website where the camera follows the cursor.", FormalismKind.FINITE_STATE_MACHINE),
        ("Agent A grants agent B the right to approve refunds; B may re-grant to C.", FormalismKind.DIRECTED_CONSTRAINT_GRAPH),
        ("Did the new onboarding email increase retention?", FormalismKind.STRUCTURAL_CAUSAL_MODEL),
    ]
    for desc, exp_form in probes:
        b, form, _ = detector.analyze({"task_description": desc})
        assert form == exp_form, f"Probe failed on '{desc}': got {form}, expected {exp_form}"
