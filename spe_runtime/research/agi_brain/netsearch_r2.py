"""R2 generator side: three checking strategies under an EQUAL per-run CPU-time budget.
- plain : every mutated candidate gets the full exhaustive check (no example memory).
- cegis : faithful standard CEGIS loop (cf. Jha & Seshia, arXiv 1407.5397; Solar-Lezama 2008):
          synthesiser proposes candidates until one is consistent with ALL stored counterexamples E,
          the verifier then checks it exhaustively and, on failure, returns one counterexample added to E (unbounded).
- spe_wm: SPE world-model mechanism from R1 condition D: bounded model (k=16) of counterexamples ranked by
          kill count; candidate first runs on the most-discriminating probes, survivors get the exhaustive check.
All three share the same start (pruned Knuth merge-exchange), the same mutation operator and the same budget.
Reuses R1 helpers (run_bits, batcher_net, depth, _mutate, Meter); adds the 'select' kind."""
from __future__ import annotations
import random, time
from typing import Dict, List, Optional, Tuple
from .netsearch import run_bits, batcher_net, depth, _mutate, Meter, _ok_bits as _ok_bits_r1

Net = List[Tuple[int, int]]
COND_R2 = ("plain", "cegis", "spe_wm")


def parse(fam: str) -> Tuple[str, int, int]:
    """'sort13' -> ('sort',13,0); 'select14k4' -> ('select',14,4); 'median13' -> ('median',13,0)."""
    if fam.startswith("select"):
        n, k = fam[6:].split("k"); return "select", int(n), int(k)
    for kind in ("sort", "median", "minmax"):
        if fam.startswith(kind): return kind, int(fam[len(kind):]), 0
    raise ValueError(fam)


def bad_cols(fam: str, w: List[int], mask: int) -> int:
    kind, n, k = parse(fam)
    if kind == "select":  # wires 0..k-1 must hold the k smallest values (any order)
        bad = 0
        for i in range(k):
            for j in range(k, n):
                bad |= w[i] & ~w[j]
        return bad & mask
    return _ok_bits_r1(kind, n, w, mask)


class Checker2:
    def __init__(self, fam: str, meter: Meter):
        self.fam = fam; _, self.n, _ = parse(fam); self.m = meter
        self.full = 1 << self.n; self.mask = (1 << self.full) - 1

    def exhaustive(self, net):
        self.m.evals += self.full
        bad = bad_cols(self.fam, run_bits(net, self.n), self.mask)
        return (True, None) if bad == 0 else (False, (bad & -bad).bit_length() - 1)

    def on_cols(self, net, cols):
        if not cols: return True, None
        self.m.evals += len(cols)
        bad = bad_cols(self.fam, run_bits(net, self.n, cols), (1 << len(cols)) - 1)
        return (True, None) if bad == 0 else (False, cols[(bad & -bad).bit_length() - 1])


def prune(net, chk: Checker2, deadline: float):
    cur = list(net); i = len(cur) - 1
    while i >= 0 and time.process_time() < deadline:
        cand = cur[:i] + cur[i + 1:]
        if chk.exhaustive(cand)[0]: cur = cand
        i -= 1
    return cur


def search_r2(fam: str, cond: str, seed: int, cpu_budget: float, start_net: Optional[Net] = None, wm_k: int = 16) -> Dict:
    assert cond in COND_R2
    _, n, _ = parse(fam); rng = random.Random(f"r2|{seed}|{fam}")  # same RNG stream for all conditions
    meter = Meter(); chk = Checker2(fam, meter)
    t0 = time.process_time(); deadline = t0 + cpu_budget
    E: List[int] = []                    # CEGIS example set (unbounded)
    wm: Dict[int, int] = {}              # SPE world model: counterexample -> kill count
    n_verifier_calls = 0

    def valid(net) -> bool:
        nonlocal n_verifier_calls
        if cond == "cegis":
            if not chk.on_cols(net, E)[0]: return False      # synthesiser rejects: inconsistent with E
            n_verifier_calls += 1
            ok, col = chk.exhaustive(net)
            if not ok: E.append(col)
            return ok
        if cond == "spe_wm":
            probes = sorted(wm, key=lambda c: (-wm[c], c))[:wm_k]
            ok, col = chk.on_cols(net, probes)
            if not ok: wm[col] += 1; return False
            n_verifier_calls += 1
            ok, col = chk.exhaustive(net)
            if not ok: wm[col] = wm.get(col, 0) + 1
            return ok
        n_verifier_calls += 1
        return chk.exhaustive(net)[0]

    start = [tuple(c) for c in start_net] if start_net is not None else prune(batcher_net(n), chk, deadline)
    best = cur = start; proposals = 0; t_best = time.process_time() - t0
    while time.process_time() < deadline:
        cand = _mutate(cur, n, rng); proposals += 1
        if len(cand) > len(cur) + 1: continue
        if valid(cand):
            if len(cand) <= len(cur): cur = cand
            if len(cur) < len(best) or (len(cur) == len(best) and depth(cur, n) < depth(best, n)):
                best = cur; t_best = time.process_time() - t0
    return {"net": best, "size": len(best), "depth": depth(best, n), "evals": meter.evals,
            "proposals": proposals, "verifier_calls": n_verifier_calls, "cpu_used": time.process_time() - t0,
            "cpu_to_best": t_best, "model_size": len(E) if cond == "cegis" else len(wm)}
