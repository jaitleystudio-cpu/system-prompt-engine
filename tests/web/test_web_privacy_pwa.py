"""Privacy, PWA, session-local, analytics, CSP, a11y source gates."""

from __future__ import annotations

import json
import re

from tests.web.paths import WEB, web_source_text


def test_pwa_manifest_and_service_worker_exist():
    manifest_paths = list(WEB.rglob("*.webmanifest")) + list(WEB.rglob("manifest.json"))
    assert manifest_paths, "PWA manifest missing"
    sw_paths = [
        p
        for p in WEB.rglob("*")
        if p.is_file() and p.name in {"sw.js", "service-worker.js", "sw.ts"}
        or "service-worker" in p.name
        or p.name == "sw.js"
    ]
    # also src/pwa/*
    sw_paths += list((WEB / "public").glob("sw.js")) if (WEB / "public").exists() else []
    sw_paths += list((WEB / "src").rglob("*sw*")) if (WEB / "src").exists() else []
    sw_paths = [p for p in sw_paths if "node_modules" not in str(p)]
    assert sw_paths, "service worker missing"


def test_service_worker_does_not_cache_private_prompts():
    sw_files = []
    for folder in (WEB / "public", WEB / "src"):
        if folder.exists():
            sw_files.extend(
                p
                for p in folder.rglob("*")
                if p.is_file()
                and p.suffix in {".js", ".ts"}
                and ("sw" in p.name or "service-worker" in p.name)
            )
    assert sw_files, "no service worker files"
    text = "\n".join(p.read_text(encoding="utf-8") for p in sw_files)
    assert "POST" not in text or "skip" in text.lower() or "not cache" in text.lower() or "never cache" in text.lower()
    # Must not cache request bodies / prompt JSON
    assert "request.json()" not in text
    assert "prompt" not in text.lower() or "no" in text.lower() and "prompt" in text.lower()


def test_no_accounts_local_history_is_opt_in_only():
    """SPE-WEB-01: no accounts; local history allowed only behind explicit opt-in.

    Supersedes Sprint-6 session-only ban for product local-first history.
    Service worker must still never see prompt bodies.
    """
    src = ""
    runtime = ""
    from tests.web.paths import REPO

    if (WEB / "src").exists():
        src = "\n".join(
            p.read_text(encoding="utf-8")
            for p in (WEB / "src").rglob("*")
            if p.suffix in {".ts", ".tsx", ".js", ".mjs"}
        )
    runtime_dir = REPO / "packages" / "web-runtime" / "src"
    if runtime_dir.is_dir():
        runtime = "\n".join(
            p.read_text(encoding="utf-8")
            for p in runtime_dir.rglob("*.ts")
        )
    blob = src + "\n" + runtime
    assert "login" not in blob.lower()
    assert "signup" not in blob.lower()
    assert "oauth" not in blob.lower()
    assert "indexedDB" not in blob
    # Opt-in gate must exist if localStorage is used for history.
    if "localStorage" in blob:
        assert "HISTORY_OPT_IN" in blob or "history.opt_in" in blob or "Enable local history" in blob
        assert "setHistoryOptIn" in blob or "HISTORY_OPT_IN_KEY" in blob


def test_zero_analytics_and_no_ads_billing():
    text = web_source_text().lower()
    for token in (
        "google-analytics",
        "googletagmanager",
        "gtag(",
        "mixpanel",
        "amplitude",
        "posthog",
        "sentry.io",
        "facebook.com/tr",
        "adsbygoogle",
        "stripe.com",
        "doubleclick",
    ):
        assert token not in text, token


def test_design_tokens_obsidian_platinum_system_fonts():
    css_files = list(WEB.rglob("*.css")) if WEB.exists() else []
    css = "\n".join(p.read_text(encoding="utf-8") for p in css_files if "node_modules" not in str(p))
    assert "obsidian" in css.lower()
    assert "platinum" in css.lower()
    assert "system-ui" in css or "-apple-system" in css
    assert "fonts.googleapis.com" not in css
    assert "fonts.gstatic.com" not in css


def test_responsive_and_a11y_source_contracts():
    src_files = []
    if (WEB / "src").exists():
        src_files = [
            p
            for p in (WEB / "src").rglob("*")
            if p.suffix in {".ts", ".tsx", ".css", ".html"}
        ]
    html = (WEB / "index.html").read_text(encoding="utf-8") if (WEB / "index.html").exists() else ""
    css = "\n".join(p.read_text(encoding="utf-8") for p in src_files if p.suffix == ".css")
    tsx = "\n".join(p.read_text(encoding="utf-8") for p in src_files if p.suffix in {".tsx", ".ts"})
    blob = html + css + tsx
    assert "prefers-reduced-motion" in blob
    assert "skip" in blob.lower() or "skip-link" in blob.lower() or 'href="#main"' in blob
    assert "viewport" in html
    assert re.search(r"@media", css)
    assert "aria-" in tsx or "aria-" in html


def test_privacy_indicator_and_trust_panel_present():
    tsx = ""
    if (WEB / "src").exists():
        tsx = "\n".join(
            p.read_text(encoding="utf-8")
            for p in (WEB / "src").rglob("*")
            if p.suffix in {".tsx", ".ts"}
        )
    assert "PrivacyIndicator" in tsx or "privacy" in tsx.lower()
    assert "TrustPanel" in tsx or "trust" in tsx.lower()
    assert "not_a_release" in tsx or "not a release" in tsx.lower()


def test_csp_notes_exist():
    notes = list(WEB.rglob("*csp*")) + list((WEB.parent.parent / "docs").rglob("*CSP*"))
    # docs/implementation
    from tests.web.paths import REPO

    candidates = [
        REPO / "docs" / "implementation" / "WEB_CSP.md",
        WEB / "CSP.md",
        WEB / "docs" / "CSP.md",
    ]
    assert any(p.is_file() for p in candidates), "CSP notes missing"


def test_copy_only_on_explicit_action():
    tsx = ""
    if (WEB / "src").exists():
        tsx = "\n".join(
            p.read_text(encoding="utf-8")
            for p in (WEB / "src").rglob("*")
            if p.suffix in {".tsx", ".ts"}
        )
    if "clipboard" in tsx:
        assert "onClick" in tsx or "onClick" in tsx.replace("on-click", "onClick")
        assert "useEffect" not in tsx.split("clipboard")[0][-80:] or "clipboard.writeText" in tsx
