from __future__ import annotations

from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
CONFORMANCE = REPO / "data" / "conformance"


@pytest.fixture
def conformance_dir() -> Path:
    return CONFORMANCE
