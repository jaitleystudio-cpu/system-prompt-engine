#!/usr/bin/env python3
"""
tools/generate_seo_sitemaps.py

Automated Programmatic SEO Sitemap Engine for SPE.
Generates the Google-compliant master XML sitemap index and sub-sitemaps
for all 10,000+ prompt assets across 13 professional domains.

Outputs:
  - apps/web/public/sitemap.xml (Master Sitemap Index)
  - apps/web/public/sitemap-core.xml (Core Canonical Pages)
  - apps/web/public/sitemap-prompts.xml (10,000 Programmatic Prompt URLs)
"""

import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INDEX_FILE = REPO_ROOT / "apps/web/src/engine/arsenal/arsenalCatalogIndex.json"
PUBLIC_DIR = REPO_ROOT / "apps/web/public"

BASE_URL = "https://systempromptengine.com"

CORE_PAGES = [
    ("/", "1.0", "daily"),
    ("/prompts", "1.0", "daily"),
    ("/create", "0.9", "daily"),
    ("/pricing", "0.9", "daily"),
    ("/code", "0.8", "daily"),
    ("/daily-lab", "0.8", "daily"),
    ("/capabilities", "0.8", "weekly"),
    ("/workflows", "0.8", "weekly"),
    ("/build-skill", "0.8", "weekly"),
    ("/compare", "0.8", "weekly"),
    ("/eval-studio", "0.9", "daily"),
    ("/compare/spe-vs-feedough", "0.9", "weekly"),
    ("/compare/spe-vs-promptfoo", "0.9", "weekly"),
    ("/tools/chatgpt-prompt-generator", "0.9", "daily"),
    ("/tools/claude-prompt-generator", "0.9", "daily"),
    ("/tools/xml-prompt-generator", "0.9", "daily"),
    ("/tools/json-prompt-generator", "0.9", "daily"),
    ("/tools/chain-of-thought-prompt-generator", "0.9", "daily"),
    ("/tools/reasoning-prompt-generator", "0.9", "daily"),
    ("/tools/few-shot-prompt-generator", "0.9", "daily"),
    ("/tools/tree-of-thought-prompt-generator", "0.9", "daily"),
    ("/tools/ai-prompt-optimiser", "0.9", "daily"),
    ("/tools/system-prompt-generator", "0.9", "daily"),
    ("/privacy", "0.7", "monthly"),
]

def generate_sitemaps():
    print("[*] Generating Programmatic SEO Sitemaps for Google #1 Dominance...")
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # 1. Load the 10,000 prompt catalog index
    if not INDEX_FILE.exists():
        print(f"[!] Error: {INDEX_FILE} not found. Run generate_10k_arsenal.py first.")
        return

    with open(INDEX_FILE, "r", encoding="utf-8") as f:
        prompts = json.load(f)

    print(f"  ✓ Loaded {len(prompts)} prompt records from index.")

    # 2. Generate sitemap-core.xml
    core_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
    for path, prio, freq in CORE_PAGES:
        loc = f"{BASE_URL}/" if path == "/" else f"{BASE_URL}{path}"
        core_xml_lines.append(f"""  <url>
    <loc>{loc}</loc>
    <lastmod>{today_iso}</lastmod>
    <changefreq>{freq}</changefreq>
    <priority>{prio}</priority>
  </url>""")
    core_xml_lines.append('</urlset>')

    sitemap_core_path = PUBLIC_DIR / "sitemap-core.xml"
    with open(sitemap_core_path, "w", encoding="utf-8") as f:
        f.write("\n".join(core_xml_lines))
    print(f"  ✓ Wrote {sitemap_core_path} ({len(CORE_PAGES)} core pages).")

    # 3. Generate sitemap-prompts.xml (all 10,000 prompt assets)
    prompts_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
    for item in prompts:
        prompt_id = item["id"]
        loc = f"{BASE_URL}/prompts/{prompt_id}"
        prompts_xml_lines.append(f"""  <url>
    <loc>{loc}</loc>
    <lastmod>{today_iso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>""")
    prompts_xml_lines.append('</urlset>')

    sitemap_prompts_path = PUBLIC_DIR / "sitemap-prompts.xml"
    with open(sitemap_prompts_path, "w", encoding="utf-8") as f:
        f.write("\n".join(prompts_xml_lines))
    print(f"  ✓ Wrote {sitemap_prompts_path} ({len(prompts)} programmatic prompt URLs).")

    # 4. Generate Master sitemap.xml Index
    index_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        f"""  <sitemap>
    <loc>{BASE_URL}/sitemap-core.xml</loc>
    <lastmod>{today_iso}</lastmod>
  </sitemap>""",
        f"""  <sitemap>
    <loc>{BASE_URL}/sitemap-prompts.xml</loc>
    <lastmod>{today_iso}</lastmod>
  </sitemap>""",
        '</sitemapindex>'
    ]

    master_sitemap_path = PUBLIC_DIR / "sitemap.xml"
    with open(master_sitemap_path, "w", encoding="utf-8") as f:
        f.write("\n".join(index_xml_lines))
    print(f"  ✓ Wrote Master Sitemap Index to {master_sitemap_path}.")

    print(f"\n[+] Successfully generated 10,000+ programmatic SEO sitemaps for Google indexing!")

if __name__ == "__main__":
    generate_sitemaps()
