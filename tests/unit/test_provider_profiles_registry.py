"""Unit tests for versioned provider profile registry (Batch E Turn 2).

Distinct from domain grounding profiles in spe_runtime.grounding.profiles.
"""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.providers.profiles import (
    FORBIDDEN_AUTHORITY_FLAGS,
    ProviderProfile,
    get_provider_profile,
    list_provider_profile_ids,
    list_provider_profiles,
    load_provider_profile_registry,
    provider_profile_digest,
    provider_registry_digest,
    validate_provider_profile,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = REPO_ROOT / "data" / "provider_profiles_v1.json"
SCHEMA_PATH = REPO_ROOT / "schemas" / "provider_profile.schema.json"
DOMAIN_PROFILES_PATH = REPO_ROOT / "data" / "grounding" / "domain_profiles.json"

REQUIRED_IDS = ("LOCAL_WASM", "DETERMINISTIC", "EXTERNAL_OPTIONAL")


def test_registry_lookup_known_ids():
    ids = list_provider_profile_ids()
    for pid in REQUIRED_IDS:
        assert pid in ids
        profile = get_provider_profile(pid)
        assert isinstance(profile, ProviderProfile)
        assert profile.profile_id == pid
        assert profile.profile_version


def test_unknown_profile_rejected():
    with pytest.raises(KeyError, match="unknown provider profile"):
        get_provider_profile("NOT_A_REAL_PROVIDER_PROFILE")


def test_version_preservation_and_digest_stable():
    profile = get_provider_profile("LOCAL_WASM")
    version = profile.profile_version
    again = get_provider_profile("LOCAL_WASM", version=version)
    assert again.profile_version == version
    assert again.to_dict() == profile.to_dict()

    d1 = provider_profile_digest(profile)
    d2 = provider_profile_digest(again)
    assert d1 == d2
    assert len(d1) == 64  # sha256 hex

    # Canonical serialization is deterministic
    assert canonical_dumps(profile.to_dict()) == canonical_dumps(again.to_dict())

    # Wrong version rejected
    with pytest.raises(KeyError, match="version"):
        get_provider_profile("LOCAL_WASM", version="999.999.999-nonexistent")


def test_registry_digest_stable():
    a = provider_registry_digest()
    b = provider_registry_digest()
    assert a == b
    assert len(a) == 64


def test_local_wasm_is_local_no_network():
    p = get_provider_profile("LOCAL_WASM")
    assert p.local_or_external == "local"
    assert p.requires_network is False
    assert p.requires_credentials is False


def test_deterministic_is_local_no_network():
    p = get_provider_profile("DETERMINISTIC")
    assert p.local_or_external == "local"
    assert p.requires_network is False


def test_external_optional_requires_network_or_explicit_optional():
    p = get_provider_profile("EXTERNAL_OPTIONAL")
    assert p.local_or_external == "external"
    # Network is required for the external path, but profile does not auto-enable it.
    assert p.requires_network is True
    caps = set(p.capabilities)
    assert "network_optional" in caps or "external_optional" in caps
    assert "auto_enable_network" not in caps
    assert p.privacy_behavior.get("auto_enable") is not True


def test_authority_capabilities_cannot_grant_execute_or_self_escalate():
    for pid in REQUIRED_IDS:
        p = get_provider_profile(pid)
        flags = {str(f).lower() for f in p.authority_capabilities}
        for forbidden in FORBIDDEN_AUTHORITY_FLAGS:
            assert forbidden not in flags, f"{pid} has forbidden flag {forbidden}"
        # Empty or read-only only
        for flag in flags:
            assert flag.startswith("read_") or flag in {"inspect", "describe"}, (
                f"{pid} authority flag not read-only: {flag}"
            )


def test_validate_rejects_escalating_authority():
    raw = get_provider_profile("LOCAL_WASM").to_dict()
    raw["authority_capabilities"] = ["execute", "self_escalate"]
    with pytest.raises(ValueError, match="authority"):
        validate_provider_profile(raw)


def test_no_confusion_with_grounding_domain_profiles():
    # Different data files
    assert DATA_PATH.resolve() != DOMAIN_PROFILES_PATH.resolve()
    assert DATA_PATH.exists()
    assert DOMAIN_PROFILES_PATH.exists()

    provider_ids = set(list_provider_profile_ids())
    with DOMAIN_PROFILES_PATH.open(encoding="utf-8") as fh:
        domain_payload = json.load(fh)
    domain_ids = {item["domain_id"] for item in domain_payload["profiles"]}
    assert provider_ids.isdisjoint(domain_ids)

    # Import paths are distinct modules
    from spe_runtime.grounding import profiles as domain_mod
    from spe_runtime.providers import profiles as provider_mod

    assert domain_mod.__file__ != provider_mod.__file__
    assert not hasattr(domain_mod, "get_provider_profile")
    assert not hasattr(provider_mod, "get_domain_profile")


def test_schema_validates_shipped_registry():
    with SCHEMA_PATH.open(encoding="utf-8") as fh:
        schema = json.load(fh)
    with DATA_PATH.open(encoding="utf-8") as fh:
        payload = json.load(fh)
    jsonschema.validate(instance=payload, schema=schema)


def test_list_profiles_returns_provider_profile_objects():
    profiles = list_provider_profiles()
    assert len(profiles) >= 3
    assert all(isinstance(p, ProviderProfile) for p in profiles)
    by_id = {p.profile_id: p for p in profiles}
    for pid in REQUIRED_IDS:
        assert pid in by_id


def test_load_registry_exposes_metadata():
    registry = load_provider_profile_registry()
    assert registry["registry_version"]
    assert isinstance(registry["profiles"], dict)
    assert "LOCAL_WASM" in registry["profiles"]


def test_required_fields_present():
    required = (
        "profile_id",
        "provider",
        "profile_version",
        "effective_from",
        "capabilities",
        "privacy_behavior",
        "local_or_external",
        "requires_network",
        "requires_credentials",
        "authority_capabilities",
        "known_limitations",
    )
    for pid in REQUIRED_IDS:
        d = get_provider_profile(pid).to_dict()
        for key in required:
            assert key in d, f"{pid} missing {key}"
        # model_id may be null for local
        assert "model_id" in d
        assert "verified_at" in d
        assert "pricing_metadata_if_known" in d
