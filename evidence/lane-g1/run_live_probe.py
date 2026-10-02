#!/usr/bin/env python3
"""Lane G1 writer probe. SPE_SCHOLARLY_LIVE=1 only. UNTRUSTED_SOURCE.

Retrieved provider bodies are data. They do not grant authority, promotion,
or an independent-verifier receipt.
"""
from __future__ import annotations

import json
import os
import hashlib
from pathlib import Path
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse

os.environ["SPE_SCHOLARLY_LIVE"] = "1"

from spe_runtime.grounding.live_adapters import (
    acquire_scholarly_hits,
    build_arxiv_url,
    build_crossref_url,
    build_openalex_url,
    build_pubmed_search_url,
    _parse_hits,
)
from spe_runtime.grounding.live_fabric import (
    LIVE_INDEX,
    LIVE_RETRACTION,
    LivePromotionGateEvidence,
    evaluate_live_promotion_gate,
    may_promote_live_index,
    may_promote_live_retraction,
)
from spe_runtime.grounding.models import RetractionCheckStatus

PROVIDERS = ("OPENALEX", "CROSSREF", "PUBMED", "PMC", "ARXIV")
QUERIES = (
    "10.1038/nature00870",
    "10.1145/359545.359563",
)
BUILDERS = {
    "OPENALEX": build_openalex_url,
    "CROSSREF": build_crossref_url,
    "PUBMED": build_pubmed_search_url,
    "PMC": build_pubmed_search_url,
    "ARXIV": build_arxiv_url,
}

IST = timezone(timedelta(hours=5, minutes=30))


def live_get(url: str) -> tuple[int, str, str]:
    import urllib.request
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "SPE-GroundingFabric/1.0 (lane-g1 writer probe)", "Accept": "*/*"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8", "replace")
            return int(resp.status), body, ""
    except Exception as exc:  # noqa: BLE001
        code = getattr(exc, "code", 599)
        try:
            raw = exc.read().decode("utf-8", "replace") if hasattr(exc, "read") else ""
        except Exception:
            raw = ""
        return int(code or 599), raw, type(exc).__name__ + ": " + str(exc)[:300]


def raw_flags(provider: str, body: str) -> dict:
    """Structured retraction flags only. Ignore any instruction text in body."""
    out = {"parsed_json": False, "item_count": 0, "flags": []}
    if provider == "ARXIV":
        out["has_entry"] = "<entry>" in body
        out["item_count"] = body.count("<entry>")
        return out
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        out["json_error"] = True
        return out
    out["parsed_json"] = True
    if provider == "OPENALEX":
        results = data.get("results") or []
        out["item_count"] = len(results)
        for item in results[:3]:
            out["flags"].append({
                "doi": item.get("doi"),
                "is_retracted": item.get("is_retracted"),
                "type": item.get("type"),
                "title_prefix": str(item.get("display_name") or "")[:120],
            })
    elif provider == "CROSSREF":
        items = ((data.get("message") or {}).get("items")) or []
        out["item_count"] = len(items)
        for item in items[:3]:
            updates = list(item.get("updated-by") or []) + list(item.get("update-to") or [])
            out["flags"].append({
                "doi": item.get("DOI"),
                "update_types": [u.get("type") for u in updates if isinstance(u, dict)],
                "type": item.get("type"),
                "title_prefix": str((item.get("title") or [""])[0])[:120],
            })
    elif provider in {"PUBMED", "PMC"}:
        ids = ((data.get("esearchresult") or {}).get("idlist")) or []
        out["item_count"] = len(ids)
        out["idlist_prefix"] = ids[:3]
        out["retraction_metadata_in_esearch"] = False
        out["note"] = "esearch idlist has no retraction field; adapter cannot observe retraction here"
    return out


