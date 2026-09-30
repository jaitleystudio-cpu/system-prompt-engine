"""G11 workflow export v1 — offline contracts only.

Export is not execution. These tests forbid network, credentials, webhooks,
publication, and silent loss of prompt-contract facets.
"""

from __future__ import annotations

import ast
import copy
import json
import socket
import sys
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.workflow_export import (
    EXPORT_CONTRACT_VERSION,
    FACETS,
    ExportIntegrityError,
    audit_export,
    export_workflow,
    parse_generic_text,
)

REPO = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO / "schemas" / "workflow_export.schema.json"
SECRET = "super-secret-value-xyz"

PROMPT = {
    "contract_version": "spe.prompt-contract.v1",
    "prompt_body": "Summarize the quarterly report for {{audience}}.",
    "variables": {"audience": "operators", "tone": "formal"},
    "required_inputs": ["audience"],
    "expected_outputs": ["summary"],
    "constraints": ["no network", "do not call webhooks"],
    "provider_target": "local-prompt",
}


def _schema():
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _export(target: str, source: dict | None = None) -> dict:
    doc = export_workflow(copy.deepcopy(source or PROMPT), target=target)
    jsonschema.validate(doc, _schema())
    audit_export(doc)
    return doc


def _facet(doc: dict, name: str) -> dict:
    matches = [item for item in doc["fidelity"] if item["facet"] == name]
    assert len(matches) == 1
    return matches[0]


def _artifact(**overrides) -> dict:
    base = {
        "spe_format": "spe.artifact.v1",
        "created_at_utc": "2026-09-30T00:00:00Z",
        "user_request": "summarize",
        "category": "C06",
        "target": "local-prompt",
        "envelope": {},
        "wasm": {"pin": "not-this-lane"},
        "rendered_prompt": PROMPT["prompt_body"],
        "intent": {
            "confirmed": ["keep intent"],
            "assumed": [],
            "unknowns": ["INTENT_UNKNOWN_SENTINEL"],
            "conflicts": ["INTENT_CONFLICT_SENTINEL"],
        },
        "lineage": {"engine": "test"},
        "integrity": {
            "algorithm": "SHA-256",
            "content_sha256": "abc",
            "state": "COMPUTED",
        },
        "variables": {"audience": "operators", "tone": "formal"},
        "required_inputs": ["audience"],
        "expected_outputs": ["summary"],
        "constraints": ["no network"],
    }
    base.update(overrides)
    return base


def test_generic_json_preserves_every_facet_and_refuses_authority():
    doc = _export("generic_json")
    assert doc["export_contract_version"] == EXPORT_CONTRACT_VERSION
    assert doc["target"] == "generic_json"
    assert doc["loss_state"] == "NONE"
    assert doc["warnings"] == []
    assert doc["stripped_paths"] == []
    assert [item["facet"] for item in doc["fidelity"]] == list(FACETS)
    assert {item["state"] for item in doc["fidelity"]} == {"PRESERVED"}
    assert doc["canonical"]["prompt_body"] == PROMPT["prompt_body"]
    assert doc["canonical"]["provider_target"] == "local-prompt"
    assert doc["canonical"]["variables"] == [
        {"name": "audience", "value": "operators", "disposition": "KEPT"},
        {"name": "tone", "value": "formal", "disposition": "KEPT"},
    ]
    assert doc["canonical"]["constraints"] == ["no network", "do not call webhooks"]
    assert doc["target_document"] == doc["canonical"]
    guarantees = doc["guarantees"]
    assert guarantees["network"] is False
    assert guarantees["credentials_stored"] is False
    assert guarantees["executed"] is False
    assert guarantees["published"] is False
    assert guarantees["webhook_triggered"] is False
    assert guarantees["authority"] == "NONE"
    assert guarantees["validation_is_not_execution"] is True
    assert guarantees["capability_is_not_authority"] is True
    assert doc["source"]["kind"] == "prompt_contract"


def test_generic_text_round_trips_marker_like_and_unicode_bodies():
    source = copy.deepcopy(PROMPT)
    source["prompt_body"] = "PROMPT_BODY_END\nनमस्ते\nline"
    doc = _export("generic_text", source)
    assert doc["loss_state"] == "NONE"
    assert isinstance(doc["target_document"], str)
    assert parse_generic_text(doc["target_document"]) == doc["canonical"]
    assert "नमस्ते" in doc["target_document"]


def test_variable_list_order_is_preserved_and_dict_order_is_sorted():
    listed = copy.deepcopy(PROMPT)
    listed["variables"] = [
        {"name": "zeta", "value": "last"},
        {"name": "alpha", "value": "first"},
    ]
    doc = _export("generic_json", listed)
    assert [item["name"] for item in doc["canonical"]["variables"]] == ["zeta", "alpha"]


