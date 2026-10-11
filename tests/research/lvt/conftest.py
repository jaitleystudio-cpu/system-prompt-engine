"""Pytest fixtures for research LVT test isolation."""
from __future__ import annotations

import pytest
from spe_runtime.research.lvt.learning_validator import LearningValidator


@pytest.fixture(autouse=True)
def _isolate_lvt_test_environment(tmp_path, monkeypatch):
    """Guarantees full test isolation by providing a dedicated tombstone file per test and clearing registries."""
    tombstone_path = tmp_path / "lvt_test_tombstones.jsonl"
    monkeypatch.setenv("SPE_TOMBSTONE_STORE_PATH", str(tombstone_path))
    LearningValidator.clear_owner_registries()
    LearningValidator.set_tombstone_store_path(tombstone_path)
    yield
    LearningValidator.clear_owner_registries()
    LearningValidator.set_tombstone_store_path(None)
