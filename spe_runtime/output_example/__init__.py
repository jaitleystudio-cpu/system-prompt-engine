"""Desired-output and example compiler.

Reads the existing desired-output and desired-example fields and returns a
candidate pattern contract. It does not mutate K3 or the requirement graph.
"""

from spe_runtime.output_example.compiler import compile_output_example
from spe_runtime.output_example.models import (
    SCHEMA_CONTRACT,
    SCHEMA_IR,
    CandidatePatternContract,
    ExtractedCue,
    FilteredPatterns,
    OutputExampleCompilation,
    PatternClause,
    PatternExtractionIR,
)

__all__ = [
    "SCHEMA_CONTRACT",
    "SCHEMA_IR",
    "CandidatePatternContract",
    "ExtractedCue",
    "FilteredPatterns",
    "OutputExampleCompilation",
    "PatternClause",
    "PatternExtractionIR",
    "compile_output_example",
]
