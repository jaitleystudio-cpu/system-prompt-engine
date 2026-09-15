"""WRITE_LOCAL_TEMP_FILE — isolated local temp-file fixture (no network).

Tool success is NOT VERIFIED_SUCCESS. Digest proves bytes written locally.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from spe_runtime.xcat.reasons import ReasonCode


@dataclass(frozen=True)
class LocalTempFileResult:
    status: str  # WRITTEN | REJECTED
    path: str | None
    content_digest: str | None
    network_used: bool
    verified_success: bool  # always False — tool OK != VERIFIED_SUCCESS
    reason_codes: tuple[str, ...]


def write_local_temp_file(
    *,
    intent: Any,
    content: bytes,
    directory: str | None = None,
) -> LocalTempFileResult:
    """Write bytes under a local temp directory. Never uses network."""
    if getattr(intent, "action_type", None) != "WRITE_LOCAL_TEMP_FILE":
        return LocalTempFileResult(
            status="REJECTED",
            path=None,
            content_digest=None,
            network_used=False,
            verified_success=False,
            reason_codes=(ReasonCode.SCOPE_MISMATCH.value,),
        )

    args = dict(getattr(intent, "canonical_arguments", {}) or {})
    filename = str(args.get("filename", "spe-s3.txt"))
    # Prevent path traversal
    filename = Path(filename).name

    if directory is not None:
        base = Path(directory)
        base.mkdir(parents=True, exist_ok=True)
        path = base / filename
    else:
        tmpdir = tempfile.mkdtemp(prefix="spe-s3-")
        path = Path(tmpdir) / filename

    digest = hashlib.sha256(content).hexdigest()
    path.write_bytes(content)

    # Confirm local write; still not VERIFIED_SUCCESS
    written = path.read_bytes()
    if hashlib.sha256(written).hexdigest() != digest:
        return LocalTempFileResult(
            status="REJECTED",
            path=str(path),
            content_digest=digest,
            network_used=False,
            verified_success=False,
            reason_codes=(ReasonCode.TOOL_SUCCESS_TO_OUTCOME.value,),
        )

    # Ensure we did not open any network fd as part of this adapter
    network_used = False

    return LocalTempFileResult(
        status="WRITTEN",
        path=str(path),
        content_digest=digest,
        network_used=network_used,
        verified_success=False,
        reason_codes=(),
    )
