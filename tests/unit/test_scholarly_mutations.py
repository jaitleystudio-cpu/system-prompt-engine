"""Lane C-R1 mutants. Each test fails if the named defect is reintroduced."""

from __future__ import annotations

import json
import socket
from urllib.parse import unquote

import jsonschema
import pytest

from spe_runtime.scholarly.capsules import build_capsule_candidates
from spe_runtime.scholarly.dedup import deduplicate
from spe_runtime.scholarly.egress import assert_allowed
from spe_runtime.scholarly.errors import EgressDenied
from spe_runtime.scholarly.identity import make_identity, normalize_arxiv, normalize_doi, normalize_pmcid, normalize_pmid
from spe_runtime.scholarly.models import (
    ClaimAssertion,
    ContentCue,
    ContradictionMap,
    NoticeKind,
    PaperDraft,
    PaperRecord,
    ReplicationHint,
    unknown_retraction,
)
from spe_runtime.scholarly.queries import build_europepmc_fulltext_url, build_idconv_url
from spe_runtime.scholarly.registry import load_registry
from spe_runtime.scholarly.retraction import merge_retraction
from spe_runtime.scholarly.transport import AllowlistTransport, HttpResponse, TransportError
from tests.unit.test_scholarly_fabric import (
    AS_OF,
    QUERY,
    SCHEMA,
    FixtureTransport,
    _json,
    _openalex_work,
    compile_evidence_package,
)

_PRIVATE = "patient Jane Q. Private MRN 884211 SSN 123-45-6789 lives at 9 Secret Lane"
_TOPIC = "metformin cardiovascular outcomes"


def _draft(source_id: str, doi: str, title: str) -> PaperDraft:
    return PaperDraft(
        source_id=source_id,
        identity=make_identity(doi=doi),
        title=title,
        abstract=None,
        authors=("Ada Lovelace",),
        year=2018,
        venue=None,
        publication_types=("article",),
        cited_by_count=3,
        is_open_access=None,
        license="UNKNOWN",
        landing_url=f"https://doi.org/{doi}",
        retraction=unknown_retraction(("TEST",)),
        role="work",
        replication_signal="NONE",
    )


def test_c_r1_01_network_stays_off_without_allow_network() -> None:
    def _boom(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("NETWORK_WHEN_DISABLED")

    original = socket.create_connection
    socket.create_connection = _boom  # type: ignore[assignment]
    try:
        package = compile_evidence_package(_TOPIC, as_of=AS_OF)
    finally:
        socket.create_connection = original
    assert package.status.value == "REFUSED"
    assert "NETWORK_NOT_AUTHORIZED" in package.refusal_reasons
    assert package.egress == ()


def test_c_r1_02_private_prompt_is_not_the_outbound_query() -> None:
    raw = f"TOPIC: {_TOPIC}\nPRIVATE: {_PRIVATE}\nUPLOAD: full clinic note about the same patient"
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [_openalex_work()]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        raw,
        as_of=AS_OF,
        transport=transport,
        sources=("openalex",),
        private_context=_PRIVATE,
        assertions=(
            ClaimAssertion(claim_text=_TOPIC, polarity="SUPPORT", doi="10.1000/example.2018"),
        ),
    )
    assert package.outbound_query == _TOPIC
    assert package.private_withheld is True
    assert package.outbound_query != raw
    blob = " ".join(transport.calls)
    assert "Jane" not in blob
    assert "123-45-6789" not in blob
    assert "Secret Lane" not in blob
    assert "clinic note" not in blob
    assert "metformin" in blob


def test_c_r1_03_missing_retraction_signal_stays_unknown() -> None:
    assert "NOT_RETRACTED" not in {kind.value for kind in NoticeKind}
    omitted = unknown_retraction(("DOAJ_NO_RETRACTION_FIELD",))
    explicit_none = type(omitted)(NoticeKind.NONE, (), ("OPENALEX_IS_RETRACTED_FALSE",))
    assert omitted.kind is NoticeKind.UNKNOWN
    assert merge_retraction((explicit_none, omitted)).kind is NoticeKind.UNKNOWN
    assert merge_retraction((omitted,)).kind is not NoticeKind.NONE


