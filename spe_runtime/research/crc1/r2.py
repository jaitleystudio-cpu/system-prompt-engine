"""CRC-1 R2 adjudication per docs/crc1/CONTRACT_R2.md. Pure Python, deterministic.
Usage: python3 -m spe_runtime.research.crc1.r2 OUTDIR"""
from __future__ import annotations

import bisect
import json
import math
import random
import sys

from . import core
from . import r1 as R1

ALPHA, DELTA = core.ALPHA, core.DELTA
GRID = core.GRID
N_GRID = len(GRID)
N_POP = 400_000


# ---------------------------------------------------------------- shared stats
def log_pmf(j, n, p):
    if p <= 0.0:
        return 0.0 if j == 0 else -math.inf
    if p >= 1.0:
        return 0.0 if j == n else -math.inf
    return math.lgamma(n + 1) - math.lgamma(j + 1) - math.lgamma(n - j + 1) + j * math.log(p) + (n - j) * math.log1p(-p)


def pmf_list(n, p):
    return [math.exp(log_pmf(j, n, p)) for j in range(n + 1)]


def _betacf(a, b, x):
    """Continued fraction for the regularized incomplete beta (Numerical Recipes 6.4)."""
    tiny, qab, qap, qam = 1e-300, a + b, a + 1.0, a - 1.0
    c, d = 1.0, 1.0 - qab * x / qap
    d = 1.0 / (d if abs(d) > tiny else tiny)
    h = d
    for m in range(1, 10_000):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + aa / c
        c = c if abs(c) > tiny else tiny
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + aa / c
        c = c if abs(c) > tiny else tiny
        dl = d * c
        h *= dl
        if abs(dl - 1.0) < 1e-15:
            break
    return h


def betainc(a, b, x):
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    lbt = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log1p(-x)
    if x < (a + 1.0) / (a + b + 2.0):
        return math.exp(lbt) * _betacf(a, b, x) / a
    return 1.0 - math.exp(lbt) * _betacf(b, a, 1.0 - x) / b


def cdf(k, n, p):
    """Exact P(Bin(n,p) <= k) = I_{1-p}(n-k, k+1); direct sum for small n."""
    if k < 0:
        return 0.0
    if k >= n:
        return 1.0
    if p <= 0.0:
        return 1.0
    if p >= 1.0:
        return 0.0
    if n <= 400:
        return core.binom_cdf(k, n, p)
    return min(1.0, max(0.0, betainc(n - k, k + 1, 1.0 - p)))


_KS = {}


def kstar(n, alpha=ALPHA, delta=DELTA):
    """Largest k with P(Bin(n,alpha) <= k) <= delta, or -1 if none (exact, binary search; cdf increasing in k)."""
    key = (n, alpha, delta)
    if key in _KS:
        return _KS[key]
    if cdf(0, n, alpha) > delta:
        _KS[key] = -1
        return -1
    lo, hi = 0, n  # cdf(lo) <= delta, cdf(hi)=1 > delta
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if cdf(mid, n, alpha) <= delta:
            lo = mid
        else:
            hi = mid
    _KS[key] = lo
    return lo


def is_nested(counts):
    """Counts indexed loose->strict must come from one thresholded observation set."""
    for i, (n, e) in enumerate(counts):
        if not (0 <= e <= n):
            return False
        if i + 1 < len(counts):
            n2, e2 = counts[i + 1]
            if n2 > n or e2 > e or (e - e2) > (n - n2):
                return False
    return True


# ---------------------------------------------------------------- population truth at arbitrary threshold
class Pop:
    def __init__(self, data):
        data = sorted(data)
        self.ss = [d[0] for d in data]
        self.suf = [0] * (len(data) + 1)
        for i in range(len(data) - 1, -1, -1):
            self.suf[i] = self.suf[i + 1] + data[i][1]
        self.n = len(data)
        self.grid = core.grid_counts(data)

    def at(self, theta):
        """(risk, coverage) of {s >= theta}; theta None = abstain."""
        if theta is None:
            return 0.0, 0.0
        i = bisect.bisect_left(self.ss, theta)
        m = self.n - i
        return (self.suf[i] / m if m else 0.0), m / self.n


