"""Compile a WebsiteSpec into deterministic static HTML and CSS."""

from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

from website_generator.errors import StaticWriteError, WebsiteSpecError
from website_generator.spec import Page, Section, WebsiteSpec, parse_spec
from website_generator.styles import SITE_CSS

_CSS_PATH = "assets/site.css"
_MANIFEST_PATH = "site.manifest.json"
_SLUG = re.compile(r"[^a-z0-9]+")


@dataclass(frozen=True)
class StaticFile:
    relative_path: str
    content: str
    media_type: str


@dataclass(frozen=True)
class SiteArtifact:
    """Offline compile result. status PASS means files were produced locally."""

    spec_version: str
    status: str
    network_mode: str
    hosted: bool
    renderer: str
    telemetry: bool
    files: tuple[StaticFile, ...]

    def __post_init__(self) -> None:
        if self.status != "PASS":
            raise WebsiteSpecError("SiteArtifact status can only be PASS after a successful compile")
        if self.network_mode != "NONE" or self.hosted or self.telemetry:
            raise WebsiteSpecError("compile cannot claim network, hosting, or telemetry")
        if self.renderer != "static-html-css":
            raise WebsiteSpecError("compile renderer is static-html-css only")

    def as_map(self) -> dict[str, str]:
        return {item.relative_path: item.content for item in self.files}


def compile_site(spec: WebsiteSpec | Mapping[str, object]) -> SiteArtifact:
    """Emit static files. No sockets, clocks, or randomness."""
    parsed = spec if isinstance(spec, WebsiteSpec) else parse_spec(spec)
    pages = tuple(_render_page(parsed, page) for page in parsed.pages)
    manifest = _manifest(parsed, pages)
    files = (
        StaticFile(_MANIFEST_PATH, manifest, "application/json"),
        StaticFile(_CSS_PATH, SITE_CSS if SITE_CSS.endswith("\n") else SITE_CSS + "\n", "text/css"),
        *pages,
    )
    return SiteArtifact(
        spec_version=parsed.spec_version,
        status="PASS",
        network_mode="NONE",
        hosted=False,
        renderer="static-html-css",
        telemetry=False,
        files=files,
    )


