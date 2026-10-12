"""Independent evaluator: own reference semantics, own seed streams, signed verdicts.
Deliberately does NOT import the solver interpreter (dsl.py)."""
from __future__ import annotations
import hashlib, hmac, random
from typing import Dict, List, Tuple, Callable, Any

_KEY = b"lvt3-evaluator-local-research-key"  # research-only integrity key, not a secret


def _ref(name: str, p, xs: List[int]) -> List[int]:
    # Independent re-implementation (different code paths from dsl.apply_op)
    if name == "add": return [v + p for v in xs]
    if name == "mul": return [v * p for v in xs]
    if name == "mod": return [v - p * (v // p) for v in xs]
    if name == "abs": return [v if v >= 0 else -v for v in xs]
    if name == "neg": return [0 - v for v in xs]
    if name == "rev": return xs[::-1]
    if name == "sort":
        r = list(xs); r.sort(); return r
    if name == "sortd":
        r = list(xs); r.sort(); return r[::-1]
    if name == "take": return xs[0:p]
    if name == "drop": return xs[p:len(xs)]
    if name == "rot":
        n = len(xs)
        return [xs[(i + p) % n] for i in range(n)] if n else []
    if name == "cumsum":
        r = []
        for i in range(len(xs)): r.append(sum(xs[: i + 1]))
        return r
    if name == "fgt": return [v for v in xs if not v <= p]
    if name == "feven": return [v for v in xs if v % 2 == 0]
    if name == "dedup":
        r = []
        for v in xs:
            if v not in r: r.append(v)
        return r
    raise ValueError(name)


def reference(spec: Tuple[Tuple[str, Any], ...], xs) -> Tuple[int, ...]:
    cur = list(xs)
    for name, p in spec:
        cur = _ref(name, p, cur)
    return tuple(cur)


def broad_input(rng: random.Random) -> Tuple[int, ...]:
    return tuple(rng.randint(-9, 9) for _ in range(rng.randint(0, 9)))


def sign(payload: str) -> str:
    return hmac.new(_KEY, payload.encode(), hashlib.sha256).hexdigest()


class Evaluator:
    """Sole source of hidden verdicts, probe answers and train/dev feedback."""

    def __init__(self, seed: int):
        self.seed = seed
        self.calls = 0

    def hidden_inputs(self, task_id: str) -> List[Tuple[int, ...]]:
        rng = random.Random(f"hidden|{self.seed}|{task_id}")
        return [broad_input(rng) for _ in range(12)]

    def probe_pool(self, task_id: str) -> List[Tuple[int, ...]]:
        rng = random.Random(f"probe|{self.seed}|{task_id}")
        hidden = set(self.hidden_inputs(task_id))
        pool, seen = [], set()
        while len(pool) < 64:
            x = broad_input(rng)
            if x in hidden or x in seen: continue
            seen.add(x); pool.append(x)
        return pool

    def probe(self, spec, xs) -> Tuple[int, ...]:
        self.calls += 1
        return reference(spec, xs)

    def verify(self, task_id: str, spec, fn: Callable[[Tuple[int, ...]], Tuple[int, ...]],
               inputs: List[Tuple[int, ...]] = None) -> Dict[str, Any]:
        inputs = inputs if inputs is not None else self.hidden_inputs(task_id)
        ok = True
        for x in inputs:
            try:
                if tuple(fn(x)) != reference(spec, x): ok = False; break
            except Exception:
                ok = False; break
        payload = f"{task_id}|{ok}"
        return {"task_id": task_id, "pass": ok, "sig": sign(payload)}

    @staticmethod
    def check_signature(v: Dict[str, Any]) -> bool:
        return hmac.compare_digest(v.get("sig", ""), sign(f"{v.get('task_id')}|{v.get('pass')}"))
