"""Lane A11-S: Static Website Builder UI qualification test suite."""
from __future__ import annotations

import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "apps" / "web"


def test_static_builder_files_exist():
    assert (WEB / "src" / "builder" / "websiteSpecModel.ts").is_file()
    assert (WEB / "src" / "builder" / "static-builder.css").is_file()
    assert (WEB / "src" / "builder" / "StaticWebsiteBuilder.tsx").is_file()
    assert (WEB / "scripts" / "test-static-website-builder.mjs").is_file()


def test_static_builder_node_harness_passes():
    script = WEB / "scripts" / "test-static-website-builder.mjs"
    res = subprocess.run(["node", str(script)], cwd=str(WEB), capture_output=True, text=True)
    assert res.returncode == 0, f"Harness failed:\n{res.stderr}\n{res.stdout}"
    assert "PASS: Lane A11-S Static Website Builder contract verified." in res.stdout


def test_static_builder_mandatory_restrictions():
    model_code = (WEB / "src" / "builder" / "websiteSpecModel.ts").read_text(encoding="utf-8")
    view_code = (WEB / "src" / "builder" / "StaticWebsiteBuilder.tsx").read_text(encoding="utf-8")

    assert 'AI_GENERATION = "NOT_AVAILABLE"' in model_code
    assert 'SCENE_3D = "NOT_AVAILABLE"' in model_code
    assert 'SANDBOX = "UNSUPPORTED"' in model_code
    assert 'HOSTED_PUBLISH = "HOLD"' in model_code

    assert "AI generation:" in view_code
    assert "3D graphics:" in view_code
    assert "Sandbox execution:" in view_code
    assert "Hosted publish:" in view_code


def test_static_builder_route_isolation():
    app_tsx = (WEB / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "StaticWebsiteBuilder" not in app_tsx, "StaticWebsiteBuilder must not be mounted in App.tsx"
