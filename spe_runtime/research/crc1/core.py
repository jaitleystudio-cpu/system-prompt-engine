"""CRC-1 R0 core: DGP, policies (raw_conf, naive_cal, ltt, oracle), binomial stats. Pure Python."""
from __future__ import annotations

import bisect
import math
import random
from functools import lru_cache

ALPHA = 0.10
DELTA = 0.10
GRID = [0.50 + i * (0.995 - 0.50) / 199 for i in range(200)]


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def sample(n: int, rng: random.Random, z_mu: float = 1.2):
    """Return list of (s, wrong) pairs."""
    out = []
    for _ in range(n):
        z = rng.gauss(z_mu, 1.5)
        y = rng.random() < sigmoid(z)
        s = sigmoid(1.8 * z + 0.6 + rng.gauss(0.0, 0.8))
        out.append((s, 0 if y else 1))
    return out


def grid_counts(data):
    """For each grid t: (n_selected, n_wrong) among items with s >= t."""
    data = sorted(data)
    ss = [d[0] for d in data]
    suffix = [0] * (len(data) + 1)
    for i in range(len(data) - 1, -1, -1):
        suffix[i] = suffix[i + 1] + data[i][1]
    res = []
    for t in GRID:
        i = bisect.bisect_left(ss, t)
        res.append((len(data) - i, suffix[i]))
    return res


@lru_cache(maxsize=None)
def binom_cdf(k: int, n: int, p: float) -> float:
    """P(Bin(n,p) <= k)."""
    if k < 0:
        return 0.0
    if k >= n:
        return 1.0
    lp, lq = math.log(p), math.log1p(-p)
    tot = 0.0
    for j in range(k + 1):
        tot += math.exp(math.lgamma(n + 1) - math.lgamma(j + 1) - math.lgamma(n - j + 1) + j * lp + (n - j) * lq)
    return min(1.0, tot)


def policy_raw_conf(_counts) -> int:
    return min(range(len(GRID)), key=lambda i: abs(GRID[i] - (1 - ALPHA)))


def policy_naive_cal(counts):
    for i, (n, e) in enumerate(counts):  # ascending t: smallest qualifying
        if n >= 1 and e / n <= ALPHA:
            return i
    return None


def policy_ltt(counts, alpha: float = ALPHA, delta: float = DELTA):
    chosen = None
    for i in range(len(GRID) - 1, -1, -1):  # fixed sequence, strict -> loose
        n, e = counts[i]
        p = 1.0 if n == 0 else binom_cdf(e, n, alpha)
        if p <= delta:
            chosen = i
        else:
            break
    return chosen


def policy_oracle(pop_counts):
    for i, (n, e) in enumerate(pop_counts):
        if n >= 1 and e / n <= ALPHA:
            return i
    return None


def truth(pop_counts, idx, n_pop):
    """(risk, coverage) under population; None idx == abstain all."""
    if idx is None:
        return 0.0, 0.0
    n, e = pop_counts[idx]
    return (e / n if n else 0.0), n / n_pop


def clopper_pearson(x: int, n: int, level: float = 0.95):
    a = (1 - level) / 2

    def solve(f):
        lo, hi = 0.0, 1.0
        for _ in range(60):
            mid = (lo + hi) / 2
            if f(mid):
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2

    lower = 0.0 if x == 0 else solve(lambda p: 1 - binom_cdf(x - 1, n, p) < a)
    upper = 1.0 if x == n else solve(lambda p: binom_cdf(x, n, p) > a)
    return lower, upper
