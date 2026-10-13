"""R6 staged hourly official-source workflow: default-off, source-only, no bills."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from spe_runtime.failure_genome.source_watch import (
    TrustedStatusFeed, _bounded_https_transport,
)

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize("extra", [[], ["--live"]])
def test_official_status_cli_has_zero_network_without_dual_owner_flags(extra):
    env = os.environ.copy()
    env.pop("SPE_PUBLIC_INCIDENT_WATCH_ENABLED", None)
    env.pop("SPE_PUBLIC_INCIDENT_OWNER_APPROVED", None)
    result = subprocess.run(
        [sys.executable, "-m", "tools.spe_public_incident_watch", *extra],
        cwd=ROOT, env=env, text=True, capture_output=True, timeout=10,
        check=False,
    )
    assert result.returncode == 0
    record = json.loads(result.stdout)
    assert record["status"] == "HOLD_NO_NETWORK_APPROVAL"
    assert record["network_calls"] == 0
    assert record["publication_authorized"] is False
    assert "Traceback" not in result.stderr


def test_scheduled_workflow_has_required_opt_in_and_no_secret_billing():
    text = (ROOT / ".github/workflows/spe-northstar-public-status-watch.yml").read_text("utf-8")
    assert "cron:" in text
    assert "workflow_dispatch:" in text
    assert "vars.SPE_PUBLIC_INCIDENT_WATCH_ENABLED == 'true'" in text
    assert "vars.SPE_PUBLIC_INCIDENT_OWNER_APPROVED == 'true'" in text
    assert "contents: read" in text
    assert "timeout-minutes: 5" in text
    assert "--live" in text
    assert "contents: write" not in text
    assert "secrets." not in text
    assert "curl " not in text


def test_claude_source_uses_the_verified_public_api_exact_host_and_path():
    f = TrustedStatusFeed(
        source_id="claude-status", hostname="status.claude.com", enabled=False,
    )
    assert f.url == "https://status.claude.com/api/v2/incidents.json"
    assert f.enabled is False


def test_builtin_https_transport_blocks_private_dns_before_connect(monkeypatch):
    import socket
    def poison(*_args, **_kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))]
    monkeypatch.setattr(socket, "getaddrinfo", poison)
    with pytest.raises(ValueError, match="NON_PUBLIC_DNS_RESPONSE"):
        _bounded_https_transport(
            "https://status.claude.com/api/v2/incidents.json",
            8192, 1.0,
        )


def test_builtin_transport_does_not_accept_unreviewed_endpoints():
    for url in (
        "http://status.claude.com/api/v2/incidents.json",
        "https://status.claude.com/redirect",
        "https://status.claude.com/api/v2/incidents.json?debug=1",
        "https://status.claude.com:8443/api/v2/incidents.json",
    ):
        with pytest.raises(ValueError, match="UNSAFE_PUBLIC_FEED_ENDPOINT"):
            _bounded_https_transport(url, 8192, 1.0)
