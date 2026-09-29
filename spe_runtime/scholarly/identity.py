"""DOI, PMID, PMCID, and arXiv identity normalization.

Canonical key preference is DOI, then PMID, then PMCID, then arXiv.
No identifier means status UNKNOWN. Callers must not invent one.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Any

_DOI_PREFIXES = (
    "https://doi.org/",
    "http://doi.org/",
    "https://dx.doi.org/",
    "http://dx.doi.org/",
    "doi:",
)
_DOI_RE = re.compile(r"^10\.\d{4,9}/\S+$")
_PMID_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?pubmed\.ncbi\.nlm\.nih\.gov/(\d+)/?",
    re.IGNORECASE,
)
_PMID_RE = re.compile(r"^\d{1,9}$")
_PMC_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?ncbi\.nlm\.nih\.gov/pmc/articles/(PMC\d+)/?",
    re.IGNORECASE,
)
_PMCID_RE = re.compile(r"^PMC\d+$")
_ARXIV_URL_RE = re.compile(
    r"(?:https?://)?(?:arxiv\.org|export\.arxiv\.org)/(?:abs|pdf)/",
    re.IGNORECASE,
)
_ARXIV_NEW_RE = re.compile(r"^(\d{4}\.\d{4,5})(v(\d+))?$")
_ARXIV_OLD_RE = re.compile(r"^([a-z-]+(?:\.[a-z]{2})?/\d{7})(v(\d+))?$")


class IdentityStatus(str, Enum):
    RESOLVED = "RESOLVED"
    UNKNOWN = "UNKNOWN"

    def to_dict(self) -> str:
        return self.value


@dataclass(frozen=True)
class ScholarlyIdentity:
    """Normalized persistent identifiers for one scholarly work."""

    doi: str | None
    pmid: str | None
    pmcid: str | None
    arxiv_id: str | None
    arxiv_version: str | None
    canonical_key: str
    status: IdentityStatus

    def to_dict(self) -> dict[str, Any]:
        return {
            "doi": self.doi,
            "pmid": self.pmid,
            "pmcid": self.pmcid,
            "arxiv_id": self.arxiv_id,
            "arxiv_version": self.arxiv_version,
            "canonical_key": self.canonical_key,
            "status": self.status.value,
        }


def normalize_doi(value: object) -> str | None:
    """Return a lowercase DOI, or None when the value is not a DOI."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    lowered = text.lower()
    for prefix in _DOI_PREFIXES:
        if lowered.startswith(prefix):
            text = text[len(prefix) :]
            lowered = text.lower()
            break
    text = lowered.strip().rstrip(".,;)")
    if any(ch.isspace() for ch in text):
        return None
    if _DOI_RE.fullmatch(text) is None:
        return None
    return text


def normalize_pmid(value: object) -> str | None:
    """Return a numeric PMID, or None."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    url_match = _PMID_URL_RE.fullmatch(text)
    if url_match is not None:
        text = url_match.group(1)
    if text.lower().startswith("pmid:"):
        text = text[5:].strip()
    if _PMID_RE.fullmatch(text) is None:
        return None
    return str(int(text))


def normalize_pmcid(value: object) -> str | None:
    """Return a PMC-prefixed identifier, or None."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    url_match = _PMC_URL_RE.fullmatch(text)
    if url_match is not None:
        text = url_match.group(1)
    lowered = text.lower()
    if lowered.startswith("pmcid:"):
        text = text[6:].strip()
    upper = text.upper()
    if upper.isdigit():
        upper = f"PMC{int(upper)}"
    elif upper.startswith("PMC") and upper[3:].isdigit():
        upper = f"PMC{int(upper[3:])}"
    else:
        return None
    if _PMCID_RE.fullmatch(upper) is None:
        return None
    return upper


def normalize_arxiv(value: object) -> tuple[str | None, str | None]:
    """Return (arxiv_id without version, version or None)."""
    if value is None:
        return None, None
    text = str(value).strip()
    if not text:
        return None, None
    if text.lower().startswith("arxiv:"):
        text = text[6:].strip()
    text = _ARXIV_URL_RE.sub("", text)
    if text.lower().endswith(".pdf"):
        text = text[:-4]
    text = text.strip().strip("/")
    lowered = text.lower()
    new_match = _ARXIV_NEW_RE.fullmatch(lowered)
    if new_match is not None:
        version = new_match.group(3)
        return new_match.group(1), (str(int(version)) if version else None)
    old_match = _ARXIV_OLD_RE.fullmatch(lowered)
    if old_match is not None:
        version = old_match.group(3)
        return old_match.group(1), (str(int(version)) if version else None)
    return None, None


def make_identity(
    *,
    doi: object = None,
    pmid: object = None,
    pmcid: object = None,
    arxiv: object = None,
) -> ScholarlyIdentity:
    """Build an identity. Status is UNKNOWN when every identifier is absent."""
    norm_doi = normalize_doi(doi)
    norm_pmid = normalize_pmid(pmid)
    norm_pmcid = normalize_pmcid(pmcid)
    arxiv_id, arxiv_version = normalize_arxiv(arxiv)
    if norm_doi is not None:
        key = f"doi:{norm_doi}"
        status = IdentityStatus.RESOLVED
    elif norm_pmid is not None:
        key = f"pmid:{norm_pmid}"
        status = IdentityStatus.RESOLVED
    elif norm_pmcid is not None:
        key = f"pmcid:{norm_pmcid}"
        status = IdentityStatus.RESOLVED
    elif arxiv_id is not None:
        key = f"arxiv:{arxiv_id}"
        status = IdentityStatus.RESOLVED
    else:
        key = ""
        status = IdentityStatus.UNKNOWN
    return ScholarlyIdentity(
        doi=norm_doi,
        pmid=norm_pmid,
        pmcid=norm_pmcid,
        arxiv_id=arxiv_id,
        arxiv_version=arxiv_version,
        canonical_key=key,
        status=status,
    )


def merge_identities(items: tuple[ScholarlyIdentity, ...]) -> ScholarlyIdentity:
    """Union identifiers. DOI remains the canonical key when any witness has one."""
    if not items:
        return make_identity()
    doi = next((item.doi for item in items if item.doi), None)
    pmid = next((item.pmid for item in items if item.pmid), None)
    pmcid = next((item.pmcid for item in items if item.pmcid), None)
    arxiv_id = next((item.arxiv_id for item in items if item.arxiv_id), None)
    versions = [item.arxiv_version for item in items if item.arxiv_version]
    version = max(versions, key=int) if versions else None
    base = make_identity(doi=doi, pmid=pmid, pmcid=pmcid, arxiv=arxiv_id)
    if version is None or base.arxiv_id is None:
        return base
    return ScholarlyIdentity(
        doi=base.doi,
        pmid=base.pmid,
        pmcid=base.pmcid,
        arxiv_id=base.arxiv_id,
        arxiv_version=version,
        canonical_key=base.canonical_key,
        status=base.status,
    )
