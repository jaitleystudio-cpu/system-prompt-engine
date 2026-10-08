"""Semantic Linker: Verifies behavioral interface contracts across pipeline modules."""

from __future__ import annotations

from typing import Dict, List, Optional, Set

from spe_runtime.semantic_linker.models import (
    BehavioralSignature,
    LinkedAssembly,
    LinkError,
)


class SemanticLinker:
    """Verifies that composition of AI modules preserves all required behavioral preconditions."""

    def link(self, pipeline: List[BehavioralSignature]) -> LinkedAssembly:
        """Links a sequence of modules, validating requires <= guarantees across dataflow."""
        errors: List[LinkError] = []
        accumulated_guarantees: Dict[str, any] = {}

        for i, mod in enumerate(pipeline):
            # Check requirements of current module against accumulated guarantees of upstream modules
            for req_key, req_val in mod.requires.items():
                if req_key not in accumulated_guarantees:
                    errors.append(
                        LinkError(
                            error_code="SPE-LNK-010",
                            consumer_module=mod.module_name,
                            producer_module="UPSTREAM_ENV",
                            failing_requirement=req_key,
                            required_value=req_val,
                            guaranteed_value=None,
                            counterexample_scenario=f"Module '{mod.module_name}' requires '{req_key}' but no upstream provider guarantees it.",
                        )
                    )
                else:
                    guar_val = accumulated_guarantees[req_key]
                    
                    # Freshness requirement: required_freshness <= guaranteed_freshness (seconds)
                    if "freshness" in req_key.lower():
                        if isinstance(req_val, (int, float)) and isinstance(guar_val, (int, float)):
                            if guar_val > req_val:
                                errors.append(
                                    LinkError(
                                        error_code="SPE-LNK-041",
                                        consumer_module=mod.module_name,
                                        producer_module=f"UPSTREAM_STEP_{i}",
                                        failing_requirement=req_key,
                                        required_value=f"freshness <= {req_val}s",
                                        guaranteed_value=f"{guar_val}s",
                                        counterexample_scenario=(
                                            f"Data age exceeds consumer tolerance: consumer requires "
                                            f"freshness <= {req_val}s, but producer only guarantees <= {guar_val}s."
                                        ),
                                    )
                                )

                    # Boolean capability requirements
                    elif isinstance(req_val, bool) and isinstance(guar_val, bool):
                        if req_val and not guar_val:
                            errors.append(
                                LinkError(
                                    error_code="SPE-LNK-020",
                                    consumer_module=mod.module_name,
                                    producer_module=f"UPSTREAM_STEP_{i}",
                                    failing_requirement=req_key,
                                    required_value=req_val,
                                    guaranteed_value=guar_val,
                                    counterexample_scenario=f"Module '{mod.module_name}' requires verified '{req_key}', but provider does not guarantee it.",
                                )
                            )

            # Update accumulated guarantees
            accumulated_guarantees.update(mod.guarantees)

        is_clean = len(errors) == 0
        return LinkedAssembly(
            modules=pipeline,
            link_errors=errors,
            is_link_clean=is_clean,
        )
