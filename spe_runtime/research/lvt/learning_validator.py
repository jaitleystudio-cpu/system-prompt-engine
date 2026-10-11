"""
SPE Ω — Learning Validator Engine (LVT-0).
Evaluates the formal admission rule Φ_LVT, strictly enforces independent evaluation,
rejects generating model self-certification, and generates Ed25519 transaction receipts.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import time
from typing import Any, Dict, Optional, Set, Tuple

from spe_runtime.ci_gate.receipt import (
    ed25519_sign,
    ed25519_verify as _raw_ed25519_verify,
    generate_keypair,
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
from spe_runtime.research.lvt.types import (
    EvaluatorType,
    GeneratingModelSelfCertificationError,
    LearningValidityRuleViolation,
    LearningValidityTransaction,
    OracleAttestation,
    QualificationStatus,
)


def _validate_oracle_key(pkey: Any, oid: str = "") -> str:
    if not isinstance(pkey, str):
        raise ValueError(f"Trusted oracle public key must be a string, got {type(pkey).__name__}")
    cleaned = pkey.strip().lower()
    if len(cleaned) != 64:
        raise ValueError(
            f"Trusted oracle public key must be 64 hex characters (32 bytes), got {len(cleaned)} for oracle '{oid}': {pkey}"
        )
    try:
        bytes.fromhex(cleaned)
    except ValueError as e:
        raise ValueError(f"Invalid hex characters in trusted oracle public key for oracle '{oid}': {e}")
    return cleaned


def _normalize_hex_key(pkey: Any, name: str = "key") -> str:
    if isinstance(pkey, (bytes, bytearray)):
        pkey = pkey.hex()
    if not isinstance(pkey, str):
        raise ValueError(f"{name} must be a string or bytes, got {type(pkey).__name__}")
    cleaned = pkey.strip().lower()
    if len(cleaned) != 64:
        raise ValueError(f"{name} must be 64 hex characters (32 bytes), got {len(cleaned)}: {pkey}")
    try:
        bytes.fromhex(cleaned)
    except ValueError as e:
        raise ValueError(f"Invalid hex characters in {name}: {e}")
    return cleaned


class LearningValidator:
    """Formal verifier and transaction gatekeeper for AI learning validity claims."""

    _OWNER_ROOT_KEYS: Set[str] = set()
    _OWNER_AUTHORIZED_VALIDATORS: Set[str] = set()
    _REVOKED_VALIDATORS: Set[str] = set()
    _GLOBAL_TOMBSTONES: Set[str] = set()
    _GLOBAL_REVOCATION_LEDGER: list = []
    _TOMBSTONE_FILE_PATH: Optional[str] = None
    _LAST_LOADED_TOMBSTONE_STAT: Optional[Tuple[str, int, int]] = None
    _LOADED_LEDGER_KEYS: Set[str] = set()

    @classmethod
    def register_owner_root_key(cls, owner_public_key: str | bytes) -> None:
        """Enrolls an authoritative owner root public key."""
        pk_hex = _normalize_hex_key(owner_public_key, "owner_root_public_key")
        cls._OWNER_ROOT_KEYS.add(pk_hex)

    @classmethod
    def register_authorized_validator(
        cls,
        validator_public_key: str | bytes,
        *,
        owner_attestation: Optional[Dict[str, Any] | str] = None,
        owner_root_public_key: Optional[str | bytes] = None,
    ) -> None:
        """Enrolls a validator public key with cryptographic attestation from an enrolled owner root key."""
        pk_hex = _normalize_hex_key(validator_public_key, "validator_public_key")
        if pk_hex in cls._REVOKED_VALIDATORS or f"validator_pk:{pk_hex}" in cls._GLOBAL_TOMBSTONES:
            raise ValueError(f"Validator public key '{pk_hex}' has been revoked and cannot be re-enrolled")
        if owner_attestation is None or owner_root_public_key is None:
            raise ValueError(
                "Unauthenticated validator enrollment rejected: requires valid owner attestation "
                "signed by an enrolled owner root key"
            )
        owner_hex = _normalize_hex_key(owner_root_public_key, "owner_root_public_key")
        if not cls._OWNER_ROOT_KEYS or owner_hex not in cls._OWNER_ROOT_KEYS:
            raise ValueError(f"Unauthorized owner root key '{owner_hex}': not enrolled in owner root keys")
        if not cls._verify_owner_attestation_internal(owner_attestation, owner_hex, pk_hex):
            raise ValueError("Invalid owner attestation signature for validator enrollment")
        cls._OWNER_AUTHORIZED_VALIDATORS.add(pk_hex)

    @classmethod
    def revoke_validator_key(
        cls,
        validator_public_key: str | bytes,
        *,
        owner_signing_key: str | bytes,
        owner_public_key: str | bytes,
        reason: str = "VALIDATOR_KEY_REVOKED",
    ) -> Dict[str, Any]:
        """Cryptographically revokes a validator key under an enrolled owner root key and persists a tombstone."""
        val_hex = _normalize_hex_key(validator_public_key, "validator_public_key")
        owner_pk_hex = _normalize_hex_key(owner_public_key, "owner_public_key")
        if not cls._OWNER_ROOT_KEYS or owner_pk_hex not in cls._OWNER_ROOT_KEYS:
            raise ValueError(f"Unauthorized owner root key '{owner_pk_hex}': cannot revoke validator key")
        sk_bytes = bytes.fromhex(owner_signing_key) if isinstance(owner_signing_key, str) else owner_signing_key
        pk_bytes = bytes.fromhex(owner_pk_hex)
        ts = time.time()
        payload = {
            "action": "REVOKE_VALIDATOR_KEY",
            "owner_public_key": owner_pk_hex,
            "reason": reason,
            "timestamp": ts,
            "validator_public_key": val_hex,
        }
        canonical = rfc8785_canonicalize(payload)
        sig = ed25519_sign(sk_bytes, pk_bytes, canonical)
        if not ed25519_verify(pk_bytes, canonical, sig):
            raise ValueError("Invalid owner signature for validator key revocation")
        cls._OWNER_AUTHORIZED_VALIDATORS.discard(val_hex)
        cls._REVOKED_VALIDATORS.add(val_hex)
        cls._GLOBAL_TOMBSTONES.add(f"validator_pk:{val_hex}")
        entry = {
            "receipt_hash": None,
            "evidence_hash": None,
            "tx_id": None,
            "target_model_id": None,
            "revoked_validator_pk": val_hex,
            "reason": reason,
            "details": f"Revoked by owner {owner_pk_hex}",
            "signature": sig.hex(),
            "timestamp": ts,
        }
        cls._GLOBAL_REVOCATION_LEDGER.append(entry)
        cls._persist_tombstone_entry(entry)
        return entry

    @classmethod
    def set_tombstone_store_path(cls, path: Optional[str | Path]) -> None:
        """Sets the persistent file path for durable revocation tombstones."""
        cls._TOMBSTONE_FILE_PATH = str(path) if path is not None else None
        cls._LAST_LOADED_TOMBSTONE_STAT = None

    @classmethod
    def _get_tombstone_path(cls) -> Path:
        target = cls._TOMBSTONE_FILE_PATH or os.environ.get("SPE_TOMBSTONE_STORE_PATH")
        if target:
            return Path(target)
        return Path.home() / ".spe" / "revocations" / "tombstones.jsonl"

    @classmethod
    def _persist_tombstone_entry(cls, entry: Dict[str, Any]) -> None:
        """Persists a tombstone record to durable filesystem storage with advisory file locking. Fails closed when explicitly configured."""
        import fcntl

        p = cls._get_tombstone_path()
        explicit = bool(cls._TOMBSTONE_FILE_PATH or os.environ.get("SPE_TOMBSTONE_STORE_PATH"))
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            serialized_line = json.dumps(entry, sort_keys=True)
            dedup_key = hashlib.sha256(serialized_line.encode("utf-8")).hexdigest()
            cls._LOADED_LEDGER_KEYS.add(dedup_key)
            with p.open("a", encoding="utf-8") as f:
                try:
                    fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                except OSError:
                    pass
                try:
                    f.write(serialized_line + "\n")
                    f.flush()
                finally:
                    try:
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                    except OSError:
                        pass
            try:
                st = p.stat()
                cls._LAST_LOADED_TOMBSTONE_STAT = (str(p), st.st_mtime_ns, st.st_size)
            except OSError:
                cls._LAST_LOADED_TOMBSTONE_STAT = None
        except OSError as exc:
            if explicit:
                raise RuntimeError(f"Failed to persist revocation tombstone to '{p}': {exc}") from exc

    @classmethod
    def load_tombstones_from_disk(cls, path: Optional[str | Path] = None) -> int:
        """Loads persistent tombstones from disk into global validator registries."""
        p = Path(path) if path else cls._get_tombstone_path()
        if not p.is_file():
            return 0
        try:
            st = p.stat()
            stat_sig = (str(p), st.st_mtime_ns, st.st_size)
            if path is None and cls._LAST_LOADED_TOMBSTONE_STAT == stat_sig:
                return 0
        except OSError:
            stat_sig = None

        import fcntl
        loaded = 0
        try:
            with p.open("r", encoding="utf-8") as f:
                try:
                    fcntl.flock(f.fileno(), fcntl.LOCK_SH)
                except OSError:
                    pass
                try:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            entry = json.loads(line)
                            dedup_key = hashlib.sha256(line.encode("utf-8")).hexdigest()
                            if dedup_key not in cls._LOADED_LEDGER_KEYS:
                                cls._LOADED_LEDGER_KEYS.add(dedup_key)
                                cls._GLOBAL_REVOCATION_LEDGER.append(entry)
                            for k in (entry.get("receipt_hash"), entry.get("evidence_hash")):
                                if k and isinstance(k, str) and k.strip():
                                    cls._GLOBAL_TOMBSTONES.add(k.strip().lower())
                            tx_id = entry.get("tx_id")
                            target_model_id = entry.get("target_model_id")
                            if tx_id and target_model_id:
                                cls._GLOBAL_TOMBSTONES.add(f"{tx_id}:{target_model_id}")
                            elif tx_id:
                                cls._GLOBAL_TOMBSTONES.add(f"tx:{tx_id}")
                            revoked_vpk = entry.get("revoked_validator_pk")
                            if revoked_vpk and isinstance(revoked_vpk, str) and revoked_vpk.strip():
                                vpk = revoked_vpk.strip().lower()
                                cls._REVOKED_VALIDATORS.add(vpk)
                                cls._GLOBAL_TOMBSTONES.add(f"validator_pk:{vpk}")
                                cls._OWNER_AUTHORIZED_VALIDATORS.discard(vpk)
                            loaded += 1
                        except (json.JSONDecodeError, KeyError):
                            continue
                finally:
                    try:
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                    except OSError:
                        pass
            if path is None and stat_sig is not None:
                cls._LAST_LOADED_TOMBSTONE_STAT = stat_sig
        except OSError:
            return loaded
        return loaded

    @classmethod
    def _record_global_tombstone(
        cls,
        receipt_hash: Optional[str] = None,
        evidence_hash: Optional[str] = None,
        tx_id: Optional[str] = None,
        target_model_id: Optional[str] = None,
        reason: Optional[str] = None,
        details: Optional[str] = None,
    ) -> None:
        """Class-level recording of durable revocation tombstones."""
        entry = {
            "receipt_hash": receipt_hash,
            "evidence_hash": evidence_hash,
            "tx_id": tx_id,
            "target_model_id": target_model_id,
            "reason": reason,
            "details": details,
            "timestamp": time.time(),
        }
        cls._GLOBAL_REVOCATION_LEDGER.append(entry)
        for key in (receipt_hash, evidence_hash):
            if key and isinstance(key, str) and key.strip():
                cls._GLOBAL_TOMBSTONES.add(key.strip().lower())
        if tx_id and target_model_id:
            cls._GLOBAL_TOMBSTONES.add(f"{tx_id}:{target_model_id}")
        elif tx_id:
            cls._GLOBAL_TOMBSTONES.add(f"tx:{tx_id}")
        cls._persist_tombstone_entry(entry)

    @classmethod
    def clear_owner_registries(cls) -> None:
        cls._OWNER_ROOT_KEYS.clear()
        cls._OWNER_AUTHORIZED_VALIDATORS.clear()
        cls._REVOKED_VALIDATORS.clear()
        cls._GLOBAL_TOMBSTONES.clear()
        cls._GLOBAL_REVOCATION_LEDGER.clear()
        cls._TOMBSTONE_FILE_PATH = None
        cls._LAST_LOADED_TOMBSTONE_STAT = None
        cls._LOADED_LEDGER_KEYS.clear()

    def __init__(
        self,
        default_signing_key: Optional[bytes] = None,
        default_public_key: Optional[bytes] = None,
        trusted_oracle_keys: Optional[Any] = None,
        trusted_oracles: Optional[Dict[str, str] | Set[str]] = None,
        *,
        owner_root_public_key: Optional[str | bytes] = None,
        owner_attestation: Optional[Dict[str, Any] | str] = None,
        is_owner_authorized: Optional[bool] = None,
        require_cryptographic_owner_authority: bool = False,
    ) -> None:
        if default_signing_key and default_public_key:
            self._sk = default_signing_key
            self._pk = default_public_key
            self._is_configured_key = True
        else:
            self._sk, self._pk = generate_keypair()
            self._is_configured_key = False

        self._owner_root_public_key: Optional[str] = None
        if owner_root_public_key is not None:
            self._owner_root_public_key = _normalize_hex_key(owner_root_public_key, "owner_root_public_key")

        self._revocation_tombstones: Set[str] = set()
        self._revocation_ledger: list = []

        # Automatically load persistent tombstones into global and instance state first
        self.load_tombstones_from_disk()

        pk_hex = self._pk.hex().lower()
        is_revoked = pk_hex in self._REVOKED_VALIDATORS or f"validator_pk:{pk_hex}" in self._GLOBAL_TOMBSTONES

        if is_owner_authorized is not None:
            raise ValueError(
                "Caller cannot self-assert owner authorization: 'is_owner_authorized' parameter is forbidden. "
                "Authority must be cryptographically attested by an enrolled owner root key."
            )
        elif is_revoked:
            self._is_owner_authorized = False
            self._has_cryptographic_owner_authority = False
        elif self._owner_root_public_key is not None:
            if not self._OWNER_ROOT_KEYS or self._owner_root_public_key not in self._OWNER_ROOT_KEYS:
                self._is_owner_authorized = False
                self._has_cryptographic_owner_authority = False
            else:
                verified = self._verify_owner_attestation_internal(
                    owner_attestation,
                    self._owner_root_public_key,
                    pk_hex,
                )
                self._is_owner_authorized = verified
                self._has_cryptographic_owner_authority = verified
        elif pk_hex in self._OWNER_AUTHORIZED_VALIDATORS:
            self._is_owner_authorized = True
            self._has_cryptographic_owner_authority = True
        elif self._OWNER_ROOT_KEYS:
            self._is_owner_authorized = False
            self._has_cryptographic_owner_authority = False
        else:
            self._is_owner_authorized = True
            self._has_cryptographic_owner_authority = False

        if require_cryptographic_owner_authority and not self._has_cryptographic_owner_authority:
            raise ValueError(
                "Unauthorized LearningValidator: cryptographic owner attestation from an enrolled owner root key "
                "is required (validator is unattested or revoked)."
            )

        # Trusted oracle registry: binds oracle_id -> public_key_hex (64 hex lowercase)
        # Default behavior MUST FAIL CLOSED. No self-reported trust roots.
        self._trusted_oracles: Dict[str, str] = {}
        self._trusted_oracle_keys: Set[str] = set()

        sources = []
        if trusted_oracles is not None:
            sources.append(trusted_oracles)
        if trusted_oracle_keys is not None:
            sources.append(trusted_oracle_keys)

        for src in sources:
            if isinstance(src, dict):
                for oid, pkey in src.items():
                    oid_str = str(oid).strip()
                    if not oid_str:
                        raise ValueError("Oracle ID in trusted_oracles cannot be empty")
                    pkey_str = _validate_oracle_key(pkey, oid_str)
                    self._trusted_oracles[oid_str] = pkey_str
                    self._trusted_oracle_keys.add(pkey_str)
            elif isinstance(src, (set, list, tuple)):
                for item in src:
                    if isinstance(item, tuple) and len(item) == 2:
                        oid_str = str(item[0]).strip()
                        if not oid_str:
                            raise ValueError("Oracle ID in trusted_oracles tuple cannot be empty")
                        pkey_str = _validate_oracle_key(item[1], oid_str)
                        self._trusted_oracles[oid_str] = pkey_str
                        self._trusted_oracle_keys.add(pkey_str)
                    elif isinstance(item, str):
                        item_str = item.strip()
                        if not item_str:
                            continue
                        if ":" in item_str:
                            oid_str, pkey_str = item_str.split(":", 1)
                            oid_str = oid_str.strip()
                            if not oid_str:
                                raise ValueError("Oracle ID in trusted_oracles entry cannot be empty")
                            pkey_str = _validate_oracle_key(pkey_str, oid_str)
                            self._trusted_oracles[oid_str] = pkey_str
                            self._trusted_oracle_keys.add(pkey_str)
                        else:
                            pkey_str = _validate_oracle_key(item_str, "")
                            self._trusted_oracle_keys.add(pkey_str)

    @property
    def public_key(self) -> bytes:
        return self._pk

    @property
    def is_owner_authorized(self) -> bool:
        self.load_tombstones_from_disk()
        pk_hex = self._pk.hex().lower()
        if pk_hex in self._REVOKED_VALIDATORS or f"validator_pk:{pk_hex}" in self._GLOBAL_TOMBSTONES:
            return False
        return self._is_owner_authorized

    @property
    def has_cryptographic_owner_authority(self) -> bool:
        self.load_tombstones_from_disk()
        pk_hex = self._pk.hex().lower()
        if pk_hex in self._REVOKED_VALIDATORS or f"validator_pk:{pk_hex}" in self._GLOBAL_TOMBSTONES:
            return False
        return self._has_cryptographic_owner_authority

    @staticmethod
    def _verify_owner_attestation_internal(
        attestation: Optional[Any],
        owner_root_pk_hex: str,
        validator_pk_hex: str,
    ) -> bool:
        import math

        if not attestation or not isinstance(attestation, dict):
            return False
        vpk = validator_pk_hex.lower()
        if vpk in LearningValidator._REVOKED_VALIDATORS or f"validator_pk:{vpk}" in LearningValidator._GLOBAL_TOMBSTONES:
            return False
        if attestation.get("verdict") != "APPROVED":
            return False
        if attestation.get("scope") != "PRODUCTION_LEARNING_VALIDATION":
            return False
        if str(attestation.get("validator_public_key", "")).lower() != vpk:
            return False
        if str(attestation.get("owner_public_key", "")).lower() != owner_root_pk_hex.lower():
            return False
        ts = attestation.get("timestamp")
        if isinstance(ts, bool) or not isinstance(ts, (int, float)) or not math.isfinite(ts) or ts <= 0.0:
            return False
        sig_hex = attestation.get("signature")
        if not sig_hex or not isinstance(sig_hex, str) or len(sig_hex) != 128:
            return False
        try:
            sig_bytes = bytes.fromhex(sig_hex)
            owner_pk_bytes = bytes.fromhex(owner_root_pk_hex)
        except ValueError:
            return False

        canonical_dict = {
            "owner_public_key": owner_root_pk_hex.lower(),
            "scope": attestation["scope"],
            "timestamp": ts,
            "validator_public_key": vpk,
            "verdict": attestation["verdict"],
        }
        canonical_bytes = rfc8785_canonicalize(canonical_dict)
        return ed25519_verify(owner_pk_bytes, canonical_bytes, sig_bytes)

    def record_tombstone(
        self,
        receipt_hash: Optional[str] = None,
        evidence_hash: Optional[str] = None,
        tx_id: Optional[str] = None,
        target_model_id: Optional[str] = None,
        reason: Optional[str] = None,
        details: Optional[str] = None,
    ) -> None:
        """Durable persistent tombstone recording for revoked receipts/evidence."""
        entry = {
            "receipt_hash": receipt_hash,
            "evidence_hash": evidence_hash,
            "tx_id": tx_id,
            "target_model_id": target_model_id,
            "reason": reason,
            "details": details,
            "timestamp": time.time(),
        }
        self._revocation_ledger.append(entry)
        self._GLOBAL_REVOCATION_LEDGER.append(entry)
        for key in (receipt_hash, evidence_hash):
            if key and isinstance(key, str) and key.strip():
                k = key.strip().lower()
                self._revocation_tombstones.add(k)
                self._GLOBAL_TOMBSTONES.add(k)
        if tx_id and target_model_id:
            binding_key = f"{tx_id}:{target_model_id}"
            self._revocation_tombstones.add(binding_key)
            self._GLOBAL_TOMBSTONES.add(binding_key)
        if tx_id and not target_model_id:
            tx_key = f"tx:{tx_id}"
            self._revocation_tombstones.add(tx_key)
            self._GLOBAL_TOMBSTONES.add(tx_key)
        self._persist_tombstone_entry(entry)

    def is_tombstoned(
        self,
        receipt_hash: Optional[str] = None,
        evidence_hash: Optional[str] = None,
        tx_id: Optional[str] = None,
        target_model_id: Optional[str] = None,
    ) -> bool:
        """Checks if a receipt, evidence, or transfer binding has a durable revocation tombstone."""
        keys_to_check = []
        if receipt_hash:
            keys_to_check.append(str(receipt_hash).strip().lower())
        if evidence_hash:
            keys_to_check.append(str(evidence_hash).strip().lower())
        if tx_id and target_model_id:
            keys_to_check.append(f"{tx_id}:{target_model_id}")
        if tx_id:
            keys_to_check.append(f"tx:{tx_id}")

        if any(
            k in self._revocation_tombstones or k in self._GLOBAL_TOMBSTONES
            for k in keys_to_check
        ):
            return True

        self.load_tombstones_from_disk()
        if any(
            k in self._revocation_tombstones or k in self._GLOBAL_TOMBSTONES
            for k in keys_to_check
        ):
            return True

        return False

    def evaluate_conjuncts(self, tx: LearningValidityTransaction) -> Dict[str, bool]:
        """Evaluates each of the six formal conjuncts of the LVT admission rule."""
        results = tx.results
        claim = tx.claim
        protocol = tx.protocol

        contract_valid = bool(
            claim.claim_id
            and claim.base_prompt_ref
            and claim.candidate_prompt_ref
            and protocol.protocol_id
        )

        if not results and not tx.lvt2_study_result:
            return {
                "ContractValid": contract_valid,
                "ExperimentAuthorized": False,
                "EvidenceAuthentic": False,
                "EvaluationIndependent": False,
                "ImprovementSupported": False,
                "NoDisqualifyingRegression": False,
            }

        # Independent evaluation: evaluator != generator and not self-type
        eval_independent = (
            tx.evaluator_type != EvaluatorType.GENERATING_MODEL_SELF
            and tx.evaluator_id != claim.generator_id
            and bool(tx.evaluator_id)
        )

        if tx.lvt2_study_result:
            study = tx.lvt2_study_result
            improvement_supported = (
                study.status == "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED"
                and study.train_candidate_minus_base > 0.0
                and study.train_candidate_minus_shuffled > 0.0
                and study.family_macro_delta >= 0.0
                and study.p_value <= study.alpha_adjusted
                and "EFFECT_FLOOR_UNMET" not in study.reasons
                and "PAIRED_DIRECTIONAL_TEST_INCONCLUSIVE" not in study.reasons
                and "INSUFFICIENT_INDEPENDENT_FAMILIES" not in study.reasons
            )
            no_regression = (
                study.family_macro_delta >= 0.0
                and study.status not in ("REJECTED", "INCONCLUSIVE")
                and "HELDOUT_REGRESSION" not in study.reasons
            )
            return {
                "ContractValid": contract_valid,
                "ExperimentAuthorized": True,
                "EvidenceAuthentic": 0.0 <= study.holdout_base_mean <= 1.0 and 0.0 <= study.holdout_candidate_mean <= 1.0,
                "EvaluationIndependent": eval_independent,
                "ImprovementSupported": improvement_supported,
                "NoDisqualifyingRegression": no_regression,
            }

        # Check authorization & budget limits
        budget_ok = results.total_cost_nanos <= claim.budget_nanos
        experiment_authorized = budget_ok and (results.total_cost_nanos <= protocol.max_cost_nanos)

        # Evidence authenticity
        scores = [
            results.arm_a_baseline_score,
            results.arm_b_authentic_score,
            results.arm_c_shuffled_control_score,
            results.arm_d_generalization_score,
        ]
        evidence_authentic = protocol.sample_size >= 2 and all(0.0 <= s <= 1.0 for s in scores)

        # Supported improvement: Arm B beats baseline and shuffled control by epsilon
        improvement_supported = (
            results.delta_improvement >= protocol.significance_threshold_epsilon
            and results.control_delta >= protocol.significance_threshold_epsilon
        )

        # No disqualifying regression: Held-out Arm D retention within tolerance and statistically significant
        # Ensure held-out delta is strictly paired with arm_d_baseline_score, NOT arm_a_baseline_score!
        unpaired_mismatch = False
        if results.arm_d_baseline_score > 0.0 and abs(results.arm_d_baseline_score - results.arm_a_baseline_score) > 1e-4:
            if (
                abs(results.held_out_retention - (results.arm_d_generalization_score - results.arm_a_baseline_score)) < 1e-4
                and abs(results.held_out_retention - (results.arm_d_generalization_score - results.arm_d_baseline_score)) > 1e-4
            ):
                unpaired_mismatch = True

        paired_retention = (
            (results.arm_d_generalization_score - results.arm_d_baseline_score)
            if results.arm_d_baseline_score > 0.0
            else results.held_out_retention
        )

        no_regression = (
            not unpaired_mismatch
            and results.held_out_retention >= -protocol.generalization_tolerance_delta
            and paired_retention >= -protocol.generalization_tolerance_delta
            and results.is_statistically_significant
        )

        return {
            "ContractValid": contract_valid,
            "ExperimentAuthorized": experiment_authorized,
            "EvidenceAuthentic": evidence_authentic,
            "EvaluationIndependent": eval_independent,
            "ImprovementSupported": improvement_supported,
            "NoDisqualifyingRegression": no_regression,
        }

    def validate_and_commit(
        self,
        tx: LearningValidityTransaction,
        signing_key: Optional[bytes] = None,
        public_key: Optional[bytes] = None,
        strict: bool = False,
    ) -> LearningValidityTransaction:
        """
        Validates learning claim against the formal conjuncts.
        If self-certification is attempted, immediately raises GeneratingModelSelfCertificationError.
        If valid, signs and commits the transaction into QUALIFIED or RESEARCH_SUPPORTED status.
        If legacy V1 aggregate-only results are supplied:
            Fails closed to RESEARCH_UNQUALIFIED (production QUALIFIED cannot be minted).
        """
        # Hard Invariant: Reject self-certification immediately
        if (
            tx.evaluator_type == EvaluatorType.GENERATING_MODEL_SELF
            or (tx.evaluator_id and tx.evaluator_id == tx.claim.generator_id)
        ):
            tx.status = QualificationStatus.REJECTED
            tx.rejection_reason = (
                f"Self-certification rejected: Generator '{tx.claim.generator_id}' "
                f"cannot evaluate its own claim (evaluator: '{tx.evaluator_id}', type: {tx.evaluator_type.value})"
            )
            raise GeneratingModelSelfCertificationError(tx.rejection_reason)

        conjuncts = self.evaluate_conjuncts(tx)
        all_passed = all(conjuncts.values())

        if not all_passed:
            failed = [k for k, v in conjuncts.items() if not v]
            reason = f"LVT admission rule violation: failed conjuncts: {', '.join(failed)}"
            if tx.lvt2_study_result is not None:
                study = tx.lvt2_study_result
                if study.status == "INCONCLUSIVE":
                    tx.status = QualificationStatus.INCONCLUSIVE
                    tx.rejection_reason = f"LVT-2 study inconclusive: {', '.join(study.reasons)}"
                else:
                    tx.status = QualificationStatus.REJECTED
                    tx.rejection_reason = f"LVT-2 study rejected: {', '.join(study.reasons)}" if study.reasons else reason
            else:
                tx.status = QualificationStatus.REJECTED
                tx.rejection_reason = reason
            tx.artifact_hash = ""
            tx.canonical_receipt_signature = ""
            tx.committed_timestamp = None
            tx.metadata.pop("public_key", None)
            if strict:
                raise LearningValidityRuleViolation(tx.rejection_reason)
            return tx

        # LVT-2 & Custody Gate:
        # Prevent legacy V1 aggregate-only results from minting production qualification
        if tx.lvt2_study_result is not None:
            study = tx.lvt2_study_result
            tx.protocol_version = "LVT-2"
            if study.status == "REJECTED":
                tx.status = QualificationStatus.REJECTED
                tx.rejection_reason = f"LVT-2 study rejected: {', '.join(study.reasons)}"
                return tx
            elif study.status == "INCONCLUSIVE":
                tx.status = QualificationStatus.INCONCLUSIVE
                tx.rejection_reason = f"LVT-2 study inconclusive: {', '.join(study.reasons)}"
                return tx
            elif study.status == "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED":
                oracle_ok, oracle_msg = self.verify_oracle_attestation(
                    tx.oracle_attestation,
                    study.evidence_hash,
                    expected_oracle_id=tx.evaluator_id,
                )
                if oracle_ok:
                    self._is_owner_authorized = self.is_owner_authorized
                    if not self._is_owner_authorized:
                        tx.status = QualificationStatus.REJECTED
                        tx.is_attested_oracle = False
                        tx.rejection_reason = (
                            "Unauthorized LearningValidator: validator lacks owner root-of-trust authorization "
                            "to mint production QUALIFIED receipt"
                        )
                        if strict:
                            raise LearningValidityRuleViolation(tx.rejection_reason)
                        return tx
                    tx.status = QualificationStatus.QUALIFIED
                    tx.is_attested_oracle = True
                    tx.rejection_reason = None
                else:
                    tx.is_attested_oracle = False
                    # Distinguish rejection (tampered evidence, unapproved verdict, identity mismatch)
                    if tx.oracle_attestation is not None and any(
                        kw in oracle_msg for kw in ("mismatch", "unapproved", "invalid", "untrusted")
                    ):
                        tx.status = QualificationStatus.REJECTED
                        tx.rejection_reason = f"Oracle attestation rejected: {oracle_msg}"
                        if strict:
                            raise LearningValidityRuleViolation(tx.rejection_reason)
                        return tx
                    else:
                        tx.status = QualificationStatus.RESEARCH_SUPPORTED
                        tx.rejection_reason = (
                            "Research supported by family-level exact sign test; "
                            f"external oracle attestation required for production qualification ({oracle_msg})."
                        )
            else:
                tx.status = QualificationStatus.REJECTED
                tx.rejection_reason = f"Unknown LVT-2 study status: {study.status}"
                return tx
        else:
            # Legacy V1 aggregate-only: FAIL CLOSED. Production bypass is strictly forbidden.
            tx.status = QualificationStatus.RESEARCH_UNQUALIFIED
            tx.canonical_receipt_signature = ""
            tx.artifact_hash = ""
            tx.rejection_reason = (
                "V1 aggregate-only results cannot mint production QUALIFIED receipt. "
                "LVT-2 family-level evaluation and independent oracle attestation required."
            )
            return tx

        if tx.status in (QualificationStatus.QUALIFIED, QualificationStatus.RESEARCH_SUPPORTED):
            tx.committed_timestamp = time.time()
            tx.metadata["committed_protocol_id"] = tx.protocol.protocol_id
            if tx.lvt2_study_result is not None:
                tx.metadata["committed_evidence_hash"] = tx.lvt2_study_result.evidence_hash
            if tx.oracle_attestation is not None:
                tx.metadata["trusted_oracle_id"] = tx.oracle_attestation.oracle_id
                tx.metadata["trusted_oracle_public_key"] = tx.oracle_attestation.oracle_public_key.lower()
            receipt_dict = self._build_receipt_dict(tx)
            canonical_bytes = rfc8785_canonicalize(receipt_dict)
            tx.artifact_hash = hashlib.sha256(canonical_bytes).hexdigest()

            sk = signing_key or self._sk
            pk = public_key or self._pk
            sig_bytes = ed25519_sign(sk, pk, canonical_bytes)
            tx.canonical_receipt_signature = sig_bytes.hex()
            tx.metadata["public_key"] = pk.hex()
        else:
            tx.canonical_receipt_signature = ""
            tx.artifact_hash = ""

        return tx

    @classmethod
    def mint_test_fixture_receipt(
        cls,
        tx: LearningValidityTransaction,
        signing_key: Optional[bytes] = None,
        public_key: Optional[bytes] = None,
    ) -> LearningValidityTransaction:
        """
        Separately scoped test-only mechanism for test fixture mock receipt serialization.
        Explicitly flagged as test-only; CANNOT enter production qualification.
        """
        tx.metadata["test_fixture_mock"] = True
        tx.status = QualificationStatus.RESEARCH_UNQUALIFIED
        tx.committed_timestamp = time.time()
        receipt_dict = cls._build_receipt_dict(tx)
        canonical_bytes = rfc8785_canonicalize(receipt_dict)
        tx.artifact_hash = hashlib.sha256(canonical_bytes).hexdigest()
        sk, pk = (signing_key, public_key) if (signing_key and public_key) else generate_keypair()
        sig_bytes = ed25519_sign(sk, pk, canonical_bytes)
        tx.canonical_receipt_signature = sig_bytes.hex()
        tx.metadata["public_key"] = pk.hex()
        return tx

    @staticmethod
    def _build_receipt_dict(tx: LearningValidityTransaction) -> Dict[str, Any]:
        study = tx.lvt2_study_result
        if study:
            arm_a = study.holdout_base_mean
            arm_b = study.holdout_candidate_mean
            arm_c = study.train_candidate_minus_shuffled
            arm_d = study.holdout_candidate_mean
            delta = study.family_macro_delta
        elif tx.results:
            arm_a = tx.results.arm_a_baseline_score
            arm_b = tx.results.arm_b_authentic_score
            arm_c = tx.results.arm_c_shuffled_control_score
            arm_d = tx.results.arm_d_generalization_score
            delta = tx.results.delta_improvement
        else:
            arm_a = arm_b = arm_c = arm_d = delta = 0.0

        receipt: Dict[str, Any] = {
            "tx_id": tx.tx_id,
            "claim_id": tx.claim.claim_id,
            "domain": tx.claim.domain,
            "generator_id": tx.claim.generator_id,
            "evaluator_id": tx.evaluator_id,
            "evaluator_type": tx.evaluator_type.value,
            "status": tx.status.value,
            "results": {
                "arm_a": arm_a,
                "arm_b": arm_b,
                "arm_c": arm_c,
                "arm_d": arm_d,
                "delta": delta,
            },
            "timestamp": tx.committed_timestamp,
        }
        if study:
            receipt["evidence_hash"] = study.evidence_hash
            receipt["protocol_version"] = "LVT-2"
        return receipt

    def verify_transaction_signature(
        self,
        tx: LearningValidityTransaction,
        public_key: Optional[bytes] = None,
    ) -> bool:
        """Cryptographically verifies the transaction's Ed25519 receipt signature against this validator's pinned public key."""
        if not self.is_owner_authorized:
            return False
        if tx.status == QualificationStatus.REVOKED:
            return False
        if not tx.canonical_receipt_signature or not tx.committed_timestamp:
            return False
        if not tx.artifact_hash:
            return False
        study_ev_hash = tx.lvt2_study_result.evidence_hash if tx.lvt2_study_result else None
        if self.is_tombstoned(
            receipt_hash=tx.artifact_hash,
            evidence_hash=study_ev_hash,
            tx_id=tx.tx_id,
        ):
            return False
        if public_key is not None and public_key != self._pk:
            return False
        if tx.metadata.get("public_key", self._pk.hex()) != self._pk.hex():
            return False

        receipt_dict = self._build_receipt_dict(tx)
        canonical_bytes = rfc8785_canonicalize(receipt_dict)
        if hashlib.sha256(canonical_bytes).hexdigest() != tx.artifact_hash:
            return False
        try:
            sig_bytes = bytes.fromhex(tx.canonical_receipt_signature)
        except ValueError:
            return False
        return ed25519_verify(self._pk, canonical_bytes, sig_bytes)

    def verify_oracle_attestation(
        self,
        attestation: Optional[OracleAttestation],
        expected_evidence_hash: str,
        expected_oracle_id: Optional[str] = None,
    ) -> Tuple[bool, str]:
        """
        Cryptographically verifies an independent oracle attestation.
        Requires fail-closed verification against an authoritative trusted oracle registry,
        strict oracle identity binding, matching evidence hash, valid format, and valid signature.
        """
        if attestation is None:
            return False, "missing attestation"

        if not attestation.oracle_id or not attestation.oracle_id.strip():
            return False, "missing or empty oracle identity"

        if attestation.verdict != "APPROVED":
            return False, f"unapproved verdict: {attestation.verdict}"

        if not attestation.evidence_hash or attestation.evidence_hash != expected_evidence_hash:
            return False, f"evidence hash mismatch ({attestation.evidence_hash} != {expected_evidence_hash})"

        if not attestation.oracle_public_key or len(attestation.oracle_public_key) != 64:
            return False, "invalid oracle public key format"

        if not attestation.signature or len(attestation.signature) != 128:
            return False, "invalid signature format"

        # FAIL CLOSED: Require configured trusted oracle registry
        if not self._trusted_oracles and not self._trusted_oracle_keys:
            return False, "no trusted oracle registry configured (fail closed)"

        # Binding check against expected evaluator/oracle identity (Task 2 F & Mutant M05)
        if expected_oracle_id and attestation.oracle_id != expected_oracle_id:
            return False, f"oracle identity mismatch: attestation oracle_id '{attestation.oracle_id}' != expected '{expected_oracle_id}'"

        oracle_pk = attestation.oracle_public_key.lower()

        # Check against trusted oracle registry bindings
        if self._trusted_oracles:
            if attestation.oracle_id not in self._trusted_oracles:
                return False, f"untrusted oracle identity: {attestation.oracle_id}"
            if self._trusted_oracles[attestation.oracle_id] != oracle_pk:
                return False, f"trusted key mismatch for oracle identity: {attestation.oracle_id}"

        if self._trusted_oracle_keys:
            if oracle_pk not in self._trusted_oracle_keys:
                return False, f"untrusted oracle public key: {attestation.oracle_public_key}"

        try:
            pk_bytes = bytes.fromhex(attestation.oracle_public_key)
            sig_bytes = bytes.fromhex(attestation.signature)
        except ValueError as e:
            return False, f"hex decoding error: {e}"

        attestation_dict = {
            "evidence_hash": attestation.evidence_hash,
            "oracle_id": attestation.oracle_id,
            "oracle_public_key": attestation.oracle_public_key,
            "timestamp": attestation.timestamp,
            "verdict": attestation.verdict,
        }
        canonical_bytes = rfc8785_canonicalize(attestation_dict)
        if not ed25519_verify(pk_bytes, canonical_bytes, sig_bytes):
            return False, "invalid cryptographic signature"

        return True, "verified"

    @staticmethod
    def _build_transfer_receipt_dict(
        tx: LearningValidityTransaction,
        report: Dict[str, Any],
    ) -> Dict[str, Any]:
        receipt: Dict[str, Any] = {
            "tx_id": report["tx_id"],
            "parent_artifact_hash": report["parent_artifact_hash"],
            "parent_protocol_id": report["parent_protocol_id"],
            "parent_evidence_hash": report["parent_evidence_hash"],
            "source_generator": report["source_generator"],
            "target_model_id": report["target_model_id"],
            "target_model_digest": report["target_model_digest"],
            "transfer_protocol": report["transfer_protocol"],
            "protocol_digest": report["protocol_digest"],
            "dataset_digest": report["dataset_digest"],
            "family_manifest": report["family_manifest"],
            "observations_digest": report["observations_digest"],
            "evaluator_id": report["evaluator_id"],
            "oracle_public_key": report["oracle_public_key"],
            "oracle_attestation": report["oracle_attestation"],
            "evidence_hash": report["evidence_hash"],
            "statistical_verdict": report["statistical_verdict"],
            "base_score": report["base_score"],
            "refined_score": report["refined_score"],
            "transfer_delta": report["transfer_delta"],
            "transfers_successfully": report["transfers_successfully"],
            "sample_count": report["sample_count"],
            "revoked": report["revoked"],
        }
        if "model_digest_type" in report:
            receipt["model_digest_type"] = report["model_digest_type"]
        if "family_provenance" in report:
            receipt["family_provenance"] = report["family_provenance"]
        if "independence_assertions" in report:
            receipt["independence_assertions"] = report["independence_assertions"]
        return receipt

    def sign_model_transfer_receipt(
        self,
        tx: LearningValidityTransaction,
        report: Dict[str, Any],
    ) -> Tuple[str, str]:
        """Signs a canonical RFC 8785 cross-model transfer receipt under this validator's key."""
        if not self.is_owner_authorized:
            raise ValueError("Unauthorized LearningValidator: cannot sign cross-model transfer receipt without owner authority")
        receipt_dict = self._build_transfer_receipt_dict(tx, report)
        canonical_bytes = rfc8785_canonicalize(receipt_dict)
        receipt_hash = hashlib.sha256(canonical_bytes).hexdigest()
        sig_bytes = ed25519_sign(self._sk, self._pk, canonical_bytes)
        return receipt_hash, sig_bytes.hex()

    def verify_model_transfer_receipt(
        self,
        tx: LearningValidityTransaction,
        target_model_id: str,
        report: Any,
        *,
        allow_synthetic_models: bool = False,
    ) -> Tuple[bool, bool, str]:
        """
        Cryptographically verifies an authenticated cross-model transfer report.
        Returns (is_authentic, is_verified_transfer, reason).
        """
        from collections import defaultdict
        import math
        from spe_runtime.research.lvt.paired_gate_v2 import (
            VERSION,
            StudyProtocol,
            _DIGEST,
            _finite_score,
            _is_synthetic_model_digest,
            exact_sign_p,
        )

        if not isinstance(report, dict):
            return False, False, "Forged or malformed transfer metadata: report is not a dict"

        if report.get("revoked") is True or tx.status == QualificationStatus.REVOKED:
            return False, False, f"Cross-model transfer evidence for '{target_model_id}' has been revoked"

        if not self.is_owner_authorized:
            return False, False, "Untrusted validator: validator lacks owner root-of-trust authorization"

        receipt_hash = report.get("transfer_receipt_hash")
        evidence_hash = report.get("evidence_hash")
        parent_study_ev = tx.lvt2_study_result.evidence_hash if tx.lvt2_study_result else None
        if (
            self.is_tombstoned(
                receipt_hash=receipt_hash,
                evidence_hash=evidence_hash,
                tx_id=tx.tx_id,
                target_model_id=target_model_id,
            )
            or self.is_tombstoned(
                receipt_hash=tx.artifact_hash,
                evidence_hash=parent_study_ev,
                tx_id=tx.tx_id,
            )
        ):
            return False, False, f"Cross-model transfer evidence for '{target_model_id}' has been revoked (persistent tombstone enforced)"

        if not self._trusted_oracles and not self._trusted_oracle_keys:
            return False, False, "Untrusted validator: no trusted oracle registry configured"

        required_keys = (
            "tx_id",
            "parent_artifact_hash",
            "parent_protocol_id",
            "parent_evidence_hash",
            "source_generator",
            "target_model_id",
            "target_model_digest",
            "transfer_protocol",
            "protocol_digest",
            "dataset_digest",
            "family_manifest",
            "item_manifest",
            "paired_observations",
            "observations_digest",
            "evaluator_id",
            "oracle_public_key",
            "oracle_attestation",
            "evidence_hash",
            "statistical_verdict",
            "base_score",
            "refined_score",
            "transfer_delta",
            "transfers_successfully",
            "sample_count",
            "revoked",
            "transfer_receipt_hash",
            "transfer_receipt_signature",
            "validator_public_key",
        )
        for k in required_keys:
            if k not in report:
                return False, False, f"Forged or incomplete transfer metadata: missing '{k}'"

        if report.get("revoked") is True or self.is_tombstoned(
            receipt_hash=report.get("transfer_receipt_hash"),
            evidence_hash=report.get("evidence_hash"),
            tx_id=tx.tx_id,
            target_model_id=target_model_id,
        ):
            return False, False, "Transfer report has been revoked (persistent tombstone enforced)"

        if report.get("tx_id") != tx.tx_id or report.get("parent_artifact_hash") != tx.artifact_hash:
            return False, False, "Transfer report parent transaction binding mismatch"

        if not tx.protocol or report.get("parent_protocol_id") != tx.protocol.protocol_id:
            return False, False, "Replay against a changed parent protocol"

        if "committed_protocol_id" in tx.metadata and tx.protocol.protocol_id != tx.metadata["committed_protocol_id"]:
            return False, False, "Replay against a changed committed parent protocol"

        if not tx.lvt2_study_result or report.get("parent_evidence_hash") != tx.lvt2_study_result.evidence_hash:
            return False, False, "Transfer report parent study evidence hash mismatch"

        if report.get("target_model_id") != target_model_id:
            return False, False, f"Mismatched model identity: metadata key '{target_model_id}' != report target_model_id '{report.get('target_model_id')}'"

        model_digest = report.get("target_model_digest")
        if not isinstance(model_digest, str) or not _DIGEST.fullmatch(model_digest):
            return False, False, "Invalid target_model_digest in transfer report"

        digest_type = report.get("model_digest_type") or report.get("target_model_digest_type")
        if _is_synthetic_model_digest(target_model_id, model_digest) and digest_type == "VERIFIED_MODEL_REVISION":
            return False, False, (
                f"Synthetic model identifier digest cannot be classified as VERIFIED_MODEL_REVISION: "
                f"digest for '{target_model_id}' matches synthetic model name hash"
            )

        proto_raw = report.get("transfer_protocol")
        if not isinstance(proto_raw, dict):
            return False, False, "Invalid transfer_protocol format"
        try:
            proto = StudyProtocol(**proto_raw)
        except TypeError as exc:
            return False, False, f"Malformed transfer_protocol fields: {exc}"

        if proto.generator_id != target_model_id:
            return False, False, f"Mismatched model identity: transfer_protocol.generator_id '{proto.generator_id}' != '{target_model_id}'"
        if proto.model_digest != model_digest:
            return False, False, "Mismatched target_model_digest against transfer_protocol.model_digest"
        if proto.evaluator_id != report.get("evaluator_id"):
            return False, False, "Mismatched evaluator_id against transfer_protocol.evaluator_id"
        if proto.min_heldout_families < 20 or proto.family_level_significance is not True:
            return False, False, "Transfer protocol violates minimum independent family requirements"

        recomputed_proto_digest = hashlib.sha256(rfc8785_canonicalize(proto_raw)).hexdigest()
        if recomputed_proto_digest != report.get("protocol_digest"):
            return False, False, "Changed transfer protocol: protocol_digest mismatch"

        item_manifest = report.get("item_manifest")
        paired_obs = report.get("paired_observations")
        if not isinstance(item_manifest, list) or not isinstance(paired_obs, list):
            return False, False, "Invalid item_manifest or paired_observations list"
        if len(item_manifest) < 2 or len(paired_obs) != len(item_manifest):
            return False, False, "One-item or mismatched observation count in transfer report"

        seen_ids = set()
        seen_digests = set()
        grouped: dict[str, list[float]] = defaultdict(list)
        base_scores: list[float] = []
        cand_scores: list[float] = []
        for idx, obs in enumerate(paired_obs):
            if not isinstance(obs, dict):
                return False, False, "Malformed observation entry"
            iid = obs.get("item_id")
            fid = obs.get("family_id")
            csha = obs.get("content_sha256")
            b_sc = obs.get("base_score")
            c_sc = obs.get("candidate_score")
            if not isinstance(iid, str) or not iid.strip() or not isinstance(fid, str) or not fid.strip():
                return False, False, "Missing family-level provenance in transfer observations"
            if not isinstance(csha, str) or not _DIGEST.fullmatch(csha):
                return False, False, "Invalid content_sha256 in transfer observations"
            if iid in seen_ids or csha in seen_digests:
                return False, False, "Duplicate item_id or content_sha256 in transfer observations"
            if not _finite_score(b_sc) or not _finite_score(c_sc):
                return False, False, "Invalid observation score in transfer report"
            seen_ids.add(iid)
            seen_digests.add(csha)
            grouped[fid].append(float(c_sc) - float(b_sc))
            base_scores.append(float(b_sc))
            cand_scores.append(float(c_sc))

        families = sorted(grouped.keys())
        if families != report.get("family_manifest"):
            return False, False, "Tampered family_manifest in transfer report"
        if len(families) < max(20, proto.min_heldout_families):
            return False, False, "Insufficient independent held-out families in transfer report"

        if hashlib.sha256(rfc8785_canonicalize(item_manifest)).hexdigest() != report.get("dataset_digest"):
            return False, False, "Tampered dataset_digest in transfer report"
        if hashlib.sha256(rfc8785_canonicalize(paired_obs)).hexdigest() != report.get("observations_digest"):
            return False, False, "Tampered observations_digest in transfer report"

        evidence_payload = {
            "version": VERSION,
            "tx_id": tx.tx_id,
            "parent_artifact_hash": tx.artifact_hash,
            "target_model_id": target_model_id,
            "target_model_digest": model_digest,
            "protocol": proto_raw,
            "protocol_digest": recomputed_proto_digest,
            "dataset_digest": report["dataset_digest"],
            "family_manifest": families,
            "observations": paired_obs,
        }
        recomputed_evidence_hash = hashlib.sha256(rfc8785_canonicalize(evidence_payload)).hexdigest()
        if recomputed_evidence_hash != report.get("evidence_hash"):
            return False, False, "Tampered evaluation result: evidence_hash mismatch"

        family_deltas = [math.fsum(v) / len(v) for _, v in sorted(grouped.items())]
        macro_delta = math.fsum(family_deltas) / len(family_deltas)
        base_mean = math.fsum(base_scores) / len(base_scores)
        cand_mean = math.fsum(cand_scores) / len(cand_scores)
        positives = sum(d > 1e-12 for d in family_deltas)
        negatives = sum(d < -1e-12 for d in family_deltas)
        p_val = exact_sign_p(positives, negatives)
        alpha_adj = proto.alpha / proto.multiplicity
        reg_tol = float(report.get("statistical_verdict", {}).get("regression_tolerance", 0.05))
        recomputed_success = (
            macro_delta >= proto.primary_effect_floor
            and macro_delta >= -reg_tol
            and p_val <= alpha_adj
            and len(families) >= max(20, proto.min_heldout_families)
        )

        if report.get("transfers_successfully") is not recomputed_success:
            return False, False, "Tampered evaluation result: transfers_successfully does not match recomputed statistical verdict"
        verdict_dict = report.get("statistical_verdict")
        if not isinstance(verdict_dict, dict) or verdict_dict.get("transfers_successfully") is not recomputed_success:
            return False, False, "Tampered statistical_verdict in transfer report"

        if (
            not math.isclose(float(report.get("transfer_delta", -999.0)), round(macro_delta, 4), abs_tol=1e-4)
            or not math.isclose(float(report.get("base_score", -999.0)), round(base_mean, 4), abs_tol=1e-4)
            or not math.isclose(float(report.get("refined_score", -999.0)), round(cand_mean, 4), abs_tol=1e-4)
        ):
            return False, False, "Tampered evaluation result: summary scores do not match observations"

        # Finding D: Verify family provenance distinction if present
        fam_prov = report.get("family_provenance")
        if fam_prov is not None:
            if not isinstance(fam_prov, dict):
                return False, False, "Malformed family_provenance in transfer report"
            clusters = set()
            for fid in families:
                if fid not in fam_prov:
                    return False, False, f"Missing family_provenance entry for family '{fid}' in transfer report"
                entry = fam_prov[fid]
                if isinstance(entry, dict):
                    c = entry.get("source_cluster") or entry.get("source_family") or entry.get("cluster_id") or fid
                elif isinstance(entry, str):
                    c = entry
                else:
                    c = str(entry)
                clusters.add(c)
            if len(clusters) < max(20, proto.min_heldout_families):
                return False, False, "Family clustering in transfer report lacks auditable distinction"

        indep_assert = report.get("independence_assertions")
        if indep_assert is not None:
            if not isinstance(indep_assert, dict) or not indep_assert:
                return False, False, "Malformed or empty independence_assertions in transfer report"
            if indep_assert.get("contamination_controlled") is not True:
                return False, False, "Contamination controls not satisfied in transfer report"
            if indep_assert.get("independent_task_families") is not True:
                return False, False, "Task family independence not satisfied in transfer report"

        att_raw = report.get("oracle_attestation")
        if not isinstance(att_raw, dict):
            return False, False, "Missing or malformed oracle_attestation in transfer report"
        try:
            att_obj = OracleAttestation(**att_raw)
        except TypeError as exc:
            return False, False, f"Malformed oracle_attestation fields: {exc}"

        oracle_ok, oracle_msg = self.verify_oracle_attestation(
            att_obj,
            recomputed_evidence_hash,
            expected_oracle_id=str(report.get("evaluator_id", "")),
        )
        if not oracle_ok:
            return False, False, f"Transfer oracle attestation failed verification: {oracle_msg}"

        if report.get("validator_public_key") != self._pk.hex():
            return False, False, "Transfer receipt signed by untrusted or mismatched validator key"

        try:
            canonical_receipt = rfc8785_canonicalize(self._build_transfer_receipt_dict(tx, report))
            if hashlib.sha256(canonical_receipt).hexdigest() != report.get("transfer_receipt_hash"):
                return False, False, "Tampered transfer receipt: transfer_receipt_hash mismatch"
            sig_bytes = bytes.fromhex(str(report.get("transfer_receipt_signature", "")))
        except (ValueError, TypeError, KeyError) as exc:
            return False, False, f"Invalid transfer receipt encoding: {exc}"

        if not ed25519_verify(self._pk, canonical_receipt, sig_bytes):
            return False, False, "Invalid transfer receipt cryptographic signature"

        return True, bool(recomputed_success), "verified"


