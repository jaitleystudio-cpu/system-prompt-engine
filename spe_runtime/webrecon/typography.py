"""Typography tokens. Names are hashes of observed font fields, not brand roles."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from spe_runtime.webrecon.digest import digest_json
from spe_runtime.webrecon.isolation import TypographyHint


@dataclass(frozen=True)
class TypographyToken:
    token_id: str
    font_family: str | None
    font_size: str | None
    font_weight: str | None
    line_height: str | None
    letter_spacing: str | None
    font_shorthand: str | None
    sources: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "token_id": self.token_id,
            "font_family": self.font_family,
            "font_size": self.font_size,
            "font_weight": self.font_weight,
            "line_height": self.line_height,
            "letter_spacing": self.letter_spacing,
            "font_shorthand": self.font_shorthand,
            "sources": list(self.sources),
        }


def _token_id(fields: dict[str, str | None]) -> str:
    return "typo:" + digest_json(fields).split(":", 1)[1][:16]


def make_token(
    *,
    font_family: str | None = None,
    font_size: str | None = None,
    font_weight: str | None = None,
    line_height: str | None = None,
    letter_spacing: str | None = None,
    font_shorthand: str | None = None,
    source: str,
) -> TypographyToken | None:
    fields = {
        "font_family": font_family,
        "font_size": font_size,
        "font_weight": font_weight,
        "line_height": line_height,
        "letter_spacing": letter_spacing,
        "font_shorthand": font_shorthand,
    }
    if all(value is None for value in fields.values()):
        return None
    return TypographyToken(
        token_id=_token_id(fields),
        sources=(source,),
        **fields,
    )


def tokens_from_hints(hints: tuple[TypographyHint, ...]) -> tuple[TypographyToken, ...]:
    merged: dict[str, TypographyToken] = {}
    for hint in hints:
        token = make_token(
            font_family=hint.font_family,
            font_size=hint.font_size,
            font_weight=hint.font_weight,
            line_height=hint.line_height,
            letter_spacing=hint.letter_spacing,
            font_shorthand=hint.font_shorthand,
            source=hint.source,
        )
        if token is None:
            continue
        existing = merged.get(token.token_id)
        if existing is None:
            merged[token.token_id] = token
            continue
        sources = tuple(dict.fromkeys((*existing.sources, *token.sources)))
        merged[token.token_id] = TypographyToken(
            token_id=existing.token_id,
            font_family=existing.font_family,
            font_size=existing.font_size,
            font_weight=existing.font_weight,
            line_height=existing.line_height,
            letter_spacing=existing.letter_spacing,
            font_shorthand=existing.font_shorthand,
            sources=sources,
        )
    return tuple(sorted(merged.values(), key=lambda item: item.token_id))
