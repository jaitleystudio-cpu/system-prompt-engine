"""R3 arms. Library arms share an identical qualified registry (guard+revocation OFF; H11 excluded),
identical interleaved library/search scheduler and an identical hard per-task execution budget.
They differ ONLY in how the k=4 evaluator probes are chosen.
 A      search only, random probes, search cap 4000, no budget (defines reference cost)
 U      uncertainty-guided probes: cheap prior-weighted output-entropy over a bounded rival set (cost counted)
 R      uniform-random probes
 RR     round-robin probes over input strata (negatives, duplicates, long, other), fixed cycle
 U_guard  U + envelope guard + revocation (separate H11 ablation, not part of the primary)"""
from __future__ import annotations
import math, random
from typing import Dict, List, Optional, Tuple
from ..lvt3 import dsl
from ..lvt3.evaluator import Evaluator, reference
from ..lvt3.registry import Registry
from ..lvt3r2.agent import Meter, Budget, random_program, extensions, SEARCH_CAP

K_PROBES = 4
POOL = 32
CHECK_MAX = 60     # max consistency-check attempts when building rivals
RIVALS_MAX = 12
SCORE_INPUTS = 12  # pool inputs scored per probe


class Agent:
    def __init__(self, config: str, seed: int, ev: Evaluator, budget: Optional[float]):
        self.config, self.seed, self.ev = config, seed, ev
        self.budget = None if config == "A" else budget
        self.reg = None
        if config != "A":
            g = config == "U_guard"
            self.reg = Registry(ev, guard=g, revoke=g, reverify_seed=seed)

    def _check(self, p, ex, m):
        for x, y in ex:
            m.tick()
            if dsl.run(p, x) != y: return False
        return True

    def _structs(self, ex):
        return [c.struct for c in self.reg.usable(ex)] if self.reg else []

    def _find(self, task, ex, m, tried):
        srng = random.Random(f"r3search|{self.seed}|{task.task_id}|{len(ex)}")
        if self.reg is None:
            s0 = m.n
            while m.n - s0 < SEARCH_CAP:
                p = random_program(srng)
                if p in tried: continue
                tried.add(p)
                if self._check(p, ex, m): return p
            return None
        lib = (p for s in self._structs(ex) for p in extensions(s))
        lib_done, spent = False, 0
        while spent < SEARCH_CAP:
            if not lib_done:
                p = next(lib, None)
                if p is None: lib_done = True
                elif p not in tried:
                    tried.add(p)
                    if self._check(p, ex, m): return p
            p = random_program(srng)
            if p in tried: continue
            tried.add(p); b = m.n
            hit = self._check(p, ex, m); spent += m.n - b
            if hit: return p
        return None

    @staticmethod
    def _stratum(x):
        if any(v < 0 for v in x): return 0
        if len(set(x)) < len(x): return 1
        if len(x) >= 6: return 2
        return 3

    def _probe(self, cand, ex, avail, rng, m, step):
        if self.config in ("A", "R"):
            return rng.choice(avail)
        if self.config == "RR":
            want = step % 4
            for k in range(4):
                c = [x for x in avail if self._stratum(x) == (want + k) % 4]
                if c: return c[0]
            return avail[0]
        # U / U_guard: bounded rival set, prior weight = capability success count
        rivals: Dict[tuple, float] = {cand: 2.0}; attempts = 0
        cands = []
        for s in self._structs(ex):
            c = self.reg.caps.get(s); w = float(c.s) if c else 1.0
            cands.extend((p, w) for p in dsl.instances(s)[:8])
        cands.extend((p, 1.0) for p in dsl.mutations(cand)[::7])
        for p, w in cands:
            if attempts >= CHECK_MAX or len(rivals) >= RIVALS_MAX: break
            if p in rivals: continue
            attempts += 1
            if self._check(p, ex, m): rivals[p] = w
        if len(rivals) <= 1: return rng.choice(avail)
        tot = sum(rivals.values()); best, bh = None, 1e-12
        for x in avail[:SCORE_INPUTS]:
            g: Dict[tuple, float] = {}
            for p, w in rivals.items():
                m.tick(); y = dsl.run(p, x); g[y] = g.get(y, 0.0) + w
            h = -sum((w / tot) * math.log(w / tot) for w in g.values())
            if h > bh: best, bh = x, h
        return best if best is not None else rng.choice(avail)

    def solve(self, task):
        ex = [(x, reference(task.spec, x)) for x in task.visible_inputs]
        m = Meter(self.budget); rng = random.Random(f"r3probe|{self.seed}|{task.task_id}")
        pool = self.ev.probe_pool(task.task_id)[:POOL]
        used, tried = [], set(); cand, probes, hit, step = None, K_PROBES, False, 0
        try:
            while True:
                if cand is None:
                    cand = self._find(task, ex, m, tried)
                    if cand is None: break
                if probes == 0: break
                avail = [x for x in pool if x not in used]
                x = self._probe(cand, ex, avail, rng, m, step); step += 1
                used.append(x); probes -= 1
                y = self.ev.probe(task.spec, x); ex.append((x, y))
                if dsl.run(cand, x) != y: cand = None
        except Budget:
            hit = True
            if cand is not None and any(dsl.run(cand, a) != b for a, b in ex): cand = None
        return {"program": cand, "exec": m.n, "budget_hit": hit, "probes_used": K_PROBES - probes}

    def learn(self, task):
        r = self.solve(task); p = r["program"]
        if p is None or self.reg is None: return
        v = self.ev.verify(task.task_id, task.spec, lambda x, q=p: dsl.run(q, x))
        self.reg.record(dsl.structure(p), v, task, "dev" if task.split == "dev" else "train", self.ev.hidden_inputs(task.task_id))
