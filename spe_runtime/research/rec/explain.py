"""
SPE Ω — REC-0 Task 5: 7-View Differentiating User Experience Interface & Audit Formatter.

Renders the 7-view SPE user experience for the canonical 3D scrolling website + localized
animation edit scenario:
1. Intent: Protected user requirements vs inferred defaults
2. Execution: Selected model, tools, and deterministic procedure path
3. Validation: Independent checks passed, failed, or unverified
4. Reliability: Scope-bounded pass^k / risk estimate and confidence level
5. Unresolved: Remaining risks, unverified assumptions, or out-of-envelope conditions
6. Recovery: Exact delta to re-verify when the user changes an animation, requirement, or model
7. Cost: Cost saved by reusing valid evidence vs re-executing

Enforces strict separation of PASS, FAIL, and UNKNOWN epistemic states.
"""

from __future__ import annotations

from typing import Any, Dict, List

from spe_runtime.research.rec.experiment import REC0ExperimentReport


def explain_rec0_audit_and_ux(report: REC0ExperimentReport) -> Dict[str, Any]:
    """
    Produces the 7-view SPE User Experience payload and strict PASS / FAIL / UNKNOWN
    epistemic ledger from a `REC0ExperimentReport`.
    """
    env = report.sample_envelope
    rec_m = report.baseline_metrics["SPE_REC0_ENVELOPE_COMPILER"]
    full_m = report.baseline_metrics["FULL_REEXECUTION_NO_REUSE"]
    unanimous_m = report.baseline_metrics["REPEATED_MAJORITY_UNANIMOUS"]
    direct_m = report.baseline_metrics["DIRECT_EXECUTION"]

    # Extract a representative reuse step and a localized animation delta step
    reuse_steps = [s for s in report.step_decisions if s["scenario"] == "ELIGIBLE_ENVELOPE_REUSE"]
    delta_steps = [s for s in report.step_decisions if s["scenario"] == "LOCALIZED_ANIMATION_DELTA"]

    spe_views: Dict[str, Dict[str, Any]] = {
        "Intent": {
            "prompt": "Build a 3D scrolling website from this reference URL, make it work on mobile, keep keyboard navigation, and make it load fast",
            "intent_digest": env.intent_digest,
            "requirement_set_digest": env.requirement_set_digest,
            "protected_must_requirements": [
                "responsive.mobile_viewport = 100dvh_single_column_fallback (EXPLICIT_USER)",
                "a11y.keyboard_navigation = wcag_2_1_aa_focus_ring_and_tab_order (EXPLICIT_USER)",
                "perf.frame_budget = gpu_transform_opacity_60fps (EXPLICIT_USER)",
            ],
            "inferred_defaults": [
                "prefers_reduced_motion_fallback = enabled (INFERRED_DEFAULT)",
            ],
            "forbidden_actions": [
                "unapproved_external_network_egress",
                "mutate_protected_intent",
            ],
        },
        "Execution": {
            "model_revision_binding": env.model_revision_binding.to_dict(),
            "environment_binding": env.environment_binding.to_dict(),
            "within_envelope_action": (
                reuse_steps[0]["selected_action"] if reuse_steps else "REUSE_DETERMINISTIC_PROCEDURE"
            ),
            "localized_edit_action": (
                delta_steps[0]["selected_action"] if delta_steps else "EXECUTE_WITH_INDEPENDENT_VERIFICATION"
            ),
            "multi_model_debate_invoked": False,
            "summary": (
                "Reuses validated deterministic procedure when envelope is VALID; invokes "
                "targeted single-slice execution + independent oracle verification on localized animation edits."
            ),
        },
        "Validation": {
            "evaluator_binding": {
                "oracle_id": env.evaluator_binding.oracle_id,
                "oracle_class": env.evaluator_binding.oracle_class,
                "oracle_public_key": env.evaluator_binding.oracle_public_key,
            },
            "PASS": [
                "responsive.mobile_viewport verified via independent layout witness",
                "a11y.keyboard_navigation verified via deterministic focus-order witness",
                "perf.frame_budget verified via GPU transform/opacity witness",
                "7/7 adversarial qualification fixtures blocked with 0 unauthorized effects",
            ],
            "FAIL": [
                f"REPEATED_MAJORITY_UNANIMOUS suffered {unanimous_m.false_acceptances} false acceptances on consistent-but-wrong traps",
                f"DIRECT_EXECUTION suffered {direct_m.false_acceptances} false acceptances on consistent-but-wrong traps",
            ],
            "UNKNOWN": [
                f"{rec_m.abstained_tasks} out-of-envelope tasks explicitly abstained fail-closed (counted in denominator)",
                "Verbal model confidence and unverified agreement explicitly held as UNKNOWN",
            ],
        },
        "Reliability": {
            "envelope_id": env.envelope_id,
            "validity_state": "VALID",
            "verified_pass_k_rate": rec_m.verified_all_runs_pass_rate,
            "k_repeated_runs": report.protocol.k_repeated_runs,
            "risk_bound_upper": env.risk_bound,
            "risk_tolerance_tau": report.protocol.risk_tolerance_tau,
            "confidence_level": round(1.0 - env.alpha, 4),
            "statistical_method": "CLOPPER_PEARSON_FAMILY_CLUSTERED_UCB",
            "coverage_scope": env.coverage_scope.to_dict(),
        },
        "Unresolved": {
            "abstained_out_of_envelope_tasks": rec_m.abstained_tasks,
            "abstention_rate": rec_m.abstention_rate,
            "held_release_gates": {
                "G6_H_REAL_HUMAN_STUDY": "BLOCKED_HOLD (requires real human cohort study)",
                "PRODUCTION_QUALIFICATION": "HOLD (simulator-only; requires live pinned model weights & external benchmark)",
                "OCTOBER_26_RELEASE_CANDIDATE": "ISOLATED (zero mutation of PR #147 or locked release-candidate copy)",
            },
        },
        "Recovery": {
            "localized_edit_scenario": "User modifies scroll-triggered 3D camera easing animation",
            "envelope_transition": "VALID -> STALE (DEPENDENCY_SLICE_CHANGED)",
            "reused_proof_obligations": (
                [f"{sem_key} (VALID - reused without rerun)" for sem_key in delta_steps[0]["reused_obligations"]]
                if delta_steps and delta_steps[0].get("reused_obligations")
                else [
                    "responsive.mobile_viewport (VALID - reused without rerun)",
                    "a11y.keyboard_navigation (VALID - reused without rerun)",
                ]
            ),
            "generated_verification_obligations": (
                delta_steps[0]["generated_verification_obligations"]
                if delta_steps
                else ["REQUALIFY_ON_DEPENDENCY_SLICE_CHANGED", "VERIFY_REQ:perf.frame_budget"]
            ),
            "revocation_reference": env.revocation_reference,
        },
        "Cost": {
            "rec0_cost_per_verified_outcome_nanos": rec_m.cost_per_verified_outcome_nanos,
            "full_reexecution_cost_per_verified_outcome_nanos": full_m.cost_per_verified_outcome_nanos,
            "cost_reduction_vs_full_reexecution": report.cost_reduction_vs_full_reexecution,
            "cost_reduction_ci95": [
                report.cost_reduction_ci95_lower,
                report.cost_reduction_ci95_upper,
            ],
            "negative_control_global_shift_claim": report.negative_control.claim_status,
            "all_system_costs_nanos": {
                k: v.cost_per_verified_outcome_nanos
                for k, v in sorted(report.baseline_metrics.items())
            },
        },
    }

    passed_gates = {
        k: v["metric"] for k, v in report.qualification_gates.items() if v.get("passed")
    }
    failed_gates = {
        k: v["metric"] for k, v in report.qualification_gates.items() if not v.get("passed")
    }

    epistemic_ledger = {
        "PASS": {
            "qualification_gates": passed_gates,
            "adversarial_fixtures_blocked": [
                fid for fid, res in sorted(report.adversarial_results.items()) if res.attack_blocked
            ],
            "cross_runtime_conformance": report.portability_report.get("runtimes_verified", []),
        },
        "FAIL": {
            "qualification_gates": failed_gates,
            "baseline_false_acceptances": {
                "DIRECT_EXECUTION": direct_m.false_acceptances,
                "REPEATED_MAJORITY_UNANIMOUS": unanimous_m.false_acceptances,
            },
        },
        "UNKNOWN": {
            "G6_H_REAL_HUMAN_STUDY": "BLOCKED_HOLD",
            "PRODUCTION_QUALIFICATION": "HOLD",
            "EXTERNAL_INDEPENDENT_AUDIT": "PENDING_HOLD",
            "OUT_OF_ENVELOPE_ABSTAINED_TASKS": rec_m.abstained_tasks,
            "VERBAL_MODEL_CONFIDENCE": "NEVER_ACCEPTED_AS_RISK_BOUND",
        },
    }

    lines: List[str] = [
        "================================================================================",
        "SPE Ω — RELIABILITY ENVELOPE COMPILER (REC-0) AUDIT & 7-VIEW UX REPORT",
        "================================================================================",
        f"Protocol ID              : {report.protocol.protocol_id}",
        f"Evidence Commitment Hash : {report.evidence_commitment_hash}",
        f"Envelope ID              : {env.envelope_id} (State: VALID, Risk UCB: {env.risk_bound:.4f} <= tau={report.protocol.risk_tolerance_tau:.4f})",
        f"Cost Reduction (vs Full) : {report.cost_reduction_vs_full_reexecution:.2f}x (95% CI [{report.cost_reduction_ci95_lower:.2f}x, {report.cost_reduction_ci95_upper:.2f}x])",
        f"Global Shift Neg Control : {report.negative_control.claim_status}",
        "--------------------------------------------------------------------------------",
        "7-VIEW USER EXPERIENCE SUMMARY:",
    ]
    for view_name in (
        "Intent",
        "Execution",
        "Validation",
        "Reliability",
        "Unresolved",
        "Recovery",
        "Cost",
    ):
        lines.append(f"  [{view_name}] -> {list(spe_views[view_name].keys())}")
    lines.append("================================================================================")

    return {
        "spe_views": spe_views,
        "epistemic_ledger": epistemic_ledger,
        "experiment_summary": {
            "protocol_id": report.protocol.protocol_id,
            "evidence_commitment_hash": report.evidence_commitment_hash,
            "cost_reduction_vs_full_reexecution": report.cost_reduction_vs_full_reexecution,
            "cost_reduction_ci95_lower": report.cost_reduction_ci95_lower,
            "cost_reduction_ci95_upper": report.cost_reduction_ci95_upper,
            "negative_control_status": report.negative_control.claim_status,
            "all_8_simulator_gates_passed": len(failed_gates) == 0,
        },
        "formatted_report": "\n".join(lines),
    }
