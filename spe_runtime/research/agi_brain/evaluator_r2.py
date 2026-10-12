"""INDEPENDENT R2 verifier. Imports only the R1 independent evaluator (never the generator).
Adds the 'select' kind: output wires 0..k-1 hold exactly the k smallest inputs (multiset), any order."""
from __future__ import annotations
import itertools, random
from .evaluator_r1 import apply, satisfies as _sat_r1


def _parse(fam):
    if fam.startswith("select"):
        n, k = fam[6:].split("k"); return "select", int(n), int(k)
    for kind in ("sort", "median", "minmax"):
        if fam.startswith(kind): return kind, int(fam[len(kind):]), 0
    raise ValueError(fam)


def satisfies(fam, xs, out):
    kind, n, k = _parse(fam)
    if kind == "select":
        return sorted(out) == sorted(xs) and sorted(out[:k]) == sorted(xs)[:k]
    return _sat_r1(kind, xs, out)


def verify(fam, net, seed=0, n_random=3000):
    kind, n, k = _parse(fam)
    try:
        for bits in itertools.product((0, 1), repeat=n):
            b = list(bits)
            if not satisfies(fam, b, apply(net, b)): return {"valid": False, "why": f"binary {bits}"}
        r = random.Random(f"indep2|{seed}|{fam}")
        for _ in range(n_random):
            xs = [r.randint(-9, 9) for _ in range(n)]
            if not satisfies(fam, xs, apply(net, xs)): return {"valid": False, "why": f"int {xs}"}
    except ValueError as e:
        return {"valid": False, "why": str(e)}
    lvl = [0] * n
    for i, j in net: lvl[i] = lvl[j] = max(lvl[i], lvl[j]) + 1
    return {"valid": True, "size": len(net), "depth": max(lvl) if net else 0}
