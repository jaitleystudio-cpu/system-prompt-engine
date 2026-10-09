"""
SPE Ω — Counterfactual Specification Closure (CSC) Oracle Qualifier.
Metamorphic and AST-based oracle qualification, preventing agents from accepting invalid tests.
"""

from __future__ import annotations

from typing import List, Optional, Callable, Any, Dict

from .models import OracleStatus, QualificationMethod
from .assumption_verifier import (
    OracleQualifier as BaseOracleQualifier,
    MetamorphicRelation,
    make_invariance_relation,
    make_reversibility_relation,
)


class OracleQualifier:
    """
    Independent qualification authority for distinguishing probes and oracles.
    Ensures that test oracles cannot be self-certified by the generating agent.
    """

    def __init__(self, valid_human_tokens: Optional[List[str]] = None) -> None:
        self.base = BaseOracleQualifier(valid_human_tokens=valid_human_tokens)

    def qualify_via_metamorphic(
        self,
        test_fn: Callable[[Any], Any],
        metamorphic_relations: List[MetamorphicRelation],
        sample_inputs: List[Any],
    ) -> OracleStatus:
        return self.base.qualify_via_metamorphic_relations(
            test_fn=test_fn,
            relations=metamorphic_relations,
            test_inputs=sample_inputs,
        )

    def qualify_via_ast(
        self,
        source_code: str,
        invariant_checkers: List[Callable[[Any], bool]],
    ) -> OracleStatus:
        return self.base.qualify_via_ast_invariants(
            source_code=source_code,
            invariant_checkers=invariant_checkers,
        )

    def qualify_via_reference(
        self,
        candidate_fn: Callable[[Any], Any],
        reference_fn: Callable[[Any], Any],
        test_inputs: List[Any],
    ) -> OracleStatus:
        return self.base.qualify_via_reference_implementation(
            candidate_fn=candidate_fn,
            reference_fn=reference_fn,
            test_inputs=test_inputs,
        )

    def qualify_via_human(
        self,
        oracle_id: str,
        auth_token: str,
        reviewer_id: str,
    ) -> OracleStatus:
        return self.base.qualify_via_human_authorization(
            oracle_id=oracle_id,
            auth_token=auth_token,
            reviewer_id=reviewer_id,
        )
