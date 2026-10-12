"""INDEPENDENT evaluator for R1. Deliberately shares no code with netsearch.py: it executes the claimed
network on concrete integer lists (exhaustive 0/1 vectors + random integer arrays with duplicates)
and compares to Python's sorted() reference. Speed = depth (parallel steps) and comparator count;
memory is constant (n wires, in-place) for every comparator network and is reported as such."""
from __future__ import annotations
import itertools, random
from typing import List, Sequence, Tuple


def apply(net: Sequence[Tuple[int, int]], xs: List[int]) -> List[int]:
    v = list(xs)
    for i, j in net:
        if not (0 <= i < j < len(v)):
            raise ValueError("malformed comparator")
        if v[i] > v[j]:
            v[i], v[j] = v[j], v[i]
    return v


def satisfies(kind: str, xs: List[int], out: List[int]) -> bool:
    ref = sorted(xs)
    if sorted(out) != ref:
        return False
    if kind == "sort":
        return out == ref
    if kind == "minmax":
        return out[0] == ref[0] and out[-1] == ref[-1]
    if kind == "median":
        return out[len(xs) // 2] == ref[len(xs) // 2]
    raise ValueError(kind)


def verify(kind: str, n: int, net, seed: int = 0, n_random: int = 2000) -> dict:
    try:
        for bits in itertools.product((0, 1), repeat=n):
            if not satisfies(kind, list(bits), apply(net, list(bits))):
                return {"valid": False, "why": f"binary counterexample {bits}"}
        r = random.Random(f"indep|{seed}|{kind}{n}")
        for _ in range(n_random):
            xs = [r.randint(-5, 5) for _ in range(n)]
            if not satisfies(kind, xs, apply(net, xs)):
                return {"valid": False, "why": f"integer counterexample {xs}"}
    except ValueError as e:
        return {"valid": False, "why": str(e)}
    lvl = [0] * n
    for i, j in net:
        lvl[i] = lvl[j] = max(lvl[i], lvl[j]) + 1
    return {"valid": True, "size": len(net), "depth": max(lvl) if net else 0, "memory_wires": n}
