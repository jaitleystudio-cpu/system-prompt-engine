"""HTML and CSS metadata. Parsing is data-only. Scripts are not executed."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any

from spe_runtime.webrecon.assets import resolve_reference
from spe_runtime.webrecon.digest import digest_text
from spe_runtime.webrecon.interactions import Interaction
from spe_runtime.webrecon.isolation import QuarantineEvent, sanitize_css
from spe_runtime.webrecon.layout import LayoutAttribute, LayoutNode
from spe_runtime.webrecon.limits import ObservationLimits

_VOID = frozenset(
    {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    }
)
_ATTR_EXACT = frozenset(
    {
        "id",
        "class",
        "role",
        "href",
        "src",
        "alt",
        "title",
        "type",
        "name",
        "method",
        "action",
        "rel",
        "lang",
        "dir",
        "colspan",
        "rowspan",
        "headers",
        "open",
        "disabled",
        "placeholder",
        "for",
        "width",
        "height",
        "poster",
        "controls",
        "autoplay",
        "loop",
        "muted",
        "preload",
        "as",
        "crossorigin",
        "integrity",
        "target",
        "hreflang",
        "media",
        "sizes",
        "srcset",
        "kind",
        "label",
        "span",
        "start",
        "reversed",
    }
)
_URL_ATTRS = frozenset({"href", "src", "action", "poster", "formaction"})
_FONT_PROPS = (
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "font",
)


@dataclass(frozen=True)
class MetaObservation:
    key_kind: str
    key: str
    content: str | None

    def to_dict(self) -> dict[str, Any]:
        return {"key_kind": self.key_kind, "key": self.key, "content": self.content}


@dataclass(frozen=True)
class CustomProperty:
    name: str
    value: str | None
    source: str

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "value": self.value, "source": self.source}


@dataclass(frozen=True)
class DocumentMetadata:
    doctype: str | None
    html_lang: str | None
    charset: str | None
    title: str | None
    viewport: str | None
    base_href: str | None
    meta: tuple[MetaObservation, ...]
    stylesheet_links: tuple[str, ...]
    inline_style_block_count: int
    custom_properties: tuple[CustomProperty, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "doctype": self.doctype,
            "html_lang": self.html_lang,
            "charset": self.charset,
            "title": self.title,
            "viewport": self.viewport,
            "base_href": self.base_href,
            "meta": [item.to_dict() for item in self.meta],
            "stylesheet_links": list(self.stylesheet_links),
            "inline_style_block_count": self.inline_style_block_count,
            "custom_properties": [item.to_dict() for item in self.custom_properties],
        }


@dataclass(frozen=True)
class HtmlAssetRef:
    kind: str
    declared_ref: str
    integrity: str | None
    node_id: str | None
    fetch_status: str
    execution: str
    digest: str | None


@dataclass
class _MutableNode:
    node_id: str
    tag: str
    attributes: list[LayoutAttribute] = field(default_factory=list)
    text_parts: list[str] = field(default_factory=list)
    children: list[_MutableNode] = field(default_factory=list)


@dataclass
class HtmlParse:
    metadata_seed: dict[str, Any]
    layout: LayoutNode
    style_sheets: tuple[tuple[str, str], ...]
    asset_refs: tuple[HtmlAssetRef, ...]
    interactions: tuple[Interaction, ...]
    inline_font_hints: tuple[dict[str, str | None], ...]
    canvas_count: int
    script_hints: tuple[str, ...]
    camera_declared: tuple[str, ...]
    events: tuple[QuarantineEvent, ...]
    gaps: tuple[str, ...]
    truncated: bool


def _collapse(text: str, limit: int) -> str | None:
    cleaned = " ".join(text.split())
    if not cleaned:
        return None
    if len(cleaned) > limit:
        return cleaned[: limit - 1].rstrip() + "…"
    return cleaned


def _freeze(node: _MutableNode, limit: int) -> LayoutNode:
    excerpt = _collapse(" ".join(node.text_parts), limit)
    return LayoutNode(
        node_id=node.node_id,
        tag=node.tag,
        attributes=tuple(node.attributes),
        text_excerpt=excerpt,
        children=tuple(_freeze(child, limit) for child in node.children),
    )


def _active_url(value: str) -> bool:
    stripped = value.strip().lower()
    return stripped.startswith("javascript:") or stripped.startswith("vbscript:")


_RAWTEXT_TAGS = frozenset(
    {
        "iframe",
        "noembed",
        "noscript",
        "plaintext",
        "script",
        "style",
        "textarea",
        "title",
        "xmp",
    }
)


def _consume_markup_tag(text: str, start: int) -> tuple[str, int] | None:
    """Return the tag name and the index after `>`, or None when `<` is not a tag."""

    n = len(text)
    i = start + 1
    if i >= n:
        return None
    nxt = text[i]
    if nxt in "/!?":
        end = text.find(">", i)
        if end < 0:
            return None
        return "", end + 1
    if not nxt.isalpha():
        return None
    j = i + 1
    while j < n and (text[j].isalnum() or text[j] in "-:"):
        j += 1
    name = text[i:j].lower()
    quote = ""
    while j < n:
        char = text[j]
        if quote:
            if char == quote:
                quote = ""
            j += 1
            continue
        if char in "\"'":
            quote = char
            j += 1
            continue
        if char == ">":
            return name, j + 1
        j += 1
    return None


def markup_is_malformed(html: str) -> bool:
    """True when a raw `<` does not open a tag, comment, or declaration.

    `<<<<not-a-document>>>>` is not a document. The data parser would invent
    an element and report a complete observation.
    """

    lower = html.lower()
    i = 0
    n = len(html)
    while i < n:
        if lower.startswith("<!--", i):
            end = lower.find("-->", i + 4)
            if end < 0:
                return True
            i = end + 3
            continue
        if html[i] != "<":
            i += 1
            continue
        consumed = _consume_markup_tag(html, i)
        if consumed is None:
            return True
        name, i = consumed
        if name not in _RAWTEXT_TAGS:
            continue
        if name == "plaintext":
            return False
        end = lower.find(f"</{name}", i)
        if end < 0:
            return False
        i = end
    return False


def _refresh_target(content: str) -> str:
    match = re.search(r"(?i)url\s*=\s*(.*)$", content)
    if not match:
        return content.strip()
    return match.group(1).strip().strip("\"'")


def _data_url(value: str) -> bool:
    return value.strip().lower().startswith("data:")


def _srcset_urls(value: str) -> list[str]:
    urls: list[str] = []
    for part in value.split(","):
        token = part.strip().split(" ")[0].strip()
        if token:
            urls.append(token)
    return urls


class _CaptureParser(HTMLParser):
    """Stdlib HTML parser used as a data reader. It is not a layout engine."""

    def __init__(self, *, page_url: str, limits: ObservationLimits) -> None:
        super().__init__(convert_charrefs=True)
        self.page_url = page_url
        self.limits = limits
        self.root = _MutableNode(node_id="document", tag="#document")
        self.stack: list[_MutableNode] = [self.root]
        self.node_count = 1
        self.skip_depth = 0
        self.truncated = False
        self.gaps: list[str] = []
        self.events: list[QuarantineEvent] = []
        self.in_script = False
        self.in_style = False
        self.in_title = False
        self.sensitive_depth = 0
        self.sensitive_buf: list[str] = []
        self.script_buf: list[str] = []
        self.style_buf: list[str] = []
        self.styles: list[tuple[str, str]] = []
        self.title_parts: list[str] = []
        self.doctype: str | None = None
        self.html_lang: str | None = None
        self.charset: str | None = None
        self.viewport: str | None = None
        self.base_href: str | None = None
        self.meta: list[MetaObservation] = []
        self.stylesheet_links: list[str] = []
        self.asset_refs: list[HtmlAssetRef] = []
        self.interactions: list[Interaction] = []
        self.form_fields: dict[str, list[str]] = {}
        self.font_hints: list[dict[str, str | None]] = []
        self.canvas_count = 0
        self.script_hints: list[str] = []
        self.camera_declared: list[str] = []
        self._open_forms: list[str] = []

    def handle_decl(self, decl: str) -> None:
        if decl.lower().startswith("doctype") and self.doctype is None:
            self.doctype = " ".join(decl.split())

    def handle_comment(self, data: str) -> None:
        if data.strip():
            self.events.append(
                QuarantineEvent(
                    kind="HTML_COMMENT",
                    node_hint=self.stack[-1].node_id,
                    digest=digest_text(data),
                    byte_length=len(data.encode("utf-8")),
                    detail="HTML_COMMENT_WITHHELD",
                )
            )

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._start(tag.lower(), attrs, void=tag.lower() in _VOID)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._start(tag.lower(), attrs, void=True)

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.lower()
        if self.skip_depth:
            self.skip_depth -= 1
            return
        if lowered in {"textarea", "option"} and self.sensitive_depth:
            self.sensitive_depth -= 1
            if self.sensitive_depth == 0:
                self._finish_sensitive()
        if lowered == "script" and self.in_script:
            self._finish_script()
            return
        if lowered == "style" and self.in_style:
            self._finish_style()
            return
        if lowered == "title":
            self.in_title = False
        if lowered == "form" and self._open_forms:
            self._open_forms.pop()
        if lowered in _VOID:
            return
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == lowered:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        if self.skip_depth:
            return
        if self.in_script:
            self.script_buf.append(data)
            return
        if self.in_style:
            self.style_buf.append(data)
            return
        if self.sensitive_depth:
            self.sensitive_buf.append(data)
            return
        if self.in_title:
            self.title_parts.append(data)
        if data.strip() and self.stack:
            self.stack[-1].text_parts.append(data)

    def _start(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
        *,
        void: bool,
    ) -> None:
        if self.in_script or self.in_style:
            return
        if self.skip_depth:
            self.skip_depth += 1
            return
        if self.node_count >= self.limits.max_nodes:
            if "LAYOUT_NODE_CAP" not in self.gaps:
                self.gaps.append("LAYOUT_NODE_CAP")
            self.truncated = True
            self.skip_depth = 1
            return
        if len(self.stack) >= self.limits.max_depth:
            if "LAYOUT_DEPTH_CAP" not in self.gaps:
                self.gaps.append("LAYOUT_DEPTH_CAP")
            self.truncated = True
            self.skip_depth = 1
            return

        parent = self.stack[-1]
        node_id = f"{parent.node_id}.{len(parent.children)}"
        node = _MutableNode(node_id=node_id, tag=tag)
        attr_map = {name.lower(): ("" if value is None else value) for name, value in attrs}
        self._consume_tag(node, tag, attr_map)
        parent.children.append(node)
        self.node_count += 1
        if not void:
            self.stack.append(node)
            if tag == "script":
                self.in_script = True
                self.script_buf = []
            elif tag == "style":
                self.in_style = True
                self.style_buf = []
            elif tag == "title":
                self.in_title = True
            elif tag in {"textarea", "option"}:
                self.sensitive_depth += 1
            elif tag == "form":
                self._open_forms.append(node_id)

    def _consume_tag(self, node: _MutableNode, tag: str, attrs: dict[str, str]) -> None:
        if tag == "html" and self.html_lang is None and attrs.get("lang"):
            self.html_lang = attrs["lang"].strip()[:32] or None
        if tag == "meta":
            self._meta(node.node_id, attrs)
        if tag == "base" and attrs.get("href") and self.base_href is None:
            resolved, _, _ = resolve_reference(self.page_url, attrs["href"])
            self.base_href = resolved
        if tag == "canvas":
            self.canvas_count += 1
        if tag == "link":
            self._link(node.node_id, attrs)
        if tag in {"img", "source", "video", "audio", "track"}:
            self._media_asset(node.node_id, tag, attrs)
        if tag == "script":
            self._script_src(node.node_id, attrs.get("src"))
        if "srcdoc" in attrs:
            payload = attrs["srcdoc"]
            self.events.append(
                QuarantineEvent(
                    kind="SRCDOC",
                    node_hint=node.node_id,
                    digest=digest_text(payload),
                    byte_length=len(payload.encode("utf-8")),
                    detail="SRCDOC_QUARANTINED",
                )
            )
        camera_kind = attrs.get("data-camera-kind", "").strip()
        if camera_kind:
            self.camera_declared.append(camera_kind[:64])

        style = attrs.get("style")
        if style:
            self._inline_style(node.node_id, style)

        kept: list[LayoutAttribute] = []
        for name, value in attrs.items():
            if name == "style" or name == "srcdoc" or name == "value":
                continue
            if name.startswith("on") and len(name) > 2:
                self.events.append(
                    QuarantineEvent(
                        kind="EVENT_HANDLER",
                        node_hint=node.node_id,
                        digest=digest_text(value),
                        byte_length=len(value.encode("utf-8")),
                        detail="EVENT_HANDLER_DROPPED",
                    )
                )
                continue
            if name in _URL_ATTRS and _active_url(value):
                self.events.append(
                    QuarantineEvent(
                        kind="JAVASCRIPT_URL",
                        node_hint=node.node_id,
                        digest=digest_text(value),
                        byte_length=len(value.encode("utf-8")),
                        detail="JAVASCRIPT_URL_NEUTRALIZED",
                    )
                )
                continue
            if name in _URL_ATTRS and _data_url(value):
                continue
            if name not in _ATTR_EXACT and not name.startswith("aria-") and not name.startswith("data-"):
                continue
            shown = value if len(value) <= self.limits.max_attr_chars else value[: self.limits.max_attr_chars]
            kept.append(LayoutAttribute(name=name, value=shown))
        node.attributes = kept
        self._interaction(node, tag, attrs)

    def _finish_sensitive(self) -> None:
        payload = "".join(self.sensitive_buf)
        self.sensitive_buf = []
        if not payload.strip():
            return
        self.events.append(
            QuarantineEvent(
                kind="FIELD_VALUE",
                node_hint=self.stack[-1].node_id if self.stack else None,
                digest=digest_text(payload),
                byte_length=len(payload.encode("utf-8")),
                detail="FIELD_VALUE_WITHHELD",
            )
        )

    def _meta(self, node_id: str, attrs: dict[str, str]) -> None:
        if len(self.meta) >= self.limits.max_meta:
            if "META_CAP" not in self.gaps:
                self.gaps.append("META_CAP")
            return
        if "charset" in attrs and self.charset is None:
            self.charset = attrs["charset"].strip()[:32] or None
            self.meta.append(MetaObservation("charset", "charset", self.charset))
        http_equiv = attrs.get("http-equiv", "")
        content = attrs.get("content")
        if http_equiv.lower() == "content-type" and content and self.charset is None:
            match = re.search(r"charset\s*=\s*([A-Za-z0-9._-]+)", content, re.IGNORECASE)
            if match:
                self.charset = match.group(1)[:32]
        if attrs.get("name", "").lower() == "viewport" and content and self.viewport is None:
            self.viewport = " ".join(content.split())[:200]
        if http_equiv.lower() == "refresh" and content:
            target = _refresh_target(content)
            if _active_url(target) or _data_url(target):
                self.events.append(
                    QuarantineEvent(
                        kind="META_REFRESH",
                        node_hint=node_id,
                        digest=digest_text(content),
                        byte_length=len(content.encode("utf-8")),
                        detail="META_REFRESH_NEUTRALIZED",
                    )
                )
                self.meta.append(MetaObservation("http-equiv", http_equiv[:80], None))
                return
        if "name" in attrs:
            self.meta.append(
                MetaObservation("name", attrs["name"][:80], None if content is None else content[:200])
            )
        elif "property" in attrs:
            self.meta.append(
                MetaObservation(
                    "property",
                    attrs["property"][:80],
                    None if content is None else content[:200],
                )
            )
        elif http_equiv:
            self.meta.append(
                MetaObservation(
                    "http-equiv",
                    http_equiv[:80],
                    None if content is None else content[:200],
                )
            )

    def _link(self, node_id: str, attrs: dict[str, str]) -> None:
        rel = attrs.get("rel", "").lower()
        href = attrs.get("href", "").strip()
        if not href or _active_url(href) or _data_url(href):
            if href and _data_url(href):
                self._quarantine_data(node_id, href, "OTHER")
            return
        integrity = attrs.get("integrity") or None
        if "stylesheet" in rel.split():
            self.stylesheet_links.append(href)
            self._add_asset(node_id, "STYLESHEET", href, integrity, "NOT_FETCHED", "NOT_APPLICABLE")
        elif "icon" in rel.split():
            self._add_asset(node_id, "ICON", href, integrity, "NOT_FETCHED", "NOT_APPLICABLE")
        elif rel == "preload":
            kind = {
                "font": "FONT",
                "style": "STYLESHEET",
                "image": "IMAGE",
                "script": "SCRIPT",
            }.get(attrs.get("as", "").lower(), "OTHER")
            execution = "FORBIDDEN" if kind == "SCRIPT" else "NOT_APPLICABLE"
            self._add_asset(node_id, kind, href, integrity, "NOT_FETCHED", execution)

    def _media_asset(self, node_id: str, tag: str, attrs: dict[str, str]) -> None:
        kind = {"img": "IMAGE", "video": "VIDEO", "audio": "AUDIO", "track": "OTHER", "source": "OTHER"}[
            tag
        ]
        if attrs.get("type", "").startswith("font/"):
            kind = "FONT"
        integrity = attrs.get("integrity") or None
        src = attrs.get("src", "").strip()
        if src and _data_url(src):
            self._quarantine_data(node_id, src, kind)
        elif src and not _active_url(src):
            self._add_asset(node_id, kind, src, integrity, "NOT_FETCHED", "NOT_APPLICABLE")
        poster = attrs.get("poster", "").strip()
        if poster and _data_url(poster):
            self._quarantine_data(node_id, poster, "IMAGE")
        elif poster and not _active_url(poster):
            self._add_asset(node_id, "IMAGE", poster, None, "NOT_FETCHED", "NOT_APPLICABLE")
        srcset = attrs.get("srcset", "")
        for ref in _srcset_urls(srcset):
            if ref.lower().startswith("data:"):
                self._quarantine_data(node_id, ref, kind)
            elif not _active_url(ref):
                self._add_asset(node_id, kind, ref, None, "NOT_FETCHED", "NOT_APPLICABLE")

    def _script_src(self, node_id: str, src: str | None) -> None:
        if not src:
            return
        if _active_url(src) or src.strip().lower().startswith("data:"):
            self.events.append(
                QuarantineEvent(
                    kind="SCRIPT_SRC",
                    node_hint=node_id,
                    digest=digest_text(src),
                    byte_length=len(src.encode("utf-8")),
                    detail="SCRIPT_SRC_NEUTRALIZED",
                )
            )
            return
        self._add_asset(node_id, "SCRIPT", src.strip(), None, "NOT_FETCHED", "FORBIDDEN")
        lowered = src.lower()
        if "three" in lowered and "three.js-filename" not in self.script_hints:
            self.script_hints.append("three.js-filename")

    def _add_asset(
        self,
        node_id: str,
        kind: str,
        declared_ref: str,
        integrity: str | None,
        fetch_status: str,
        execution: str,
    ) -> None:
        if len(self.asset_refs) >= self.limits.max_assets:
            if "ASSET_CAP" not in self.gaps:
                self.gaps.append("ASSET_CAP")
            self.truncated = True
            return
        self.asset_refs.append(
            HtmlAssetRef(
                kind=kind,
                declared_ref=declared_ref[:500],
                integrity=integrity[:200] if integrity else None,
                node_id=node_id,
                fetch_status=fetch_status,
                execution=execution,
                digest=None,
            )
        )

    def _quarantine_data(self, node_id: str, payload: str, kind: str) -> None:
        self.events.append(
            QuarantineEvent(
                kind="DATA_URL",
                node_hint=node_id,
                digest=digest_text(payload),
                byte_length=len(payload.encode("utf-8")),
                detail="DATA_URL_WITHHELD",
            )
        )
        if len(self.asset_refs) < self.limits.max_assets:
            self.asset_refs.append(
                HtmlAssetRef(
                    kind=kind,
                    declared_ref="data:",
                    integrity=None,
                    node_id=node_id,
                    fetch_status="QUARANTINED",
                    execution="NOT_APPLICABLE",
                    digest=digest_text(payload),
                )
            )

    def _inline_style(self, node_id: str, style: str) -> None:
        sanitized, events = sanitize_css(style, source=node_id)
        self.events.extend(events)
        hint: dict[str, str | None] = {
            "font_family": None,
            "font_size": None,
            "font_weight": None,
            "line_height": None,
            "letter_spacing": None,
            "font_shorthand": None,
            "source": f"inline-style:{node_id}",
        }
        for name, value in re.findall(r"([a-zA-Z-]+)\s*:\s*([^;]+)", sanitized):
            key = name.lower()
            if key == "font":
                hint["font_shorthand"] = " ".join(value.split())[:200]
            elif key in {item for item in _FONT_PROPS if item != "font"}:
                hint[key.replace("-", "_")] = " ".join(value.split())[:200]
        if any(hint[key] for key in hint if key != "source"):
            self.font_hints.append(hint)

    def _interaction(self, node: _MutableNode, tag: str, attrs: dict[str, str]) -> None:
        if len(self.interactions) >= self.limits.max_interactions:
            if "INTERACTION_CAP" not in self.gaps:
                self.gaps.append("INTERACTION_CAP")
            self.truncated = True
            return
        if tag == "a":
            raw = attrs.get("href", "")
            neutralized = _active_url(raw)
            target = None
            if raw and not neutralized:
                target, _, _ = resolve_reference(self.page_url, raw)
            if raw:
                self.interactions.append(
                    Interaction(
                        kind="LINK",
                        node_id=node.node_id,
                        target=target,
                        method=None,
                        fields=(),
                        states_observed=(),
                        neutralized=neutralized,
                    )
                )
        elif tag == "button":
            self.interactions.append(
                Interaction(
                    kind="BUTTON",
                    node_id=node.node_id,
                    target=None,
                    method=None,
                    fields=(),
                    states_observed=(),
                    neutralized=False,
                )
            )
        elif tag == "form":
            raw_action = attrs.get("action", "")
            neutralized = _active_url(raw_action)
            target = None
            if raw_action and not neutralized:
                target, _, _ = resolve_reference(self.page_url, raw_action)
            raw_method = attrs.get("method", "").strip().lower()
            method = raw_method[:16] or None
            self.interactions.append(
                Interaction(
                    kind="FORM",
                    node_id=node.node_id,
                    target=target,
                    method=method,
                    fields=(),
                    states_observed=(),
                    neutralized=neutralized,
                )
            )
        elif tag in {"input", "textarea", "select"}:
            field_type = attrs.get("type", "text" if tag == "input" else tag).lower()[:32]
            field_name = attrs.get("name", "").strip()[:80]
            descriptor = f"{field_type}:{field_name}" if field_name else field_type
            if self._open_forms:
                self.form_fields.setdefault(self._open_forms[-1], []).append(descriptor)
            self.interactions.append(
                Interaction(
                    kind="FIELD",
                    node_id=node.node_id,
                    target=None,
                    method=None,
                    fields=(descriptor,),
                    states_observed=(),
                    neutralized=False,
                )
            )
        elif tag == "details":
            self.interactions.append(
                Interaction(
                    kind="DISCLOSURE",
                    node_id=node.node_id,
                    target=None,
                    method=None,
                    fields=(),
                    states_observed=("open",) if "open" in attrs else (),
                    neutralized=False,
                )
            )
        elif tag == "dialog":
            self.interactions.append(
                Interaction(
                    kind="DIALOG",
                    node_id=node.node_id,
                    target=None,
                    method=None,
                    fields=(),
                    states_observed=("open",) if "open" in attrs else (),
                    neutralized=False,
                )
            )

    def _finish_script(self) -> None:
        payload = "".join(self.script_buf)
        self.script_buf = []
        self.in_script = False
        if self.stack and self.stack[-1].tag == "script":
            node_id = self.stack[-1].node_id
            self.stack.pop()
        else:
            node_id = None
        if payload.strip():
            self.events.append(
                QuarantineEvent(
                    kind="SCRIPT_INLINE",
                    node_hint=node_id,
                    digest=digest_text(payload),
                    byte_length=len(payload.encode("utf-8")),
                    detail="SCRIPT_BODY_WITHHELD",
                )
            )
            if len(self.asset_refs) < self.limits.max_assets:
                self.asset_refs.append(
                    HtmlAssetRef(
                        kind="SCRIPT",
                        declared_ref="inline",
                        integrity=None,
                        node_id=node_id,
                        fetch_status="QUARANTINED",
                        execution="FORBIDDEN",
                        digest=digest_text(payload),
                    )
                )

    def _finish_style(self) -> None:
        payload = "".join(self.style_buf)
        self.style_buf = []
        self.in_style = False
        if self.stack and self.stack[-1].tag == "style":
            node_id = self.stack[-1].node_id
            self.stack.pop()
        else:
            node_id = "style"
        sanitized, events = sanitize_css(payload, source=node_id)
        self.events.extend(events)
        self.styles.append((f"inline-style-block:{node_id}", sanitized))

    def finish(self) -> HtmlParse:
        if self.in_script:
            self._finish_script()
        if self.in_style:
            self._finish_style()
        if self.sensitive_buf:
            self._finish_sensitive()
        interactions: list[Interaction] = []
        for item in self.interactions:
            if item.kind == "FORM" and item.node_id in self.form_fields:
                interactions.append(
                    Interaction(
                        kind=item.kind,
                        node_id=item.node_id,
                        target=item.target,
                        method=item.method,
                        fields=tuple(self.form_fields[item.node_id]),
                        states_observed=item.states_observed,
                        neutralized=item.neutralized,
                    )
                )
            else:
                interactions.append(item)
        title = _collapse(" ".join(self.title_parts), 200)
        return HtmlParse(
            metadata_seed={
                "doctype": self.doctype,
                "html_lang": self.html_lang,
                "charset": self.charset,
                "title": title,
                "viewport": self.viewport,
                "base_href": self.base_href,
                "meta": tuple(self.meta),
                "stylesheet_links": tuple(self.stylesheet_links),
                "inline_style_block_count": len(self.styles),
            },
            layout=_freeze(self.root, self.limits.max_text_chars),
            style_sheets=tuple(self.styles),
            asset_refs=tuple(self.asset_refs),
            interactions=tuple(interactions),
            inline_font_hints=tuple(self.font_hints),
            canvas_count=self.canvas_count,
            script_hints=tuple(self.script_hints),
            camera_declared=tuple(self.camera_declared),
            events=tuple(self.events),
            gaps=tuple(self.gaps),
            truncated=self.truncated,
        )


def parse_html(html: str, *, page_url: str, limits: ObservationLimits) -> HtmlParse:
    parser = _CaptureParser(page_url=page_url, limits=limits)
    parser.feed(html)
    parser.close()
    return parser.finish()