def create_oracle_attestation(
    signing_key: bytes,
    public_key: bytes,
    oracle_id: str,
    evidence_hash: str,
    verdict: str = "APPROVED",
    timestamp: Optional[float] = None,
) -> OracleAttestation:
    """Helper to generate a cryptographically valid OracleAttestation for testing/production."""
    ts = timestamp if timestamp is not None else time.time()
    pk_hex = public_key.hex()
    attestation_dict = {
        "evidence_hash": evidence_hash,
        "oracle_id": oracle_id,
        "oracle_public_key": pk_hex,
        "timestamp": ts,
        "verdict": verdict,
    }
    canonical_bytes = rfc8785_canonicalize(attestation_dict)
    sig_bytes = ed25519_sign(signing_key, public_key, canonical_bytes)
    return OracleAttestation(
        oracle_id=oracle_id,
        oracle_public_key=pk_hex,
        evidence_hash=evidence_hash,
        timestamp=ts,
        verdict=verdict,
        signature=sig_bytes.hex(),
    )


def create_owner_validator_attestation(
    owner_signing_key: bytes,
    owner_public_key: bytes | str,
    validator_public_key: bytes | str,
    scope: str = "PRODUCTION_LEARNING_VALIDATION",
    timestamp: Optional[float] = None,
) -> Dict[str, Any]:
    """Helper to generate a cryptographically valid owner authorization attestation."""
    ts = timestamp if timestamp is not None else time.time()
    owner_pk_hex = (
        owner_public_key.hex().lower()
        if isinstance(owner_public_key, (bytes, bytearray))
        else _validate_oracle_key(owner_public_key, "owner_root")
    )
    val_pk_hex = (
        validator_public_key.hex().lower()
        if isinstance(validator_public_key, (bytes, bytearray))
        else _validate_oracle_key(validator_public_key, "validator")
    )
    payload = {
        "owner_public_key": owner_pk_hex,
        "scope": scope,
        "timestamp": ts,
        "validator_public_key": val_pk_hex,
        "verdict": "APPROVED",
    }
    canonical_bytes = rfc8785_canonicalize(payload)
    sig_bytes = ed25519_sign(owner_signing_key, bytes.fromhex(owner_pk_hex), canonical_bytes)
    return {
        **payload,
        "signature": sig_bytes.hex(),
    }