# ---------------------------------------------------------------- Item 2: SGR (Geifman & El-Yaniv 2017, Alg. 1)
def bstar(r_hat, delta, m):
    """B*(r, delta, m) = sup{b : P(Bin(m,b) <= m r) >= delta}."""
    if m == 0:
        return 1.0
    k = int(round(r_hat * m))
    if k >= m:
        return 1.0
    lo, hi = 0.0, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if cdf(k, m, mid) >= delta:
            lo = mid
        else:
            hi = mid
    return lo


def sgr_trace(data, r_star=ALPHA, delta=DELTA):
    """Faithful Algorithm 1. data = list of (s, wrong). Returns list of (theta_i, b_i) per iteration."""
    m = len(data)
    if m == 0:
        return []
    srt = sorted(data)
    ss = [d[0] for d in srt]
    suf = [0] * (m + 1)
    for i in range(m - 1, -1, -1):
        suf[i] = suf[i + 1] + srt[i][1]
    k = math.ceil(math.log2(m)) if m > 1 else 1
    z_min, z_max, trace = 1, m, []
    for _ in range(k):
        z = math.ceil((z_min + z_max) / 2)
        theta = ss[z - 1]
        i = bisect.bisect_left(ss, theta)
        m_t = m - i
        r_i = suf[i] / m_t
        b_i = bstar(r_i, delta / k, m_t)
        trace.append((theta, b_i))
        if b_i < r_star:
            z_max = z
        else:
            z_min = z
    return trace


def policy_sgr_faithful(data, alpha=ALPHA, delta=DELTA):
    tr = sgr_trace(data, alpha, delta)
    if not tr:
        return None
    theta, b = tr[-1]
    return theta if b < alpha else None


def policy_sgr_best(data, alpha=ALPHA, delta=DELTA):
    ok = [th for th, b in sgr_trace(data, alpha, delta) if b < alpha]
    return min(ok) if ok else None


# ---------------------------------------------------------------- Item 3: aLTT (Zecchin, Park, Simeone 2025)
MU_CAP = 0.5 / (1 - ALPHA)


def agrapa(sum_l, sum_l2, t, alpha=ALPHA):
    m = (0.5 + sum_l) / (t + 1)
    # sum (L - m)^2 over past = sum_l2 - 2 m sum_l + t m^2
    v = (0.25 + max(0.0, sum_l2 - 2 * m * sum_l + t * m * m)) / (t + 1)
    mu = (alpha - m) / (v + (alpha - m) ** 2)
    return min(max(mu, 0.0), MU_CAP)


def altt_pvalues(data, alpha=ALPHA):
    """Process items in given order; H_t updated only when s >= GRID[t]. Returns anytime p-values per grid index."""
    E = [1.0] * N_GRID
    Emax = [1.0] * N_GRID
    sl = [0.0] * N_GRID
    t_cnt = [0] * N_GRID
    for s, w in data:
        top = bisect.bisect_right(GRID, s)  # indices < top have GRID[i] <= s
        for i in range(top):
            mu = agrapa(sl[i], sl[i], t_cnt[i], alpha)  # L in {0,1} so sum L^2 = sum L
            E[i] *= 1 + mu * (alpha - w)
            if E[i] > Emax[i]:
                Emax[i] = E[i]
            sl[i] += w
            t_cnt[i] += 1
    return [1.0 / e for e in Emax]


def policy_altt(data, alpha=ALPHA, delta=DELTA):
    p = altt_pvalues(data, alpha)
    chosen = None
    for i in range(N_GRID - 1, -1, -1):
        if p[i] <= delta:
            chosen = i
        else:
            break
    return None if chosen is None else GRID[chosen]


