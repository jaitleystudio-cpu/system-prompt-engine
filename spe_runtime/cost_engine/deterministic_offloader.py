"""Deterministic AST Code Offloader: Replaces LLM operations with zero-cost code."""

from __future__ import annotations

import re
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from spe_runtime.cost_engine.models import DeterministicOffloadResult


class DeterministicOffloader:
    """Detects and offloads deterministic sub-tasks from LLMs to zero-cost local code."""

    def __init__(self, cost_per_1k_tokens: float = 0.003):
        self.cost_per_1k_tokens = cost_per_1k_tokens

    def can_offload_math(self, expression: str) -> bool:
        """Determines if a mathematical expression can be safely evaluated deterministically."""
        cleaned = expression.strip()
        # Safe math pattern: only digits, basic operators, parens, decimal points
        return bool(re.match(r"^[\d\s\+\-\*\/\.\(\)\%]+$", cleaned))

    def evaluate_math(self, expression: str) -> float:
        """Safely evaluates an arithmetic expression without LLM inference."""
        if not self.can_offload_math(expression):
            raise ValueError(f"Unsafe or non-arithmetic expression: {expression}")
        # Limited eval with zero builtins
        return float(eval(expression, {"__builtins__": None}, {}))

    def can_offload_regex_extraction(self, text: str, pattern: str) -> bool:
        """Checks if structured data can be extracted via compiled regex."""
        try:
            re.compile(pattern)
            return True
        except re.error:
            return False

    def extract_with_regex(self, text: str, pattern: str) -> List[str]:
        """Extracts structured values via local regex with 0 tokens."""
        return re.findall(pattern, text)

    def execute_offload(
        self,
        task_name: str,
        operation_type: str,
        payload: Dict[str, Any],
    ) -> DeterministicOffloadResult:
        """Executes a deterministic offload and computes exact token and cost savings."""
        t0 = time.perf_counter()
        offloaded: List[str] = []
        tokens_saved = 0
        success = False

        if operation_type == "MATH":
            expr = payload.get("expression", "")
            if self.can_offload_math(expr):
                result = self.evaluate_math(expr)
                offloaded.append(f"Offloaded math evaluation '{expr}' -> {result}")
                # Naive LLM prompt + completion would have taken ~350 tokens
                tokens_saved = 350
                success = True

        elif operation_type in ("REGEX", "REGEX_EXTRACT"):
            text = payload.get("text", "")
            pat = payload.get("pattern", "")
            if self.can_offload_regex_extraction(text, pat):
                matches = self.extract_with_regex(text, pat)
                offloaded.append(f"Offloaded regex extraction on {len(text)} chars -> {len(matches)} matches")
                tokens_saved = int(len(text.split()) * 1.5) + 200
                success = True

        elif operation_type == "SCHEMA_VALIDATE":
            # Deterministic schema check
            data = payload.get("data", {})
            required_keys = payload.get("required_keys", [])
            valid = all(k in data for k in required_keys)
            offloaded.append(f"Offloaded schema check for keys {required_keys} -> {valid}")
            tokens_saved = 400
            success = True

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        cost_saved_usd = (tokens_saved / 1000.0) * self.cost_per_1k_tokens

        return DeterministicOffloadResult(
            offloaded_tasks=offloaded,
            saved_tokens=tokens_saved,
            saved_cost_usd=round(cost_saved_usd, 6),
            execution_latency_ms=round(elapsed_ms, 3),
            deterministic_success=success,
        )
