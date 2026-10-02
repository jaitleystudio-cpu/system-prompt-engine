"""Versioned WebsiteSpec. Parsing is offline and rejects unsafe claims."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Mapping

import jsonschema

from website_generator.errors import WebsiteSpecError

SPEC_VERSION = "website-spec/1"
EMITTER = "static-html-css"
SCHEMA_PATH = Path(__file__).resolve().parents[1] / "schema" / "website_spec.v1.schema.json"

SectionKind = Literal["hero", "prose", "list", "cta"]
ThemeName = Literal["dark", "light"]
Visibility = Literal["private", "public"]

def _theme_name(value: object) -> ThemeName:
    if value == "dark":
        return "dark"
    if value == "light":
        return "light"
    raise WebsiteSpecError("theme must be dark or light")


def _visibility_name(value: object) -> Visibility:
    if value == "private":
        return "private"
    if value == "public":
        return "public"
    raise WebsiteSpecError("metadata.visibility must be private or public")


def _section_kind(value: object, *, where: str) -> SectionKind:
    if value == "hero":
        return "hero"
    if value == "prose":
        return "prose"
    if value == "list":
        return "list"
    if value == "cta":
        return "cta"
    raise WebsiteSpecError(f"{where}.kind must be hero, prose, list, or cta")


_TOP_LEVEL = frozenset(
    {"spec_version", "title", "language", "summary", "theme", "emitter", "metadata", "pages"}
)
_PAGE_KEYS = frozenset({"path", "title", "sections"})
_SECTION_KEYS = frozenset({"kind", "heading", "body", "items", "cta_label", "cta_href"})
_METADATA_KEYS = frozenset({"visibility"})

# Normalized by stripping non-alphanumerics and lowercasing.
_FORBIDDEN_KEYS = frozenset(
    {
        "account",
        "accountid",
        "userid",
        "email",
        "apikey",
        "token",
        "accesstoken",
        "secret",
        "password",
        "credential",
        "credentials",
        "analytics",
        "telemetry",
        "tracking",
        "trackingid",
        "pixel",
        "gtag",
        "webhook",
        "hosting",
        "host",
        "deploy",
        "deployment",
        "deploymenturl",
        "network",
        "fetch",
        "websocket",
        "socket",
        "script",
        "iframe",
        "src",
        "url",
        "three",
        "webgl",
        "openai",
    }
)

_PAGE_PATH = re.compile(r"^[a-z0-9][a-z0-9-]*\.html$")
_LANGUAGE = re.compile(r"^[a-z]{2}(?:-[A-Za-z0-9]{2,8})?$")
_SAFE_HREF = re.compile(r"^(?:[a-z0-9][a-z0-9-]*\.html)?(?:#[a-z0-9][a-z0-9-]*)?$")
_MAX_TITLE = 120
_MAX_TEXT = 4000
_MAX_PAGES = 12
_MAX_SECTIONS = 20
_MAX_ITEMS = 20


@dataclass(frozen=True)
class Section:
    kind: SectionKind
    heading: str
    body: str
    items: tuple[str, ...]
    cta_label: str | None
    cta_href: str | None


@dataclass(frozen=True)
class Page:
    path: str
    title: str
    sections: tuple[Section, ...]


@dataclass(frozen=True)
class Metadata:
    visibility: Visibility


@dataclass(frozen=True)
class WebsiteSpec:
    spec_version: str
    title: str
    language: str
    summary: str
    theme: ThemeName
    emitter: Literal["static-html-css"]
    metadata: Metadata
    pages: tuple[Page, ...]


def _norm_key(key: str) -> str:
    return "".join(ch for ch in key.lower() if ch.isalnum())


def _reject_forbidden_keys(value: Any, *, where: str) -> None:
    if isinstance(value, Mapping):
        for key, child in value.items():
            if not isinstance(key, str):
                raise WebsiteSpecError(f"{where} has a non-string key")
            if _norm_key(key) in _FORBIDDEN_KEYS:
                raise WebsiteSpecError(
                    f"{where}.{key} is refused: account, telemetry, network, hosting, and embed fields are out of scope"
                )
            _reject_forbidden_keys(child, where=f"{where}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _reject_forbidden_keys(child, where=f"{where}[{index}]")


def _expect_mapping(value: Any, *, where: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise WebsiteSpecError(f"{where} must be an object")
    return value


def _unknown(keys: set[str], allowed: frozenset[str], *, where: str) -> None:
    extra = sorted(keys - allowed)
    if extra:
        raise WebsiteSpecError(f"{where} has unsupported fields: {extra}")


def _text(value: Any, *, where: str, max_len: int, allow_empty: bool) -> str:
    if not isinstance(value, str):
        raise WebsiteSpecError(f"{where} must be a string")
    cleaned = value.strip()
    if not cleaned and not allow_empty:
        raise WebsiteSpecError(f"{where} must be non-empty")
    if len(cleaned) > max_len:
        raise WebsiteSpecError(f"{where} exceeds {max_len} characters")
    return cleaned


def _safe_href(value: str, *, where: str, pages: frozenset[str]) -> str:
    if not value or not _SAFE_HREF.fullmatch(value) or value == "#":
        raise WebsiteSpecError(
            f"{where} must be a same-site page or fragment. Network, script, and path-escape links are refused"
        )
    if "://" in value or value.startswith("//") or ".." in value or "\\" in value:
        raise WebsiteSpecError(f"{where} is refused as a network or escape path")
    page = value.split("#", 1)[0]
    if page and page not in pages:
        raise WebsiteSpecError(f"{where} points at unknown page {page}")
    return value


def _validate_schema(raw: Mapping[str, Any]) -> None:
    if not SCHEMA_PATH.is_file():
        raise WebsiteSpecError("website spec schema is missing")
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    try:
        jsonschema.validate(instance=raw, schema=schema)
    except jsonschema.ValidationError as exc:
        raise WebsiteSpecError(f"schema refused the spec: {exc.message}") from exc


def parse_spec(raw: Mapping[str, Any]) -> WebsiteSpec:
    """Parse a WebsiteSpec. Raises WebsiteSpecError instead of returning PASS."""
    payload = _expect_mapping(raw, where="spec")
    _reject_forbidden_keys(payload, where="spec")
    _unknown(set(payload.keys()), _TOP_LEVEL, where="spec")
    _validate_schema(payload)

    version = payload.get("spec_version")
    if version != SPEC_VERSION:
        raise WebsiteSpecError(f"spec_version must be {SPEC_VERSION}")

    emitter = payload.get("emitter", EMITTER)
    if emitter != EMITTER:
        raise WebsiteSpecError("emitter must be static-html-css. AI and 3D emitters are refused")

    theme = _theme_name(payload.get("theme", "dark"))

    language = payload.get("language", "en")
    if not isinstance(language, str) or not _LANGUAGE.fullmatch(language):
        raise WebsiteSpecError("language must be a short BCP 47 tag such as en")

    metadata_raw = payload.get("metadata", {"visibility": "private"})
    metadata_map = _expect_mapping(metadata_raw, where="metadata")
    _unknown(set(metadata_map.keys()), _METADATA_KEYS, where="metadata")
    visibility = _visibility_name(metadata_map.get("visibility", "private"))

    pages_raw = payload.get("pages")
    if not isinstance(pages_raw, list) or not pages_raw or len(pages_raw) > _MAX_PAGES:
        raise WebsiteSpecError(f"pages must contain 1 to {_MAX_PAGES} pages")

    pages: list[Page] = []
    seen_paths: set[str] = set()
    for index, page_raw in enumerate(pages_raw):
        page_map = _expect_mapping(page_raw, where=f"pages[{index}]")
        _unknown(set(page_map.keys()), _PAGE_KEYS, where=f"pages[{index}]")
        path = page_map.get("path")
        if not isinstance(path, str) or not _PAGE_PATH.fullmatch(path):
            raise WebsiteSpecError(
                f"pages[{index}].path must be a root html filename such as index.html"
            )
        if path in seen_paths:
            raise WebsiteSpecError(f"duplicate page path: {path}")
        seen_paths.add(path)
        title = _text(page_map.get("title"), where=f"pages[{index}].title", max_len=_MAX_TITLE, allow_empty=False)
        sections_raw = page_map.get("sections")
        if not isinstance(sections_raw, list) or not sections_raw or len(sections_raw) > _MAX_SECTIONS:
            raise WebsiteSpecError(f"pages[{index}].sections must contain 1 to {_MAX_SECTIONS} sections")
        sections: list[Section] = []
        for section_index, section_raw in enumerate(sections_raw):
            sections.append(
                _parse_section(
                    section_raw,
                    where=f"pages[{index}].sections[{section_index}]",
                )
            )
        pages.append(Page(path=path, title=title, sections=tuple(sections)))

    if "index.html" not in seen_paths:
        raise WebsiteSpecError("pages must include index.html")

    page_names = frozenset(seen_paths)
    bound_pages: list[Page] = []
    for page in pages:
        bound_sections: list[Section] = []
        for section in page.sections:
            href = section.cta_href
            if href is not None:
                href = _safe_href(href, where=f"{page.path} cta_href", pages=page_names)
            bound_sections.append(
                Section(
                    kind=section.kind,
                    heading=section.heading,
                    body=section.body,
                    items=section.items,
                    cta_label=section.cta_label,
                    cta_href=href,
                )
            )
        bound_pages.append(Page(path=page.path, title=page.title, sections=tuple(bound_sections)))

    return WebsiteSpec(
        spec_version=SPEC_VERSION,
        title=_text(payload.get("title"), where="title", max_len=_MAX_TITLE, allow_empty=False),
        language=language,
        summary=_text(payload.get("summary", ""), where="summary", max_len=_MAX_TEXT, allow_empty=True),
        theme=theme,
        emitter=EMITTER,
        metadata=Metadata(visibility=visibility),
        pages=tuple(bound_pages),
    )


def _parse_section(raw: Any, *, where: str) -> Section:
    section = _expect_mapping(raw, where=where)
    _unknown(set(section.keys()), _SECTION_KEYS, where=where)
    kind = _section_kind(section.get("kind"), where=where)
    heading = _text(section.get("heading"), where=f"{where}.heading", max_len=_MAX_TITLE, allow_empty=False)
    body = _text(section.get("body", ""), where=f"{where}.body", max_len=_MAX_TEXT, allow_empty=True)
    items_raw = section.get("items", [])
    if not isinstance(items_raw, list) or len(items_raw) > _MAX_ITEMS:
        raise WebsiteSpecError(f"{where}.items must be a list of at most {_MAX_ITEMS} strings")
    items = tuple(
        _text(item, where=f"{where}.items", max_len=_MAX_TEXT, allow_empty=False) for item in items_raw
    )
    label_raw = section.get("cta_label")
    href_raw = section.get("cta_href")
    cta_label = None if label_raw is None else _text(label_raw, where=f"{where}.cta_label", max_len=_MAX_TITLE, allow_empty=False)
    cta_href = None if href_raw is None else href_raw
    if cta_href is not None and not isinstance(cta_href, str):
        raise WebsiteSpecError(f"{where}.cta_href must be a string")
    if kind == "list" and not items:
        raise WebsiteSpecError(f"{where} list requires items")
    if kind == "cta" and (cta_label is None or cta_href is None):
        raise WebsiteSpecError(f"{where} cta requires cta_label and cta_href")
    if kind != "cta" and (cta_label is not None or cta_href is not None):
        raise WebsiteSpecError(f"{where} cta fields are only valid on cta sections")
    if kind != "list" and items:
        raise WebsiteSpecError(f"{where} items are only valid on list sections")
    if kind in {"hero", "prose"} and not body:
        raise WebsiteSpecError(f"{where} requires body")
    return Section(
        kind=kind,
        heading=heading,
        body=body,
        items=items,
        cta_label=cta_label,
        cta_href=cta_href if isinstance(cta_href, str) else None,
    )
