"""Lane A10: Media UX Capability Preflight Test Gates."""

from __future__ import annotations

import re
import subprocess
from tests.web.paths import WEB


def test_media_workspace_files_exist():
    model_ts = WEB / "src" / "media" / "mediaCapabilityModel.ts"
    workspace_tsx = WEB / "src" / "media" / "MediaWorkspaceView.tsx"
    css_file = WEB / "src" / "media" / "media-workspace.css"
    harness = WEB / "scripts" / "test-media-workspace-ui.mjs"

    assert model_ts.is_file(), "mediaCapabilityModel.ts must exist"
    assert workspace_tsx.is_file(), "MediaWorkspaceView.tsx must exist"
    assert css_file.is_file(), "media-workspace.css must exist"
    assert harness.is_file(), "test-media-workspace-ui.mjs must exist"


def test_media_workspace_node_harness_passes():
    harness = WEB / "scripts" / "test-media-workspace-ui.mjs"
    res = subprocess.run(["node", str(harness)], cwd=str(WEB), capture_output=True, text=True)
    assert res.returncode == 0, f"Harness failed:\n{res.stderr}\n{res.stdout}"
    assert "PASS: Lane A10 Media UX Capability Preflight contract verified." in res.stdout


def test_media_workspace_truth_invariants():
    model_ts = WEB / "src" / "media" / "mediaCapabilityModel.ts"
    view_tsx = WEB / "src" / "media" / "MediaWorkspaceView.tsx"
    css_file = WEB / "src" / "media" / "media-workspace.css"

    model_code = model_ts.read_text(encoding="utf-8")
    view_code = view_tsx.read_text(encoding="utf-8")
    css_code = css_file.read_text(encoding="utf-8")

    assert 'LIVE_TRANSCRIPTION_STATUS = "UNAVAILABLE"' in model_code
    assert 'BACKEND_EXECUTION = "GATED"' in model_code
    assert 'HOST_FFMPEG_PRODUCT_PATH = "PROHIBITED"' in model_code
    assert 'NETWORK_EGRESS = "0"' in model_code

    # Codec support
    assert re.search(r'format:\s*"WAV / PCM".*status:\s*"ACCEPTED"', model_code, re.DOTALL)
    assert re.search(r'format:\s*"Opus".*status:\s*"REJECTED"', model_code, re.DOTALL)
    assert re.search(r'format:\s*"AC-3 / E-AC-3".*status:\s*"REJECTED"', model_code, re.DOTALL)

    # Language support bound to G12 MediaCapabilityContract
    assert "MediaCapabilityContract" in model_code
    assert "validateMediaCapabilityReceipt" in model_code
    assert re.search(r'language:\s*"English".*status:\s*"QUALIFIED"', model_code, re.DOTALL)
    assert re.search(r'language:\s*"Tamil".*status:\s*"QUALIFIED"', model_code, re.DOTALL)
    assert re.search(r'language:\s*"Hindi".*status:\s*"LIMITED_EVIDENCE"', model_code, re.DOTALL)
    assert re.search(r'language:\s*"Spanish".*status:\s*"UNDER_QUALIFICATION"', model_code, re.DOTALL)
    assert re.search(r'language:\s*"Telugu \(Baseline ggml-small\)".*status:\s*"UNSUPPORTED"', model_code, re.DOTALL)
    assert re.search(r'language:\s*"Telugu \(Challenger ggml-te-small\)".*status:\s*"UNDER_QUALIFICATION"', model_code, re.DOTALL)

    # CSS accessibility
    assert "44px" in css_code
    assert ":focus-visible" in css_code
    assert "prefers-reduced-motion" in css_code


def test_media_workspace_route_isolation():
    app_tsx = (WEB / "src" / "App.tsx").read_text(encoding="utf-8")
    routing_ts = (WEB / "src" / "routing.ts").read_text(encoding="utf-8")

    assert "<MediaWorkspaceView" not in app_tsx
    assert "media-workspace" not in routing_ts
