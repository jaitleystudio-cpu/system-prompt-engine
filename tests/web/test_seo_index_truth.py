"""SEO / crawl / index truth — private surfaces must not be advertised as indexable."""

from __future__ import annotations

import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "apps" / "web"


def test_seo_index_truth_script_passes():
    script = WEB / "scripts" / "test-seo-index-truth.mjs"
    assert script.is_file(), "SEO index-truth script missing"
    result = subprocess.run(
        ["node", str(script)],
        cwd=str(WEB),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"SEO index-truth failed:\n{result.stderr}\n{result.stdout}"
    )
    assert "PASS seo index truth" in result.stdout
    assert "not_claimed" in result.stdout


def test_robots_and_sitemap_private_surfaces():
    robots = (WEB / "public" / "robots.txt").read_text(encoding="utf-8")
    sitemap = (WEB / "public" / "sitemap.xml").read_text(encoding="utf-8")
    seo_head = (WEB / "src" / "ui" / "SeoHead.tsx").read_text(encoding="utf-8")

    for path in ("/my-work", "/workspace"):
        assert f"Disallow: {path}" in robots, f"robots missing Disallow {path}"
        assert f"Allow: {path}" not in robots, f"robots must not Allow {path}"
        assert path not in sitemap, f"sitemap must not list {path}"

    for path in ("/create", "/code", "/daily-lab", "/privacy", "/capabilities"):
        assert f"Allow: {path}" in robots
        assert f"https://systempromptengine.com{path}" in sitemap

    assert "noindex, nofollow" in seo_head
    assert "NOINDEX_VIEWS" in seo_head
    assert '"my-work"' in seo_head
    assert '"workspace"' in seo_head
