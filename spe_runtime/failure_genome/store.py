"""Persistent store, sanitization, poisoning resistance, and clustering for Failure Genome Ω."""

from __future__ import annotations

import json
import re
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .models import FailureClass, FailureGenomeEntry, Severity
from spe_runtime.counterexample_minimizer.minimizer import (
    DeltaDebuggingResult,
    minimize_counterexample,
)


class PoisoningDetectionError(Exception):
    """Raised when an ingested failure matches adversarial poisoning signatures."""


def sanitize_text(text: str) -> str:
    # Redact API keys, tokens, emails, IPs, SSNs
    text = re.sub(r"(?i)(sk-[a-zA-Z0-9]{20,})", "[REDACTED_API_KEY]", text)
    text = re.sub(r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_SSN]", text)
    text = re.sub(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "[REDACTED_EMAIL]", text)
    text = re.sub(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b", "[REDACTED_IP]", text)
    return text


class FailureGenomeStore:
    def __init__(self, storage_dir: Path | str = ".spe/genome") -> None:
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.entries_file = self.storage_dir / "genome_entries.jsonl"
        self._counter = 1
        self._entries: dict[str, FailureGenomeEntry] = {}
        self._load()

    def generate_next_id(self) -> str:
        year = datetime.now(timezone.utc).year
        fid = f"SPE-FG-{year}-{self._counter:06d}"
        self._counter += 1
        return fid

    def ingest(self, entry_data: dict[str, Any], caller_has_consent: bool = True) -> FailureGenomeEntry:
        # Poisoning resistance validation
        reproducer = entry_data.get("minimal_reproducer", "")
        if len(reproducer.strip()) < 3:
            raise PoisoningDetectionError("Minimal reproducer is too short or empty.")
        if len(reproducer) > 50000:
            raise PoisoningDetectionError("Reproducer payload exceeds maximum allowable length (potential DoS poisoning).")

        fid = entry_data.get("failure_id") or self.generate_next_id()
        now = datetime.now(timezone.utc).isoformat()

        entry = FailureGenomeEntry(
            failure_id=fid,
            scope=entry_data.get("scope", "PRIVATE"),
            source=entry_data.get("source", "community_submission"),
            consent=caller_has_consent,
            model=entry_data["model"],
            model_version=entry_data.get("model_version", "unknown"),
            prompt_digest=entry_data.get("prompt_digest", ""),
            protected_intent_digest=entry_data.get("protected_intent_digest", ""),
            minimal_reproducer=reproducer,
            failure_class=FailureClass(entry_data["failure_class"]),
            severity=Severity(entry_data["severity"]),
            affected_capability=entry_data["affected_capability"],
            observations=entry_data.get("observations", []),
            reproduction_count=1,
            root_cause=entry_data.get("root_cause", "Pending causal analysis"),
            candidate_repairs=entry_data.get("candidate_repairs", []),
            regression_tests=entry_data.get("regression_tests", []),
            first_seen=entry_data.get("first_seen", now),
            last_seen=now,
            owasp_mapping=entry_data.get("owasp_mapping"),
            mitre_atlas_mapping=entry_data.get("mitre_atlas_mapping"),
            cwe_mapping=entry_data.get("cwe_mapping"),
            cve_id=entry_data.get("cve_id"),  # Only genuine CVE
            is_verified_by_reproduction=False,
            metadata=entry_data.get("metadata", {}),
        )

        self._entries[fid] = entry
        self._append_to_file(entry)
        return entry

    def reproduce(self, failure_id: str, runner_fn: Callable[[str], str], oracle_predicate: Callable[[str], bool]) -> bool:
        entry = self._entries.get(failure_id)
        if not entry:
            raise KeyError(f"Failure {failure_id} not found")

        output = runner_fn(entry.minimal_reproducer)
        failed_as_expected = oracle_predicate(output)
        if failed_as_expected:
            entry.reproduction_count += 1
            entry.is_verified_by_reproduction = True
            entry.last_seen = datetime.now(timezone.utc).isoformat()
            self._rewrite_file()
            return True
        return False

    def sanitize_for_public(self, failure_id: str) -> dict[str, Any]:
        entry = self._entries.get(failure_id)
        if not entry:
            raise KeyError(f"Failure {failure_id} not found")

        if not entry.consent:
            raise PermissionError("Consent required for public export")

        public_record = asdict(entry)
        public_record["source"] = "[ANONYMIZED_SOURCE]"
        public_record["minimal_reproducer"] = sanitize_text(entry.minimal_reproducer)
        public_record["observations"] = [sanitize_text(o) for o in entry.observations]
        public_record["metadata"] = {}
        return public_record

    def cluster_failures(self) -> dict[str, list[str]]:
        clusters: dict[str, list[str]] = {}
        for fid, entry in self._entries.items():
            key = f"{entry.failure_class.value}::{entry.affected_capability}"
            clusters.setdefault(key, []).append(fid)
        return clusters

    def deduplicate(self) -> list[str]:
        """Find and consolidate duplicate failure records by model, failure class, and reproducer hash/text.
        Returns list of pruned duplicate IDs.
        """
        seen: dict[tuple[str, str, str], str] = {}
        pruned_ids: list[str] = []

        for fid, entry in list(self._entries.items()):
            # Canonical signature: model, failure_class, and normalized reproducer
            norm_reproducer = re.sub(r"\s+", " ", entry.minimal_reproducer.strip())
            key = (entry.model, entry.failure_class.value, norm_reproducer)
            if key in seen:
                canonical_id = seen[key]
                canonical_entry = self._entries[canonical_id]
                canonical_entry.reproduction_count += entry.reproduction_count
                if entry.last_seen > canonical_entry.last_seen:
                    canonical_entry.last_seen = entry.last_seen
                if entry.is_verified_by_reproduction:
                    canonical_entry.is_verified_by_reproduction = True
                del self._entries[fid]
                pruned_ids.append(fid)
            else:
                seen[key] = fid

        if pruned_ids:
            self._rewrite_file()
        return pruned_ids

    def minimize_entry(
        self,
        failure_id: str,
        predicate_fn: Callable[[dict[str, Any]], bool],
    ) -> DeltaDebuggingResult:
        """Apply hierarchical delta-debugging to reduce the reproducer payload."""
        entry = self._entries.get(failure_id)
        if not entry:
            raise KeyError(f"Failure {failure_id} not found")

        # Represent reproducer as structured clauses if simple string
        lines = [line.strip() for line in entry.minimal_reproducer.splitlines() if line.strip()]
        test_case = {
            "clauses": lines if lines else [entry.minimal_reproducer],
            "tools": entry.metadata.get("tools", []),
            "few_shot_examples": entry.metadata.get("examples", []),
            "context": entry.observations,
        }

        result = minimize_counterexample(test_case, predicate_fn)
        min_clauses = result.minimal_reproducer.get("clauses", [])
        entry.minimal_reproducer = "\n".join(min_clauses) if min_clauses else entry.minimal_reproducer
        self._rewrite_file()
        return result

    def check_holdout_contamination(
        self,
        holdout_tasks: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Verify that no genome failure reproducers contaminate held-out benchmark tasks."""
        contaminations: list[dict[str, Any]] = []
        for fid, entry in self._entries.items():
            rep_clean = entry.minimal_reproducer.lower().strip()
            for task in holdout_tasks:
                task_prompt = task.get("prompt", "").lower().strip()
                task_id = task.get("id", "unknown_task")
                if task_prompt and (task_prompt in rep_clean or rep_clean in task_prompt):
                    contaminations.append({
                        "failure_id": fid,
                        "task_id": task_id,
                        "reason": "Exact or substring match between reproducer and held-out task",
                    })
        return contaminations

    def _append_to_file(self, entry: FailureGenomeEntry) -> None:
        row = asdict(entry)
        row["failure_class"] = entry.failure_class.value
        row["severity"] = entry.severity.value
        with self.entries_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row) + "\n")

    def _rewrite_file(self) -> None:
        with self.entries_file.open("w", encoding="utf-8") as f:
            for entry in self._entries.values():
                row = asdict(entry)
                row["failure_class"] = entry.failure_class.value
                row["severity"] = entry.severity.value
                f.write(json.dumps(row) + "\n")

    def _load(self) -> None:
        if not self.entries_file.exists():
            return
        with self.entries_file.open("r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                d = json.loads(line)
                d["failure_class"] = FailureClass(d["failure_class"])
                d["severity"] = Severity(d["severity"])
                entry = FailureGenomeEntry(**d)
                self._entries[entry.failure_id] = entry
                # Track max counter
                m = re.match(r"SPE-FG-\d{4}-(\d+)", entry.failure_id)
                if m:
                    val = int(m.group(1))
                    if val >= self._counter:
                        self._counter = val + 1
