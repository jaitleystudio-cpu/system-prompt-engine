"""Live adapter fixtures → ContextCapsule; capability HOLD preserved."""

from __future__ import annotations

from spe_runtime.grounding.live_adapters import acquire_scholarly_hits
from spe_runtime.grounding.live_fabric import LIVE_INDEX, LIVE_RETRACTION


def test_fixture_acquire_multi_provider_hold():
    result = acquire_scholarly_hits(
        "Lamport happened-before distributed clocks",
        providers=("OPENALEX", "CROSSREF"),
        consent=True,
    )
    assert result["status"] == "ACQUIRED_FIXTURE"
    assert result["status"] != "ACQUIRED_LIVE"
    assert int(result["network_calls"]) >= 1
    assert result["mode"] == "OFFLINE_SEED"
    assert result["mode"] != "LIVE"
    assert result["live_index"] == "HOLD"
    assert result["live_retraction"] == "HOLD"
    assert LIVE_INDEX == "HOLD"
    assert LIVE_RETRACTION == "HOLD"
    assert result["capsules"]
    assert all(c["provenance_digest"].startswith("sha256:") for c in result["capsules"])
    assert all("UNTRUSTED_SOURCE" in c["taint_labels"] for c in result["capsules"])


def test_privacy_rejects_or_strips_secret():
    secret = "patient-token-DEADBEEF"
    result = acquire_scholarly_hits(
        f"therapy outcomes for {secret}",
        providers=("PUBMED",),
        sensitive_spans=(secret,),
        consent=True,
    )
    assert result["status"] in {"ACQUIRED_FIXTURE", "ACQUIRED_LIVE", "REJECTED_PRIVACY", "PARTIAL"}
    blob = str(result)
    assert secret not in blob or result["status"] == "REJECTED_PRIVACY"
    if result["status"] != "REJECTED_PRIVACY":
        assert secret not in str(result.get("outbound_query", ""))


def test_timeout_probe_not_acquired():
    result = acquire_scholarly_hits("timeout-probe", consent=True)
    assert result["status"] == "TIMEOUT"
    assert result["status"] != "ACQUIRED_LIVE"


def test_pmid_pair_does_not_count_as_two_doi_providers():
    """PubMed and PMC sharing a pmid are not independent DOI identity."""
    from spe_runtime.grounding.live_fabric import count_identity_provider_agreement

    agree = count_identity_provider_agreement(
        [
            {"provider": "PUBMED", "identifier": "pmid:12077603"},
            {"provider": "PMC", "identifier": "pmid:12077603"},
        ]
    )
    assert agree == 0


