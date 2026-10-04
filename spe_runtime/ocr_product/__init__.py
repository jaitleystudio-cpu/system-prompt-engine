"""Pinned local Tesseract owner. Not a second OCR engine."""

from spe_runtime.ocr_product.local_backend import (
    IntegrityError,
    LocalOcrSession,
    discover_qualified_assets,
    product_verdict,
)

__all__ = [
    "IntegrityError",
    "LocalOcrSession",
    "discover_qualified_assets",
    "product_verdict",
]
