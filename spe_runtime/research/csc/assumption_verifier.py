"""
SPE Ω — Counterfactual Specification Closure (CSC) Assumption Verifier & Oracle Qualifier.
Implements:
- Mechanism B: Assumption-Sensitive Verification (Cryptographic Provenance Binding).
- Mechanism C: Independently Qualified Verification Oracles (Metamorphic Relations & AST Invariants).
"""

from __future__ import annotations

import ast
from typing import Dict, Any, List, Optional, Callable, Tuple
from dataclasses import dataclass, field

from .models import (
    ProvenanceRecord,
    OracleStatus,
    QualificationMethod,
    DistinguishingProbe,
)


class AssumptionVerifier:
    """
    Assumption-Sensitive Verifier (Mechanism B).
    Ensures that verified claims are cryptographically anchored to their exact
    environment, toolchain, source commit, and policy snapshot.
    Prevents stale proofs from degrading software reliability under repeated revision.
    """

    @staticmethod
    def verify_provenance(
        bound_provenance: ProvenanceRecord,
        current_source_commit: str,
        current_tool_version: str,
        current_env_profile: Dict[str, Any],
        current_policy_snapshot: Dict[str, Any],
    ) -> Tuple[bool, Optional[str]]:
        """
        Compares a bound ProvenanceRecord against the current environment state.
        Returns (is_valid, drift_reason).
        """
        if bound_provenance.source_commit != current_source_commit:
            return False, f"DRIFT:SOURCE_COMMIT (expected {bound_provenance.source_commit[:8]}, got {current_source_commit[:8]})"

        if bound_provenance.tool_version != current_tool_version:
            return False, f"DRIFT:TOOL_VERSION (expected {bound_provenance.tool_version}, got {current_tool_version})"

        if bound_provenance.env_profile != current_env_profile:
            return False, "DRIFT:ENV_PROFILE (operating environment or dependency drifted)"

        if bound_provenance.policy_snapshot != current_policy_snapshot:
            return False, "DRIFT:POLICY_SNAPSHOT (security, air-gap, or entitlement policy changed)"

        # Hash verification
        current_rec = ProvenanceRecord(
            source_commit=current_source_commit,
            tool_version=current_tool_version,
            env_profile=current_env_profile,
            policy_snapshot=current_policy_snapshot,
        )
        if bound_provenance.compute_provenance_digest() != current_rec.compute_provenance_digest():
            return False, "DRIFT:PROVENANCE_DIGEST_MISMATCH"

        return True, None

    @classmethod
    def verify_provenance_record(
        cls,
        bound_provenance: ProvenanceRecord,
        current_provenance: ProvenanceRecord,
    ) -> Tuple[bool, Optional[str]]:
        """Convenience method comparing two ProvenanceRecords."""
        return cls.verify_provenance(
            bound_provenance=bound_provenance,
            current_source_commit=current_provenance.source_commit,
            current_tool_version=current_provenance.tool_version,
            current_env_profile=current_provenance.env_profile,
            current_policy_snapshot=current_provenance.policy_snapshot,
        )


@dataclass
class MetamorphicRelation:
    """
    Formal Metamorphic Relation R(x, T(x), f(x), f(T(x))).
    Used to independently qualify oracles without needing ground-truth labels for all inputs.
    """
    name: str
    description: str
    input_transformation: Callable[[Any], Any]
    output_relation: Callable[[Any, Any], bool]  # (orig_out, trans_out) -> bool

    def check(
        self,
        oracle_fn: Callable[[Any], Any],
        test_inputs: List[Any],
    ) -> Tuple[bool, int, int]:
        """
        Evaluates the metamorphic relation across test_inputs.
        Returns (all_passed, pass_count, fail_count).
        """
        pass_count = 0
        fail_count = 0

        for inp in test_inputs:
            try:
                out_orig = oracle_fn(inp)
                transformed_inp = self.input_transformation(inp)
                out_transformed = oracle_fn(transformed_inp)

                if self.output_relation(out_orig, out_transformed):
                    pass_count += 1
                else:
                    fail_count += 1
            except Exception:
                fail_count += 1

        return (fail_count == 0 and pass_count > 0), pass_count, fail_count


