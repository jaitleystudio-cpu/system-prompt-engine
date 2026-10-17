"""WCAG 2.1 AA Accessibility compliance and UX qualification test suite."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "apps" / "web"


def test_accessibility_harness_script_passes():
    script = WEB / "scripts" / "test-accessibility-harness.mjs"
    assert script.is_file(), "Accessibility harness script missing"

    result = subprocess.run(
        ["node", str(script)],
        cwd=str(WEB),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Accessibility harness failed:\n{result.stderr}\n{result.stdout}"
    assert "ALL WCAG 2.1 AA ACCESSIBILITY AUDIT CHECKS PASSED" in result.stdout


def test_skip_link_and_main_landmark():
    app_tsx = WEB / "src" / "App.tsx"
    skip_link_tsx = WEB / "src" / "shell" / "SkipLink.tsx"
    assert app_tsx.is_file()
    assert skip_link_tsx.is_file()

    app_text = app_tsx.read_text(encoding="utf-8")
    skip_text = skip_link_tsx.read_text(encoding="utf-8")

    assert "<SkipLink />" in app_text
    assert 'className="skip-link"' in skip_text
    assert 'href="#main"' in skip_text
    assert '<main id="main"' in app_text


def test_focus_visible_dual_theme_contrast():
    css = (WEB / "src" / "index.css").read_text(encoding="utf-8")

    # Dark mode focus ring
    assert "button:focus-visible" in css
    assert "outline: 2px solid #bbceff" in css

    # Light mode high contrast focus ring
    assert 'html[data-theme="light"] button:focus-visible' in css
    assert "outline: 2px solid #1a3675" in css


def test_reduced_motion_coverage():
    css = (WEB / "src" / "index.css").read_text(encoding="utf-8")

    assert "@media (prefers-reduced-motion: reduce)" in css
    assert "animation-duration: 0.001ms !important" in css
    assert "transition-duration: 0.001ms !important" in css
    assert "scroll-behavior: auto !important" in css


def test_mobile_touch_targets_and_reflow():
    css = (WEB / "src" / "index.css").read_text(encoding="utf-8")

    assert "min-height: 44px" in css or "min-height: 48px" in css
    assert "touch-action: manipulation" in css
    assert "@media (max-width: 360px)" in css
