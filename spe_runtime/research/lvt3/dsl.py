"""Solver-side DSL interpreter. The evaluator has its own independent reference implementation."""
from __future__ import annotations
from typing import Tuple, List, Optional

Op = Tuple[str, Optional[int]]
Program = Tuple[Op, ...]

PARAM_RANGES = {
    "add": list(range(-5, 6)), "mul": [-3, -2, -1, 1, 2, 3], "mod": list(range(2, 8)),
    "take": list(range(1, 6)), "drop": list(range(1, 6)), "rot": list(range(1, 5)),
    "fgt": list(range(-3, 4)),
}
NULLARY = ["abs", "neg", "rev", "sort", "sortd", "cumsum", "feven", "dedup"]


def all_ops() -> List[Op]:
    ops: List[Op] = []
    for name, rng in PARAM_RANGES.items():
        ops.extend((name, p) for p in rng)
    ops.extend((n, None) for n in NULLARY)
    return ops


ALL_OPS = all_ops()
assert len(ALL_OPS) == 52


def apply_op(op: Op, xs: Tuple[int, ...]) -> Tuple[int, ...]:
    n, p = op
    if n == "add": return tuple(x + p for x in xs)
    if n == "mul": return tuple(x * p for x in xs)
    if n == "mod": return tuple(x % p for x in xs)
    if n == "abs": return tuple(abs(x) for x in xs)
    if n == "neg": return tuple(-x for x in xs)
    if n == "rev": return tuple(reversed(xs))
    if n == "sort": return tuple(sorted(xs))
    if n == "sortd": return tuple(sorted(xs, reverse=True))
    if n == "take": return xs[:p]
    if n == "drop": return xs[p:]
    if n == "rot":
        if not xs: return xs
        k = p % len(xs); return xs[k:] + xs[:k]
    if n == "cumsum":
        out, s = [], 0
        for x in xs: s += x; out.append(s)
        return tuple(out)
    if n == "fgt": return tuple(x for x in xs if x > p)
    if n == "feven": return tuple(x for x in xs if x % 2 == 0)
    if n == "dedup":
        seen, out = set(), []
        for x in xs:
            if x not in seen: seen.add(x); out.append(x)
        return tuple(out)
    raise ValueError(n)


def run(prog: Program, xs: Tuple[int, ...]) -> Tuple[int, ...]:
    for op in prog:
        xs = apply_op(op, xs)
    return xs


def structure(prog: Program) -> Tuple[str, ...]:
    return tuple(n for n, _ in prog)


def instances(struct: Tuple[str, ...]) -> List[Program]:
    lists = [[(n, p) for p in PARAM_RANGES[n]] if n in PARAM_RANGES else [(n, None)] for n in struct]
    out: List[Program] = [()]
    for l in lists:
        out = [o + (op,) for o in out for op in l]
    return out


def all_programs() -> List[Program]:
    progs: List[Program] = [(o,) for o in ALL_OPS]
    progs += [(a, b) for a in ALL_OPS for b in ALL_OPS]
    return progs


def mutations(prog: Program) -> List[Program]:
    out = set()
    for i in range(len(prog)):
        for o in ALL_OPS:
            out.add(prog[:i] + (o,) + prog[i + 1:])
    if len(prog) == 1:
        for o in ALL_OPS:
            out.add((o,) + prog); out.add(prog + (o,))
    if len(prog) == 2:
        out.add((prog[0],)); out.add((prog[1],))
    out.discard(prog)
    return sorted(out, key=repr)