def test_c_r1_04_arxiv_alone_is_not_peer_reviewed() -> None:
    identity = make_identity(arxiv="https://arxiv.org/abs/1706.03762v5")
    record = PaperRecord(
        record_id="paper:arxiv",
        identity=identity,
        title="Attention Is All You Need",
        abstract=None,
        authors=(),
        year=2017,
        venue=None,
        publication_types=("journal-article",),
        cited_by_count=None,
        is_open_access=True,
        license="UNKNOWN",
        landing_url="https://arxiv.org/abs/1706.03762",
        retraction=unknown_retraction(("ARXIV_NO_JOURNAL_RETRACTION_SIGNAL",)),
        source_ids=("arxiv",),
        primary_source_id="arxiv",
        role="work",
        replication_signal="NONE",
        related_preprint=identity.arxiv_id,
    )
    capsules, _gaps = build_capsule_candidates(
        query_text="attention",
        as_of=AS_OF,
        records=(record,),
        edges=(),
        contradictions=ContradictionMap("UNKNOWN", "NONE_OBSERVED_IN_FETCHED_SET", ()),
    )
    assert capsules[0].source_class == "preprint"
    assert "PREPRINT" in capsules[0].taint_labels
    assert capsules[0].support_status != "SUPPORTED"


def test_c_r1_05_and_07_same_doi_collapses_and_keeps_provenance() -> None:
    title = "Effects of Example Compound on Outcome"
    records, quarantine, _gaps = deduplicate(
        (
            _draft("pubmed", "10.1000/example.2018", title),
            _draft("crossref", "10.1000/example.2018", title),
        )
    )
    assert quarantine == ()
    assert len(records) == 1
    assert records[0].source_ids == ("crossref", "pubmed")


def test_c_r1_06_different_dois_do_not_merge() -> None:
    title = "Effects of Example Compound on Outcome"
    records, _quarantine, _gaps = deduplicate(
        (
            _draft("pubmed", "10.1000/example.2018", title),
            _draft("crossref", "10.1000/example.2019", title),
        )
    )
    assert len(records) == 2
    assert records[0].identity.doi != records[1].identity.doi


def test_c_r1_08_redirect_off_allowlist_is_rejected() -> None:
    class _Body:
        status = 200
        headers: dict[str, str] = {}

        def geturl(self) -> str:
            return "https://127.0.0.1/steal"

        def read(self, _count: int) -> bytes:
            return b"{}"

        def close(self) -> None:
            return None

    class _Opener:
        def open(self, _request: object, timeout: float | None = None) -> _Body:
            return _Body()

    registry = load_registry()
    transport = AllowlistTransport(registry, opener=_Opener())
    with pytest.raises(EgressDenied) as caught:
        transport.get("https://api.openalex.org/works?search=x", {})
    assert "PRIVATE" in str(caught.value) or "HOST" in str(caught.value)


def test_c_r1_09_id_converter_does_not_receive_the_research_query() -> None:
    topic = "zephyrprivate topic token"
    doi_url = build_idconv_url(
        ("10.1038/s41586-021-03819-2",), id_type="doi", contact_email=None
    )
    pmid_url = build_idconv_url(("34265844",), id_type="pmid", contact_email=None)
    decoded_doi = unquote(doi_url)
    decoded_pmid = unquote(pmid_url)
    assert topic not in doi_url and topic not in pmid_url
    assert topic not in decoded_doi and topic not in decoded_pmid
    assert "search" not in doi_url and "search" not in pmid_url
    assert "idtype=doi" in doi_url
    assert "idtype=pmid" in pmid_url
    assert "10.1038/s41586-021-03819-2" in decoded_doi
    assert "34265844" not in decoded_doi
    assert "34265844" in decoded_pmid
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [_openalex_work()]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    compile_evidence_package(
        f"TOPIC: {topic}\nPRIVATE: {_PRIVATE}",
        as_of=AS_OF,
        transport=transport,
        sources=("openalex",),
        assertions=(
            ClaimAssertion(claim_text=topic, polarity="SUPPORT", doi="10.1000/example.2018"),
        ),
    )
    id_urls = [call for call in transport.calls if "idconv" in call]
    assert id_urls
    assert all(topic not in call and "Jane" not in call for call in id_urls)
    shapes = dict(compile_evidence_package(
        topic,
        as_of=AS_OF,
        transport=transport,
        sources=("openalex",),
        assertions=(
            ClaimAssertion(claim_text=topic, polarity="SUPPORT", doi="10.1000/example.2018"),
        ),
    ).outbound_shapes)
    assert shapes["ncbi_idconv"] == ("ids", "idtype")
    assert "term" not in shapes["ncbi_idconv"]


