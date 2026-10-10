"""SPE LVT-2 paired research gate — stdlib-only, fail-closed.
This module never grants production qualification. Submitted data/provenance
are caller claims until an independent evaluation and custody authority checks them.
"""
from __future__ import annotations
from collections import defaultdict
from dataclasses import asdict, dataclass
import hashlib
import json
import math
import re
from typing import Sequence

VERSION = "SPE-LVT2-RESEARCH-v0.1"
_DIGEST = re.compile(r"[0-9a-f]{64}\\Z")


class StudyInvalid(ValueError):
    """Invalid or untrustworthy input; not a negative experimental score."""


@dataclass(frozen=True)
class Observation:
    item_id: str
    family_id: str
    content_sha256: str
    base_score: float
    candidate_score: float
    shuffled_score: float | None = None


@dataclass(frozen=True)
class StudyProtocol:
    study_id: str
    evaluator_id: str
    generator_id: str
    evaluator_kind: str
    oracle_digest: str
    model_digest: str
    alpha: float
    primary_effect_floor: float
    min_heldout_families: int
    family_level_significance: bool
    multiplicity: int


@dataclass(frozen=True)
class StudyResult:
    status: str
    reasons: tuple[str, ...]
    p_value: float
    alpha_adjusted: float
    holdout_candidate_minus_base: float
    family_macro_delta: float
    holdout_base_mean: float
    holdout_candidate_mean: float
    train_candidate_minus_base: float
    train_candidate_minus_shuffled: float
    train_family_count: int
    holdout_family_count: int
    evidence_hash: str
    production_qualified: bool = False
    statistical_method: str = "ONE_SIDED_EXACT_FAMILY_SIGN_TEST"
    version: str = VERSION


def _finite_score(value: object) -> bool:
    return type(value) in (float, int) and math.isfinite(value) and 0.0 <= value <= 1.0


def _valid_positive_int(value: object) -> bool:
    return type(value) is int and value > 0


def exact_sign_p(positives: int, negatives: int) -> float:
    """One-sided exact binomial sign test of family-level direction, ties excluded."""
    if type(positives) is not int or type(negatives) is not int or min(positives, negatives) < 0:
        raise StudyInvalid("invalid sign counts")
    n = positives + negatives
    if n == 0:
        return 1.0
    log2n = n * math.log(2.0)
    p = math.fsum(
        math.exp(
            math.lgamma(n + 1) - math.lgamma(k + 1) -
            math.lgamma(n - k + 1) - log2n
        )
        for k in range(positives, n + 1)
    )
    return max(0.0, min(1.0, p))


def _validate(protocol: StudyProtocol, train: Sequence[Observation],
              heldout: Sequence[Observation]) -> None:
    if not all(isinstance(getattr(protocol, key), str) and getattr(protocol, key).strip()
               for key in ("study_id", "evaluator_id", "generator_id")):
        raise StudyInvalid("missing study/evaluator/generator identity")
    if (protocol.evaluator_id == protocol.generator_id
            or protocol.evaluator_kind == "generating_model_self"):
        raise StudyInvalid("self-certification prohibited")
    if protocol.evaluator_kind != "independent_static_oracle":
        raise StudyInvalid("evaluator_kind not independently constrained")
    for key in ("oracle_digest", "model_digest"):
        d = getattr(protocol, key)
        if not isinstance(d, str) or not _DIGEST.fullmatch(d):
            raise StudyInvalid(f"invalid {key}")
    if (type(protocol.alpha) not in (int, float) or not math.isfinite(protocol.alpha)
            or not 0 < protocol.alpha < 1):
        raise StudyInvalid("invalid alpha")
    if not _finite_score(protocol.primary_effect_floor):
        raise StudyInvalid("invalid primary_effect_floor")
    if not _valid_positive_int(protocol.min_heldout_families):
        raise StudyInvalid("invalid min_heldout_families")
    if not _valid_positive_int(protocol.multiplicity):
        raise StudyInvalid("invalid multiplicity")
    if protocol.family_level_significance is not True:
        raise StudyInvalid("family-level statistical unit required")
    if not train or not heldout:
        raise StudyInvalid("empty train or heldout")
    for label, rows in (("train", train), ("heldout", heldout)):
        ids, digests = set(), set()
        for row in rows:
            if not isinstance(row, Observation):
                raise StudyInvalid(f"invalid {label} observation")
            if not row.item_id or not row.family_id:
                raise StudyInvalid("missing item or family ID")
            if row.item_id in ids:
                raise StudyInvalid("duplicate item_id")
            ids.add(row.item_id)
            if not isinstance(row.content_sha256, str) or not _DIGEST.fullmatch(row.content_sha256):
                raise StudyInvalid("bad content digest")
            if row.content_sha256 in digests:
                raise StudyInvalid("duplicate content digest")
            digests.add(row.content_sha256)
            if not _finite_score(row.base_score) or not _finite_score(row.candidate_score):
                raise StudyInvalid("invalid score")
            if label == "train" and not _finite_score(row.shuffled_score):
                raise StudyInvalid("invalid shuffled control score")
            if label == "heldout" and row.shuffled_score is not None and not _finite_score(row.shuffled_score):
                raise StudyInvalid("invalid score")
    if set(v.item_id for v in train) & set(v.item_id for v in heldout):
        raise StudyInvalid("item_id overlap / contamination")
    if set(v.family_id for v in train) & set(v.family_id for v in heldout):
        raise StudyInvalid("family overlap / contamination")
    if set(v.content_sha256 for v in train) & set(v.content_sha256 for v in heldout):
        raise StudyInvalid("content overlap / contamination")


