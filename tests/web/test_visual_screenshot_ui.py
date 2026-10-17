"""Lane A12: Visual and Screenshot UI Foundation Gates."""

from __future__ import annotations

import re
from tests.web.paths import WEB


def test_visual_screenshot_ui_files_exist():
    workspace_tsx = WEB / "src" / "media" / "VisualScreenshotWorkspace.tsx"
    css_file = WEB / "src" / "media" / "visual-workspace.css"

    assert workspace_tsx.is_file(), "VisualScreenshotWorkspace.tsx must exist"
    assert css_file.is_file(), "visual-workspace.css must exist"


def test_visual_screenshot_truth_and_targets():
    workspace_tsx = WEB / "src" / "media" / "VisualScreenshotWorkspace.tsx"
    css_file = WEB / "src" / "media" / "visual-workspace.css"

    if not workspace_tsx.is_file():
        return

    content = workspace_tsx.read_text(encoding="utf-8")
    css_content = css_file.read_text(encoding="utf-8")

    # Mandatory truth labels
    assert re.search(r"OCR:\s*(OBSERVED|UNKNOWN)", content, re.IGNORECASE)
    assert re.search(r"assets:\s*(FOUND|INFERRED|UNKNOWN)", content, re.IGNORECASE)
    assert re.search(r"responsive:\s*(OBSERVED|INFERRED|UNKNOWN)", content, re.IGNORECASE)
    assert re.search(r"fidelity:\s*(MEASURED|UNPROVEN)", content, re.IGNORECASE)

    # Ban on 100% pixel perfect
    assert not re.search(r"100%\s*pixel[\s-]*perfect", content, re.IGNORECASE)
    assert not re.search(r"pixel[\s-]*perfect\s*guarantee", content, re.IGNORECASE)

    # Uses canonical CODE_TARGETS
    assert "CODE_TARGETS" in content

    # CSS accessibility
    assert "44px" in css_content
    assert ":focus-visible" in css_content
    assert "prefers-reduced-motion" in css_content


def test_visual_screenshot_route_isolation():
    app_tsx = (WEB / "src" / "App.tsx").read_text(encoding="utf-8")
    routing_ts = (WEB / "src" / "routing.ts").read_text(encoding="utf-8")

    assert "<VisualScreenshotWorkspace" not in app_tsx
    assert "visual-screenshot" not in routing_ts
