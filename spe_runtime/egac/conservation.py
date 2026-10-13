"""Five-class semantic conservation classifier + transformation gate (EGAC Mechanism A)."""

from __future__ import annotations

import difflib
import json
import os
import re
import unicodedata
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Iterable, Optional

from spe_runtime.prompt.meta_compiler import ProtectedIntent


class InfoClass(str, Enum):
    PROTECTED = "protected_requirement"
    EXACT_BYTE = "exact_byte"
    EVIDENCE = "evidence_bearing"
    REPLACEABLE = "replaceable"
    VOLATILE = "volatile"
    UNVERIFIED = "unverified_prose"  # default-deny: prose not positively allowlisted; conserved, never deletable


IMMUTABLE = frozenset({InfoClass.PROTECTED, InfoClass.EXACT_BYTE})
CONSERVED = frozenset({InfoClass.PROTECTED, InfoClass.EXACT_BYTE, InfoClass.EVIDENCE, InfoClass.UNVERIFIED})


@dataclass(frozen=True)
class Span:
    start: int
    end: int
    cls: InfoClass
    text: str


class Refusal(Exception):
    """A technique refuses to apply (never a silent no-op)."""


class MalformedJSON(Refusal):
    pass


# ---------------------------------------------------------------- JSON lexer (byte-exact, no json.loads)
_NUM = re.compile(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?")
_WS = " \t\n\r"


def lex_json(src: str) -> list[tuple[str, str]]:
    """Tokenise JSON into (kind, raw_text). kinds: ws, str, num, lit, punct. Raises MalformedJSON."""
    out: list[tuple[str, str]] = []
    i, n = 0, len(src)
    depth: list[str] = []
    while i < n:
        c = src[i]
        if c in _WS:
            j = i
            while j < n and src[j] in _WS:
                j += 1
            out.append(("ws", src[i:j]))
            i = j
        elif c == '"':
            j = i + 1
            while True:
                if j >= n:
                    raise MalformedJSON(f"unterminated string at {i}")
                ch = src[j]
                if ch == "\\":
                    if j + 1 >= n:
                        raise MalformedJSON(f"dangling escape at {j}")
                    nxt = src[j + 1]
                    if nxt == "u":
                        if not re.fullmatch(r"[0-9a-fA-F]{4}", src[j + 2 : j + 6]):
                            raise MalformedJSON(f"bad \\u escape at {j}")
                        j += 6
                    elif nxt in '"\\/bfnrt':
                        j += 2
                    else:
                        raise MalformedJSON(f"bad escape at {j}")
                elif ch == '"':
                    j += 1
                    break
                elif ord(ch) < 0x20:
                    raise MalformedJSON(f"raw control char in string at {j}")
                else:
                    j += 1
            out.append(("str", src[i:j]))
            i = j
        elif c in "{[":
            depth.append("}" if c == "{" else "]")
            out.append(("punct", c))
            i += 1
        elif c in "}]":
            if not depth or depth.pop() != c:
                raise MalformedJSON(f"unbalanced {c} at {i}")
            out.append(("punct", c))
            i += 1
        elif c in ",:":
            out.append(("punct", c))
            i += 1
        elif c == "-" or c.isdigit():
            m = _NUM.match(src, i)
            if not m or m.end() == i:
                raise MalformedJSON(f"bad number at {i}")
            out.append(("num", m.group(0)))
            i = m.end()
        else:
            for lit in ("true", "false", "null"):
                if src.startswith(lit, i):
                    out.append(("lit", lit))
                    i += len(lit)
                    break
            else:
                raise MalformedJSON(f"unexpected {c!r} at {i}")
    if depth:
        raise MalformedJSON("unclosed container")
    if not any(k != "ws" for k, _ in out):
        raise MalformedJSON("empty document")
    return out


# ---------------------------------------------------------------- classifier
_FENCE = re.compile(r"^```([A-Za-z0-9_+-]*)[ \t]*\n(.*?)^```[ \t]*$\n?", re.M | re.S)
# ---------------------------------------------------------------- normalisation (before any classification)
# Unicode UTS #39 confusables -> ASCII (vendored, Unicode 18.0.0) + small caps; NFKC; format/combining chars stripped.
_CONF = json.load(open(os.path.join(os.path.dirname(__file__), "confusables_ascii.json"), encoding="utf-8"))["map"]


def skeleton(s: str) -> str:
    """Lower-case confusable skeleton used for ALL classification regexes (homoglyph/ZW/fullwidth-proof)."""
    t = unicodedata.normalize("NFD", unicodedata.normalize("NFKC", s))
    out = []
    for ch in t:
        if unicodedata.category(ch) in ("Cf", "Mn") or ch == "\u00ad":
            continue
        if ord(ch) < 128:
            out.append(ch.lower())  # ASCII is canonical; only non-ASCII lookalikes are folded (no "m" -> "rn")
        else:
            out.append(_CONF.get(ch) or _CONF.get(ch.lower()) or ch.lower())
    return unicodedata.normalize("NFKC", "".join(out)).lower()


# Kept for labelling/routing only. NOT a safety mechanism any more: the gate is default-deny (see run_gated).
_PROTECTED_RE = re.compile(
    r"(?:\b(?:must(?:\s+not)?|mustn['\u2019]t|never|shall(?:\s+not)?|required|requires?|do\s+not|don['\u2019]t|"
    r"always|forbidden|prohibited|not\s+allowed|under\s+no\s+circumstances|exceptions?\s+to)\b|\bconstraint\s*:)",
    re.I,
)
# POSITIVE allowlists. A prose line is deletable only if its whole skeleton matches one of these.
_FILLER = {skeleton(x) for x in (
    "thanks for reading", "thank you", "thanks", "many thanks", "hope this helps", "i hope this helps", "best regards",
    "kind regards", "regards", "cheers", "sincerely", "hello", "hi", "hey", "hi there", "hello there", "good morning",
    "good afternoon", "good evening", "let me know if you have any questions", "feel free to ask questions")}
_DECORATION_RE = re.compile(r"^[\s\-=*_~#.\u2500-\u257f]{3,}$")
_STAMP_RE = re.compile(
    r"^(?:(?:last\s+updated|updated|generated(?:\s+at|\s+on)?|timestamp|date|as\s+of|retrieved(?:\s+on)?)\s*[:\-]?\s*)?"
    r"(?:\d{4}-\d{2}-\d{2}(?:[ t]\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:z|utc|ist|[+-]\d{2}:?\d{2}))?)?"
    r"|\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm|utc|ist)?)\s*\.?$")


def _allowlisted_filler(body: str) -> bool:
    k = skeleton(body).strip()
    return k == "" or _DECORATION_RE.match(k) is not None or re.sub(r"[\s.!,;:]+$", "", k) in _FILLER


def is_volatile_text(body: str) -> bool:
    return _VOLATILE_RE.search(skeleton(body)) is not None


def deletable(span: "Span") -> bool:
    """Default-deny: only positively allowlisted spans may be removed by a transform."""
    if span.cls is InfoClass.REPLACEABLE:
        return True                                   # allowlisted filler / blank / JSON inter-token whitespace
    if span.cls is InfoClass.VOLATILE:
        return _STAMP_RE.match(skeleton(span.text).strip()) is not None   # pure date/time stamp lines only
    return False


_EVIDENCE_RE = re.compile(r"(https?://|\bdoi:|\b10\.\d{4,9}/|\[\d+\]|^\s*(?:Source|Evidence|Citation)s?:)", re.I)
_VOLATILE_RE = re.compile(
    r"\b(?:today|tonight|right now|currently|latest|as of|this (?:week|month|year)|\d{4}-\d{2}-\d{2}"
    r"|\d{1,2}:\d{2}\s*(?:am|pm|UTC|IST)?)\b",
    re.I,
)


def _line_class(line: str, intent: Optional[ProtectedIntent]) -> InfoClass:
    body = line.rstrip("\n")
    if not body.strip():
        return InfoClass.REPLACEABLE
    if intent is not None:
        for req in tuple(intent.invariants) + tuple(intent.forbidden_actions):
            if req and (req in body or skeleton(req) in skeleton(body)):
                return InfoClass.PROTECTED
    sk = skeleton(body)
    if _PROTECTED_RE.search(sk):
        return InfoClass.PROTECTED
    if body.startswith(("    ", "\t")):
        return InfoClass.EXACT_BYTE  # indentation-sensitive outside a fence
    if _EVIDENCE_RE.search(sk):
        return InfoClass.EVIDENCE
    if _VOLATILE_RE.search(sk):
        return InfoClass.VOLATILE
    if _allowlisted_filler(body):
        return InfoClass.REPLACEABLE
    return InfoClass.UNVERIFIED  # default-deny


def _classify_prose(text: str, base: int, intent) -> list[Span]:
    spans, pos = [], 0
    for line in text.splitlines(keepends=True):
        spans.append(Span(base + pos, base + pos + len(line), _line_class(line, intent), line))
        pos += len(line)
    return spans


def _classify_json_body(body: str, base: int) -> list[Span]:
    spans, pos = [], 0
    for kind, raw in lex_json(body):
        cls = InfoClass.REPLACEABLE if kind == "ws" else InfoClass.EXACT_BYTE
        spans.append(Span(base + pos, base + pos + len(raw), cls, raw))
        pos += len(raw)
    return spans


def classify(text: str, intent: Optional[ProtectedIntent] = None) -> list[Span]:
    """Contiguous, non-overlapping spans covering `text`."""
    spans: list[Span] = []
    pos = 0
    for m in _FENCE.finditer(text):
        if m.start() > pos:
            spans += _classify_prose(text[pos : m.start()], pos, intent)
        lang, body = m.group(1).lower(), m.group(2)
        open_end = m.start(2)
        spans.append(Span(m.start(), open_end, InfoClass.EXACT_BYTE, text[m.start() : open_end]))
        body_end = open_end + len(body)
        json_spans = None
        if lang == "json":
            try:
                json_spans = _classify_json_body(body, open_end)
            except MalformedJSON:
                json_spans = None
        if json_spans is not None:
            spans += json_spans
        else:
            spans.append(Span(open_end, body_end, InfoClass.EXACT_BYTE, body))
        spans.append(Span(body_end, m.end(), InfoClass.EXACT_BYTE, text[body_end : m.end()]))
        pos = m.end()
    if pos < len(text):
        spans += _classify_prose(text[pos:], pos, intent)
    return [s for s in spans if s.end > s.start]


# ---------------------------------------------------------------- gate
@dataclass(frozen=True)
class Technique:
    name: str
    touches: frozenset[InfoClass]
    kind: str  # "text" | "decision" | "cache"
    apply: Optional[Callable[..., str]] = None
    description: str = ""
    appends: str = ""  # an SPE-authored constant suffix the gate may verify byte-for-byte (the only allowed insertion)


@dataclass
class GateResult:
    technique: str
    allowed: bool
    output: str
    reason: str = ""
    removed_by_class: dict = field(default_factory=dict)
    semantic_diff: list = field(default_factory=list)
    chars_before: int = 0
    chars_after: int = 0


def _conserved_subsequence(needles: Iterable[str], hay: str) -> Optional[str]:
    pos = 0
    for nd in needles:
        k = hay.find(nd, pos)
        if k < 0:
            return nd
        pos = k + len(nd)
    return None


def semantic_diff(before: list[Span], after_text: str) -> tuple[dict, list]:
    removed: dict[str, int] = {}
    after_spans = classify(after_text)
    after_texts = [s.text for s in after_spans]
    sm = difflib.SequenceMatcher(a=[s.text for s in before], b=after_texts, autojunk=False)
    diff = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        for s in before[i1:i2]:
            removed[s.cls.value] = removed.get(s.cls.value, 0) + 1
        diff.append({
            "op": tag,
            "before": [{"cls": s.cls.value, "text": s.text[:120]} for s in before[i1:i2]][:20],
            "after": [{"cls": s.cls.value, "text": s.text[:120]} for s in after_spans[j1:j2]][:20],
        })
    return removed, diff


# ---------------------------------------------------------------- default-deny proof obligation
def _regions(spans: list[Span]) -> list[tuple[str, list[Span]]]:
    """Split classified spans into alternating ('prose', spans) and ('fence', spans) regions."""
    regs: list[tuple[str, list[Span]]] = []
    in_fence = False
    for s in spans:
        opening = s.cls is InfoClass.EXACT_BYTE and s.text.startswith("```")
        if opening and not in_fence:
            regs.append(("fence", [s])); in_fence = True; continue
        if in_fence:
            regs[-1][1].append(s)
            if s.cls is InfoClass.EXACT_BYTE and s.text.startswith("```") and len(regs[-1][1]) > 1:
                in_fence = False
            continue
        if not regs or regs[-1][0] != "prose":
            regs.append(("prose", []))
        regs[-1][1].append(s)
    return regs


def _prose_proof(src: list[Span], out_text: str) -> Optional[str]:
    """Output words must equal the input words with only whole deletable spans removed (any whitespace changes)."""
    out_words = out_text.split()
    reach = {0}
    for s in src:
        w = s.text.split()
        nxt = set()
        for p in reach:
            if out_words[p:p + len(w)] == w:
                nxt.add(p + len(w))
            if not w or deletable(s):
                nxt.add(p)
        if not nxt:
            return f"edit/deletion of non-allowlisted {s.cls.value} span {s.text.strip()[:60]!r}"
        reach = nxt
    if len(out_words) not in reach:
        extra = " ".join(out_words[max(reach):][:8]) if reach else ""
        return f"inserted text not present in input: {extra[:60]!r}"
    return None


def prove_preserving(text: str, before: list[Span], out: str, appends: str = "") -> tuple[bool, str]:
    """Allowed iff, by construction: (1) the only insertion is the technique's declared constant suffix;
    (2) fenced blocks keep their non-whitespace token stream (JSON: identical lexer tokens; other code: byte-identical);
    (3) prose keeps its exact word sequence except whole spans positively allowlisted as deletable."""
    if appends:
        if not out.endswith(appends):
            return False, "declared constant suffix missing"
        out = out[: len(out) - len(appends)]
    after = classify(out)
    rb, ra = _regions(before), _regions(after)
    if sum(k == "fence" for k, _ in rb) != sum(k == "fence" for k, _ in ra):
        return False, "fenced-block structure changed"
    # pair fences in order; everything between fences is prose
    fences_b = [sp for k, sp in rb if k == "fence"]
    fences_a = [sp for k, sp in ra if k == "fence"]
    for fb, fa in zip(fences_b, fences_a):
        tb = [x.text for x in fb if x.cls is not InfoClass.REPLACEABLE]
        ta = [x.text for x in fa if x.cls is not InfoClass.REPLACEABLE]
        if tb != ta:
            return False, "fenced block content changed beyond inter-token whitespace"
    # prose regions are separated by fences; align them by position relative to fences
    pb, pa = _prose_by_gap(rb), _prose_by_gap(ra)
    for gap in range(len(fences_b) + 1):
        why = _prose_proof(pb.get(gap, []), "".join(x.text for x in pa.get(gap, [])))
        if why:
            return False, why
    return True, ""


def _prose_by_gap(regs) -> dict[int, list[Span]]:
    gap, out = 0, {}
    for k, sp in regs:
        if k == "fence":
            gap += 1
        else:
            out.setdefault(gap, []).extend(sp)
    return out


def run_gated(tech: Technique, text: str, *, intent: Optional[ProtectedIntent] = None, **kw) -> GateResult:
    """Apply a text technique only if it provably leaves conserved spans byte-identical and in order."""
    before = classify(text, intent)
    res = GateResult(tech.name, False, text, chars_before=len(text), chars_after=len(text))
    illegal = tech.touches & IMMUTABLE
    if illegal:
        res.reason = f"declares touching immutable classes {sorted(c.value for c in illegal)}"
        return res
    if tech.apply is None:
        res.reason = "not a text transform"
        return res
    try:
        out = tech.apply(text, spans=before, intent=intent, **kw)
    except Refusal as e:
        res.reason = f"technique refused: {e}"
        return res
    must_keep = [s.text for s in before if s.cls in CONSERVED and s.cls not in tech.touches]
    missing = _conserved_subsequence(must_keep, out)
    if missing is not None:
        res.reason = f"conserved span altered/removed: {missing[:80]!r}"
        return res
    # Exact-byte multiset/order check at span level for JSON tokens (stronger than substring search).
    eb_before = [s.text for s in before if s.cls is InfoClass.EXACT_BYTE]
    eb_after = [s.text for s in classify(out, intent) if s.cls is InfoClass.EXACT_BYTE]
    if "".join(eb_before) != "".join(eb_after):
        res.reason = "exact-byte token stream changed"
        return res
    ok, why = prove_preserving(text, before, out, tech.appends)
    if not ok:
        res.reason = f"not provably semantics-preserving (default-deny): {why}"
        return res
    removed, diff = semantic_diff(before, out)
    bad = {k for k in removed if InfoClass(k) not in tech.touches and InfoClass(k) in CONSERVED}
    if bad:
        res.reason = f"diff removes undeclared conserved classes {sorted(bad)}"
        return res
    res.allowed, res.output = True, out
    res.removed_by_class, res.semantic_diff, res.chars_after = removed, diff, len(out)
    return res
