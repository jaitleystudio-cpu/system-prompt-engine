"""Open scholarly source registry.

Enabled sources must be INR 0 and keyless. Disabled sources stay visible so a
request for them fails closed instead of being silently dropped.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from spe_runtime.scholarly.errors import RegistryError

_REGISTRY_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "scholarly" / "source_registry.json"
)
_REQUIRED = (
    "source_id",
    "display_name",
    "qualification",
    "role",
    "enabled",
    "cost",
    "auth",
    "hosts",
    "method",
    "license_note",
    "terms_url",
    "sends",
    "retraction_policy",
    "identifier_fields",
)
_QUALIFICATIONS = frozenset(
    {"primary_open", "qualified_open", "qualified_disabled"}
)
_ROLES = frozenset({"search", "identity_crosswalk", "inactive"})
_COSTS = frozenset({"INR_0", "UNKNOWN"})
_AUTHS = frozenset({"none", "API_KEY_UNKNOWN"})


@dataclass(frozen=True)
class SourceSpec:
    """One registered scholarly source."""

    source_id: str
    display_name: str
    qualification: str
    role: str
    enabled: bool
    cost: str
    auth: str
    hosts: tuple[str, ...]
    method: str
    license_note: str
    terms_url: str
    sends: str
    retraction_policy: str
    identifier_fields: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_id": self.source_id,
            "display_name": self.display_name,
            "qualification": self.qualification,
            "role": self.role,
            "enabled": self.enabled,
            "cost": self.cost,
            "auth": self.auth,
            "hosts": list(self.hosts),
            "method": self.method,
            "license_note": self.license_note,
            "terms_url": self.terms_url,
            "sends": self.sends,
            "retraction_policy": self.retraction_policy,
            "identifier_fields": list(self.identifier_fields),
        }


@dataclass(frozen=True)
class SourceRegistry:
    """Validated registry snapshot."""

    registry_version: str
    owner: str
    cost_policy: str
    sources: tuple[SourceSpec, ...]

    def get(self, source_id: str) -> SourceSpec:
        for source in self.sources:
            if source.source_id == source_id:
                return source
        raise RegistryError(f"SOURCE_UNKNOWN:{source_id}")

    def require_enabled(self, source_id: str) -> SourceSpec:
        source = self.get(source_id)
        if not source.enabled:
            raise RegistryError(f"SOURCE_DISABLED:{source_id}")
        return source

    def search_sources(self) -> tuple[SourceSpec, ...]:
        return tuple(
            source
            for source in self.sources
            if source.enabled and source.role == "search"
        )

    def crosswalk(self) -> SourceSpec:
        return self.require_enabled("ncbi_idconv")

    def allowlist(self) -> frozenset[str]:
        hosts: set[str] = set()
        for source in self.sources:
            if source.enabled:
                hosts.update(source.hosts)
        return frozenset(hosts)


def _as_str_tuple(value: object, *, field: str, source_id: str) -> tuple[str, ...]:
    if not isinstance(value, list) or not value or not all(
        isinstance(item, str) and item.strip() for item in value
    ):
        raise RegistryError(f"REGISTRY_FIELD:{source_id}:{field}")
    return tuple(str(item) for item in value)


def _spec(raw: object) -> SourceSpec:
    if not isinstance(raw, dict):
        raise RegistryError("REGISTRY_SOURCE_SHAPE")
    extra = set(raw) - set(_REQUIRED)
    missing = set(_REQUIRED) - set(raw)
    if extra or missing:
        raise RegistryError(
            f"REGISTRY_KEYS:{sorted(missing)}:{sorted(extra)}"
        )
    source_id = raw["source_id"]
    if not isinstance(source_id, str) or not source_id.strip():
        raise RegistryError("REGISTRY_SOURCE_ID")
    qualification = raw["qualification"]
    role = raw["role"]
    cost = raw["cost"]
    auth = raw["auth"]
    enabled = raw["enabled"]
    method = raw["method"]
    if qualification not in _QUALIFICATIONS:
        raise RegistryError(f"REGISTRY_QUALIFICATION:{source_id}")
    if role not in _ROLES:
        raise RegistryError(f"REGISTRY_ROLE:{source_id}")
    if cost not in _COSTS:
        raise RegistryError(f"REGISTRY_COST:{source_id}")
    if auth not in _AUTHS:
        raise RegistryError(f"REGISTRY_AUTH:{source_id}")
    if not isinstance(enabled, bool):
        raise RegistryError(f"REGISTRY_ENABLED:{source_id}")
    if method != "GET":
        raise RegistryError(f"REGISTRY_METHOD:{source_id}")
    hosts = _as_str_tuple(raw["hosts"], field="hosts", source_id=source_id)
    fields = _as_str_tuple(
        raw["identifier_fields"], field="identifier_fields", source_id=source_id
    )
    for text_field in ("display_name", "license_note", "terms_url", "sends", "retraction_policy"):
        if not isinstance(raw[text_field], str) or not raw[text_field].strip():
            raise RegistryError(f"REGISTRY_FIELD:{source_id}:{text_field}")
    if not str(raw["terms_url"]).startswith("https://"):
        raise RegistryError(f"REGISTRY_TERMS_URL:{source_id}")
    if enabled:
        if cost != "INR_0" or auth != "none" or role == "inactive":
            raise RegistryError(f"REGISTRY_ENABLED_CONTRACT:{source_id}")
        for host in hosts:
            if host != host.lower() or ":" in host or "/" in host or "@" in host:
                raise RegistryError(f"REGISTRY_HOST:{source_id}")
    spec = SourceSpec(
        source_id=source_id,
        display_name=str(raw["display_name"]),
        qualification=str(qualification),
        role=str(role),
        enabled=enabled,
        cost=str(cost),
        auth=str(auth),
        hosts=hosts,
        method="GET",
        license_note=str(raw["license_note"]),
        terms_url=str(raw["terms_url"]),
        sends=str(raw["sends"]),
        retraction_policy=str(raw["retraction_policy"]),
        identifier_fields=fields,
    )
    return spec


def load_registry(path: Path | None = None) -> SourceRegistry:
    """Load and validate the registry. Fails closed on contract drift."""
    target = path if path is not None else _REGISTRY_PATH
    try:
        payload = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RegistryError("REGISTRY_UNREADABLE") from exc
    if not isinstance(payload, dict):
        raise RegistryError("REGISTRY_ROOT")
    if payload.get("cost_policy") != "INR_0":
        raise RegistryError("REGISTRY_COST_POLICY")
    if payload.get("owner") != "LANE_C_SCHOLARLY":
        raise RegistryError("REGISTRY_OWNER")
    version = payload.get("registry_version")
    if version != "1":
        raise RegistryError("REGISTRY_VERSION")
    raw_sources = payload.get("sources")
    if not isinstance(raw_sources, list) or not raw_sources:
        raise RegistryError("REGISTRY_SOURCES")
    sources = tuple(_spec(item) for item in raw_sources)
    ids = [source.source_id for source in sources]
    if len(ids) != len(set(ids)):
        raise RegistryError("REGISTRY_DUPLICATE_SOURCE")
    required = {
        "pubmed",
        "pmc",
        "europepmc",
        "crossref",
        "doaj",
        "arxiv",
        "openalex",
        "ncbi_idconv",
    }
    enabled_ids = {source.source_id for source in sources if source.enabled}
    if not required <= enabled_ids:
        raise RegistryError(f"REGISTRY_REQUIRED_MISSING:{sorted(required - enabled_ids)}")
    return SourceRegistry(
        registry_version=str(version),
        owner="LANE_C_SCHOLARLY",
        cost_policy="INR_0",
        sources=sources,
    )
