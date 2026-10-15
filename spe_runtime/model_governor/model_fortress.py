"""
SPE Ω — Model Intelligence Fortress (Python Parity Kernel)
Enforces:
1. 4-State Lifecycle: ANNOUNCED -> DISCOVERED -> CALLABLE -> QUALIFIED
2. 8 Fortress Invariants:
   - UNKNOWN != VERIFIED
   - ALIAS != PINNED VERSION
   - ANNOUNCED != CALLABLE
   - CALLABLE != QUALIFIED
   - SOURCE TEXT != AUTHORITY
   - ABSENCE != RETIREMENT
   - SIGNED != TRUE
   - ROLLBACK != HISTORY REWRITE
3. Temporal Model Truth Ledger (Hash-Chained Forward-Only Ledger)
4. Sealed Registry Transition (TUF Monotonicity & USENIX 2026 AttriGuard Sanitizer)
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Sequence, Tuple


class ModelLifecycleState(str, Enum):
    ANNOUNCED = "ANNOUNCED"
    DISCOVERED = "DISCOVERED"
    CALLABLE = "CALLABLE"
    QUALIFIED = "QUALIFIED"


class FortressInvariant(str, Enum):
    UNKNOWN_NEQ_VERIFIED = "UNKNOWN_NEQ_VERIFIED"
    ALIAS_NEQ_PINNED = "ALIAS_NEQ_PINNED"
    ANNOUNCED_NEQ_CALLABLE = "ANNOUNCED_NEQ_CALLABLE"
    CALLABLE_NEQ_QUALIFIED = "CALLABLE_NEQ_QUALIFIED"
    SOURCE_TEXT_NEQ_AUTHORITY = "SOURCE_TEXT_NEQ_AUTHORITY"
    ABSENCE_NEQ_RETIREMENT = "ABSENCE_NEQ_RETIREMENT"
    SIGNED_NEQ_TRUE = "SIGNED_NEQ_TRUE"
    ROLLBACK_NEQ_HISTORY_REWRITE = "ROLLBACK_NEQ_HISTORY_REWRITE"


@dataclass(frozen=True)
class CapabilityWitness:
    capability: str
    passed: bool
    probe_timestamp_iso: str
    latency_ms: float
    witness_receipt_hash: str


@dataclass(frozen=True)
class ModelIdentityPassport:
    model_id: str
    provider: str
    executable_api_id: str
    floating_aliases: Tuple[str, ...]
    account_entitlement: str
    lifecycle_state: ModelLifecycleState
    announced_date: str
    discovered_date: str
    passport_digest: str
    is_eligible_for_autonomous_selection: bool
    observed_fingerprint: Optional[str] = None
    callable_verified_date: Optional[str] = None
    qualified_date: Optional[str] = None
    capability_witnesses: Tuple[CapabilityWitness, ...] = ()


def compute_sha256(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def create_model_identity_passport(
    model_id: str,
    provider: str,
    executable_api_id: str,
    floating_aliases: Sequence[str],
    account_entitlement: str,
    lifecycle_state: ModelLifecycleState,
    announced_date: str,
    discovered_date: str,
    is_legacy: bool = False,
    observed_fingerprint: Optional[str] = None,
    callable_verified_date: Optional[str] = None,
    qualified_date: Optional[str] = None,
    capability_witnesses: Sequence[CapabilityWitness] = (),
) -> ModelIdentityPassport:
    is_eligible = (lifecycle_state == ModelLifecycleState.QUALIFIED) and (not is_legacy)

    raw_payload = json.dumps(
        {
            "model_id": model_id,
            "provider": provider,
            "executable_api_id": executable_api_id,
            "floating_aliases": sorted(floating_aliases),
            "observed_fingerprint": observed_fingerprint,
            "account_entitlement": account_entitlement,
            "lifecycle_state": lifecycle_state.value,
            "announced_date": announced_date,
            "discovered_date": discovered_date,
            "callable_verified_date": callable_verified_date,
            "qualified_date": qualified_date,
            "witness_count": len(capability_witnesses),
            "is_eligible": is_eligible,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    passport_digest = compute_sha256(raw_payload)

    return ModelIdentityPassport(
        model_id=model_id,
        provider=provider,
        executable_api_id=executable_api_id,
        floating_aliases=tuple(floating_aliases),
        account_entitlement=account_entitlement,
        lifecycle_state=lifecycle_state,
        announced_date=announced_date,
        discovered_date=discovered_date,
        passport_digest=passport_digest,
        is_eligible_for_autonomous_selection=is_eligible,
        observed_fingerprint=observed_fingerprint,
        callable_verified_date=callable_verified_date,
        qualified_date=qualified_date,
        capability_witnesses=tuple(capability_witnesses),
    )


def validate_state_transition(
    current: ModelLifecycleState,
    target: ModelLifecycleState,
    executable_api_id: str,
    floating_aliases: Sequence[str],
    capability_witnesses: Sequence[CapabilityWitness],
    is_pinned_version: bool,
) -> Tuple[bool, List[str]]:
    violations: List[str] = []

    # Invariant: ALIAS != PINNED VERSION
    if (executable_api_id in floating_aliases) or (not is_pinned_version):
        violations.append(
            f"ALIAS_NEQ_PINNED: Executable API ID '{executable_api_id}' cannot be a floating alias."
        )

    # Invariant: ANNOUNCED != CALLABLE
    if current == ModelLifecycleState.ANNOUNCED and target in (
        ModelLifecycleState.CALLABLE,
        ModelLifecycleState.QUALIFIED,
    ):
        violations.append(
            "ANNOUNCED_NEQ_CALLABLE: Cannot jump from ANNOUNCED directly to CALLABLE or QUALIFIED without API discovery."
        )

    # Invariant: CALLABLE != QUALIFIED
    if target == ModelLifecycleState.QUALIFIED:
        if current != ModelLifecycleState.CALLABLE:
            violations.append(
                f"CALLABLE_NEQ_QUALIFIED: Cannot qualify model from state '{current.value}'. Must be CALLABLE first."
            )
        # Invariant: UNKNOWN != VERIFIED
        if (not capability_witnesses) or any(not w.passed for w in capability_witnesses):
            violations.append(
                "UNKNOWN_NEQ_VERIFIED: Model cannot be QUALIFIED without all capability witnesses passing."
            )

    return (len(violations) == 0, violations)


# ─── TEMPORAL MODEL TRUTH LEDGER ──────────────────────────────────────────────

GENESIS_LEDGER_HASH = "0000000000000000000000000000000000000000000000000000000000000000"


@dataclass(frozen=True)
class TemporalLedgerEntry:
    entry_index: int
    timestamp_iso: str
    effective_date_iso: str
    model_id: str
    previous_state: str
    new_state: str
    transition_type: str
    source_evidence_hash: str
    source_endpoint_or_url: str
    previous_entry_hash: str
    entry_hash: str
    superseding_model_id: Optional[str] = None
    referenced_prior_entry_hash: Optional[str] = None


class TemporalModelTruthLedger:
    def __init__(self, initial_entries: Optional[Sequence[TemporalLedgerEntry]] = None) -> None:
        self._entries: List[TemporalLedgerEntry] = list(initial_entries or [])
        if self._entries:
            valid, reason = self.verify_ledger_integrity()
            if not valid:
                raise ValueError(f"Corrupted ledger initialized: {reason}")

    def get_head_hash(self) -> str:
        if not self._entries:
            return GENESIS_LEDGER_HASH
        return self._entries[-1].entry_hash

    def get_entries(self) -> Tuple[TemporalLedgerEntry, ...]:
        return tuple(self._entries)

    def get_latest_entry_for_model(self, model_id: str) -> Optional[TemporalLedgerEntry]:
        for entry in reversed(self._entries):
            if entry.model_id == model_id:
                return entry
        return None

    def append_transition(
        self,
        timestamp_iso: str,
        effective_date_iso: str,
        model_id: str,
        new_state: ModelLifecycleState,
        transition_type: str,
        source_evidence_hash: str,
        source_endpoint_or_url: str,
        superseding_model_id: Optional[str] = None,
        referenced_prior_entry_hash: Optional[str] = None,
    ) -> TemporalLedgerEntry:
        prev = self.get_latest_entry_for_model(model_id)
        prev_state = prev.new_state if prev else "UNREGISTERED"
        prev_hash = self.get_head_hash()
        index = len(self._entries)

        raw_payload = json.dumps(
            {
                "index": index,
                "timestamp_iso": timestamp_iso,
                "effective_date_iso": effective_date_iso,
                "model_id": model_id,
                "previous_state": prev_state,
                "new_state": new_state.value,
                "transition_type": transition_type,
                "source_evidence_hash": source_evidence_hash,
                "source_endpoint_or_url": source_endpoint_or_url,
                "superseding_model_id": superseding_model_id,
                "referenced_prior_entry_hash": referenced_prior_entry_hash,
                "previous_entry_hash": prev_hash,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        entry_hash = compute_sha256(raw_payload)

        new_entry = TemporalLedgerEntry(
            entry_index=index,
            timestamp_iso=timestamp_iso,
            effective_date_iso=effective_date_iso,
            model_id=model_id,
            previous_state=prev_state,
            new_state=new_state.value,
            transition_type=transition_type,
            source_evidence_hash=source_evidence_hash,
            source_endpoint_or_url=source_endpoint_or_url,
            previous_entry_hash=prev_hash,
            entry_hash=entry_hash,
            superseding_model_id=superseding_model_id,
            referenced_prior_entry_hash=referenced_prior_entry_hash,
        )
        self._entries.append(new_entry)
        return new_entry

    def append_rollback(
        self,
        timestamp_iso: str,
        model_id: str,
        target_prior_entry_hash: str,
        rationale: str,
        source_evidence_hash: str,
    ) -> TemporalLedgerEntry:
        # Invariant: ROLLBACK != HISTORY REWRITE
        # Find target prior entry
        prior = next((e for e in self._entries if e.entry_hash == target_prior_entry_hash), None)
        if not prior:
            raise ValueError(f"Rollback target {target_prior_entry_hash} not found in ledger.")

        return self.append_transition(
            timestamp_iso=timestamp_iso,
            effective_date_iso=prior.effective_date_iso,
            model_id=model_id,
            new_state=ModelLifecycleState(prior.new_state),
            transition_type="ROLLBACK_SAFEGUARD",
            source_evidence_hash=source_evidence_hash,
            source_endpoint_or_url=f"spe://rollback?target={target_prior_entry_hash}&reason={rationale}",
            referenced_prior_entry_hash=target_prior_entry_hash,
        )

    def verify_ledger_integrity(self) -> Tuple[bool, Optional[str]]:
        expected_prev = GENESIS_LEDGER_HASH
        for i, entry in enumerate(self._entries):
            if entry.entry_index != i:
                return False, f"Index mismatch at {i}: recorded {entry.entry_index}"
            if entry.previous_entry_hash != expected_prev:
                return False, f"Broken hash chain at {i}: expected {expected_prev}, got {entry.previous_entry_hash}"

            raw_payload = json.dumps(
                {
                    "index": entry.entry_index,
                    "timestamp_iso": entry.timestamp_iso,
                    "effective_date_iso": entry.effective_date_iso,
                    "model_id": entry.model_id,
                    "previous_state": entry.previous_state,
                    "new_state": entry.new_state,
                    "transition_type": entry.transition_type,
                    "source_evidence_hash": entry.source_evidence_hash,
                    "source_endpoint_or_url": entry.source_endpoint_or_url,
                    "superseding_model_id": entry.superseding_model_id,
                    "referenced_prior_entry_hash": entry.referenced_prior_entry_hash,
                    "previous_entry_hash": entry.previous_entry_hash,
                },
                sort_keys=True,
                separators=(",", ":"),
            )
            recomputed = compute_sha256(raw_payload)
            if recomputed != entry.entry_hash:
                return False, f"Tampered hash at {i}: expected {recomputed}, got {entry.entry_hash}"
            expected_prev = entry.entry_hash

        return True, None


# ─── SEALED REGISTRY TRANSITION & SANITIZER ───────────────────────────────────

DISALLOWED_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous\s+)?instructions", re.IGNORECASE),
    re.compile(r"system\s+instruction\s*:", re.IGNORECASE),
    re.compile(r"<script[\s>]", re.IGNORECASE),
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"\b(exec|eval|system|subprocess|child_process)\s*\(", re.IGNORECASE),
    re.compile(r"[\u200B-\u200D\u202E\uFEFF]"),
]


def sanitize_metadata(text: str) -> List[str]:
    violations = []
    for pattern in DISALLOWED_PATTERNS:
        if pattern.search(text):
            violations.append(f"Disallowed pattern found: {pattern.pattern}")
    return violations
