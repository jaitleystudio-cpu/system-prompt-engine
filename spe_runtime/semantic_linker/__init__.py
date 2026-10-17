"""Semantic Linker & SLTO Package."""

from spe_runtime.semantic_linker.linker import SemanticLinker
from spe_runtime.semantic_linker.models import (
    BehavioralSignature,
    DeoptGuard,
    LinkedAssembly,
    LinkError,
)
from spe_runtime.semantic_linker.slto import SemanticLinkTimeOptimizer

__all__ = [
    "BehavioralSignature",
    "LinkError",
    "DeoptGuard",
    "LinkedAssembly",
    "SemanticLinker",
    "SemanticLinkTimeOptimizer",
]
