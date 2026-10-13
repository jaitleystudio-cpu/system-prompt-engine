"""Allocation policies under fixed budget B."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
from .verifiers import Claim, TIER_COST, verify


@dataclass
class RunResult:
    condition: str
    seed: int
    accuracy: float
    answered: float
    cost_used: int
    n_correct: int
    n_answered: int
    n_holdout: int
    budget: int


def _u01(seed: int, item_id: int, tag: str) -> float:
    h = hashlib.sha256(f"pol|{seed}|{item_id}|{tag}".encode()).hexdigest()
    return int(h[:16], 16) / 2**64


def _score(preds: dict[int, bool], holdout: list[Claim], budget: int, cost: int) -> RunResult:
    n = len(holdout)
    correct = 0
    answered = 0
    for c in holdout:
        if c.item_id in preds:
            answered += 1
            if preds[c.item_id] == c.truth:
                correct += 1
    return RunResult(
        condition="",
        seed=-1,
        accuracy=correct / n,
        answered=answered / n,
        cost_used=cost,
        n_correct=correct,
        n_answered=answered,
        n_holdout=n,
        budget=budget,
    )


def always_v2(holdout: list[Claim], seed: int, budget: int) -> RunResult:
    preds: dict[int, bool] = {}
    cost = 0
    for c in holdout:
        if cost + TIER_COST["V2"] > budget:
            break
        pred, _ = verify(c, "V2", seed)
        preds[c.item_id] = pred
        cost += TIER_COST["V2"]
    r = _score(preds, holdout, budget, cost)
    r.condition, r.seed = "always_v2", seed
    return r


def always_v0(holdout: list[Claim], seed: int, budget: int) -> RunResult:
    preds: dict[int, bool] = {}
    cost = 0
    for c in holdout:
        if cost + TIER_COST["V0"] > budget:
            break
        pred, _ = verify(c, "V0", seed)
        preds[c.item_id] = pred
        cost += TIER_COST["V0"]
    r = _score(preds, holdout, budget, cost)
    r.condition, r.seed = "always_v0", seed
    return r


def fixed_cascade(holdout: list[Claim], seed: int, budget: int) -> RunResult:
    preds: dict[int, bool] = {}
    cost = 0
    step = TIER_COST["V0"] + TIER_COST["V1"] + TIER_COST["V2"]
    for c in holdout:
        if cost + step > budget:
            break
        # always escalate; final label = V2
        verify(c, "V0", seed)
        verify(c, "V1", seed)
        pred, _ = verify(c, "V2", seed)
        preds[c.item_id] = pred
        cost += step
    r = _score(preds, holdout, budget, cost)
    r.condition, r.seed = "fixed_cascade", seed
    return r


def random_defer(holdout: list[Claim], seed: int, budget: int) -> RunResult:
    preds: dict[int, bool] = {}
    cost = 0
    # probs ∝ 1/cost → V0:1, V1:1/5, V2:1/20 → normalize
    weights = [("V0", 1.0), ("V1", 0.2), ("V2", 0.05)]
    tw = sum(w for _, w in weights)
    for c in holdout:
        u = _u01(seed, c.item_id, "tier")
        acc = 0.0
        tier = "V0"
        for name, w in weights:
            acc += w / tw
            if u <= acc:
                tier = name
                break
        need = TIER_COST[tier]
        if cost + need > budget:
            break
        pred, _ = verify(c, tier, seed)
        preds[c.item_id] = pred
        cost += need
    r = _score(preds, holdout, budget, cost)
    r.condition, r.seed = "random_defer", seed
    return r


def calibrate_tau(calib: list[Claim], seed: int) -> float:
    """Pick τ on calibration set only: maximize calib accuracy under local cascade with early exit."""
    best_tau, best_acc = 0.70, -1.0
    for t_i in range(50, 90):
        tau = t_i / 100.0
        correct = 0
        for c in calib:
            pred = _cascade_one(c, seed, tau)
            if pred == c.truth:
                correct += 1
        acc = correct / max(1, len(calib))
        if acc > best_acc:
            best_acc, best_tau = acc, tau
    return best_tau


def _cascade_one(c: Claim, seed: int, tau: float) -> bool:
    p0, conf0 = verify(c, "V0", seed, resample=0)
    p0b, _ = verify(c, "V0", seed, resample=1)
    if p0 == p0b and conf0 >= tau:
        return p0
    p1, conf1 = verify(c, "V1", seed)
    if conf1 >= tau:
        return p1
    p2, _ = verify(c, "V2", seed)
    return p2


def _cascade_one_cost(c: Claim, seed: int, tau: float) -> tuple[bool, int]:
    cost = 0
    p0, conf0 = verify(c, "V0", seed, resample=0)
    cost += TIER_COST["V0"]
    p0b, _ = verify(c, "V0", seed, resample=1)
    cost += TIER_COST["V0"]  # resample costs V0 again (honest)
    if p0 == p0b and conf0 >= tau:
        return p0, cost
    p1, conf1 = verify(c, "V1", seed)
    cost += TIER_COST["V1"]
    if conf1 >= tau:
        return p1, cost
    p2, _ = verify(c, "V2", seed)
    cost += TIER_COST["V2"]
    return p2, cost


def spe_svc(calib: list[Claim], holdout: list[Claim], seed: int, budget: int) -> tuple[RunResult, float]:
    tau = calibrate_tau(calib, seed)
    # priority: hard first, then medium, then easy; stable by id
    order = sorted(holdout, key=lambda c: ({"hard": 0, "medium": 1, "easy": 2}[c.difficulty], c.item_id))
    preds: dict[int, bool] = {}
    cost = 0
    for c in order:
        # estimate worst-case remaining need (V0+V0+V1+V2=27) — only start if affordable at least V0+V0
        if cost + 2 > budget:
            break
        pred, used = _cascade_one_cost(c, seed, tau)
        if cost + used > budget:
            # try cheap-only exit if remaining allows V0+V0
            if cost + 2 <= budget:
                p0, conf0 = verify(c, "V0", seed, resample=0)
                p0b, _ = verify(c, "V0", seed, resample=1)
                cost += 2
                if p0 == p0b:
                    preds[c.item_id] = p0
            break
        preds[c.item_id] = pred
        cost += used
    r = _score(preds, holdout, budget, cost)
    r.condition, r.seed = "spe_svc", seed
    return r, tau