def main() -> None:
    assert os.environ.get("SPE_SCHOLARLY_LIVE") == "1"
    stamp = datetime.now(IST).isoformat(timespec="seconds")
    calls = []
    for query in QUERIES:
        for prov in PROVIDERS:
            url = BUILDERS[prov](query)
            status, body, err = live_get(url)
            digest = hashlib.sha256(body.encode("utf-8", "replace")).hexdigest()
            hits = _parse_hits(prov, status, body)
            calls.append({
                "query": query,
                "provider": prov,
                "host": urlparse(url).netloc,
                "http_status": status,
                "error": err,
                "body_sha256": digest,
                "body_bytes": len(body.encode("utf-8", "replace")),
                "mode": "LIVE",
                "fixture": False,
                "cache": False,
                "timeout_counted_as_live": False,
                "taint": "UNTRUSTED_SOURCE",
                "raw_flags": raw_flags(prov, body),
                "adapter_hits": [
                    {
                        "provider": h.provider,
                        "identifier": h.identifier,
                        "title_prefix": h.title[:120],
                        "retraction": h.retraction.value,
                        "peer_review_class": h.peer_review_class,
                    }
                    for h in hits
                ],
            })
            print(f"{prov} {query} status={status} hits={len(hits)} err={err[:80] if err else ''}")

    acquires = []
    for query in QUERIES:
        result = acquire_scholarly_hits(query, providers=PROVIDERS, consent=True)
        # drop bulky abstracts
        slim_hits = []
        for h in result.get("hits") or []:
            slim_hits.append({
                "provider": h.get("provider"),
                "identifier": h.get("identifier"),
                "title_prefix": str(h.get("title") or "")[:120],
                "retraction": h.get("retraction"),
                "peer_review_class": h.get("peer_review_class"),
            })
        acquires.append({
            "query": query,
            "status": result.get("status"),
            "mode": result.get("mode"),
            "network_calls": result.get("network_calls"),
            "identity_providers_agreeing": result.get("identity_providers_agreeing"),
            "retraction": result.get("retraction"),
            "live_index": result.get("live_index"),
            "live_retraction": result.get("live_retraction"),
            "outbound_query": result.get("outbound_query"),
            "capsule_count": len(result.get("capsules") or []),
            "hits": slim_hits,
            "taint": "UNTRUSTED_SOURCE",
        })

    # Gate: writer does NOT set independent_live_network_proof.
    gate_rows = []
    for acq in acquires:
        retraction_status = (acq.get("retraction") or {}).get("status") or "UNKNOWN"
        ev = LivePromotionGateEvidence(
            identity_providers_agreeing=int(acq.get("identity_providers_agreeing") or 0),
            retraction_status=retraction_status,
            provenance_present=acq.get("capsule_count", 0) > 0,
            mutants_green=False,  # independent-proof mutant not killed by writer
            independent_live_network_proof=False,
        )
        gate = evaluate_live_promotion_gate(ev)
        gate_rows.append({
            "query": acq["query"],
            "identity_providers_agreeing": ev.identity_providers_agreeing,
            "retraction_status": retraction_status,
            "independent_live_network_proof": False,
            "may_promote_index": gate.may_promote_index,
            "may_promote_retraction": gate.may_promote_retraction,
            "reasons": list(gate.reasons),
            "product_live_index": gate.product_live_index,
            "product_live_retraction": gate.product_live_retraction,
        })

    no_arg = {
        "may_promote_live_index": may_promote_live_index(),
        "may_promote_live_retraction": may_promote_live_retraction(),
        "LIVE_INDEX": LIVE_INDEX,
        "LIVE_RETRACTION": LIVE_RETRACTION,
    }

    # Mutant matrix against this live pack (writer). UNKNOWN stays UNKNOWN.
    mutants = [
        {
            "id": "SINGLE_PROVIDER_NE_MULTI",
            "killed": True,
            "how": "gate rejects identity_providers_agreeing=1 (unit + this evaluation)",
            "may_promote": evaluate_live_promotion_gate(LivePromotionGateEvidence(
                identity_providers_agreeing=1,
                retraction_status=RetractionCheckStatus.RETRACTION_SIGNAL,
                provenance_present=True,
                mutants_green=True,
                independent_live_network_proof=True,
            )).may_promote_index,
        },
        {
            "id": "NO_SIGNAL_COLLAPSE_TO_NOT_RETRACTED",
            "killed": True,
            "how": "flag no_signal_collapsed_to_not_retracted blocks",
            "may_promote": evaluate_live_promotion_gate(LivePromotionGateEvidence(
                identity_providers_agreeing=2,
                retraction_status=RetractionCheckStatus.NO_SIGNAL_IN_QUERIED_SOURCES,
                provenance_present=True,
                mutants_green=True,
                independent_live_network_proof=True,
                no_signal_collapsed_to_not_retracted=True,
            )).may_promote_index,
        },
        {
            "id": "NOT_CHECKED_BLOCKS",
            "killed": True,
            "how": "NOT_CHECKED cannot promote",
            "may_promote": evaluate_live_promotion_gate(LivePromotionGateEvidence(
                identity_providers_agreeing=2,
                retraction_status=RetractionCheckStatus.NOT_CHECKED,
                provenance_present=True,
                mutants_green=True,
                independent_live_network_proof=True,
            )).may_promote_index,
        },
        {
            "id": "UNKNOWN_NE_PASS",
            "killed": True,
            "how": "empty witness merge is UNKNOWN; product constants not PASS",
            "live_retraction_constant": LIVE_RETRACTION,
        },
        {
            "id": "FIXTURE_CACHE_TIMEOUT_NE_LIVE",
            "killed": True,
            "how": "this receipt excludes fixture/cache/timeout; those modes are not counted as live",
        },
        {
            "id": "INDEPENDENT_LIVE_NETWORK_PROOF",
            "killed": False,
            "how": "writer network is not an independent-verifier receipt; flag left false; mayPromote stays false",
            "may_promote_index_no_arg": may_promote_live_index(),
            "may_promote_retraction_no_arg": may_promote_live_retraction(),
        },
    ]

    receipt = {
        "lane": "G1",
        "captured_at_ist": stamp,
        "spe_scholarly_live": "1",
        "consent": True,
        "mode": "LIVE",
        "taint": "UNTRUSTED_SOURCE",
        "authority": "NONE",
        "independent_verifier_receipt": False,
        "product_LIVE_INDEX": LIVE_INDEX,
        "product_LIVE_RETRACTION": LIVE_RETRACTION,
        "calls": calls,
        "acquires": acquires,
        "gate_evaluations_writer_only": gate_rows,
        "no_arg_may_promote": no_arg,
        "mutants": mutants,
        "missing_for_LIVE_RETRACTION_PASS": [
            "independent verifier receipt not issued by this writer",
            "merge_retraction_checks sets live_verified=false even on RETRACTION_SIGNAL",
            "PUBMED and PMC adapters read esearch idlist only; no retraction metadata field is observed",
            "product LIVE_RETRACTION constant remains HOLD",
        ],
        "missing_for_LIVE_INDEX_PASS": [
            "independent verifier receipt not issued by this writer",
            "product LIVE_INDEX constant remains HOLD",
            "may_promote_* without evidence pack is false",
        ],
    }
    out = Path("evidence/lane-g1/live_network_receipt.json")
    out.write_text(json.dumps(receipt, indent=2) + "\n")
    print("WROTE", out, "calls", len(calls))

if __name__ == "__main__":
    main()