def test_c_r1_10_and_14_title_does_not_mark_a_claim_supported() -> None:
    work = _openalex_work(title="This title alone supports and proves the claim")
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [work]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY,
        as_of=AS_OF,
        transport=transport,
        sources=("openalex",),
        enrich_identity=False,
    )
    assert package.claim_evidence_graph.edges[0].polarity == "UNKNOWN"
    assert package.claim_evidence_graph.edges[0].strength == "ABSENT"
    assert package.claim_evidence_graph.edges[0].source_id == "openalex"
    assert package.claim_evidence_graph.edges[0].canonical_key
    assert all(item.support_status != "SUPPORTED" for item in package.capsule_candidates)
    assert package.to_dict()["semantic_authority"] == "NONE"


def test_c_r1_11_one_source_failure_does_not_drop_the_others() -> None:
    doaj = {
        "results": [
            {
                "bibjson": {
                    "title": "Open access metformin cohort",
                    "year": "2020",
                    "identifier": [{"type": "doi", "id": "10.1000/doaj.2020"}],
                    "author": [{"name": "Grace Hopper"}],
                }
            }
        ]
    }

    class _Mixed:
        def __init__(self) -> None:
            self.calls: list[str] = []

        def get(self, url: str, headers: dict[str, str]) -> HttpResponse:
            self.calls.append(url)
            if "europepmc" in url:
                return HttpResponse(200, b"{", url, "application/json")
            if "api.crossref.org" in url:
                return HttpResponse(429, b"", url, "application/json")
            if "eutils.ncbi.nlm.nih.gov" in url and "db=pmc" in url:
                return HttpResponse(503, b"", url, "application/json")
            if "api.openalex.org" in url:
                raise TransportError("TRANSPORT_URL_ERROR")
            if "export.arxiv.org" in url:
                return HttpResponse(500, b"", url, "application/atom+xml")
            if "doaj.org" in url:
                return HttpResponse(200, json.dumps(doaj).encode(), url, "application/json")
            if "db=pubmed" in url:
                return HttpResponse(200, _json({"esearchresult": {"idlist": []}}), url, "application/json")
            raise AssertionError(url)

    transport = _Mixed()
    package = compile_evidence_package(
        _TOPIC,
        as_of=AS_OF,
        transport=transport,
        enrich_identity=False,
    )
    assert package.records
    assert package.records[0].primary_source_id == "doaj"
    assert package.records[0].retraction.kind is NoticeKind.UNKNOWN
    assert package.records[0].full_text_status == "NOT_RETRIEVED"
    codes = {item.code for item in package.gap_unknown_map.items}
    assert "SOURCE_SHAPE_UNKNOWN" in codes
    assert "SOURCE_UNAVAILABLE" in codes
    assert package.status.value == "PARTIAL"
    assert "NO_ADMITTED_RECORDS" not in package.refusal_reasons


def test_c_r1_12_missing_full_text_is_not_available() -> None:
    records, _quarantine, _gaps = deduplicate(
        (_draft("doaj", "10.1000/doaj.2020", "Open access metformin cohort"),)
    )
    assert records[0].full_text_status == "NOT_RETRIEVED"
    assert "AVAILABLE" not in records[0].full_text_status
    assert records[0].landing_url is not None
    assert "FULL_TEXT" in records[0].access_limitation


