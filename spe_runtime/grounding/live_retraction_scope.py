"""Live retraction receipts. Does not promote product gates.

A stored provider body can show a retraction. That binds the observation.
It does not flip product LIVE_RETRACTION, does not set may_promote, and
does not score LIVE_INDEX. PubMed and PMC are one NCBI family.
A missing retraction field is not PASS. A self-signed receipt is not evidence.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Mapping

from spe_runtime.grounding.live_fabric import LIVE_INDEX, LIVE_RETRACTION

_SHA = re.compile(r"^(?:sha256:)?([0-9a-f]{64})$")
_FAMILY = {
    "OPENALEX": "OPENALEX",
    "CROSSREF": "CROSSREF",
    "PUBMED": "NCBI",
    "PMC": "NCBI",
}
_SELF_AUTHORITY = frozenset({"SELF", "WRITER", "SELF_SIGNED"})
_RETRACTION_PUBTYPES = frozenset({
    "retracted publication",
    "retraction notice",
    "retraction of publication",
})
NO_RETRACTION_ASSERTED = "no retraction asserted by these providers on this date"


def _rows(pack: Mapping[str, object]) -> tuple[Mapping[str, object], ...]:
    raw = pack.get("receipts")
    if not isinstance(raw, list):
        raw = pack.get("bindings")
    if not isinstance(raw, list):
        return ()
    return tuple(row for row in raw if isinstance(row, Mapping))


def _digest_hex(value: object) -> str:
    if not isinstance(value, str):
        return ""
    match = _SHA.match(value.strip().lower())
    return match.group(1) if match else ""


def _canonical(value: object) -> bytes:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return raw.encode("utf-8")


def receipt_is_self_signed(row: Mapping[str, object], pack: Mapping[str, object] | None = None) -> bool:
    """True when the row signs its own claim instead of a provider body.

    Hashing the receipt row, or hashing raw_status alone, is self-signed.
    A writer authority stamp is self-signed. Missing digests are a separate
    failure and are not treated as an external signature.
    """
    pack = pack or {}
    if row.get("self_signed") is True or pack.get("self_signed") is True:
        return True
    authority = str(row.get("authority") or pack.get("authority") or "").strip().upper()
    if authority in _SELF_AUTHORITY:
        return True
    digest = _digest_hex(row.get("response_sha256"))
    if not digest:
        return False
    claim = {key: row[key] for key in row if key != "response_sha256"}
    if hashlib.sha256(_canonical(claim)).hexdigest() == digest:
        return True
    if "raw_status" in row and hashlib.sha256(_canonical(row.get("raw_status"))).hexdigest() == digest:
        return True
    return False


def _stored(row: Mapping[str, object]) -> bool:
    if row.get("http_status") != 200:
        return False
    if not _digest_hex(row.get("response_sha256")):
        return False
    if not str(row.get("timestamp_ist") or "").strip():
        return False
    if not str(row.get("query") or "").strip():
        return False
    provider = str(row.get("provider") or "").strip().upper()
    if provider not in _FAMILY:
        return False
    return True


def _types_from(items: object) -> list[str]:
    found: list[str] = []
    if not isinstance(items, list):
        return found
    for item in items:
        if isinstance(item, dict):
            found.append(str(item.get("type") or "").lower())
        elif isinstance(item, str):
            found.append(item.lower())
    return found


def retraction_assertion(row: Mapping[str, object]) -> str:
    """ASSERTED, NOT_ASSERTED, or FIELD_ABSENT. Never PASS."""
    provider = str(row.get("provider") or "").strip().upper()
    raw = row.get("raw_status")
    if not isinstance(raw, Mapping):
        return "FIELD_ABSENT"
    if str(row.get("query_class") or "") == "PMID_RESOLUTION":
        return "FIELD_ABSENT"
    if provider == "OPENALEX":
        if "is_retracted" not in raw:
            return "FIELD_ABSENT"
        return "ASSERTED" if raw.get("is_retracted") is True else "NOT_ASSERTED"
    if provider == "CROSSREF":
        asserted = False
        saw_field = False
        for key in ("update-to", "updated-by"):
            if key not in raw:
                continue
            saw_field = True
            if "retraction" in _types_from(raw.get(key)):
                asserted = True
        if "relation" in raw:
            saw_field = True
            relation = raw.get("relation")
            if isinstance(relation, Mapping):
                for key, value in relation.items():
                    if "retract" in str(key).lower():
                        asserted = True
                    if "retraction" in _types_from(value):
                        asserted = True
            elif relation not in (None, {}, []):
                saw_field = True
        if asserted:
            return "ASSERTED"
        return "NOT_ASSERTED" if saw_field else "FIELD_ABSENT"
    if provider in {"PUBMED", "PMC"}:
        if "pubtype" not in raw or not isinstance(raw.get("pubtype"), list):
            return "FIELD_ABSENT"
        pubtypes = {str(item).strip().lower() for item in raw.get("pubtype") or []}
        if pubtypes & _RETRACTION_PUBTYPES:
            return "ASSERTED"
        return "NOT_ASSERTED"
    return "FIELD_ABSENT"


def evaluate_live_retraction_receipts(pack: Mapping[str, object] | None) -> dict[str, object]:
    """Bind retraction observations. Product LIVE_* and may_promote stay closed."""
    base = {
        "LIVE_RETRACTION": "HOLD",
        "scoped_LIVE_RETRACTION": "HOLD",
        "product_LIVE_INDEX": LIVE_INDEX,
        "product_LIVE_RETRACTION": LIVE_RETRACTION,
        "may_promote": False,
        "pass": False,
        "writer_receipt_is_promotion_proof": False,
        "independent_verifier_receipt": False,
        "index_unchanged": True,
        "dois": {},
        "reasons": [],
    }
    if not pack or not _rows(pack):
        base["reasons"] = ["RECEIPT_MISSING", "FIELD_ABSENT_IS_NOT_PASS", "PRODUCT_LIVE_RETRACTION_HOLD"]
        return base

    reasons = [
        "PRODUCT_LIVE_RETRACTION_HOLD",
        "WRITER_RECEIPT_DOES_NOT_FLIP_PRODUCT_CONSTANT",
        "FIELD_ABSENT_IS_NOT_PASS",
        "PUBMED_PLUS_PMC_NOT_TWO_CONFIRMATIONS",
        "NOT_PASS",
    ]
    pack_self_signed = bool(pack.get("self_signed") is True or pack.get("independent_verifier_receipt") is True)
    if pack_self_signed:
        reasons.append("SELF_SIGNED_RECEIPT_REJECTED")
    authority = str(pack.get("authority") or "").strip().upper()
    if authority in _SELF_AUTHORITY:
        pack_self_signed = True
        reasons.append("SELF_SIGNED_RECEIPT_REJECTED")

    by_doi: dict[str, list[Mapping[str, object]]] = {}
    order: list[str] = []
    for row in _rows(pack):
        doi = str(row.get("canonical_doi") or "").strip().lower()
        if not doi:
            continue
        if doi not in by_doi:
            order.append(doi)
            by_doi[doi] = []
        by_doi[doi].append(row)

    dois: dict[str, dict[str, object]] = {}
    all_bound = bool(order)
    for doi in order:
        provider_status: dict[str, str] = {}
        queries: list[dict[str, object]] = []
        families: set[str] = set()
        rejected_self_signed = False
        ncbi_asserted = False
        for row in by_doi[doi]:
            provider = str(row.get("provider") or "").strip().upper()
            kind = retraction_assertion(row)
            provider_status.setdefault(provider, kind)
            if kind == "ASSERTED":
                provider_status[provider] = "ASSERTED"
            stored = _stored(row)
            signed = pack_self_signed or receipt_is_self_signed(row, pack)
            counted = (
                stored
                and not signed
                and kind == "ASSERTED"
                and bool(str(row.get("returned_id") or "").strip())
            )
            queries.append({
                "provider": provider,
                "query_class": str(row.get("query_class") or ""),
                "assertion": kind,
                "stored": stored,
                "self_signed": signed,
                "counted": counted,
                "returned_id": row.get("returned_id"),
            })
            if not stored:
                continue
            if signed:
                rejected_self_signed = True
                continue
            if not counted:
                continue
            family = _FAMILY.get(provider)
            if family:
                families.add(family)
                if family == "NCBI":
                    ncbi_asserted = True
        if rejected_self_signed:
            reasons.append("SELF_SIGNED_RECEIPT_REJECTED")
        bound = len(families) >= 2
        all_bound = all_bound and bound
        if families:
            evidence = "retraction asserted by " + ",".join(sorted(families))
        else:
            evidence = NO_RETRACTION_ASSERTED
        dois[doi] = {
            "provider_status": provider_status,
            "queries": queries,
            "asserting_families": sorted(families),
            "independent_family_count": len(families),
            "ncbi_family_count": 1 if ncbi_asserted else 0,
            "ncbi_counts_as_two_providers": False,
            "retraction_gate": "RETRACTION_BOUND" if bound else "HOLD",
            "evidence": evidence,
            "not_retracted": False,
            "pass": False,
            "live_verified": False,
        }

    scoped = "RETRACTION_BOUND" if all_bound and not pack_self_signed else "HOLD"
    if scoped != "HOLD":
        reasons.append("SCOPED_RETRACTION_BOUND_IS_NOT_PRODUCT_PASS")
    base.update({
        "LIVE_RETRACTION": "HOLD",
        "scoped_LIVE_RETRACTION": scoped,
        "dois": dois,
        "reasons": list(dict.fromkeys(reasons)),
    })
    return base


def load_retraction_receipt(path) -> dict[str, object]:
    """Missing files fail closed. A stored verdict is not trusted."""
    from pathlib import Path as _Path

    file_path = _Path(path)
    if not file_path.is_file():
        return evaluate_live_retraction_receipts(None)
    pack = json.loads(file_path.read_text())
    if isinstance(pack, dict):
        pack.pop("verdict", None)
    return evaluate_live_retraction_receipts(pack if isinstance(pack, dict) else None)
