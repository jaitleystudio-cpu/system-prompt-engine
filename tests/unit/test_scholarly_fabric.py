"""Lane C scholarly fabric: registry, normalization, dedup, and evidence packages."""

from __future__ import annotations

import ast
import json
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.scholarly.egress import assert_allowed
from spe_runtime.scholarly.errors import EgressDenied
from spe_runtime.scholarly.identity import make_identity
from spe_runtime.scholarly.models import (
    ClaimAssertion,
    NoticeKind,
    PaperDraft,
    unknown_retraction,
)
from spe_runtime.scholarly.normalize import (
    PARSERS,
    parse_arxiv_atom,
    parse_crossref,
    parse_doaj,
    parse_europepmc,
    parse_openalex,
    parse_pubmed_esummary,
)
from spe_runtime.scholarly.pipeline import compile_evidence_package
from spe_runtime.scholarly.registry import load_registry
from spe_runtime.scholarly.retraction import merge_retraction
from spe_runtime.scholarly.transport import HttpResponse
from spe_runtime.scholarly.models import RetractionState
from spe_runtime.scholarly.dedup import deduplicate

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = json.loads(
    (ROOT / "schemas" / "scholarly_evidence_package.schema.json").read_text(encoding="utf-8")
)
QUERY = "Does example compound change the outcome?"
AS_OF = "2026-09-29"


class FixtureTransport:
    """In-memory transport. It never opens a socket."""

    def __init__(self, routes: dict[str, tuple[int, bytes]]) -> None:
        self.routes = routes
        self.calls: list[str] = []

    def get(self, url: str, headers: dict[str, str]) -> HttpResponse:
        self.calls.append(url)
        matches = [key for key in self.routes if key in url]
        if not matches:
            raise AssertionError(url)
        key = max(matches, key=len)
        status, body = self.routes[key]
        return HttpResponse(status=status, body=body, final_url=url, content_type="application/json")


def _json(payload: object) -> bytes:
    return json.dumps(payload).encode("utf-8")


def _openalex_work(**overrides: object) -> dict[str, object]:
    work: dict[str, object] = {
        "id": "https://openalex.org/W1",
        "doi": "https://doi.org/10.1000/example.2018",
        "title": "Effects of Example Compound on Outcome",
        "publication_year": 2018,
        "cited_by_count": 40,
        "type": "article",
        "is_retracted": False,
        "open_access": {"is_oa": True},
        "authorships": [{"author": {"display_name": "Ada Lovelace"}}],
        "primary_location": {
            "source": {"display_name": "The Lancet"},
            "license": "cc-by",
        },
        "ids": {"pmid": "12345678", "pmcid": "PMC7654321"},
        "abstract_inverted_index": {"Effects": [0], "observed": [1]},
    }
    work.update(overrides)
    return work


def _valid_routes() -> dict[str, tuple[int, bytes]]:
    return {
        "api.openalex.org": (
            200,
            _json({"results": [_openalex_work()]}),
        ),
        "pmc/utils/idconv": (
            200,
            _json(
                {
                    "status": "ok",
                    "records": [
                        {
                            "doi": "10.1000/example.2018",
                            "pmid": "12345678",
                            "pmcid": "PMC7654321",
                        }
                    ],
                }
            ),
        ),
    }


def test_registry_enables_open_sources_and_rejects_keyed_sources():
    registry = load_registry()
    enabled = {source.source_id for source in registry.search_sources()}
    assert enabled == {
        "pubmed",
        "pmc",
        "europepmc",
        "crossref",
        "doaj",
        "arxiv",
        "openalex",
    }
    assert set(PARSERS) | {"pubmed", "pmc", "arxiv"} == enabled
    for source in registry.sources:
        if source.enabled:
            assert source.cost == "INR_0"
            assert source.auth == "none"
            assert source.method == "GET"
    assert registry.get("semantic_scholar").enabled is False
    assert registry.get("core").enabled is False
    with pytest.raises(Exception, match="SOURCE_DISABLED"):
        registry.require_enabled("core")


