"""Scoped live identity evidence. Does not promote product gates.

A writer receipt can show that specific DOI lookups resolved. It cannot set
may_promote, cannot flip product LIVE_* constants, and cannot treat PubMed and
PMC as two independent confirmations when they share one record.
"""

from __future__ import annotations

import re
from typing import Mapping

from spe_runtime.grounding.live_fabric import (
    LIVE_INDEX,
    LIVE_RETRACTION,
    LivePromotionGateEvidence,
    evaluate_live_promotion_gate,
)
from spe_runtime.grounding.models import RetractionCheckStatus

_SHA = re.compile(r"^(?:sha256:)?([0-9a-f]{64})$")
_DOI_PROVIDERS = frozenset({"OPENALEX", "CROSSREF"})
_NCBI = frozenset({"PUBMED", "PMC"})


def _digest_ok(value: object) -> bool:
    return isinstance(value, str) and _SHA.match(value) is not None


def _rows(pack: Mapping[str, object]) -> tuple[Mapping[str, object], ...]:
    raw = pack.get("bindings")
    if not isinstance(raw, list):
        return ()
    return tuple(row for row in raw if isinstance(row, Mapping))


def qualifying_doi_providers(
    pack: Mapping[str, object],
    canonical_doi: str,
) -> tuple[str, ...]:
    """OpenAlex/Crossref direct DOI lookups that echo the canonical DOI.

    NCBI rows never qualify. A PMID or PMCID is not a DOI provider, and
    PubMed plus PMC are one family even when both name the same article.
    """
    doi = canonical_doi.strip().lower()
    found: set[str] = set()
    for row in _rows(pack):
        if str(row.get("canonical_doi") or "").strip().lower() != doi:
            continue
        provider = str(row.get("provider") or "").strip().upper()
        if provider not in _DOI_PROVIDERS:
            continue
        if str(row.get("query_class") or "") != "ADAPTER_DIRECT_DOI":
            continue
        if row.get("supplemental") is True:
            continue
        if row.get("http_status") != 200:
            continue
        if str(row.get("status") or "") != "DOI_MATCH":
            continue
        if str(row.get("returned_doi") or "").strip().lower() != doi:
            continue
        if not str(row.get("returned_id") or "").strip():
            continue
        if not str(row.get("timestamp_ist") or "").strip():
            continue
        query = str(row.get("query") or "")
        if doi not in query.lower():
            continue
        if not _digest_ok(row.get("response_sha256")):
            continue
        found.add(provider)
    return tuple(sorted(found))


def ncbi_family_count(pack: Mapping[str, object], canonical_doi: str) -> int:
    """0 or 1. PubMed and PMC never add up to two confirmations."""
    doi = canonical_doi.strip().lower()
    seen = False
    for row in _rows(pack):
        if str(row.get("canonical_doi") or "").strip().lower() != doi:
            continue
        if str(row.get("provider") or "").strip().upper() not in _NCBI:
            continue
        if row.get("returned_id") or row.get("http_status") == 200:
            seen = True
    return 1 if seen else 0


def _retraction_observation(row: Mapping[str, object]) -> str:
    obs = row.get("retraction_observation")
    if not isinstance(obs, Mapping):
        return "NO_SIGNAL_IN_QUERIED_SOURCES"
    if obs.get("is_retracted") is True or obs.get("retracted_publication") is True:
        return "RETRACTION_SIGNAL"
    updates = obs.get("update_types")
    if isinstance(updates, list) and any(str(item).lower() == "retraction" for item in updates):
        return "RETRACTION_SIGNAL"
    if obs.get("is_retracted") is False or updates == []:
        return "NO_SIGNAL_IN_QUERIED_SOURCES"
    return "NO_SIGNAL_IN_QUERIED_SOURCES"


