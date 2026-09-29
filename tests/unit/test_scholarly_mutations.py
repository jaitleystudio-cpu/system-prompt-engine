"""Lane C-R1 mutants. Each test fails if the named defect is reintroduced."""

from __future__ import annotations

import json
import socket
from urllib.parse import unquote

import pytest

from spe_runtime.scholarly.capsules import build_capsule_candidates
from spe_runtime.scholarly.dedup import deduplicate
from spe_runtime.scholarly.egress import assert_allowed
from spe_runtime.scholarly.errors import EgressDenied
from spe_runtime.scholarly.identity import make_identity, normalize_arxiv, normalize_doi, normalize_pmcid, normalize_pmid
from spe_runtime.scholarly.models import (
    ClaimAssertion,
    ContradictionMap,
    NoticeKind,
    PaperDraft,
    PaperRecord,
    unknown_retraction,
)
from spe_runtime.scholarly.queries import build_idconv_url
from spe_runtime.scholarly.registry import load_registry
from spe_runtime.scholarly.retraction import merge_retraction
from spe_runtime.scholarly.transport import AllowlistTransport, HttpResponse, TransportError
from tests.unit.test_scholarly_fabric import (
    AS_OF,
    QUERY,
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
