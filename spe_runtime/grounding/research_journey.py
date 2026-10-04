"""User-operable research journey over the canonical scholarly client.

question -> ContextNeed (NEED is not consent) -> explicit research consent
-> provider selection -> existing OpenAlex / Crossref / NCBI adapters
-> identifier normalization -> source records -> existing claim/evidence graph
-> contradiction or gap -> research-grounded prompt -> provenance receipt.

Does not promote product LIVE_INDEX or LIVE_RETRACTION. Does not mount the shell.
Does not invent a second OpenAlex client, evidence graph, or retraction engine.
A stored receipt is not live execution. allow_live records LIVE_FETCH_SCOPED only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Mapping
from zoneinfo import ZoneInfo

from spe_runtime.grounding.compiler import compile_context
from spe_runtime.grounding.live_adapters import (
    acquire_scholarly_hits,
    build_arxiv_url,
    build_crossref_url,
    build_openalex_url,
    build_pubmed_search_url,
    doi_lookup_key,
    fixture_transport,
    hits_to_capsules,
)
from spe_runtime.grounding.live_fabric import (
    ADAPTERS_IMPLEMENTED,
    LIVE_INDEX,
    LIVE_RETRACTION,
)
from spe_runtime.grounding.live_identity_scope import (
    evaluate_live_identity_scope,
    ncbi_family_count,
)
from spe_runtime.grounding.live_retraction_scope import evaluate_live_retraction_receipts
from spe_runtime.grounding.need import compile_context_need
from spe_runtime.grounding.privacy import minimize_public_query

SHELL_MOUNT = "NOT_DONE"
_NCBI = frozenset({"PUBMED", "PMC"})
_IST = ZoneInfo("Asia/Kolkata")
_BUILDERS = {
    "OPENALEX": build_openalex_url,
    "CROSSREF": build_crossref_url,
    "PUBMED": build_pubmed_search_url,
    "PMC": build_pubmed_search_url,
    "ARXIV": build_arxiv_url,
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _now_ist() -> str:
    return datetime.now(_IST).isoformat(timespec="seconds")


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _explicit_consent(value: object) -> bool:
    """Only boolean True is research consent. A ContextNeed is not consent."""
    return value is True


def _need_view(question: str) -> dict[str, object]:
    need = compile_context_need(question)
    return {
        "need_id": need.need_id,
        "domain_tags": list(need.domain_tags),
        "context_types": [item.value for item in need.context_types],
        "reason_codes": list(need.reason_codes),
        "freshness_required": need.freshness_required,
        "is_consent": False,
        "network": "NONE",
    }


def _closed(
    status: str,
    *,
    question: str,
    research_consent: bool,
    egress: str,
    reasons: list[str],
    extra: Mapping[str, object] | None = None,
) -> dict[str, object]:
    body: dict[str, object] = {
        "status": status,
        "journey_receipt": "NOT_PASS",
        "research_consent": research_consent is True,
        "need_is_consent": False,
        "need": _need_view(question),
        "question_sha256": _sha256_text(question),
        "network_calls": 0,
        "live_request_happened": False,
        "egress_classification": egress,
        "providers_sent": [],
        "outbound_urls_sent": [],
        "SHELL_MOUNT": SHELL_MOUNT,
        "product_LIVE_INDEX": LIVE_INDEX,
        "product_LIVE_RETRACTION": LIVE_RETRACTION,
        "may_promote": False,
        "reasons": reasons,
        "provenance": [],
    }
    if extra:
        body.update(dict(extra))
    return body


def _normalize_identifier(raw: object) -> dict[str, object]:
    text = str(raw or "").strip()
    peeled = text
    for prefix in ("https://doi.org/", "http://doi.org/", "doi:"):
        if peeled.lower().startswith(prefix):
            peeled = peeled[len(prefix) :]
    doi = doi_lookup_key(peeled)
    return {
        "raw": text,
        "normalized": doi or peeled,
        "doi": doi,
        "kind": "DOI" if doi else "OTHER",
    }


def _collapse_providers(
    providers: tuple[str, ...],
) -> tuple[list[str], list[str], list[str]]:
    unknown: list[str] = []
    ordered: list[str] = []
    seen: set[str] = set()
    for raw in providers:
        name = str(raw or "").strip().upper()
        if not name or name not in ADAPTERS_IMPLEMENTED:
            unknown.append(name or "<EMPTY>")
            continue
        if name in seen:
            continue
        seen.add(name)
        ordered.append(name)
    if unknown:
        return unknown, [], []
    ncbi_members = [name for name in ordered if name in _NCBI]
    if len(ncbi_members) <= 1:
        return [], ordered, []
    keep = ncbi_members[0]
    collapsed: list[str] = []
    dropped: list[str] = []
    for name in ordered:
        if name in _NCBI and name != keep:
            dropped.append(name)
            continue
        collapsed.append(name)
    return [], collapsed, dropped


def _family(provider: str) -> str:
    if provider in _NCBI:
        return "NCBI"
    return provider


def _load_pack(path: Path) -> dict[str, object]:
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def _rows(pack: Mapping[str, object], key: str) -> list[Mapping[str, object]]:
    raw = pack.get(key) or []
    if not isinstance(raw, list):
        return []
    return [row for row in raw if isinstance(row, Mapping)]


def _select_rows(
    rows: list[Mapping[str, object]],
    doi: str,
    providers: list[str],
) -> list[Mapping[str, object]]:
    want = set(providers)
    chosen: list[Mapping[str, object]] = []
    seen: set[tuple[object, ...]] = set()
    for row in rows:
        if str(row.get("canonical_doi") or "").strip().lower() != doi.lower():
            continue
        provider = str(row.get("provider") or "").strip().upper()
        if provider not in want:
            continue
        key = (
            provider,
            row.get("query_class"),
            row.get("query"),
            row.get("response_sha256"),
        )
        if key in seen:
            continue
        seen.add(key)
        chosen.append(row)
    return chosen


def _provenance_from_row(row: Mapping[str, object], record_kind: str) -> dict[str, object]:
    query = str(row.get("query") or "")
    ident = _normalize_identifier(
        row.get("returned_doi") or row.get("canonical_doi") or row.get("returned_id")
    )
    return {
        "record_kind": record_kind,
        "provider": str(row.get("provider") or "").upper(),
        "provider_family": str(row.get("provider_family") or _family(str(row.get("provider") or "").upper())),
        "query": query,
        "identifier": ident["normalized"],
        "identifier_kind": ident["kind"],
        "timestamp": row.get("timestamp_ist"),
        "url": query if query.startswith("http") else None,
        "response_digest": row.get("response_sha256"),
        "verification_status": row.get("status") or row.get("query_class"),
        "http_status": row.get("http_status"),
        "live_verified": False,
        "egress": "PRIOR_STORED_RECEIPT_NO_NEW_HTTP",
        "raw_status": row.get("raw_status") if isinstance(row.get("raw_status"), Mapping) else None,
    }


def _source_records(
    identity_rows: list[Mapping[str, object]],
    retracted: bool,
) -> list[dict[str, object]]:
    sources: list[dict[str, object]] = []
    for index, row in enumerate(identity_rows):
        provider = str(row.get("provider") or "UNKNOWN").upper()
        ident = _normalize_identifier(
            row.get("returned_doi") or row.get("canonical_doi") or row.get("returned_id")
        )
        title = str(row.get("title_prefix") or ident["normalized"] or provider)
        identifier = f"doi:{ident['doi']}" if ident["doi"] else str(ident["normalized"])
        catalog = None
        if provider == "OPENALEX":
            catalog = "OPENALEX"
        elif provider in _NCBI:
            catalog = "PMC"
        sources.append(
            {
                "sourceId": f"SRC-{provider}-{index}",
                "sourceType": "PEER_REVIEWED_PAPER",
                "identifier": identifier,
                "title": title,
                "authors": [],
                "year": 0,
                "isRetracted": retracted,
                "retractionDetails": "STORED_RETRACTION_RECEIPT" if retracted else None,
                "normativeApplicability": "UNKNOWN",
                "keyFinding": title,
                "sourceSaysText": title,
                "speInferenceText": "STORED_RECEIPT_METADATA_NOT_AUTHORITY",
                "contentTier": "METADATA",
                "catalogSource": catalog,
                "evidenceTier": "[RETRACTED_DANGER]" if retracted else "[HEURISTIC_HYPOTHESIS]",
            }
        )
    return sources


def _bind_graph(
    *,
    public_query: str,
    sources: list[dict[str, object]],
    forbidden: tuple[str, ...],
    unknowns: list[str],
) -> dict[str, object]:
    claim = {
        "claimId": "CLAIM-QUESTION",
        "claimText": public_query,
        "claimType": "SPECIFICATION",
        "claimSpan": {"start": 0, "end": len(public_query), "rawText": public_query},
        "disposition": "UNVERIFIED",
        "verificationRationale": "A question is not evidence. NEED is not consent. A stored receipt is not a product LIVE pass.",
    }
    payload = {
        "publicQuery": public_query,
        "claims": [claim],
        "sources": sources,
        "unknowns": unknowns,
        "forbidden_substrings": [item for item in forbidden if item],
        "taskId": "r5-research-journey",
        "candidateSha": "r5-journey-not-a-release",
    }
    root = _repo_root()
    runner = root / "apps/web/scripts/r5-research-journey-graph.mjs"
    register = root / "apps/web/scripts/r5-register.mjs"
    proc = subprocess.run(
        [
            "node",
            "--experimental-strip-types",
            "--import",
            str(register),
            str(runner),
        ],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        cwd=str(root),
        timeout=60,
        check=False,
    )
    if proc.returncode != 0:
        return {
            "ok": False,
            "error": "GRAPH_PROCESS_FAILED",
            "stderr": proc.stderr[-500:],
        }
    try:
        parsed = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {"ok": False, "error": "GRAPH_OUTPUT_INVALID", "stderr": proc.stderr[-500:]}
    return parsed if isinstance(parsed, dict) else {"ok": False, "error": "GRAPH_OUTPUT_INVALID"}


def _hits_from_identity(rows: list[Mapping[str, object]]) -> list[dict[str, object]]:
    hits: list[dict[str, object]] = []
    for row in rows:
        ident = _normalize_identifier(
            row.get("returned_doi") or row.get("canonical_doi") or row.get("returned_id")
        )
        hits.append(
            {
                "provider": str(row.get("provider") or "").upper(),
                "identifier": ident["normalized"],
                "title": str(row.get("title_prefix") or ident["normalized"] or ""),
                "abstract": "",
                "peer_review_class": "UNKNOWN",
                "retraction": "NOT_CHECKED",
            }
        )
    return hits


def _receipt_allows_pass(result: Mapping[str, object]) -> bool:
    if result.get("product_LIVE_INDEX") != "HOLD":
        return False
    if result.get("product_LIVE_RETRACTION") != "HOLD":
        return False
    if result.get("SHELL_MOUNT") != "NOT_DONE":
        return False
    if result.get("may_promote") is not False:
        return False
    if result.get("live_request_happened") is not False:
        return False
    provenance = result.get("provenance")
    if not isinstance(provenance, list) or not provenance:
        return False
    for row in provenance:
        if not isinstance(row, Mapping):
            return False
        if not row.get("provider") or not row.get("query") or not row.get("identifier"):
            return False
        if not row.get("timestamp") or not row.get("url") or not row.get("response_digest"):
            return False
        if not row.get("verification_status"):
            return False
    graph = result.get("graph")
    if not isinstance(graph, Mapping) or graph.get("ok") is not True:
        return False
    prompt = str(result.get("research_grounded_prompt") or "")
    if not prompt:
        return False
    return True


def run_research_journey(
    question: str,
    *,
    research_consent: object = False,
    providers: tuple[str, ...] = ("OPENALEX", "CROSSREF", "PUBMED"),
    sensitive_spans: tuple[str, ...] = (),
    private_document: str | None = None,
    transport=None,
    allow_live: bool = False,
    evidence_dir: str | None = None,
) -> dict[str, object]:
    """Run one research journey. Missing consent does not search."""
    if not isinstance(question, str):
        raise TypeError("question must be a string")
    consent = _explicit_consent(research_consent)
    if not consent:
        return _closed(
            "HELD_NO_CONSENT",
            question=question,
            research_consent=False,
            egress="NO_EGRESS_NO_CONSENT",
            reasons=["NEED_IS_NOT_CONSENT", "MISSING_RESEARCH_CONSENT_DOES_NOT_SEARCH"],
        )

    unknown, collapsed, dropped_ncbi = _collapse_providers(tuple(providers))
    if unknown:
        return _closed(
            "REJECTED_UNKNOWN_PROVIDER",
            question=question,
            research_consent=True,
            egress="NO_EGRESS_UNKNOWN_PROVIDER",
            reasons=["UNKNOWN_PROVIDER_FAIL_CLOSED", *unknown],
            extra={"unknown_providers": unknown},
        )
    if not collapsed:
        return _closed(
            "REJECTED_NO_PROVIDER",
            question=question,
            research_consent=True,
            egress="NO_EGRESS_NO_PROVIDER",
            reasons=["NO_PROVIDER_SELECTED"],
        )

    spans = tuple(item for item in sensitive_spans if item)
    if private_document:
        spans = spans + (private_document,)
    mini = minimize_public_query(question, spans)
    leaked = [
        span
        for span in spans
        if span and span in mini.public_query
    ]
    if leaked or (private_document and private_document in mini.public_query):
        return _closed(
            "REJECTED_PRIVACY",
            question=question,
            research_consent=True,
            egress="NO_EGRESS_PRIVACY",
            reasons=["PRIVATE_TEXT_WOULD_LEAVE", "NO_SEARCH"],
            extra={"providers_selected": collapsed},
        )
    if not mini.public_query:
        return _closed(
            "HELD_EMPTY_PUBLIC_QUERY",
            question=question,
            research_consent=True,
            egress="NO_EGRESS_EMPTY_PUBLIC_QUERY",
            reasons=["PUBLIC_QUERY_EMPTY_AFTER_MINIMIZATION"],
            extra={"providers_selected": collapsed, "ncbi_dropped_as_same_family": dropped_ncbi},
        )

    classified_urls = {
        provider: _BUILDERS[provider](mini.public_query) for provider in collapsed
    }
    blob = "\n".join(classified_urls.values()) + "\n" + mini.public_query
    if any(span and span in blob for span in spans):
        return _closed(
            "REJECTED_PRIVACY",
            question=question,
            research_consent=True,
            egress="NO_EGRESS_PRIVACY",
            reasons=["PRIVATE_TEXT_IN_CLASSIFIED_URL"],
        )

    ident = _normalize_identifier(mini.public_query)
    doi = ident["doi"] if isinstance(ident["doi"], str) else None
    families = []
    for provider in collapsed:
        family = _family(provider)
        if family not in families:
            families.append(family)

    root = _repo_root()
    identity_pack = _load_pack(root / "evidence/r4-task6/live_identity_bindings.json")
    retraction_pack = _load_pack(root / "evidence/r4-task6/live_retraction_receipts.json")
    known_dois = {
        str(row.get("canonical_doi") or "").strip().lower()
        for row in _rows(identity_pack, "bindings")
    }
    reuse = bool(doi and doi.lower() in known_dois and transport is None and allow_live is False)

    base: dict[str, object] = {
        "research_consent": True,
        "need_is_consent": False,
        "need": _need_view(mini.public_query),
        "question_sha256": _sha256_text(question),
        "public_query": mini.public_query,
        "omitted_span_count": len(mini.omitted_spans),
        "privacy_reason_codes": list(mini.reason_codes),
        "identifier": ident,
        "providers_selected": collapsed,
        "provider_families": families,
        "ncbi_dropped_as_same_family": dropped_ncbi,
        "pubmed_plus_pmc_not_two_families": True,
        "classified_query_urls_not_sent": classified_urls if reuse or transport is None else {},
        "SHELL_MOUNT": SHELL_MOUNT,
        "product_LIVE_INDEX": LIVE_INDEX,
        "product_LIVE_RETRACTION": LIVE_RETRACTION,
        "may_promote": False,
        "live_request_happened": False,
        "allow_live": allow_live is True,
        "executed_at_ist": _now_ist(),
    }

    if allow_live is True and transport is None:
        return _scoped_live_journey(
            base=base,
            public_query=mini.public_query,
            spans=spans,
            collapsed=collapsed,
            doi=doi if isinstance(doi, str) else None,
            evidence_dir=evidence_dir,
        )

    if reuse and doi is not None:
        identity_rows = _select_rows(_rows(identity_pack, "bindings"), doi, collapsed)
        retraction_rows = _select_rows(_rows(retraction_pack, "receipts"), doi, collapsed)
        filtered_identity = dict(identity_pack)
        filtered_identity["bindings"] = identity_rows
        filtered_retraction = dict(retraction_pack)
        filtered_retraction["receipts"] = retraction_rows
        identity_scope = evaluate_live_identity_scope(filtered_identity)
        retraction_scope = evaluate_live_retraction_receipts(filtered_retraction)
        both_rows_pack = {"bindings": _rows(identity_pack, "bindings")}
        retracted = False
        doi_scope = retraction_scope.get("dois")
        if isinstance(doi_scope, Mapping):
            detail = doi_scope.get(doi.lower()) or doi_scope.get(doi)
            if isinstance(detail, Mapping) and detail.get("retraction_gate") == "RETRACTION_BOUND":
                retracted = True
        provenance = [_provenance_from_row(row, "identity") for row in identity_rows]
        provenance.extend(_provenance_from_row(row, "retraction") for row in retraction_rows)
        hits = _hits_from_identity(identity_rows)
        capsules = hits_to_capsules(hits) if hits else []
        bundle = compile_context(mini.public_query, tuple(capsules)) if capsules else None
        sources = _source_records(identity_rows, retracted)
        unknowns = [
            "PRODUCT_LIVE_INDEX_HOLD",
            "PRODUCT_LIVE_RETRACTION_HOLD",
            "SHELL_MOUNT_NOT_DONE",
            "STORED_RECEIPT_IS_NOT_A_NEW_LIVE_CALL",
            "PUBMED_PLUS_PMC_ARE_ONE_NCBI_FAMILY",
        ]
        graph = _bind_graph(
            public_query=mini.public_query,
            sources=sources,
            forbidden=spans,
            unknowns=unknowns,
        )
        prompt = str(graph.get("prompt") or "") if graph.get("ok") is True else ""
        if any(span and span in prompt for span in spans):
            prompt = ""
            graph = {"ok": False, "error": "REJECTED_PRIVACY_PROMPT"}
        result = {
            **base,
            "status": "ACQUIRED_STORED_RECEIPT",
            "egress_classification": "STORED_RECEIPT_REUSE_NO_NEW_HTTP",
            "network_calls": 0,
            "outbound_urls_sent": [],
            "providers_sent": [],
            "canonical_doi": doi,
            "ncbi_family_count": ncbi_family_count(filtered_identity, doi),
            "ncbi_family_count_if_archive_has_pubmed_and_pmc": ncbi_family_count(both_rows_pack, doi),
            "ncbi_counts_as_two_providers": False,
            "identity_scope": {
                "scoped_LIVE_INDEX": identity_scope.get("scoped_LIVE_INDEX"),
                "product_LIVE_INDEX": identity_scope.get("product_LIVE_INDEX"),
                "product_LIVE_RETRACTION": identity_scope.get("product_LIVE_RETRACTION"),
                "may_promote": identity_scope.get("may_promote"),
            },
            "retraction_scope": {
                "scoped_LIVE_RETRACTION": retraction_scope.get("scoped_LIVE_RETRACTION"),
                "product_LIVE_INDEX": retraction_scope.get("product_LIVE_INDEX"),
                "product_LIVE_RETRACTION": retraction_scope.get("product_LIVE_RETRACTION"),
                "may_promote": retraction_scope.get("may_promote"),
                "pass": retraction_scope.get("pass"),
            },
            "source_records": sources,
            "grounding_reason_codes": list(bundle.reason_codes) if bundle is not None else [],
            "graph": {
                "ok": graph.get("ok") is True,
                "edge_relations": graph.get("edgeRelations") or [],
                "contradictions": graph.get("contradictions") or [],
                "gaps": graph.get("gaps") or [],
                "error": graph.get("error"),
                "authority": graph.get("authority"),
                "verdict": graph.get("verdict"),
            },
            "research_grounded_prompt": prompt,
            "provenance": provenance,
            "reasons": [
                "REUSED_R4_TASK6_RECEIPTS",
                "NO_NEW_HTTP",
                "PRODUCT_LIVE_GATES_NOT_MOVED",
                "PUBMED_PLUS_PMC_NOT_TWO_CONFIRMATIONS",
            ],
        }
        scope_ok = _receipt_allows_pass(result)
        contradictions = result["graph"]["contradictions"] if isinstance(result["graph"], dict) else []
        gaps = result["graph"]["gaps"] if isinstance(result["graph"], dict) else []
        has_finding = bool(contradictions or gaps)
        result["journey_receipt"] = (
            "PASS_WITHIN_TESTED_SCOPE" if scope_ok and has_finding else "NOT_PASS"
        )
        result["tested_scope"] = (
            "One consented DOI journey using stored OpenAlex, Crossref, and NCBI "
            "receipts already on disk. No new provider HTTP. Product LIVE gates remain HOLD. "
            "SHELL_MOUNT remains NOT_DONE."
        )
        return result

    get = transport if transport is not None else fixture_transport
    acquired = acquire_scholarly_hits(
        mini.public_query,
        providers=tuple(collapsed),
        sensitive_spans=spans,
        transport=get,
        consent=True,
    )
    mode = "INJECTED_TRANSPORT" if transport is not None else "CLIENT_FIXTURE_TRANSPORT_NO_EGRESS"
    hits = acquired.get("hits") if isinstance(acquired.get("hits"), list) else []
    hit_rows = [hit for hit in hits if isinstance(hit, Mapping)]
    sources = []
    for index, hit in enumerate(hit_rows):
        provider = str(hit.get("provider") or "UNKNOWN").upper()
        normalized = _normalize_identifier(hit.get("identifier"))
        identifier = (
            f"doi:{normalized['doi']}" if normalized["doi"] else str(normalized["normalized"])
        )
        retracted = str(hit.get("retraction") or "") == "RETRACTION_SIGNAL"
        title = str(hit.get("title") or identifier)
        sources.append(
            {
                "sourceId": f"SRC-{provider}-{index}",
                "sourceType": "PEER_REVIEWED_PAPER",
                "identifier": identifier,
                "title": title,
                "authors": [],
                "year": 0,
                "isRetracted": retracted,
                "normativeApplicability": "UNKNOWN",
                "keyFinding": str(hit.get("abstract") or title),
                "sourceSaysText": str(hit.get("abstract") or title),
                "speInferenceText": "FIXTURE_OR_INJECTED_TRANSPORT_NOT_LIVE_AUTHORITY",
                "contentTier": "METADATA",
                "evidenceTier": "[RETRACTED_DANGER]" if retracted else "[HEURISTIC_HYPOTHESIS]",
            }
        )
    graph = _bind_graph(
        public_query=mini.public_query,
        sources=sources,
        forbidden=spans,
        unknowns=["FIXTURE_IS_NOT_LIVE", "PRODUCT_LIVE_INDEX_HOLD", "PRODUCT_LIVE_RETRACTION_HOLD", "SHELL_MOUNT_NOT_DONE"],
    )
    prompt = str(graph.get("prompt") or "") if graph.get("ok") is True else ""
    return {
        **base,
        "status": str(acquired.get("status") or "PARTIAL"),
        "egress_classification": mode,
        "network_calls": int(acquired.get("network_calls") or 0),
        "outbound_urls_sent": [] if mode.endswith("NO_EGRESS") else list(classified_urls.values()),
        "providers_sent": collapsed if transport is not None else [],
        "classified_query_urls_not_sent": classified_urls,
        "client_mode": acquired.get("mode"),
        "client_live_index": acquired.get("live_index"),
        "client_live_retraction": acquired.get("live_retraction"),
        "source_records": sources,
        "graph": {
            "ok": graph.get("ok") is True,
            "edge_relations": graph.get("edgeRelations") or [],
            "contradictions": graph.get("contradictions") or [],
            "gaps": graph.get("gaps") or [],
            "error": graph.get("error"),
        },
        "research_grounded_prompt": prompt,
        "provenance": [],
        "journey_receipt": "NOT_PASS",
        "ncbi_family_count": 1 if any(provider in _NCBI for provider in collapsed) else 0,
        "ncbi_counts_as_two_providers": False,
        "reasons": [
            "CANONICAL_CLIENT_TRANSPORT",
            "NOT_A_LIVE_CALL" if transport is None and not allow_live else "TRANSPORT_SUPPLIED",
            "PRODUCT_LIVE_GATES_NOT_MOVED",
            "FIXTURE_OR_INJECTED_IS_NOT_PASS_WITHIN_LIVE_SCOPE",
        ],
    }



def _scoped_live_journey(
    *,
    base: dict[str, object],
    public_query: str,
    spans: tuple[str, ...],
    collapsed: list[str],
    doi: str | None,
    evidence_dir: str | None = None,
) -> dict[str, object]:
    """One privacy-minimized live fetch. Product LIVE gates stay HOLD.

    Identity is the first selected provider. Retraction or correction status
    comes only from a different provider family. PubMed and PMC are one NCBI
    family. A failed source is UNKNOWN or DEGRADED, never a fabricated record.
    """
    from spe_runtime.grounding.models import RetractionCheckStatus
    from spe_runtime.grounding.retraction import merge_retraction_checks

    acquired = acquire_scholarly_hits(
        public_query,
        providers=tuple(collapsed),
        sensitive_spans=spans,
        transport=None,
        consent=True,
        force_live=True,
        evidence_dir=evidence_dir,
    )
    if acquired.get("status") in {"HELD_NO_CONSENT", "REJECTED_PRIVACY", "TIMEOUT"}:
        blocked = _closed(
            str(acquired.get("status")),
            question=public_query,
            research_consent=acquired.get("status") != "HELD_NO_CONSENT",
            egress="NO_EGRESS_LIVE_NOT_SENT",
            reasons=["SCOPED_LIVE_DID_NOT_SEND", str(acquired.get("status"))],
        )
        blocked["allow_live"] = True
        blocked["stored_receipt_reported_as_live"] = False
        blocked["scoped_live_fetch"] = "NOT_SENT"
        return blocked

    fetches = acquired.get("fetches") if isinstance(acquired.get("fetches"), list) else []
    fetch_rows = [row for row in fetches if isinstance(row, Mapping)]
    hits = acquired.get("hits") if isinstance(acquired.get("hits"), list) else []
    hit_rows = [hit for hit in hits if isinstance(hit, Mapping)]
    sent_urls = [str(row.get("url") or "") for row in fetch_rows]
    if any(span and any(span in url for url in sent_urls) for span in spans):
        blocked = _closed(
            "REJECTED_PRIVACY",
            question=public_query,
            research_consent=True,
            egress="LIVE_URL_CONTAINED_PRIVATE_TEXT",
            reasons=["PRIVATE_TEXT_IN_LIVE_URL"],
        )
        blocked["allow_live"] = True
        blocked["network_calls"] = int(acquired.get("network_calls") or 0)
        blocked["stored_receipt_reported_as_live"] = False
        return blocked

    identity_provider = collapsed[0]
    retraction_provider = next(
        (name for name in collapsed if _family(name) != _family(identity_provider)),
        None,
    )

    def _fetch_for(provider: str) -> Mapping[str, object] | None:
        for row in fetch_rows:
            if str(row.get("provider") or "").upper() == provider:
                return row
        return None

    def _hit_for(provider: str) -> Mapping[str, object] | None:
        for hit in hit_rows:
            if str(hit.get("provider") or "").upper() == provider:
                return hit
        return None

    identity_fetch = _fetch_for(identity_provider)
    identity_hit = _hit_for(identity_provider)
    http_status = int(identity_fetch.get("http_status") or 0) if identity_fetch else 0
    digest = str(identity_fetch.get("response_sha256") or "") if identity_fetch else ""
    ident = _normalize_identifier(identity_hit.get("identifier") if identity_hit else "")
    returned_doi = ident["doi"] if isinstance(ident.get("doi"), str) else None
    returned_identifier = returned_doi or (
        str(ident.get("normalized")) if ident.get("normalized") else None
    )
    if (
        http_status == 200
        and len(digest) == 64
        and returned_doi
        and doi
        and returned_doi.lower() == doi.lower()
    ):
        verification = "DOI_MATCH"
        status = "LIVE_FETCH_SCOPED"
    elif http_status == 200 and len(digest) == 64 and returned_identifier:
        verification = "IDENTIFIER_RETURNED"
        status = "LIVE_FETCH_SCOPED"
    elif http_status >= 500 or http_status in {0, 599}:
        verification = "SOURCE_UNAVAILABLE"
        status = "DEGRADED"
        returned_identifier = None
    else:
        verification = "UNKNOWN"
        status = "UNKNOWN"
        if http_status != 200:
            returned_identifier = None

    retraction_fetch = _fetch_for(retraction_provider) if retraction_provider else None
    if retraction_provider is None:
        retraction_status = RetractionCheckStatus.UNKNOWN.value
        retraction_reason = "INDEPENDENT_FAMILY_NOT_QUERIED"
    else:
        r_http = int(retraction_fetch.get("http_status") or 0) if retraction_fetch else 0
        independent_hits = [
            hit
            for hit in hit_rows
            if str(hit.get("provider") or "").upper() == retraction_provider
        ]
        if retraction_fetch is None or r_http in {0, 599} or r_http >= 500:
            retraction_status = (
                RetractionCheckStatus.SOURCE_UNAVAILABLE.value
                if r_http >= 500 or r_http == 599
                else RetractionCheckStatus.UNKNOWN.value
            )
            retraction_reason = "INDEPENDENT_SOURCE_FAILED"
        elif not independent_hits:
            retraction_status = RetractionCheckStatus.UNKNOWN.value
            retraction_reason = "INDEPENDENT_SOURCE_NO_RECORD"
        else:
            witnesses = []
            for hit in independent_hits:
                raw_status = str(hit.get("retraction") or "UNKNOWN")
                try:
                    witnesses.append(RetractionCheckStatus(raw_status))
                except ValueError:
                    witnesses.append(RetractionCheckStatus.UNKNOWN)
            retraction_status = merge_retraction_checks(tuple(witnesses)).status.value
            retraction_reason = "INDEPENDENT_FAMILY_WITNESS"

    provenance: list[dict[str, object]] = []
    for row in fetch_rows:
        provider = str(row.get("provider") or "").upper()
        hit = _hit_for(provider)
        hid = _normalize_identifier(hit.get("identifier") if hit else "")
        if provider == identity_provider:
            row_verification = verification
            row_identifier = returned_identifier
        elif provider == retraction_provider:
            row_verification = retraction_status
            row_identifier = hid.get("doi") or hid.get("normalized") or None
        else:
            row_verification = "NOT_USED_FOR_SCOPED_CLAIM"
            row_identifier = hid.get("doi") or hid.get("normalized") or None
        provenance.append(
            {
                "record_kind": (
                    "identity"
                    if provider == identity_provider
                    else "retraction"
                    if provider == retraction_provider
                    else "supplemental"
                ),
                "provider": provider,
                "provider_family": _family(provider),
                "query": row.get("url"),
                "identifier": row_identifier,
                "identifier_kind": "DOI" if isinstance(row_identifier, str) and str(row_identifier).startswith("10.") else hid.get("kind"),
                "timestamp": row.get("timestamp_ist"),
                "url": row.get("url"),
                "response_digest": row.get("response_sha256"),
                "verification_status": row_verification,
                "http_status": row.get("http_status"),
                "live_verified": int(row.get("http_status") or 0) == 200 and bool(row.get("response_sha256")),
                "egress": "LIVE_HTTPS_PRIVACY_MINIMIZED",
                "stored_receipt": False,
                "notice_types": list(hit.get("notice_types") or []) if hit else [],
                "body_path": row.get("body_path"),
            }
        )

    retracted = retraction_status == RetractionCheckStatus.RETRACTION_SIGNAL.value
    sources: list[dict[str, object]] = []
    if identity_hit is not None and status == "LIVE_FETCH_SCOPED":
        title = str(identity_hit.get("title") or returned_identifier or identity_provider)
        sources.append(
            {
                "sourceId": f"SRC-{identity_provider}-0",
                "sourceType": "PEER_REVIEWED_PAPER",
                "identifier": f"doi:{returned_doi}" if returned_doi else str(returned_identifier),
                "title": title,
                "authors": [],
                "year": 0,
                "isRetracted": retracted,
                "retractionDetails": retraction_status,
                "normativeApplicability": "UNKNOWN",
                "keyFinding": title,
                "sourceSaysText": title,
                "speInferenceText": "SCOPED_LIVE_FETCH_IS_NOT_PRODUCT_LIVE_PASS",
                "contentTier": "METADATA",
                "evidenceTier": "[RETRACTED_DANGER]" if retracted else "[HEURISTIC_HYPOTHESIS]",
            }
        )
    graph = _bind_graph(
        public_query=public_query,
        sources=sources,
        forbidden=spans,
        unknowns=[
            "PRODUCT_LIVE_INDEX_HOLD",
            "PRODUCT_LIVE_RETRACTION_HOLD",
            "LIVE_FETCH_SCOPED_IS_NOT_FOUNDER_LAW",
            "STORED_RECEIPT_IS_NOT_THIS_EXECUTION",
            "PUBMED_PLUS_PMC_ARE_ONE_NCBI_FAMILY",
        ],
    )
    prompt = str(graph.get("prompt") or "") if graph.get("ok") is True else ""
    if any(span and span in prompt for span in spans):
        prompt = ""
        graph = {"ok": False, "error": "REJECTED_PRIVACY_PROMPT"}

    result = {
        **base,
        "status": status,
        "scoped_live_fetch": "LIVE_FETCH_SCOPED" if status == "LIVE_FETCH_SCOPED" else status,
        "egress_classification": "LIVE_HTTPS_PRIVACY_MINIMIZED",
        "network_calls": int(acquired.get("network_calls") or 0),
        "outbound_urls_sent": sent_urls,
        "providers_sent": collapsed,
        "classified_query_urls_not_sent": {},
        "live_request_happened": int(acquired.get("network_calls") or 0) > 0,
        "allow_live": True,
        "stored_receipt_reported_as_live": False,
        "canonical_doi": doi,
        "provider": identity_provider,
        "provider_family": _family(identity_provider),
        "identifier": returned_identifier,
        "response_digest": digest if status == "LIVE_FETCH_SCOPED" else None,
        "response_body_path": identity_fetch.get("body_path") if identity_fetch and status == "LIVE_FETCH_SCOPED" else None,
        "retraction_body_path": retraction_fetch.get("body_path") if retraction_fetch else None,
        "verification_status": verification,
        "retraction_status": retraction_status,
        "retraction_provider": retraction_provider,
        "retraction_provider_family": _family(retraction_provider) if retraction_provider else None,
        "retraction_independent_of_identity": retraction_provider is not None,
        "retraction_reason": retraction_reason,
        "retraction_response_digest": (
            retraction_fetch.get("response_sha256") if retraction_fetch else None
        ),
        "ncbi_counts_as_two_providers": False,
        "ncbi_family_count": 1 if any(name in _NCBI for name in collapsed) else 0,
        "product_LIVE_INDEX": LIVE_INDEX,
        "product_LIVE_RETRACTION": LIVE_RETRACTION,
        "may_promote": False,
        "journey_receipt": "NOT_PASS",
        "client_mode": acquired.get("mode"),
        "client_live_index": acquired.get("live_index"),
        "client_live_retraction": acquired.get("live_retraction"),
        "source_records": sources,
        "graph": {
            "ok": graph.get("ok") is True,
            "edge_relations": graph.get("edgeRelations") or [],
            "contradictions": graph.get("contradictions") or [],
            "gaps": graph.get("gaps") or [],
            "error": graph.get("error"),
        },
        "research_grounded_prompt": prompt,
        "provenance": provenance,
        "reasons": [
            "SCOPED_LIVE_FETCH_IS_NOT_PRODUCT_PASS",
            "ONE_DOI_DOES_NOT_MEET_FOUNDER_LAW",
            "STORED_RECEIPT_NOT_REPORTED_AS_LIVE",
            "PUBMED_PLUS_PMC_NOT_TWO_CONFIRMATIONS",
            "PRODUCT_LIVE_GATES_NOT_MOVED",
            retraction_reason,
        ],
        "tested_scope": (
            "One consented privacy-minimized live fetch through the existing "
            "scholarly adapters. Product LIVE_INDEX and LIVE_RETRACTION remain HOLD."
        ),
    }
    if status != "LIVE_FETCH_SCOPED":
        result["response_digest"] = None
        result["reasons"] = list(result["reasons"]) + ["EXTERNAL_SOURCE_NOT_FABRICATED"]
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run one SPE research journey. Consent defaults off.")
    parser.add_argument("--question", required=True)
    parser.add_argument("--consent", action="store_true", help="Explicit research consent. Omit to refuse search.")
    parser.add_argument(
        "--live",
        action="store_true",
        help="Scoped live fetch. Does not promote product LIVE_INDEX or LIVE_RETRACTION.",
    )
    parser.add_argument("--provider", action="append", dest="providers")
    parser.add_argument("--private-document", default=None, help="Local text that must not be placed in the outbound query.")
    args = parser.parse_args(argv)
    providers = tuple(args.providers) if args.providers else ("OPENALEX", "CROSSREF", "PUBMED")
    result = run_research_journey(
        args.question,
        research_consent=True if args.consent else False,
        providers=providers,
        private_document=args.private_document,
        allow_live=bool(args.live),
    )
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
