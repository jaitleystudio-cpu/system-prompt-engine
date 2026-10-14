"""R21 operational qualification: no network or self-attested production authority."""
from __future__ import annotations

import json
import os
from dataclasses import asdict, replace
from datetime import datetime, timezone
from pathlib import Path

import pytest

from spe_runtime.ci_gate.receipt import generate_keypair, generate_authenticated_receipt
from spe_runtime.failure_genome.checkpoint_review import OwnerPinnedFloor, checkpoint_payload
from spe_runtime.failure_genome.durable_journal import DurableJournalStore
from spe_runtime.failure_genome.event_journal import SourceAuthority, SourceSnapshot, EventKind, JournalDecision
from spe_runtime.failure_genome.operational_readiness import inspect_source_operation
import tools.spe_northstar_preflight as cli

SOURCE = "claude-status"
AUTHORITY = SourceAuthority(SOURCE, "status.claude.com", "/api/v2/incidents.json")


def _save(path, value):
    path.write_text(json.dumps(value), encoding="utf-8")
    path.chmod(0o600)


def configured(tmp_path, monkeypatch, *, source=SOURCE):
    from tools.spe_public_incident_watch import OFFICIAL_FEEDS
    cfg = OFFICIAL_FEEDS[source]
    authority = SourceAuthority(source, cfg["hostname"], "/api/v2/incidents.json")
    state = tmp_path / (source + ".json")
    receipt_file = tmp_path / (source + "-receipt.json")
    keys_file = tmp_path / (source + "-trust-keys.json")
    floor_file = tmp_path / (source + "-floor.json")
    store = DurableJournalStore(state, {source: authority})
    now = datetime.now(timezone.utc)
    with store.session() as journal:
        assert journal.ingest(SourceSnapshot(
            source_id=source, event_id="provider-event-001",
            url=f"https://{authority.hostname}/api/v2/incidents.json",
            content_sha256="a" * 64,
            source_published_at=now.isoformat(),
            observed_at=now.isoformat(),
            event_kind=EventKind.NOTICE,
            subject_model="PUBLIC_SERVICE_METADATA_ONLY",
            title="Fake internal test notice",
        )).decision is JournalDecision.ADDED
    sk, pk = generate_keypair()
    receipt = generate_authenticated_receipt(
        checkpoint_payload(store.audit(), sequence=1, issued_at=now.isoformat()),
        signing_key=sk, public_key=pk, key_id="external-owner-test-only",
    )
    floor = OwnerPinnedFloor(
        minimum_sequence=0, known_record_count=0,
        known_head_sha256="0" * 64,
        allowlist_sha256=store.allowlist_sha256,
    )
    _save(receipt_file, asdict(receipt))
    _save(keys_file, {receipt.signer_key_id: pk.hex()})
    _save(floor_file, asdict(floor))
    args = [
        "preflight", "--source", source, "--state-file", str(state),
        "--owner-receipt-file", str(receipt_file),
        "--owner-trust-keys-file", str(keys_file),
        "--owner-floor-file", str(floor_file),
    ]
    monkeypatch.setattr("sys.argv", args)
    return store, receipt_file, keys_file, floor_file, receipt, floor


def approve(monkeypatch, *, source=SOURCE):
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_WATCH_ENABLED", "true")
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_OWNER_APPROVED", "true")
    monkeypatch.setenv("SPE_NORTHSTAR_PERSISTENT_HOST_OWNER_REVIEWED", "true")
    if source == "openai-status":
        monkeypatch.setenv("SPE_PUBLIC_INCIDENT_OPENAI_OWNER_APPROVED", "true")


def run(capsys):
    code = cli.main()
    result = json.loads(capsys.readouterr().out)
    return code, result


def test_no_evidence_by_default_is_hold_zero_network(monkeypatch, capsys):
    monkeypatch.setattr("sys.argv", ["preflight"])
    assert run(capsys) == (2, {
        "status": "HOLD",
        "source_id": SOURCE,
        "reason_codes": ["OPERATOR_CUSTODY_FILES_NOT_PROVIDED"],
        "network_calls": 0,
        "production_monitoring_authorized": False,
        "public_incident_publication_authorized": False,
        "independent_owner_trust_proven": False,
    })


def test_valid_local_signatures_produce_review_only_never_release(tmp_path, monkeypatch, capsys):
    configured(tmp_path, monkeypatch)
    approve(monkeypatch)
    code, result = run(capsys)
    assert code == 0
    assert result["status"] == "LOCAL_CUSTODY_CHECKS_PASS_OWNER_REVIEW_REQUIRED"
    assert result["cryptographic_checkpoint_locally_verified"]
    assert result["local_journal_integrity_valid"]
    assert result["durable_record_count"] == 1
    assert not result["independent_owner_trust_proven"]
    assert not result["monotonic_floor_proven_independently"]
    assert not result["production_monitoring_authorized"]
    assert not result["public_incident_publication_authorized"]
    assert result["network_calls"] == 0


def test_owner_network_grants_absent_preserve_hold(tmp_path, monkeypatch, capsys):
    configured(tmp_path, monkeypatch)
    monkeypatch.delenv("SPE_PUBLIC_INCIDENT_WATCH_ENABLED", raising=False)
    monkeypatch.delenv("SPE_PUBLIC_INCIDENT_OWNER_APPROVED", raising=False)
    code, result = run(capsys)
    assert code == 2
    assert "OWNER_SOURCE_APPROVAL_MISSING" in result["reason_codes"]
    assert "PERSISTENT_HOST_OPERATOR_ATTESTATION_MISSING" in result["reason_codes"]
    assert result["network_calls"] == 0