def test_retraction_parsers_do_not_treat_omission_as_none():
    pubmed, _rejected = parse_pubmed_esummary(
        {
            "result": {
                "uids": ["12345678"],
                "12345678": {
                    "uid": "12345678",
                    "title": "Effects of Example Compound on Outcome",
                    "pubdate": "2018 Mar",
                    "source": "The Lancet",
                    "authors": [{"name": "Ada Lovelace"}],
                    "articleids": [
                        {"idtype": "doi", "value": "10.1000/example.2018"},
                        {"idtype": "pubmed", "value": "12345678"},
                    ],
                    "pubtype": ["Retracted Publication", "Journal Article"],
                },
            }
        },
        source_id="pubmed",
    )
    assert pubmed[0].retraction.kind is NoticeKind.RETRACTION
    assert pubmed[0].role == "work"

    clean, _rejected = parse_pubmed_esummary(
        {
            "result": {
                "uids": ["1"],
                "1": {
                    "uid": "1",
                    "title": "A typed journal article",
                    "pubdate": "2018",
                    "authors": [],
                    "articleids": [{"idtype": "pubmed", "value": "1"}],
                    "pubtype": ["Journal Article"],
                },
            }
        },
        source_id="pubmed",
    )
    assert clean[0].retraction.kind is NoticeKind.NONE

    europe, _rejected = parse_europepmc(
        {"hitCount": 1, "resultList": {"result": [{"title": "No flag", "pmid": "5"}]}}
    )
    assert europe[0].retraction.kind is NoticeKind.UNKNOWN

    crossref, _rejected = parse_crossref(
        {
            "status": "ok",
            "message": {
                "items": [
                    {
                        "DOI": "10.1000/example.2018",
                        "title": ["Effects of Example Compound on Outcome"],
                        "type": "journal-article",
                        "issued": {"date-parts": [[2018]]},
                    }
                ]
            },
        }
    )
    assert crossref[0].retraction.kind is NoticeKind.UNKNOWN

    doaj, _rejected = parse_doaj(
        {
            "results": [
                {
                    "bibjson": {
                        "title": "Open article",
                        "year": "2020",
                        "identifier": [{"type": "doi", "id": "10.1000/open.1"}],
                    }
                }
            ]
        }
    )
    assert doaj[0].retraction.kind is NoticeKind.UNKNOWN
    assert doaj[0].is_open_access is True

    openalex, _rejected = parse_openalex({"results": [_openalex_work()]})
    assert openalex[0].retraction.kind is NoticeKind.NONE
    missing, _rejected = parse_openalex(
        {"results": [_openalex_work(is_retracted=None)]}
    )
    # None is not a boolean, so the field is treated as absent.
    assert missing[0].retraction.kind is NoticeKind.UNKNOWN


def test_openalex_missing_boolean_key_is_unknown():
    work = _openalex_work()
    del work["is_retracted"]
    drafts, _rejected = parse_openalex({"results": [work]})
    assert drafts[0].retraction.kind is NoticeKind.UNKNOWN


def test_arxiv_withdrawal_is_explicit_and_dtd_is_refused():
    feed = """<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
      <entry>
        <id>http://arxiv.org/abs/2401.00001v1</id>
        <title>Withdrawn: Example preprint</title>
        <summary>Removed by the authors.</summary>
        <published>2024-01-02T00:00:00Z</published>
        <author><name>Ada Lovelace</name></author>
      </entry>
    </feed>
    """.encode("utf-8")
    drafts, _rejected = parse_arxiv_atom(feed)
    assert drafts[0].retraction.kind is NoticeKind.WITHDRAWAL
    assert drafts[0].publication_types == ("preprint",)
    assert drafts[0].identity.arxiv_id == "2401.00001"
    with pytest.raises(Exception, match="ARXIV_DTD_REFUSED"):
        parse_arxiv_atom(b"<!DOCTYPE feed [<!ENTITY x 'y'>]><feed></feed>")


def test_merge_retraction_positive_beats_none_and_unknown_blocks_none():
    none = RetractionState(NoticeKind.NONE, (), ("OPENALEX_IS_RETRACTED_FALSE",))
    retracted = RetractionState(NoticeKind.RETRACTION, ("10.1000/notice",), ("PUBMED_PUBTYPE_RETRACTION",))
    unknown = unknown_retraction()
    assert merge_retraction((none, retracted)).kind is NoticeKind.RETRACTION
    assert merge_retraction((none, unknown)).kind is NoticeKind.UNKNOWN
    assert merge_retraction((none, none)).kind is NoticeKind.NONE


