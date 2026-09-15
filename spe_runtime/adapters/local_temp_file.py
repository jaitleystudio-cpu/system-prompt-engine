"""WRITE_LOCAL_TEMP_FILE — isolated local temp-file fixture (no network).

Tool success is NOT VERIFIED_SUCCESS. Digest proves bytes written locally.
Writes are confined to an explicit sandbox root (no ../ symlink escape).
"""

from __future__ import annotations

import hashlib
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from spe_runtime.execution.effect_ledger import EffectLedger
from spe_runtime.xcat.reasons import ReasonCode


@dataclass(frozen=True)
class LocalTempFileResult:
    status: str  # WRITTEN | REJECTED
    path: str | None
    content_digest: str | None
    network_used: bool
    verified_success: bool  # always False — tool OK != VERIFIED_SUCCESS
    reason_codes: tuple[str, ...]


def _safe_filename(raw: str) -> str | None:
    """Basename only; reject empty, dots, and alt-separator traversal remnants."""
    # Normalize alt separators before taking name
    cleaned = str(raw).replace("\\", "/").replace("\x00", "")
    name = Path(cleaned).name
    if not name or name in (".", ".."):
        return None
    if "/" in name or "\\" in name:
        return None
    return name


def _confine(path: Path, root: Path) -> bool:
    """True iff resolved path is root or a descendant of root."""
    try:
        resolved = path.resolve()
        root_resolved = root.resolve()
        return resolved == root_resolved or resolved.is_relative_to(root_resolved)
    except (OSError, ValueError):
        return False


def write_local_temp_file(
    *,
    intent: Any,
    content: bytes,
    directory: str | None = None,
    sandbox_root: str | None = None,
    effect_ledger: EffectLedger | None = None,
) -> LocalTempFileResult:
    """Write bytes under a confined local sandbox. Never uses network."""
    if getattr(intent, "action_type", None) != "WRITE_LOCAL_TEMP_FILE":
        return LocalTempFileResult(
            status="REJECTED",
            path=None,
            content_digest=None,
            network_used=False,
            verified_success=False,
            reason_codes=(ReasonCode.SCOPE_MISMATCH.value,),
        )

    op_id = getattr(intent, "operation_id", None)
    if effect_ledger is not None:
        if not op_id or effect_ledger.already_claimed(str(op_id)):
            return LocalTempFileResult(
                status="REJECTED",
                path=None,
                content_digest=None,
                network_used=False,
                verified_success=False,
                reason_codes=(ReasonCode.DUPLICATE_EFFECT.value,),
            )

    args = dict(getattr(intent, "canonical_arguments", {}) or {})
    filename = _safe_filename(str(args.get("filename", "spe-s3.txt")))
    if filename is None:
        return LocalTempFileResult(
            status="REJECTED",
            path=None,
            content_digest=None,
            network_used=False,
            verified_success=False,
            reason_codes=(ReasonCode.SANDBOX_ESCAPE.value,),
        )

    if directory is not None:
        base = Path(directory)
    else:
        base = Path(tempfile.mkdtemp(prefix="spe-s3-"))

    root = Path(sandbox_root) if sandbox_root is not None else base

    try:
        root = root.resolve()
        # Create root first when it is the intended sandbox
        root.mkdir(parents=True, exist_ok=True)
        base_resolved = base.resolve()
    except (OSError, RuntimeError):
        return LocalTempFileResult(
            status="REJECTED",
            path=None,
            content_digest=None,
            network_used=False,
            verified_success=False,
            reason_codes=(ReasonCode.SANDBOX_ESCAPE.value,),
        )

    # directory must resolve inside sandbox_root (blocks ../ and symlink escape)
    if not _confine(base_resolved, root):
        return LocalTempFileResult(
            status="REJECTED",
            path=None,
            content_digest=None,
            network_used=False,
            verified_success=False,
            reason_codes=(ReasonCode.SANDBOX_ESCAPE.value,),
        )

    # Ensure base exists only after confinement check
    try:
        base_resolved.mkdir(parents=True, exist_ok=True)
    except OSError:
        return LocalTempFileResult(
            status="REJECTED",
            path=None,
            content_digest=None,
            network_used=False,
            verified_success=False,
            reason_codes=(ReasonCode.SANDBOX_ESCAPE.value,),
        )

    path = (base_resolved / filename).resolve()
    if not _confine(path, root):
        return LocalTempFileResult(
            status="REJECTED",
            path=None,
            content_digest=None,
            network_used=False,
            verified_success=False,
            reason_codes=(ReasonCode.SANDBOX_ESCAPE.value,),
        )

    digest = hashlib.sha256(content).hexdigest()
    path.write_bytes(content)

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

    if effect_ledger is not None:
        if not effect_ledger.claim(str(op_id)):
            # Lost race / duplicate — do not report success for a second effect
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
            return LocalTempFileResult(
                status="REJECTED",
                path=None,
                content_digest=None,
                network_used=False,
                verified_success=False,
                reason_codes=(ReasonCode.DUPLICATE_EFFECT.value,),
            )

    return LocalTempFileResult(
        status="WRITTEN",
        path=str(path),
        content_digest=digest,
        network_used=False,
        verified_success=False,
        reason_codes=(),
    )