def test_source_specific_openai_approval_separate_from_claude(tmp_path, monkeypatch, capsys):
    configured(tmp_path, monkeypatch, source="openai-status")
    approve(monkeypatch, source="openai-status")
    monkeypatch.delenv("SPE_PUBLIC_INCIDENT_OPENAI_OWNER_APPROVED", raising=False)
    c, r = run(capsys)
    assert c == 2
    assert "OWNER_SOURCE_APPROVAL_MISSING" in r["reason_codes"]
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_OPENAI_OWNER_APPROVED", "true")
    c, r = run(capsys)
    assert c == 0
    assert r["source_id"] == "openai-status"
    assert r["network_calls"] == 0


def test_wrong_owner_signing_root_is_hold(tmp_path, monkeypatch, capsys):
    _, _, keys_path, _, receipt, _ = configured(tmp_path, monkeypatch)
    approve(monkeypatch)
    _, foreign_pk = generate_keypair()
    _save(keys_path, {receipt.signer_key_id: foreign_pk.hex()})
    code, result = run(capsys)
    assert code == 2
    assert "CHECKPOINT_SIGNATURE_INVALID" in result["reason_codes"]
    assert not result["cryptographic_checkpoint_locally_verified"]


def test_wrong_receipt_metadata_cannot_self_certify(tmp_path, monkeypatch, capsys):
    _, receipt_path, _, _, receipt, _ = configured(tmp_path, monkeypatch)
    approve(monkeypatch)
    bad = asdict(receipt)
    bad["canonical_payload"]["head_sha256"] = "f" * 64
    _save(receipt_path, bad)
    code, result = run(capsys)
    assert code == 2
    assert "CHECKPOINT_CONTENT_OR_SEQUENCE_MISMATCH" in result["reason_codes"]


@pytest.mark.parametrize("target", ["receipt", "trust", "floor"])
def test_unsafe_world_readable_owner_evidence_file_rejected(tmp_path, monkeypatch, capsys, target):
    _, receipt_path, keys_path, floor_path, _, _ = configured(tmp_path, monkeypatch)
    approve(monkeypatch)
    selected = {"receipt": receipt_path, "trust": keys_path, "floor": floor_path}[target]
    selected.chmod(0o644)
    code, result = run(capsys)
    assert code == 2
    assert "OWNER_EVIDENCE_FILE_UNSAFE" in result["reason_codes"]


def test_symlinked_evidence_file_is_refused(tmp_path, monkeypatch, capsys):
    _, receipt_path, _, _, _, _ = configured(tmp_path, monkeypatch)
    approve(monkeypatch)
    original = tmp_path / "original-receipt.json"
    receipt_path.rename(original)
    receipt_path.symlink_to(original)
    code, result = run(capsys)
    assert code == 2
    assert "OWNER_EVIDENCE_FILE_UNSAFE" in result["reason_codes"]


def test_namespace_alias_between_trust_root_and_receipt_is_hold(tmp_path, monkeypatch, capsys):
    _, receipt_path, _, _, _, _ = configured(tmp_path, monkeypatch)
    approve(monkeypatch)
    i = cli.os.sys.argv.index("--owner-trust-keys-file")
    cli.os.sys.argv[i + 1] = str(receipt_path)
    code, result = run(capsys)
    assert code == 2
    assert "OPERATOR_CUSTODY_FILE_NAMESPACE_COLLISION" in result["reason_codes"]


def test_preflight_does_not_touch_provider_network_even_with_valid_local_check(tmp_path, monkeypatch, capsys):
    configured(tmp_path, monkeypatch)
    approve(monkeypatch)
    import socket
    def forbid_network(*_args, **_kwargs):
        raise AssertionError("NETWORK_SHOULD_NOT_BE_CALLED")
    monkeypatch.setattr(socket, "create_connection", forbid_network)
    code, result = run(capsys)
    assert code == 0
    assert result["network_calls"] == 0


def test_persistent_state_unknown_without_existing_file(tmp_path, monkeypatch, capsys):
    store, *_ = configured(tmp_path, monkeypatch)
    approve(monkeypatch)
    store.path.unlink()
    code, result = run(capsys)
    assert code == 2
    assert result["reason_codes"] == ["PERSISTENT_SOURCE_STATE_NOT_PROVISIONED"]


def test_zero_trust_root_never_considered_production_deployment(tmp_path, monkeypatch):
    from spe_runtime.failure_genome.event_journal import SourceEventJournal
    root = SourceEventJournal({SOURCE: AUTHORITY})
    verdict = inspect_source_operation(
        source=AUTHORITY,
        journal=root,
        expected_allowlist_sha256="a" * 64,
        signed_receipt=None,
        owner_pinned_floor=None,
        trusted_checkpoint_keys=None,
        now=datetime.now(timezone.utc),
        owner_source_approval=True,
        durable_host_operator_attestation=True,
    )
    assert verdict.status == "HOLD"
    assert "SIGNED_CHECKPOINT_MISSING" in verdict.reason_codes
    assert "INDEPENDENT_OWNER_TRUST_KEYS_MISSING" in verdict.reason_codes
    assert verdict.network_calls == 0
    assert not verdict.production_monitoring_authorized
