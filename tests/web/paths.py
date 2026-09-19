from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "apps" / "web"


def web_source_text() -> str:
    chunks: list[str] = []
    if not WEB.exists():
        return ""
    for pattern in (
        "*.ts",
        "*.tsx",
        "*.js",
        "*.mjs",
        "*.cjs",
        "*.css",
        "*.html",
        "*.json",
        "*.webmanifest",
        "*.md",
    ):
        for p in WEB.rglob(pattern):
            rel = str(p.relative_to(WEB))
            if rel.startswith("node_modules") or rel.startswith("dist/") or "/node_modules/" in rel:
                continue
            try:
                chunks.append(p.read_text(encoding="utf-8"))
            except (UnicodeDecodeError, OSError):
                continue
    return "\n".join(chunks)