def test_c_r1_13_contradiction_keeps_both_sides() -> None:
    second = _openalex_work(
        id="https://openalex.org/W2",
        doi="https://doi.org/10.1000/example.2024",
        title="Replication of example compound outcome",
        publication_year=2024,
        cited_by_count=4,
    )
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [_openalex_work(), second]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY,
        as_of=AS_OF,
        transport=transport,
        sources=("openalex",),
        assertions=(
            ClaimAssertion(claim_text=QUERY, polarity="SUPPORT", doi="10.1000/example.2018"),
            ClaimAssertion(claim_text=QUERY, polarity="REFUTE", doi="10.1000/example.2024"),
        ),
    )
    assert package.contradiction_map.status == "PRESENT"
    pair = package.contradiction_map.pairs[0]
    assert pair.left_record_id != pair.right_record_id
    assert {pair.left_record_id, pair.right_record_id} == {
        record.record_id for record in package.records
    }
    assert package.contradiction_map.reason != "NO_CONTRADICTION_EXISTS"


def test_c_r1_15_unexpected_host_schemes_and_identity_shapes() -> None:
    registry = load_registry()
    with pytest.raises(EgressDenied):
        assert_allowed("https://evil.example/search", registry)
    with pytest.raises(EgressDenied):
        assert_allowed("http://api.crossref.org/works", registry)
    with pytest.raises(EgressDenied):
        assert_allowed("javascript:alert(1)", registry)
    with pytest.raises(EgressDenied):
        assert_allowed("https://user:secret@api.crossref.org/works", registry)
    with pytest.raises(EgressDenied):
        assert_allowed("file:///etc/passwd", registry)
    assert normalize_doi("HTTPS://DOI.ORG/10.1000/ABC") == "10.1000/abc"
    assert normalize_pmid("PMID: 000123") == "123"
    assert normalize_pmcid("pmc7654321") == "PMC7654321"
    assert normalize_arxiv("1706.03762v5") == ("1706.03762", "5")
    left = make_identity(doi="10.1000/abc")
    right = make_identity(doi="10.1000/abd")
    assert left.canonical_key != right.canonical_key


_PHRASE = "measured reduction in the primary cardiovascular outcome"


def _notes(status: int, body: bytes, url: str, notes: tuple[tuple[str, str], ...] = ()) -> HttpResponse:
    return HttpResponse(
        status=status,
        body=body,
        final_url=url,
        content_type="application/json",
        header_notes=notes,
    )


class _SplitTransport:
    def __init__(self, pubmed_status: int = 200, pubmed_body: bytes = b"") -> None:
        self.calls: list[str] = []
        self.pubmed_status = pubmed_status
        self.pubmed_body = pubmed_body

    def get(self, url: str, headers: dict[str, str]) -> HttpResponse:
        self.calls.append(url)
        if "eutils.ncbi.nlm.nih.gov" in url:
            notes = (("Retry-After", "17"),) if self.pubmed_status == 429 else ()
            return _notes(self.pubmed_status, self.pubmed_body, url, notes)
        if "api.openalex.org" in url:
            return _notes(200, _json({"results": [_openalex_work()]}), url)
        if "tools/idconv" in url:
            return _notes(200, _json({"status": "ok", "records": []}), url)
        raise AssertionError(url)


def test_europepmc_doi_topic_is_a_field_lookup() -> None:
    transport = FixtureTransport(
        {
            "europepmc/webservices/rest/search": (
                200,
                _json({"hitCount": 0, "resultList": {"result": []}}),
            ),
        }
    )
    compile_evidence_package(
        "10.1001/jama.288.3.321",
        as_of=AS_OF,
        transport=transport,
        sources=("europepmc",),
        enrich_identity=False,
    )
    compile_evidence_package(
        "hormone therapy OR coronary disease",
        as_of=AS_OF,
        transport=transport,
        sources=("europepmc",),
        enrich_identity=False,
    )
    from urllib.parse import parse_qs, unquote, urlsplit

    queries = [
        unquote(parse_qs(urlsplit(url).query)["query"][0])
        for url in transport.calls
        if "europepmc" in url
    ]
    assert queries[0] == 'DOI:"10.1001/jama.288.3.321"'
    assert queries[1].startswith('"') and "DOI:" not in queries[1]


