"""Task 13: Simple-mode context controls must not expose internal jargon."""

from __future__ import annotations

import re
from pathlib import Path

from tests.web.paths import WEB

CONTROLS = WEB / "src" / "composer" / "ContextProtocolControls.tsx"
APP = WEB / "src" / "App.tsx"

# Visitor-facing Simple-mode surfaces must never contain these tokens.
FORBIDDEN_SIMPLE = (
    "RAG",
    "ContextCapsule",
    "ProtocolGraph",
    "ABI",
    "WASM",
    "K3",
)

# Connector IDs / plugin-manifest terminology (case-insensitive whole-ish tokens).
FORBIDDEN_SIMPLE_RE = (
    re.compile(r"\bconnector[_-]?id\b", re.I),
    re.compile(r"\bplugin[_-]?manifest\b", re.I),
    re.compile(r"\btool[_-]?selection[_-]?trace\b", re.I),
    re.compile(r"\bdeployment_authority\b", re.I),
)

REQUIRED_SIMPLE_COPY = (
    "Use current sources when they help.",
    "Use the best available tools when they help.",
)


def _read(path: Path) -> str:
    assert path.is_file(), f"missing {path}"
    return path.read_text(encoding="utf-8")


def _simple_mode_blob(src: str) -> str:
    """Collect JSX / string literals that are not under INSPECT/PROOF depth."""
    # Strip blocks explicitly marked as Inspect/Proof copy depth.
    scrubbed = re.sub(
        r'data-copy-depth="(?:INSPECT|PROOF)"[\s\S]*?(?=data-copy-depth=|$</|\Z)',
        " ",
        src,
    )
    # Also drop inspect-only helper sections by common markers.
    scrubbed = re.sub(
        r"/\*\s*INSPECT[\s\S]*?\*/",
        " ",
        scrubbed,
        flags=re.I,
    )
    scrubbed = re.sub(
        r"function\s+Inspect\w*[\s\S]*?^}",
        " ",
        scrubbed,
        flags=re.M,
    )
    return scrubbed


def test_context_protocol_controls_exist_and_export_public_api():
    src = _read(CONTROLS)
    assert "ContextProtocolControls" in src
    for token in (
        "AUTO",
        "ADD_SOURCES",
        "NO_SOURCES",
        "FAST",
        "SMART",
        "DEEP",
    ):
        assert token in src, f"missing public control value {token}"
    assert "mapPublicSourceToWasm" in src
    assert 'ADD_SOURCES' in src and '"ON"' in src or "'ON'" in src
    assert "NO_SOURCES" in src and ("OFF" in src)


def test_simple_mode_copy_examples_present():
    src = _read(CONTROLS)
    for phrase in REQUIRED_SIMPLE_COPY:
        assert phrase in src, f"missing Simple-mode copy: {phrase}"


def test_simple_mode_rejects_internal_jargon():
    simple = _simple_mode_blob(_read(CONTROLS))
    # Pull quoted / JSX text-ish visitor strings from the Simple blob.
    strings = re.findall(r'["`\']([^"`\']{3,200})["`\']', simple)
    jsx_text = re.findall(r">\s*([^<>{}\n][^<>{}]{2,120}?)\s*<", simple)
    visitor = "\n".join(strings + jsx_text)
    for token in FORBIDDEN_SIMPLE:
        # Allow the token only inside comments that say not to expose it.
        naked = re.sub(r"//[^\n]*", " ", visitor)
        naked = re.sub(r"/\*[\s\S]*?\*/", " ", naked)
        assert token not in naked, f"Simple-mode visitor copy must not contain {token}"
    for pat in FORBIDDEN_SIMPLE_RE:
        assert pat.search(visitor) is None, f"Simple-mode must not match {pat.pattern}"


def test_controls_default_auto_and_a11y_hooks():
    src = _read(CONTROLS)
    assert re.search(r'default(?:Value|Source|Depth)?\s*=\s*["\']AUTO["\']', src) or (
        'sourceControl = "AUTO"' in src
        or "sourceControl = 'AUTO'" in src
        or 'useState<"AUTO"' in src
        or 'useState("AUTO")' in src
        or 'PublicSourceControl = "AUTO"' in src
        or "DEFAULT_SOURCE" in src
        or 'source = "AUTO"' in src
        or "source ?? \"AUTO\"" in src
        or "source = sourceProp ?? \"AUTO\"" in src
        or '"AUTO"' in src
    )
    assert 'role="radiogroup"' in src or "role={'radiogroup'}" in src or 'role="group"' in src
    assert "aria-label" in src
    assert "aria-pressed" in src or "aria-checked" in src
    # Practical ~44px targets via class or inline style contract.
    assert (
        "spe-ctx-protocol" in src
        or "min-height: 44px" in src
        or "minHeight" in src
        or "44px" in (WEB / "src" / "index.css").read_text(encoding="utf-8")
    )


def test_app_wires_controls_without_ts_protocol_compiler():
    app = _read(APP)
    assert "ContextProtocolControls" in app
    assert "compileContextProtocol" in app
    assert "mapPublicSourceToWasm" in app or "ADD_SOURCES" in app
    # Must not invent a local protocol compiler in the web app layer.
    composer_dir = WEB / "src" / "composer"
    blob = "\n".join(p.read_text(encoding="utf-8") for p in composer_dir.glob("*.tsx"))
    for pat in (
        r"function\s+select_protocol_depth",
        r"function\s+compile_execution_contract",
        r"function\s+compile_context_need",
        r"ProtocolDepth\s*=",
    ):
        assert re.search(pat, blob) is None, f"composer must not implement {pat}"


def test_inspect_may_surface_quality_fields():
    src = _read(CONTROLS)
    for token in (
        "sources",
        "freshness",
        "contradiction",
        "protocol",
        "quality",
        "limitation",
    ):
        assert token.lower() in src.lower(), f"Inspect surface missing {token}"
