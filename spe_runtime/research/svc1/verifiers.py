"""Matched-noise verifier tiers for SVC-1 R0."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass

TIER_COST = {"V0": 1, "V1": 5, "V2": 20}
TIER_ACC = {"V0": 0.62, "V1": 0.78, "V2": 0.95}


def _u01(item_id: int, tier: str, seed: int, tag: str = "v") -> float:
    h = hashlib.sha256(f"svc1|{seed}|{item_id}|{tier}|{tag}".encode()).hexdigest()
    return int(h[:16], 16) / 2**64


@dataclass(frozen=True)
class Claim:
    item_id: int
    truth: bool
    difficulty: str  # easy|medium|hard


def make_claims(n: int = 200, master: str = "svc1-r0-holdout-v1") -> list[Claim]:
    base = int(hashlib.sha256(master.encode()).hexdigest()[:16], 16)
    claims: list[Claim] = []
    for i in range(n):
        u = int(hashlib.sha256(f"{base}|item|{i}".encode()).hexdigest()[:16], 16) / 2**64
        truth = (int(hashlib.sha256(f"{base}|truth|{i}".encode()).hexdigest()[:16], 16) % 2) == 0
        if u < 0.40:
            diff = "easy"
        elif u < 0.80:
            diff = "medium"
        else:
            diff = "hard"
        claims.append(Claim(i, truth, diff))
    return claims


def verify(claim: Claim, tier: str, seed: int, resample: int = 0) -> tuple[bool, float]:
    """Return (predicted_label, confidence_proxy in [0,1]). Matched noise across conditions."""
    if tier not in TIER_ACC:
        raise ValueError(tier)
    acc = TIER_ACC[tier]
    # difficulty slightly degrades effective accuracy (declared in contract via feature noise)
    adj = {"easy": 0.06, "medium": 0.0, "hard": -0.08}[claim.difficulty]
    p_correct = min(0.99, max(0.51, acc + adj))
    flip = _u01(claim.item_id, tier, seed, f"flip|{resample}") > p_correct
    pred = (not claim.truth) if flip else claim.truth
    # confidence proxy: distance from decision boundary using second hash (not truth-leaking)
    conf = 0.5 + 0.5 * abs(_u01(claim.item_id, tier, seed, f"conf|{resample}") - 0.5) * (0.4 + 0.6 * (p_correct - 0.5) / 0.5)
    conf = float(min(0.99, max(0.5, conf)))
    return pred, conf