def _mean(seq: Sequence[float]) -> float:
    return math.fsum(seq) / len(seq)


def _hash_evidence(protocol: StudyProtocol, train: Sequence[Observation],
                   heldout: Sequence[Observation]) -> str:
    obj = {
        "version": VERSION, "protocol": asdict(protocol),
        "train": [asdict(v) for v in sorted(train, key=lambda v: v.item_id)],
        "heldout": [asdict(v) for v in sorted(heldout, key=lambda v: v.item_id)],
    }
    canonical = json.dumps(obj, sort_keys=True, allow_nan=False, separators=(",", ":")).encode()
    return hashlib.sha256(canonical).hexdigest()


def run_study(protocol: StudyProtocol, train: Sequence[Observation],
              heldout: Sequence[Observation]) -> StudyResult:
    """Calculate evidence only, never a production authorization/qualification."""
    _validate(protocol, train, heldout)
    grouped: dict[str, list[float]] = defaultdict(list)
    for row in heldout:
        grouped[row.family_id].append(row.candidate_score - row.base_score)
    family_delta = [_mean(v) for _, v in sorted(grouped.items())]
    positives = sum(d > 1e-12 for d in family_delta)
    negatives = sum(d < -1e-12 for d in family_delta)
    p_value = exact_sign_p(positives, negatives)
    train_base = _mean([v.base_score for v in train])
    train_candidate = _mean([v.candidate_score for v in train])
    train_shuffled = _mean([v.shuffled_score for v in train])
    held_base = _mean([v.base_score for v in heldout])
    held_candidate = _mean([v.candidate_score for v in heldout])
    train_delta = train_candidate - train_base
    train_control = train_candidate - train_shuffled
    held_delta = held_candidate - held_base
    macro_delta = _mean(family_delta)

    reasons = []
    if train_delta <= 0 or train_control <= 0:
        reasons.append("TRAIN_CONTROL_FAILED")
    if macro_delta < -1e-12:
        reasons.append("HELDOUT_REGRESSION")
    if len(grouped) < protocol.min_heldout_families:
        reasons.append("INSUFFICIENT_INDEPENDENT_FAMILIES")
    if macro_delta < protocol.primary_effect_floor:
        reasons.append("EFFECT_FLOOR_UNMET")
    if p_value > protocol.alpha / protocol.multiplicity:
        reasons.append("PAIRED_DIRECTIONAL_TEST_INCONCLUSIVE")
    if "HELDOUT_REGRESSION" in reasons or "TRAIN_CONTROL_FAILED" in reasons:
        status = "REJECTED"
    elif reasons:
        status = "INCONCLUSIVE"
    else:
        status = "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED"
    return StudyResult(
        status=status, reasons=tuple(reasons), p_value=p_value,
        alpha_adjusted=protocol.alpha / protocol.multiplicity,
        holdout_candidate_minus_base=held_delta,
        family_macro_delta=macro_delta,
        holdout_base_mean=held_base, holdout_candidate_mean=held_candidate,
        train_candidate_minus_base=train_delta,
        train_candidate_minus_shuffled=train_control,
        train_family_count=len({v.family_id for v in train}),
        holdout_family_count=len(grouped),
        evidence_hash=_hash_evidence(protocol, train, heldout),
    )


def replay_study(result: StudyResult, protocol: StudyProtocol,
                 train: Sequence[Observation], heldout: Sequence[Observation]) -> bool:
    """Deterministically replay the study; digest equality is not proof of provenance."""
    try:
        return isinstance(result, StudyResult) and result == run_study(protocol, train, heldout)
    except (StudyInvalid, ValueError):
        return False
