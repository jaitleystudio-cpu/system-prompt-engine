"""
SPE Ω — RBPD Phase A: Reality-Bound Evidence Asset Contract.

Defines the 16-field RealityBoundEvidenceAsset schema, 4-state EpistemicStatus
(VALID, INVALID, STALE, UNKNOWN), and ProofContractValidator backed by the
canonical LearningValidator, AuthorityGrant, and SpePackage owners.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import hashlib
import math
import re
import time
from typing import Any, Dict, Optional, Sequence, Tuple

from spe_runtime.authority import AuthorityGrant, validate_grant_compatibility
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
    PROTECTED_INTENT_CHANGED = "PROTECTED_INTENT_CHANGED"
    REQUIREMENT_VERSION_CHANGED = "REQUIREMENT_VERSION_CHANGED"
    ASSUMPTION_VIOLATED = "ASSUMPTION_VIOLATED"
    ENVIRONMENT_CHANGED = "ENVIRONMENT_CHANGED"
    DATASET_COMMITMENT_CHANGED = "DATASET_COMMITMENT_CHANGED"
    DEPENDENCY_EVIDENCE_CHANGED = "DEPENDENCY_EVIDENCE_CHANGED"
    AUTHORITY_SCOPE_CHANGED = "AUTHORITY_SCOPE_CHANGED"
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

    Includes all 16 essential contract fields:
    1. OBJECTIVE_DIGEST (objective_digest / subject_digest)
    2. PROTECTED_INTENT_DIGEST (protected_intent_digest / proof_slice_digest)
    3. REQUIREMENT_VERSION (requirement_version / requirement_atoms)
    4. MODEL_ID (model_id / generator_id)
    5. VERIFIED_MODEL_REVISION (verified_model_revision / model_or_runtime_digest)
    6. ENVIRONMENT_FINGERPRINT (environment_fingerprint)
    7. DEPENDENCY_EVIDENCE_HASHES (dependency_evidence_hashes)
    8. VERIFICATION_METHOD (verification_method / oracle_class)
    9. VALIDITY_ASSUMPTIONS (validity_assumptions / assumption_boundaries)
    10. INDEPENDENT_EVALUATOR_ID (independent_evaluator_id / oracle_identity)
    11. EVALUATION_DATASET_COMMITMENT (evaluation_dataset_commitment / witness_protocol_digest)
    12. COUNTEREXAMPLE_COVERAGE (counterexample_coverage)
    13. AUTHORITY_SCOPE (authority_scope / authority_grant_id)
    14. EXPIRY_OR_REQUALIFICATION_CONDITIONS (expiry_or_requalification_conditions)
    15. REVOCATION_REFERENCE (revocation_reference / revocation_tombstone_ref)
    16. PROOF_RECEIPT (proof_receipt / receipt_hash + signature)
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
    objective_digest: str = ""
    protected_intent_digest: str = ""
    requirement_version: str = ""
    model_id: str = ""
    verified_model_revision: str = ""
    environment_fingerprint: str = ""
    dependency_evidence_hashes: Tuple[str, ...] = ()
    verification_method: str = ""
    validity_assumptions: Dict[str, Any] = field(default_factory=dict)
    independent_evaluator_id: str = ""
    evaluation_dataset_commitment: str = ""
    counterexample_coverage: Dict[str, Any] = field(default_factory=dict)
    authority_scope: str = ""
    expiry_or_requalification_conditions: Dict[str, Any] = field(default_factory=dict)
    revocation_reference: str = ""

    def __post_init__(self) -> None:
        if not self.objective_digest:
            object.__setattr__(self, "objective_digest", self.subject_digest)
        if not self.protected_intent_digest:
            object.__setattr__(self, "protected_intent_digest", self.proof_slice_digest)
        if not self.requirement_version:
            object.__setattr__(
                self,
                "requirement_version",
                ":".join(self.requirement_atoms) if self.requirement_atoms else "1.0",
            )
        if not self.model_id:
            object.__setattr__(self, "model_id", self.generator_id)
        if not self.verified_model_revision:
            object.__setattr__(self, "verified_model_revision", self.model_or_runtime_digest)
        if not self.environment_fingerprint:
            env_bytes = rfc8785_canonicalize(dict(sorted(self.assumption_boundaries.items())))
            object.__setattr__(
                self,
                "environment_fingerprint",
                hashlib.sha256(env_bytes).hexdigest(),
            )
        if not isinstance(self.dependency_evidence_hashes, tuple):
            object.__setattr__(
                self,
                "dependency_evidence_hashes",
                tuple(self.dependency_evidence_hashes),
            )
        if not self.verification_method:
            object.__setattr__(self, "verification_method", self.oracle_class)
        if not self.validity_assumptions:
            object.__setattr__(
                self,
                "validity_assumptions",
                dict(sorted(self.assumption_boundaries.items())),
            )
        if not self.independent_evaluator_id:
            object.__setattr__(self, "independent_evaluator_id", self.oracle_identity)
        if not self.evaluation_dataset_commitment:
            object.__setattr__(
                self,
                "evaluation_dataset_commitment",
                self.witness_protocol_digest,
            )
        if not self.counterexample_coverage:
            object.__setattr__(
                self,
                "counterexample_coverage",
                {"coverage_floor": 1.0, "status": "BOUNDED_COUNTEREXAMPLE_CHECKED"},
            )
        if not self.authority_scope:
            object.__setattr__(
                self,
                "authority_scope",
                self.authority_grant_id or "RBPD_EVIDENCE_MINT_AND_VERIFY:spe_runtime.research.rbpd",
            )
        if not self.expiry_or_requalification_conditions:
            object.__setattr__(
                self,
                "expiry_or_requalification_conditions",
                {
                    "invalidation_triggers": list(self.invalidation_triggers),
                    "validity_horizon": self.validity_horizon,
                },
            )
        if not self.revocation_reference:
            object.__setattr__(self, "revocation_reference", self.revocation_tombstone_ref)

    @property
    def proof_receipt(self) -> Dict[str, str]:
        return {
            "receipt_hash": self.receipt_hash,
            "signature": self.signature,
            "validator_public_key": self.validator_public_key,
        }

    def essential_contract_dict(self) -> Dict[str, Any]:
        """Returns the 16 canonical contract fields defined in the RBPD specification."""
        return {
            "OBJECTIVE_DIGEST": self.objective_digest,
            "PROTECTED_INTENT_DIGEST": self.protected_intent_digest,
            "REQUIREMENT_VERSION": self.requirement_version,
            "MODEL_ID": self.model_id,
            "VERIFIED_MODEL_REVISION": self.verified_model_revision,
            "ENVIRONMENT_FINGERPRINT": self.environment_fingerprint,
            "DEPENDENCY_EVIDENCE_HASHES": list(self.dependency_evidence_hashes),
            "VERIFICATION_METHOD": self.verification_method,
            "VALIDITY_ASSUMPTIONS": dict(sorted(self.validity_assumptions.items())),
            "INDEPENDENT_EVALUATOR_ID": self.independent_evaluator_id,
            "EVALUATION_DATASET_COMMITMENT": self.evaluation_dataset_commitment,
            "COUNTEREXAMPLE_COVERAGE": dict(sorted(self.counterexample_coverage.items())),
            "AUTHORITY_SCOPE": self.authority_scope,
            "EXPIRY_OR_REQUALIFICATION_CONDITIONS": dict(
                sorted(self.expiry_or_requalification_conditions.items())
            ),
            "REVOCATION_REFERENCE": self.revocation_reference,
            "PROOF_RECEIPT": self.proof_receipt,
        }

    def canonical_payload_dict(self) -> Dict[str, Any]:
        """Returns the deterministic dict used for RFC 8785 canonical hashing and signing."""
        return {
            "asset_id": self.asset_id,
            "assumption_boundaries": dict(sorted(self.assumption_boundaries.items())),
            "authority_grant_id": self.authority_grant_id,
            "authority_scope": self.authority_scope,
            "claim_id": self.claim_id,
            "committed_timestamp": self.committed_timestamp,
            "counterexample_coverage": dict(sorted(self.counterexample_coverage.items())),
            "dependency_evidence_hashes": list(self.dependency_evidence_hashes),
            "environment_fingerprint": self.environment_fingerprint,
            "evaluation_dataset_commitment": self.evaluation_dataset_commitment,
            "expiry_or_requalification_conditions": dict(
                sorted(self.expiry_or_requalification_conditions.items())
            ),
            "generator_id": self.generator_id,
            "independent_evaluator_id": self.independent_evaluator_id,
            "invalidation_triggers": list(self.invalidation_triggers),
            "model_digest_type": self.model_digest_type,
            "model_id": self.model_id,
            "model_or_runtime_digest": self.model_or_runtime_digest,
            "objective_digest": self.objective_digest,
            "oracle_attestation": self.oracle_attestation,
            "oracle_class": self.oracle_class,
            "oracle_identity": self.oracle_identity,
            "proof_slice_digest": self.proof_slice_digest,
            "protected_intent_digest": self.protected_intent_digest,
            "requirement_atoms": list(self.requirement_atoms),
            "requirement_version": self.requirement_version,
            "revocation_reference": self.revocation_reference,
            "revocation_tombstone_ref": self.revocation_tombstone_ref,
            "subject_digest": self.subject_digest,
            "validator_public_key": self.validator_public_key,
            "validity_assumptions": dict(sorted(self.validity_assumptions.items())),
            "validity_horizon": self.validity_horizon,
            "verification_method": self.verification_method,
            "verified_model_revision": self.verified_model_revision,
            "witness_protocol_digest": self.witness_protocol_digest,
        }

    def to_dict(self) -> Dict[str, Any]:
        payload = self.canonical_payload_dict()
        payload["receipt_hash"] = self.receipt_hash
        payload["signature"] = self.signature
        payload["essential_contract"] = self.essential_contract_dict()
        payload.update(self.essential_contract_dict())
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
            issued_at="1970-01-01T00:00:00Z",
            expires_at="2099-12-31T23:59:59Z",
            use_limit=10000,
        )

    @property
    def validator(self) -> LearningValidator:
        return self._validator

    @property
    def authority_grant(self) -> AuthorityGrant:
        return self._authority_grant

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
        protected_intent_digest: Optional[str] = None,
        requirement_version: Optional[str] = None,
        environment_fingerprint: Optional[str] = None,
        dependency_evidence_hashes: Optional[Sequence[str]] = None,
        counterexample_coverage: Optional[Dict[str, Any]] = None,
        authority_scope: Optional[str] = None,
    ) -> RealityBoundEvidenceAsset:
        if not self._validator.is_owner_authorized or (
            self._require_crypto_owner and not self._validator.has_cryptographic_owner_authority
        ):
            raise ValueError("Unauthorized validator: cannot mint RealityBoundEvidenceAsset without owner authority")

        now = committed_timestamp if committed_timestamp is not None else time.time()
        now_iso = datetime.fromtimestamp(float(now), tz=timezone.utc).isoformat()
        ok_grant, grant_reasons = validate_grant_compatibility(
            self._authority_grant,
            capability="RBPD_EVIDENCE_MINT_AND_VERIFY",
            target="spe_runtime.research.rbpd",
            arguments={"require_cryptographic_owner_authority": self._require_crypto_owner},
            now=now_iso,
        )
        if not ok_grant:
            raise ValueError(
                f"AuthorityGrant validation failed during asset minting: {', '.join(grant_reasons)}"
            )

        if not asset_id or not claim_id or not oracle_identity or not generator_id:
            raise ValueError("asset_id, claim_id, oracle_identity, and generator_id must be non-empty")

        if oracle_identity == generator_id or oracle_class == "generating_model_self":
            raise ValueError("Self-certification prohibited: oracle must be an independent reality witness")

        if oracle_class not in ("independent_static_oracle", "independent_reality_witness"):
            raise ValueError(f"Unsupported oracle_class '{oracle_class}': must be independent")

        eff_protected_intent = protected_intent_digest if protected_intent_digest is not None else proof_slice_digest
        sorted_assumptions = dict(sorted(assumption_boundaries.items()))
        eff_env_fingerprint = (
            environment_fingerprint
            if environment_fingerprint is not None
            else hashlib.sha256(rfc8785_canonicalize(sorted_assumptions)).hexdigest()
        )

        for field_name, digest_val in (
            ("subject_digest", subject_digest),
            ("proof_slice_digest", proof_slice_digest),
            ("protected_intent_digest", eff_protected_intent),
            ("environment_fingerprint", eff_env_fingerprint),
            ("witness_protocol_digest", witness_protocol_digest),
            ("model_or_runtime_digest", model_or_runtime_digest),
        ):
            if not isinstance(digest_val, str) or not _HEX64.fullmatch(digest_val):
                raise ValueError(f"Invalid {field_name}: must be 64-char lowercase hex SHA-256")

        dep_hashes = tuple(str(h) for h in (dependency_evidence_hashes or ()))
        for dep_h in dep_hashes:
            if not _HEX64.fullmatch(dep_h):
                raise ValueError(f"Invalid dependency_evidence_hash '{dep_h}': must be 64-char lowercase hex SHA-256")

        if model_digest_type not in ("VERIFIED_MODEL_REVISION", "SYNTHETIC_NAME_DERIVED"):
            raise ValueError(f"Invalid model_digest_type '{model_digest_type}'")

        if model_digest_type == "VERIFIED_MODEL_REVISION" and _is_synthetic_model_digest(
            generator_id, model_or_runtime_digest
        ):
            raise ValueError(
                f"Synthetic model_digest for '{generator_id}' cannot claim VERIFIED_MODEL_REVISION"
            )

        if not isinstance(validity_horizon, (int, float)) or isinstance(validity_horizon, bool) or not math.isfinite(validity_horizon) or validity_horizon <= now:
            raise ValueError("validity_horizon must be a finite timestamp strictly greater than committed_timestamp")

        req_tuple = tuple(sorted(set(str(r) for r in requirement_atoms if str(r).strip())))
        if not req_tuple:
            raise ValueError("requirement_atoms must contain at least one requirement atom ID")

        trig_tuple = tuple(str(t) for t in invalidation_triggers if str(t).strip())
        if not trig_tuple:
            raise ValueError("invalidation_triggers must contain at least one trigger")

        tombstone_ref = f"tx:{asset_id}"
        eff_req_version = requirement_version if requirement_version is not None else ":".join(req_tuple)
        eff_auth_scope = (
            authority_scope
            if authority_scope is not None
            else f"{self._authority_grant.capability}:{self._authority_grant.target}:{self._authority_grant.grant_id}"
        )
        eff_ce_coverage = (
            dict(sorted(counterexample_coverage.items()))
            if counterexample_coverage is not None
            else {"coverage_floor": 1.0, "status": "BOUNDED_COUNTEREXAMPLE_CHECKED"}
        )

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
            assumption_boundaries=sorted_assumptions,
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
            objective_digest=subject_digest,
            protected_intent_digest=eff_protected_intent,
            requirement_version=eff_req_version,
            model_id=generator_id,
            verified_model_revision=model_or_runtime_digest,
            environment_fingerprint=eff_env_fingerprint,
            dependency_evidence_hashes=dep_hashes,
            verification_method=oracle_class,
            validity_assumptions=sorted_assumptions,
            independent_evaluator_id=oracle_identity,
            evaluation_dataset_commitment=witness_protocol_digest,
            counterexample_coverage=eff_ce_coverage,
            authority_scope=eff_auth_scope,
            expiry_or_requalification_conditions={
                "invalidation_triggers": list(trig_tuple),
                "validity_horizon": float(validity_horizon),
            },
            revocation_reference=tombstone_ref,
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
        current_protected_intent_digest: Optional[str] = None,
        current_requirement_version: Optional[str] = None,
        current_environment_fingerprint: Optional[str] = None,
        current_evaluation_dataset_commitment: Optional[str] = None,
        current_dependency_evidence_hashes: Optional[Sequence[str]] = None,
        current_authority_grant: Optional[AuthorityGrant] = None,
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

        # 1. Check validator owner authority & AuthorityGrant compatibility
        if not self._validator.is_owner_authorized or (
            self._require_crypto_owner and not self._validator.has_cryptographic_owner_authority
        ):
            return AssetValidationVerdict(
                status=EpistemicStatus.INVALID,
                can_reuse=False,
                reason="Validator lacks cryptographic owner authority or has been revoked",
                triggered_invalidations=(InvalidationTrigger.TOMBSTONE_REVOKED.value,),
            )

        now = current_time if current_time is not None else time.time()
        now_iso = datetime.fromtimestamp(float(now), tz=timezone.utc).isoformat()
        active_grant = current_authority_grant if current_authority_grant is not None else self._authority_grant
        ok_grant, grant_reasons = validate_grant_compatibility(
            active_grant,
            capability="RBPD_EVIDENCE_MINT_AND_VERIFY",
            target="spe_runtime.research.rbpd",
            arguments={"require_cryptographic_owner_authority": self._require_crypto_owner},
            now=now_iso,
        )
        if not ok_grant:
            return AssetValidationVerdict(
                status=EpistemicStatus.INVALID,
                can_reuse=False,
                reason=f"AuthorityGrant invalid or revoked: {', '.join(grant_reasons)}",
                triggered_invalidations=(InvalidationTrigger.AUTHORITY_SCOPE_CHANGED.value,),
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
        stale_triggers = []

        if now > asset.validity_horizon:
            stale_triggers.append(InvalidationTrigger.HORIZON_EXPIRED.value)
        if current_subject_digest != asset.subject_digest:
            stale_triggers.append(InvalidationTrigger.SUBJECT_DIGEST_CHANGED.value)
        if current_proof_slice_digest != asset.proof_slice_digest:
            stale_triggers.append(InvalidationTrigger.PROOF_SLICE_CHANGED.value)
        if (
            current_protected_intent_digest is not None
            and current_protected_intent_digest != asset.protected_intent_digest
        ):
            stale_triggers.append(InvalidationTrigger.PROTECTED_INTENT_CHANGED.value)
        if (
            current_requirement_version is not None
            and current_requirement_version != asset.requirement_version
        ):
            stale_triggers.append(InvalidationTrigger.REQUIREMENT_VERSION_CHANGED.value)
        if current_model_digest != asset.model_or_runtime_digest:
            stale_triggers.append(InvalidationTrigger.MODEL_REVISION_CHANGED.value)
        if (
            current_environment_fingerprint is not None
            and current_environment_fingerprint != asset.environment_fingerprint
        ):
            stale_triggers.append(InvalidationTrigger.ENVIRONMENT_CHANGED.value)
        if (
            current_evaluation_dataset_commitment is not None
            and current_evaluation_dataset_commitment != asset.evaluation_dataset_commitment
        ):
            stale_triggers.append(InvalidationTrigger.DATASET_COMMITMENT_CHANGED.value)
        if (
            current_authority_grant is not None
            and asset.authority_grant_id
            and current_authority_grant.grant_id != asset.authority_grant_id
        ):
            stale_triggers.append(InvalidationTrigger.AUTHORITY_SCOPE_CHANGED.value)

        if current_dependency_evidence_hashes is not None and tuple(current_dependency_evidence_hashes) != asset.dependency_evidence_hashes:
            stale_triggers.append(InvalidationTrigger.DEPENDENCY_EVIDENCE_CHANGED.value)
        else:
            for dep_hash in asset.dependency_evidence_hashes:
                if self._validator.is_tombstoned(
                    receipt_hash=dep_hash,
                    evidence_hash=dep_hash,
                    tx_id=dep_hash,
                ):
                    stale_triggers.append(InvalidationTrigger.DEPENDENCY_EVIDENCE_CHANGED.value)
                    break

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
