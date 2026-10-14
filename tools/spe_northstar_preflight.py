#!/usr/bin/env python3
"""R21 local operator preflight — NO NETWORK, NO SECRETS PRINTED, NO PUBLISH.

An owner can inspect custody evidence without enabling a feed. Even success
means ONLY local checks passed and separate human/owner release review remains
mandatory. Source, trust root, signed checkpoint and high-watermark are NOT
downloaded, minted or self-enrolled here.

Input files must be locally owner-approved private files. Their mere presence
on the same machine is *not proof* of independent trust-domain custody.
"""
from __future__ import annotations

import argparse
import json
import os
import stat
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from spe_runtime.ci_gate.receipt import AuthenticatedReceipt
from spe_runtime.failure_genome.checkpoint_review import OwnerPinnedFloor
from spe_runtime.failure_genome.durable_journal import DurableJournalStore, JournalCustodyError
from spe_runtime.failure_genome.event_journal import SourceAuthority
from spe_runtime.failure_genome.operational_readiness import inspect_source_operation
from tools.spe_public_incident_watch import OFFICIAL_FEEDS

_MAX_INPUT_BYTES = 32768


class OperatorInputError(Exception):
    pass


def _read_private_json(path_text: str) -> object:
    path = Path(path_text)
    if not path.is_absolute():
        raise OperatorInputError("OWNER_EVIDENCE_FILE_NOT_ABSOLUTE")
    try:
        parent_stat = path.parent.lstat()
        inode = path.lstat()
    except OSError as exc:
        raise OperatorInputError("OWNER_EVIDENCE_FILE_UNAVAILABLE") from exc
    if (
        not stat.S_ISDIR(parent_stat.st_mode)
        or parent_stat.st_mode & 0o022
        or not stat.S_ISREG(inode.st_mode)
        or inode.st_nlink != 1
        or inode.st_mode & 0o077
    ):
        raise OperatorInputError("OWNER_EVIDENCE_FILE_UNSAFE")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0)
    try:
        fd = os.open(path, flags)
        with os.fdopen(fd, "rb") as src:
            opened = os.fstat(src.fileno())
            if (
                not stat.S_ISREG(opened.st_mode)
                or opened.st_nlink != 1
                or opened.st_mode & 0o077
                or opened.st_ino != inode.st_ino
                or opened.st_dev != inode.st_dev
            ):
                raise OperatorInputError("OWNER_EVIDENCE_FILE_RACED")
            body = src.read(_MAX_INPUT_BYTES + 1)
    except OSError as exc:
        raise OperatorInputError("OWNER_EVIDENCE_FILE_READ_FAILED") from exc
    if len(body) > _MAX_INPUT_BYTES:
        raise OperatorInputError("OWNER_EVIDENCE_FILE_TOO_LARGE")
    try:
        return json.loads(body.decode("utf-8"))
    except (ValueError, UnicodeError) as exc:
        raise OperatorInputError("OWNER_EVIDENCE_JSON_INVALID") from exc


def _exact_dataclass(data: object, klass):
    if not isinstance(data, dict) or set(data) != set(klass.__dataclass_fields__):
        raise OperatorInputError("OWNER_EVIDENCE_SCHEMA_INVALID")
    try:
        return klass(**data)
    except (ValueError, TypeError) as exc:
        raise OperatorInputError("OWNER_EVIDENCE_SCHEMA_INVALID") from exc


def _hold(source: str, code: str) -> int:
    print(json.dumps({
        "status": "HOLD",
        "source_id": source,
        "reason_codes": [code],
        "network_calls": 0,
        "production_monitoring_authorized": False,
        "public_incident_publication_authorized": False,
        "independent_owner_trust_proven": False,
    }, sort_keys=True))
    return 2


