"""Public-query privacy minimizer — strip secrets before external lookup."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class MinimizedQuery:
    """Local-only minimization result. Never send omitted_spans externally."""

    public_query: str
    omitted_spans: tuple[str, ...]
    reason_codes: tuple[str, ...]


def minimize_public_query(
    text: str,
    sensitive_spans: tuple[str, ...],
) -> MinimizedQuery:
    """Compile a minimal public query that preserves retrieval meaning.

    Sensitive spans (secrets, proprietary tokens, account ids, etc.) are
    removed from the public query and recorded only in omitted_spans /
    reason_codes for local audit — never for egress.
    """
    if not isinstance(sensitive_spans, tuple):
        sensitive_spans = tuple(sensitive_spans or ())

    public = str(text)
    omitted: list[str] = []
    # Longer spans first so nested/overlapping secrets redact cleanly.
    for span in sorted((s for s in sensitive_spans if s), key=len, reverse=True):
        if span in public:
            public = public.replace(span, " ")
            omitted.append(span)

    public = re.sub(r"\s+", " ", public).strip()
    # Drop leading filler left by redaction ("My secret electrolyte  overheats...")
    public = re.sub(
        r"\b(my|our|the)\s+(secret|private|confidential)\s+",
        "",
        public,
        flags=re.IGNORECASE,
    )
    public = re.sub(r"\s+", " ", public).strip()

    reason_codes: tuple[str, ...]
    if omitted:
        reason_codes = ("SENSITIVE_SPAN_OMITTED",)
    else:
        reason_codes = ()

    return MinimizedQuery(
        public_query=public,
        omitted_spans=tuple(omitted),
        reason_codes=reason_codes,
    )