def test_c_r15_01_absent_abstract_stays_absent() -> None:
    work = _openalex_work()
    work["abstract_inverted_index"] = None
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [work]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY, as_of=AS_OF, transport=transport, sources=("openalex",)
    )
    assert package.records[0].abstract is None
    assert package.records[0].abstract_access == "ABSTRACT_ABSENT"
    assert any(item.code == "ABSTRACT_ABSENT" for item in package.gap_unknown_map.items)


def test_c_r15_02_metadata_is_not_full_text() -> None:
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [_openalex_work()]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY, as_of=AS_OF, transport=transport, sources=("openalex",)
    )
    record = package.records[0]
    assert record.abstract_access == "ABSTRACT_AVAILABLE"
    assert record.full_text_status == "NOT_RETRIEVED"
    assert record.full_text_status != "OPEN_FULL_TEXT"
    assert "FULL_TEXT" in record.access_limitation or "NOT" in record.access_limitation


def test_c_r15_03_unknown_license_is_not_open() -> None:
    work = _openalex_work()
    work["open_access"] = {"is_oa": None}
    primary = work["primary_location"]
    assert isinstance(primary, dict)
    primary.pop("license", None)
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [work]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY, as_of=AS_OF, transport=transport, sources=("openalex",)
    )
    assert package.records[0].license_status == "UNKNOWN"
    assert package.records[0].license_status != "OPEN"
    assert any(item.code == "LICENSE_UNKNOWN" for item in package.gap_unknown_map.items)


def test_c_r15_04_arxiv_alone_is_preprint() -> None:
    feed = """<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>http://arxiv.org/abs/2401.00002v1</id>
        <title>Example preprint on error correction bounds</title>
        <summary>A preprint summary with no peer-review claim.</summary>
        <published>2024-01-02T00:00:00Z</published>
        <author><name>Ada Lovelace</name></author>
      </entry>
    </feed>
    """.encode("utf-8")
    transport = FixtureTransport({"export.arxiv.org": (200, feed)})
    package = compile_evidence_package(
        QUERY, as_of=AS_OF, transport=transport, sources=("arxiv",), enrich_identity=False
    )
    record = package.records[0]
    assert record.paper_type == "PREPRINT"
    assert record.peer_review_status == "NOT_PEER_REVIEWED"
    assert record.peer_review_status != "PEER_REVIEWED"
    assert record.full_text_status == "PDF_METADATA_ONLY"
    assert record.retrieval_method == "ARXIV_PDF_METADATA_NOT_FETCHED"


def test_c_r15_05_oldest_paper_is_not_foundational() -> None:
    older = _openalex_work(publication_year=1990, cited_by_count=None)
    newer = _openalex_work(
        id="https://openalex.org/W2",
        doi="https://doi.org/10.1000/example.2024",
        publication_year=2024,
        cited_by_count=None,
        ids={},
    )
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [older, newer]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY, as_of=AS_OF, transport=transport, sources=("openalex",)
    )
    assert package.groups.foundational == ()
    assert any(item.code == "FOUNDATIONAL_UNAVAILABLE" for item in package.gap_unknown_map.items)


def test_c_r15_06_newest_paper_is_not_best() -> None:
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [_openalex_work(publication_year=2024)]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY, as_of=AS_OF, transport=transport, sources=("openalex",)
    )
    assert package.groups.frontier
    basis = set(package.groups.frontier[0].basis)
    assert "NOT_STRENGTH" in basis
    assert "BEST" not in basis
    assert "STRONGEST" not in basis


