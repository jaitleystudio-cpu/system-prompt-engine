"""Phase 3: promotion gate + multi-provider identity / retraction mutant kills."""

from __future__ import annotations

from spe_runtime.grounding.live_adapters import acquire_scholarly_hits
from spe_runtime.grounding.live_fabric import (
    LIVE_INDEX,
    LIVE_RETRACTION,
    LivePromotionGateEvidence,
    count_identity_provider_agreement,
    evaluate_live_promotion_gate,
    may_promote_live_index,
    may_promote_live_retraction,
)
from spe_runtime.grounding.models import RetractionCheckStatus


def test_product_constants_remain_hold():
    assert LIVE_INDEX == "HOLD"
    assert LIVE_RETRACTION == "HOLD"
    assert may_promote_live_index() is False
    assert may_promote_live_retraction() is False


def test_gate_fails_closed_without_evidence():
    result = evaluate_live_promotion_gate(None)
    assert result.may_promote_index is False
    assert result.may_promote_retraction is False
    assert result.product_live_index == "HOLD"
    assert "NO_EVIDENCE_PACK" in result.reasons


def test_mutant_single_provider_not_multi_verified():
    ev = LivePromotionGateEvidence(
        identity_providers_agreeing=1,
        retraction_status=RetractionCheckStatus.RETRACTION_SIGNAL,
        provenance_present=True,
        mutants_green=True,
        independent_live_network_proof=True,
    )
    result = evaluate_live_promotion_gate(ev)
    assert result.may_promote_index is False
    assert "NEED_GE2_PROVIDERS_IDENTITY_AGREE" in result.reasons


def test_mutant_no_signal_collapse_forbidden():
    ev = LivePromotionGateEvidence(
        identity_providers_agreeing=2,
        retraction_status=RetractionCheckStatus.NO_SIGNAL_IN_QUERIED_SOURCES,
        provenance_present=True,
        mutants_green=True,
        independent_live_network_proof=True,
        no_signal_collapsed_to_not_retracted=True,
    )
    result = evaluate_live_promotion_gate(ev)
    assert result.may_promote_index is False
    assert "NO_SIGNAL_COLLAPSE_TO_NOT_RETRACTED_FORBIDDEN" in result.reasons


def test_mutant_not_checked_blocks_promotion():
    ev = LivePromotionGateEvidence(
        identity_providers_agreeing=2,
        retraction_status=RetractionCheckStatus.NOT_CHECKED,
        provenance_present=True,
        mutants_green=True,
        independent_live_network_proof=True,
    )
    result = evaluate_live_promotion_gate(ev)
    assert result.may_promote_index is False
    assert "RETRACTION_NOT_CHECKED" in result.reasons


def test_mutant_missing_independent_live_proof_blocks():
    ev = LivePromotionGateEvidence(
        identity_providers_agreeing=2,
        retraction_status=RetractionCheckStatus.RETRACTION_SIGNAL,
        provenance_present=True,
        mutants_green=True,
        independent_live_network_proof=False,
    )
    result = evaluate_live_promotion_gate(ev)
    assert result.may_promote_index is False
    assert "INDEPENDENT_LIVE_NETWORK_PROOF_MISSING" in result.reasons
    assert result.product_live_index == "HOLD"


def test_injectable_multi_provider_identity_agreement():
    def transport(url: str) -> tuple[int, str]:
        import json

        if "openalex" in url:
            return 200, json.dumps(
                {
                    "results": [
                        {
                            "doi": "https://doi.org/10.1038/nature00870",
                            "display_name": "RETRACTED ARTICLE: Pluripotency",
                            "is_retracted": True,
                            "type": "article",
                        }
                    ]
                }
            )
        if "crossref" in url:
            return 200, json.dumps(
                {
                    "message": {
                        "items": [
                            {
                                "DOI": "10.1038/nature00870",
                                "title": ["RETRACTED ARTICLE: Pluripotency"],
                                "type": "journal-article",
                                "updated-by": [{"type": "retraction"}],
                            }
                        ]
                    }
                }
            )
        return 504, '{"error":"timeout"}'

    result = acquire_scholarly_hits(
        "doi:10.1038/nature00870",
        providers=("OPENALEX", "CROSSREF"),
        consent=True,
        transport=transport,
    )
    assert result["status"] == "ACQUIRED_LIVE"
    agree = count_identity_provider_agreement(result["hits"])  # type: ignore[arg-type]
    assert agree >= 2
    assert result["retraction"]["status"] == "RETRACTION_SIGNAL"
    assert LIVE_INDEX == "HOLD"
    assert LIVE_RETRACTION == "HOLD"
    gate = evaluate_live_promotion_gate(
        LivePromotionGateEvidence(
            identity_providers_agreeing=agree,
            retraction_status=RetractionCheckStatus.RETRACTION_SIGNAL,
            provenance_present=bool(result["capsules"]),
            mutants_green=True,
            independent_live_network_proof=False,
        )
    )
    assert gate.may_promote_index is False


def test_network_failure_not_clean_not_retracted():
    def boom(_url: str) -> tuple[int, str]:
        return 599, '{"error":"network"}'

    result = acquire_scholarly_hits(
        "doi:10.1038/nature00870",
        providers=("OPENALEX", "CROSSREF"),
        consent=True,
        transport=boom,
    )
    status = (result.get("retraction") or {}).get("status", "UNKNOWN")
    assert status != "NOT_RETRACTED"
    assert status != "PASS"


def test_unknown_full_pack_does_not_set_may_promote():
    """UNKNOWN is not terminal-ok. A full pack must not set may_promote_*."""
    ev = LivePromotionGateEvidence(
        identity_providers_agreeing=2,
        retraction_status=RetractionCheckStatus.UNKNOWN,
        provenance_present=True,
        mutants_green=True,
        independent_live_network_proof=True,
    )
    result = evaluate_live_promotion_gate(ev)
    assert result.may_promote_index is False
    assert result.may_promote_retraction is False
    assert "UNKNOWN_NE_TERMINAL_OK" in result.reasons
    assert "GATE_MET_PRODUCT_CONSTANTS_STILL_HOLD" not in result.reasons
    assert "FOUNDER_FLIP_REQUIRED_FOR_LIVE_YES" not in result.reasons
    assert result.product_live_index == "HOLD"
    assert result.product_live_retraction == "HOLD"
    assert LIVE_INDEX == "HOLD"
    assert LIVE_RETRACTION == "HOLD"


def test_writer_receipt_without_independent_verifier_does_not_promote():
    """independent_verifier_receipt=false keeps may_promote_* false."""
    receipt = {"independent_verifier_receipt": False}
    ev = LivePromotionGateEvidence(
        identity_providers_agreeing=2,
        retraction_status=RetractionCheckStatus.RETRACTION_SIGNAL,
        provenance_present=True,
        mutants_green=True,
        independent_live_network_proof=bool(receipt["independent_verifier_receipt"]),
    )
    result = evaluate_live_promotion_gate(ev)
    assert result.may_promote_index is False
    assert result.may_promote_retraction is False
    assert "INDEPENDENT_LIVE_NETWORK_PROOF_MISSING" in result.reasons
    assert result.product_live_index == "HOLD"
    assert result.product_live_retraction == "HOLD"
    assert LIVE_INDEX == "HOLD"
    assert LIVE_RETRACTION == "HOLD"
