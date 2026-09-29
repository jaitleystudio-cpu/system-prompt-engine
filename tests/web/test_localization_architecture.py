"""Global localization, Unicode, RTL foundations, and hreflang discovery tests."""

from __future__ import annotations

import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "apps" / "web"
RUNTIME = REPO / "packages" / "web-runtime"


def test_localization_harness_script_passes():
    script = WEB / "scripts" / "test-localization-harness.mjs"
    assert script.is_file(), "Localization harness script missing"

    result = subprocess.run(
        ["node", "--experimental-strip-types", str(script)],
        cwd=str(WEB),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Localization harness failed:\n{result.stderr}\n{result.stdout}"
    assert "ALL GLOBAL LOCALIZATION ARCHITECTURE CHECKS PASSED" in result.stdout


def test_language_is_not_country_law():
    locales_ts = RUNTIME / "src" / "locales.ts"
    assert locales_ts.is_file()
    text = locales_ts.read_text(encoding="utf-8")

    assert "LANGUAGE_IS_NOT_COUNTRY = true" in text
    assert "SUPPORTED_LOCALES" in text
    assert "DEFAULT_LOCALE" in text
    assert "resolveLocale" in text
    assert "isolateBidi" in text
    assert "buildHreflangAlternates" in text


def test_rtl_and_bidi_css_foundations():
    css = (WEB / "src" / "index.css").read_text(encoding="utf-8")

    assert 'html[dir="rtl"]' in css
    assert "direction: rtl" in css
    assert "unicode-bidi: isolate" in css
    assert "bdi" in css


def test_seo_head_injects_hreflangs():
    seo_head = WEB / "src" / "ui" / "SeoHead.tsx"
    assert seo_head.is_file()
    text = seo_head.read_text(encoding="utf-8")

    assert "applyHreflangTags" in text
    assert "applyHreflangTags(document.head, url)" in text


def test_strict_hreflang_publication_truth():
    locales_ts = RUNTIME / "src" / "locales.ts"
    text = locales_ts.read_text(encoding="utf-8")

    assert "PUBLISHED_LOCALES: readonly string[] = [\"en\"]" in text
    assert "Strict Gate: Registered locale without published route must NEVER emit hreflang" in text