def main() -> int:
    parser = argparse.ArgumentParser(description="SPE incident observer safety preflight (NO NETWORK)")
    parser.add_argument("--source", choices=tuple(OFFICIAL_FEEDS), default="claude-status")
    parser.add_argument("--state-file", default="")
    parser.add_argument("--owner-receipt-file", default="")
    parser.add_argument("--owner-trust-keys-file", default="")
    parser.add_argument("--owner-floor-file", default="")
    opts = parser.parse_args()
    source = opts.source
    cfg = OFFICIAL_FEEDS[source]
    required = (
        opts.state_file,
        opts.owner_receipt_file,
        opts.owner_trust_keys_file,
        opts.owner_floor_file,
    )
    if not all(required):
        return _hold(source, "OPERATOR_CUSTODY_FILES_NOT_PROVIDED")
    if any(not Path(p).is_absolute() for p in required):
        return _hold(source, "OPERATOR_CUSTODY_PATH_NOT_ABSOLUTE")
    if len({os.path.realpath(p) for p in required}) != len(required):
        return _hold(source, "OPERATOR_CUSTODY_FILE_NAMESPACE_COLLISION")
    owner_approved = (
        os.environ.get("SPE_PUBLIC_INCIDENT_WATCH_ENABLED") == "true"
        and os.environ.get("SPE_PUBLIC_INCIDENT_OWNER_APPROVED") == "true"
        and (cfg["approval_env"] is None or os.environ.get(cfg["approval_env"]) == "true")
    )
    host_attestation = os.environ.get("SPE_NORTHSTAR_PERSISTENT_HOST_OWNER_REVIEWED") == "true"
    try:
        if not Path(opts.state_file).is_file():
            return _hold(source, "PERSISTENT_SOURCE_STATE_NOT_PROVISIONED")
        receipt = _exact_dataclass(_read_private_json(opts.owner_receipt_file), AuthenticatedReceipt)
        floor = _exact_dataclass(_read_private_json(opts.owner_floor_file), OwnerPinnedFloor)
        keys = _read_private_json(opts.owner_trust_keys_file)
        if not isinstance(keys, dict) or not keys or len(keys) > 12 or any(
            not isinstance(k, str) or not isinstance(v, str)
            for k, v in keys.items()
        ):
            raise OperatorInputError("TRUST_KEY_REGISTRY_INVALID")
        authority = SourceAuthority(source, cfg["hostname"], "/api/v2/incidents.json")
        store = DurableJournalStore(Path(opts.state_file), {source: authority})
        with store.session() as journal:
            decision = inspect_source_operation(
                source=authority,
                journal=journal,
                expected_allowlist_sha256=store.allowlist_sha256,
                signed_receipt=receipt,
                owner_pinned_floor=floor,
                trusted_checkpoint_keys=keys,
                now=datetime.now(timezone.utc),
                owner_source_approval=owner_approved,
                durable_host_operator_attestation=host_attestation,
            )
    except OperatorInputError as exc:
        return _hold(source, str(exc))
    except JournalCustodyError:
        return _hold(source, "PERSISTENT_SOURCE_STATE_REJECTED")
    except (TypeError, ValueError, AttributeError):
        return _hold(source, "OWNER_EVIDENCE_VALIDATION_FAILED")

    # No signer IDs, paths, key bytes, raw source content or exception strings.
    print(json.dumps({
        "status": decision.status,
        "source_id": source,
        "reason_codes": list(decision.reason_codes),
        "durable_record_count": decision.durable_record_count,
        "local_journal_integrity_valid": decision.local_journal_integrity_valid,
        "cryptographic_checkpoint_locally_verified": decision.cryptographic_checkpoint_locally_verified,
        "independent_owner_trust_proven": False,
        "monotonic_floor_proven_independently": False,
        "network_calls": decision.network_calls,
        "production_monitoring_authorized": decision.production_monitoring_authorized,
        "public_incident_publication_authorized": decision.public_incident_publication_authorized,
    }, sort_keys=True))
    # A local check can exit 0 to make a scoped diagnostic usable in CI,
    # but ZERO production network/release authority is ever returned.
    return 0 if decision.status == "LOCAL_CUSTODY_CHECKS_PASS_OWNER_REVIEW_REQUIRED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