class OracleQualifier:
    """
    Independent Oracle Qualifier (Mechanism C).
    Prevents self-generated test hallucination by requiring independent qualification
    via Metamorphic Relations, AST Structural Invariants, Reference Implementations, or Human Authority.
    """

    @staticmethod
    def qualify_via_metamorphic(
        oracle_fn: Callable[[Any], Any],
        relations: List[MetamorphicRelation],
        sample_inputs: List[Any],
    ) -> Tuple[OracleStatus, List[str]]:
        """
        Qualifies a candidate oracle using a suite of metamorphic relations.
        """
        if not relations:
            return OracleStatus.NOT_QUALIFIED, ["No metamorphic relations provided for qualification."]

        if not sample_inputs:
            return OracleStatus.NOT_QUALIFIED, ["No sample inputs provided for qualification."]

        failures: List[str] = []
        for rel in relations:
            passed, p_count, f_count = rel.check(oracle_fn, sample_inputs)
            if not passed:
                failures.append(f"Metamorphic relation '{rel.name}' failed ({f_count} failures on {len(sample_inputs)} inputs).")

        if failures:
            return OracleStatus.NOT_QUALIFIED, failures

        return OracleStatus.QUALIFIED, []

    @staticmethod
    def qualify_via_reference_implementation(
        candidate_oracle_fn: Callable[[Any], Any],
        reference_oracle_fn: Callable[[Any], Any],
        test_inputs: List[Any],
    ) -> Tuple[OracleStatus, List[str]]:
        """
        Qualifies a candidate oracle via differential testing against a trusted reference implementation.
        """
        if not test_inputs:
            return OracleStatus.NOT_QUALIFIED, ["No test inputs provided for reference differential check."]

        discrepancies: List[str] = []
        for inp in test_inputs:
            try:
                cand_out = candidate_oracle_fn(inp)
                ref_out = reference_oracle_fn(inp)
                if cand_out != ref_out:
                    discrepancies.append(
                        f"Discrepancy on input {inp!r}: candidate={cand_out!r} != reference={ref_out!r}"
                    )
            except Exception as e:
                discrepancies.append(f"Execution error on input {inp!r}: {e}")

        if discrepancies:
            return OracleStatus.NOT_QUALIFIED, discrepancies

        return OracleStatus.QUALIFIED, []

    @staticmethod
    def qualify_via_ast_invariants(
        source_code: str,
        invariant_checkers: List[Callable[[ast.AST], Tuple[bool, str]]],
    ) -> Tuple[OracleStatus, List[str]]:
        """
        Qualifies a candidate oracle or test implementation by verifying AST structural invariants.
        e.g., verifying absence of network socket calls, verifying deterministic control flow.
        """
        if not invariant_checkers:
            return OracleStatus.NOT_QUALIFIED, ["No AST invariant checkers provided for qualification."]

        try:
            tree = ast.parse(source_code)
        except SyntaxError as e:
            return OracleStatus.NOT_QUALIFIED, [f"AST parsing failed: {e}"]

        failures: List[str] = []
        for checker in invariant_checkers:
            passed, reason = checker(tree)
            if not passed:
                failures.append(f"AST Invariant violated: {reason}")

        if failures:
            return OracleStatus.NOT_QUALIFIED, failures

        return OracleStatus.QUALIFIED, []

    @staticmethod
    def qualify_via_human_authorization(
        auth_token: str,
        valid_authorization_tokens: List[str],
    ) -> Tuple[OracleStatus, Optional[str]]:
        """
        Qualifies an oracle via explicit human review and authorization token.
        """
        if not auth_token:
            return OracleStatus.NOT_QUALIFIED, "Human authorization token must not be empty."
        if auth_token in valid_authorization_tokens:
            return OracleStatus.QUALIFIED, None
        return OracleStatus.NOT_QUALIFIED, "Human authorization token invalid or not recognized."


# Helper factory functions for common metamorphic relations
def make_invariance_relation(name: str, transform_fn: Callable[[Any], Any], desc: str = "") -> MetamorphicRelation:
    """Creates a metamorphic relation expecting f(T(x)) == f(x)."""
    return MetamorphicRelation(
        name=name,
        description=desc or f"Invariance under transformation {name}",
        input_transformation=transform_fn,
        output_relation=lambda o1, o2: o1 == o2,
    )


def make_reversibility_relation(
    name: str,
    forward_fn: Callable[[Any], Any],
    inverse_fn: Callable[[Any], Any],
    desc: str = "",
) -> MetamorphicRelation:
    """Creates a metamorphic relation verifying inverse(forward(x)) == x."""
    return MetamorphicRelation(
        name=name,
        description=desc or f"Reversibility: inverse(forward(x)) == x",
        input_transformation=lambda x: x,
        output_relation=lambda orig, _: inverse_fn(forward_fn(orig)) == orig,
    )
