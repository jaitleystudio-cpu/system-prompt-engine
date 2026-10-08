"""S-CODE research lab: pre-run diagnostic witness selection.

This is a deterministic, single-fault, noiseless model. It neither verifies an
AI result nor grants execution authority. Candidate witness behavior must be
measured independently before applying this model to real agents.
"""

from dataclasses import dataclass
from itertools import combinations
from math import isfinite, log2
from typing import Mapping, Sequence


@dataclass(frozen=True)
class Witness:
    name: str
    cost: float
    detects: frozenset[str]

    def __post_init__(self):
        if not self.name or not isfinite(self.cost) or self.cost <= 0:
            raise ValueError("witness name and finite positive cost required")
        object.__setattr__(self, "detects", frozenset(self.detects))


@dataclass(frozen=True)
class Design:
    selected: tuple[Witness, ...]
    cost: float
    min_distance: int


class Undiagnosable(ValueError):
    pass


def _signature(fault: str | None, selected: Sequence[Witness]) -> tuple[bool, ...]:
    return tuple(fault in w.detects if fault is not None else False for w in selected)


def _distance(a: Sequence[bool], b: Sequence[bool]) -> int:
    return sum(x != y for x, y in zip(a, b))


def min_diagnostic_distance(faults: Sequence[str], selected: Sequence[Witness]) -> int:
    """Include the no-fault signature, so coverage cannot be omitted."""
    signatures = [_signature(f, selected) for f in (None, *faults)]
    return min(_distance(a, b) for a, b in combinations(signatures, 2))


def compile_witnesses(
    faults: Sequence[str],
    witnesses: Sequence[Witness],
    *,
    required_distance: int = 2,
) -> Design:
    """Find the lowest cost subset with pairwise separation, or fail closed.

    Exhaustive search is intentionally capped for the small research fixture.
    The lexicographic tie-break makes the output deterministic.
    """
    faults = tuple(faults)
    witnesses = tuple(witnesses)
    if len(faults) < 2 or len(set(faults)) != len(faults):
        raise ValueError("at least two distinct fault classes required")
    if len(witnesses) > 16 or len(set(w.name for w in witnesses)) != len(witnesses):
        raise ValueError("at most 16 witnesses with unique names required")
    if required_distance < 1:
        raise ValueError("required_distance must be positive")
    unknown = set().union(*(w.detects for w in witnesses)) - set(faults)
    if unknown:
        raise ValueError("witness refers to undeclared fault class")

    best = None
    for size in range(1, len(witnesses) + 1):
        for subset in combinations(witnesses, size):
            distance = min_diagnostic_distance(faults, subset)
            if distance < required_distance:
                continue
            cost = sum(w.cost for w in subset)
            candidate = (cost, size, tuple(w.name for w in subset), subset, distance)
            if best is None or candidate[:3] < best[:3]:
                best = candidate
    if best is None:
        raise Undiagnosable("available witnesses cannot separate faults at required distance")
    return Design(selected=best[3], cost=best[0], min_distance=best[4])


def compatible_faults(
    faults: Sequence[str], observations: Mapping[str, bool | None], witnesses: Sequence[Witness]
) -> tuple[str, ...]:
    """UNKNOWN readings (None) constrain nothing. Never guess a single cause."""
    by_name = {w.name: w for w in witnesses}
    if len(by_name) != len(witnesses) or set(observations) - set(by_name):
        raise ValueError("unknown or duplicate witness")
    if any(value is not None and type(value) is not bool for value in observations.values()):
        raise TypeError("observation must be True, False or None")
    return tuple(
        fault for fault in faults
        if all(
            reading is None or (fault in by_name[name].detects) == reading
            for name, reading in observations.items()
        )
    )


def next_probe(
    candidates: Sequence[str], remaining: Sequence[Witness]
) -> Witness | None:
    """Maximum uniform-prior information gain per cost; no inference if none separates."""
    candidates = tuple(candidates)
    if len(candidates) < 2:
        return None
    ranked = []
    for witness in remaining:
        yes = sum(f in witness.detects for f in candidates)
        p = yes / len(candidates)
        if 0 < p < 1:
            entropy = -p * log2(p) - (1 - p) * log2(1 - p)
            ranked.append((-entropy / witness.cost, witness.name, witness))
    return min(ranked)[2] if ranked else None
