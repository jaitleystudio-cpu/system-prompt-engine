"""Generator side (conditions A-D). Bit-sliced comparator-network search.
Cost unit = number of input vectors pushed through a candidate network (an "input-evaluation")."""
from __future__ import annotations
import random
from typing import Dict, List, Optional, Tuple
from .families import Family

Net = List[Tuple[int, int]]


class Meter:
    def __init__(self): self.evals = 0


def _wires(n: int) -> List[int]:
    full = 1 << n
    return [sum(1 << x for x in range(full) if (x >> i) & 1) for i in range(n)]


def run_bits(net: Net, n: int, cols: Optional[List[int]] = None) -> List[int]:
    w = _wires(n) if cols is None else [sum(1 << k for k, x in enumerate(cols) if (x >> i) & 1) for i in range(n)]
    for i, j in net:
        a, b = w[i] & w[j], w[i] | w[j]
        w[i], w[j] = a, b
    return w


def _ok_bits(kind: str, n: int, w: List[int], mask: int) -> int:
    """Return bitmask of failing columns (0 == pass)."""
    bad = 0
    if kind == "sort":
        for k in range(n - 1):
            bad |= w[k] & ~w[k + 1]
    elif kind == "minmax":
        for k in range(1, n):
            bad |= w[0] & ~w[k]
            bad |= w[k] & ~w[n - 1]
    elif kind == "median":
        m = n // 2
        # median wire must equal the bit-count-th order statistic: value 1 iff ones > n-1-m
        ones = [0] * 0
        cnt = [0]  # compute per column popcount via bit slicing
        acc = [0] * (n + 1); acc[0] = mask
        for x in w:
            for c in range(n, 0, -1):
                acc[c] = (acc[c] & ~x) | (acc[c - 1] & x)
            acc[0] &= ~x
        want = 0
        for c in range(n - m, n + 1):
            want |= acc[c]
        bad |= (w[m] ^ want)
    return bad & mask


class Checker:
    """Internal (generator-side) validity checks with metered cost."""
    def __init__(self, family: Family, meter: Meter):
        self.kind, self.n = family; self.m = meter
        self.full = 1 << self.n; self.fullmask = (1 << self.full) - 1

    def exhaustive(self, net: Net) -> Tuple[bool, Optional[int]]:
        self.m.evals += self.full
        bad = _ok_bits(self.kind, self.n, run_bits(net, self.n), self.fullmask)
        if bad == 0: return True, None
        return False, (bad & -bad).bit_length() - 1

    def on_cols(self, net: Net, cols: List[int]) -> Tuple[bool, Optional[int]]:
        if not cols: return True, None
        self.m.evals += len(cols)
        w = run_bits(net, self.n, cols)
        bad = _ok_bits(self.kind, self.n, w, (1 << len(cols)) - 1)
        if bad == 0: return True, None
        return False, cols[(bad & -bad).bit_length() - 1]


def insertion_net(n: int) -> Net:
    return [(j - 1, j) for i in range(1, n) for j in range(i, 0, -1)]


def batcher_net(n: int) -> Net:
    """Knuth Algorithm M (merge exchange), valid for any n."""
    net: Net = []; t = max(1, (n - 1).bit_length()); p = 1 << (t - 1)
    while p > 0:
        q, r, d = 1 << (t - 1), 0, p
        while True:
            for i in range(n - d):
                if (i & p) == r: net.append((i, i + d))
            if q == p: break
            d, q, r = q - p, q >> 1, p
        p >>= 1
    return net


def prune_tool(net: Net, chk: Checker) -> Net:
    """Tool: drop comparators one at a time if the network stays exhaustively valid."""
    cur = list(net); i = len(cur) - 1
    while i >= 0:
        cand = cur[:i] + cur[i + 1:]
        if chk.exhaustive(cand)[0]: cur = cand
        i -= 1
    return cur


def _mutate(net: Net, n: int, rng: random.Random) -> Net:
    c = list(net); r = rng.random()
    if r < 0.45 and c:
        del c[rng.randrange(len(c))]
    elif r < 0.75 and c:
        k = rng.randrange(len(c)); i, j = sorted(rng.sample(range(n), 2)); c[k] = (i, j)
    elif r < 0.9 and len(c) > 1:
        k = rng.randrange(len(c) - 1); c[k], c[k + 1] = c[k + 1], c[k]
    else:
        i, j = sorted(rng.sample(range(n), 2)); c.insert(rng.randrange(len(c) + 1), (i, j))
    return c


def depth(net: Net, n: int) -> int:
    lvl = [0] * n; d = 0
    for i, j in net:
        v = max(lvl[i], lvl[j]) + 1; lvl[i] = lvl[j] = v; d = max(d, v)
    return d


def search(family: Family, cond: str, seed: int, budget: int, library: Optional[Dict[Family, Net]] = None,
           wm_k: int = 16) -> Dict:
    """cond in {A,B,C,D}. Returns claimed network + metered cost. Never sees the independent evaluator."""
    kind, n = family; rng = random.Random(f"{seed}|{kind}{n}|{cond}")
    meter = Meter(); chk = Checker(family, meter)
    sample = sorted(rng.sample(range(1 << n), min(32, 1 << n)))
    ce: Dict[int, int] = {}  # D world model: counterexample column -> kill count

    def valid(net: Net) -> bool:
        if cond == "A":
            return chk.on_cols(net, sample)[0]
        if cond == "D":
            probes = sorted(ce, key=lambda c: (-ce[c], c))[:wm_k]  # most discriminating experiments first
            ok, col = chk.on_cols(net, probes)
            if not ok: ce[col] += 1; return False
        ok, col = chk.exhaustive(net)
        if not ok and cond == "D": ce[col] = ce.get(col, 0) + 1
        return ok

    if cond == "A":
        start = insertion_net(n)
    else:
        start = batcher_net(n)
        if cond in ("C", "D") and library:
            seeds = [start]
            for (k2, n2), lib_net in library.items():
                if n2 <= n and k2 == "sort":  # transfer: sort(n2) prefix + insertion of remaining wires
                    ext = list(lib_net) + [(j - 1, j) for i in range(n2, n) for j in range(i, 0, -1)]
                    seeds.append(ext)
            ok_seeds = [s for s in seeds if valid(s)]
            start = min(ok_seeds, key=len) if ok_seeds else start
        start = prune_tool(start, chk)
    best = cur = start
    for _ in range(budget):
        cand = _mutate(cur, n, rng)
        if len(cand) > len(cur) + 1: continue
        if valid(cand):
            if len(cand) <= len(cur): cur = cand
            if len(cur) < len(best) or (len(cur) == len(best) and depth(cur, n) < depth(best, n)): best = cur
    if cond != "A":
        best = prune_tool(best, chk)
    return {"net": best, "size": len(best), "depth": depth(best, n), "cost": meter.evals}