def test_title_conflict_on_one_doi_is_quarantined():
    def draft(title: str) -> PaperDraft:
        return PaperDraft(
            source_id="crossref" if "other" in title else "openalex",
            identity=make_identity(doi="10.1000/example.2018"),
            title=title,
            abstract=None,
            authors=("Ada Lovelace",),
            year=2018,
            venue=None,
            publication_types=("article",),
            cited_by_count=1,
            is_open_access=None,
            license="UNKNOWN",
            landing_url=None,
            retraction=RetractionState(NoticeKind.NONE, (), ("TEST",)),
            role="work",
            replication_signal="NONE",
        )

    records, quarantine, _gaps = deduplicate(
        (
            draft("Effects of Example Compound on Outcome"),
            draft("A completely different other title about ships"),
        )
    )
    assert records == ()
    assert quarantine[0].reason == "IDENTITY_TITLE_CONFLICT"


def test_valid_package_closes_identity_retraction_and_polarity():
    transport = FixtureTransport(_valid_routes())
    package = compile_evidence_package(
        QUERY,
        as_of=AS_OF,
        transport=transport,
        sources=("openalex",),
        assertions=(
            ClaimAssertion(claim_text=QUERY, polarity="SUPPORT", doi="10.1000/example.2018"),
        ),
    )
    assert package.status.value == "VALID"
    assert package.records[0].identity.doi == "10.1000/example.2018"
    assert package.records[0].identity.pmid == "12345678"
    assert package.records[0].retraction.kind is NoticeKind.NONE
    assert package.groups.foundational[0].record_id == package.records[0].record_id
    assert package.groups.frontier == ()
    assert package.claim_evidence_graph.status == "VALID"
    assert package.claim_evidence_graph.edges[0].polarity == "SUPPORT"
    assert package.contradiction_map.status == "UNKNOWN"
    assert package.contradiction_map.reason == "CONTRADICTION_SIGNAL_ABSENT"
    candidate = package.capsule_candidates[0]
    assert candidate.integration_status == "CANDIDATE_NOT_WIRED"
    assert candidate.support_status == "PARTIALLY_SUPPORTED"
    assert candidate.confidence <= 0.6
    assert "UNTRUSTED_SOURCE" in candidate.taint_labels
    assert "CALLER_ASSERTED" in candidate.taint_labels
    assert package.to_dict()["integration"]["wired_to_k3"] is False
    hosts = {event.host for event in package.egress}
    assert hosts <= {"api.openalex.org", "www.ncbi.nlm.nih.gov"}
    assert all("openalex.org/W1" not in url for url in transport.calls)
    jsonschema.validate(package.to_dict(), SCHEMA)


