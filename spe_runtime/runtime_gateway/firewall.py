"""Capability Firewall: Deterministic evaluation of agent capability requests."""

from __future__ import annotations

import fnmatch
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from spe_runtime.ci_gate.receipt import ed25519_sign, ed25519_verify, rfc8785_canonicalize
from .models import CapabilityGrant, CapabilityRequest, CapabilityType, Decision, PolicyEvaluationResult


def compute_grant_payload(grant: CapabilityGrant) -> bytes:
    """Canonical RFC 8785 bytes for signing a CapabilityGrant."""
    data = {
        "action_scope": grant.action_scope,
        "amount_budget": grant.amount_budget,
        "approval_identity": grant.approval_identity,
        "capability": grant.capability.value if hasattr(grant.capability, "value") else str(grant.capability),
        "expiration_iso": grant.expiration_iso,
        "grant_id": grant.grant_id,
        "issuer": grant.issuer,
        "nonce": grant.nonce,
        "resource_scope": grant.resource_scope,
    }
    return rfc8785_canonicalize(data)


def sign_grant(grant: CapabilityGrant, signing_key: bytes, public_key: bytes) -> CapabilityGrant:
    """Signs grant using Ed25519 and sets signature on the grant."""
    payload = compute_grant_payload(grant)
    digest = hashlib.sha256(payload).hexdigest()
    sig = ed25519_sign(signing_key, public_key, digest.encode("utf-8")).hex()
    grant.signature = sig
    return grant


