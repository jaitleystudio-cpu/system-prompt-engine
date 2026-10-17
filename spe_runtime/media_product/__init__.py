"""Media product path. Separate from the speaker-neutral media IR foundation.

The foundation must not embed an STT engine. This package is the local
session that drives the already pinned whisper-cli.
"""

from spe_runtime.media_product.local_backend import (
    IntegrityError,
    LocalMediaSession,
    discover_qualified_assets,
    local_claim,
    product_gates,
    resolve_media_mode,
    verify_file_sha256,
)

__all__ = [
    "IntegrityError",
    "LocalMediaSession",
    "discover_qualified_assets",
    "local_claim",
    "product_gates",
    "resolve_media_mode",
    "verify_file_sha256",
]