def test_unknown_retraction_and_missing_polarity_stay_partial():
    transport = FixtureTransport(
        {
            "api.crossref.org": (
                200,
                _json(
                    {
                        "status": "ok",
                        "message": {
                            "items": [
                                {
                                    "DOI": "10.1000/example.2018",
                                    "title": ["Effects of Example Compound on Outcome"],
                                    "type": "journal-article",
                                    "author": [{"given": "Ada", "family": "Lovelace"}],
                                    "issued": {"date-parts": [[2018]]},
                                    "is-referenced-by-count": 40,
                                    "container-title": ["The Lancet"],
                                }
                            ]
                        },
                    }
                ),
            ),
            "pmc/utils/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    package = compile_evidence_package(
        QUERY,
        as_of=AS_OF,
        transport=transport,
        sources=("crossref",),
    )
    assert package.status.value == "PARTIAL"
    codes = {item.code for item in package.gap_unknown_map.items}
    assert "RETRACTION_STATE_UNKNOWN" in codes
    assert "CLAIM_POLARITY_UNKNOWN" in codes
    assert package.capsule_candidates[0].support_status == "UNVERIFIED"
    jsonschema.validate(package.to_dict(), SCHEMA)


def test_opposing_assertions_fill_contradiction_map():
    second = _openalex_work(
        id="https://openalex.org/W2",
        doi="https://doi.org/10.1000/example.2024",
        title="Replication of example compound outcome",
        publication_year=2024,
        cited_by_count=4,
        type="article",
    )
    transport = FixtureTransport(
        {
            "api.openalex.org": (200, _json({"results": [_openalex_work(), second]})),
            "pmc/utils/idconv": (200, _json({"status": "ok", "records": []})),
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
    assert package.contradiction_map.pairs
    contradictory = {member.record_id for member in package.groups.contradictory}
    assert len(contradictory) == 2
    frontier = {member.record_id for member in package.groups.frontier}
    replication = {member.record_id for member in package.groups.replication}
    assert frontier
    assert replication
    assert any(member.basis == ("TITLE_HEURISTIC",) for member in package.groups.replication)


def test_query_and_source_failures_refuse_without_hidden_success():
    exploding = FixtureTransport({})
    refused = compile_evidence_package("", as_of=AS_OF, transport=exploding)
    assert refused.status.value == "REFUSED"
    assert "QUERY_INVALID" in refused.refusal_reasons
    assert exploding.calls == []

    disabled = compile_evidence_package(
        QUERY,
        as_of=AS_OF,
        transport=exploding,
        sources=("semantic_scholar",),
    )
    assert disabled.status.value == "REFUSED"
    assert any(reason.startswith("SOURCE_DISABLED") for reason in disabled.refusal_reasons)
    assert exploding.calls == []

    offline = compile_evidence_package(QUERY, as_of=AS_OF)
    assert offline.status.value == "REFUSED"
    assert "NETWORK_NOT_AUTHORIZED" in offline.refusal_reasons

    failed = FixtureTransport({"api.openalex.org": (503, b"")})
    down = compile_evidence_package(
        QUERY,
        as_of=AS_OF,
        transport=failed,
        sources=("openalex",),
    )
    assert down.status.value == "REFUSED"
    assert "NO_ADMITTED_RECORDS" in down.refusal_reasons
    assert any(item.code == "SOURCE_UNAVAILABLE" for item in down.gap_unknown_map.items)


def test_pubmed_term_is_a_quoted_phrase():
    transport = FixtureTransport(
        {
            "esearch.fcgi": (
                200,
                _json({"esearchresult": {"count": "0", "idlist": []}}),
            ),
            "pmc/utils/idconv": (200, _json({"status": "ok", "records": []})),
        }
    )
    compile_evidence_package(
        "cancer OR smoking",
        as_of=AS_OF,
        transport=transport,
        sources=("pubmed",),
        enrich_identity=False,
    )
    esearch = next(url for url in transport.calls if "esearch.fcgi" in url)
    from urllib.parse import parse_qs, urlsplit

    term = parse_qs(urlsplit(esearch).query)["term"][0]
    assert term.startswith('"') and term.endswith('"')
    assert " OR " in term


def test_egress_allowlist_rejects_off_registry_hosts():
    registry = load_registry()
    assert assert_allowed("https://api.crossref.org/works?rows=1", registry) == "api.crossref.org"
    with pytest.raises(EgressDenied):
        assert_allowed("https://evil.example/works", registry)
    with pytest.raises(EgressDenied):
        assert_allowed("http://api.crossref.org/works", registry)


def test_scholarly_modules_do_not_import_other_lane_owners():
    scholarly = ROOT / "spe_runtime" / "scholarly"
    forbidden = ("spe_runtime.xcat", "spe_runtime.k3", "spe_runtime.quality", "spe_runtime.grounding")
    for path in scholarly.glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                names = [node.module]
            else:
                continue
            for name in names:
                assert not any(name == item or name.startswith(item + ".") for item in forbidden)
        text = path.read_text(encoding="utf-8")
        assert "datetime.now(" not in text
        assert "time.time(" not in text


def test_refused_package_matches_schema():
    package = compile_evidence_package("   ", as_of="2026-02-31", transport=FixtureTransport({}))
    assert package.status.value == "REFUSED"
    jsonschema.validate(package.to_dict(), SCHEMA)
