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
from pathlib import Path
from datetime import datetime, timezone

from spe_runtime.failure_genome.event_journal import SourceAuthority
from spe_runtime.failure_genome.durable_journal import DurableJournalStore, JournalCustodyError
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

    # Verified official Statuspage endpoint only; provider source data must
    # never change the host, path, consent flags or durable state location.
    feed = TrustedStatusFeed(
        source_id="claude-status",
        hostname="status.claude.com",
        model_scope="CLAUDE_SERVICE_NOT_INDIVIDUAL_MODEL",
        enabled=live,
    )
    if not live:
        print(json.dumps({
            "status": "HOLD_NO_NETWORK_APPROVAL",
            "source_id": feed.source_id,
            "network_calls": 0,
            "publication_authorized": False,
            "remote_model_replay_proven": False,
        }, sort_keys=True))
        return 0

    # GitHub-hosted runners are ephemeral. No state path = do NOT fetch.
    # In production an independently approved persistent POSIX host must
    # provide a private path (0600 state, 0700 parent), not $RUNNER_TEMP.
    path = os.environ.get("SPE_PUBLIC_INCIDENT_STATE_PATH", "")
    if not path or not Path(path).is_absolute():
        print(json.dumps({
            "status": "HOLD_NO_DURABLE_HOST",
            "source_id": feed.source_id,
            "network_calls": 0,
            "cross_run_deduplication": "UNAVAILABLE",
            "publication_authorized": False,
        }, sort_keys=True))
        return 2
    try:
        store = DurableJournalStore(
            Path(path),
            {
                feed.source_id: SourceAuthority(feed.source_id, feed.hostname, feed.path),
            },
        )
        with store.session() as journal:
            observer = PublicStatusFeedObserver(
                (feed,), max_requests=1, max_bytes=262144,
                timeout_seconds=5.0, journal=journal,
            )
            result = observer.poll(
                feed.source_id,
                allow_network=True,
                observed_at=datetime.now(timezone.utc).isoformat(),
            )
            record_count = len(journal.entries)
            head = journal.entries[-1].chain_digest if journal.entries else "0" * 64
            chain_valid = journal.verify_chain()
        # The context exit has fsynced the committed metadata state.
    except JournalCustodyError:
        print(json.dumps({
            "status": "HOLD_CUSTODY_REJECTED",
            "source_id": feed.source_id,
            "cross_run_deduplication": "NOT_PROVEN",
            "publication_authorized": False,
        }, sort_keys=True))
        return 2

    # Strictly public metadata/digests only; no raw bodies, model prompt
    # content, external titles, tokens, provider messages or HTTP errors.
    print(json.dumps({
        "status": result.status,
        "source_id": result.source_id,
        "observations_added": result.added,
        "duplicates_in_this_run": result.duplicates,
        "held_records": result.held,
        "reason_codes": list(result.reason_codes),
        "journal_chain_valid": chain_valid,
        "durably_recorded_observations": record_count,
        "durable_head_sha256": head,
        "requests_used": observer.requests_used,
        "publication_authorized": False,
        "remote_model_replay_proven": False,
        "cross_run_deduplication": "LOCAL_SINGLE_HOST_WITH_COMMITTED_STATE",
        "external_source_authenticity": "NOT_INDEPENDENTLY_ESTABLISHED",
        "rollback_resistant_checkpoint": False,
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
