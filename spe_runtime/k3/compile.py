"""Attach K3 selection beside an unchanged category-protocol contract."""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from spe_runtime.k3.selector import select_prompt_techniques
from spe_runtime.protocols.compiler import compile_execution_contract


def compile_with_k3(
    domain_ids: Sequence[str] | str,
    depth: Any,
    protected: Mapping[str, Any] | None = None,
    category: Mapping[str, Any] | None = None,
    task: Mapping[str, Any] | None = None,
    capability_profile: Any = None,
) -> dict[str, Any]:
    """Protocol compilation stays in compile_execution_contract.

    K3 only contributes technique_selection. The execution contract dict is
    the same object shape compile_execution_contract returns on its own.
    """
    contract = compile_execution_contract(domain_ids, depth, capability_profile)
    selection = select_prompt_techniques(protected, category, task)
    return {
        "execution_contract": contract.to_dict(),
        "technique_selection": selection,
        "requirement_graph": selection["requirement_graph"],
    }
