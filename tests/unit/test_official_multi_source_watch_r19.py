"""R19 two vetted public providers with distinct grants, custody and no network tests."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

import tools.spe_public_incident_watch as cli
from spe_runtime.failure_genome.durable_journal import DurableJournalStore
from spe_runtime.failure_genome.event_journal import SourceAuthority
from spe_runtime.failure_genome.source_watch import (
    FeedResponse,
    PublicStatusFeedObserver as RealObserver,
    TrustedStatusFeed,
)


def test_official_feed_registry_is_exact_and_not_provider_controlled():
    assert set(cli.OFFICIAL_FEEDS) == {"claude-status", "openai-status"}
    claude = cli.OFFICIAL_FEEDS["claude-status"]
    openai = cli.OFFICIAL_FEEDS["openai-status"]
    assert claude["hostname"] == "status.claude.com"
    assert openai["hostname"] == "status.openai.com"
    assert claude["state_env"] != openai["state_env"]
    assert openai["approval_env"] == "SPE_PUBLIC_INCIDENT_OPENAI_OWNER_APPROVED"
    assert "NOT_INDIVIDUAL_MODEL" in claude["model_scope"]
    assert "NOT_INDIVIDUAL_MODEL" in openai["model_scope"]
    for source_id, cfg in cli.OFFICIAL_FEEDS.items():
        f = TrustedStatusFeed(source_id=source_id, hostname=cfg["hostname"])
        assert f.url == f"https://{cfg['hostname']}/api/v2/incidents.json"
        assert f.enabled is False


@pytest.mark.parametrize("source", ["claude-status", "openai-status"])
def test_sources_default_to_no_network_even_if_cli_requests_live(monkeypatch, capsys, source):
    monkeypatch.setattr("sys.argv", ["spe-watch", "--live", "--source", source])
    monkeypatch.delenv("SPE_PUBLIC_INCIDENT_WATCH_ENABLED", raising=False)
    monkeypatch.delenv("SPE_PUBLIC_INCIDENT_OWNER_APPROVED", raising=False)
    assert cli.main() == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "HOLD_NO_NETWORK_APPROVAL"
    assert payload["network_calls"] == 0
    assert payload["publication_authorized"] is False


def test_openai_requires_separate_approval_not_only_existing_claude_grants(monkeypatch, capsys):
    monkeypatch.setattr("sys.argv", ["spe-watch", "--live", "--source", "openai-status"])
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_WATCH_ENABLED", "true")
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_OWNER_APPROVED", "true")
    monkeypatch.delenv("SPE_PUBLIC_INCIDENT_OPENAI_OWNER_APPROVED", raising=False)
    assert cli.main() == 0
    response = json.loads(capsys.readouterr().out)
    assert response["status"] == "HOLD_NO_NETWORK_APPROVAL"
    assert response["network_calls"] == 0


def test_openai_approved_but_missing_durable_storage_still_never_fetches(monkeypatch, capsys):
    monkeypatch.setattr("sys.argv", ["spe-watch", "--live", "--source", "openai-status"])
    for name in ("SPE_PUBLIC_INCIDENT_WATCH_ENABLED",
                 "SPE_PUBLIC_INCIDENT_OWNER_APPROVED",
                 "SPE_PUBLIC_INCIDENT_OPENAI_OWNER_APPROVED"):
        monkeypatch.setenv(name, "true")
    monkeypatch.delenv("SPE_PUBLIC_INCIDENT_OPENAI_STATE_PATH", raising=False)
    assert cli.main() == 2
    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "HOLD_NO_DURABLE_HOST"
    assert payload["network_calls"] == 0


def test_two_source_paths_must_not_alias_even_with_valid_grants(monkeypatch, capsys, tmp_path):
    same = str(tmp_path / "overlapping.json")
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_STATE_PATH", same)
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_OPENAI_STATE_PATH", same)
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_WATCH_ENABLED", "true")
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_OWNER_APPROVED", "true")
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_OPENAI_OWNER_APPROVED", "true")
    monkeypatch.setattr("sys.argv", ["spe-watch", "--live", "--source", "openai-status"])
    assert cli.main() == 2
    assert json.loads(capsys.readouterr().out)["status"] == "HOLD_CUSTODY_NAMESPACE_COLLISION"
    assert not (tmp_path / "overlapping.json").exists()


def test_two_authorized_sources_use_separate_persistent_journals(monkeypatch, capsys, tmp_path):
    claude_path = tmp_path / "claude.json"
    openai_path = tmp_path / "openai.json"
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_STATE_PATH", str(claude_path))
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_OPENAI_STATE_PATH", str(openai_path))
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_WATCH_ENABLED", "true")
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_OWNER_APPROVED", "true")
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_OPENAI_OWNER_APPROVED", "true")
    urls = []
    ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()

    def fake_observer(feeds, **kwargs):
        assert len(feeds) == 1
        f = feeds[0]
        def transport(url, byte_limit, timeout):
            assert url == f.url
            urls.append(url)
            event = {
                "id": "same-provider-incident-id",
                "name": "Public test notice",
                "status": "monitoring",
                "updated_at": ago,
                "incident_updates": [{"body": "Test-only public fixture"}],
            }
            return FeedResponse(
                200, url, "application/json",
                json.dumps({"incidents": [event]}).encode("utf-8"),
            )
        return RealObserver(feeds, transport=transport, **kwargs)

    monkeypatch.setattr(cli, "PublicStatusFeedObserver", fake_observer)
    def invoke(source):
        monkeypatch.setattr("sys.argv", ["spe-watch", "--live", "--source", source])
        status = cli.main()
        out = json.loads(capsys.readouterr().out)
        return status, out

    code_c, c = invoke("claude-status")
    code_o, o = invoke("openai-status")
    code_o2, o2 = invoke("openai-status")
    assert code_c == code_o == code_o2 == 0
    assert (c["observations_added"], o["observations_added"], o2["observations_added"]) == (1, 1, 0)
    assert o2["duplicates_in_this_run"] == 1
    assert o2["durably_recorded_observations"] == 1
    assert urls == [
        "https://status.claude.com/api/v2/incidents.json",
        "https://status.openai.com/api/v2/incidents.json",
        "https://status.openai.com/api/v2/incidents.json",
    ]
    assert "Test-only public fixture" not in json.dumps(c)
    assert "Test-only public fixture" not in json.dumps(o)
    assert not c["publication_authorized"]
    assert not o["first_to_report_verified"]
    assert not o2["remote_model_replay_proven"]
    c_store = DurableJournalStore(claude_path, {
        "claude-status": SourceAuthority("claude-status", "status.claude.com", "/api/v2/incidents.json"),
    })
    o_store = DurableJournalStore(openai_path, {
        "openai-status": SourceAuthority("openai-status", "status.openai.com", "/api/v2/incidents.json"),
    })
    assert c_store.audit().records == 1
    assert o_store.audit().records == 1
    assert c_store.allowlist_sha256 != o_store.allowlist_sha256


def test_unapproved_source_name_never_becomes_arbitrary_external_url(monkeypatch):
    monkeypatch.setattr("sys.argv", ["spe-watch", "--source", "status.attacker.invalid", "--live"])
    with pytest.raises(SystemExit) as stopped:
        cli.main()
    assert stopped.value.code == 2
