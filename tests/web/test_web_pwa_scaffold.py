"""RED→GREEN: Vite + React + TS web/PWA scaffold exists and is the only client."""

from __future__ import annotations

import json

from tests.web.paths import WEB


def test_apps_web_vite_react_ts_scaffold_exists():
    assert (WEB / "package.json").is_file(), "apps/web/package.json missing"
    assert (WEB / "index.html").is_file()
    assert (WEB / "vite.config.ts").is_file() or (WEB / "vite.config.mjs").is_file()
    assert (WEB / "tsconfig.json").is_file()
    assert (WEB / "src" / "main.tsx").is_file()
    assert (WEB / "src" / "App.tsx").is_file()


def test_package_json_is_vite_react_typescript_free_stack():
    pkg = json.loads((WEB / "package.json").read_text(encoding="utf-8"))
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    assert "vite" in deps
    assert "react" in deps
    assert "react-dom" in deps
    assert "typescript" in deps
    banned = [
        "three",
        "@react-three/fiber",
        "@react-three/drei",
        "gsap",
        "electron",
        "@capacitor/core",
        "cordova",
        "react-native",
        "expo",
        "stripe",
        "@sentry/browser",
        "mixpanel-browser",
        "amplitude-js",
        "@amplitude/analytics-browser",
        "posthog-js",
        "@analytics/google-analytics",
        "react-ga",
        "react-ga4",
        "plausible-tracker",
        "firebase",
        "next",
        "@vercel/analytics",
    ]
    for name in banned:
        assert name not in deps, name


def test_no_android_ios_desktop_extension_mcp_clients():
    repo_clients = [
        WEB.parent / "android",
        WEB.parent / "ios",
        WEB.parent / "desktop",
        WEB.parent / "extension",
        WEB.parent / "mcp",
        WEB.parent / "electron",
        WEB.parent / "tauri",
    ]
    for p in repo_clients:
        assert not p.exists(), f"out-of-scope client path present: {p}"
