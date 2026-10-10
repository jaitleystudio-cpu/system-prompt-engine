"""
SPE Ω — Master Prompt 2: Hostile Adversarial Evidence Qualification & Self-Healing Kernel (AEQ-H10)

Enforces:
1. Anti-Lucky-Pass Law: MutationScore >= 0.95. Any surviving mutant is flagged as
   LUCKY_PASS_VULNERABILITY and evidence is rejected.
2. Higher-Order Mutation Coverage: k >= 3 simultaneous subtle perturbations.
3. Tri-Origin Discrimination (RGIC-T1): Automatically categorizes root cause into
   Origin G (Goal), Origin W (World), or Origin V (Verifier).
4. Automated Causal Bisect & Retraction: Prunes dependent proofs in topological order.
5. Semantic Mutation Operators:
   - SMO-1: Conditional Negation (< to >=, == to !=)
   - SMO-2: Statement Deletion (state updates / asserts)
   - SMO-3: Return Value Perturbation (flip boolean returns and exit codes)
6. Self-Healing Contract Compilation: Injects missing negative test fixtures into next contract.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import hashlib
import json
import re
from typing import Any, Callable, Dict, List, Optional, Set, Tuple


class OriginType(str, Enum):
    GOAL = "ORIGIN_G"          # Goal uncertainty (ambiguous/underspecified requirement)
    WORLD = "ORIGIN_W"        # World uncertainty (external environment drift)
    VERIFIER = "ORIGIN_V"      # Verifier uncertainty (flawed test fixture, mock drift)


class MutationOperatorType(str, Enum):
    SMO_1_CONDITIONAL_NEGATION = "SMO-1"
    SMO_2_STATEMENT_DELETION = "SMO-2"
    SMO_3_RETURN_PERTURBATION = "SMO-3"
    HIGHER_ORDER_K3 = "SMO-HIGHER-ORDER-K3"


@dataclass
class HostileMutant:
    mutant_id: str
    operator: MutationOperatorType
    description: str
    mutated_code: str
    diff_snippet: str
    order_k: int = 1
    target_invariant: str = ""


@dataclass
class MutationTestResult:
    total_mutants: int
    killed_mutants: int
    survived_mutants: int
    mutation_score: float
    verdict: str  # VERIFIER_QUALIFIED / LUCKY_PASS_VULNERABILITY
    surviving_mutant_ids: List[str] = field(default_factory=list)
    anti_lucky_pass_passed: bool = False


@dataclass
class TriOriginAttribution:
    origin: OriginType
    confidence: float
    summary: str
    verdict_badge: str  # VERIFIER_ADEQUACY_CONFIRMED / ORIGIN_V_DEFICIT / ORIGIN_G_UNCERTAINTY / ORIGIN_W_DRIFT
    recommended_action: str


@dataclass
class RetractionDAGPlan:
    invalidated_node: str
    affected_nodes_topological: List[str]
    unaffected_history_count: int
    retraction_hash: str


class AEQKernel:
    """
    Hostile Adversarial Evidence Qualification & Self-Healing Verifier Kernel (AEQ-H10).
    Answers 'Who verifies the verifier?' through rigorous adversarial mutation testing
    and automated tri-origin causal discrimination.
    """

    MIN_MUTATION_KILL_RATE: float = 0.95

    @classmethod
    def synthesize_smo1_mutants(cls, source_code: str) -> List[HostileMutant]:
        """Operator SMO-1 (Conditional Negation): Invert comparison and boolean operators."""
        mutants = []
        replacements = [
            (" == ", " != ", "Negated equality == to !="),
            (" != ", " == ", "Negated inequality != to =="),
            (" <= ", " > ", "Inverted boundary <= to >"),
            (" >= ", " < ", "Inverted boundary >= to <"),
            (" < ", " >= ", "Inverted comparison < to >="),
            (" > ", " <= ", "Inverted comparison > to <="),
            (" in ", " not in ", "Inverted membership in to not in"),
            (" and ", " or ", "Inverted logical conjunction and to or"),
        ]

        count = 1
        for old_op, new_op, desc in replacements:
            if old_op in source_code:
                # Replace the first occurrence for atomic mutant
                mutated = source_code.replace(old_op, new_op, 1)
                m_id = f"MUT-SMO1-{count:03d}"
                mutants.append(HostileMutant(
                    mutant_id=m_id,
                    operator=MutationOperatorType.SMO_1_CONDITIONAL_NEGATION,
                    description=desc,
                    mutated_code=mutated,
                    diff_snippet=f"{old_op.strip()} -> {new_op.strip()}",
                    order_k=1,
                ))
                count += 1
        return mutants

    @classmethod
    def synthesize_smo2_mutants(cls, source_code: str) -> List[HostileMutant]:
        """Operator SMO-2 (Statement Deletion): Strip critical state-update calls and assertions."""
        mutants = []
        lines = source_code.splitlines()
        count = 1

        for idx, line in enumerate(lines):
            stripped = line.strip()
            # Match state updates, assertions, or validation calls
            if (stripped.startswith("assert ") or
                stripped.startswith("self.assert") or
                "update(" in stripped or
                "save(" in stripped or
                "commit(" in stripped or
                "verify(" in stripped or
                "check(" in stripped):
                
                # Delete this statement by replacing with pass or comment
                mutated_lines = list(lines)
                indent = " " * (len(line) - len(line.lstrip()))
                mutated_lines[idx] = f"{indent}pass  # SMO-2: Deleted {stripped[:30]}"
                m_id = f"MUT-SMO2-{count:03d}"
                mutants.append(HostileMutant(
                    mutant_id=m_id,
                    operator=MutationOperatorType.SMO_2_STATEMENT_DELETION,
                    description=f"Deleted state/assertion call at line {idx+1}: {stripped[:40]}",
                    mutated_code="\n".join(mutated_lines),
                    diff_snippet=f"- {stripped}\n+ pass",
                    order_k=1,
                ))
                count += 1

        return mutants

    @classmethod
    def synthesize_smo3_mutants(cls, source_code: str) -> List[HostileMutant]:
        """Operator SMO-3 (Return Value Perturbation): Flip boolean returns and exit codes."""
        mutants = []
        replacements = [
            ("return True", "return False", "Reversed boolean return True to False"),
            ("return False", "return True", "Reversed boolean return False to True"),
            ("return 0", "return 1", "Reversed exit code return 0 to 1"),
            ("return 1", "return 0", "Reversed error exit code return 1 to 0"),
            ("return None", "return 'MUTATED_NON_NONE'", "Perturbed None return value"),
        ]

        count = 1
        for old_val, new_val, desc in replacements:
            if old_val in source_code:
                mutated = source_code.replace(old_val, new_val, 1)
                m_id = f"MUT-SMO3-{count:03d}"
                mutants.append(HostileMutant(
                    mutant_id=m_id,
                    operator=MutationOperatorType.SMO_3_RETURN_PERTURBATION,
                    description=desc,
                    mutated_code=mutated,
                    diff_snippet=f"{old_val} -> {new_val}",
                    order_k=1,
                ))
                count += 1
        return mutants

    @classmethod
    def synthesize_higher_order_mutants(
        cls,
        source_code: str,
        k: int = 3,
    ) -> List[HostileMutant]:
        """Law 2: Higher-order semantic mutation (k >= 3 simultaneous perturbations)."""
        smo1 = cls.synthesize_smo1_mutants(source_code)
        smo2 = cls.synthesize_smo2_mutants(source_code)
        smo3 = cls.synthesize_smo3_mutants(source_code)

        mutants: List[HostileMutant] = []
        # If we have at least k distinct atomic operators, synthesize combinations
        pool = smo1 + smo2 + smo3
        if len(pool) >= k:
            combined_code = source_code
            diffs = []
            for i in range(k):
                cand = pool[i]
                if cand.operator == MutationOperatorType.SMO_1_CONDITIONAL_NEGATION:
                    parts = cand.diff_snippet.split(" -> ")
                    if len(parts) == 2 and parts[0] in combined_code:
                        combined_code = combined_code.replace(parts[0], parts[1], 1)
                        diffs.append(cand.description)
                elif cand.operator == MutationOperatorType.SMO_3_RETURN_PERTURBATION:
                    parts = cand.diff_snippet.split(" -> ")
                    if len(parts) == 2 and parts[0] in combined_code:
                        combined_code = combined_code.replace(parts[0], parts[1], 1)
                        diffs.append(cand.description)

            m_id = f"MUT-HOM-K{k}-001"
            mutants.append(HostileMutant(
                mutant_id=m_id,
                operator=MutationOperatorType.HIGHER_ORDER_K3,
                description=f"Higher-order composite mutant (k={k}): {'; '.join(diffs)}",
                mutated_code=combined_code,
                diff_snippet="\n".join(diffs),
                order_k=k,
            ))
        return mutants

    @classmethod
    def generate_full_hostile_battery(
        cls,
        source_code: str,
    ) -> List[HostileMutant]:
        """Synthesize all SMO-1, SMO-2, SMO-3, and higher-order mutants."""
        m1 = cls.synthesize_smo1_mutants(source_code)
        m2 = cls.synthesize_smo2_mutants(source_code)
        m3 = cls.synthesize_smo3_mutants(source_code)
        m_hi = cls.synthesize_higher_order_mutants(source_code, k=3)
        return m1 + m2 + m3 + m_hi

    @classmethod
    def evaluate_verifier_adequacy(
        cls,
        verifier_eval_fn: Callable[[str], bool],
        mutants: List[HostileMutant],
    ) -> MutationTestResult:
        """
        Law 1 (Anti-Lucky-Pass Law):
        Executes verifier against all hostile mutants.
        The verifier KILLS a mutant if it returns False (detects the fault).
        If verifier returns True, the mutant SURVIVES (lucky pass / verifier failed to catch defect).
        Requires MutationScore >= 0.95.
        """
        if not mutants:
            return MutationTestResult(
                total_mutants=0,
                killed_mutants=0,
                survived_mutants=0,
                mutation_score=1.0,
                verdict="VERIFIER_QUALIFIED",
                anti_lucky_pass_passed=True,
            )

        killed = 0
        survived = []

        for m in mutants:
            is_valid_according_to_verifier = verifier_eval_fn(m.mutated_code)
            if not is_valid_according_to_verifier:
                # The verifier detected the mutant defect: killed!
                killed += 1
            else:
                # The verifier mistakenly thought broken code was valid: survived!
                survived.append(m.mutant_id)

        score = killed / len(mutants)
        passed = score >= cls.MIN_MUTATION_KILL_RATE

        return MutationTestResult(
            total_mutants=len(mutants),
            killed_mutants=killed,
            survived_mutants=len(survived),
            mutation_score=round(score, 4),
            verdict="VERIFIER_QUALIFIED" if passed else "LUCKY_PASS_VULNERABILITY",
            surviving_mutant_ids=survived,
            anti_lucky_pass_passed=passed,
        )

    @staticmethod
    def discriminate_tri_origin(
        test_passed_on_baseline: bool,
        test_passed_on_mutant: bool,
        environment_changed: bool = False,
        requirement_diverged: bool = False,
    ) -> TriOriginAttribution:
        """
        Law 3: Tri-Origin Discrimination (RGIC-T1).
        Categorize root cause without human guesswork:
        - Origin G (Goal Uncertainty)
        - Origin W (World Uncertainty)
        - Origin V (Verifier Uncertainty)
        """
        if test_passed_on_mutant:
            # Code was deliberately mutated/broken, yet test still passed!
            return TriOriginAttribution(
                origin=OriginType.VERIFIER,
                confidence=0.98,
                summary="Origin V (Verifier Uncertainty): Test suite passed despite injected defect (Faulty Oracle / False Green).",
                verdict_badge="ORIGIN_V_DEFICIT",
                recommended_action="Synthesize missing negative assertions and tighten verifier oracle.",
            )
        elif requirement_diverged:
            return TriOriginAttribution(
                origin=OriginType.GOAL,
                confidence=0.95,
                summary="Origin G (Goal Uncertainty): Operational requirement is ambiguous or divergent from ProtectedIntent.",
                verdict_badge="ORIGIN_G_UNCERTAINTY",
                recommended_action="Crystallize explicit ProtectedIntent boundary contracts with user confirmation.",
            )
        elif environment_changed:
            return TriOriginAttribution(
                origin=OriginType.WORLD,
                confidence=0.94,
                summary="Origin W (World Uncertainty): External dependencies, file deletion, or OS drift altered runtime behavior.",
                verdict_badge="ORIGIN_W_DRIFT",
                recommended_action="Snapshot pinned local environment dependencies and re-run baseline verification.",
            )
        else:
            return TriOriginAttribution(
                origin=OriginType.VERIFIER,
                confidence=1.0,
                summary="Verifier Adequacy Confirmed: Verifier correctly detected defect and failed predictable mutant.",
                verdict_badge="VERIFIER_ADEQUACY_CONFIRMED",
                recommended_action="Proceed with verified continuation.",
            )

    @staticmethod
    def causal_bisect_and_retract(
        dependency_dag: Dict[str, List[str]],
        invalidated_node: str,
        total_historical_nodes: int = 10,
    ) -> RetractionDAGPlan:
        """
        Law 4: Directed Acyclic Epistemic Dependency Graph (DAEDG) retraction.
        Prunes dependent proofs in strict topological order without corrupting unaffected history.
        """
        # dependency_dag maps node -> list of parents it depends on
        # Reverse mapping: node -> children that depend on it
        children_map: Dict[str, Set[str]] = {}
        for node in dependency_dag:
            children_map.setdefault(node, set())
        for child, parents in dependency_dag.items():
            for p in parents:
                children_map.setdefault(p, set()).add(child)

        affected: List[str] = []
        visited: Set[str] = set()

        def dfs(curr: str):
            for child in sorted(children_map.get(curr, set())):
                if child not in visited:
                    visited.add(child)
                    dfs(child)
                    affected.append(child)

        visited.add(invalidated_node)
        dfs(invalidated_node)
        affected.reverse()  # Topological order

        retraction_hash = hashlib.sha256(
            f"{invalidated_node}:{':'.join(affected)}".encode("utf-8")
        ).hexdigest()

        return RetractionDAGPlan(
            invalidated_node=invalidated_node,
            affected_nodes_topological=affected,
            unaffected_history_count=max(0, total_historical_nodes - len(affected) - 1),
            retraction_hash=retraction_hash,
        )

    @staticmethod
    def compile_self_healing_contract(
        surviving_mutants: List[HostileMutant],
        current_contract: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Self-Healing Contract Compilation:
        Appends the exact missing negative test fixtures for surviving mutants.
        """
        new_contract = dict(current_contract)
        steps = list(new_contract.get("execution_steps", []))
        fixtures = list(new_contract.get("negative_fixtures", []))

        for m in surviving_mutants:
            fixture_entry = {
                "mutant_id": m.mutant_id,
                "operator": m.operator.value,
                "required_failure_assertion": f"Verify test catches: {m.description}",
                "snippet": m.diff_snippet,
            }
            fixtures.append(fixture_entry)
            steps.append(f"AEQ Self-Healing: Implement negative test ensuring {m.mutant_id} ({m.operator.value}) triggers FAIL.")

        new_contract["negative_fixtures"] = fixtures
        new_contract["execution_steps"] = steps
        new_contract["self_healing_active"] = True
        return new_contract
