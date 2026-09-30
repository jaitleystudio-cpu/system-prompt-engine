"""spe_runtime.storage — local file ownership for SPE.

DurableJournal: append-only JSONL write-ahead journal with crash-tolerant replay.
ProjectLibrary: private project/artifact revisions on the same JSONL discipline.
"""
from .journal import DurableJournal, JournalError
from .project_library import LibraryError, ProjectLibrary

__all__ = ["DurableJournal", "JournalError", "LibraryError", "ProjectLibrary"]
