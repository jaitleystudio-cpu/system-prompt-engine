#!/usr/bin/env python3
"""Recompute SHA-256 capability manifests and reject corruption.

The manifest is a hash list. Checking reads the current bytes again.
It does not report success when a hash, path, or file does not match.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Mapping, Sequence

import jsonschema

MANIFEST_SCHEMA_NAME = "spe.capability-manifest.v1"
_SCHEMA_PATH = Path(__file__).resolve().parents[1] / "schemas" / "capability_manifest.schema.json"


class ManifestError(Exception):
    """Manifest refusal. ``code`` is stable."""

    def __init__(self, code: str, reason: str) -> None:
        super().__init__(code + ": " + reason)
        self.code = code
        self.reason = reason


def sha256_hex(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _schema() -> dict:
    return json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))


def _relative_path(value: object) -> str:
    if not isinstance(value, str) or not value or value.startswith(("/", "\\")) or "\\" in value:
        raise ManifestError("CORRUPT_MANIFEST", "path is not relative")
    parts = Path(value).parts
    if not parts or ".." in parts or value.startswith("./"):
        raise ManifestError("CORRUPT_MANIFEST", "path is not relative")
    return value


def build_manifest_from_blobs(blobs: Mapping[str, bytes]) -> dict:
    if not isinstance(blobs, Mapping) or not blobs:
        raise ManifestError("CORRUPT_MANIFEST", "manifest has no entries")
    entries = []
    for rel in sorted(blobs):
        path = _relative_path(rel)
        payload = blobs[rel]
        if not isinstance(payload, bytes):
            raise ManifestError("CORRUPT_MANIFEST", "manifest payload is not bytes")
        entries.append({"path": path, "sha256": sha256_hex(payload)})
    manifest = {
        "schema": MANIFEST_SCHEMA_NAME,
        "algorithm": "SHA-256",
        "entries": entries,
    }
    _require_schema(manifest)
    return manifest


def build_manifest(root: Path, relative_paths: Sequence[str]) -> dict:
    if isinstance(relative_paths, (str, bytes)) or not relative_paths:
        raise ManifestError("CORRUPT_MANIFEST", "manifest has no entries")
    base = Path(root).resolve()
    blobs: dict[str, bytes] = {}
    for rel in relative_paths:
        path = _relative_path(rel)
        full = (base / path).resolve()
        if not full.is_relative_to(base):
            raise ManifestError("CORRUPT_MANIFEST", "path escapes the root")
        if not full.is_file():
            raise ManifestError("MISSING_FILE", "manifest path is missing")
        blobs[path] = full.read_bytes()
    return build_manifest_from_blobs(blobs)


def _require_schema(manifest: Mapping) -> None:
    try:
        jsonschema.validate(manifest, _schema())
    except jsonschema.ValidationError as exc:
        raise ManifestError("CORRUPT_MANIFEST", "manifest schema does not match") from exc


def verify_manifest_blobs(blobs: Mapping[str, bytes], manifest: Mapping) -> dict:
    if not isinstance(manifest, Mapping):
        raise ManifestError("CORRUPT_MANIFEST", "manifest is not an object")
    _require_schema(manifest)
    entries = manifest["entries"]
    claimed: dict[str, str] = {}
    for entry in entries:
        path = _relative_path(entry["path"])
        if path in claimed:
            raise ManifestError("CORRUPT_MANIFEST", "path repeated")
        claimed[path] = entry["sha256"]
    selected: dict[str, bytes] = {}
    for path in claimed:
        if path not in blobs:
            raise ManifestError("MISSING_FILE", "manifest path is missing")
        selected[path] = blobs[path]
    rebuilt = build_manifest_from_blobs(selected)
    for entry in rebuilt["entries"]:
        if claimed[entry["path"]] != entry["sha256"]:
            raise ManifestError("HASH_MISMATCH", "recomputed hash does not match")
    return rebuilt


def verify_manifest(root: Path, manifest: Mapping) -> dict:
    if not isinstance(manifest, Mapping):
        raise ManifestError("CORRUPT_MANIFEST", "manifest is not an object")
    _require_schema(manifest)
    base = Path(root).resolve()
    blobs: dict[str, bytes] = {}
    for entry in manifest["entries"]:
        path = _relative_path(entry["path"])
        full = (base / path).resolve()
        if not full.is_relative_to(base):
            raise ManifestError("CORRUPT_MANIFEST", "path escapes the root")
        if not full.is_file():
            raise ManifestError("MISSING_FILE", "manifest path is missing")
        blobs[path] = full.read_bytes()
    return verify_manifest_blobs(blobs, manifest)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="build_manifest")
    sub = parser.add_subparsers(dest="cmd", required=True)
    build = sub.add_parser("build")
    build.add_argument("--root", required=True)
    build.add_argument("--path", action="append", required=True)
    check = sub.add_parser("check")
    check.add_argument("--root", required=True)
    check.add_argument("--manifest", required=True)
    try:
        args = parser.parse_args(list(sys.argv[1:] if argv is None else argv))
    except SystemExit as exc:
        return int(exc.code) if exc.code else 2
    try:
        if args.cmd == "build":
            manifest = build_manifest(Path(args.root), args.path)
            sys.stdout.write(json.dumps(manifest, sort_keys=True) + "\n")
            return 0
        raw = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
        verify_manifest(Path(args.root), raw)
        return 0
    except ManifestError as exc:
        sys.stderr.write(exc.code + "\n")
        return 1
    except (OSError, json.JSONDecodeError):
        sys.stderr.write("CORRUPT_MANIFEST\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
