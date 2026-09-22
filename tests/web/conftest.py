from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "apps" / "web"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def collect_web_text() -> str:
    chunks: list[str] = []
    if not WEB.exists():
        return ""
    for pattern in (
        "*.ts",
        "*.tsx",
        "*.js",
        "*.mjs",
        "*.css",
        "*.html",
        "*.json",
        "*.webmanifest",
        "*.md",
    ):
        for p in WEB.rglob(pattern):
            rel = p.as_posix()
            if "node_modules" in rel or "/dist/" in rel or rel.endswith("/dist"):
                continue
            try:
                chunks.append(p.read_text(encoding="utf-8"))
            except (UnicodeDecodeError, OSError):
                continue
    return "\n".join(chunks)
