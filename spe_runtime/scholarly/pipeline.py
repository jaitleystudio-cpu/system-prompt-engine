"""Research query to a scholarly evidence package.

Boundary: this function does not write XCAT envelopes, K3 prompts, quality
scores, or grounding capsules. Network stays off unless allow_network is set.
The clock is not read; the caller passes as_of.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import replace
from datetime import date
from typing import Protocol
from urllib.parse import parse_qsl, urlsplit

from spe_runtime.scholarly.capsules import build_capsule_candidates
from spe_runtime.scholarly.dedup import deduplicate
from spe_runtime.scholarly.egress import assert_allowed
from spe_runtime.scholarly.errors import EgressDenied, RegistryError, ShapeError
from spe_runtime.scholarly.graphs import build_graphs, claim_id_for
from spe_runtime.scholarly.grouping import group_records
from spe_runtime.scholarly.identity import ScholarlyIdentity, make_identity, merge_identities
from spe_runtime.scholarly.models import (
    ClaimAssertion,
    ClaimEvidenceGraph,
    ClaimNode,
    ContradictionMap,
    EgressEvent,
    EvidencePackage,
    GapUnknownMap,
    NoticeKind,
    PackageStatus,
    PaperDraft,
    QuarantineEntry,
    RecordGroups,
    UnknownItem,
)
from spe_runtime.scholarly.normalize import (
    PARSERS,
    parse_arxiv_atom,
    parse_esearch_ids,
    parse_idconv,
    parse_pubmed_esummary,
)
from spe_runtime.scholarly.privacy import minimize_scholarly_query
from spe_runtime.scholarly.queries import (
    build_esummary_url,
    build_idconv_url,
    build_search_url,
    outbound_field_names,
)
from spe_runtime.scholarly.registry import SourceRegistry, SourceSpec, load_registry
from spe_runtime.scholarly.transport import AllowlistTransport, HttpResponse, TransportError

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_MAX_QUERY = 400
_MAX_IDCONV = 50
_POLARITIES = frozenset({"SUPPORT", "REFUTE", "NEUTRAL"})


class Transport(Protocol):
    """Minimal GET transport. Implementations must not follow off-allowlist redirects."""

    def get(self, url: str, headers: dict[str, str]) -> HttpResponse:
        """Fetch one HTTPS URL."""


def _digest(payload: object) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _headers(contact_email: str | None, accept: str) -> dict[str, str]:
    user_agent = "SPE-ScholarlyFabric/1.0"
    if contact_email:
        user_agent = f"{user_agent} (mailto:{contact_email})"
    return {"Accept": accept, "User-Agent": user_agent}


def _event(source_id: str, url: str, status: int) -> EgressEvent:
    parts = urlsplit(url)
    keys = tuple(sorted({key for key, _value in parse_qsl(parts.query, keep_blank_values=True)}))
    return EgressEvent(
        source_id=source_id,
        host=parts.hostname or "",
        method="GET",
        path=parts.path,
        query_keys=keys,
        status=status,
    )


def _empty_graph(query_text: str) -> ClaimEvidenceGraph:
    if not query_text:
        return ClaimEvidenceGraph("UNKNOWN", (), ())
    return ClaimEvidenceGraph(
        "UNKNOWN",
        (ClaimNode(claim_id_for(query_text), query_text, "QUERY"),),
        (),
    )


def _package(
    *,
    status: PackageStatus,
    query_text: str,
    as_of: str,
    frontier_years: int,
    max_per_source: int,
    sources_requested: tuple[str, ...],
    records: tuple = (),
    quarantine: tuple[QuarantineEntry, ...] = (),
    groups: RecordGroups | None = None,
    graph: ClaimEvidenceGraph | None = None,
    contradictions: ContradictionMap | None = None,
    gaps: tuple[UnknownItem, ...] = (),
    capsules: tuple = (),
    egress: tuple[EgressEvent, ...] = (),
    refusal_reasons: tuple[str, ...] = (),
    outbound_query: str = "",
    private_withheld: bool = False,
    withheld_labels: tuple[str, ...] = (),
    outbound_shapes: tuple[tuple[str, tuple[str, ...]], ...] = (),
) -> EvidencePackage:
    built = EvidencePackage(
        package_id="",
        status=status,
        query_text=query_text,
        as_of=as_of,
        frontier_years=frontier_years,
        max_per_source=max_per_source,
        sources_requested=sources_requested,
        records=records,
        quarantine=quarantine,
        groups=groups
        or RecordGroups(foundational=(), frontier=(), contradictory=(), replication=()),
        claim_evidence_graph=graph or _empty_graph(query_text),
        contradiction_map=contradictions
        or ContradictionMap("UNKNOWN", "QUERY_REFUSED", ()),
        gap_unknown_map=GapUnknownMap(
            tuple(sorted(gaps, key=lambda item: (item.code, item.subject, item.detail)))
        ),
        capsule_candidates=capsules,
        egress=egress,
        refusal_reasons=refusal_reasons,
        outbound_query=outbound_query,
        private_withheld=private_withheld,
        withheld_labels=withheld_labels,
        outbound_shapes=outbound_shapes,
    )
    body = built.to_dict()
    body.pop("package_id")
    return replace(built, package_id=_digest(body))


def _shares(left: ScholarlyIdentity, right: ScholarlyIdentity) -> bool:
    return any(
        (
            left.doi is not None and left.doi == right.doi,
            left.pmid is not None and left.pmid == right.pmid,
            left.pmcid is not None and left.pmcid == right.pmcid,
        )
    )


def _apply_crosswalk(
    drafts: list[PaperDraft], triples: tuple[dict[str, str], ...]
) -> list[PaperDraft]:
    others = tuple(
        make_identity(doi=item.get("doi"), pmid=item.get("pmid"), pmcid=item.get("pmcid"))
        for item in triples
    )
    updated: list[PaperDraft] = []
    for draft in drafts:
        merged = draft.identity
        for other in others:
            if other.status.value != "UNKNOWN" and _shares(merged, other):
                merged = merge_identities((merged, other))
        if merged == draft.identity:
            updated.append(draft)
        else:
            updated.append(replace(draft, identity=merged))
    return updated


def _validate(
    *,
    query_text: str,
    as_of: str,
    frontier_years: int,
    max_per_source: int,
    contact_email: str | None,
    assertions: tuple[ClaimAssertion, ...],
    allow_network: bool,
    transport: Transport | None,
) -> list[str]:
    reasons: list[str] = []
    if not query_text or len(query_text) > _MAX_QUERY:
        reasons.append("QUERY_INVALID")
    if any(ord(char) < 32 for char in query_text):
        reasons.append("QUERY_CONTROL_CHARACTER")
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", as_of) is None:
        reasons.append("AS_OF_INVALID")
    else:
        try:
            date.fromisoformat(as_of)
        except ValueError:
            reasons.append("AS_OF_INVALID")
    if not isinstance(frontier_years, int) or not 1 <= frontier_years <= 30:
        reasons.append("FRONTIER_YEARS_INVALID")
    if not isinstance(max_per_source, int) or not 1 <= max_per_source <= 25:
        reasons.append("MAX_PER_SOURCE_INVALID")
    if contact_email is not None and _EMAIL_RE.fullmatch(contact_email) is None:
        reasons.append("BAD_CONTACT")
    if allow_network and transport is not None:
        reasons.append("TRANSPORT_CONFLICT")
    if not allow_network and transport is None:
        reasons.append("NETWORK_NOT_AUTHORIZED")
    for assertion in assertions:
        if assertion.claim_text != query_text:
            reasons.append("ASSERTION_CLAIM_MISMATCH")
        if assertion.polarity not in _POLARITIES:
            reasons.append("ASSERTION_POLARITY_UNKNOWN")
        identity = make_identity(
            doi=assertion.doi,
            pmid=assertion.pmid,
            pmcid=assertion.pmcid,
            arxiv=assertion.arxiv_id,
        )
        if identity.status.value == "UNKNOWN":
            reasons.append("ASSERTION_IDENTITY_UNKNOWN")
    return list(dict.fromkeys(reasons))


def _select_sources(
    registry: SourceRegistry, sources: tuple[str, ...] | None
) -> tuple[tuple[SourceSpec, ...], tuple[str, ...]]:
    if sources is None:
        return registry.search_sources(), ()
    if len(sources) == 0:
        return (), ("SOURCE_LIST_EMPTY",)
    reasons: list[str] = []
    selected_list: list[SourceSpec] = []
    seen: set[str] = set()
    for source_id in sources:
        if source_id in seen:
            continue
        seen.add(source_id)
        try:
            spec = registry.require_enabled(source_id)
        except RegistryError as exc:
            reasons.append(str(exc))
            continue
        if spec.role != "search":
            reasons.append(f"SOURCE_NOT_SEARCH:{source_id}")
            continue
        selected_list.append(spec)
    return tuple(selected_list), tuple(reasons)


def _get(
    transport: Transport,
    registry: SourceRegistry,
    url: str,
    headers: dict[str, str],
) -> HttpResponse:
    assert_allowed(url, registry)
    return transport.get(url, headers)


def _fetch_search(
    *,
    spec: SourceSpec,
    query_text: str,
    max_per_source: int,
    contact_email: str | None,
    transport: Transport,
    registry: SourceRegistry,
    egress: list[EgressEvent],
) -> tuple[list[PaperDraft], list[QuarantineEntry], list[UnknownItem]]:
    accept = "application/atom+xml" if spec.source_id == "arxiv" else "application/json"
    headers = _headers(contact_email, accept)
    url = build_search_url(
        spec,
        query_text,
        max_results=max_per_source,
        contact_email=contact_email,
    )
    response = _get(transport, registry, url, headers)
    egress.append(_event(spec.source_id, url, response.status))
    if response.status != 200:
        return [], [], [
            UnknownItem(
                "SOURCE_UNAVAILABLE",
                spec.source_id,
                f"HTTP_{response.status}",
                True,
            )
        ]
    try:
        if spec.source_id == "arxiv":
            drafts, rejected = parse_arxiv_atom(response.body)
        elif spec.source_id in {"pubmed", "pmc"}:
            ids = parse_esearch_ids(json.loads(response.body.decode("utf-8")))
            if not ids:
                return [], [], []
            summary_url = build_esummary_url(
                spec.source_id, ids[:max_per_source], contact_email=contact_email
            )
            summary = _get(transport, registry, summary_url, headers)
            egress.append(_event(spec.source_id, summary_url, summary.status))
            if summary.status != 200:
                return [], [], [
                    UnknownItem(
                        "SOURCE_UNAVAILABLE",
                        spec.source_id,
                        f"ESUMMARY_HTTP_{summary.status}",
                        True,
                    )
                ]
            drafts, rejected = parse_pubmed_esummary(
                json.loads(summary.body.decode("utf-8")),
                source_id=spec.source_id,
            )
        else:
            parser = PARSERS[spec.source_id]
            drafts, rejected = parser(json.loads(response.body.decode("utf-8")))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ShapeError("JSON_BODY") from exc
    quarantine = [
        QuarantineEntry(item.reason, item.source_id, item.detail) for item in rejected
    ]
    return drafts, quarantine, []


def compile_evidence_package(
    query: str,
    *,
    as_of: str,
    transport: Transport | None = None,
    allow_network: bool = False,
    sources: tuple[str, ...] | None = None,
    max_per_source: int = 10,
    frontier_years: int = 3,
    assertions: tuple[ClaimAssertion, ...] = (),
    enrich_identity: bool = True,
    contact_email: str | None = None,
    registry: SourceRegistry | None = None,
    private_context: str | None = None,
) -> EvidencePackage:
    """Compile one research query into a scholarly evidence package.

    Status VALID means identity, retraction, structured polarity, and source
    fetches closed without a blocking unknown. It does not mean the claim is
    true. Contradiction detection stays UNKNOWN unless structured polarities
    oppose each other.
    """
    minimized = minimize_scholarly_query(query.strip())
    withheld = list(minimized.withheld_labels)
    if private_context and private_context.strip():
        withheld.append("PRIVATE_CONTEXT")
        if private_context.casefold() in minimized.outbound_topic.casefold():
            withheld.append("QUERY_PRIVATE_LEAK")
    query_text = minimized.outbound_topic
    private_withheld = bool(withheld)
    withheld_labels = tuple(dict.fromkeys(withheld))
    reasons = _validate(
        query_text=query_text,
        as_of=as_of,
        frontier_years=frontier_years,
        max_per_source=max_per_source,
        contact_email=contact_email,
        assertions=assertions,
        allow_network=allow_network,
        transport=transport,
    )
    if private_withheld and not query_text:
        reasons.append("QUERY_TOPIC_ABSENT")
    if "QUERY_PRIVATE_LEAK" in withheld_labels:
        reasons.append("QUERY_PRIVATE_LEAK")
    try:
        active_registry = registry if registry is not None else load_registry()
    except RegistryError as exc:
        reasons.append(f"REGISTRY_INVALID:{exc}")
        active_registry = None
    selected: tuple[SourceSpec, ...] = ()
    if active_registry is not None and not any(
        reason.startswith("QUERY_") or reason in {"AS_OF_INVALID"} for reason in reasons
    ):
        selected, source_reasons = _select_sources(active_registry, sources)
        reasons.extend(source_reasons)
    requested = tuple(spec.source_id for spec in selected)
    shapes: list[tuple[str, tuple[str, ...]]] = [
        (spec.source_id, outbound_field_names(spec.source_id)) for spec in selected
    ]
    if enrich_identity and not any(reason.startswith("QUERY_") for reason in reasons):
        shapes.append(("ncbi_idconv", outbound_field_names("ncbi_idconv")))
    outbound_shapes = tuple(shapes)
    privacy = {
        "outbound_query": query_text,
        "private_withheld": private_withheld,
        "withheld_labels": withheld_labels,
        "outbound_shapes": outbound_shapes,
    }
    if reasons:
        return _package(
            status=PackageStatus.REFUSED,
            query_text=query_text,
            as_of=as_of,
            frontier_years=frontier_years if isinstance(frontier_years, int) else 0,
            max_per_source=max_per_source if isinstance(max_per_source, int) else 0,
            sources_requested=requested,
            refusal_reasons=tuple(reasons),
            **privacy,
        )
    assert active_registry is not None
    client = transport if transport is not None else AllowlistTransport(active_registry)
    egress: list[EgressEvent] = []
    drafts: list[PaperDraft] = []
    quarantine: list[QuarantineEntry] = []
    gaps: list[UnknownItem] = []
    try:
        for spec in selected:
            try:
                found, rejected, source_gaps = _fetch_search(
                    spec=spec,
                    query_text=query_text,
                    max_per_source=max_per_source,
                    contact_email=contact_email,
                    transport=client,
                    registry=active_registry,
                    egress=egress,
                )
            except ShapeError as exc:
                gaps.append(UnknownItem("SOURCE_SHAPE_UNKNOWN", spec.source_id, exc.code, True))
                continue
            except TransportError as exc:
                gaps.append(UnknownItem("SOURCE_UNAVAILABLE", spec.source_id, exc.code, True))
                continue
            drafts.extend(found)
            quarantine.extend(rejected)
            gaps.extend(source_gaps)
        if enrich_identity:
            grouped: dict[str, list[str]] = {"doi": [], "pmid": [], "pmcid": []}
            seen_ids: dict[str, set[str]] = {"doi": set(), "pmid": set(), "pmcid": set()}
            for draft in drafts:
                typed = (
                    ("doi", draft.identity.doi),
                    ("pmid", draft.identity.pmid),
                    ("pmcid", draft.identity.pmcid),
                )
                for id_type, value in typed:
                    if value and value not in seen_ids[id_type]:
                        seen_ids[id_type].add(value)
                        grouped[id_type].append(value)
            crosswalk_count = sum(len(values) for values in grouped.values())
            if crosswalk_count > _MAX_IDCONV:
                gaps.append(
                    UnknownItem(
                        "IDCONV_TRUNCATED",
                        "ncbi_idconv",
                        f"count={crosswalk_count}",
                        True,
                    )
                )
            elif crosswalk_count:
                for id_type in ("doi", "pmid", "pmcid"):
                    values = grouped[id_type]
                    if not values:
                        continue
                    id_url = build_idconv_url(
                        tuple(values),
                        id_type=id_type,
                        contact_email=contact_email,
                    )
                    try:
                        id_response = _get(
                            client,
                            active_registry,
                            id_url,
                            _headers(contact_email, "application/json"),
                        )
                        egress.append(_event("ncbi_idconv", id_url, id_response.status))
                        if id_response.status != 200:
                            raise ShapeError(f"HTTP_{id_response.status}")
                        triples = parse_idconv(json.loads(id_response.body.decode("utf-8")))
                        drafts = _apply_crosswalk(drafts, triples)
                    except (
                        ShapeError,
                        TransportError,
                        UnicodeDecodeError,
                        json.JSONDecodeError,
                    ) as exc:
                        code = exc.code if isinstance(exc, ShapeError) else "IDCONV_FAILED"
                        gaps.append(
                            UnknownItem(
                                "IDCONV_UNAVAILABLE",
                                "ncbi_idconv",
                                f"{id_type}:{code}",
                                True,
                            )
                        )
        else:
            gaps.append(
                UnknownItem(
                    "IDENTITY_ENRICHMENT_DISABLED",
                    "ncbi_idconv",
                    "enrich_identity is false",
                    True,
                )
            )
    except EgressDenied as exc:
        return _package(
            status=PackageStatus.REFUSED,
            query_text=query_text,
            as_of=as_of,
            frontier_years=frontier_years,
            max_per_source=max_per_source,
            sources_requested=requested,
            egress=tuple(egress),
            gaps=tuple(gaps),
            refusal_reasons=(str(exc),),
            **privacy,
        )
    records, dedup_quarantine, dedup_gaps = deduplicate(tuple(drafts))
    quarantine.extend(dedup_quarantine)
    gaps.extend(dedup_gaps)
    for record in records:
        if record.retraction.kind is NoticeKind.UNKNOWN:
            gaps.append(
                UnknownItem(
                    "RETRACTION_STATE_UNKNOWN",
                    record.record_id,
                    ",".join(record.retraction.evidence),
                    True,
                )
            )
        elif record.retraction.kind is NoticeKind.EXPRESSION_OF_CONCERN:
            gaps.append(
                UnknownItem(
                    "EXPRESSION_OF_CONCERN",
                    record.record_id,
                    ",".join(record.retraction.evidence),
                    True,
                )
            )
        if record.full_text_status != "NOT_RETRIEVED":
            gaps.append(
                UnknownItem(
                    "FULL_TEXT_STATUS_UNKNOWN",
                    record.record_id,
                    record.full_text_status,
                    True,
                )
            )
        else:
            gaps.append(
                UnknownItem(
                    "FULL_TEXT_NOT_RETRIEVED",
                    record.record_id,
                    record.access_limitation,
                    False,
                )
            )
        if record.abstract is None:
            gaps.append(
                UnknownItem(
                    "ABSTRACT_ABSENT",
                    record.record_id,
                    "no abstract in source metadata",
                    False,
                )
            )
        if record.license == "UNKNOWN":
            gaps.append(
                UnknownItem(
                    "LICENSE_UNKNOWN",
                    record.record_id,
                    "source did not state a reuse license",
                    False,
                )
            )
        if record.primary_source_id == "arxiv" or set(record.source_ids) == {"arxiv"}:
            gaps.append(
                UnknownItem(
                    "PEER_REVIEW_STATUS_UNKNOWN",
                    record.record_id,
                    "arXiv is a preprint server",
                    False,
                )
            )
    graph, contradictions, graph_gaps = build_graphs(
        query_text=query_text,
        records=records,
        assertions=assertions,
    )
    gaps.extend(graph_gaps)
    as_of_year = date.fromisoformat(as_of).year
    groups, group_gaps = group_records(
        records,
        as_of_year=as_of_year,
        frontier_years=frontier_years,
        contradiction_pairs=contradictions.pairs,
    )
    gaps.extend(group_gaps)
    capsules, capsule_gaps = build_capsule_candidates(
        query_text=query_text,
        as_of=as_of,
        records=records,
        edges=graph.edges,
        contradictions=contradictions,
    )
    gaps.extend(capsule_gaps)
    works = [record for record in records if record.role == "work"]
    if records and not works:
        gaps.append(
            UnknownItem(
                "NO_WORK_RECORDS",
                "package",
                "only retraction or correction notices were admitted",
                True,
            )
        )
    refusal: list[str] = []
    if not records:
        refusal.append("NO_ADMITTED_RECORDS")
    gap_map = GapUnknownMap(
        tuple(sorted(gaps, key=lambda item: (item.code, item.subject, item.detail)))
    )
    if refusal:
        status = PackageStatus.REFUSED
    elif gap_map.blocks_valid():
        status = PackageStatus.PARTIAL
    else:
        status = PackageStatus.VALID
    return _package(
        status=status,
        query_text=query_text,
        as_of=as_of,
        frontier_years=frontier_years,
        max_per_source=max_per_source,
        sources_requested=requested,
        records=records,
        quarantine=tuple(quarantine),
        groups=groups,
        graph=graph,
        contradictions=contradictions,
        gaps=gap_map.items,
        capsules=capsules,
        egress=tuple(egress),
        refusal_reasons=tuple(refusal),
        **privacy,
    )
