"""Task generator: samples families/params and visible (underspecified) examples.
Never computes hidden verdicts."""
from __future__ import annotations
import random
from dataclasses import dataclass
from typing import List, Tuple, Any
from .dsl import PARAM_RANGES

FAMILIES = {
    "T1": ("train", ("sort", "take")), "T2": ("train", ("add", "rev")), "T3": ("train", ("mul", "cumsum")),
    "T4": ("train", ("fgt", "sort")), "T5": ("train", ("rot",)), "T6": ("train", ("mod", "dedup")),
    "D1": ("dev", ("sortd", "take")), "D2": ("dev", ("add", "cumsum")), "D3": ("dev", ("abs", "sort")),
    "H1": ("hidden", ("sort", "drop")), "H2": ("hidden", ("abs", "rev")), "H3": ("hidden", ("add", "rev")),
    "H4": ("hidden", ("mul", "cumsum")), "H5": ("hidden", ("dedup", "sort")), "H6": ("hidden", ("rot",)),
}
TRANSFER = {"H3", "H4", "H6"}
TRAPS = {"H2", "H5"}
TASKS_PER_FAMILY = 20


@dataclass(frozen=True)
class Task:
    task_id: str
    family: str
    split: str
    spec: Tuple[Tuple[str, Any], ...]  # ground truth, only handed to the evaluator
    visible_inputs: Tuple[Tuple[int, ...], ...]


def visible_input(rng: random.Random) -> Tuple[int, ...]:
    n = rng.randint(3, 6)
    return tuple(rng.sample(range(1, 10), n))


def make_tasks(seed: int) -> List[Task]:
    rng = random.Random(f"gen|{seed}")
    tasks = []
    for fam, (split, struct) in FAMILIES.items():
        for i in range(TASKS_PER_FAMILY):
            spec = tuple((n, rng.choice(PARAM_RANGES[n]) if n in PARAM_RANGES else None) for n in struct)
            vis = tuple(visible_input(rng) for _ in range(3))
            tasks.append(Task(f"s{seed}-{fam}-{i:02d}", fam, split, spec, vis))
    return tasks


def stream(seed: int) -> List[Task]:
    tasks = make_tasks(seed)
    rng = random.Random(f"order|{seed}")
    out = []
    for split in ("train", "dev", "hidden"):
        part = [t for t in tasks if t.split == split]
        rng.shuffle(part); out.extend(part)
    return out