# ---------------------------------------------------------------- Item 5: planner
def power_exact(n, p, alpha=ALPHA, delta=DELTA):
    k = kstar(n, alpha, delta)
    return cdf(k, n, p) if k >= 0 else 0.0


def n_normal(p, alpha=ALPHA, delta=DELTA, power=0.8):
    if p >= alpha:
        return None
    zd, zp = 1.2815515655446004, 0.8416212335729143  # z_{0.90}, z_{0.80}
    assert abs(delta - 0.10) < 1e-12 and abs(power - 0.8) < 1e-12
    return math.ceil(((zd * math.sqrt(alpha * (1 - alpha)) + zp * math.sqrt(p * (1 - p))) / (alpha - p)) ** 2)


_PLAN = {}


def n_needed(p, alpha=ALPHA, delta=DELTA, power=0.8, budget=200_000, guard=20):
    """Exact smallest n with power >= target for n..n+guard; None = refuse (p>=alpha or > budget)."""
    if p >= alpha:
        return None
    key = (round(p, 12), alpha, delta, power, budget)
    if key in _PLAN:
        return _PLAN[key]
    start = max(1, int(0.7 * (n_normal(p, alpha, delta, power) or 1)))
    if start > budget:
        _PLAN[key] = None
        return None
    # linear scan from 0.7 x normal-approx n; first n whose next `guard` successors also pass (sawtooth guard)
    n, run, first = start, 0, None
    while n <= budget + guard:
        k = kstar(n, alpha, delta)
        ok = k >= 0 and cdf(k, n, p) >= power
        if ok:
            if first is None:
                first = n
            run += 1
            if run > guard:
                break
        else:
            first, run = None, 0
        n += 1
    res = first if (first is not None and first <= budget) else None
    _PLAN[key] = res
    return res


# ---------------------------------------------------------------- Item 6: pilot / calibration split
PILOT_FRAC = 0.3


def policy_pilot_split(data, alpha=ALPHA, delta=DELTA):
    n_p = int(PILOT_FRAC * len(data))
    pilot, test = data[:n_p], data[n_p:]
    pc, tc = core.grid_counts(pilot), core.grid_counts(test)
    cand = None
    for i in range(N_GRID):  # loose -> strict, take the loosest feasible
        n, e = pc[i]
        if n == 0:
            continue
        r = (e + 1) / (n + 2)
        if r >= alpha:
            continue
        need = n_needed(r, alpha, delta, budget=len(test))
        if need is not None and need <= len(test) * n / n_p:
            cand = i
            break
    if cand is None:
        return None
    n, e = tc[cand]
    return GRID[cand] if n > 0 and cdf(e, n, alpha) <= delta else None


# ---------------------------------------------------------------- grid-based wrappers
def _grid(fn):
    def g(data):
        i = fn(core.grid_counts(data))
        return None if i is None else GRID[i]
    return g


def arms(n_cal):
    n_min = int(0.3 * n_cal)
    return (("ltt_r0", _grid(R1.policy_ltt_r0)),
            ("ltt_mc", _grid(lambda c: R1.policy_ltt_mc(c, n_min))),
            ("sgr_faithful", policy_sgr_faithful),
            ("sgr_best", policy_sgr_best),
            ("altt", policy_altt),
            ("pilot_split", policy_pilot_split))


