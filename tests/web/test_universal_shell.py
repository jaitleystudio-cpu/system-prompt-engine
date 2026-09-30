"""Lane A6: Universal Input Shell and Modal Mode Selector Invariants."""

from __future__ import annotations

import re
from tests.web.paths import WEB


def test_universal_shell_files_exist():
    shell_tsx = WEB / "src" / "landing" / "UniversalInputShell.tsx"
    modal_tsx = WEB / "src" / "landing" / "ModalModeSelector.tsx"
    shell_css = WEB / "src" / "landing" / "universal-shell.css"

    assert shell_tsx.is_file(), "UniversalInputShell.tsx must exist"
    assert modal_tsx.is_file(), "ModalModeSelector.tsx must exist"
    assert shell_css.is_file(), "universal-shell.css must exist"


def test_universal_shell_contract():
    shell_tsx = WEB / "src" / "landing" / "UniversalInputShell.tsx"
    modal_tsx = WEB / "src" / "landing" / "ModalModeSelector.tsx"
    shell_css = WEB / "src" / "landing" / "universal-shell.css"

    if not shell_tsx.is_file():
        return

    shell_content = shell_tsx.read_text(encoding="utf-8")
    modal_content = modal_tsx.read_text(encoding="utf-8")
    css_content = shell_css.read_text(encoding="utf-8")

    # 7 input types
    for itype in ("text", "image", "audio", "video", "url", "screenshot", "document"):
        assert f'"{itype}"' in shell_content or f"'{itype}'" in shell_content, f"Missing input type {itype}"

    # 6 public actions
    for action in ("prompt", "transcribe", "build", "code", "research", "create"):
        assert f'"{action}"' in shell_content or f"'{action}'" in shell_content, f"Missing action {action}"

    # Zero internal jargon ban
    for jargon in (r"\bK3\b", r"\bXCAT\b", r"\bContextCapsule\b", r"\bC0[1-9]\b", r"\bC1[0-2]\b"):
        assert not re.search(jargon, shell_content), f"Jargon leak {jargon} in UniversalInputShell"
        assert not re.search(jargon, modal_content), f"Jargon leak {jargon} in ModalModeSelector"

    # CSS accessibility rules
    assert "44px" in css_content, "Missing 44px touch targets in CSS"
    assert ":focus-visible" in css_content, "Missing :focus-visible rules in CSS"
    assert "prefers-reduced-motion" in css_content, "Missing prefers-reduced-motion in CSS"
    assert "@media" in css_content, "Missing responsive media query in CSS"


def test_universal_shell_route_isolation():
    app_tsx = (WEB / "src" / "App.tsx").read_text(encoding="utf-8")
    routing_ts = (WEB / "src" / "routing.ts").read_text(encoding="utf-8")

    assert "UniversalInputShell" not in app_tsx, "UniversalInputShell must not be mounted in App.tsx yet"
    assert "UniversalInputShell" not in routing_ts, "UniversalInputShell must not be referenced in routing.ts yet"
