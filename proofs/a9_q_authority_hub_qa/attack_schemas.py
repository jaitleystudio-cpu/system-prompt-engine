"""A9-Q schema attacks. Evidence only. Does not publish, host, or mutate product trees."""

from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator

from spe_runtime.providers.profiles import (
    FORBIDDEN_AUTHORITY_FLAGS,
    _check_authority_flags,
    validate_provider_profile,
)
from spe_runtime.xcat.validator import validate_envelope_dict

ROOT = Path(__file__).resolve().parents[2]
SCHEMAS = ROOT / "schemas"
OUT = Path(__file__).resolve().parent / "schema_attack_results.json"


def load(name: str) -> dict:
    return json.loads((SCHEMAS / name).read_text(encoding="utf-8"))


def errors(schema: dict, instance: object) -> list[str]:
    validator = Draft202012Validator(schema)
    return sorted(e.message for e in validator.iter_errors(instance))


PUBLISH_OBJECT = {
    "status": "GRANTED",
    "level": 9,
    "grants": ["PUBLISH", "HOST", "DEPLOY", "PUBLIC_SHARE"],
    "capability": "EXECUTE",
    "publish": True,
    "host": True,
    "deploy": True,
    "public_share": True,
    "validation_is_execution": True,
}


def minimal_envelope() -> dict:
    return {
        "envelope_id": "a9q-env",
        "goal_identity": "a9q-goal",
        "facts": [],
        "provenance": [],
        "uncertainties": [],
        "hard_constraints": [],
        "user_preferences": [],
        "analysis": None,
        "recommendation": None,
        "rendering": None,
        "authority_state": {
            "level": 0,
            "status": "NONE",
            "grants": [],
        },
        "execution_grants": [],
        "failures": [],
        "taint_labels": [],
        "sensitivity_labels": [],
        "category_trace": [],
    }


def profile_with(flags: list[str]) -> dict:
    raw = json.loads((ROOT / "data" / "provider_profiles_v1.json").read_text())
    profile = dict(raw["profiles"][1])  # DETERMINISTIC
    profile["authority_capabilities"] = flags
    raw["profiles"] = [profile]
    return raw


def python_flag(flag: str) -> str:
    try:
        _check_authority_flags((flag,))
    except ValueError as exc:
        return f"REJECTED: {exc}"
    return "ACCEPTED"


def main() -> None:
    authority = load("authority_state.schema.json")
    grant = load("execution_grant.schema.json")
    manifest = load("capability_manifest.schema.json")
    envelope_schema = load("xcat_envelope.schema.json")
    provider_schema = load("provider_profile.schema.json")

    smuggled = minimal_envelope()
    smuggled["authority_state"] = {
        "level": 0,
        "status": "NONE",
        "grants": [],
        "capability": "PUBLISH",
        "publish": True,
        "host": True,
        "deploy": True,
        "public_share": True,
        "validation_is_execution": True,
    }
    smuggled["execution_grants"] = [
        {
            "grant_id": "g-publish",
            "scope": "public_share",
            "capability": "PUBLISH",
            "executed": True,
            "silent_escalation": True,
        }
    ]

    cases = {
        "authority_state_stub_accepts_publish_object": {
            "schema": "schemas/authority_state.schema.json",
            "errors": errors(authority, PUBLISH_OBJECT),
        },
        "authority_state_stub_accepts_empty_object": {
            "schema": "schemas/authority_state.schema.json",
            "errors": errors(authority, {}),
        },
        "execution_grant_stub_accepts_publish_object": {
            "schema": "schemas/execution_grant.schema.json",
            "errors": errors(grant, PUBLISH_OBJECT),
        },
        "execution_grant_stub_accepts_empty_object": {
            "schema": "schemas/execution_grant.schema.json",
            "errors": errors(grant, {}),
        },
        "capability_manifest_stub_accepts_authority_and_publish": {
            "schema": "schemas/capability_manifest.schema.json",
            "errors": errors(
                manifest,
                {
                    "capabilities": ["shell", "browser_computer_use"],
                    "authority": "GRANTED",
                    "execution_grants": ["PUBLISH"],
                    "publish": True,
                    "host": True,
                    "deploy": True,
                    "public_share": True,
                    "validation_is_execution": True,
                },
            ),
        },
        "xcat_envelope_accepts_smuggled_publish_on_none_authority": {
            "schema": "schemas/xcat_envelope.schema.json",
            "errors": errors(envelope_schema, smuggled),
            "runtime_validator_errors": validate_envelope_dict(smuggled),
        },
        "provider_profile_schema_accepts_publish_host_deploy_share": {
            "schema": "schemas/provider_profile.schema.json",
            "errors": errors(
                provider_schema,
                profile_with(["publish", "host", "deploy", "public_share"]),
            ),
        },
        "provider_profile_schema_accepts_read_publish_prefix": {
            "schema": "schemas/provider_profile.schema.json",
            "errors": errors(provider_schema, profile_with(["read_publish"])),
        },
        "python_authority_flag_publish": python_flag("publish"),
        "python_authority_flag_host": python_flag("host"),
        "python_authority_flag_deploy": python_flag("deploy"),
        "python_authority_flag_public_share": python_flag("public_share"),
        "python_authority_flag_read_publish": python_flag("read_publish"),
        "python_authority_flag_read_host": python_flag("read_host"),
        "python_authority_flag_read_public_share": python_flag("read_public_share"),
        "python_validate_profile_publish": None,
        "forbidden_flag_set_omits_publish_family": sorted(
            FORBIDDEN_AUTHORITY_FLAGS
        ),
    }
    try:
        validate_provider_profile(profile_with(["publish"])["profiles"][0])
        cases["python_validate_profile_publish"] = "ACCEPTED"
    except ValueError as exc:
        cases["python_validate_profile_publish"] = f"REJECTED: {exc}"

    try:
        validate_provider_profile(profile_with(["read_publish", "read_host"])["profiles"][0])
        cases["python_validate_profile_read_publish"] = "ACCEPTED"
    except ValueError as exc:
        cases["python_validate_profile_read_publish"] = f"REJECTED: {exc}"

    OUT.write_text(json.dumps(cases, indent=2) + "\n", encoding="utf-8")
    print(OUT)
    for key, value in cases.items():
        if isinstance(value, dict) and "errors" in value:
            print(f"{key}: error_count={len(value['errors'])}")
        else:
            print(f"{key}: {value if not isinstance(value, list) else 'list'}")


if __name__ == "__main__":
    main()
