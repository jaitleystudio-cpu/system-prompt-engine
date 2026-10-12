"""The 8 catalog techniques as local, gated transforms / decisions. Each declares the classes it touches."""

from __future__ import annotations

import hashlib
import json
import re
import time
from dataclasses import dataclass
from typing import Optional

from .conservation import (
    InfoClass,
    MalformedJSON,
    Refusal,
    Span,
    Technique,
    classify,
    lex_json,
)

R = InfoClass.REPLACEABLE


# 1. JSON minify ----------------------------------------------------------------------------------------
def minify_json_text(src: str) -> str:
    """Drop inter-token whitespace only. Strings/numbers/literals copied byte-for-byte (custom lexer)."""
    return "".join(raw for kind, raw in lex_json(src) if kind != "ws")


_JSON_FENCE = re.compile(r"(^```json[ \t]*\n)(.*?)(^```[ \t]*$)", re.M | re.S)


def _apply_json_minify(text: str, **_) -> str:
    found = False

    def sub(m):
        nonlocal found
        found = True
        body = m.group(2)
        trail = "\n" if body.endswith("\n") else ""
        return m.group(1) + minify_json_text(body) + trail + m.group(3)

    out = _JSON_FENCE.sub(sub, text)
    if not found:
        raise Refusal("no ```json block")
    return out


# 2. Whitespace normalisation ---------------------------------------------------------------------------
_INDENT_SENSITIVE = re.compile(r"^(?: {2,}|\t)\S", re.M)


def normalize_block(block: str) -> str:
    """Normalise one prose block; refuses code / indentation-sensitive input."""
    if "```" in block or _INDENT_SENSITIVE.search(block):
        raise Refusal("indentation-sensitive or code block")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in block.split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines))


def _apply_ws_norm(text: str, spans: list[Span], **_) -> str:
    out, prev_blank = [], False
    for s in spans:
        if s.cls is R and not s.text.startswith(("  ", "\t")):
            nl = "\n" if s.text.endswith("\n") else ""
            body = re.sub(r"[ \t]+", " ", s.text.rstrip("\n")).strip()
            if not body and nl:
                if prev_blank:
                    continue
                prev_blank = True
            else:
                prev_blank = False
            out.append(body + nl)
        else:
            prev_blank = False
            out.append(s.text)
    return "".join(out)


# 3. Context trim ---------------------------------------------------------------------------------------
def _apply_context_trim(text: str, spans: list[Span], max_chars: int = 4000, **_) -> str:
    total = len(text)
    keep = [True] * len(spans)
    for i, s in enumerate(spans):  # oldest first
        if total <= max_chars:
            break
        if s.cls is R and s.text.strip():
            keep[i] = False
            total -= len(s.text)
    if total > max_chars:
        raise Refusal(f"cannot reach {max_chars} chars without touching conserved spans ({total})")
    return "".join(s.text for s, k in zip(spans, keep) if k)


# 4. Duplicate collapse ---------------------------------------------------------------------------------
def _apply_dup_collapse(text: str, spans: list[Span], **_) -> str:
    seen, out = set(), []
    for s in spans:
        key = s.text.strip()
        if s.cls is R and key and key in seen:
            continue
        if s.cls is R and key:
            seen.add(key)
        out.append(s.text)
    return "".join(out)


# 7. Concise instruction --------------------------------------------------------------------------------
CONCISE = "\n\nRespond concisely."


def _apply_concise(text: str, output_contract_min_words: int = 0, **_) -> str:
    if output_contract_min_words > 0:
        raise Refusal(f"output contract requires >= {output_contract_min_words} words; concision conflicts")
    return text + CONCISE


# 6. Output budget (decision) ---------------------------------------------------------------------------
TOKENS_PER_WORD = 1.35  # conservative English estimate


def decide_output_budget(cap_tokens: int, contract_words: int = 0, contract_tokens: int = 0) -> int:
    """Return max_tokens to send. Refuses if the declared output contract exceeds the cap (100k-word jobs)."""
    need = max(contract_tokens, int(contract_words * TOKENS_PER_WORD + 0.999))
    if need > cap_tokens:
        raise Refusal(f"declared output contract needs ~{need} tokens > cap {cap_tokens}; cap not applied")
    return cap_tokens


# 8. Simple-query routing (decision) --------------------------------------------------------------------
def route(text: str, intent=None, max_simple_chars: int = 400) -> str:
    spans = classify(text, intent)
    risky = {s.cls for s in spans} & {InfoClass.PROTECTED, InfoClass.EXACT_BYTE, InfoClass.EVIDENCE, InfoClass.VOLATILE}
    if risky or len(text) > max_simple_chars:
        return "strong"
    return "small"


# 5. Exact cache with validity key ----------------------------------------------------------------------
@dataclass(frozen=True)
class CacheScope:
    user_scope: str
    auth_scope: tuple[str, ...]
    model: str
    model_version: str
    freshness: str  # data/epoch version of any source the answer depended on


def cache_key(prompt: str, scope: CacheScope) -> str:
    payload = {
        "p": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
        "u": scope.user_scope,
        "a": sorted(scope.auth_scope),
        "m": scope.model,
        "v": scope.model_version,
        "f": scope.freshness,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


class ExactCache:
    """Per-user-scope partitioned exact cache. Never serves across scopes; volatile prompts not cached."""

    def __init__(self, ttl_s: float = 3600.0, clock=time.monotonic):
        self._parts: dict[str, dict[str, tuple[float, str]]] = {}
        self.ttl_s, self.clock = ttl_s, clock

    def put(self, prompt: str, scope: CacheScope, value: str) -> None:
        if any(s.cls is InfoClass.VOLATILE for s in classify(prompt)):
            raise Refusal("prompt contains volatile spans; not cacheable")
        self._parts.setdefault(scope.user_scope, {})[cache_key(prompt, scope)] = (self.clock() + self.ttl_s, value)

    def get(self, prompt: str, scope: CacheScope) -> Optional[str]:
        part = self._parts.get(scope.user_scope, {})
        hit = part.get(cache_key(prompt, scope))
        if hit is None:
            return None
        exp, val = hit
        if self.clock() >= exp:
            del part[cache_key(prompt, scope)]
            return None
        return val

    def partitions(self) -> list[str]:
        return sorted(self._parts)


TECHNIQUES: dict[str, Technique] = {
    t.name: t
    for t in [
        Technique("json_minify", frozenset({R}), "text", _apply_json_minify, "remove inter-token JSON whitespace"),
        Technique("whitespace_norm", frozenset({R}), "text", _apply_ws_norm, "collapse prose whitespace"),
        Technique("context_trim", frozenset({R}), "text", _apply_context_trim, "drop oldest replaceable lines"),
        Technique("duplicate_collapse", frozenset({R}), "text", _apply_dup_collapse, "drop repeated replaceable lines"),
        Technique("exact_cache", frozenset(), "cache", None, "validity-keyed, scope-partitioned exact cache"),
        Technique("output_budget", frozenset(), "decision", None, "max_tokens cap; refuses below output contract"),
        Technique("concise_instruction", frozenset(), "text", _apply_concise, "append concision instruction"),
        Technique("simple_query_routing", frozenset(), "decision", None, "route only all-replaceable short queries"),
    ]
}
