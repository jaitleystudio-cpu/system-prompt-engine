"""Semantic Link-Time Optimizer (SLTO): Eliminates cross-module instruction redundancy."""

from __future__ import annotations

import copy
from typing import Dict, List, Set

from spe_runtime.semantic_linker.models import (
    DeoptGuard,
    LinkedAssembly,
)


class SemanticLinkTimeOptimizer:
    """Eliminates redundant instructions when runtime guards or upstream nodes enforce invariants."""

    def optimize(
        self,
        assembly: LinkedAssembly,
        runtime_enforced_guards: Set[str],
        prompt_clauses_by_module: Dict[str, List[str]],
    ) -> Tuple[Dict[str, List[str]], LinkedAssembly]:
        """Performs Link-Time Optimization over module prompts against verified runtime guards."""
        optimized_prompts: Dict[str, List[str]] = {}
        eliminated_redundancies: List[str] = []
        deopt_guards: List[DeoptGuard] = []
        token_savings = 0

        # Known mapping between runtime guards and redundant prompt patterns
        guard_to_prompt_patterns = {
            "RUNTIME_PII_GUARD": ["never reveal private data", "do not disclose pii", "redact sensitive pii"],
            "RUNTIME_BUDGET_GUARD": ["do not exceed budget", "stay under spending limit", "never overspend"],
            "RUNTIME_JSON_SCHEMA_GUARD": ["output must strictly be json", "format exclusively as json"],
        }

        for mod_name, clauses in prompt_clauses_by_module.items():
            kept_clauses: List[str] = []
            for clause in clauses:
                clause_lower = clause.lower()
                redundant_guard_match = None

                for guard_name, patterns in guard_to_prompt_patterns.items():
                    if guard_name in runtime_enforced_guards:
                        if any(pat in clause_lower for pat in patterns):
                            redundant_guard_match = guard_name
                            break

                if redundant_guard_match:
                    eliminated_redundancies.append(
                        f"Pruned redundant prompt clause from [{mod_name}]: '{clause}' (Enforced by {redundant_guard_match})"
                    )
                    deopt_guards.append(
                        DeoptGuard(
                            guard_id=f"deopt_{mod_name}_{redundant_guard_match.lower()}",
                            predicate=f"runtime_guard_active('{redundant_guard_match}') == True",
                            fallback_target=f"restore_clause('{clause}')",
                        )
                    )
                    token_savings += len(clause.split()) * 2
                else:
                    kept_clauses.append(clause)

            optimized_prompts[mod_name] = kept_clauses

        # Update assembly
        new_assembly = copy.deepcopy(assembly)
        new_assembly.eliminated_redundancies = eliminated_redundancies
        new_assembly.deopt_guards = deopt_guards
        new_assembly.token_savings = token_savings

        return optimized_prompts, new_assembly
