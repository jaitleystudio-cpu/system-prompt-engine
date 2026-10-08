"""Delta-debugging (ddmin) counterexample minimizer across prompt clauses, tools, and examples."""

from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any, Callable


@dataclass
class DeltaDebuggingResult:
    original_size: int
    minimal_size: int
    removed_pct: float
    minimal_reproducer: dict[str, Any]
    reproduction_confidence: float
    iterations: int


def _test_candidate(candidate: dict[str, Any], predicate_fn: Callable[[dict[str, Any]], bool], trials: int = 1) -> float:
    passes = 0
    for _ in range(trials):
        if predicate_fn(candidate):
            passes += 1
    return passes / trials


def minimize_counterexample(
    test_case: dict[str, Any],
    predicate_fn: Callable[[dict[str, Any]], bool],
    trials: int = 1,
) -> DeltaDebuggingResult:
    """Hierarchical delta-debugging to reduce failing counterexamples to minimal reproducers.
    test_case typically contains:
      - 'clauses': list of strings
      - 'tools': list of tool dicts
      - 'few_shot_examples': list of dicts
      - 'context': list of strings
    """
    current = copy.deepcopy(test_case)

    # Calculate initial size
    orig_chars = len(str(current))
    iterations = 0

    # Verify baseline failure
    if _test_candidate(current, predicate_fn, trials) < 0.5:
        raise ValueError("Initial test case does not reproduce failure predicate.")

    # 1. Minimize tools
    tools = current.get("tools", [])
    if len(tools) > 1:
        idx = 0
        while idx < len(tools):
            iterations += 1
            candidate_tools = tools[:idx] + tools[idx + 1 :]
            trial_case = copy.deepcopy(current)
            trial_case["tools"] = candidate_tools
            if _test_candidate(trial_case, predicate_fn, trials) >= 0.5:
                tools = candidate_tools
                current["tools"] = tools
            else:
                idx += 1

    # 2. Minimize few-shot examples
    examples = current.get("few_shot_examples", [])
    if len(examples) > 1:
        idx = 0
        while idx < len(examples):
            iterations += 1
            candidate_ex = examples[:idx] + examples[idx + 1 :]
            trial_case = copy.deepcopy(current)
            trial_case["few_shot_examples"] = candidate_ex
            if _test_candidate(trial_case, predicate_fn, trials) >= 0.5:
                examples = candidate_ex
                current["few_shot_examples"] = examples
            else:
                idx += 1

    # 3. Minimize clauses
    clauses = current.get("clauses", [])
    if len(clauses) > 1:
        idx = 0
        while idx < len(clauses):
            iterations += 1
            candidate_clauses = clauses[:idx] + clauses[idx + 1 :]
            trial_case = copy.deepcopy(current)
            trial_case["clauses"] = candidate_clauses
            if _test_candidate(trial_case, predicate_fn, trials) >= 0.5:
                clauses = candidate_clauses
                current["clauses"] = clauses
            else:
                idx += 1

    minimal_chars = len(str(current))
    removed_pct = round(((orig_chars - minimal_chars) / orig_chars) * 100.0, 1) if orig_chars else 0.0
    confidence = _test_candidate(current, predicate_fn, trials)

    return DeltaDebuggingResult(
        original_size=orig_chars,
        minimal_size=minimal_chars,
        removed_pct=removed_pct,
        minimal_reproducer=current,
        reproduction_confidence=confidence,
        iterations=iterations,
    )