def write_static(artifact: SiteArtifact, destination: Path) -> tuple[Path, ...]:
    """Write compiled files under destination. This does not host or deploy."""
    if artifact.hosted or artifact.network_mode != "NONE":
        raise StaticWriteError("refusing to write an artifact that claims hosting or network")
    root = destination.resolve()
    root.mkdir(parents=True, exist_ok=True)
    if not root.is_dir():
        raise StaticWriteError("destination must be a directory")
    written: list[Path] = []
    for item in artifact.files:
        target = _safe_target(root, item.relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(item.content, encoding="utf-8", newline="\n")
        written.append(target)
    return tuple(written)


def _safe_target(root: Path, relative_path: str) -> Path:
    if not relative_path or relative_path.startswith(("/", "\\")) or ".." in Path(relative_path).parts:
        raise StaticWriteError(f"refusing unsafe relative path: {relative_path}")
    if "\\" in relative_path or ":" in relative_path:
        raise StaticWriteError(f"refusing unsafe relative path: {relative_path}")
    target = (root / relative_path).resolve()
    if root != target and root not in target.parents:
        raise StaticWriteError(f"refusing path that escapes destination: {relative_path}")
    return target


def _manifest(spec: WebsiteSpec, pages: tuple[StaticFile, ...]) -> str:
    payload = {
        "ai_site_engine": False,
        "emitter": "static-html-css",
        "files": [_MANIFEST_PATH, _CSS_PATH, *[page.relative_path for page in pages]],
        "hosted": False,
        "network_mode": "NONE",
        "sandbox": "UNSUPPORTED",
        "spec_version": spec.spec_version,
        "telemetry": False,
        "three_d": False,
        "visibility": spec.metadata.visibility,
    }
    return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def _render_page(spec: WebsiteSpec, page: Page) -> StaticFile:
    title = html.escape(page.title, quote=True)
    site = html.escape(spec.title, quote=True)
    description = html.escape(spec.summary, quote=True)
    robots = ""
    if spec.metadata.visibility == "private":
        robots = '  <meta name="robots" content="noindex, nofollow">\n'
    summary = f'  <meta name="description" content="{description}">\n' if description else ""
    nav = "\n".join(_nav_item(page, item) for item in spec.pages)
    used_anchors: set[str] = set()
    sections = "\n".join(
        _render_section(section, index == 0, _unique_anchor(section.heading, used_anchors))
        for index, section in enumerate(page.sections)
    )
    document = (
        "<!DOCTYPE html>\n"
        f'<html lang="{html.escape(spec.language, quote=True)}" data-theme="{spec.theme}">\n'
        "<head>\n"
        '  <meta charset="utf-8">\n'
        '  <meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f"  <title>{title}</title>\n"
        f"{summary}"
        f"{robots}"
        f'  <link rel="stylesheet" href="{_CSS_PATH}">\n'
        "</head>\n"
        "<body>\n"
        '  <a class="skip-link" href="#main">Skip to content</a>\n'
        "  <header>\n"
        '    <div class="wrap">\n'
        f'      <p class="site-name"><a href="index.html">{site}</a></p>\n'
        "    </div>\n"
        "  </header>\n"
        '  <nav aria-label="Primary">\n'
        '    <div class="wrap">\n'
        "      <ul>\n"
        f"{nav}\n"
        "      </ul>\n"
        "    </div>\n"
        "  </nav>\n"
        '  <main id="main" tabindex="-1">\n'
        '    <div class="wrap">\n'
        f"{sections}\n"
        "    </div>\n"
        "  </main>\n"
        "  <footer>\n"
        '    <div class="wrap">\n'
        "      <p>Offline static page. This compiler does not host, deploy, or contact a network.</p>\n"
        "    </div>\n"
        "  </footer>\n"
        "</body>\n"
        "</html>\n"
    )
    return StaticFile(page.path, document, "text/html")


def _nav_item(current: Page, item: Page) -> str:
    label = html.escape(item.title, quote=True)
    href = html.escape(item.path, quote=True)
    current_attr = ' aria-current="page"' if item.path == current.path else ""
    return f'        <li><a href="{href}"{current_attr}>{label}</a></li>'


def _render_section(section: Section, first: bool, anchor: str) -> str:
    heading = html.escape(section.heading, quote=True)
    tag = "h1" if first else "h2"
    blocks: list[str] = [
        f'      <section class="section" id="{anchor}" aria-labelledby="{anchor}-title">',
        f'        <{tag} id="{anchor}-title">{heading}</{tag}>',
    ]
    if section.kind in {"hero", "prose", "cta"}:
        blocks.extend(_paragraphs(section.body))
    if section.kind == "list":
        items = "\n".join(
            f"          <li>{html.escape(item, quote=True)}</li>" for item in section.items
        )
        blocks.append(f"        <ul>\n{items}\n        </ul>")
    if section.kind == "cta" and section.cta_label and section.cta_href:
        label = html.escape(section.cta_label, quote=True)
        href = html.escape(section.cta_href, quote=True)
        blocks.append(f'        <a class="cta" href="{href}">{label}</a>')
    blocks.append("      </section>")
    return "\n".join(blocks)


def _paragraphs(body: str) -> list[str]:
    if not body:
        return []
    chunks = [part.strip() for part in body.split("\n\n") if part.strip()]
    return [
        f"        <p>{html.escape(' '.join(chunk.split()), quote=True)}</p>" for chunk in chunks
    ]


_RESERVED_IDS = frozenset({"main"})


def _anchor(heading: str) -> str:
    slug = _SLUG.sub("-", heading.lower()).strip("-")
    if not slug or slug in _RESERVED_IDS:
        return "section"
    return slug


def _unique_anchor(heading: str, used: set[str]) -> str:
    base = _anchor(heading)
    candidate = base
    suffix = 2
    while candidate in used:
        candidate = f"{base}-{suffix}"
        suffix += 1
    used.add(candidate)
    return candidate
