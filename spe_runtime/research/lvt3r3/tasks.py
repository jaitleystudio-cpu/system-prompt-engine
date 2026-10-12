"""Fresh R3 evaluation families: 3-op structures never used in R1 (all <=2 ops) or in any R2 split.
Learning still uses R2 train+dev families (never evaluated in R3)."""
from __future__ import annotations
import random
from typing import Dict, List
from ..lvt3r2.tasks import NAMES, Task, TASKS_PER_FAMILY, _ok, _subs, _visible, family_plan as r2_plan, manifest_hash
from ..lvt3.dsl import PARAM_RANGES
from ..lvt3.generator import FAMILIES as R1_FAMILIES

N_HOLDOUT_MAX = 120


def r3_plan(n_holdout: int = N_HOLDOUT_MAX) -> Dict[str, List[Dict]]:
    r2 = r2_plan()
    used = {tuple(f["struct"]) for fams in r2.values() for f in fams} | {tuple(v[1]) for v in R1_FAMILIES.values()}
    train = [tuple(f["struct"]) for f in r2["train"]]
    train_subs = {s for s in train if len(s) == 2} | set().union(*[_subs(s) for s in train if len(s) == 3])
    rng = random.Random("lvt3r3-family-plan-v1")
    def draw(kind):
        while True:
            s = tuple(rng.choice(NAMES) for _ in range(3))
            if not _ok(s) or s in used: continue
            t = bool(_subs(s) & train_subs)
            if (kind == "transfer") == t:
                used.add(s); return s
    plan = {}
    for split, n in (("r3val", 24), ("r3holdout", n_holdout)):
        plan[split] = []
        for i in range(n):
            k = ("transfer", "novel")[i % 2]
            plan[split].append({"struct": draw(k), "kind": k, "family": f"{'RV' if split == 'r3val' else 'RH'}{i:03d}-"})
        for f in plan[split]: f["family"] += "+".join(f["struct"])
    return plan


def make_tasks(split: str, seed: int, plan=None) -> List[Task]:
    if split in ("train", "dev"):
        from ..lvt3r2.tasks import make_tasks as mk
        return mk(split, seed)
    plan = plan or r3_plan()
    out = []
    for f in plan[split]:
        rng = random.Random(f"r3task|{seed}|{f['family']}")
        for i in range(TASKS_PER_FAMILY):
            spec = tuple((n, rng.choice(PARAM_RANGES[n]) if n in PARAM_RANGES else None) for n in f["struct"])
            vis = tuple(_visible(rng) for _ in range(3))
            out.append(Task(f"r3s{seed}-{f['family']}-{i}", f["family"], split, f["kind"], spec, vis))
    random.Random(f"r3order|{seed}|{split}").shuffle(out)
    return out
