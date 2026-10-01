"""Lane A11-S / R2-WEB-W: Static Website Builder UI + compiler safety tests."""
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
    assert (WEB / "scripts" / "test-static-website-compiler.mjs").is_file()


def test_static_builder_node_harness_passes():
    script = WEB / "scripts" / "test-static-website-builder.mjs"
    res = subprocess.run(["node", str(script)], cwd=str(WEB), capture_output=True, text=True)
    assert res.returncode == 0, f"Harness failed:\n{res.stderr}\n{res.stdout}"
    assert "PASS: Lane A11-S Static Website Builder contract verified." in res.stdout
    assert "PASS: compiler safety" in res.stdout


def test_static_builder_compiler_harness_invokes_compiler():
    script = WEB / "scripts" / "test-static-website-compiler.mjs"
    res = subprocess.run(
        ["node", "--experimental-strip-types", str(script)],
        cwd=str(WEB),
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0, f"Compiler harness failed:\n{res.stderr}\n{res.stdout}"
    assert "Invoking compileWebsiteSpecToStaticHtml" in res.stdout
    assert "PASS: compiler safety" in res.stdout


def test_static_builder_mandatory_restrictions():
    model_code = (WEB / "src" / "builder" / "websiteSpecModel.ts").read_text(encoding="utf-8")
    view_code = (WEB / "src" / "builder" / "StaticWebsiteBuilder.tsx").read_text(encoding="utf-8")

    assert 'AI_GENERATION = "NOT_AVAILABLE"' in model_code
    assert 'SCENE_3D = "NOT_AVAILABLE"' in model_code
    assert 'SANDBOX = "UNSUPPORTED"' in model_code
    assert 'HOSTED_PUBLISH = "HOLD"' in model_code
    assert 'COMPILER_BINDING = "LOCAL_TS_WEBSITE_SPEC_1"' in model_code
    assert "G13_PACKAGE_BOUND = false" in model_code
    assert "Strictly maps to G13 WebsiteSpec" not in model_code

    assert "AI generation:" in view_code
    assert "3D graphics:" in view_code
    assert "Sandbox execution:" in view_code
    assert "Hosted publish:" in view_code
    assert "G13 Spec Compiler" not in view_code
    assert "website-spec/1 local TS compiler" in view_code


def test_static_builder_route_isolation():
    app_tsx = (WEB / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "StaticWebsiteBuilder" not in app_tsx, "StaticWebsiteBuilder must not be mounted in App.tsx"


def test_static_builder_isometric_2d_truth_not_webgl_marketing():
    view_code = (WEB / "src" / "builder" / "StaticWebsiteBuilder.tsx").read_text(encoding="utf-8")
    css_code = (WEB / "src" / "builder" / "static-builder.css").read_text(encoding="utf-8")

    assert "WireframeCanvasPreview" in view_code
    assert "Isometric 2D Layout Preview" in view_code
    assert "Canvas 2D isometric layout preview" in view_code
    assert "WebGL NOT_AVAILABLE" in view_code
    assert "3D Wireframe Fallback" not in view_code
    assert "Canvas / WebGL fallback" not in view_code
    assert ".bld-wireframe-container" in css_code
    assert ".bld-wireframe-canvas" in css_code
