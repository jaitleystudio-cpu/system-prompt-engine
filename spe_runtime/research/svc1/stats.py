"""Paired stats for SVC-1 (self-contained)."""
from __future__ import annotations

import math
import random
from typing import Sequence


def mean(xs: Sequence[float]) -> float:
    return sum(xs) / len(xs)


def ci_t(xs: Sequence[float], alpha: float = 0.05) -> tuple[float, float]:
    n = len(xs)
    m = mean(xs)
    if n < 2:
        return (m, m)
    var = sum((x - m) ** 2 for x in xs) / (n - 1)
    se = math.sqrt(var / n)
    # approx t critical for df=19, 95%: 2.093
    tcrit = {9: 2.262, 19: 2.093, 29: 2.045}.get(n - 1, 1.96 + 2.0 / max(1, n - 1))
    return (m - tcrit * se, m + tcrit * se)


def signflip_p(diffs: Sequence[float], n_flips: int = 4096, seed: int = 0) -> float:
    rng = random.Random(seed)
    obs = abs(mean(diffs))
    extreme = 0
    n = len(diffs)
    for _ in range(n_flips):
        s = 0.0
        for d in diffs:
            s += d if rng.random() < 0.5 else -d
        if abs(s / n) >= obs - 1e-15:
            extreme += 1
    return (extreme + 1) / (n_flips + 1)


def holm(pvals: list[tuple[str, float]]) -> dict[str, float]:
    ordered = sorted(pvals, key=lambda kv: kv[1])
    m = len(ordered)
    out: dict[str, float] = {}
    prev = 0.0
    for i, (name, p) in enumerate(ordered):
        adj = min(1.0, (m - i) * p)
        adj = max(adj, prev)
        out[name] = adj
        prev = adj
    return out
