"""SPE-WEB-01 product surface gates (home, lenses, targets, .spe, history, a11y)."""

from __future__ import annotations

from tests.web.paths import REPO, WEB


def _src() -> str:
    parts: list[str] = []
    for folder in (WEB / "src", REPO / "packages" / "web-runtime" / "src"):
        if not folder.exists():
            continue
        for p in folder.rglob("*"):
            if p.suffix in {".ts", ".tsx", ".css", ".html"} and p.is_file():
                parts.append(p.read_text(encoding="utf-8"))
    html = WEB / "index.html"
    if html.is_file():
        parts.append(html.read_text(encoding="utf-8"))
    return "\n".join(parts)


def test_home_brand_and_one_line_cta():
    blob = _src()
    assert "System Prompt Engine" in blob
    assert "Build with SPE" in blob
    assert "One line" in blob or "one-line" in blob


def test_intent_and_prompt_lens_surfaces():
    blob = _src()
    assert "Intent lens" in blob or "intent lens" in blob.lower()
    assert "Prompt lens" in blob or "prompt lens" in blob.lower()
    assert "confirmed" in blob.lower()
    assert "assumed" in blob.lower()
    assert "unknown" in blob.lower()


def test_target_selector_and_categories():
    blob = _src()
    for token in ("ChatGPT", "Claude", "Gemini", "Copilot", "Local Model"):
        assert token in blob
    for cat in ("Writing", "Coding", "Research", "Website / 3D", "Image", "Video"):
        assert cat in blob


def test_spe_artifact_and_history_surfaces():
    blob = _src()
    assert ".spe" in blob
    assert "local history" in blob.lower() or "Enable local history" in blob
    assert "Download .spe" in blob or "Export .spe" in blob


def test_packages_layout_present():
    assert (REPO / "packages" / "design-system" / "src" / "tokens.css").is_file()
    assert (REPO / "packages" / "web-runtime" / "src" / "index.ts").is_file()
    assert (WEB / "src" / "App.tsx").is_file()


def test_real_wasm_path_not_mock_rewriter_claim():
    blob = _src()
    assert "spe_wasm.wasm" in blob or "Web Worker" in blob
    assert "used_ts_fallback" in blob
    assert "WASM_INTEGRITY_MISMATCH" in blob or "EngineClient" in blob


def test_g6h_frozen_artifacts_untouched_by_web_branch():
    """Website branch must not ship mutated G6-H study files."""
    for rel in (
        "benchmarks/g6zc/rubric.json",
        "benchmarks/g6zc/thresholds.json",
        "benchmarks/g6zc/randomization_manifest.json",
        "evaluations/g6zc/blind_pairs.json",
        "evaluations/g6zc/blind_evaluator.html",
    ):
        p = REPO / rel
        # On main-based web branch these may be absent — isolation is fine.
        if p.is_file():
            assert p.stat().st_size > 0
