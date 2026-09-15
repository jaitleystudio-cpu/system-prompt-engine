"""Platform registry honesty — never fake RELEASED/PASS for unimplemented."""

from __future__ import annotations

from spe_runtime.portability.conformance import PLATFORM_REGISTRY

REQUIRED_PLATFORMS = [
    "PLATFORM:PYTHON_REFERENCE",
    "PLATFORM:RUST_KERNEL",
    "PLATFORM:TYPESCRIPT",
    "PLATFORM:KOTLIN_ANDROID",
    "PLATFORM:SWIFT_IOS",
    "PLATFORM:WASM",
    "PLATFORM:DESKTOP_NATIVE",
    "PLATFORM:WEB_PWA",
    "PLATFORM:BROWSER_EXTENSION",
    "PLATFORM:MCP_SERVER",
    "PLATFORM:AI_PLUGIN",
]


def test_all_platforms_listed():
    for pid in REQUIRED_PLATFORMS:
        assert pid in PLATFORM_REGISTRY


def test_python_reference_honest():
    py = PLATFORM_REGISTRY["PLATFORM:PYTHON_REFERENCE"]
    assert py["status"] in {"IMPLEMENTING", "CONFORMANCE_PARTIAL"}
    assert py["status"] not in {"RELEASED"}
    assert py.get("conformance") in {None, "PARTIAL", "CONFORMANCE_PARTIAL", "NOT_RUN"}
    assert py["conformance"] not in {"PASS", "CONFORMANCE_PASS"}
    assert py["network_mode"] == "NONE"


def test_non_python_are_planned_not_released():
    for pid, meta in PLATFORM_REGISTRY.items():
        if pid == "PLATFORM:PYTHON_REFERENCE":
            continue
        assert meta["status"] == "PLANNED", pid
        assert meta.get("conformance") in {None, "NOT_RUN", "PLANNED", "NONE"}
        assert meta.get("conformance") not in {"PASS", "CONFORMANCE_PASS"}
        assert meta["status"] != "RELEASED"
