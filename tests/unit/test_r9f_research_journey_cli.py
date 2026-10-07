"""R9-F: live CLI persists bodies through the existing research_journey owner.

Does not promote LIVE_* gates. Does not introduce ResearchEngine2.
"""

from __future__ import annotations

import json
from pathlib import Path

from spe_runtime.grounding.live_fabric import LIVE_INDEX, LIVE_RETRACTION
from spe_runtime.grounding.research_journey import main


def test_live_cli_evidence_dir_persists_bodies_and_holds(tmp_path, monkeypatch, capsys):
    evidence = tmp_path / "evidence" / "r9-f-scholarly-retraction" / "cli"
    evidence.mkdir(parents=True)
    openalex_body = evidence / "openalex.body.json"
    crossref_body = evidence / "crossref.body.json"
    openalex_body.write_text(
        '{"doi":"https://doi.org/10.1038/nature00870","is_retracted":true,'
        '"display_name":"RETRACTED ARTICLE"}'
    )
    crossref_body.write_text(
        '{"message":{"DOI":"10.1038/nature00870","updated-by":[{"type":"retraction",'
        '"DOI":"10.1038/s41586-024-07653-0"}]}}'
    )

    def fake_acquire(query, **kwargs):
        assert kwargs.get("force_live") is True
        assert kwargs.get("consent") is True
        assert kwargs.get("evidence_dir") == str(evidence)
        return {
            "status": "ACQUIRED_LIVE",
            "mode": "LIVE",
            "live_index": "HOLD",
            "live_retraction": "HOLD",
            "network_calls": 2,
            "hits": [
                {
                    "provider": "OPENALEX",
                    "identifier": "doi:10.1038/nature00870",
                    "title": "RETRACTED ARTICLE: Pluripotency",
                    "retraction": "RETRACTION_SIGNAL",
                    "is_retracted": True,
                    "notice_types": [],
                },
                {
                    "provider": "CROSSREF",
                    "identifier": "doi:10.1038/nature00870",
                    "title": "RETRACTED ARTICLE: Pluripotency",
                    "retraction": "RETRACTION_SIGNAL",
                    "is_retracted": True,
                    "notice_types": ["retraction"],
                },
            ],
            "fetches": [
                {
                    "provider": "OPENALEX",
                    "url": "https://api.openalex.org/works/https://doi.org/10.1038/nature00870",
                    "http_status": 200,
                    "response_sha256": "a" * 64,
                    "body_path": str(openalex_body),
                    "timestamp_ist": "2026-10-07T11:31:58+05:30",
                },
                {
                    "provider": "CROSSREF",
                    "url": "https://api.crossref.org/works/10.1038/nature00870",
                    "http_status": 200,
                    "response_sha256": "b" * 64,
                    "body_path": str(crossref_body),
                    "timestamp_ist": "2026-10-07T11:31:59+05:30",
                },
            ],
            "capsules": [],
        }

    monkeypatch.setattr(
        "spe_runtime.grounding.research_journey.acquire_scholarly_hits",
        fake_acquire,
    )

    code = main(
        [
            "--question",
            "10.1038/nature00870",
            "--consent",
            "--live",
            "--provider",
            "OPENALEX",
            "--provider",
            "CROSSREF",
            "--evidence-dir",
            str(evidence),
        ]
    )
    assert code == 0
    out = json.loads(capsys.readouterr().out)
    assert out["product_LIVE_INDEX"] == LIVE_INDEX == "HOLD"
    assert out["product_LIVE_RETRACTION"] == LIVE_RETRACTION == "HOLD"
    assert out["may_promote"] is False
    assert out["evidence_dir"] == str(evidence)
    assert out["response_body_path"] == str(openalex_body)
    assert out["retraction_body_path"] == str(crossref_body)
    assert Path(out["response_body_path"]).is_file()
    assert Path(out["retraction_body_path"]).is_file()
    assert out["retraction_status"] == "RETRACTION_SIGNAL"
    assert "ResearchEngine2" not in json.dumps(out)