def test_c_r15_07_title_alone_does_not_set_polarity() -> None:
    work = _openalex_work(title=f"Study of {_PHRASE}")
    work["abstract_inverted_index"] = {"Unrelated": [0], "abstract": [1]}
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [work]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY,
        as_of=AS_OF,
        transport=transport,
        sources=("openalex",),
        content_cues=ContentCue(support_phrases=(_PHRASE,)),
    )
    edge = package.claim_evidence_graph.edges[0]
    assert edge.polarity == "UNKNOWN"
    assert edge.evidence_scope == "NONE"
    assert edge.polarity_basis == "ABSENT"


def test_c_r15_08_paper_count_does_not_resolve_contradiction() -> None:
    second = _openalex_work(
        id="https://openalex.org/W2",
        doi="https://doi.org/10.1000/example.2024",
        publication_year=2024,
        cited_by_count=4,
    )
    third = _openalex_work(
        id="https://openalex.org/W3",
        doi="https://doi.org/10.1000/example.2023",
        publication_year=2023,
        cited_by_count=5,
        ids={"pmid": "222", "pmcid": "PMC2"},
    )
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [_openalex_work(), second, third]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY,
        as_of=AS_OF,
        transport=transport,
        sources=("openalex",),
        assertions=(
            ClaimAssertion(claim_text=QUERY, polarity="SUPPORT", doi="10.1000/example.2018"),
            ClaimAssertion(claim_text=QUERY, polarity="SUPPORT", doi="10.1000/example.2023"),
            ClaimAssertion(claim_text=QUERY, polarity="REFUTE", doi="10.1000/example.2024"),
        ),
    )
    assert package.contradiction_map.status == "PRESENT"
    assert package.contradiction_map.resolution == "NONE"
    assert "winner" not in package.contradiction_map.to_dict()
    assert all(pair.uncertainty == "UNRESOLVED" for pair in package.contradiction_map.pairs)


def test_c_r15_09_title_keyword_is_not_a_replication_link() -> None:
    work = _openalex_work(title="Replication of example compound outcome")
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [work]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY, as_of=AS_OF, transport=transport, sources=("openalex",)
    )
    assert package.records[0].replication_signal == "TITLE_HEURISTIC"
    assert package.replication_map is not None
    assert package.replication_map.links == ()
    assert package.replication_map.status == "UNKNOWN"


def test_c_r15_10_and_11_rate_limit_is_kept_and_not_retried() -> None:
    transport = _SplitTransport(pubmed_status=429, pubmed_body=b"")
    package = compile_evidence_package(
        QUERY,
        as_of=AS_OF,
        transport=transport,
        sources=("pubmed", "openalex"),
    )
    assert package.records
    assert any(item.code == "RATE_LIMITED" for item in package.gap_unknown_map.items)
    assert any(item.code == "SOURCE_UNAVAILABLE" for item in package.gap_unknown_map.items)
    pubmed_calls = [url for url in transport.calls if "eutils.ncbi.nlm.nih.gov" in url]
    assert len(pubmed_calls) == 1
    assert package.rate_limit is not None
    assert package.rate_limit.backoff_state == "NO_RETRY"
    assert package.rate_limit.retry_after == ("17",)
    assert all(event.attempt == 1 for event in package.egress)