def run_cond(pop, n_cal, seeds, seed_base=30_000):
    o = core.policy_oracle(pop.grid)
    o_risk, o_cov = pop.at(None if o is None else GRID[o])
    names = [a for a, _ in arms(n_cal)]
    rows = {a: [] for a in names}
    for seed in seeds:
        data = core.sample(n_cal, random.Random(seed_base + seed))
        for name, fn in arms(n_cal):
            th = fn(data)
            r, c = pop.at(th)
            rows[name].append((r, c, th is None))
    out = {"n_cal": n_cal, "seeds": len(seeds), "oracle": {"risk": round(o_risk, 6), "coverage": round(o_cov, 6)}}
    base = [c for _, c, _ in rows["ltt_r0"]]
    for a in names:
        rs = rows[a]
        v = sum(1 for r, _, _ in rs if r > ALPHA)
        lo, hi = core.clopper_pearson(v, len(rs))
        cov = sum(c for _, c, _ in rs) / len(rs)
        d = [c - b for (_, c, _), b in zip(rs, base)]
        m = sum(d) / len(d)
        sd = math.sqrt(sum((x - m) ** 2 for x in d) / (len(d) - 1))
        se = sd / math.sqrt(len(d))
        out[a] = {"violation_rate": round(v / len(rs), 6), "cp95": [round(lo, 6), round(hi, 6)],
                  "valid": hi <= DELTA, "coverage_x_oracle": round(cov / o_cov, 6) if o_cov else None,
                  "abstain_all": sum(1 for _, _, ab in rs if ab),
                  "paired_minus_r0": {"mean": round(m, 6), "lb95_1s": round(m - 1.645 * se, 6), "ub95_1s": round(m + 1.645 * se, 6)}}
    return out


# ---------------------------------------------------------------- Item 1: counterexample search (exact)
S_A, S_B, S_C = 0.999, 0.90, 0.55
N1, NMIN1 = 500, 150


def ce_dgp(piA, rA, rB):
    target = ALPHA + 0.002
    piB = piA * (rA - target) / (target - rB)
    return piB


def _rng_idx(n, p, width=8.0):
    mu, sd = n * p, math.sqrt(max(n * p * (1 - p), 1e-9))
    return max(0, int(mu - width * sd) - 1), min(n, int(mu + width * sd) + 2)


def ce_exact(piA, rA, rB):
    """Exact violation probability of ltt_mc and ltt_r0 on the 3-mass DGP (tail mass < ~1e-12 dropped and reported)."""
    piB = ce_dgp(piA, rA, rB)
    viol_mc = viol_r0 = 0.0
    dropped = 0.0
    pA_all = pmf_list(N1, piA)
    lo, hi = _rng_idx(N1, piA)
    dropped += 1 - sum(pA_all[lo:hi + 1])
    qB = piB / (1 - piA)
    for nA in range(lo, hi + 1):
        wA = pA_all[nA]
        if wA < 1e-15:
            continue
        kA = kstar(nA) if nA > 0 else -1
        rejA = cdf(kA, nA, rA) if kA >= 0 else 0.0
        viol_r0 += wA * rejA  # R0 starts at 0.995: rejecting A (risk rA > alpha) is a violation
        if nA >= NMIN1:
            viol_mc += wA * rejA
            continue
        pA = pmf_list(nA, rA)
        rest = N1 - nA
        pB_all = pmf_list(rest, qB)
        blo, bhi = _rng_idx(rest, qB)
        for nB in range(blo, bhi + 1):
            wB = pB_all[nB]
            if wB < 1e-15:
                continue
            n = nA + nB
            if n < NMIN1:
                dropped += wA * wB  # start would fall to C (counted as dropped, upper-bounded)
                continue
            k = kstar(n)
            if k < 0:
                continue
            if rB <= 0:
                pr = sum(pA[j] for j in range(min(k, nA) + 1))
            else:
                pr = sum(pA[j] * cdf(k - j, nB, rB) for j in range(min(k, nA) + 1))
            viol_mc += wA * wB * pr
    return {"piA": piA, "rA": rA, "rB": rB, "piB": round(piB, 6), "viol_mc": round(viol_mc, 6),
            "viol_r0": round(viol_r0, 6), "dropped_mass_upper": float(f"{dropped:.3g}")}


def ce_sample(n, rng, piA, rA, rB):
    piB = ce_dgp(piA, rA, rB)
    out = []
    for _ in range(n):
        u = rng.random()
        if u < piA:
            out.append((S_A, int(rng.random() < rA)))
        elif u < piA + piB:
            out.append((S_B, int(rng.random() < rB)))
        else:
            out.append((S_C, int(rng.random() < 0.5)))
    return out


