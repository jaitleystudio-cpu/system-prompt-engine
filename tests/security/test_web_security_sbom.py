"""Test Software Bill of Materials (SBOM) and Dependency Inventory integrity.

Validates CycloneDX 1.5 standard compliance, zero banned packages,
trusted registry provenance, and dependency lockdown.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "apps" / "web"
SBOM_PATH = REPO / "proofs" / "generated" / "web_sbom_cyclonedx.json"
INV_PATH = REPO / "proofs" / "generated" / "web_dependency_inventory.json"


def test_sbom_generator_script_runs_cleanly():
    script = WEB / "scripts" / "generate-sbom.mjs"
    assert script.is_file(), "generate-sbom.mjs script missing"

    result = subprocess.run(
        ["node", str(script)],
        cwd=str(WEB),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"SBOM generation failed: {result.stderr}"
    data = json.loads(result.stdout)
    assert data["ok"] is True
    assert data["banned_hits"] == 0
    assert data["invalid_registries"] == 0


def test_cyclonedx_sbom_structure_and_schema():
    assert SBOM_PATH.is_file(), "CycloneDX SBOM file missing"
    sbom = json.loads(SBOM_PATH.read_text(encoding="utf-8"))

    assert sbom.get("bomFormat") == "CycloneDX"
    assert sbom.get("specVersion") == "1.5"
    assert "serialNumber" in sbom
    assert "metadata" in sbom
    assert sbom["metadata"]["component"]["name"] == "spe-web"

    components = sbom.get("components", [])
    assert len(components) > 0, "SBOM must have non-empty components"

    # Verify each component has essential security metadata
    for comp in components:
        assert comp.get("type") == "library"
        assert "name" in comp
        assert "version" in comp
        assert "purl" in comp
        assert comp["purl"].startswith("pkg:npm/")
        assert "scope" in comp
        assert comp["scope"] in ("required", "optional")


def test_dependency_inventory_zero_banned_and_trusted_registry():
    assert INV_PATH.is_file(), "Dependency inventory file missing"
    inv = json.loads(INV_PATH.read_text(encoding="utf-8"))

    summary = inv.get("summary", {})
    assert summary.get("banned_packages_detected") == 0
    assert summary.get("untrusted_registries_detected") == 0
    assert len(inv.get("banned_packages", [])) == 0
    assert len(inv.get("untrusted_registries", [])) == 0

    # Ensure all direct dependencies in apps/web/package.json are accounted for
    pkg = json.loads((WEB / "package.json").read_text(encoding="utf-8"))
    direct_prod = set(pkg.get("dependencies", {}).keys())
    direct_dev = set(pkg.get("devDependencies", {}).keys())

    inv_direct_names = {
        item["name"] for item in inv.get("inventory", []) if item.get("direct")
    }
    for name in direct_prod | direct_dev:
        assert name in inv_direct_names, f"Direct dependency {name} missing from inventory"
