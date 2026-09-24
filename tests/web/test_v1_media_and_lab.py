"""SPE Website V1 — media helpers + Daily Lab gates (no paid APIs)."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "apps" / "web" / "src"


def test_media_modules_exist_and_forbid_paid_proxy():
    media = WEB / "media"
    assert (media / "imageObserve.ts").is_file()
    assert (media / "videoSample.ts").is_file()
    assert (media / "screenshotToCode.ts").is_file()
    assert (media / "urlIngest.ts").is_file()
    blob = "\n".join(p.read_text(encoding="utf-8") for p in media.glob("*.ts"))
    for banned in ("corsproxy", "allorigins", "scrapingbee", "zenrows", "api.openai", "openai.com/v1"):
        assert banned not in blob.lower()
    assert "proxy" in blob.lower()


def test_screenshot_targets_include_six_frameworks():
    text = (WEB / "media" / "screenshotToCode.ts").read_text(encoding="utf-8")
    for token in ("html-css-js", "react", "swiftui", "compose", "flutter", "react-native"):
        assert token in text


def test_daily_lab_has_thirty_plus_static_specimens():
    text = (WEB / "lab" / "specimens.ts").read_text(encoding="utf-8")
    assert text.count('id: "lab-') >= 30
    assert "specimensForDate" in text
    assert "LAB_SPECIMENS" in text
    assert (WEB / "lab" / "DailyLab.tsx").is_file()


def test_unified_composer_and_nav_surfaces():
    composer = (WEB / "composer" / "UnifiedComposer.tsx").read_text(encoding="utf-8")
    for mode in ('"text"', '"speech"', '"image"', '"screenshot"', '"video"', '"url"'):
        assert mode in composer
    nav = (WEB / "layout" / "Nav.tsx").read_text(encoding="utf-8")
    for label in ("Home", "Create", "Code", "Daily Lab", "My Work", "Privacy / Proof"):
        assert label in nav
    assert "Build my prompt" in nav


def test_human_cta_build_my_prompt():
    copy = (REPO / "packages" / "human-perspective" / "src" / "copy.ts").read_text(encoding="utf-8")
    assert 'build: "Build my prompt"' in copy
    assert "Start with an idea" in copy
    assert "There is more in the idea" in copy
    assert "COMPILE INTENT" not in copy
    assert "RAW THOUGHT" not in copy


def test_headers_file_documents_csp():
    headers = REPO / "apps" / "web" / "public" / "_headers"
    assert headers.is_file()
    text = headers.read_text(encoding="utf-8")
    assert "Content-Security-Policy" in text
    assert "frame-ancestors" in text
    assert "X-Content-Type-Options" in text
    assert "Referrer-Policy" in text
