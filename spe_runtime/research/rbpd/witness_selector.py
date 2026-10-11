"""
SPE Ω — RBPD Phase C: Goodhart-Resistant Reality Witness Selection.

Combines two orthogonal witness channels:
- Channel A (Active Counterfactual Probes): Reuses CSC ProbeOptimizer and
  DistinguishingProbe to select maximum information-efficiency probes for
  invalidated/stale obligation slices.
- Channel B (Sealed Independent Reality Witnesses): SealedIndependentSampler
  draws a mandatory >=25% stratified random witness floor from sealed held-out
  families seeded via HMAC-SHA256 over (parent_receipt_hash, edit_commit_digest, epoch_nonce).
"""

from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import hmac
import math
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from spe_runtime.research.csc.models import DistinguishingProbe, OracleStatus
from spe_runtime.research.csc.probe_optimizer import ProbeOptimizer
from spe_runtime.research.rbpd.contract import EpistemicStatus


@dataclass(frozen=True)
class SealedRealityWitness:
    """An independent reality witness item drawn from a sealed held-out family."""

    witness_id: str
    family_id: str
    content_sha256: str
    sampling_rank_digest: str


@dataclass(frozen=True)
class WitnessSelection:
    """Dual-channel witness selection result for a set of stale/unknown obligations."""

    channel_a_probes: Tuple[DistinguishingProbe, ...]
    channel_b_witnesses: Tuple[SealedRealityWitness, ...]
    sealed_fraction: float
    distinct_sealed_families: int
    sampling_seed_hmac: str


@dataclass(frozen=True)
class CandidateEvaluationVerdict:
    """Outcome of evaluating a candidate against the selected witness channels."""

    strategy: str
    passed: bool
    channel_a_mean: float
    channel_b_mean: float
    goodhart_gap: float
    goodhart_divergence_detected: bool
    epistemic_status: EpistemicStatus
    reason: str
    probes_executed: int


class SealedIndependentSampler:
    """
    Deterministic, manipulation-resistant stratified sampler over sealed held-out
    task families. Enforces a hard floor of >=25% sealed witnesses and >=3 distinct
    sealed families per incremental verification batch.
    """

    def __init__(
        self,
        *,
        sealed_families: Sequence[str],
        items_per_family: int = 4,
        min_sealed_fraction: float = 0.25,
        min_sealed_families: int = 3,
    ) -> None:
        if min_sealed_fraction < 0.25 or not math.isfinite(min_sealed_fraction) or min_sealed_fraction > 1.0:
            raise ValueError(
                f"Anti-Goodhart invariant violated: min_sealed_fraction must be in [0.25, 1.0], got {min_sealed_fraction}"
            )
        unique_families = sorted(set(str(f).strip() for f in sealed_families if str(f).strip()))
        if len(unique_families) < min_sealed_families or min_sealed_families < 3:
            raise ValueError(
                f"Anti-Goodhart invariant violated: at least {max(3, min_sealed_families)} distinct sealed families required"
            )
        if items_per_family < 1:
            raise ValueError("items_per_family must be >= 1")

        self.sealed_families = tuple(unique_families)
        self.items_per_family = items_per_family
        self.min_sealed_fraction = min_sealed_fraction
        self.min_sealed_families = min_sealed_families

        self._pool: List[Tuple[str, str, str]] = []
        for fam_id in self.sealed_families:
            for j in range(self.items_per_family):
                w_id = f"SEALED-{fam_id}-ITEM-{j:02d}"
                c_sha = hashlib.sha256(f"sealed-content:{fam_id}:{j}".encode("utf-8")).hexdigest()
                self._pool.append((w_id, fam_id, c_sha))

    def sample_stratified(
        self,
        *,
        parent_receipt_hash: str,
        edit_commit_digest: str,
        epoch_nonce: str,
        count: int,
    ) -> Tuple[Tuple[SealedRealityWitness, ...], str]:
        if not parent_receipt_hash or not edit_commit_digest or not epoch_nonce:
            raise ValueError("parent_receipt_hash, edit_commit_digest, and epoch_nonce are mandatory for sealed sampling")

        target_count = max(count, self.min_sealed_families)
        seed_key = f"{parent_receipt_hash}:{edit_commit_digest}:{epoch_nonce}".encode("utf-8")
        seed_hmac = hmac.new(seed_key, b"RBPD_CHANNEL_B_SEALED_SAMPLER_V1", hashlib.sha256).hexdigest()

        # First rank families deterministically under seed_hmac for stratified coverage
        ranked_families = sorted(
            self.sealed_families,
            key=lambda fid: hmac.new(seed_hmac.encode("utf-8"), f"fam:{fid}".encode("utf-8"), hashlib.sha256).hexdigest(),
        )

        by_family: Dict[str, List[SealedRealityWitness]] = {}
        for w_id, fam_id, c_sha in self._pool:
            rank_digest = hmac.new(
                seed_hmac.encode("utf-8"), f"item:{w_id}:{c_sha}".encode("utf-8"), hashlib.sha256
            ).hexdigest()
            by_family.setdefault(fam_id, []).append(
                SealedRealityWitness(
                    witness_id=w_id,
                    family_id=fam_id,
                    content_sha256=c_sha,
                    sampling_rank_digest=rank_digest,
                )
            )
        for fam_id in by_family:
            by_family[fam_id].sort(key=lambda w: w.sampling_rank_digest)

        selected: List[SealedRealityWitness] = []
        round_idx = 0
        while len(selected) < target_count:
            added_in_round = False
            for fam_id in ranked_families:
                fam_items = by_family[fam_id]
                if round_idx < len(fam_items):
                    selected.append(fam_items[round_idx])
                    added_in_round = True
                    if len(selected) >= target_count:
                        break
            if not added_in_round:
                break
            round_idx += 1

        return tuple(selected), seed_hmac