def test_doi_query_returns_target_work_not_search_neighbors():
    """DOI queries must hit the work itself. Bibliographic neighbors do not match."""
    import json

    from spe_runtime.grounding.live_fabric import (
        LIVE_INDEX,
        LIVE_RETRACTION,
        may_promote_live_index,
        may_promote_live_retraction,
    )

    def transport(url: str) -> tuple[int, str]:
        lowered = url.lower()
        if "openalex.org" in lowered and "/works/https://doi.org/10.1038/nature00870" in lowered:
            return 200, json.dumps(
                {
                    "doi": "https://doi.org/10.1038/nature00870",
                    "display_name": "RETRACTED ARTICLE: Pluripotency of mesenchymal stem cells derived from adult marrow",
                    "is_retracted": True,
                    "type": "article",
                }
            )
        if "crossref.org" in lowered and lowered.rstrip("/").endswith("/works/10.1038/nature00870"):
            return 200, json.dumps(
                {
                    "message": {
                        "DOI": "10.1038/nature00870",
                        "title": [
                            "RETRACTED ARTICLE: Pluripotency of mesenchymal stem cells derived from adult marrow"
                        ],
                        "type": "journal-article",
                        "updated-by": [{"type": "retraction"}],
                    }
                }
            )
        if "openalex.org" in lowered and "/works/https://doi.org/10.1145/359545.359563" in lowered:
            return 200, json.dumps(
                {
                    "doi": "https://doi.org/10.1145/359545.359563",
                    "display_name": "Time, Clocks, and the Ordering of Events in a Distributed System",
                    "is_retracted": False,
                    "type": "article",
                }
            )
        if "crossref.org" in lowered and lowered.rstrip("/").endswith("/works/10.1145/359545.359563"):
            return 200, json.dumps(
                {
                    "message": {
                        "DOI": "10.1145/359545.359563",
                        "title": [
                            "Time, Clocks, and the Ordering of Events in a Distributed System"
                        ],
                        "type": "journal-article",
                    }
                }
            )
        return 200, json.dumps(
            {
                "results": [
                    {
                        "doi": "https://doi.org/10.1038/nature05812",
                        "display_name": "Erratum neighbor",
                        "is_retracted": False,
                        "type": "erratum",
                    }
                ],
                "message": {
                    "items": [
                        {
                            "DOI": "10.1190/tle12101038.1",
                            "title": ["Membership Applications Received"],
                            "type": "journal-article",
                        }
                    ]
                },
                "esearchresult": {"idlist": ["12077603"]},
            }
        )

    retracted = acquire_scholarly_hits(
        "10.1038/nature00870",
        providers=("OPENALEX", "CROSSREF", "PUBMED", "PMC"),
        consent=True,
        transport=transport,
    )
    by_provider = {hit["provider"]: hit for hit in retracted["hits"]}
    assert by_provider["OPENALEX"]["identifier"] == "doi:10.1038/nature00870"
    assert by_provider["CROSSREF"]["identifier"] == "doi:10.1038/nature00870"
    assert by_provider["OPENALEX"]["retraction"] == "RETRACTION_SIGNAL"
    assert by_provider["CROSSREF"]["retraction"] == "RETRACTION_SIGNAL"
    assert retracted["identity_providers_agreeing"] == 2
    assert retracted["retraction"]["status"] == "RETRACTION_SIGNAL"
    assert "UNTRUSTED_SOURCE" in retracted["capsules"][0]["taint_labels"]
    assert retracted["live_index"] == "HOLD"
    assert retracted["live_retraction"] == "HOLD"
    assert LIVE_INDEX == "HOLD"
    assert LIVE_RETRACTION == "HOLD"
    assert may_promote_live_index() is False
    assert may_promote_live_retraction() is False

    lamport = acquire_scholarly_hits(
        "doi:10.1145/359545.359563",
        providers=("OPENALEX", "CROSSREF"),
        consent=True,
        transport=transport,
    )
    lamport_ids = {hit["provider"]: hit["identifier"] for hit in lamport["hits"]}
    assert lamport_ids["OPENALEX"] == "doi:10.1145/359545.359563"
    assert lamport_ids["CROSSREF"] == "doi:10.1145/359545.359563"
    assert lamport["identity_providers_agreeing"] == 2
    assert lamport["live_index"] == "HOLD"


def test_fixture_transport_is_not_acquired_live(monkeypatch):
    """Default fixture transport must not claim ACQUIRED_LIVE or mode LIVE."""
    monkeypatch.delenv("SPE_SCHOLARLY_LIVE", raising=False)
    result = acquire_scholarly_hits(
        "10.1038/nature00870",
        providers=("OPENALEX", "CROSSREF", "PUBMED"),
        consent=True,
    )
    assert result["status"] != "ACQUIRED_LIVE"
    assert result["mode"] != "LIVE"
    assert result["live_index"] == "HOLD"
    assert result["live_retraction"] == "HOLD"
    assert result["retraction"]["live_verified"] is False


def test_query_substring_does_not_stamp_retraction_on_every_provider():
    """nature00870 in the query is not a retraction field and not a DOI match."""
    import json

    def transport(_url: str) -> tuple[int, str]:
        return 200, json.dumps(
            {
                "results": [
                    {
                        "doi": "https://doi.org/10.9999/unrelated.paper",
                        "display_name": "Unrelated paper",
                        "is_retracted": False,
                        "type": "article",
                    }
                ],
                "message": {
                    "items": [
                        {
                            "DOI": "10.9999/unrelated.paper",
                            "title": ["Unrelated paper"],
                            "type": "journal-article",
                        }
                    ]
                },
                "esearchresult": {"idlist": ["42"]},
            }
        )

    result = acquire_scholarly_hits(
        "notes mentioning nature00870",
        providers=("OPENALEX", "CROSSREF", "PUBMED"),
        consent=True,
        transport=transport,
    )
    assert all(hit["retraction"] != "RETRACTION_SIGNAL" for hit in result["hits"])
    assert result["retraction"]["status"] != "RETRACTION_SIGNAL"
    assert result["retraction"]["live_verified"] is False
