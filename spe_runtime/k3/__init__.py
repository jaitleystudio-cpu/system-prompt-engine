"""K3 runtime — sole prompt-technique selector."""

from spe_runtime.k3.compile import compile_with_k3
from spe_runtime.k3.registry import (
    IMPLEMENTED_XCAT,
    SCHEMA_VERSION,
    SELECTOR_VERSION,
    STANDARD_MAX_TECHNIQUES,
    TECHNIQUE_IDS,
    UNIMPLEMENTED_XCAT,
)
from spe_runtime.k3.selector import (
    CANONICAL_SELECTOR,
    select_k3,
    select_prompt_techniques,
    selection_is_accepted,
)

__all__ = [
    "CANONICAL_SELECTOR",
    "IMPLEMENTED_XCAT",
    "SCHEMA_VERSION",
    "SELECTOR_VERSION",
    "STANDARD_MAX_TECHNIQUES",
    "TECHNIQUE_IDS",
    "UNIMPLEMENTED_XCAT",
    "compile_with_k3",
    "select_k3",
    "select_prompt_techniques",
    "selection_is_accepted",
]
