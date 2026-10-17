"""
SPE Ω — Counterfactual Specification Closure (CSC) Counterexample Library.
Mechanism A: Codifies assurance blind spots and exposed failure modes into
reusable, deduplicated testing assets with RFC 8785 canonical hashing.
"""

from __future__ import annotations

import hashlib
from typing import Dict, List, Optional, Any
from .models import CounterexampleRecord
from spe_runtime.ci_gate.receipt import rfc8785_canonicalize


class CounterexampleLibrary:
    """
    Reusable Counterexample Library (Mechanism A).
    Maintains an immutable, RFC 8785 canonical repository of exposed counterexamples,
    preventing regression and enabling zero-token proactive challenge in future tasks.
    """

    def __init__(self):
        # Maps canonical_hash -> CounterexampleRecord
        self._records: Dict[str, CounterexampleRecord] = {}
        # Tracks frequency of occurrences
        self._encounter_counts: Dict[str, int] = {}

    def register(self, record: CounterexampleRecord) -> bool:
        """
        Registers a counterexample record into the library.
        Validates canonical hash if provided, otherwise computes RFC 8785 canonical hash.
        Returns True if newly added, False if deduplicated (already present).
        """
        computed_h = record.compute_canonical_hash()
        if record.canonical_hash and record.canonical_hash != computed_h:
            raise ValueError(
                f"Forged or invalid canonical_hash: {record.canonical_hash} != {computed_h}"
            )
        canonical_h = computed_h

        if canonical_h in self._records:
            # Deduplicate: increment encounter count without duplicate storage
            self._encounter_counts[canonical_h] = self._encounter_counts.get(canonical_h, 1) + 1
            return False

        # Store with resolved canonical hash
        final_record = CounterexampleRecord(
            record_id=record.record_id,
            obligation_ref=record.obligation_ref,
            evidence_snapshot_hash=record.evidence_snapshot_hash,
            bad_world_id=record.bad_world_id,
            bad_world_description=record.bad_world_description,
            distinguishing_probe_id=record.distinguishing_probe_id,
            distinguishing_probe_operation=record.distinguishing_probe_operation,
            applicability_boundaries=record.applicability_boundaries,
            canonical_hash=canonical_h,
            provenance_hash=record.provenance_hash,
        )

        self._records[canonical_h] = final_record
        self._encounter_counts[canonical_h] = 1
        return True

    def get(self, canonical_hash: str) -> Optional[CounterexampleRecord]:
        """Retrieves a counterexample by its RFC 8785 canonical hash."""
        return self._records.get(canonical_hash)

    def lookup_for_obligation(self, obligation_ref: str) -> List[CounterexampleRecord]:
        """Returns all counterexamples targeting a specific obligation."""
        return [r for r in self._records.values() if r.obligation_ref == obligation_ref]

    def lookup_applicable(
        self,
        obligation_ref: str,
        context: Dict[str, Any],
    ) -> List[CounterexampleRecord]:
        """
        Returns all counterexamples for an obligation whose applicability boundaries
        match the current execution context.
        """
        applicable = []
        for r in self.lookup_for_obligation(obligation_ref):
            if r.matches_context(context):
                applicable.append(r)
        return applicable

    def get_encounter_count(self, canonical_hash: str) -> int:
        """Returns the number of times a counterexample has been encountered/registered."""
        return self._encounter_counts.get(canonical_hash, 0)

    def count(self) -> int:
        """Total number of unique counterexamples stored."""
        return len(self._records)

    def clear(self) -> None:
        """Clears all records."""
        self._records.clear()
        self._encounter_counts.clear()

    def all_records(self) -> List[CounterexampleRecord]:
        """Returns a list of all stored records."""
        return list(self._records.values())

    def export_manifest(self) -> Dict[str, Any]:
        """
        Exports the entire library as an RFC 8785 canonical manifest.
        """
        sorted_records = []
        for h in sorted(self._records.keys()):
            r = self._records[h]
            sorted_records.append({
                "canonical_hash": h,
                "encounter_count": self._encounter_counts.get(h, 1),
                "obligation_ref": r.obligation_ref,
                "record_id": r.record_id,
                "bad_world_id": r.bad_world_id,
                "distinguishing_probe_id": r.distinguishing_probe_id,
                "distinguishing_probe_operation": r.distinguishing_probe_operation,
                "evidence_snapshot_hash": r.evidence_snapshot_hash,
                "applicability_boundaries": r.applicability_boundaries,
                "provenance_hash": r.provenance_hash,
            })

        manifest = {
            "version": "spe.csc.counterexample_manifest.v1",
            "record_count": len(sorted_records),
            "records": sorted_records,
        }
        manifest_bytes = rfc8785_canonicalize(manifest)
        manifest_digest = hashlib.sha256(manifest_bytes).hexdigest()
        manifest["manifest_sha256"] = manifest_digest
        return manifest
