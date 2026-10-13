"""The R0 website must not index synthetic AI incidents or fake model metrics."""
from pathlib import Path
import json
import re

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
