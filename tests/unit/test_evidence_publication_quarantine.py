"""The R0 website must not index synthetic AI incidents or fake model metrics."""
from pathlib import Path
import json
import shutil
import subprocess
import pytest

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "apps/web/public/evidence-pages"
PAGES = [
  "ai-instruction-compiler.html",
  "compare.html",
  "failure-genome_SPE-FG-2026-000001.html",
  "failure-genome_SPE-FG-2026-000002.html",
  "models_anthropic_claude-3-7-sonnet.html",
  "models_deepseek_deepseek-r1.html",
  "models_google_gemini-1-5-pro.html",
  "models_meta_llama-3-3-70b.html",
  "models_openai_gpt-4o.html",
  "compare_spe-vs-langfuse.html",
  "compare_spe-vs-litellm.html",
  "compare_spe-vs-promptfoo.html"
]

def test_synthetic_evidence_pages_are_nonindexable_and_inert():
    for name in PAGES:
        text = (EVIDENCE / name).read_text(encoding="utf-8")
        assert "SYNTHETIC FIXTURE" in text, name
        assert 'content="noindex, nofollow, noarchive"' in text, name
        assert 'rel="canonical"' not in text, name
        assert "<script" not in text, name
        assert "Verified Empirical Scores" not in text, name

def test_synthetic_pages_removed_from_sitemap():
    sitemap = (ROOT / "apps/web/public/sitemap.xml").read_text(encoding="utf-8")
    for target in ("/compare", "/compare/spe-vs-promptfoo", "/models/openai/gpt-4o",
                   "/models/anthropic/claude-3-7-sonnet", "/failure-genome/SPE-FG-2026-000001",
                   "/ai-instruction-compiler"):
        assert f"<loc>https://systempromptengine.com{target}</loc>" not in sitemap

def test_generator_enforces_source_of_truth_quarantine():
    source = (ROOT / "scripts/generate-evidence-seo.mjs").read_text(encoding="utf-8")
    assert "SAFE_ROUTES = ROUTES.map" in source
    assert "UNVERIFIED_EVIDENCE_FLAGS" in source
    assert "SAFE_ROUTES.filter(r => r.indexing_status !== 'NOINDEX')" in source
    manifest = json.loads((ROOT / "evidence/seo-manifest.json").read_text(encoding="utf-8"))
    assert manifest["indexing_summary"]["noindex_count"] >= 6
    assert all(x["indexing_status"] == "NOINDEX" for x in manifest["pages"]
               if x["path"].startswith(("/models/", "/failure-genome/", "/compare/")))

def test_generator_regenerates_only_nonindexable_fixtures(tmp_path):
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node.js not available for isolated source-generator replay")
    scratch_scripts = tmp_path / "scripts"
    scratch_scripts.mkdir()
    source = ROOT / "scripts/generate-evidence-seo.mjs"
    shadow = scratch_scripts / source.name
    shutil.copy2(source, shadow)
    run = subprocess.run(
        [node, str(shadow)], cwd=tmp_path,
        capture_output=True, text=True, timeout=20, check=False,
    )
    assert run.returncode == 0, run.stdout + run.stderr
    public = tmp_path / "apps/web/public"
    for target in (
        "models_openai_gpt-4o.html", "failure-genome_SPE-FG-2026-000001.html",
        "compare.html", "compare_spe-vs-promptfoo.html", "ai-instruction-compiler.html",
    ):
        html = (public / "evidence-pages" / target).read_text(encoding="utf-8")
        assert "SYNTHETIC FIXTURE" in html
        assert 'content="noindex, nofollow, noarchive"' in html
        assert "<script" not in html
    sitemap = (public / "sitemap.xml").read_text(encoding="utf-8")
    assert "models/openai/gpt-4o" not in sitemap
    assert "failure-genome/SPE-FG-2026-000001" not in sitemap
    manifest = json.loads((tmp_path / "evidence/seo-manifest.json").read_text(encoding="utf-8"))
    assert manifest["indexing_summary"]["noindex_count"] >= 6
    assert manifest["zero_placeholder_pages_verified"] is False
