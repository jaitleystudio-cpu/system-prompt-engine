"""Live scholarly fabric capability mirrors for grounding.

LIVE_INDEX / LIVE_RETRACTION stay HOLD until live mutants are killed with evidence.
Adapters may exist without promoting these gates.
Promotion requires evaluate_live_promotion_gate(...) founder-grade criteria.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from spe_runtime.grounding.models import RetractionCheckStatus

LIVE_INDEX: Final[str] = "HOLD"
LIVE_RETRACTION: Final[str] = "HOLD"
FULL_SCHOLARLY_INDEX: Final[str] = "NO"
LIVE_RETRACTION_VERIFICATION: Final[str] = "NO"

ADAPTERS_IMPLEMENTED: Final[tuple[str, ...]] = (
    "OPENALEX",
    "CROSSREF",
    "PUBMED",
    "PMC",
    "ARXIV",
)

# Public well-known retracted DOIs for optional SPE_SCHOLARLY_LIVE=1 probes (INR 0).
KNOWN_RETRACTED_DOI_FIXTURES: Final[tuple[str, ...]] = (
    "10.1038/nature00870",
    "10.1016/j.ijantimicag.2020.105949",
)

_TERMINAL_OK = frozenset(
    {
        RetractionCheckStatus.NO_SIGNAL_IN_QUERIED_SOURCES,
        RetractionCheckStatus.RETRACTION_SIGNAL,
        RetractionCheckStatus.WITHDRAWAL_SIGNAL,
        RetractionCheckStatus.EXPRESSION_OF_CONCERN,
        RetractionCheckStatus.CORRECTION_SIGNAL,
        RetractionCheckStatus.CONFLICTING_STATUS,
        RetractionCheckStatus.SOURCE_UNAVAILABLE,
        RetractionCheckStatus.IDENTIFIER_AMBIGUOUS,
        RetractionCheckStatus.UNKNOWN,
    }
)


@dataclass(frozen=True)
class LivePromotionGateEvidence:
    """Evidence pack for LIVE_* promotion -- all must pass for may_promote*."""

    identity_providers_agreeing: int
    retraction_status: RetractionCheckStatus | str
    provenance_present: bool
    mutants_green: bool
    independent_live_network_proof: bool
    no_signal_collapsed_to_not_retracted: bool = False


@dataclass(frozen=True)
class LivePromotionGateResult:
    may_promote_index: bool
    may_promote_retraction: bool
    reasons: tuple[str, ...]
    product_live_index: str = LIVE_INDEX
    product_live_retraction: str = LIVE_RETRACTION

    def to_dict(self) -> dict[str, object]:
        return {
            "may_promote_index": self.may_promote_index,
            "may_promote_retraction": self.may_promote_retraction,
            "reasons": list(self.reasons),
            "product_live_index": self.product_live_index,
            "product_live_retraction": self.product_live_retraction,
        }


def evaluate_live_promotion_gate(
    evidence: LivePromotionGateEvidence | None = None,
) -> LivePromotionGateResult:
    """Founder-grade promotion gate.

    Requires: >=2 providers agree on identity; retraction layer checked with a
    non-NOT_CHECKED explicit RetractionCheckStatus that did not silently collapse
    NO_SIGNAL->NOT_RETRACTED; provenance present; mutants green; independent
    live multi-provider network proof.

    Product LIVE_* constants remain HOLD even when may_promote* is True --
    founder must flip constants separately.
    """
    if evidence is None:
        return LivePromotionGateResult(
            may_promote_index=False,
            may_promote_retraction=False,
            reasons=("NO_EVIDENCE_PACK", "LIVE_INDEX=HOLD", "LIVE_RETRACTION=HOLD"),
        )

    status = evidence.retraction_status
    if isinstance(status, RetractionCheckStatus):
        status_val = status
    else:
        status_val = RetractionCheckStatus(str(status))

    reasons: list[str] = []
    if evidence.identity_providers_agreeing < 2:
        reasons.append("NEED_GE2_PROVIDERS_IDENTITY_AGREE")
    if status_val == RetractionCheckStatus.NOT_CHECKED:
        reasons.append("RETRACTION_NOT_CHECKED")
    if status_val == RetractionCheckStatus.CHECKING:
        reasons.append("RETRACTION_STILL_CHECKING")
    if evidence.no_signal_collapsed_to_not_retracted:
        reasons.append("NO_SIGNAL_COLLAPSE_TO_NOT_RETRACTED_FORBIDDEN")
    if str(status_val.value) == "NOT_RETRACTED" or str(status) == "NOT_RETRACTED":
        reasons.append("NOT_RETRACTED_TOKEN_FORBIDDEN")
    if not evidence.provenance_present:
        reasons.append("PROVENANCE_MISSING")
    if not evidence.mutants_green:
        reasons.append("MUTANTS_NOT_GREEN")
    if not evidence.independent_live_network_proof:
        reasons.append("INDEPENDENT_LIVE_NETWORK_PROOF_MISSING")

    ok = (
        evidence.identity_providers_agreeing >= 2
        and status_val != RetractionCheckStatus.NOT_CHECKED
        and status_val != RetractionCheckStatus.CHECKING
        and status_val in _TERMINAL_OK
        and not evidence.no_signal_collapsed_to_not_retracted
        and evidence.provenance_present
        and evidence.mutants_green
        and evidence.independent_live_network_proof
    )
    if ok:
        reasons.append("GATE_MET_PRODUCT_CONSTANTS_STILL_HOLD")
        reasons.append("FOUNDER_FLIP_REQUIRED_FOR_LIVE_YES")
    else:
        reasons.append("LIVE_INDEX=HOLD")
        reasons.append("LIVE_RETRACTION=HOLD")

    return LivePromotionGateResult(
        may_promote_index=ok,
        may_promote_retraction=ok,
        reasons=tuple(reasons),
        product_live_index=LIVE_INDEX,
        product_live_retraction=LIVE_RETRACTION,
    )


def count_identity_provider_agreement(
    hits: list[dict[str, object]] | tuple[dict[str, object], ...],
) -> int:
    """Count distinct providers that share the same normalized DOI/identifier."""
    by_id: dict[str, set[str]] = {}
    for hit in hits:
        ident = str(hit.get("identifier") or "").strip().lower()
        if ident.startswith("doi:"):
            ident = ident[4:]
        ident = ident.replace("https://doi.org/", "")
        prov = str(hit.get("provider") or "").strip().upper()
        if not ident or not prov:
            continue
        by_id.setdefault(ident, set()).add(prov)
    if not by_id:
        return 0
    return max(len(providers) for providers in by_id.values())


def may_promote_live_index(
    evidence: LivePromotionGateEvidence | None = None,
) -> bool:
    return evaluate_live_promotion_gate(evidence).may_promote_index


def may_promote_live_retraction(
    evidence: LivePromotionGateEvidence | None = None,
) -> bool:
    return evaluate_live_promotion_gate(evidence).may_promote_retraction