def ce_mc(piA, rA, rB, draws=20_000):
    piB = ce_dgp(piA, rA, rB)
    risk = {S_A: rA, S_B: (piA * rA + piB * rB) / (piA + piB),
            S_C: piA * rA + piB * rB + (1 - piA - piB) * 0.5}
    v = 0
    for d in range(draws):
        c = core.grid_counts(ce_sample(N1, random.Random(70_000 + d), piA, rA, rB))
        i = R1.policy_ltt_mc(c, NMIN1)
        if i is None:
            continue
        t = GRID[i]
        r = risk[S_A] if t > S_B else (risk[S_B] if t > S_C else risk[S_C])
        v += r > ALPHA
    lo, hi = core.clopper_pearson(v, draws)
    return {"draws": draws, "violation_rate": v / draws, "cp95": [round(lo, 6), round(hi, 6)]}


def ce_family():
    res = []
    for piA in (0.24, 0.26, 0.28, 0.30, 0.32):
        for rA in (0.12, 0.15, 0.20, 0.25):
            for rB in (0.0, 0.02, 0.05):
                piB = ce_dgp(piA, rA, rB)
                if piA + piB > 0.95:
                    continue
                res.append(ce_exact(piA, rA, rB))
    return res


# ---------------------------------------------------------------- Item 5 validation
def planner_validation(draws=20_000):
    out = []
    for p in (0.02, 0.05, 0.07, 0.08, 0.09):
        n = n_needed(p)
        k = kstar(n)
        rng = random.Random(int(p * 1000) + 5)
        hits = 0
        for _ in range(draws):
            e = sum(1 for _ in range(n) if rng.random() < p) if n <= 3000 else None
            if e is None:  # large n: draw via normal-free inversion on exact cdf
                u, j, acc = rng.random(), 0, 0.0
                pm = pmf_list(n, p)
                while acc + pm[j] < u:
                    acc += pm[j]
                    j += 1
                e = j
            hits += e <= k
        nn = n_normal(p)
        out.append({"p": p, "n_exact": n, "power_exact_at_n": round(power_exact(n, p), 4),
                    "sim_power": round(hits / draws, 4), "n_normal": nn, "power_exact_at_n_normal": round(power_exact(nn, p), 4)})
    return out


def main(out):
    pop = Pop(core.sample(N_POP, random.Random(999)))
    pop_shift = Pop(core.sample(N_POP, random.Random(999), z_mu=0.6))
    res = {"experiment": "CRC-1 R2", "alpha": ALPHA, "delta": DELTA, "cost_inr": 0}
    fam = ce_family()
    worst = max(fam, key=lambda r: r["viol_mc"])
    res["item1_family"] = fam
    res["item1_worst"] = worst
    res["item1_worst_mc"] = ce_mc(worst["piA"], worst["rA"], worst["rB"])
    res["item5_planner"] = planner_validation()
    res["item5_refuse"] = {"p_eq_alpha": n_needed(ALPHA), "p_0.11": n_needed(0.11),
                           "p_0.098_budget_500": n_needed(0.098, budget=500), "p_0.098_unbounded": n_needed(0.098)}
    res["item6"] = {"base_500": run_cond(pop, 500, range(1000)), "shift_500": run_cond(pop_shift, 500, range(1000)),
                    "base_2000": run_cond(pop, 2000, range(300)), "shift_2000": run_cond(pop_shift, 2000, range(300))}
    with open(f"{out}/summary.json", "w") as f:
        json.dump(res, f, indent=2, sort_keys=True)
    print(json.dumps({"item1_worst": worst, "item1_worst_mc": res["item1_worst_mc"], "item5": res["item5_planner"],
                      "item5_refuse": res["item5_refuse"]}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main(sys.argv[1])
