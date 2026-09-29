"""Explicit live qualification. Skipped unless SPE_SCHOLARLY_LIVE=1.

A public outage is recorded. It does not relabel the source as qualified.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

import pytest

from spe_runtime.scholarly.models import EvidencePackage
from spe_runtime.scholarly.pipeline import compile_evidence_package
from spe_runtime.scholarly.qualify import qualify_source
from spe_runtime.scholarly.registry import load_registry

pytestmark = pytest.mark.skipif(
    os.environ.get("SPE_SCHOLARLY_LIVE") != "1",
    reason="live scholarly qualification is explicit",
)

_AS_OF = "2026-09-29"
_TOPIC = "CRISPR Cas9 gene editing"
_DOI = "10.1038/s41586-021-03819-2"
_RETRACTED_DOI = "10.1016/s0140-6736(97)11096-0"
_PROOF = Path("proofs/scholarly_fabric_20260930/live_qualification.json")
_ALLOWLIST = load_registry().allowlist()


def _pause() -> None:
    time.sleep(0.4)


def test_live_enabled_sources_are_qualified_without_leaving_the_allowlist() -> None:
    probes = (
        ("pubmed", _TOPIC),
        ("pmc", _TOPIC),
        ("europepmc", _TOPIC),
        ("crossref", _TOPIC),
        ("doaj", "open access scholarly publishing"),
        ("arxiv", "quantum error correction"),
        ("openalex", _TOPIC),
    )
    rows = []
    hosts: set[str] = set()
    for source_id, query in probes:
        qualification, package = qualify_source(
            source_id,
            query,
            as_of=_AS_OF,
            allow_network=True,
            pause=_pause,
        )
        rows.append(qualification.to_dict())
        assert package.to_dict()["semantic_authority"] == "NONE"
        assert qualification.source_status != "QUALIFIED" or qualification.parse_result == "PARSED"
        if qualification.source_status == "QUALIFIED":
            assert qualification.http_status == 200
        for event in package.egress:
            hosts.add(event.host)
            assert event.host in _ALLOWLIST
        for record in package.records:
            assert record.full_text_status == "NOT_RETRIEVED"
            if source_id == "arxiv":
                assert package.capsule_candidates
                assert all(item.source_class == "preprint" for item in package.capsule_candidates)

    topic_package = compile_evidence_package(
        _TOPIC,
        as_of=_AS_OF,
        allow_network=True,
        max_per_source=3,
        enrich_identity=True,
        fetch_open_full_text=False,
    )
    _pause()
    dedup = compile_evidence_package(
        _DOI,
        as_of=_AS_OF,
        allow_network=True,
        sources=("pubmed", "europepmc", "crossref", "openalex"),
        max_per_source=3,
        enrich_identity=True,
        fetch_open_full_text=False,
    )
    _pause()
    retracted = compile_evidence_package(
        _RETRACTED_DOI,
        as_of=_AS_OF,
        allow_network=True,
        sources=("pubmed", "crossref", "openalex"),
        max_per_source=2,
        enrich_identity=True,
        fetch_open_full_text=False,
    )
    for package in (topic_package, dedup, retracted):
        assert package.to_dict()["semantic_authority"] == "NONE"
        assert package.to_dict()["integration"]["wired_to_k3"] is False
        for event in package.egress:
            hosts.add(event.host)
            assert event.host in _ALLOWLIST
        for record in package.records:
            assert record.full_text_status == "NOT_RETRIEVED"
            assert all(item.support_status != "SUPPORTED" for item in package.capsule_candidates)
        if package.records and not package.contradiction_map.pairs:
            assert package.contradiction_map.status == "UNKNOWN"
            assert package.contradiction_map.reason == "NONE_OBSERVED_IN_FETCHED_SET"
    idconv_urls = [
        event.path for event in dedup.egress if event.source_id == "ncbi_idconv"
    ]
    for event in dedup.egress:
        if event.source_id == "ncbi_idconv":
            assert event.query_keys
            assert "term" not in event.query_keys
            assert "query" not in event.query_keys
    report = {
        "recorded_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "probes": rows,
        "hosts": sorted(hosts),
        "unexpected_hosts": sorted(hosts - set(_ALLOWLIST)),
        "topic_package": _package_summary(topic_package),
        "dedup": _package_summary(dedup),
        "retracted": _package_summary(retracted),
        "idconv_paths": idconv_urls,
    }
    _PROOF.parent.mkdir(parents=True, exist_ok=True)
    _PROOF.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    assert report["unexpected_hosts"] == []
    assert all(urlsplit(f"https://{host}").hostname in _ALLOWLIST for host in hosts)
    assert all(row["source_status"] == "QUALIFIED" for row in rows)
    assert topic_package.records
    assert topic_package.to_dict()["semantic_authority"] == "NONE"
    assert any(len(record.source_ids) > 1 for record in dedup.records)
    assert idconv_urls
    assert all(event.status == 200 for event in dedup.egress if event.source_id == "ncbi_idconv")
    assert not any(item.code == "IDCONV_UNAVAILABLE" for item in dedup.gap_unknown_map.items)
    assert any(record.retraction.kind.value == "RETRACTION" for record in retracted.records)
    assert all(record.full_text_status == "NOT_RETRIEVED" for record in topic_package.records)


def _package_summary(package: EvidencePackage) -> dict[str, object]:
    groups = package.groups
    return {
        "status": package.status.value,
        "semantic_authority": package.to_dict()["semantic_authority"],
        "sources_requested": list(package.sources_requested),
        "egress": [item.to_dict() for item in package.egress],
        "record_count": len(package.records),
        "source_ids": [list(record.source_ids) for record in package.records],
        "identities": [record.identity.to_dict() for record in package.records],
        "retractions": [record.retraction.to_dict() for record in package.records],
        "full_text": [record.full_text_status for record in package.records],
        "groups": {
            "foundational": len(groups.foundational),
            "frontier": len(groups.frontier),
            "contradictory": len(groups.contradictory),
            "replication": len(groups.replication),
        },
        "graph": package.claim_evidence_graph.to_dict(),
        "contradiction_map": package.contradiction_map.to_dict(),
        "gaps": [item.to_dict() for item in package.gap_unknown_map.items],
        "refusal_reasons": list(package.refusal_reasons),
        "quarantine": [item.to_dict() for item in package.quarantine],
    }