def test_c_r15_12_publisher_full_text_is_not_fetched() -> None:
    registry = load_registry()
    with pytest.raises(EgressDenied):
        assert_allowed("https://www.sciencedirect.com/science/article/pii/S014", registry)
    with pytest.raises(EgressDenied):
        assert_allowed("https://127.0.0.1/fulltext", registry)
    with pytest.raises(EgressDenied):
        assert_allowed("https://localhost/fulltext", registry)
    with pytest.raises(EgressDenied):
        assert_allowed("data:text/plain,secret", registry)
    url = build_europepmc_fulltext_url("PMC3303812")
    assert "sciencedirect" not in url
    assert url.endswith("/PMC3303812/fullTextXML")
    payload = {
        "status": "ok",
        "message": {
            "items": [
                {
                    "DOI": "10.1000/example.2018",
                    "title": ["Publisher landing page is not fetched"],
                    "URL": "https://www.sciencedirect.com/science/article/pii/S014",
                    "type": "journal-article",
                    "issued": {"date-parts": [[2018]]},
                }
            ]
        },
    }
    transport = FixtureTransport(
        {
            "api.crossref.org": (200, _json(payload)),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY, as_of=AS_OF, transport=transport, sources=("crossref",)
    )
    assert package.records
    assert all("sciencedirect.com" not in url for url in transport.calls)
    assert package.records[0].full_text_status == "NOT_RETRIEVED"


def test_c_r15_13_private_context_stays_out_of_retrieval_urls() -> None:
    secret = "SSN 123-45-6789 project Orion-private-memo"
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [_openalex_work()]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        f"TOPIC: metformin cardiovascular outcomes\nPRIVATE: {secret}",
        as_of=AS_OF,
        transport=transport,
        sources=("openalex",),
        private_context=secret,
    )
    blob = " ".join(transport.calls)
    assert "123-45-6789" not in blob
    assert "Orion-private-memo" not in blob
    assert package.private_withheld is True
    assert "metformin" in package.outbound_query


def test_c_r15_14_retracted_support_is_not_silently_normal() -> None:
    work = _openalex_work(is_retracted=True)
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [work]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY,
        as_of=AS_OF,
        transport=transport,
        sources=("openalex",),
        assertions=(
            ClaimAssertion(claim_text=QUERY, polarity="SUPPORT", doi="10.1000/example.2018"),
        ),
    )
    assert package.records[0].retraction.kind is NoticeKind.RETRACTION
    assert package.records[0].retraction.kind is not NoticeKind.NONE
    assert any(
        item.code == "RETRACTED_SUPPORT_NOT_USABLE" for item in package.gap_unknown_map.items
    )
    assert all(item.support_status != "SUPPORTED" for item in package.capsule_candidates)


def test_c_r15_15_missing_evidence_keeps_the_gap() -> None:
    work = _openalex_work()
    work["abstract_inverted_index"] = None
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [work]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY, as_of=AS_OF, transport=transport, sources=("openalex",)
    )
    codes = {item.code for item in package.gap_unknown_map.items}
    assert "ABSTRACT_ABSENT" in codes
    assert "FULL_TEXT_NOT_RETRIEVED" in codes
    assert "LICENSE_UNKNOWN" in codes or package.records[0].license_status != "UNKNOWN"
    assert "REPLICATION_ABSENT" in codes


def test_explicit_abstract_phrase_sets_tentative_polarity() -> None:
    work = _openalex_work()
    work["abstract_inverted_index"] = {
        "The": [0],
        "trial": [1],
        "showed": [2],
        "a": [3],
        "measured": [4],
        "reduction": [5],
        "in": [6],
        "the": [7],
        "primary": [8],
        "cardiovascular": [9],
        "outcome": [10],
        "today": [11],
    }
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [work]})),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY,
        as_of=AS_OF,
        transport=transport,
        sources=("openalex",),
        content_cues=ContentCue(support_phrases=(_PHRASE,)),
    )
    edge = package.claim_evidence_graph.edges[0]
    assert edge.polarity == "SUPPORT"
    assert edge.strength == "TENTATIVE"
    assert edge.evidence_scope == "ABSTRACT"
    assert edge.polarity_basis == "EXPLICIT_ABSTRACT_PHRASE"
    assert edge.retraction_state == package.records[0].retraction.kind.value
    assert package.claim_evidence_graph.status == "PARTIAL"


