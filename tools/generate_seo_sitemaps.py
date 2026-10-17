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
  - evidence/sitemaps_fingerprint_manifest.json (Deterministic Prompt Fingerprints)
"""

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INDEX_FILE = REPO_ROOT / "apps/web/src/engine/arsenal/arsenalCatalogIndex.json"
PUBLIC_DIR = REPO_ROOT / "apps/web/public"
MANIFEST_FILE = REPO_ROOT / "evidence/sitemaps_fingerprint_manifest.json"

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
    ("/compare/spe-vs-langfuse", "0.9", "weekly"),
    ("/compare/spe-vs-braintrust", "0.9", "weekly"),
    ("/compare/spe-vs-promptlayer", "0.9", "weekly"),
    ("/compare/spe-vs-aiprm", "0.9", "weekly"),
    ("/compare/spe-vs-promptbase", "0.9", "weekly"),
    ("/compare/spe-vs-promptperfect", "0.9", "weekly"),
    ("/compare/spe-vs-agenta", "0.9", "weekly"),
    ("/compare/spe-vs-all", "0.9", "weekly"),
    ("/alternatives/promptfoo-alternative", "0.9", "weekly"),
    ("/alternatives/langfuse-alternative", "0.9", "weekly"),
    ("/alternatives/braintrust-alternative", "0.9", "weekly"),
    ("/alternatives/aiprm-alternative", "0.9", "weekly"),
    ("/alternatives/promptbase-alternative", "0.9", "weekly"),
    ("/alternatives/feedough-alternative", "0.9", "weekly"),
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
    ("/api/v1/prompts", "0.9", "daily"),
    ("/api/v1/model-formats", "0.8", "weekly"),
    ("/api/v1/prompt-packs", "0.8", "weekly"),
    ("/llms.txt", "0.9", "daily"),
    ("/llms-full.txt", "0.8", "weekly"),
    ("/privacy", "0.7", "monthly"),
]


def extract_existing_lastmods(xml_path: Path) -> dict[str, str]:
    if not xml_path.exists():
        return {}
    try:
        content = xml_path.read_text(encoding="utf-8")
        result = {}
        # Parse each <url>...</url> block independently to handle arbitrary tag order or whitespace
        url_blocks = re.findall(r"<url>(.*?)</url>", content, re.DOTALL)
        for block in url_blocks:
            loc_m = re.search(r"<loc>(.*?)</loc>", block)
            lastmod_m = re.search(r"<lastmod>(\d{4}-\d{2}-\d{2})</lastmod>", block)
            if loc_m and lastmod_m:
                result[loc_m.group(1).strip()] = lastmod_m.group(1).strip()
        # Fallback to direct regex if no <url> tags are present
        if not result:
            matches = re.findall(r"<loc>(.*?)</loc>.*?<lastmod>(\d{4}-\d{2}-\d{2})</lastmod>", content, re.DOTALL)
            result = {loc.strip(): lm.strip() for loc, lm in matches}
        return result
    except Exception:
        return {}


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

    # Load existing sitemaps and fingerprint manifest
    sitemap_core_path = PUBLIC_DIR / "sitemap-core.xml"
    sitemap_prompts_path = PUBLIC_DIR / "sitemap-prompts.xml"
    master_sitemap_path = PUBLIC_DIR / "sitemap.xml"

    existing_core_lastmods = extract_existing_lastmods(sitemap_core_path)
    existing_prompt_lastmods = extract_existing_lastmods(sitemap_prompts_path)

    prev_manifest = {}
    if MANIFEST_FILE.exists():
        try:
            prev_manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
        except Exception:
            prev_manifest = {}

    prev_core_hash = prev_manifest.get("corePagesHash")
    prev_fingerprints = prev_manifest.get("promptFingerprints", {})

    # 2. Generate sitemap-core.xml with change detection
    curr_core_hash = hashlib.sha256(json.dumps(CORE_PAGES, sort_keys=True).encode("utf-8")).hexdigest()
    core_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
    core_lastmods = []
    for path, prio, freq in CORE_PAGES:
        loc = f"{BASE_URL}/" if path == "/" else f"{BASE_URL}{path}"
        if curr_core_hash == prev_core_hash and loc in existing_core_lastmods:
            lastmod = existing_core_lastmods[loc]
        elif not prev_manifest and loc in existing_core_lastmods:
            lastmod = existing_core_lastmods[loc]
        else:
            lastmod = today_iso
        core_lastmods.append(lastmod)
        core_xml_lines.append(f"""  <url>
    <loc>{loc}</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>{freq}</changefreq>
    <priority>{prio}</priority>
  </url>""")
    core_xml_lines.append('</urlset>')

    with open(sitemap_core_path, "w", encoding="utf-8") as f:
        f.write("\n".join(core_xml_lines))
    print(f"  ✓ Wrote {sitemap_core_path} ({len(CORE_PAGES)} core pages).")

    # 3. Generate sitemap-prompts.xml with per-prompt content change detection
    prompts_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
    new_fingerprints = {}
    prompt_lastmods = []
    unchanged_prompts = 0
    updated_prompts = 0

    for item in prompts:
        prompt_id = item["id"]
        loc = f"{BASE_URL}/prompts/{prompt_id}"
        prompt_fp = hashlib.sha256(json.dumps(item, sort_keys=True).encode("utf-8")).hexdigest()[:16]
        new_fingerprints[prompt_id] = prompt_fp

        if prev_fingerprints and prev_fingerprints.get(prompt_id) == prompt_fp and loc in existing_prompt_lastmods:
            lastmod = existing_prompt_lastmods[loc]
            unchanged_prompts += 1
        elif not prev_fingerprints and loc in existing_prompt_lastmods:
            # First bootstrap from existing sitemap: preserve existing lastmod
            lastmod = existing_prompt_lastmods[loc]
            unchanged_prompts += 1
        else:
            lastmod = today_iso
            updated_prompts += 1

        prompt_lastmods.append(lastmod)
        prompts_xml_lines.append(f"""  <url>
    <loc>{loc}</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>""")
    prompts_xml_lines.append('</urlset>')

    with open(sitemap_prompts_path, "w", encoding="utf-8") as f:
        f.write("\n".join(prompts_xml_lines))
    print(f"  ✓ Wrote {sitemap_prompts_path} ({len(prompts)} programmatic prompt URLs: {unchanged_prompts} unchanged, {updated_prompts} updated).")

    # 4. Generate Master sitemap.xml Index
    core_master_lastmod = max(core_lastmods) if core_lastmods else today_iso
    prompts_master_lastmod = max(prompt_lastmods) if prompt_lastmods else today_iso

    index_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        f"""  <sitemap>
    <loc>{BASE_URL}/sitemap-core.xml</loc>
    <lastmod>{core_master_lastmod}</lastmod>
  </sitemap>""",
        f"""  <sitemap>
    <loc>{BASE_URL}/sitemap-prompts.xml</loc>
    <lastmod>{prompts_master_lastmod}</lastmod>
  </sitemap>""",
        '</sitemapindex>'
    ]

    with open(master_sitemap_path, "w", encoding="utf-8") as f:
        f.write("\n".join(index_xml_lines))
    print(f"  ✓ Wrote Master Sitemap Index to {master_sitemap_path}.")

    # 5. Save Fingerprint Manifest (Deterministic)
    manifest_payload = {
        "version": "1.0.0",
        "lastUpdated": max(core_master_lastmod, prompts_master_lastmod),
        "corePagesHash": curr_core_hash,
        "totalPrompts": len(prompts),
        "promptFingerprints": new_fingerprints,
    }
    MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_FILE.write_text(json.dumps(manifest_payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"  ✓ Wrote Sitemap Fingerprint Manifest to {MANIFEST_FILE}.")

    print(f"\n[+] Successfully generated 10,000+ programmatic SEO sitemaps for Google indexing!")


if __name__ == "__main__":
    generate_sitemaps()
