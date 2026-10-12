"""R2 task families. Family = op-name structure. Splits are disjoint by family.
Train: 2-op and 3-op families. dev/val/holdout: 3-op families, each tagged
'transfer' (contains a train 2-op structure as a contiguous sub-structure), 'novel'
(no contiguous 2-op sub-structure seen in train), or 'long' (novel-or-transfer with
visible inputs longer than any verification envelope -> where an applicability guard could matter)."""
from __future__ import annotations
import hashlib, json, random
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple
from ..lvt3.dsl import PARAM_RANGES, NULLARY

NAMES = sorted(list(PARAM_RANGES) + NULLARY)  # 15 op names
TASKS_PER_FAMILY = 5
N_HOLDOUT_MAX = 80


@dataclass(frozen=True)
class Task:
    task_id: str
    family: str
    split: str
    kind: str
    spec: Tuple[Tuple[str, Any], ...]
    visible_inputs: Tuple[Tuple[int, ...], ...]


def _ok(struct):
    return all(a != b for a, b in zip(struct, struct[1:]))


def _subs(struct):
    return {tuple(struct[i:i + 2]) for i in range(len(struct) - 1)}


def family_plan(n_holdout: int = N_HOLDOUT_MAX) -> Dict[str, List[Dict[str, Any]]]:
    rng = random.Random("lvt3r2-family-plan-v1")
    used = set()
    def fresh(length):
        while True:
            s = tuple(rng.choice(NAMES) for _ in range(length))
            if _ok(s) and s not in used:
                used.add(s); return s
    train = [fresh(2) for _ in range(30)] + [fresh(3) for _ in range(20)]
    train_subs = set(s for s in train if len(s) == 2) | set().union(*[_subs(s) for s in train if len(s) == 3])
    train2 = [s for s in train if len(s) == 2]
    def transfer():
        while True:
            b = rng.choice(train2); o = rng.choice(NAMES)
            s = (o,) + b if rng.random() < 0.5 else b + (o,)
            if _ok(s) and s not in used:
                used.add(s); return s
    def novel():
        while True:
            s = tuple(rng.choice(NAMES) for _ in range(3))
            if _ok(s) and s not in used and not (_subs(s) & train_subs):
                used.add(s); return s
    def evalsplit(n):
        out = []
        for i in range(n):
            k = ("transfer", "novel", "transfer", "novel", "long")[i % 5]
            out.append({"struct": transfer() if k in ("transfer", "long") else novel(), "kind": k})
        return out
    plan = {"train": [{"struct": s, "kind": "train"} for s in train],
            "dev": evalsplit(15), "val": evalsplit(20), "holdout": evalsplit(n_holdout)}
    for split, fams in plan.items():
        for i, f in enumerate(fams):
            f["family"] = f"{split[:2].upper()}{i:02d}-" + "+".join(f["struct"])
    return plan


def manifest_hash(plan) -> str:
    return hashlib.sha256(json.dumps(plan, sort_keys=True, default=list).encode()).hexdigest()


def _visible(rng, long=False):
    if long:
        return tuple(rng.sample(range(1, 20), rng.randint(10, 12)))
    return tuple(rng.sample(range(1, 10), rng.randint(3, 6)))


def make_tasks(split: str, seed: int, plan=None) -> List[Task]:
    plan = plan or family_plan()
    out = []
    for f in plan[split]:
        rng = random.Random(f"r2task|{seed}|{f['family']}")
        for i in range(TASKS_PER_FAMILY):
            spec = tuple((n, rng.choice(PARAM_RANGES[n]) if n in PARAM_RANGES else None) for n in f["struct"])
            vis = tuple(_visible(rng, f["kind"] == "long") for _ in range(3))
            out.append(Task(f"r2s{seed}-{f['family']}-{i}", f["family"], split, f["kind"], spec, vis))
    random.Random(f"r2order|{seed}|{split}").shuffle(out)
    return out
