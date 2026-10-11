"""Autouse fixture ensuring clean tombstone & owner registries across LVT tests."""

import pytest
from spe_runtime.research.lvt.learning_validator import LearningValidator


@pytest.fixture(autouse=True)
def _clean_lvt_tombstones_and_registries():
    LearningValidator.set_tombstone_store_path(None)
    LearningValidator.clear_owner_registries()
    default_p = LearningValidator._get_tombstone_path()
    if default_p.is_file():
        try:
            default_p.unlink()
        except OSError:
            pass
    yield
    LearningValidator.set_tombstone_store_path(None)
    LearningValidator.clear_owner_registries()
    default_p = LearningValidator._get_tombstone_path()
    if default_p.is_file():
        try:
            default_p.unlink()
        except OSError:
            pass
