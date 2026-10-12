"""Family-level statistics (unit = independent task family)."""
from __future__ import annotations
import math, random, statistics
from typing import Dict, List

def t_crit(df: int) -> float:
    # two-sided 97.5% quantile; exact table for small df, normal-ish approx beyond
    table = {1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262,
             10: 2.228, 14: 2.145, 19: 2.093, 24: 2.064, 29: 2.045, 39: 2.023, 49: 2.010, 59: 2.001, 79: 1.990}
    if df in table: return table[df]
    k = max(d for d in table if d <= df) if df > 1 else 1
    return table[k]

def sd(xs):
    n = len(xs); m = sum(xs) / n
    return (sum((x - m) ** 2 for x in xs) / (n - 1)) ** 0.5 if n > 1 else 0.0

def paired(d: List[float], perms: int = 20000, seed: int = 20261012) -> Dict[str, float]:
    n = len(d); m = sum(d) / n; s = sd(d); hw = t_crit(n - 1) * s / math.sqrt(n)
    # one-sided sign-flip permutation p-value for H1: mean > 0
    r = random.Random(seed); ge = 0
    for _ in range(perms):
        mm = sum(x if r.random() < 0.5 else -x for x in d) / n
        if mm >= m - 1e-12: ge += 1
    return {"n": n, "mean": m, "sd": s, "ci_lo": m - hw, "ci_hi": m + hw, "p_one_sided": (ge + 1) / (perms + 1)}

def holm(ps: Dict[str, float], alpha: float = 0.05) -> Dict[str, Dict[str, float]]:
    order = sorted(ps, key=ps.get); k = len(order); out = {}; running = 0.0; reject = True
    for i, h in enumerate(order):
        adj = min(1.0, max(running, (k - i) * ps[h])); running = adj
        reject = reject and adj < alpha
        out[h] = {"p": ps[h], "p_holm": adj, "reject_h0": reject}
    return out

def n_required(sd_d: float, delta: float, alpha_one_sided=0.05 / 3, power=0.8) -> int:
    za = {0.05: 1.645, 0.05 / 3: 2.128, 0.025: 1.960}[alpha_one_sided]; zb = 0.842 if power == 0.8 else 1.282
    return math.ceil(((za + zb) * sd_d / delta) ** 2) if delta > 0 else 10 ** 9