class DualChannelWitnessSelector:
    """
    Combines Channel A (CSC ProbeOptimizer counterfactual EIG probes) and
    Channel B (SealedIndependentSampler stratified reality witnesses) to
    re-qualify stale obligations without succumbing to Goodhart proxy gaming.
    """

    def __init__(
        self,
        *,
        sampler: SealedIndependentSampler,
        probe_optimizer: Optional[ProbeOptimizer] = None,
        goodhart_gap_threshold: float = 0.25,
        pass_floor: float = 0.75,
    ) -> None:
        self.sampler = sampler
        self.probe_optimizer = probe_optimizer or ProbeOptimizer(default_lambda=0.5)
        self.goodhart_gap_threshold = goodhart_gap_threshold
        self.pass_floor = pass_floor

    def select_witnesses(
        self,
        *,
        stale_obligations: Sequence[str],
        parent_receipt_hash: str,
        edit_commit_digest: str,
        epoch_nonce: str,
        total_budget_probes: int = 8,
    ) -> WitnessSelection:
        if total_budget_probes < 4:
            total_budget_probes = 4

        sealed_count = max(
            self.sampler.min_sealed_families,
            math.ceil(total_budget_probes * self.sampler.min_sealed_fraction),
        )
        active_budget = max(len(stale_obligations), total_budget_probes - sealed_count)

        # Channel A: Synthesize & rank counterfactual probes for each stale obligation via CSC ProbeOptimizer
        candidate_probes: List[DistinguishingProbe] = []
        for idx, obl_id in enumerate(stale_obligations):
            candidate_probes.append(
                DistinguishingProbe(
                    probe_id=f"PROBE-EIG-{obl_id}-PRIMARY",
                    target_obligation_ref=obl_id,
                    name=f"Counterfactual boundary probe for {obl_id}",
                    operation=f"verify_boundary:{obl_id}",
                    delta_v=0.90,
                    v_reuse=0.80,
                    cost_nanos=500 + idx * 10,
                    oracle_status=OracleStatus.QUALIFIED,
                )
            )
            candidate_probes.append(
                DistinguishingProbe(
                    probe_id=f"PROBE-EIG-{obl_id}-SECONDARY",
                    target_obligation_ref=obl_id,
                    name=f"Metamorphic invariant probe for {obl_id}",
                    operation=f"verify_metamorphic:{obl_id}",
                    delta_v=0.65,
                    v_reuse=0.50,
                    cost_nanos=800 + idx * 10,
                    oracle_status=OracleStatus.QUALIFIED,
                )
            )

        ranked_probes = sorted(
            candidate_probes,
            key=lambda p: self.probe_optimizer.compute_score(p),
            reverse=True,
        )
        selected_a = tuple(ranked_probes[:active_budget])

        if self.sampler.min_sealed_fraction < 1.0:
            min_sealed_for_ratio = math.ceil(
                len(selected_a)
                * self.sampler.min_sealed_fraction
                / (1.0 - self.sampler.min_sealed_fraction)
            )
        else:
            min_sealed_for_ratio = max(1, len(selected_a))
        sealed_count = max(sealed_count, min_sealed_for_ratio)

        # Channel B: Draw stratified random witnesses from sealed held-out families
        selected_b, seed_hmac = self.sampler.sample_stratified(
            parent_receipt_hash=parent_receipt_hash,
            edit_commit_digest=edit_commit_digest,
            epoch_nonce=epoch_nonce,
            count=sealed_count,
        )

        if self.sampler.min_sealed_fraction < 1.0 and len(selected_a) > 0:
            max_active_for_pool = math.floor(
                len(selected_b)
                * (1.0 - self.sampler.min_sealed_fraction)
                / self.sampler.min_sealed_fraction
            )
            if len(selected_a) > max_active_for_pool:
                selected_a = selected_a[:max_active_for_pool]

        total_selected = len(selected_a) + len(selected_b)
        sealed_frac = len(selected_b) / float(total_selected) if total_selected > 0 else 0.0
        distinct_fams = len({w.family_id for w in selected_b})

        return WitnessSelection(
            channel_a_probes=selected_a,
            channel_b_witnesses=selected_b,
            sealed_fraction=sealed_frac,
            distinct_sealed_families=distinct_fams,
            sampling_seed_hmac=seed_hmac,
        )

    def evaluate_candidate(
        self,
        *,
        selection: WitnessSelection,
        strategy: str,
        channel_a_evaluator: Callable[[DistinguishingProbe], float],
        channel_b_evaluator: Callable[[SealedRealityWitness], float],
    ) -> CandidateEvaluationVerdict:
        if strategy == "ACTIVE_ONLY":
            scores_a = [float(channel_a_evaluator(p)) for p in selection.channel_a_probes]
            mean_a = sum(scores_a) / len(scores_a) if scores_a else 0.0
            passed = mean_a >= self.pass_floor
            return CandidateEvaluationVerdict(
                strategy=strategy,
                passed=passed,
                channel_a_mean=mean_a,
                channel_b_mean=0.0,
                goodhart_gap=0.0,
                goodhart_divergence_detected=False,
                epistemic_status=EpistemicStatus.VALID if passed else EpistemicStatus.INVALID,
                reason="ACTIVE_ONLY evaluated Channel A probes only (vulnerable to Goodhart proxy gaming)",
                probes_executed=len(scores_a),
            )

        if strategy == "RANDOM_ONLY":
            scores_b = [float(channel_b_evaluator(w)) for w in selection.channel_b_witnesses]
            mean_b = sum(scores_b) / len(scores_b) if scores_b else 0.0
            passed = mean_b >= self.pass_floor
            return CandidateEvaluationVerdict(
                strategy=strategy,
                passed=passed,
                channel_a_mean=0.0,
                channel_b_mean=mean_b,
                goodhart_gap=0.0,
                goodhart_divergence_detected=False,
                epistemic_status=EpistemicStatus.VALID if passed else EpistemicStatus.INVALID,
                reason="RANDOM_ONLY evaluated unguided random witnesses only",
                probes_executed=len(scores_b),
            )

        # Default: RBPD_DUAL_CHANNEL (or FULL_RERUN)
        scores_a = [float(channel_a_evaluator(p)) for p in selection.channel_a_probes]
        scores_b = [float(channel_b_evaluator(w)) for w in selection.channel_b_witnesses]
        mean_a = sum(scores_a) / len(scores_a) if scores_a else 0.0
        mean_b = sum(scores_b) / len(scores_b) if scores_b else 0.0
        gap = mean_a - mean_b
        goodhart_detected = gap > self.goodhart_gap_threshold or (
            mean_a >= self.pass_floor and mean_b < self.pass_floor
        )
        passed = (
            mean_a >= self.pass_floor
            and mean_b >= self.pass_floor
            and not goodhart_detected
        )

        if goodhart_detected:
            reason = (
                f"GOODHART_DIVERGENCE_DETECTED: Channel A active score ({mean_a:.2f}) diverged from "
                f"Channel B sealed reality witness score ({mean_b:.2f}) by {gap:.2f}"
            )
            status = EpistemicStatus.INVALID
        elif passed:
            reason = (
                f"Dual-channel reality witnesses passed (Channel A={mean_a:.2f}, Channel B={mean_b:.2f})"
            )
            status = EpistemicStatus.VALID
        else:
            reason = (
                f"Candidate failed dual-channel reality witness floor (Channel A={mean_a:.2f}, Channel B={mean_b:.2f})"
            )
            status = EpistemicStatus.INVALID

        return CandidateEvaluationVerdict(
            strategy=strategy,
            passed=passed,
            channel_a_mean=mean_a,
            channel_b_mean=mean_b,
            goodhart_gap=gap,
            goodhart_divergence_detected=goodhart_detected,
            epistemic_status=status,
            reason=reason,
            probes_executed=len(scores_a) + len(scores_b),
        )
