"""Live deep-evidence qualification. Skipped unless SPE_SCHOLARLY_LIVE=1.

The pairs are public Europe PMC records. A missing record or a phrase that is
not in the retrieved abstract is a HOLD, not a fabricated contradiction.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

import pytest

from spe_runtime.scholarly.models import ContentCue, EvidencePackage, ReplicationHint
from spe_runtime.scholarly.pipeline import compile_evidence_package
from spe_runtime.scholarly.registry import load_registry

pytestmark = pytest.mark.skipif(
    os.environ.get("SPE_SCHOLARLY_LIVE") != "1",
    reason="live scholarly qualification is explicit",
)

_AS_OF = "2026-09-29"
_PROOF = Path("proofs/scholarly_fabric_20260930/C_R1_5_deep_evidence.json")
_ALLOWLIST = load_registry().allowlist()
_PRIVATE = "SSN 123-45-6789 project Orion-private-memo"
_WHI = "10.1001/jama.288.3.321"
_NHS = "10.1056/nejm199109123251102"
_BEM = "10.1037/a0021524"
_RITCHIE = "10.1371/journal.pone.0033423"
_SUPPORT = (
    "Current estrogen use is associated with a reduction in the incidence "
    "of coronary heart disease"
)
_REFUTE = (
    "this regimen should not be initiated or continued for primary prevention of CHD"
)
_REPLICATION = "three pre-registered independent attempts to exactly replicate"
_RESULT = "do not support the existence of psychic ability"
_CLAIM = "postmenopausal hormone therapy and coronary heart disease"


def _pause() -> None:
    time.sleep(1.2)


def _hosts(package: EvidencePackage) -> list[str]:
    return [event.host for event in package.egress]


def _summary(package: EvidencePackage) -> dict[str, object]:
    return {
        "status": package.status.value,
        "semantic_authority": package.to_dict()["semantic_authority"],
        "wired_to_k3": package.to_dict()["integration"]["wired_to_k3"],
        "outbound_query": package.outbound_query,
        "private_withheld": package.private_withheld,
        "egress": [item.to_dict() for item in package.egress],
        "records": [
            {
                "doi": record.identity.doi,
                "paper_type": record.paper_type,
                "peer_review_status": record.peer_review_status,
                "abstract_access": record.abstract_access,
                "license_status": record.license_status,
                "full_text_status": record.full_text_status,
                "full_text_source": record.full_text_source,
                "retrieval_method": record.retrieval_method,
                "content_digest": record.content_digest,
                "retraction": record.retraction.kind.value,
                "source_ids": list(record.source_ids),
            }
            for record in package.records
        ],
        "graph": package.claim_evidence_graph.to_dict(),
        "contradiction_map": package.contradiction_map.to_dict(),
        "replication_map": None
        if package.replication_map is None
        else package.replication_map.to_dict(),
        "rate_limit": None if package.rate_limit is None else package.rate_limit.to_dict(),
        "gaps": [item.to_dict() for item in package.gap_unknown_map.items],
        "capsule_support": [item.support_status for item in package.capsule_candidates],
    }


def _assert_boundary(package: EvidencePackage) -> None:
    blob = " ".join(
        f"{event.host}{event.path}" for event in package.egress
    )
    assert _PRIVATE.split()[1] not in blob
    assert "Orion-private-memo" not in blob
    assert package.private_withheld is True
    assert package.to_dict()["semantic_authority"] == "NONE"
    assert package.to_dict()["integration"]["wired_to_k3"] is False
    assert package.rate_limit is not None
    assert package.rate_limit.backoff_state == "NO_RETRY"
    assert package.rate_limit.request_count == len(package.egress)
    assert all(event.attempt == 1 for event in package.egress)
    for event in package.egress:
        assert event.host in _ALLOWLIST
        assert event.host not in {"localhost", "127.0.0.1"}
        assert "://" not in event.path
    for record in package.records:
        if record.full_text_status == "OPEN_FULL_TEXT":
            assert record.is_open_access is True
            assert set(record.source_ids) & {"europepmc", "pmc"}
            assert record.content_digest is not None
            assert record.retrieval_method == "EUROPEPMC_FULLTEXT_XML"
        assert record.landing_url is None or urlsplit(record.landing_url).hostname not in {
            "www.sciencedirect.com",
        }


def test_live_contradiction_replication_and_lawful_full_text() -> None:
    holds: list[str] = []
    contradiction = compile_evidence_package(
        _WHI,
        as_of=_AS_OF,
        allow_network=True,
        sources=("europepmc",),
        sibling_queries=(_NHS,),
        max_per_source=2,
        enrich_identity=False,
        fetch_open_full_text=True,
        private_context=_PRIVATE,
        content_cues=ContentCue(support_phrases=(_SUPPORT,), refute_phrases=(_REFUTE,)),
    )
    _pause()
    replication = compile_evidence_package(
        _RITCHIE,
        as_of=_AS_OF,
        allow_network=True,
        sources=("europepmc",),
        sibling_queries=(_BEM,),
        max_per_source=2,
        enrich_identity=False,
        fetch_open_full_text=True,
        private_context=_PRIVATE,
        replication_hints=(
            ReplicationHint(
                original_doi=_BEM,
                replication_doi=_RITCHIE,
                confirm_phrases=(_REPLICATION,),
                result_phrase=_RESULT,
            ),
        ),
    )
    for package in (contradiction, replication):
        _assert_boundary(package)
    by_doi = {record.identity.doi: record for record in contradiction.records}
    whi = by_doi.get(_WHI)
    nhs = by_doi.get(_NHS)
    if whi is None or nhs is None:
        holds.append("CONTRADICTION_RECORDS_ABSENT")
    else:
        edges = {
            edge.record_id: edge for edge in contradiction.claim_evidence_graph.edges
        }
        whi_edge = edges.get(whi.record_id)
        nhs_edge = edges.get(nhs.record_id)
        if (
            whi_edge is None
            or nhs_edge is None
            or {whi_edge.polarity, nhs_edge.polarity} != {"SUPPORT", "REFUTE"}
        ):
            holds.append("CONTRADICTION_PHRASES_NOT_IN_RETRIEVED_CONTENT")
        else:
            assert whi.paper_type == "RANDOMIZED_TRIAL"
            assert nhs.paper_type == "OTHER"
            assert whi.peer_review_status == "UNKNOWN"
            assert nhs.peer_review_status == "UNKNOWN"
            assert whi.full_text_status == "NOT_PERMITTED"
            assert nhs.full_text_status == "NOT_PERMITTED"
            assert whi.abstract_access == "ABSTRACT_AVAILABLE"
            assert nhs.abstract_access == "ABSTRACT_AVAILABLE"
            assert whi_edge.evidence_scope == "ABSTRACT"
            assert nhs_edge.evidence_scope == "ABSTRACT"
            assert whi_edge.strength == "TENTATIVE"
            assert contradiction.contradiction_map.status == "PRESENT"
            assert contradiction.contradiction_map.resolution == "NONE"
            assert contradiction.contradiction_map.pairs
            pair = contradiction.contradiction_map.pairs[0]
            assert pair.uncertainty == "UNRESOLVED"
            assert pair.basis == "OPPOSING_CONTENT_POLARITY"
            assert pair.evidence_scope == "ABSTRACT"
            assert {pair.left_paper_type, pair.right_paper_type} == {
                "RANDOMIZED_TRIAL",
                "OTHER",
            }
            assert contradiction.claim_evidence_graph.status != "VALID"
            assert all(
                item.support_status != "SUPPORTED"
                for item in contradiction.capsule_candidates
            )
    rep_by_doi = {record.identity.doi: record for record in replication.records}
    bem = rep_by_doi.get(_BEM)
    ritchie = rep_by_doi.get(_RITCHIE)
    if bem is None or ritchie is None:
        holds.append("REPLICATION_RECORDS_ABSENT")
    else:
        assert bem.full_text_status == "NOT_PERMITTED"
        link_map = replication.replication_map
        if (
            link_map is None
            or link_map.status != "PRESENT"
            or not link_map.links
            or link_map.links[0].result_relation != "EXPLICIT_ABSTRACT_RESULT"
        ):
            holds.append("REPLICATION_NOT_EXPLICIT_IN_RETRIEVED_CONTENT")
        else:
            link = link_map.links[0]
            assert link.original_record_id == bem.record_id
            assert link.replication_record_id == ritchie.record_id
            assert "EXPLICIT_ABSTRACT" in link.evidence
            assert ritchie.replication_signal == "EXPLICIT_ABSTRACT"
        if ritchie.full_text_status != "OPEN_FULL_TEXT":
            holds.append(f"FULL_TEXT_{ritchie.full_text_status}")
        else:
            assert ritchie.full_text_source == "europepmc"
            assert ritchie.content_digest is not None
            assert ritchie.full_text_retrieved_at == _AS_OF
            assert ritchie.license_status == "STATED"
            assert ritchie.license_status != "OPEN"
    codes = {item.code for item in contradiction.gap_unknown_map.items}
    assert "FULL_TEXT_NOT_RETRIEVED" in codes
    assert "PEER_REVIEW_STATUS_UNKNOWN" in codes
    assert "RETRACTION_STATE_UNKNOWN" in codes or any(
        record.retraction.kind.value == "UNKNOWN" for record in contradiction.records
    )
    report = {
        "recorded_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "holds": holds,
        "hosts": sorted(set(_hosts(contradiction) + _hosts(replication))),
        "contradiction": _summary(contradiction),
        "replication": _summary(replication),
    }
    _PROOF.parent.mkdir(parents=True, exist_ok=True)
    _PROOF.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if holds:
        pytest.fail("HOLD: " + ",".join(holds))
