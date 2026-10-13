#!/usr/bin/env python3
"""Public AI incident watch: opt-in, limited to verified official Statuspage feed.

This CLI observes PUBLIC source metadata only, not user prompts. No model
APIs, billing, credentials, search submissions or publishing. By default
no network access is possible. Intended to be run by an approved external
scheduler/website owner after review, not by the offline semantic kernel.
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone

from spe_runtime.failure_genome.source_watch import (
    PublicStatusFeedObserver, TrustedStatusFeed,
)


def main() -> int:
    args = argparse.ArgumentParser(description="SPE public incident observer (opt-in)")
    args.add_argument("--live", action="store_true", help="Request a read-only approved public HTTPS feed observation")
    selected = args.parse_args()
    owner_enabled = os.environ.get("SPE_PUBLIC_INCIDENT_WATCH_ENABLED") == "true"
    separately_granted = os.environ.get("SPE_PUBLIC_INCIDENT_OWNER_APPROVED") == "true"
    live = bool(selected.live and owner_enabled and separately_granted)

    # Verified public Atlassian Statuspage endpoint for Claude; provider API
    # host and endpoint must not be supplied by untrusted user input.
    observer = PublicStatusFeedObserver(
        (TrustedStatusFeed(
            source_id="claude-status",
            hostname="status.claude.com",
            model_scope="CLAUDE_SERVICE_NOT_INDIVIDUAL_MODEL",
            enabled=live,
        ),),
        max_requests=1,
        max_bytes=262144,
        timeout_seconds=5.0,
    )
    if not live:
        print(json.dumps({
            "status": "HOLD_NO_NETWORK_APPROVAL",
            "source_id": "claude-status",
            "network_calls": 0,
            "publication_authorized": False,
            "remote_model_replay_proven": False,
        }, sort_keys=True))
        return 0
    result = observer.poll(
        "claude-status",
        allow_network=True,
        observed_at=datetime.now(timezone.utc).isoformat(),
    )
    # Only minimal public metadata/digests go to CI logs; do not print raw
    # bodies, inputs, title strings, incident updates or HTTP error messages.
    print(json.dumps({
        "status": result.status,
        "source_id": result.source_id,
        "observations_added": result.added,
        "duplicates_in_this_run": result.duplicates,
        "held_records": result.held,
        "reason_codes": list(result.reason_codes),
        "journal_chain_valid": observer.journal.verify_chain(),
        "requests_used": observer.requests_used,
        "publication_authorized": False,
        "remote_model_replay_proven": False,
        "cross_run_deduplication": "NOT_YET_IMPLEMENTED",
        "records": [
            {
                "event_id": x.event_id,
                "published_at": x.source_published_at,
                "observed_at": x.observed_at,
                "source_content_digest": x.content_sha256,
                "journal_chain_digest": x.chain_digest,
                "event_kind": x.event_kind.value,
            }
            for x in result.observations
        ],
    }, sort_keys=True))
    return 0 if result.status == "OBSERVED_METADATA_ONLY" else 2


if __name__ == "__main__":
    raise SystemExit(main())
