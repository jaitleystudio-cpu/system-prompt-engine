"""R2 configurations. Every program execution is counted as cost (consistency checks,
library candidates, probe scoring). Evaluator probes (k<=4) are identical across configs.
 A          random search over <=3-op programs, cap SEARCH_CAP executions
 B          naive library: every declared program's structure (no verification) + 1-op extensions,
            then search (cap SEARCH_CAP); same hard total budget as E_CAPPED (cost-matched primary)
 E          outcome-qualified registry (signed verdicts, fresh re-verification, guard, revocation)
            + extensions + entropy probe selection; search cap SEARCH_CAP, library/probe cost uncapped
 E_CAPPED   E with a hard total-execution budget per task (frozen = 1.2 x A's measured val cost)
 E_noguard  E without envelope/transfer guard and revocation          (H11 ablation)
 E_randprobe E with random probes instead of entropy probes           (H12 ablation)
 E_shufv    E whose qualification verdicts come from a decoy task's spec (randomized-feedback control)
"""
from __future__ import annotations
import math, random
from typing import Any, Dict, List, Optional, Tuple
from ..lvt3 import dsl
from ..lvt3.evaluator import Evaluator, reference
from ..lvt3.registry import Registry, Counter, consistent

SEARCH_CAP = 4000
K_PROBES = 4
MAX_RIVALS = 150
import os as _os
CAPPED_MODE = _os.environ.get("LVT3R2_CAPPED_MODE", "interleave")  # frozen value recorded in PREREG
E_FAMILY = ("E", "E_CAPPED", "E_noguard", "E_randprobe", "E_shufv")


class Budget(Exception):
    pass


class Meter:
    def __init__(self, cap: Optional[float]):
        self.n = 0; self.cap = cap
    def tick(self, k=1):
        self.n += k
        if self.cap is not None and self.n > self.cap: raise Budget()


def random_program(rng):
    L = rng.choice((1, 2, 3))
    return tuple(rng.choice(dsl.ALL_OPS) for _ in range(L))


def extensions(struct):
    yield from dsl.instances(struct)
    if len(struct) <= 2:
        for n in sorted(set(dsl.PARAM_RANGES) | set(dsl.NULLARY)):
            for s in ((n,) + struct, struct + (n,)):
                yield from dsl.instances(s)


class Agent:
    def __init__(self, config, seed, ev: Evaluator, budget: Optional[float] = None, decoys=None):
        self.config, self.seed, self.ev, self.decoys = config, seed, ev, decoys
        self.budget = budget if config in ("E_CAPPED", "B") else None
        self.lib: Dict[Tuple[str, ...], int] = {}
        self.reg = None
        if config in E_FAMILY:
            g = config != "E_noguard"
            self.reg = Registry(ev, guard=g, revoke=g, reverify_seed=seed)

    def _structs(self, examples):
        if self.config == "B":
            return [s for s, _ in sorted(self.lib.items(), key=lambda kv: (-kv[1], kv[0]))]
        if self.reg is not None:
            return [c.struct for c in self.reg.usable(examples)]
        return []

    def _check(self, prog, examples, m: Meter):
        for x, y in examples:
            m.tick()
            if dsl.run(prog, x) != y: return False
        return True

    def _lib_iter(self, examples):
        for s in self._structs(examples):
            yield from extensions(s)

    def _search_iter(self, task, examples):
        rng = random.Random(f"r2search|{self.seed}|{task.task_id}|{len(examples)}")
        while True:
            yield random_program(rng)

    def _find(self, task, examples, m: Meter, tried):
        s0 = m.n
        if self.config in ("E_CAPPED", "B") and CAPPED_MODE == "interleave":
            # cost-aware schedule (val-tuned, frozen in PREREG): alternate library and search
            lib, srch, lib_done = self._lib_iter(examples), self._search_iter(task, examples), False
            spent_search = 0
            while spent_search < SEARCH_CAP:
                for src, it in (("lib", lib), ("search", srch)):
                    if src == "lib" and lib_done: continue
                    p = next(it, None)
                    if p is None:
                        lib_done = True; continue
                    if p in tried: continue
                    tried.add(p); before = m.n
                    hit = self._check(p, examples, m)
                    if src == "search": spent_search += m.n - before
                    if hit: return p, src
            return None
        for p in self._lib_iter(examples):
            if p in tried: continue
            tried.add(p)
            if self._check(p, examples, m): return p, "lib"
        s0 = m.n
        for p in self._search_iter(task, examples):
            if m.n - s0 >= SEARCH_CAP: break
            if p in tried: continue
            tried.add(p)
            if self._check(p, examples, m): return p, "search"
        return None

    def _probe(self, cand, examples, avail, rng, m: Meter):
        if self.config not in E_FAMILY or self.config == "E_randprobe":
            return rng.choice(avail)
        rivals = {cand: 1.0}
        for s in self._structs(examples):
            c = self.reg.caps.get(s)
            for p in dsl.instances(s):
                if len(rivals) >= MAX_RIVALS: break
                if p not in rivals and self._check(p, examples, m):
                    rivals[p] = float(c.s if c else 1)
        for p in dsl.mutations(cand):
            if len(rivals) >= MAX_RIVALS: break
            if p not in rivals and self._check(p, examples, m):
                rivals[p] = 1.0
        if len(rivals) <= 1: return rng.choice(avail)
        tot = sum(rivals.values()); best, bh = None, 1e-12
        for x in avail:
            g: Dict[Tuple[int, ...], float] = {}
            for p, w in rivals.items():
                m.tick(); y = dsl.run(p, x); g[y] = g.get(y, 0.0) + w
            h = -sum((w / tot) * math.log(w / tot) for w in g.values())
            if h > bh: best, bh = x, h
        return best if best is not None else rng.choice(avail)

    def solve(self, task) -> Dict[str, Any]:
        examples = [(x, reference(task.spec, x)) for x in task.visible_inputs]
        m = Meter(self.budget)
        rng = random.Random(f"r2probe|{self.seed}|{task.task_id}")
        pool = self.ev.probe_pool(task.task_id)[:32]
        used, tried = [], set()
        cand, src, probes, budget_hit = None, None, K_PROBES, False
        try:
            while True:
                if cand is None:
                    r = self._find(task, examples, m, tried)
                    if r is None: break
                    cand, src = r
                if probes == 0: break
                avail = [x for x in pool if x not in used]
                x = self._probe(cand, examples, avail, rng, m)
                used.append(x); probes -= 1
                y = self.ev.probe(task.spec, x)
                examples.append((x, y))
                if dsl.run(cand, x) != y: cand, src = None, None
        except Budget:
            budget_hit = True  # keep current candidate only if consistent with all answers so far
            if cand is not None and any(dsl.run(cand, x) != y for x, y in examples): cand = None
        return {"program": cand, "source": src, "exec": m.n, "budget_hit": budget_hit}

    def feedback(self, task, res, learn: bool):
        if not learn or res["program"] is None: return
        prog = res["program"]; st = dsl.structure(prog)
        if self.config == "B":
            self.lib[st] = self.lib.get(st, 0) + 1; return
        if self.reg is None: return
        spec = self.decoys[task.task_id] if self.decoys else task.spec
        v = self.ev.verify(task.task_id, spec, lambda x, p=prog: dsl.run(p, x))
        self.reg.record(st, v, task, "dev" if task.split == "dev" else "train", self.ev.hidden_inputs(task.task_id))