def test_n8n_projection_is_inactive_and_degrades_unenforced_facets():
    doc = _export("n8n")
    assert doc["loss_state"] == "DEGRADED"
    workflow = doc["target_document"]
    assert workflow["active"] is False
    assert workflow["connections"] == {}
    assert [node["type"] for node in workflow["nodes"]] == ["n8n-nodes-base.stickyNote"]
    assert workflow["nodes"][0]["parameters"]["content"] == PROMPT["prompt_body"]
    assert workflow["staticData"]["spe_variables"] == doc["canonical"]["variables"]
    carried = workflow["staticData"]["spe"]
    assert carried["required_inputs"] == ["audience"]
    assert carried["expected_outputs"] == ["summary"]
    assert carried["constraints"] == PROMPT["constraints"]
    assert carried["provider_target"] == "local-prompt"
    assert carried["executable"] is False
    assert _facet(doc, "prompt_body")["state"] == "PRESERVED"
    assert _facet(doc, "variables")["state"] == "PRESERVED"
    for name in ("required_inputs", "expected_outputs", "constraints", "provider_target"):
        facet = _facet(doc, name)
        assert facet["state"] == "DEGRADED"
        assert facet["reason"]
        assert any(warning["facet"] == name for warning in doc["warnings"])
    blob = json.dumps(workflow)
    assert "n8n-nodes-base.webhook" not in blob
    assert "n8n-nodes-base.httpRequest" not in blob
    assert "credentials" not in blob


def test_make_projection_carries_values_without_a_runnable_flow():
    doc = _export("make")
    assert doc["loss_state"] == "DEGRADED"
    blueprint = doc["target_document"]
    assert blueprint["flow"] == []
    assert "connections" not in blueprint
    assert blueprint["metadata"]["executable"] is False
    assert blueprint["metadata"]["spe"]["prompt_body"] == PROMPT["prompt_body"]
    assert {item["state"] for item in doc["fidelity"]} == {"DEGRADED"}
    assert len(doc["warnings"]) == len(FACETS)


def test_zapier_descriptor_is_not_an_importable_zap():
    doc = _export("zapier")
    assert doc["loss_state"] == "UNSUPPORTED"
    zap = doc["target_document"]
    assert zap["format"] == "zapier.offline-descriptor.v1"
    assert zap["importable"] is False
    assert zap["runnable"] is False
    assert zap["executable"] is False
    assert zap["note"] == PROMPT["prompt_body"]
    assert zap["review_copy"]["semantic"] is False
    assert zap["review_copy"]["required_inputs"] == ["audience"]
    assert zap["review_copy"]["expected_outputs"] == ["summary"]
    unsupported = {item["facet"] for item in zap["unsupported"]}
    assert unsupported == {"required_inputs", "expected_outputs"}
    assert _facet(doc, "required_inputs")["state"] == "UNSUPPORTED"
    assert _facet(doc, "expected_outputs")["state"] == "UNSUPPORTED"
    assert _facet(doc, "prompt_body")["state"] == "DEGRADED"
    assert "webhookUrl" not in json.dumps(zap)


def test_spe_artifact_uses_rendered_prompt_and_does_not_rewrite_intent():
    artifact = _artifact()
    original = copy.deepcopy(artifact)
    doc = _export("generic_json", artifact)
    assert artifact == original
    assert doc["source"]["kind"] == "spe_artifact"
    assert doc["source"]["spe_format"] == "spe.artifact.v1"
    assert doc["canonical"]["prompt_body"] == artifact["rendered_prompt"]
    assert doc["canonical"]["constraints"] == ["no network"]
    blob = json.dumps(doc)
    assert "INTENT_UNKNOWN_SENTINEL" not in blob
    assert "INTENT_CONFLICT_SENTINEL" not in blob


def test_missing_prompt_empty_target_and_unknown_target_fail_closed():
    with pytest.raises(ValueError, match="prompt_body"):
        export_workflow({"contract_version": "spe.prompt-contract.v1"}, target="generic_json")
    with pytest.raises(ValueError, match="provider_target"):
        export_workflow(
            {
                "contract_version": "spe.prompt-contract.v1",
                "prompt_body": "body",
                "provider_target": "",
            },
            target="generic_json",
        )
    with pytest.raises(ValueError, match="target"):
        export_workflow(PROMPT, target="slack")


