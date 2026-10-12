"""Capability registry: admission by signed evaluator outcomes + fresh re-verification,
applicability guard (input envelope + transfer record), and revocation."""
from __future__ import annotations
import hashlib, json, random
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional, Callable, Any
from . import dsl
from .evaluator import Evaluator, broad_input
from .generator import visible_input


class Counter:
    def __init__(self): self.n = 0


def consistent(fn: Callable, examples, ctr: Counter) -> bool:
    for x, y in examples:
        ctr.n += 1
        try:
            if tuple(fn(x)) != y: return False
        except Exception:
            return False
    return True


@dataclass
class Capability:
    cap_id: str
    struct: Optional[Tuple[str, ...]] = None
    s: int = 0
    f: int = 0
    admitted: bool = False
    revoked: bool = False
    env_max_len: int = 0
    env_neg: bool = False
    env_dup: bool = False
    dev_s: int = 0
    dev_f: int = 0
    evidence: List[Any] = field(default_factory=list)  # (task_id, spec) of verified successes
    claimed: Dict[str, Any] = field(default_factory=dict)  # ignored by design (forgery surface)

    def candidates(self, examples, ctr: Counter):
        """Yield programs (callables with .prog) consistent with examples."""
        for prog in dsl.instances(self.struct):
            fn = lambda x, p=prog: dsl.run(p, x)
            if consistent(fn, examples, ctr):
                yield prog

    def fit_callable(self, examples, ctr: Counter) -> Optional[Callable]:
        for prog in self.candidates(examples, ctr):
            return lambda x, p=prog: dsl.run(p, x)
        return None


class Registry:
    def __init__(self, evaluator: Evaluator, guard: bool, revoke: bool, reverify_seed: int):
        self.ev = evaluator
        self.use_guard = guard
        self.use_revoke = revoke
        self.caps: Dict[Tuple[str, ...], Capability] = {}
        self.rng = random.Random(f"registry|{reverify_seed}")
        self.log: List[Dict[str, Any]] = []

    # ---- outcome qualification ----
    def record(self, struct, verdict: Dict[str, Any], task, split: str, inputs) -> None:
        if not Evaluator.check_signature(verdict) or verdict["task_id"] != task.task_id:
            raise ValueError("unsigned or mismatched verdict rejected")
        cap = self.caps.setdefault(struct, Capability(cap_id="|".join(struct), struct=struct))
        if verdict["pass"]:
            cap.s += 1
            cap.evidence.append((task.task_id, task.spec))
            for x in inputs:
                cap.env_max_len = max(cap.env_max_len, len(x))
                cap.env_neg |= any(v < 0 for v in x)
                cap.env_dup |= len(set(x)) < len(x)
            if split == "dev": cap.dev_s += 1
        else:
            cap.f += 1
            if split == "dev": cap.dev_f += 1
        if not cap.admitted and not cap.revoked and cap.s >= 2 and cap.s / (cap.s + cap.f) >= 0.8:
            if self.reverify(cap):
                cap.admitted = True
                self._log("admit", cap)
        if self.use_revoke and cap.admitted and not cap.revoked and cap.f >= 2 and cap.s / (cap.s + cap.f) < 0.7:
            cap.revoked = True
            self._log("revoke", cap)

    def reverify(self, cap, seen=None) -> bool:
        """Fresh draws: capability must re-solve its two latest evidence specs from new visible
        examples and pass on new broad inputs it has never seen (defeats leaky/overfit caps)."""
        for task_id, spec in cap.evidence[-2:]:
            vis = [visible_input(self.rng) for _ in range(3)]
            ex = [(x, self.ev.probe(spec, x)) for x in vis]
            fn = cap.fit_callable(ex, Counter())
            if fn is None: return False
            fresh = [broad_input(self.rng) for _ in range(12)]
            if seen is not None: seen.extend(fresh)
            if not self.ev.verify(task_id + "#reverify", spec, fn, fresh)["pass"]:
                return False
        return True

    def admit_external(self, cap: Capability, evidence_tasks) -> bool:
        """Admission path for externally supplied capabilities (used by mutation tests).
        Claimed verdicts/hashes are ignored; only fresh re-verification counts."""
        cap.evidence = [(t.task_id, t.spec) for t in evidence_tasks]
        seen = []
        ok = len(cap.evidence) >= 2 and self.reverify(cap, seen)
        cap.admitted = ok
        if ok:  # envelope = domain actually verified on during fresh re-verification
            cap.env_max_len = max(len(x) for x in seen)
            cap.env_neg = any(v < 0 for x in seen for v in x)
            cap.env_dup = any(len(set(x)) < len(x) for x in seen)
        if ok: self.caps[cap.struct or (cap.cap_id,)] = cap
        self._log("admit" if ok else "reject", cap)
        return ok

    # ---- applicability guard ----
    def usable(self, examples) -> List[Capability]:
        out = []
        for cap in self.caps.values():
            if not cap.admitted or cap.revoked: continue
            if self.use_guard:
                if cap.dev_f > 0 and cap.dev_s == 0: continue  # failed transfer qualification
                for x, _ in examples:
                    if len(x) > cap.env_max_len or (any(v < 0 for v in x) and not cap.env_neg) \
                            or (len(set(x)) < len(x) and not cap.env_dup):
                        break
                else:
                    out.append(cap)
            else:
                out.append(cap)
        return sorted(out, key=lambda c: (-c.s, c.cap_id))

    def _log(self, kind, cap):
        rec = {"event": kind, "cap": cap.cap_id, "s": cap.s, "f": cap.f}
        rec["hash"] = hashlib.sha256(json.dumps(rec, sort_keys=True).encode()).hexdigest()
        self.log.append(rec)
