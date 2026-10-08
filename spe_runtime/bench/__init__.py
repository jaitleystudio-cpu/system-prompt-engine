"""SPE Ω — SPE-Bench & Oracle Layer (M6)."""

from .models import (
    BenchmarkDomain,
    BenchmarkResult,
    BenchmarkSuite,
    BenchmarkTask,
    DatasetSplit,
    DeterministicOracle,
    LlmJudgeOracle,
    ProgrammaticConstraintOracle,
    ReferenceAnswerOracle,
    SchemaConformanceOracle,
    TaskOracle,
)
from .runner import compare_benchmarks, run_benchmark_suite

__all__ = [
    "BenchmarkDomain",
    "DatasetSplit",
    "TaskOracle",
    "DeterministicOracle",
    "SchemaConformanceOracle",
    "ProgrammaticConstraintOracle",
    "ReferenceAnswerOracle",
    "LlmJudgeOracle",
    "BenchmarkTask",
    "BenchmarkResult",
    "BenchmarkSuite",
    "run_benchmark_suite",
    "compare_benchmarks",
]
