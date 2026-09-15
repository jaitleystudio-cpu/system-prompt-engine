"""Zero-cost, not_a_release, no 3D/native/extensions/MCP/ads/billing/deploy."""

from __future__ import annotations

import json

from tests.web.paths import REPO, WEB, web_source_text


def test_not_a_release_and_new_implementation_declared():
    text = web_source_text()
    pkg = json.loads((WEB / "package.json").read_text(encoding="utf-8"))
    blob = text + json.dumps(pkg)
    assert "not_a_release" in blob or "not a release" in blob.lower()
    assert "NEW_IMPLEMENTATION" in blob or "new_implementation" in blob.lower()


def test_no_three_js_or_webgl_3d():
    text = web_source_text()
    for token in ("three.js", "from 'three'", 'from "three"', "WebGLRenderer", "THREE."):
        assert token not in text, token


def test_dep_audit_script_and_asset_budget_script_exist():
    assert (WEB / "scripts" / "audit-deps.mjs").is_file()
    assert (WEB / "scripts" / "measure-assets.mjs").is_file()
    assert (WEB / "scripts" / "copy-wasm.mjs").is_file()
    assert (WEB / "scripts" / "egress-proof.mjs").is_file()


def test_package_lock_has_no_paid_registry():
    lock = WEB / "package-lock.json"
    assert lock.is_file(), "package-lock.json missing (reproducible free install)"
    text = lock.read_text(encoding="utf-8")
    assert "registry.npmjs.org" in text
    for banned in ("fonts.googleapis", "unpkg.com/three", "stripe.com"):
        assert banned not in text


def test_roadmap_web_pwa_not_released():
    road = (REPO / "docs" / "UNIVERSAL_PLATFORM_ROADMAP.md").read_text(encoding="utf-8")
    # Honest: may be IMPLEMENTING / CONFORMANCE_PARTIAL, never RELEASED/PASS for Sprint 6.
    assert "PLATFORM:WEB_PWA" in road
    # The WEB_PWA row must not claim RELEASED.
    for line in road.splitlines():
        if "PLATFORM:WEB_PWA" in line or "WEB_PWA" in line and "RELEASED" in line:
            assert "RELEASED" not in line or "not RELEASED" in line.lower()
