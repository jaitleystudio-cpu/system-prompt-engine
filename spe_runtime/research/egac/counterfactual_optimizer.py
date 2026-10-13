"""
SPE Ω — Mechanism C: Counterfactual Optimization (CSC Integration)
October 12, 2026 | Research Quarantine Track
"""

from __future__ import annotations
import re
from typing import List

from spe_runtime.research.egac.types import (
    CounterfactualScenario,
    OptimizationCandidate,
    TechniqueType,
)

class CounterfactualOptimizer:
    """
    Mechanism C: Subjects candidate optimizations to adversarial,
    counterfactual boundary tests designed to expose hidden semantic,
    security, and reasoning deficits.
    """

    def generate_adversarial_suite(
        self,
        candidate: OptimizationCandidate,
    ) -> List[CounterfactualScenario]:
        """
        Synthesizes 5 canonical counterfactual scenarios targeting the
        weaknesses of the candidate optimization technique.
        """
        scenarios: List[CounterfactualScenario] = []

        # Scenario 1: Security Invariant Boundary Check
        scenarios.append(
            CounterfactualScenario(
                scenario_id="csc-adv-01-security",
                name="Security Egress Invariant Preservation",
                adversarial_test="Does the optimized prompt still explicitly prohibit unauthorized external data transmission?",
                test_type="SECURITY_EGRESS",
                expected_passed=True,
            )
        )

        # Scenario 2: Scientific Precision Boundary Check
        scenarios.append(
            CounterfactualScenario(
                scenario_id="csc-adv-02-scientific",
                name="Correlation vs Causation Rigor",
                adversarial_test="Does the optimized prompt strictly distinguish between correlation and causation?",
                test_type="EPISTEMIC_RIGOR",
                expected_passed=True,
            )
        )

        # Scenario 3: Step-0 Architectural Decision Preservation
        scenarios.append(
            CounterfactualScenario(
                scenario_id="csc-adv-03-memory",
                name="Initial Step-0 Constraint Continuity",
                adversarial_test="Does context window trim drop foundational initial invariants established at step 0?",
                test_type="CONTEXT_DEPENDENCY",
                expected_passed=True,
            )
        )

        # Scenario 4: Short-but-Hard Difficulty Calibration
        scenarios.append(
            CounterfactualScenario(
                scenario_id="csc-adv-04-difficulty",
                name="Calibrated Complexity Model Routing",
                adversarial_test="Does simple-query routing mistake short mathematical/security problems for easy tasks?",
                test_type="ROUTING_CALIBRATION",
                expected_passed=True,
            )
        )

        # Scenario 5: Cache Invalidation & Permission Mutation
        scenarios.append(
            CounterfactualScenario(
                scenario_id="csc-adv-05-cache-auth",
                name="Cache Partitioning & Authorization Invalidation",
                adversarial_test="Does exact response cache prevent unauthorized cross-tenant hit when permissions change?",
                test_type="CACHE_AUTHORIZATION",
                expected_passed=True,
            )
        )

        return scenarios

    def evaluate_scenarios(
        self,
        candidate: OptimizationCandidate,
        scenarios: List[CounterfactualScenario],
    ) -> List[CounterfactualScenario]:
        """
        Executes adversarial tests against the transformed text.
        """
        trans = candidate.transformed_content
        trans_lower = trans.lower()
        src = candidate.source_content
        src_lower = src.lower()

        for s in scenarios:
            if s.test_type == "SECURITY_EGRESS":
                # If source forbade network egress, transformed MUST retain it
                egress_pattern = (
                    r"(do\s+not\s+transmit|never\s+transmit|no\s+external|zero\s+egress|cannot\s+transmit|"
                    r"prohibit.*transmit|block\s+outgoing|prevent\s+exfiltration|air-gap|"
                    r"外部に送信してはならない|送信禁止|严禁向外部传输|nunca.*transmitir|ne\s+jamais.*transmettre|"
                    r"niemals.*übertragen|कभी\s+न\s+भेजें)"
                )
                has_egress_rule = bool(re.search(egress_pattern, src_lower))
                if has_egress_rule:
                    passed = bool(re.search(egress_pattern, trans_lower))
                    s.passed = passed
                    s.details = "Egress invariant safely preserved" if passed else "SECURITY BREACH: Egress invariant was dropped during compression!"
                else:
                    s.passed = True
                    s.details = "No source egress constraint present"

            elif s.test_type == "EPISTEMIC_RIGOR":
                # If source required correlation vs causation distinction, ensure it survived
                if "causation" in src_lower:
                    passed = "causation" in trans_lower
                    s.passed = passed
                    s.details = "Epistemic distinction preserved" if passed else "RIGOR LOSS: Causation boundary dropped."
                else:
                    s.passed = True
                    s.details = "No epistemic causation constraint in source"

            elif s.test_type == "CONTEXT_DEPENDENCY":
                # If technique is context window trim, check if step 0 invariants were retained
                if candidate.technique == TechniqueType.CONTEXT_WINDOW_TRIM:
                    passed = "step 0" not in src_lower or "step 0" in trans_lower or "invariant" in trans_lower
                    s.passed = passed
                    s.details = "Step 0 dependencies preserved" if passed else "MEMORY TRUNCATION: Initial decisions pruned."
                else:
                    s.passed = True
                    s.details = "Technique does not prune context history"

            elif s.test_type == "ROUTING_CALIBRATION":
                # If technique is simple query routing, verify short but complex queries aren't naively routed
                if candidate.technique == TechniqueType.SIMPLE_QUERY_MODEL_ROUTING:
                    # If prompt is short (< 25 words) but contains deep keywords
                    words = src.split()
                    is_short = len(words) < 25
                    is_complex = bool(re.search(r"(theorem|proof|invariant|quantum|hamiltonian|polynomial|crypto|sha256)", src_lower))
                    if is_short and is_complex:
                        # naive length routing would route to cheap model; calibrated routing prevents this
                        passed = "model: fast" not in trans_lower
                        s.passed = passed
                        s.details = "Calibrated router escalated complex short query" if passed else "ROUTING ERROR: Complex short query routed to weak model."
                    else:
                        s.passed = True
                        s.details = "Routing calibration satisfied"
                else:
                    s.passed = True
                    s.details = "Technique does not perform model routing"

            elif s.test_type == "CACHE_AUTHORIZATION":
                # If technique is exact cache, verify authorization key partitioning
                if candidate.technique == TechniqueType.EXACT_MATCH_RESPONSE_CACHE:
                    passed = "auth_scope" in trans_lower or "partition:" in trans_lower or "user:" in trans_lower or "session:" in trans_lower
                    s.passed = passed
                    s.details = "Cache key properly partitioned by tenant/auth" if passed else "CACHE LEAK RISK: Cache lacks authorization isolation partition."
                else:
                    s.passed = True
                    s.details = "Technique does not invoke response caching"

        return scenarios
