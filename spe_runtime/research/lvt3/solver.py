"""Configurations A–E and E_shuf (see docs/lvt3/CONTRACT.md §4)."""
from __future__ import annotations
import math, random
from typing import Dict, Any, List, Tuple
from . import dsl
from .evaluator import Evaluator, reference
from .registry import Registry, Counter, consistent

SEARCH_CAP = 4000
K_PROBES = 4
ALL_PROGS = dsl.all_programs()


class Agent:
    def __init__(self, config: str, seed: int, evaluator: Evaluator, decoys: Dict[str, Any] = None):
        self.config = config
        self.seed = seed
        self.ev = evaluator
        self.library: List[dsl.Program] = []  # B
        self.decoys = decoys  # E_shuf: task_id -> decoy spec
        self.reg = None
        if config in ("C", "D", "E", "E_shuf"):
            self.reg = Registry(evaluator, guard=config != "C", revoke=config != "C", reverify_seed=seed)

    def _answer_spec(self, task):
        return self.decoys[task.task_id] if self.decoys else task.spec

    def _cand_iter(self, task, examples, search_ctr):
        if self.config == "B":
            for p in list(self.library):
                yield p, "library"
        if self.reg is not None:
            for cap in self.reg.usable(examples):
                for p in dsl.instances(cap.struct):
                    yield p, cap.struct
        order = list(range(len(ALL_PROGS)))
        random.Random(f"search|{self.seed}|{task.task_id}").shuffle(order)
        for i in order:
            yield ALL_PROGS[i], "search"

    def _choose_probe(self, task, cand, examples, pool, used, rng, ctr) -> Tuple[int, ...]:
        avail = [x for x in pool if x not in used]
        if self.config not in ("E", "E_shuf"):
            return rng.choice(avail)
        # H12: counterfactual rival set, prior-weighted output entropy
        rivals = {cand: 1.0}
        for cap in self.reg.usable(examples):
            for p in cap.candidates(examples, ctr):
                rivals[p] = rivals.get(p, 0.0) + float(cap.s)
        for m in dsl.mutations(cand):
            if consistent(lambda x, p=m: dsl.run(p, x), examples, ctr):
                rivals.setdefault(m, 1.0)
        if len(rivals) <= 1:
            return rng.choice(avail)
        best, best_h = None, -1.0
        tot = sum(rivals.values())
        for x in avail:
            groups: Dict[Tuple[int, ...], float] = {}
            for p, w in rivals.items():
                ctr.n += 1
                y = dsl.run(p, x)
                groups[y] = groups.get(y, 0.0) + w
            h = -sum((w / tot) * math.log(w / tot) for w in groups.values())
            if h > best_h + 1e-12:
                best, best_h = x, h
        return best if best_h > 1e-12 else rng.choice(avail)

    def solve(self, task) -> Dict[str, Any]:
        examples = [(x, reference(task.spec, x)) for x in task.visible_inputs]
        search_ctr, extra_ctr = Counter(), Counter()
        rng = random.Random(f"probe-rng|{self.seed}|{task.task_id}")
        pool = self.ev.probe_pool(task.task_id)
        used: List[Tuple[int, ...]] = []
        it = self._cand_iter(task, examples, search_ctr)
        cand, source, probes_left = None, None, K_PROBES
        while True:
            if cand is None:
                for p, src in it:
                    if search_ctr.n >= SEARCH_CAP: break
                    if consistent(lambda x, q=p: dsl.run(q, x), examples, search_ctr):
                        cand, source = p, src; break
                if cand is None:
                    break  # exhausted or cap -> abstain
            if probes_left == 0:
                break
            x = self._choose_probe(task, cand, examples, pool, used, rng, extra_ctr)
            used.append(x); probes_left -= 1
            y = self.ev.probe(self._answer_spec(task), x)
            examples.append((x, y))
            if dsl.run(cand, x) != y:
                cand, source = None, None
        return {"program": cand, "source": source, "search_exec": search_ctr.n,
                "extra_exec": extra_ctr.n, "examples": examples}

    def feedback(self, task, result) -> None:
        prog = result["program"]
        if self.config == "B" and prog is not None and prog not in self.library:
            self.library.append(prog)
        if self.reg is None or task.split == "hidden" or prog is None:
            return
        fn = lambda x, p=prog: dsl.run(p, x)
        verdict = self.ev.verify(task.task_id, self._answer_spec(task), fn)
        self.reg.record(dsl.structure(prog), verdict, task, task.split,
                        self.ev.hidden_inputs(task.task_id))
