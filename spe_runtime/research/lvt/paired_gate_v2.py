"""SPE LVT-2 research qualification protocol (offline, stdlib-only).

Deliberate epistemic limit: a positive test NEVER yields production qualification.
Numbers and provenance come from caller-supplied data. A real, independent
source-of-truth evaluator and custody attestation remain required.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass
import hashlib
import json
import math
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple

VERSION = 'SPE-LVT2-RESEARCH-v0.1'
_DIGEST = re.compile(r'[0-9a-f]{64}\Z')


class StudyInvalid(ValueError):
    """Experiment input is unsafe/invalid. A non-result, not a negative score."""


@dataclass(frozen=True)
class Observation:
    item_id: str
    family_id: str
    content_sha256: str
    base_score: float
    candidate_score: float
    shuffled_score: Optional[float] = None


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
    reasons: Tuple[str, ...]
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
    statistical_method: str = 'ONE_SIDED_EXACT_FAMILY_SIGN_TEST'
    version: str = VERSION


def _finite_score(x: object) -> bool:
    return type(x) in (float, int) and math.isfinite(x) and 0.0 <= x <= 1.0


def _valid_positive_int(x: object) -> bool:
    return type(x) is int and x > 0


def _valid_alpha(x: object) -> bool:
    return type(x) in (int, float) and math.isfinite(x) and 0 < x < 1


def exact_sign_p(positives: int, negatives: int) -> float:
    """One-sided exact Binomial(n, .5) P(X >= positives); ties excluded.

    Uses log-sum-exp-style arithmetic for large n, avoids integer overflow.
    Tests a DIRECTIONAL median sign effect, not significance of mean delta.
    Requires independently sampled units and exchangeable signs under H0.
    """
    if type(positives) is not int or type(negatives) is not int or min(positives, negatives) < 0:
        raise StudyInvalid('invalid sign counts')
    n = positives + negatives
    if n == 0:
        return 1.0
    log2n = n * math.log(2.0)
    result = math.fsum(math.exp(math.lgamma(n + 1) - math.lgamma(k + 1)
                        - math.lgamma(n - k + 1) - log2n)
                       for k in range(positives, n + 1))
    return max(0.0, min(1.0, result))


def _validate(p: StudyProtocol, train: Sequence[Observation],
              heldout: Sequence[Observation]) -> None:
    if not all(isinstance(getattr(p, f), str) and getattr(p, f).strip()
               for f in ('study_id', 'evaluator_id', 'generator_id')):
        raise StudyInvalid('missing study/evaluator/generator identity')
    if p.evaluator_id == p.generator_id or p.evaluator_kind == 'generating_model_self':
        raise StudyInvalid('self-certification prohibited')
    if p.evaluator_kind != 'independent_static_oracle':
        raise StudyInvalid('evaluator_kind not independently constrained')
    for key in ('oracle_digest', 'model_digest'):
        if not isinstance(getattr(p, key), str) or not _DIGEST.fullmatch(getattr(p, key)):
            raise StudyInvalid(f'invalid {key}')
    if not _valid_alpha(p.alpha):
        raise StudyInvalid('invalid alpha')
    if not _finite_score(p.primary_effect_floor):
        raise StudyInvalid('invalid primary_effect_floor')
    if not _valid_positive_int(p.min_heldout_families):
        raise StudyInvalid('invalid min_heldout_families')
    if not _valid_positive_int(p.multiplicity):
        raise StudyInvalid('invalid multiplicity')
    if p.family_level_significance is not True:
        raise StudyInvalid('family-level statistical unit required')
    if not train or not heldout:
        raise StudyInvalid('empty train or heldout')
    for label, rows in (('train', train), ('heldout', heldout)):
        ids = set()
        digests = set()
        for row in rows:
            if not isinstance(row, Observation):
                raise StudyInvalid(f'invalid {label} observation')
            if not row.item_id or not row.family_id:
                raise StudyInvalid('missing item or family ID')
            if row.item_id in ids:
                raise StudyInvalid('duplicate item_id')
            ids.add(row.item_id)
            if not isinstance(row.content_sha256, str) or not _DIGEST.fullmatch(row.content_sha256):
                raise StudyInvalid('bad content digest')
            if row.content_sha256 in digests:
                raise StudyInvalid('duplicate content digest')
            digests.add(row.content_sha256)
            if not _finite_score(row.base_score) or not _finite_score(row.candidate_score):
                raise StudyInvalid('invalid score')
            if label == 'train' and not _finite_score(row.shuffled_score):
                raise StudyInvalid('invalid shuffled control score')
            if label == 'heldout' and row.shuffled_score is not None and not _finite_score(row.shuffled_score):
                raise StudyInvalid('invalid score')
    if set(v.item_id for v in train) & set(v.item_id for v in heldout):
        raise StudyInvalid('item_id overlap / contamination')
    if set(v.family_id for v in train) & set(v.family_id for v in heldout):
        raise StudyInvalid('family overlap / contamination')
    if set(v.content_sha256 for v in train) & set(v.content_sha256 for v in heldout):
        raise StudyInvalid('content overlap / contamination')


def _mean(seq: Sequence[float]) -> float:
    return math.fsum(seq) / len(seq)


def _hash_evidence(p: StudyProtocol, train: Sequence[Observation],
                   heldout: Sequence[Observation]) -> str:
    raw = {'version': VERSION, 'protocol': asdict(p),
           'train': [asdict(v) for v in sorted(train, key=lambda v: v.item_id)],
           'heldout': [asdict(v) for v in sorted(heldout, key=lambda v: v.item_id)]}
    data = json.dumps(raw, sort_keys=True, allow_nan=False, separators=(',', ':')).encode('utf8')
    return hashlib.sha256(data).hexdigest()


def run_study(p: StudyProtocol, train: Sequence[Observation],
              heldout: Sequence[Observation]) -> StudyResult:
    """Return research evidence only, NEVER a production-qualified receipt."""
    _validate(p, train, heldout)
    # Group by frozen family ID. An item is not an independent significance unit
    # when related examples are drawn from the same family.
    grouped: dict[str, list[float]] = defaultdict(list)
    for row in heldout:
        grouped[row.family_id].append(row.candidate_score - row.base_score)
    family_delta = [_mean(v) for _, v in sorted(grouped.items())]
    positives = sum(d > 1e-12 for d in family_delta)
    negatives = sum(d < -1e-12 for d in family_delta)
    p_value = exact_sign_p(positives, negatives)

    train_mean_base = _mean([v.base_score for v in train])
    train_mean_candidate = _mean([v.candidate_score for v in train])
    train_mean_shuffled = _mean([v.shuffled_score for v in train])
    held_base = _mean([v.base_score for v in heldout])
    held_candidate = _mean([v.candidate_score for v in heldout])
    train_delta = train_mean_candidate - train_mean_base
    train_control = train_mean_candidate - train_mean_shuffled
    held_delta = held_candidate - held_base
    macro_delta = _mean(family_delta)  # independent family is the inference and effect unit

    reasons: list[str] = []
    if train_delta <= 0 or train_control <= 0:
        reasons.append('TRAIN_CONTROL_FAILED')
    if macro_delta < -1e-12:
        reasons.append('HELDOUT_REGRESSION')
    if len(grouped) < p.min_heldout_families:
        reasons.append('INSUFFICIENT_INDEPENDENT_FAMILIES')
    if macro_delta < p.primary_effect_floor:
        reasons.append('EFFECT_FLOOR_UNMET')
    if p_value > p.alpha / p.multiplicity:
        reasons.append('PAIRED_DIRECTIONAL_TEST_INCONCLUSIVE')
    if 'HELDOUT_REGRESSION' in reasons or 'TRAIN_CONTROL_FAILED' in reasons:
        status = 'REJECTED'
    elif reasons:
        status = 'INCONCLUSIVE'
    else:
        status = 'RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED'
    return StudyResult(
        status=status,
        reasons=tuple(reasons),
        p_value=p_value,
        alpha_adjusted=p.alpha / p.multiplicity,
        holdout_candidate_minus_base=held_delta,
        family_macro_delta=macro_delta,
        holdout_base_mean=held_base,
        holdout_candidate_mean=held_candidate,
        train_candidate_minus_base=train_delta,
        train_candidate_minus_shuffled=train_control,
        train_family_count=len({v.family_id for v in train}),
        holdout_family_count=len(grouped),
        evidence_hash=_hash_evidence(p, train, heldout),
    )


def replay_study(old_result: StudyResult, p: StudyProtocol,
                 train: Sequence[Observation], heldout: Sequence[Observation]) -> bool:
    """Recompute and compare complete result; hash is integrity, not authority."""
    try:
        return isinstance(old_result, StudyResult) and old_result == run_study(p, train, heldout)
    except (StudyInvalid, ValueError):
        return False