def test_lawful_europepmc_full_text_and_explicit_replication_link() -> None:
    original = {
        "title": "Original memory result before the later attempts",
        "doi": "10.1037/a0021524",
        "isOpenAccess": "N",
        "pubYear": "2011",
        "abstractText": "The original report described nine experiments on later stimulus selection.",
        "authorString": "Daryl Bem",
        "pubTypeList": {"pubType": ["Journal Article"]},
        "citedByCount": 40,
    }
    replication = {
        "title": "Failing the future attempts",
        "doi": "10.1371/journal.pone.0033423",
        "pmcid": "PMC3303812",
        "isOpenAccess": "Y",
        "pubYear": "2012",
        "abstractText": (
            "We describe three pre-registered independent attempts to exactly replicate "
            "one of these experiments. The attempts do not support the existence of psychic ability."
        ),
        "authorString": "Stuart Ritchie",
        "pubTypeList": {"pubType": ["Journal Article"]},
        "citedByCount": 80,
        "license": "cc by",
    }
    xml = (
        b"<?xml version='1.0'?><article><body><p>"
        b"Lawful open full text for the replication attempt."
        b"</p></body></article>"
    )
    transport = FixtureTransport(
        {
            "europepmc/webservices/rest/search": (
                200,
                _json({"resultList": {"result": [original, replication]}}),
            ),
            "fullTextXML": (200, xml),
            "tools/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY,
        as_of=AS_OF,
        transport=transport,
        sources=("europepmc",),
        replication_hints=(
            ReplicationHint(
                original_doi="10.1037/a0021524",
                replication_doi="10.1371/journal.pone.0033423",
                confirm_phrases=("three pre-registered independent attempts to exactly replicate",),
                result_phrase="do not support the existence of psychic ability",
            ),
        ),
    )
    by_doi = {record.identity.doi: record for record in package.records}
    assert by_doi["10.1037/a0021524"].full_text_status == "NOT_PERMITTED"
    opened = by_doi["10.1371/journal.pone.0033423"]
    assert opened.full_text_status == "OPEN_FULL_TEXT"
    assert opened.content_digest is not None
    assert opened.content_digest.startswith("sha256:")
    assert opened.full_text_retrieved_at == AS_OF
    assert opened.retrieval_method == "EUROPEPMC_FULLTEXT_XML"
    assert opened.full_text_source == "europepmc"
    assert opened.license_status == "STATED"
    assert opened.license == "cc by"
    original_record = by_doi["10.1037/a0021524"]
    assert original_record.license_status != "OPEN"
    assert package.replication_map is not None
    assert package.replication_map.status == "PRESENT"
    link = package.replication_map.links[0]
    assert link.original_record_id == by_doi["10.1037/a0021524"].record_id
    assert link.result_relation == "EXPLICIT_ABSTRACT_RESULT"
    assert all("ebi.ac.uk" in url or "ncbi.nlm.nih.gov" in url for url in transport.calls)
    jsonschema.validate(package.to_dict(), SCHEMA)


def test_source_failures_do_not_drop_a_healthy_source() -> None:
    class _FailTransport:
        def __init__(self) -> None:
            self.calls: list[str] = []

        def get(self, url: str, headers: dict[str, str]) -> HttpResponse:
            self.calls.append(url)
            if "eutils.ncbi.nlm.nih.gov" in url and "esearch" in url:
                return _notes(200, b"{", url)
            if "doaj.org" in url:
                raise TransportError("TIMEOUT")
            if "api.crossref.org" in url:
                return _notes(
                    200,
                    _json({"status": "ok", "message": {"items": []}}),
                    url,
                )
            if "export.arxiv.org" in url:
                return _notes(200, b"<feed", url)
            if "api.openalex.org" in url:
                return _notes(200, _json({"results": [_openalex_work()]}), url)
            if "tools/idconv" in url:
                return _notes(200, _json({"status": "ok", "records": []}), url)
            raise AssertionError(url)

    transport = _FailTransport()
    package = compile_evidence_package(
        QUERY,
        as_of=AS_OF,
        transport=transport,
        sources=("pubmed", "doaj", "crossref", "arxiv", "openalex"),
        enrich_identity=False,
    )
    codes = {item.code for item in package.gap_unknown_map.items}
    assert "SOURCE_SHAPE_UNKNOWN" in codes
    assert "SOURCE_UNAVAILABLE" in codes
    assert "SOURCE_ZERO_RECORDS" in codes
    assert package.records
    assert package.records[0].primary_source_id == "openalex"
