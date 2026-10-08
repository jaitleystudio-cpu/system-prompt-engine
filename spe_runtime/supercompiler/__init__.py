"""SPE Ω Supercompiler Package."""

from spe_runtime.supercompiler.cegis_loop import CEGISEngine
from spe_runtime.supercompiler.dual_compiler import DualCompiler
from spe_runtime.supercompiler.models import (
    AdversarialFalsifier,
    CostFrontier,
    Counterexample,
    DualProgram,
    ExecutionHarness,
    FalsifierStrategy,
    InstructionClause,
    ProofCarryingHarness,
    ToolContract,
)
from spe_runtime.supercompiler.superoptimizer import HarnessSuperoptimizer

__all__ = [
    "DualCompiler",
    "CEGISEngine",
    "HarnessSuperoptimizer",
    "ExecutionHarness",
    "AdversarialFalsifier",
    "Counterexample",
    "DualProgram",
    "InstructionClause",
    "ToolContract",
    "ProofCarryingHarness",
    "CostFrontier",
    "FalsifierStrategy",
]
