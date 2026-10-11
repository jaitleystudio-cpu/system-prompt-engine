"""
SPE Ω — RBPD Phase A: Reality-Bound Evidence Asset Contract.

Defines the 16-field RealityBoundEvidenceAsset schema, 4-state EpistemicStatus
(VALID, INVALID, STALE, UNKNOWN), and ProofContractValidator backed by the
canonical LearningValidator, AuthorityGrant, and SpePackage owners.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import hashlib
import math
import re
import time
from typing import Any, Dict, Optional, Sequence, Tuple

from spe_runtime.authority import AuthorityGrant
from spe_runtime.ci_gate.receipt import (
    ed25519_sign,
    ed25519_verify as _raw_ed25519_verify,
    rfc8785_canonicalize,
)

_ED25519_VERIFY_CACHE: Dict[Tuple[bytes, bytes, bytes], bool] = {}


def ed25519_verify(public_key: bytes, message: bytes, signature: bytes) -> bool:
    key = (bytes(public_key), bytes(message), bytes(signature))
    cached = _ED25519_VERIFY_CACHE.get(key)
    if cached is not None:
        return cached
    res = _raw_ed25519_verify(public_key, message, signature)
    if len(_ED25519_VERIFY_CACHE) < 4096:
        _ED25519_VERIFY_CACHE[key] = res
    return res
from spe_runtime.research.lvt.learning_validator import (
    LearningValidator,
    create_oracle_attestation,
)
from spe_runtime.research.lvt.paired_gate_v2 import _is_synthetic_model_digest
from spe_runtime.research.lvt.types import OracleAttestation
from spe_runtime.spe_package import SpePackage

_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_HEX128 = re.compile(r"^[0-9a-f]{128}$")


class EpistemicStatus(str, Enum):
    """Four-state epistemic classification for reality-bound proof assets."""

    VALID = "VALID"
    INVALID = "INVALID"
    STALE = "STALE"
    UNKNOWN = "UNKNOWN"


class InvalidationTrigger(str, Enum):
    """Canonical invalidation triggers bound into RealityBoundEvidenceAsset."""

    SUBJECT_DIGEST_CHANGED = "SUBJECT_DIGEST_CHANGED"
    PROOF_SLICE_CHANGED = "PROOF_SLICE_CHANGED"
    ASSUMPTION_VIOLATED = "ASSUMPTION_VIOLATED"
    MODEL_REVISION_CHANGED = "MODEL_REVISION_CHANGED"
    ORACLE_UNTRUSTED = "ORACLE_UNTRUSTED"
    HORIZON_EXPIRED = "HORIZON_EXPIRED"
    TOMBSTONE_REVOKED = "TOMBSTONE_REVOKED"


@dataclass(frozen=True)
class RealityBoundEvidenceAsset:
    """
    16-field Reality-Bound Evidence Asset Contract.
    Every field is bound into the RFC 8785 canonical receipt payload and signed by
    an owner-authorized LearningValidator.
    """

    asset_id: str
    claim_id: str
    subject_digest: str
    requirement_atoms: Tuple[str, ...]
    assumption_boundaries: Dict[str, Any]
    proof_slice_digest: str
    witness_protocol_digest: str
    oracle_identity: str
    oracle_class: str
    model_or_runtime_digest: str
    model_digest_type: str
    validity_horizon: float
    invalidation_triggers: Tuple[str, ...]
    revocation_tombstone_ref: str
    receipt_hash: str
    signature: str
    generator_id: str = ""
    committed_timestamp: float = 0.0
    validator_public_key: str = ""
    oracle_attestation: Optional[Dict[str, Any]] = None
    authority_grant_id: str = ""

    def canonical_payload_dict(self) -> Dict[str, Any]:
        """Returns the deterministic dict used for RFC 8785 canonical hashing and signing."""
        return {
            "asset_id": self.asset_id,
            "assumption_boundaries": dict(sorted(self.assumption_boundaries.items())),
            "authority_grant_id": self.authority_grant_id,
            "claim_id": self.claim_id,
            "committed_timestamp": self.committed_timestamp,
            "generator_id": self.generator_id,
            "invalidation_triggers": list(self.invalidation_triggers),
            "model_digest_type": self.model_digest_type,
            "model_or_runtime_digest": self.model_or_runtime_digest,
            "oracle_attestation": self.oracle_attestation,
            "oracle_class": self.oracle_class,
            "oracle_identity": self.oracle_identity,
            "proof_slice_digest": self.proof_slice_digest,
            "requirement_atoms": list(self.requirement_atoms),
            "revocation_tombstone_ref": self.revocation_tombstone_ref,
            "subject_digest": self.subject_digest,
            "validator_public_key": self.validator_public_key,
            "validity_horizon": self.validity_horizon,
            "witness_protocol_digest": self.witness_protocol_digest,
        }

    def to_dict(self) -> Dict[str, Any]:
        payload = self.canonical_payload_dict()
        payload["receipt_hash"] = self.receipt_hash
        payload["signature"] = self.signature
        return payload


@dataclass(frozen=True)
class AssetValidationVerdict:
    """Result of validating a RealityBoundEvidenceAsset against current reality context."""

    status: EpistemicStatus
    can_reuse: bool
    reason: str
    triggered_invalidations: Tuple[str, ...] = field(default_factory=tuple)


class ProofContractValidator:
    """
    Mints, packages, revokes, and validates RealityBoundEvidenceAsset instances.
    Reuses LearningValidator for cryptographic owner authority, oracle attestation,
    and durable tombstone persistence, and SpePackage for portable containerization.
    """

    def __init__(
        self,
        validator: LearningValidator,
        *,
        require_cryptographic_owner_authority: bool = True,
        authority_grant: Optional[AuthorityGrant] = None,
    ) -> None:
        if not isinstance(validator, LearningValidator):
            raise ValueError("ProofContractValidator requires an authoritative LearningValidator instance")
        if require_cryptographic_owner_authority and not validator.has_cryptographic_owner_authority:
            raise ValueError(
                "ProofContractValidator requires a LearningValidator with cryptographic owner authority"
            )
        self._validator = validator
        self._require_crypto_owner = require_cryptographic_owner_authority
        self._authority_grant = authority_grant or AuthorityGrant(
            grant_id=f"GRANT-RBPD-{validator.public_key.hex()[:12]}",
            principal=f"validator:{validator.public_key.hex()[:16]}",
            capability="RBPD_EVIDENCE_MINT_AND_VERIFY",
            target="spe_runtime.research.rbpd",
            argument_constraints={"require_cryptographic_owner_authority": True},
            purpose="Reality-Bound Proof Dividend evidence asset minting and validation",
            issued_at="2026-10-11T00:00:00Z",
            expires_at="2027-10-11T00:00:00Z",
            use_limit=10000,
        )

    @property
    def validator(self) -> LearningValidator:
        return self._validator

    def mint_asset(
        self,
        *,
        asset_id: str,
        claim_id: str,
        subject_digest: str,
        requirement_atoms: Sequence[str],
        assumption_boundaries: Dict[str, Any],
        proof_slice_digest: str,
        witness_protocol_digest: str,
        oracle_identity: str,
        oracle_class: str,
        model_or_runtime_digest: str,
        model_digest_type: str,
        validity_horizon: float,
        invalidation_triggers: Sequence[str],
        generator_id: str,
        oracle_signing_key: bytes,
        oracle_public_key: bytes,
        committed_timestamp: Optional[float] = None,
    ) -> RealityBoundEvidenceAsset:
        if not self._validator.is_owner_authorized or (
            self._require_crypto_owner and not self._validator.has_cryptographic_owner_authority
        ):
            raise ValueError("Unauthorized validator: cannot mint RealityBoundEvidenceAsset without owner authority")

        if not asset_id or not claim_id or not oracle_identity or not generator_id:
            raise ValueError("asset_id, claim_id, oracle_identity, and generator_id must be non-empty")

        if oracle_identity == generator_id or oracle_class == "generating_model_self":
            raise ValueError("Self-certification prohibited: oracle must be an independent reality witness")

        if oracle_class not in ("independent_static_oracle", "independent_reality_witness"):
            raise ValueError(f"Unsupported oracle_class '{oracle_class}': must be independent")

        for field_name, digest_val in (
            ("subject_digest", subject_digest),
            ("proof_slice_digest", proof_slice_digest),
            ("witness_protocol_digest", witness_protocol_digest),
            ("model_or_runtime_digest", model_or_runtime_digest),
        ):
            if not isinstance(digest_val, str) or not _HEX64.fullmatch(digest_val):
                raise ValueError(f"Invalid {field_name}: must be 64-char lowercase hex SHA-256")

        if model_digest_type not in ("VERIFIED_MODEL_REVISION", "SYNTHETIC_NAME_DERIVED"):
            raise ValueError(f"Invalid model_digest_type '{model_digest_type}'")

        if model_digest_type == "VERIFIED_MODEL_REVISION" and _is_synthetic_model_digest(
            generator_id, model_or_runtime_digest
        ):
            raise ValueError(
                f"Synthetic model_digest for '{generator_id}' cannot claim VERIFIED_MODEL_REVISION"
            )

        now = committed_timestamp if committed_timestamp is not None else time.time()
        if not isinstance(validity_horizon, (int, float)) or isinstance(validity_horizon, bool) or not math.isfinite(validity_horizon) or validity_horizon <= now:
            raise ValueError("validity_horizon must be a finite timestamp strictly greater than committed_timestamp")

        req_tuple = tuple(sorted(set(str(r) for r in requirement_atoms if str(r).strip())))
        if not req_tuple:
            raise ValueError("requirement_atoms must contain at least one requirement atom ID")

        trig_tuple = tuple(str(t) for t in invalidation_triggers if str(t).strip())
        if not trig_tuple:
            raise ValueError("invalidation_triggers must contain at least one trigger")

        tombstone_ref = f"tx:{asset_id}"

        # Create independent oracle attestation over the composite evidence digest
        evidence_preimage = rfc8785_canonicalize(
            {
                "asset_id": asset_id,
                "claim_id": claim_id,
                "model_or_runtime_digest": model_or_runtime_digest,
                "proof_slice_digest": proof_slice_digest,
                "subject_digest": subject_digest,
                "witness_protocol_digest": witness_protocol_digest,
            }
        )
        evidence_hash = hashlib.sha256(evidence_preimage).hexdigest()
        oracle_att = create_oracle_attestation(
            signing_key=oracle_signing_key,
            public_key=oracle_public_key,
            oracle_id=oracle_identity,
            evidence_hash=evidence_hash,
        )
        ok_oracle, oracle_msg = self._validator.verify_oracle_attestation(
            oracle_att,
            expected_evidence_hash=evidence_hash,
            expected_oracle_id=oracle_identity,
        )
        if not ok_oracle:
            raise ValueError(f"Oracle attestation failed verification during asset minting: {oracle_msg}")

        oracle_att_dict = {
            "evidence_hash": oracle_att.evidence_hash,
            "oracle_id": oracle_att.oracle_id,
            "oracle_public_key": oracle_att.oracle_public_key,
            "signature": oracle_att.signature,
            "timestamp": oracle_att.timestamp,
            "verdict": oracle_att.verdict,
        }

        unsigned = RealityBoundEvidenceAsset(
            asset_id=asset_id,
            claim_id=claim_id,
            subject_digest=subject_digest,
            requirement_atoms=req_tuple,
            assumption_boundaries=dict(sorted(assumption_boundaries.items())),
            proof_slice_digest=proof_slice_digest,
            witness_protocol_digest=witness_protocol_digest,
            oracle_identity=oracle_identity,
            oracle_class=oracle_class,
            model_or_runtime_digest=model_or_runtime_digest,
            model_digest_type=model_digest_type,
            validity_horizon=float(validity_horizon),
            invalidation_triggers=trig_tuple,
            revocation_tombstone_ref=tombstone_ref,
            receipt_hash="",
            signature="",
            generator_id=generator_id,
            committed_timestamp=float(now),
            validator_public_key=self._validator.public_key.hex(),
            oracle_attestation=oracle_att_dict,
            authority_grant_id=self._authority_grant.grant_id,
        )
        canonical_bytes = rfc8785_canonicalize(unsigned.canonical_payload_dict())
        receipt_hash = hashlib.sha256(canonical_bytes).hexdigest()
        sig_bytes = ed25519_sign(self._validator._sk, self._validator._pk, canonical_bytes)

        return RealityBoundEvidenceAsset(
            **{
                **unsigned.__dict__,
                "receipt_hash": receipt_hash,
                "signature": sig_bytes.hex(),
            }
        )

    def package_asset(
        self,
        asset: RealityBoundEvidenceAsset,
        target_dir: Optional[str] = None,
    ) -> SpePackage:
        """Packages a RealityBoundEvidenceAsset into a canonical SpePackage directory layout with verified digests."""
        import json
        from pathlib import Path
        import tempfile
        from spe_runtime.spe_package import verify_package_integrity

        root_dir = Path(target_dir) if target_dir else Path(tempfile.mkdtemp(prefix=f"spe_rbpd_{asset.asset_id}_"))
        pkg = SpePackage.create_layout(root_dir, package_id=asset.asset_id, version="0.1.0")
        (pkg.root / "requirements.json").write_text(
            json.dumps({"requirement_atoms": list(asset.requirement_atoms)}, indent=2),
            encoding="utf-8",
        )
        (pkg.root / "evidence" / f"{asset.asset_id}.json").write_text(
            json.dumps(asset.to_dict(), indent=2),
            encoding="utf-8",
        )
        (pkg.root / "signatures" / f"{asset.asset_id}.sig").write_text(
            asset.signature,
            encoding="utf-8",
        )
        pkg.update_digests()
        verify_package_integrity(pkg.root)
        return pkg

    def revoke_asset(
        self,
        asset: RealityBoundEvidenceAsset,
        *,
        reason: str,
        details: str = "",
    ) -> None:
        """Records a durable revocation tombstone for the asset across restarts."""
        ev_hash = asset.oracle_attestation.get("evidence_hash") if isinstance(asset.oracle_attestation, dict) else None
        self._validator.record_tombstone(
            receipt_hash=asset.receipt_hash,
            evidence_hash=ev_hash,
            tx_id=asset.asset_id,
            target_model_id=None,
            reason=reason,
            details=details,
        )

    def validate_asset(
        self,
        asset: Optional[RealityBoundEvidenceAsset],
        *,
        current_subject_digest: str,
        current_proof_slice_digest: str,
        current_assumptions: Dict[str, Any],
        current_model_digest: str,
        current_time: Optional[float] = None,
        external_gate_Required: Optional[str] = None,
        revoked_oracles: Optional[Sequence[str]] = None,
    ) -> AssetValidationVerdict:
        """
        Evaluates a RealityBoundEvidenceAsset against current reality context and returns
        its 4-state EpistemicStatus (VALID, INVALID, STALE, UNKNOWN).
        """
        if asset is None:
            return AssetValidationVerdict(
                status=EpistemicStatus.UNKNOWN,
                can_reuse=False,
                reason="No evidence asset present for obligation",
            )

        if external_gate_Required in ("EXTERNAL_MODEL_QUALIFICATION", "G6_H_BLINDED_HUMAN_EVALUATION"):
            return AssetValidationVerdict(
                status=EpistemicStatus.UNKNOWN,
                can_reuse=False,
                reason=f"External gate '{external_gate_Required}' is held (BLOCKED_HOLD)",
            )

        # 1. Check validator owner authority
        if not self._validator.is_owner_authorized or (
            self._require_crypto_owner and not self._validator.has_cryptographic_owner_authority
        ):
            return AssetValidationVerdict(
                status=EpistemicStatus.INVALID,
                can_reuse=False,
                reason="Validator lacks cryptographic owner authority or has been revoked",
                triggered_invalidations=(InvalidationTrigger.TOMBSTONE_REVOKED.value,),
            )

        # 2. Check durable revocation tombstones first (survives backup restore & process restart)
        ev_hash = asset.oracle_attestation.get("evidence_hash") if isinstance(asset.oracle_attestation, dict) else None
        if self._validator.is_tombstoned(
            receipt_hash=asset.receipt_hash,
            evidence_hash=ev_hash,
            tx_id=asset.asset_id,
        ):
            return AssetValidationVerdict(
                status=EpistemicStatus.INVALID,
                can_reuse=False,
                reason=f"Asset '{asset.asset_id}' has been revoked via durable tombstone",
                triggered_invalidations=(InvalidationTrigger.TOMBSTONE_REVOKED.value,),
            )

        # 3. Check oracle self-certification & trust
        if (
            asset.oracle_identity == asset.generator_id
            or asset.oracle_class not in ("independent_static_oracle", "independent_reality_witness")
        ):
            return AssetValidationVerdict(
                status=EpistemicStatus.INVALID,
                can_reuse=False,
                reason="Oracle self-certification or unsupported oracle class",
                triggered_invalidations=(InvalidationTrigger.ORACLE_UNTRUSTED.value,),
            )

        if revoked_oracles and asset.oracle_identity in revoked_oracles:
            return AssetValidationVerdict(
                status=EpistemicStatus.INVALID,
                can_reuse=False,
                reason=f"Oracle '{asset.oracle_identity}' trust has been revoked",
                triggered_invalidations=(InvalidationTrigger.ORACLE_UNTRUSTED.value,),
            )

        # 4. Check synthetic model digest spoofing
        if asset.model_digest_type == "VERIFIED_MODEL_REVISION" and _is_synthetic_model_digest(
            asset.generator_id, asset.model_or_runtime_digest
        ):
            return AssetValidationVerdict(
                status=EpistemicStatus.INVALID,
                can_reuse=False,
                reason="Synthetic model digest cannot claim VERIFIED_MODEL_REVISION",
                triggered_invalidations=(InvalidationTrigger.MODEL_REVISION_CHANGED.value,),
            )

        # 5. Check cryptographic receipt hash & Ed25519 signature
        if not _HEX64.fullmatch(asset.receipt_hash or "") or not _HEX128.fullmatch(asset.signature or ""):
            return AssetValidationVerdict(
                status=EpistemicStatus.INVALID,
                can_reuse=False,
                reason="Malformed receipt_hash or signature",
            )

        canonical_bytes = rfc8785_canonicalize(asset.canonical_payload_dict())
        recomputed_hash = hashlib.sha256(canonical_bytes).hexdigest()
        if recomputed_hash != asset.receipt_hash:
            return AssetValidationVerdict(
                status=EpistemicStatus.INVALID,
                can_reuse=False,
                reason="Receipt hash mismatch: asset payload tampered",
            )

        try:
            sig_bytes = bytes.fromhex(asset.signature)
            val_pk_bytes = bytes.fromhex(asset.validator_public_key)
        except ValueError:
            return AssetValidationVerdict(
                status=EpistemicStatus.INVALID,
                can_reuse=False,
                reason="Invalid hex encoding in signature or validator_public_key",
            )

        if val_pk_bytes != self._validator.public_key or not ed25519_verify(val_pk_bytes, canonical_bytes, sig_bytes):
            return AssetValidationVerdict(
                status=EpistemicStatus.INVALID,
                can_reuse=False,
                reason="Cryptographic Ed25519 signature verification failed",
            )

        # Verify embedded oracle attestation against LearningValidator's trusted oracle registry
        if not isinstance(asset.oracle_attestation, dict):
            return AssetValidationVerdict(
                status=EpistemicStatus.INVALID,
                can_reuse=False,
                reason="Missing oracle attestation in asset",
                triggered_invalidations=(InvalidationTrigger.ORACLE_UNTRUSTED.value,),
            )

        expected_ev_preimage = rfc8785_canonicalize(
            {
                "asset_id": asset.asset_id,
                "claim_id": asset.claim_id,
                "model_or_runtime_digest": asset.model_or_runtime_digest,
                "proof_slice_digest": asset.proof_slice_digest,
                "subject_digest": asset.subject_digest,
                "witness_protocol_digest": asset.witness_protocol_digest,
            }
        )
        expected_ev_hash = hashlib.sha256(expected_ev_preimage).hexdigest()
        att_obj = OracleAttestation(
            oracle_id=str(asset.oracle_attestation.get("oracle_id", "")),
            oracle_public_key=str(asset.oracle_attestation.get("oracle_public_key", "")),
            evidence_hash=str(asset.oracle_attestation.get("evidence_hash", "")),
            verdict=str(asset.oracle_attestation.get("verdict", "")),
            timestamp=float(asset.oracle_attestation.get("timestamp", 0.0)),
            signature=str(asset.oracle_attestation.get("signature", "")),
        )
        ok_att, att_reason = self._validator.verify_oracle_attestation(
            att_obj,
            expected_evidence_hash=expected_ev_hash,
            expected_oracle_id=asset.oracle_identity,
        )
        if not ok_att:
            return AssetValidationVerdict(
                status=EpistemicStatus.INVALID,
                can_reuse=False,
                reason=f"Oracle attestation invalid: {att_reason}",
                triggered_invalidations=(InvalidationTrigger.ORACLE_UNTRUSTED.value,),
            )

        # 6. Check STALE conditions (authenticity holds, but reality state or horizon shifted)
        now = current_time if current_time is not None else time.time()
        stale_triggers = []

        if now > asset.validity_horizon:
            stale_triggers.append(InvalidationTrigger.HORIZON_EXPIRED.value)
        if current_subject_digest != asset.subject_digest:
            stale_triggers.append(InvalidationTrigger.SUBJECT_DIGEST_CHANGED.value)
        if current_proof_slice_digest != asset.proof_slice_digest:
            stale_triggers.append(InvalidationTrigger.PROOF_SLICE_CHANGED.value)
        if current_model_digest != asset.model_or_runtime_digest:
            stale_triggers.append(InvalidationTrigger.MODEL_REVISION_CHANGED.value)

        for k, v in asset.assumption_boundaries.items():
            if current_assumptions.get(k) != v:
                stale_triggers.append(InvalidationTrigger.ASSUMPTION_VIOLATED.value)
                break

        if stale_triggers:
            return AssetValidationVerdict(
                status=EpistemicStatus.STALE,
                can_reuse=False,
                reason=f"Asset is STALE due to: {', '.join(stale_triggers)}",
                triggered_invalidations=tuple(stale_triggers),
            )

        return AssetValidationVerdict(
            status=EpistemicStatus.VALID,
            can_reuse=True,
            reason="All 16 reality-bound contract invariants and cryptographic attestations verified",
        )
