"""Pre-aggregated observations that never become per-user events.

Country, session, referrer class, and feature adoption stay UNKNOWN until
evidence bytes are imported. The bytes are hashed and discarded. Ordinary
event payloads still cannot carry country, session id, a referring URL, or a
free-text feature label.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import date
from types import MappingProxyType
from typing import Mapping

from spe_runtime.privacy.refusals import (
    UNKNOWN,
    PrivacyRefusal,
    PrivacyRefusalError,
    collect_refusals,
)

OBSERVATION_KINDS: tuple[str, ...] = (
    "COUNTRY_AGGREGATE",
    "SESSION_AGGREGATE",
    "REFERRER_CLASS",
    "FEATURE_ADOPTION",
)

# Closed class vocabulary. The string UNKNOWN is also the unmeasured sentinel.
# A stored int means evidence supplied that count. The string UNKNOWN means
# the class was not in the evidence.
REFERRER_CLASSES: tuple[str, ...] = (
    "DIRECT",
    "SEARCH",
    "SOCIAL",
    "REFERRAL",
    "INTERNAL",
    "OTHER",
    "UNKNOWN",
)

# Public capability atlas anchors only. Not a free-text event name.
FEATURE_IDS: tuple[str, ...] = (
    "LOCAL_FIRST",
    "PROTECTED_INTENT",
    "EXECUTION_CONTRACT",
    "PROVIDER_PROFILES",
    "PORTABLE_SPE",
    "CONTEXT_PROTOCOL",
)

# ISO 3166-1 alpha-2 assigned codes. UK is not a code; GB is.
_ISO_ALPHA2 = """
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ
EC EE EG EH ER ES ET
FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU
ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ
LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ
OM
PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA
RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM US UY UZ
VA VC VE VG VI VN VU
WF WS
YE YT
ZA ZM ZW
"""
ISO_COUNTRIES = frozenset(_ISO_ALPHA2.split())

_DAY = re.compile(r"\d{4}-\d{2}-\d{2}")
_DIGEST = re.compile(r"[0-9a-f]{64}")
_ARTIFACT = re.compile(r"[a-z0-9][a-z0-9_./-]{0,200}")
_OBS_GATE = object()


def _refuse(code: PrivacyRefusal, detail: str) -> PrivacyRefusalError:
    return PrivacyRefusalError(code, detail)


def _require_day(value: object, detail: str) -> str:
    if not isinstance(value, str) or _DAY.fullmatch(value) is None:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, detail)
    try:
        date.fromisoformat(value)
    except ValueError:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, detail) from None
    return value


def _safe_artifact_ref(value: object) -> bool:
    if not isinstance(value, str) or value == UNKNOWN:
        return False
    if ".." in value or "\\" in value or "://" in value or "?" in value or value.startswith("/"):
        return False
    return _ARTIFACT.fullmatch(value) is not None


def _non_negative_int(value: object, detail: str) -> int:
    if type(value) is not int or value < 0:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, detail)
    return value


def _scan_key(key: object, detail: str) -> str:
    if not isinstance(key, str):
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, detail)
    refusals = collect_refusals(key)
    if refusals:
        raise PrivacyRefusalError(refusals[0], detail)
    return key


def unknown_metrics(kind: str) -> Mapping[str, object]:
    if kind == "COUNTRY_AGGREGATE":
        return MappingProxyType({})
    if kind == "SESSION_AGGREGATE":
        return MappingProxyType({"session_count": UNKNOWN})
    if kind == "REFERRER_CLASS":
        return MappingProxyType({name: UNKNOWN for name in REFERRER_CLASSES})
    if kind == "FEATURE_ADOPTION":
        return MappingProxyType({name: UNKNOWN for name in FEATURE_IDS})
    raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "kind")


@dataclass(frozen=True)
class AggregateObservation:
    """One pre-aggregated observation. Raw evidence bytes are not a field."""

    kind: str
    status: str
    metrics: Mapping[str, object]
    evidence_digest: str
    artifact_ref: str
    imported_on: str
    _import_token: object = field(default=None, compare=False, repr=False, hash=False)

    def __post_init__(self) -> None:
        if self.kind not in OBSERVATION_KINDS:
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "kind")
        if not isinstance(self.metrics, MappingProxyType):
            object.__setattr__(self, "metrics", MappingProxyType(dict(self.metrics)))
        if self.status == "PASS":
            raise _refuse(PrivacyRefusal.PASS_SCORE_FORBIDDEN, "status")
        if self.status not in ("UNKNOWN", "IMPORTED"):
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "status")
        if self.status != "IMPORTED":
            if self._import_token is not None:
                raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "import")
            for label, current in (
                ("evidence_digest", self.evidence_digest),
                ("artifact_ref", self.artifact_ref),
                ("imported_on", self.imported_on),
            ):
                if current != UNKNOWN:
                    raise _refuse(PrivacyRefusal.INVENTED_METRIC, label)
            if dict(self.metrics) != dict(unknown_metrics(self.kind)):
                raise _refuse(PrivacyRefusal.INVENTED_METRIC, "metrics")
            return
        if self._import_token is not _OBS_GATE:
            raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, "import")
        if not isinstance(self.evidence_digest, str) or _DIGEST.fullmatch(self.evidence_digest) is None:
            raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, "evidence_digest")
        if not _safe_artifact_ref(self.artifact_ref):
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "artifact_ref")
        _require_day(self.imported_on, "imported_on")
        _validate_imported_metrics(self.kind, self.metrics)

    def to_dict(self) -> dict[str, object]:
        return {
            "kind": self.kind,
            "status": self.status,
            "metrics": dict(self.metrics),
            "evidence_digest": self.evidence_digest,
            "artifact_ref": self.artifact_ref,
            "imported_on": self.imported_on,
        }


def _validate_imported_metrics(kind: str, metrics: Mapping[str, object]) -> None:
    if kind == "COUNTRY_AGGREGATE":
        if not metrics:
            raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, "counts")
        for code, value in metrics.items():
            if code not in ISO_COUNTRIES:
                raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "counts")
            _non_negative_int(value, "counts")
        return
    if kind == "SESSION_AGGREGATE":
        if tuple(metrics) != ("session_count",):
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "metrics")
        _non_negative_int(metrics["session_count"], "session_count")
        return
    names = REFERRER_CLASSES if kind == "REFERRER_CLASS" else FEATURE_IDS
    detail = "referrer_class" if kind == "REFERRER_CLASS" else "feature"
    if tuple(metrics) != names:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, detail)
    numeric = False
    for name in names:
        value = metrics[name]
        if value == UNKNOWN:
            continue
        _non_negative_int(value, detail)
        numeric = True
    if not numeric:
        raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, detail)


def unknown_observations() -> tuple[AggregateObservation, ...]:
    return tuple(
        AggregateObservation(
            kind=kind,
            status="UNKNOWN",
            metrics=unknown_metrics(kind),
            evidence_digest=UNKNOWN,
            artifact_ref=UNKNOWN,
            imported_on=UNKNOWN,
        )
        for kind in OBSERVATION_KINDS
    )


def _load_object(
    evidence_bytes: object,
    artifact_ref: object,
    imported_on: object,
) -> tuple[bytes, dict[str, object]]:
    if not isinstance(evidence_bytes, (bytes, bytearray)) or not bytes(evidence_bytes).strip():
        raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, "evidence_bytes")
    evidence = bytes(evidence_bytes)
    ref_refusals = collect_refusals(artifact_ref)
    if ref_refusals:
        raise PrivacyRefusalError(ref_refusals[0], "artifact_ref")
    if not _safe_artifact_ref(artifact_ref):
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "artifact_ref")
    _require_day(imported_on, "imported_on")
    try:
        parsed = json.loads(evidence)
    except json.JSONDecodeError:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "evidence") from None
    parsed_refusals = collect_refusals(parsed)
    if parsed_refusals:
        raise PrivacyRefusalError(parsed_refusals[0], "evidence")
    if not isinstance(parsed, dict):
        raise _refuse(PrivacyRefusal.NOT_AGGREGATE, "evidence")
    for key in parsed:
        _scan_key(key, "evidence")
    return evidence, parsed


def _finish(
    kind: str,
    evidence: bytes,
    metrics: Mapping[str, object],
    artifact_ref: str,
    imported_on: str,
) -> AggregateObservation:
    return AggregateObservation(
        kind=kind,
        status="IMPORTED",
        metrics=metrics,
        evidence_digest=hashlib.sha256(evidence).hexdigest(),
        artifact_ref=artifact_ref,
        imported_on=imported_on,
        _import_token=_OBS_GATE,
    )


def parse_observation(
    kind: str,
    evidence_bytes: object,
    *,
    artifact_ref: str,
    imported_on: str,
) -> AggregateObservation:
    """Copy allowlisted aggregate numbers from evidence bytes, then drop the bytes."""

    if kind not in OBSERVATION_KINDS:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "kind")
    evidence, parsed = _load_object(evidence_bytes, artifact_ref, imported_on)
    if parsed.get("source") != kind:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "source")
    if kind == "COUNTRY_AGGREGATE":
        metrics = _country_metrics(parsed)
    elif kind == "SESSION_AGGREGATE":
        metrics = _session_metrics(parsed)
    elif kind == "REFERRER_CLASS":
        metrics = _class_metrics(parsed, REFERRER_CLASSES, "referrer_class")
    elif kind == "FEATURE_ADOPTION":
        metrics = _class_metrics(parsed, FEATURE_IDS, "feature")
    else:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "kind")
    return _finish(kind, evidence, metrics, artifact_ref, imported_on)


def _country_metrics(parsed: Mapping[str, object]) -> dict[str, int]:
    if set(parsed) != {"source", "counts"}:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "evidence")
    counts = parsed["counts"]
    if not isinstance(counts, dict) or not counts:
        raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, "counts")
    metrics: dict[str, int] = {}
    for code in sorted(counts):
        safe_code = _scan_key(code, "counts")
        if safe_code not in ISO_COUNTRIES:
            raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "counts")
        metrics[safe_code] = _non_negative_int(counts[code], "counts")
    return metrics


def _session_metrics(parsed: Mapping[str, object]) -> dict[str, int]:
    extra = set(parsed) - {"source", "session_count"}
    if extra:
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, "evidence")
    if "session_count" not in parsed or parsed["session_count"] == UNKNOWN:
        raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, "session_count")
    return {"session_count": _non_negative_int(parsed["session_count"], "session_count")}


def _class_metrics(
    parsed: Mapping[str, object],
    names: tuple[str, ...],
    detail: str,
) -> dict[str, object]:
    extra = set(parsed) - {"source", *names}
    if extra:
        for key in sorted(extra):
            _scan_key(key, detail)
        raise _refuse(PrivacyRefusal.SCHEMA_INVALID, detail)
    metrics: dict[str, object] = {name: UNKNOWN for name in names}
    numeric = False
    for name in names:
        if name not in parsed or parsed[name] == UNKNOWN:
            continue
        metrics[name] = _non_negative_int(parsed[name], detail)
        numeric = True
    if not numeric:
        raise _refuse(PrivacyRefusal.EVIDENCE_REQUIRED, detail)
    return metrics