def test_credential_fields_are_stripped_and_prompt_secrets_are_withheld():
    dirty = copy.deepcopy(PROMPT)
    dirty["credentials"] = {"token": SECRET}
    dirty["webhook_url"] = "https://hooks.example.test/abc"
    doc = _export("generic_json", dirty)
    blob = json.dumps(doc)
    assert SECRET not in blob
    assert "hooks.example.test" not in blob
    assert "credentials.token" in doc["stripped_paths"]
    assert "webhook_url" in doc["stripped_paths"]
    assert doc["guarantees"]["credentials_stored"] is False
    assert doc["loss_state"] == "NONE"

    leaked = copy.deepcopy(PROMPT)
    leaked["prompt_body"] = f"token={SECRET} and then the task"
    withheld = _export("n8n", leaked)
    withheld_blob = json.dumps(withheld)
    assert SECRET not in withheld_blob
    assert withheld["canonical"]["prompt_body"] == ""
    assert withheld["canonical"]["prompt_body_disposition"] == "WITHHELD_CREDENTIAL"
    assert len(withheld["canonical"]["prompt_body_sha256"]) == 64
    assert _facet(withheld, "prompt_body")["state"] == "DEGRADED"
    assert _facet(withheld, "prompt_body")["code"] == "PROMPT_BODY_WITHHELD"
    assert withheld["target_document"]["nodes"][0]["parameters"]["content"] == "SPE_PROMPT_WITHHELD"
    assert withheld["target_document"]["active"] is False


def test_forbidden_variable_names_degrade_instead_of_being_dropped():
    source = copy.deepcopy(PROMPT)
    source["variables"] = {"audience": "operators", "api_key": SECRET}
    doc = _export("generic_json", source)
    variables = {item["name"]: item for item in doc["canonical"]["variables"]}
    assert variables["audience"]["disposition"] == "KEPT"
    assert variables["api_key"]["disposition"] == "STRIPPED"
    assert variables["api_key"]["value"] == ""
    assert _facet(doc, "variables")["state"] == "DEGRADED"
    assert SECRET not in json.dumps(doc)
    assert doc["loss_state"] == "DEGRADED"


def test_export_is_deterministic_and_does_not_open_sockets(monkeypatch):
    monkeypatch.setattr(socket, "socket", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("socket")))
    first = export_workflow(copy.deepcopy(PROMPT), target="make")
    second = export_workflow(copy.deepcopy(PROMPT), target="make")
    assert first == second


def test_mutation_dropped_facet_is_rejected():
    doc = _export("n8n")
    doc["fidelity"] = [item for item in doc["fidelity"] if item["facet"] != "constraints"]
    with pytest.raises(ExportIntegrityError, match="constraints"):
        audit_export(doc)


def test_mutation_false_preserved_state_is_rejected():
    doc = _export("n8n")
    for item in doc["fidelity"]:
        if item["facet"] == "constraints":
            item["state"] = "PRESERVED"
    with pytest.raises(ExportIntegrityError, match="PRESERVED"):
        audit_export(doc)


def test_mutation_executed_guarantee_is_rejected():
    doc = _export("generic_json")
    doc["guarantees"]["executed"] = True
    with pytest.raises(ExportIntegrityError, match="executed"):
        audit_export(doc)


def test_mutation_preserved_withheld_prompt_is_rejected():
    leaked = copy.deepcopy(PROMPT)
    leaked["prompt_body"] = f"token={SECRET} and then the task"
    doc = _export("generic_json", leaked)
    for item in doc["fidelity"]:
        if item["facet"] == "prompt_body":
            item["state"] = "PRESERVED"
    doc["loss_state"] = "NONE"
    with pytest.raises(ExportIntegrityError, match="WITHHELD"):
        audit_export(doc)


def test_mutation_preserved_stripped_variable_is_rejected():
    source = copy.deepcopy(PROMPT)
    source["variables"] = {"audience": "operators", "api_key": SECRET}
    doc = _export("generic_json", source)
    for item in doc["fidelity"]:
        if item["facet"] == "variables":
            item["state"] = "PRESERVED"
    doc["loss_state"] = "NONE"
    with pytest.raises(ExportIntegrityError, match="STRIPPED"):
        audit_export(doc)


def test_mutation_loss_none_over_degraded_ledger_is_rejected():
    doc = _export("make")
    doc["loss_state"] = "NONE"
    with pytest.raises(ExportIntegrityError, match="loss_state"):
        audit_export(doc)


def test_package_has_no_network_or_paid_imports():
    root = REPO / "spe_runtime" / "workflow_export"
    allowed_third_party = {"jsonschema"}
    offenders: list[str] = []
    for path in root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            modules: list[str] = []
            if isinstance(node, ast.Import):
                modules.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                modules.append(node.module)
            for module in modules:
                top = module.split(".")[0]
                if top in sys.stdlib_module_names or module.startswith("spe_runtime"):
                    continue
                if top not in allowed_third_party:
                    offenders.append(f"{path.name}:{module}")
                if top in {"requests", "httpx", "aiohttp", "urllib3", "openai", "stripe", "boto3"}:
                    offenders.append(f"{path.name}:{module}")
    assert offenders == []
    pyproject = (REPO / "pyproject.toml").read_text(encoding="utf-8")
    assert "jsonschema>=4.22" in pyproject
    for banned in ("openai", "anthropic", "stripe", "boto3", "httpx", "requests"):
        assert banned not in pyproject
