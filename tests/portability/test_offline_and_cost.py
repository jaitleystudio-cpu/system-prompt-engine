"""Offline-first Sprint 4 + COST LAW ₹0."""

from __future__ import annotations

import ast
from pathlib import Path

from spe_runtime.portability.abi import declare_reference_implementation
from spe_runtime.portability.capability import CAPABILITY_IDS
from spe_runtime.portability.conformance import ReferenceRuntime


REPO = Path(__file__).resolve().parents[2]
FORBIDDEN_IMPORTS = {
    "openai",
    "anthropic",
    "google.generativeai",
    "boto3",
    "botocore",
    "stripe",
    "requests",
    "httpx",
    "aiohttp",
    "urllib3",
}


def test_sprint4_network_none():
    rt = ReferenceRuntime()
    assert rt.network_mode == "NONE"
    assert rt.network_used() is False
    decl = declare_reference_implementation(CAPABILITY_IDS)
    assert decl.network_mode == "NONE"


def test_pyproject_free_deps_only():
    text = (REPO / "pyproject.toml").read_text(encoding="utf-8")
    assert "jsonschema" in text
    assert "openai" not in text
    assert "anthropic" not in text
    assert "stripe" not in text
    assert "boto3" not in text


def test_portability_tree_no_paid_or_network_imports():
    root = REPO / "spe_runtime" / "portability"
    offenders: list[str] = []
    for path in root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    name = alias.name.split(".")[0]
                    if alias.name in FORBIDDEN_IMPORTS or name in FORBIDDEN_IMPORTS:
                        offenders.append(f"{path.name}:{alias.name}")
            elif isinstance(node, ast.ImportFrom) and node.module:
                top = node.module.split(".")[0]
                if node.module in FORBIDDEN_IMPORTS or top in FORBIDDEN_IMPORTS:
                    offenders.append(f"{path.name}:{node.module}")
    assert offenders == []
