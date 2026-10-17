"""Conservative CSS observation scanner.

This is not a browser CSS engine. It reads declarations, media queries,
keyframes, font faces, and url() references from sanitized text.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from spe_runtime.webrecon.breakpoints import Breakpoint
from spe_runtime.webrecon.isolation import TypographyHint
from spe_runtime.webrecon.motion import (
    AnimationObservation,
    ScrollObservation,
    TransitionObservation,
)

_TIME_RE = re.compile(r"^[\d.]+m?s$")
_URL_RE = re.compile(r"""url\(\s*(['"]?)([^)'"]+)\1\s*\)""", re.IGNORECASE)
_ANIMATION_KEYWORDS = frozenset(
    {
        "normal",
        "reverse",
        "alternate",
        "alternate-reverse",
        "infinite",
        "paused",
        "running",
        "ease",
        "ease-in",
        "ease-out",
        "ease-in-out",
        "linear",
        "forwards",
        "backwards",
        "both",
        "none",
        "initial",
        "inherit",
        "unset",
    }
)
_SCROLL_PROPS = frozenset(
    {
        "scroll-behavior",
        "overflow",
        "overflow-x",
        "overflow-y",
        "scroll-snap-type",
        "scroll-snap-align",
    }
)


@dataclass(frozen=True)
class CssUrlRef:
    declared_ref: str
    source: str


@dataclass(frozen=True)
class CssScan:
    custom_properties: tuple[tuple[str, str | None, str], ...]
    breakpoints: tuple[Breakpoint, ...]
    typography: tuple[TypographyHint, ...]
    scroll: tuple[ScrollObservation, ...]
    animations: tuple[AnimationObservation, ...]
    transitions: tuple[TransitionObservation, ...]
    urls: tuple[CssUrlRef, ...]
    pseudo_selectors: tuple[tuple[str, tuple[str, ...]], ...]
    truncated: bool


def _strip_comments(css: str) -> str:
    out: list[str] = []
    i = 0
    n = len(css)
    while i < n:
        char = css[i]
        if char in {'"', "'"}:
            quote = char
            j = i + 1
            out.append(char)
            while j < n:
                if css[j] == "\\":
                    out.append(css[j : j + 2])
                    j += 2
                    continue
                out.append(css[j])
                if css[j] == quote:
                    j += 1
                    break
                j += 1
            i = j
            continue
        if css.startswith("/*", i):
            end = css.find("*/", i + 2)
            if end < 0:
                break
            i = end + 2
            continue
        out.append(char)
        i += 1
    return "".join(out)


def _matching_brace(css: str, open_at: int) -> int:
    depth = 0
    i = open_at
    n = len(css)
    quote = ""
    while i < n:
        char = css[i]
        if quote:
            if char == "\\":
                i += 2
                continue
            if char == quote:
                quote = ""
            i += 1
            continue
        if char in {'"', "'"}:
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def _split_declarations(body: str) -> list[tuple[str, str]]:
    parts: list[str] = []
    buf: list[str] = []
    depth = 0
    quote = ""
    i = 0
    while i < len(body):
        char = body[i]
        if quote:
            buf.append(char)
            if char == "\\":
                if i + 1 < len(body):
                    buf.append(body[i + 1])
                    i += 2
                    continue
            if char == quote:
                quote = ""
            i += 1
            continue
        if char in {'"', "'"}:
            quote = char
            buf.append(char)
        elif char == "(":
            depth += 1
            buf.append(char)
        elif char == ")":
            depth = max(0, depth - 1)
            buf.append(char)
        elif char == ";" and depth == 0:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(char)
        i += 1
    if buf:
        parts.append("".join(buf))
    declarations: list[tuple[str, str]] = []
    for part in parts:
        if ":" not in part:
            continue
        name, value = part.split(":", 1)
        name = name.strip().lower()
        value = " ".join(value.strip().split())
        if name and value:
            declarations.append((name, value))
    return declarations


def _split_top_level(text: str, separator: str) -> list[str]:
    parts: list[str] = []
    buf: list[str] = []
    depth = 0
    quote = ""
    for char in text:
        if quote:
            buf.append(char)
            if char == quote:
                quote = ""
            continue
        if char in {'"', "'"}:
            quote = char
            buf.append(char)
            continue
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        if char == separator and depth == 0:
            parts.append("".join(buf).strip())
            buf = []
            continue
        buf.append(char)
    tail = "".join(buf).strip()
    if tail:
        parts.append(tail)
    return parts


def _media_features(prelude: str) -> Breakpoint:
    query = " ".join(prelude.split())
    body = re.sub(r"^@media\s+", "", query, count=1, flags=re.IGNORECASE)
    features: list[str] = []
    min_width: int | None = None
    max_width: int | None = None
    for match in re.finditer(r"\(([^)]*)\)", body):
        feature = " ".join(match.group(1).split())
        if not feature:
            continue
        features.append(feature)
        min_match = re.match(r"min-width\s*:\s*(\d+(?:\.\d+)?)px$", feature, re.IGNORECASE)
        max_match = re.match(r"max-width\s*:\s*(\d+(?:\.\d+)?)px$", feature, re.IGNORECASE)
        if min_match:
            min_width = int(float(min_match.group(1)))
        if max_match:
            max_width = int(float(max_match.group(1)))
    return Breakpoint(
        query=body,
        min_width_px=min_width,
        max_width_px=max_width,
        features=tuple(features),
        source=query,
    )


def _pseudo_states(prelude: str) -> tuple[str, ...]:
    states: list[str] = []
    for state in ("hover", "focus-visible", "focus-within", "focus", "active"):
        if f":{state}" in prelude.lower() and state not in states:
            states.append(state)
    return tuple(states)


def _duration(token: str) -> str | None:
    return token if _TIME_RE.match(token) else None


def _animation_parts(value: str) -> tuple[str, str | None]:
    name: str | None = None
    duration: str | None = None
    for token in value.replace(",", " ").split():
        lower = token.lower()
        if lower in _ANIMATION_KEYWORDS or lower.startswith("cubic-bezier"):
            continue
        if _duration(lower):
            if duration is None:
                duration = lower
            continue
        if re.match(r"^[\d.]+$", lower):
            continue
        if name is None:
            name = token
    return (name or value, duration)


def _transition_parts(value: str) -> tuple[str | None, str | None]:
    prop: str | None = None
    duration: str | None = None
    timing = _ANIMATION_KEYWORDS | {"all"}
    for token in value.split():
        lower = token.lower().strip(",")
        if _duration(lower):
            if duration is None:
                duration = lower
            continue
        if lower in timing or lower.startswith("cubic-bezier") or re.match(r"^[\d.]+$", lower):
            continue
        if prop is None:
            prop = lower
    return prop, duration


def _font_hint(declarations: list[tuple[str, str]], source: str) -> TypographyHint | None:
    fields = {
        "font_family": None,
        "font_size": None,
        "font_weight": None,
        "line_height": None,
        "letter_spacing": None,
        "font_shorthand": None,
    }
    found = False
    for name, value in declarations:
        if name in fields:
            fields[name] = value
            found = True
    if not found:
        return None
    return TypographyHint(source=source, **fields)


def _hostile_css_ref(ref: str) -> bool:
    token = re.sub(r"\s+", "", ref.strip().strip("\"'").strip().lower())
    return (
        token.startswith("javascript:")
        or token.startswith("vbscript:")
        or token.startswith("data:")
    )


def _collect_urls(text: str, source: str, sink: list[CssUrlRef]) -> None:
    for match in _URL_RE.finditer(text):
        ref = match.group(2).strip()
        if not ref or _hostile_css_ref(ref):
            continue
        sink.append(CssUrlRef(declared_ref=ref, source=source))


class _Builder:
    def __init__(self) -> None:
        self.custom: list[tuple[str, str | None, str]] = []
        self.breakpoints: list[Breakpoint] = []
        self.typography: list[TypographyHint] = []
        self.scroll: list[ScrollObservation] = []
        self.animations: list[AnimationObservation] = []
        self.transitions: list[TransitionObservation] = []
        self.urls: list[CssUrlRef] = []
        self.pseudos: list[tuple[str, tuple[str, ...]]] = []
        self.seen_queries: set[str] = set()


def _walk(css: str, source: str, builder: _Builder) -> None:
    i = 0
    n = len(css)
    while i < n:
        while i < n and css[i].isspace():
            i += 1
        if i >= n:
            return
        if css[i] == "}":
            i += 1
            continue
        start = i
        quote = ""
        while i < n:
            char = css[i]
            if quote:
                if char == "\\":
                    i += 2
                    continue
                if char == quote:
                    quote = ""
                i += 1
                continue
            if char in {'"', "'"}:
                quote = char
                i += 1
                continue
            if char in "{;":
                break
            i += 1
        if i >= n:
            return
        prelude = " ".join(css[start:i].split())
        if css[i] == ";":
            if prelude.lower().startswith("@import"):
                _collect_urls(prelude, source, builder.urls)
                quoted = re.findall(r"""['"]([^'"]+)['"]""", prelude)
                for ref in quoted:
                    if _hostile_css_ref(ref):
                        continue
                    builder.urls.append(CssUrlRef(declared_ref=ref, source=source))
            i += 1
            continue
        end = _matching_brace(css, i)
        if end < 0:
            return
        body = css[i + 1 : end]
        lower = prelude.lower()
        if lower.startswith("@media"):
            breakpoint = _media_features(prelude)
            if breakpoint.query not in builder.seen_queries:
                builder.seen_queries.add(breakpoint.query)
                builder.breakpoints.append(breakpoint)
            _walk(body, f"{source} >> {breakpoint.query}", builder)
        elif lower.startswith("@keyframes") or lower.startswith("@-webkit-keyframes"):
            name_match = re.search(r"keyframes\s+([A-Za-z_][\w-]*)", prelude, re.IGNORECASE)
            if name_match:
                builder.animations.append(
                    AnimationObservation(
                        name=name_match.group(1),
                        duration=None,
                        source=source,
                    )
                )
        elif lower.startswith("@font-face"):
            _collect_urls(body, f"{source} @font-face", builder.urls)
        else:
            declarations = _split_declarations(body)
            rule_source = f"{source} {prelude}".strip()
            hint = _font_hint(declarations, rule_source)
            if hint is not None:
                builder.typography.append(hint)
            states = _pseudo_states(prelude)
            if states:
                builder.pseudos.append((prelude, states))
            for name, value in declarations:
                if name.startswith("--"):
                    stored = None if "url(" in value.lower() else value[:80]
                    builder.custom.append((name, stored, rule_source))
                if name in _SCROLL_PROPS or (name == "position" and value.lower() == "sticky"):
                    builder.scroll.append(
                        ScrollObservation(property=name, value=value, source=rule_source)
                    )
                if name in {"animation", "animation-name", "animation-duration"}:
                    anim_name, duration = _animation_parts(value)
                    if name == "animation-duration":
                        anim_name = value
                        duration = _duration(value.split()[0].lower()) if value.split() else None
                        anim_name = ""
                    if anim_name:
                        builder.animations.append(
                            AnimationObservation(
                                name=anim_name,
                                duration=duration,
                                source=rule_source,
                            )
                        )
                if name in {"transition", "transition-property", "transition-duration"}:
                    for chunk in _split_top_level(value, ","):
                        prop, duration = _transition_parts(chunk)
                        if name == "transition-duration":
                            prop = None
                            duration = _duration(chunk.split()[0].lower()) if chunk.split() else None
                        builder.transitions.append(
                            TransitionObservation(
                                property_name=prop,
                                duration=duration,
                                source=rule_source,
                            )
                        )
            _collect_urls(body, rule_source, builder.urls)
        i = end + 1


def scan_stylesheets(sheets: tuple[tuple[str, str], ...]) -> CssScan:
    """Scan `(source_label, css_text)` pairs. Text must already be sanitized."""

    builder = _Builder()
    truncated = False
    for label, css in sheets:
        cleaned = _strip_comments(css)
        _walk(cleaned, label, builder)
    return CssScan(
        custom_properties=tuple(builder.custom),
        breakpoints=tuple(builder.breakpoints),
        typography=tuple(builder.typography),
        scroll=tuple(builder.scroll),
        animations=tuple(builder.animations),
        transitions=tuple(builder.transitions),
        urls=tuple(builder.urls),
        pseudo_selectors=tuple(builder.pseudos),
        truncated=truncated,
    )