class CapabilityFirewall:
    def __init__(
        self,
        storage_dir: Path | str | None = None,
        trusted_roots: dict[str, str] | None = None,
        verify_signatures: bool = True,
    ) -> None:
        self.storage_dir = Path(storage_dir) if storage_dir else None
        self.verify_signatures = verify_signatures
        self.trusted_roots: dict[str, str] = dict(trusted_roots or {})
        self.grants: dict[str, CapabilityGrant] = {}
        self.revoked_grant_ids: set[str] = set()
        self.used_grant_nonces: set[str] = set()
        self.used_request_nonces: set[str] = set()
        self.active_reservations: dict[str, tuple[str, float]] = {}  # reservation_id -> (grant_id, amount)

        if self.storage_dir:
            self.storage_dir.mkdir(parents=True, exist_ok=True)
            self._load_durable_state()

    def register_trust_root(self, issuer: str, public_key_hex: str) -> None:
        """Registers an authorized Ed25519 trust root for a grant issuer."""
        self.trusted_roots[issuer] = public_key_hex

    def _load_durable_state(self) -> None:
        if not self.storage_dir:
            return
        # 1. Nonces
        nonce_file = self.storage_dir / "consumed_nonces.jsonl"
        if nonce_file.exists():
            with nonce_file.open("r", encoding="utf-8") as f:
                for line in f:
                    if not line.strip():
                        continue
                    rec = json.loads(line)
                    if rec.get("kind") == "grant":
                        self.used_grant_nonces.add(rec["nonce"])
                    elif rec.get("kind") == "request":
                        self.used_request_nonces.add(rec["nonce"])

        # 2. Revocations
        rev_file = self.storage_dir / "revocations.jsonl"
        if rev_file.exists():
            with rev_file.open("r", encoding="utf-8") as f:
                for line in f:
                    if not line.strip():
                        continue
                    rec = json.loads(line)
                    self.revoked_grant_ids.add(rec["grant_id"])

        # 3. Budget Reservations
        res_file = self.storage_dir / "budget_reservations.jsonl"
        if res_file.exists():
            with res_file.open("r", encoding="utf-8") as f:
                for line in f:
                    if not line.strip():
                        continue
                    rec = json.loads(line)
                    res_id = rec["reservation_id"]
                    status = rec["status"]
                    if status == "RESERVED":
                        self.active_reservations[res_id] = (rec["grant_id"], rec["amount"])
                    elif status in ("COMMITTED", "ROLLED_BACK"):
                        self.active_reservations.pop(res_id, None)

    def _persist_nonce(self, kind: str, nonce: str) -> None:
        if not self.storage_dir:
            return
        nonce_file = self.storage_dir / "consumed_nonces.jsonl"
        with nonce_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"kind": kind, "nonce": nonce, "timestamp": datetime.now(timezone.utc).isoformat()}) + "\n")
            f.flush()
            os.fsync(f.fileno())

    def _persist_revocation(self, grant_id: str) -> None:
        if not self.storage_dir:
            return
        rev_file = self.storage_dir / "revocations.jsonl"
        with rev_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"grant_id": grant_id, "timestamp": datetime.now(timezone.utc).isoformat()}) + "\n")
            f.flush()
            os.fsync(f.fileno())

    def _persist_reservation(self, reservation_id: str, grant_id: str, amount: float, status: str) -> None:
        if not self.storage_dir:
            return
        res_file = self.storage_dir / "budget_reservations.jsonl"
        with res_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps({
                "reservation_id": reservation_id,
                "grant_id": grant_id,
                "amount": amount,
                "status": status,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }) + "\n")
            f.flush()
            os.fsync(f.fileno())

    def install_grant(self, grant: CapabilityGrant, installer_id: str | None = None) -> None:
        # Check revocation
        if grant.grant_id in self.revoked_grant_ids:
            raise ValueError(f"Grant '{grant.grant_id}' has been revoked and cannot be reinstalled.")

        # Prevent replay attacks on grant installation
        if grant.nonce in self.used_grant_nonces:
            raise ValueError(f"Replay attack detected: grant nonce '{grant.nonce}' already consumed.")

        # Prevent self-grant attacks by agents
        if installer_id and (installer_id == grant.issuer or installer_id == grant.approval_identity):
            raise PermissionError("Self-granting capability authority is strictly prohibited.")

        # Cryptographic Ed25519 signature verification against authorized trust root
        if self.verify_signatures:
            if not self.trusted_roots:
                raise PermissionError("No authorized trust roots registered in CapabilityFirewall.")
            if grant.issuer not in self.trusted_roots:
                raise PermissionError(f"Untrusted grant issuer '{grant.issuer}': not in authorized trust roots.")

            pk_hex = self.trusted_roots[grant.issuer]
            try:
                pk_bytes = bytes.fromhex(pk_hex)
                sig_bytes = bytes.fromhex(grant.signature)
                payload = compute_grant_payload(grant)
                digest = hashlib.sha256(payload).hexdigest()
                if not ed25519_verify(pk_bytes, digest.encode("utf-8"), sig_bytes):
                    raise ValueError("Cryptographic signature verification failed: invalid grant signature.")
            except Exception as e:
                if isinstance(e, ValueError):
                    raise
                raise ValueError(f"Cryptographic signature verification failed: {str(e)}") from e

        self.used_grant_nonces.add(grant.nonce)
        self._persist_nonce("grant", grant.nonce)
        self.grants[grant.grant_id] = grant

    def revoke_grant(self, grant_id: str) -> bool:
        removed = self.grants.pop(grant_id, None) is not None
        self.revoked_grant_ids.add(grant_id)
        self._persist_revocation(grant_id)
        return removed

    def evaluate_request(self, req: CapabilityRequest) -> PolicyEvaluationResult:
        """Evaluates capability requests strictly independent of LLM content.
        Model output alone can NEVER grant itself authority.
        """
        # Request nonce replay defense
        if req.nonce:
            if req.nonce in self.used_request_nonces:
                return PolicyEvaluationResult(
                    decision=Decision.DENY,
                    reason=f"Replay attack detected: request nonce '{req.nonce}' already consumed.",
                )
            self.used_request_nonces.add(req.nonce)
            self._persist_nonce("request", req.nonce)

        now = datetime.now(timezone.utc)

        # Find matching grants
        matching_grants: list[CapabilityGrant] = []
        for g in self.grants.values():
            if g.capability != req.capability:
                continue
            # Check expiration with timezone-aware datetime parsing
            if g.expiration_iso:
                exp_str = g.expiration_iso.strip()
                if exp_str.endswith("Z"):
                    exp_str = exp_str[:-1] + "+00:00"
                try:
                    exp_dt = datetime.fromisoformat(exp_str)
                    if exp_dt.tzinfo is None:
                        exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                    if exp_dt < now:
                        continue
                except Exception:
                    # Malformed expiration fails closed
                    continue

            # Self-grant defense: agent cannot evaluate against a grant where agent is issuer or approver
            if req.agent_id and (req.agent_id == g.issuer or req.agent_id == g.approval_identity):
                continue
            # Check resource scope pattern
            if not fnmatch.fnmatch(req.target_resource, g.resource_scope):
                continue
            # Check action scope
            if g.action_scope != "*" and req.action not in g.action_scope.split(","):
                continue
            matching_grants.append(g)

        if not matching_grants:
            return PolicyEvaluationResult(
                decision=Decision.DENY,
                reason=f"No active CapabilityGrant found for {req.capability.value} on resource '{req.target_resource}'.",
            )

        # Evaluate matching grants
        for g in matching_grants:
            # 1. Check budget sufficiency
            if g.amount_budget is not None and g.remaining_budget is not None:
                if g.remaining_budget < req.amount:
                    return PolicyEvaluationResult(
                        decision=Decision.REQUIRES_APPROVAL,
                        reason=f"Operation amount {req.amount} exceeds remaining grant budget {g.remaining_budget}.",
                        matched_grant_id=g.grant_id,
                        remaining_budget=g.remaining_budget,
                    )

            # 2. High risk capabilities require explicit human approval unless specifically permitted
            # IMPORTANT: High risk check occurs BEFORE debiting budget!
            if req.capability in (CapabilityType.PRODUCTION_CHANGE, CapabilityType.DEPLOY, CapabilityType.PAYMENT):
                if "auto_approved" not in g.action_scope:
                    return PolicyEvaluationResult(
                        decision=Decision.REQUIRES_APPROVAL,
                        reason=f"High-impact capability {req.capability.value} requires human approval.",
                        matched_grant_id=g.grant_id,
                        remaining_budget=g.remaining_budget,
                    )

            # 3. Only decrement budget on ALLOW
            if g.amount_budget is not None and g.remaining_budget is not None:
                g.remaining_budget -= req.amount

            return PolicyEvaluationResult(
                decision=Decision.ALLOW,
                reason=f"Authorized under grant {g.grant_id} by issuer {g.issuer}.",
                matched_grant_id=g.grant_id,
                remaining_budget=g.remaining_budget,
            )

        return PolicyEvaluationResult(decision=Decision.DENY, reason="Capability grant rejected.")

    def reserve_budget(self, grant_id: str, amount: float, reservation_id: str) -> bool:
        """Reserves budget in a 2-phase commit model without final debit."""
        g = self.grants.get(grant_id)
        if not g or g.remaining_budget is None:
            return False
        if g.remaining_budget < amount:
            return False
        g.remaining_budget -= amount
        self.active_reservations[reservation_id] = (grant_id, amount)
        self._persist_reservation(reservation_id, grant_id, amount, "RESERVED")
        return True

    def commit_budget(self, reservation_id: str) -> bool:
        """Commits previously reserved budget upon confirmed execution."""
        if reservation_id not in self.active_reservations:
            return False
        grant_id, amount = self.active_reservations.pop(reservation_id)
        self._persist_reservation(reservation_id, grant_id, amount, "COMMITTED")
        return True

    def rollback_budget(self, reservation_id: str) -> bool:
        """Rolls back reserved budget if execution fails or approval is rejected."""
        if reservation_id not in self.active_reservations:
            return False
        grant_id, amount = self.active_reservations.pop(reservation_id)
        g = self.grants.get(grant_id)
        if g and g.remaining_budget is not None:
            g.remaining_budget += amount
        self._persist_reservation(reservation_id, grant_id, amount, "ROLLED_BACK")
        return True