def evaluate_live_identity_scope(pack: Mapping[str, object] | None) -> dict[str, object]:
    """Bind scoped index evidence. Product constants and may_promote stay closed.

    LIVE_RETRACTION stays HOLD even when a provider body contains a retraction
    flag. Observation is not live_verified and a writer receipt is not promotion.
    """
    if not pack:
        gate = evaluate_live_promotion_gate(None)
        return {
            "scoped_LIVE_INDEX": "HOLD",
            "scoped_LIVE_RETRACTION": "HOLD",
            "product_LIVE_INDEX": LIVE_INDEX,
            "product_LIVE_RETRACTION": LIVE_RETRACTION,
            "may_promote": False,
            "may_promote_index": gate.may_promote_index,
            "may_promote_retraction": gate.may_promote_retraction,
            "tested_scope_dois": [],
            "identities": {},
            "FINAL": "R4_T6_NO_EVIDENCE_HOLD",
            "reasons": list(gate.reasons) + ["WRITER_RECEIPT_NOT_PROMOTION_PROOF"],
        }

    dois = []
    seen: set[str] = set()
    for row in _rows(pack):
        doi = str(row.get("canonical_doi") or "").strip().lower()
        if doi and doi not in seen:
            seen.add(doi)
            dois.append(doi)

    identities: dict[str, dict[str, object]] = {}
    all_pass = bool(dois)
    any_retraction_signal = False
    for doi in dois:
        providers = qualifying_doi_providers(pack, doi)
        ncbi = ncbi_family_count(pack, doi)
        signals = []
        for row in _rows(pack):
            if str(row.get("canonical_doi") or "").strip().lower() != doi:
                continue
            kind = _retraction_observation(row)
            if kind == "RETRACTION_SIGNAL":
                signals.append(str(row.get("provider") or "").upper())
        if signals:
            any_retraction_signal = True
        passed = len(providers) >= 2
        all_pass = all_pass and passed
        identities[doi] = {
            "independent_doi_providers": list(providers),
            "independent_doi_provider_count": len(providers),
            "ncbi_family_count": ncbi,
            "ncbi_counts_as_extra_independent_provider": False,
            "index_status": "PASS_WITHIN_TESTED_SCOPE" if passed else "HOLD",
            "retraction_observation": (
                "RETRACTION_SIGNAL" if signals else "NO_SIGNAL_IN_QUERIED_SOURCES"
            ),
            "retraction_signal_providers": sorted(set(signals)),
            "live_verified": False,
            "not_retracted": False,
        }

    scoped_index = "PASS_WITHIN_TESTED_SCOPE" if all_pass else "HOLD"
    # Do not couple the gates. Retraction stays HOLD on a writer receipt.
    retraction_status = (
        RetractionCheckStatus.RETRACTION_SIGNAL
        if any_retraction_signal
        else RetractionCheckStatus.NO_SIGNAL_IN_QUERIED_SOURCES
    )
    gate = evaluate_live_promotion_gate(
        LivePromotionGateEvidence(
            identity_providers_agreeing=min(
                (int(item["independent_doi_provider_count"]) for item in identities.values()),
                default=0,
            ),
            retraction_status=retraction_status,
            provenance_present=all_pass,
            mutants_green=False,
            independent_live_network_proof=False,
            no_signal_collapsed_to_not_retracted=False,
        )
    )
    reasons = list(gate.reasons)
    reasons.append("WRITER_RECEIPT_NOT_PROMOTION_PROOF")
    reasons.append("PUBMED_PLUS_PMC_NOT_TWO_CONFIRMATIONS")
    reasons.append("RETRACTION_OBSERVATION_NOT_LIVE_VERIFIED")
    reasons.append("SCOPED_INDEX_DOES_NOT_FLIP_PRODUCT_CONSTANT")
    if scoped_index == "PASS_WITHIN_TESTED_SCOPE":
        final = "R4_T6_LIVE_INDEX_PASS_WITHIN_TESTED_SCOPE_RETRACTION_HOLD"
    else:
        final = "R4_T6_LIVE_INDEX_HOLD_RETRACTION_HOLD"
    return {
        "scoped_LIVE_INDEX": scoped_index,
        "scoped_LIVE_RETRACTION": "HOLD",
        "product_LIVE_INDEX": LIVE_INDEX,
        "product_LIVE_RETRACTION": LIVE_RETRACTION,
        "may_promote": False,
        "may_promote_index": gate.may_promote_index,
        "may_promote_retraction": gate.may_promote_retraction,
        "tested_scope_dois": dois,
        "identities": identities,
        "writer_receipt_is_promotion_proof": False,
        "independent_verifier_receipt": False,
        "FINAL": final,
        "reasons": reasons,
    }
