"""spe_runtime.storage — K7 durable Ring-1 storage (SPE v2.4.1).

DurableJournal: append-only JSONL write-ahead journal with crash-tolerant replay.
"""
from .journal import DurableJournal, JournalError

__all__ = ["DurableJournal", "JournalError"]
