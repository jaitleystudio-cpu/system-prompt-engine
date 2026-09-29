"""Privacy refusals for aggregate-only analytics.

Codes name why a payload is rejected. Messages name the field, never the value,
so a refusal cannot become a copy of a prompt, identifier, or user content.
"""

from __future__ import annotations

import math
import re
from enum import Enum
from typing import Any, Mapping


class PrivacyRefusal(str, Enum):
    """Stable refusal codes. None of these is a success score."""

    RAW_PROMPT = "PA_RAW_PROMPT"
    USER_CONTENT = "PA_USER_CONTENT"
    IDENTIFIER = "PA_IDENTIFIER"
    USER_LEVEL_TRACKING = "PA_USER_LEVEL_TRACKING"
    FINGERPRINT = "PA_FINGERPRINT"
    THIRD_PARTY_AD_BEACON = "PA_THIRD_PARTY_AD_BEACON"
    PASS_SCORE_FORBIDDEN = "PA_PASS_SCORE_FORBIDDEN"
    INVENTED_METRIC = "PA_INVENTED_METRIC"
    UNKNOWN_COLLAPSED = "PA_UNKNOWN_COLLAPSED"
    NOT_AGGREGATE = "PA_NOT_AGGREGATE"
    EVIDENCE_REQUIRED = "PA_EVIDENCE_REQUIRED"
    SCHEMA_INVALID = "PA_SCHEMA_INVALID"


UNKNOWN = "UNKNOWN"

_KEY_CODES: dict[str, PrivacyRefusal] = {}


def _bind(code: PrivacyRefusal, names: tuple[str, ...]) -> None:
    for name in names:
        _KEY_CODES[name] = code


_bind(
    PrivacyRefusal.RAW_PROMPT,
    (
        "prompt",
        "prompts",
        "raw_prompt",
        "system_prompt",
        "user_prompt",
        "prompt_text",
        "completion",
        "completions",
    ),
)
_bind(
    PrivacyRefusal.USER_CONTENT,
    (
        "message",
        "messages",
        "content",
        "query",
        "search_query",
        "user_content",
        "body",
        "text",
        "transcript",
        "comment",
        "comments",
        "input",
        "output",
        "note",
        "notes",
        "title",
        "description",
    ),
)
_bind(
    PrivacyRefusal.IDENTIFIER,
    (
        "email",
        "e_mail",
        "ip",
        "ip_address",
        "ipv4",
        "ipv6",
        "phone",
        "phone_number",
        "ssn",
        "account_id",
        "address",
    ),
)
_bind(
    PrivacyRefusal.USER_LEVEL_TRACKING,
    (
        "user_id",
        "userid",
        "uid",
        "user",
        "users",
        "distinct_id",
        "anonymous_id",
        "client_id",
        "device_id",
        "session_id",
        "session",
        "session_timeline",
        "session_history",
        "cookie",
        "cookies",
        "ga_client_id",
        "visitor_id",
        "profile_id",
        "tracking_id",
        "local_storage",
        "session_storage",
    ),
)
_bind(
    PrivacyRefusal.FINGERPRINT,
    (
        "fingerprint",
        "fingerprint_id",
        "canvas",
        "canvas_hash",
        "webgl",
        "webgl_hash",
        "audio_hash",
        "font_hash",
        "screen_hash",
        "device_fingerprint",
        "user_agent",
        "user_agent_string",
        "country",
        "region",
        "region_code",
        "city",
        "city_name",
        "zip",
        "postal",
        "postal_code",
        "postcode",
        "lat",
        "lng",
        "latitude",
        "longitude",
        "coordinates",
        "geo",
        "precise_location",
        "timezone",
        "locale",
        "language",
        "accept_language",
    ),
)
_bind(
    PrivacyRefusal.THIRD_PARTY_AD_BEACON,
    (
        "gclid",
        "fbclid",
        "ttclid",
        "msclkid",
        "gbraid",
        "wbraid",
        "dclid",
        "pixel",
        "pixel_id",
        "beacon",
        "doubleclick",
        "fbp",
        "fbc",
        "advertising_id",
        "idfa",
        "gaid",
    ),
)
_bind(
    PrivacyRefusal.PASS_SCORE_FORBIDDEN,
    (
        "score",
        "grade",
        "pass",
        "passed",
        "rating",
        "pass_score",
        "web_vital_rating",
        "lcp_rating",
        "inp_rating",
        "cls_rating",
    ),
)
_bind(
    PrivacyRefusal.NOT_AGGREGATE,
    ("url", "href", "src", "referrer", "referer", "path"),
)

_EXACT_VALUES: dict[str, PrivacyRefusal] = {
    "pass": PrivacyRefusal.PASS_SCORE_FORBIDDEN,
    "passed": PrivacyRefusal.PASS_SCORE_FORBIDDEN,
    "identify": PrivacyRefusal.USER_LEVEL_TRACKING,
    "track": PrivacyRefusal.USER_LEVEL_TRACKING,
    "page_view": PrivacyRefusal.USER_LEVEL_TRACKING,
    "user_event": PrivacyRefusal.USER_LEVEL_TRACKING,
    "session_start": PrivacyRefusal.USER_LEVEL_TRACKING,
    "fingerprint": PrivacyRefusal.FINGERPRINT,
    "beacon": PrivacyRefusal.THIRD_PARTY_AD_BEACON,
    "pixel": PrivacyRefusal.THIRD_PARTY_AD_BEACON,
    "prompt": PrivacyRefusal.RAW_PROMPT,
    "raw_prompt": PrivacyRefusal.RAW_PROMPT,
}

_AD_HOSTS: tuple[str, ...] = (
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com",
    "facebook.net",
    "facebook.com/tr",
    "connect.facebook.net",
    "pixel.facebook.com",
    "ads-twitter.com",
    "analytics.tiktok.com",
    "bat.bing.com",
    "sc-static.net",
)
_TRACKING_HOSTS: tuple[str, ...] = (
    "google-analytics.com",
    "googletagmanager.com",
    "hotjar.com",
    "mixpanel.com",
    "segment.io",
    "segment.com",
    "amplitude.com",
    "fullstory.com",
    "clarity.ms",
    "mc.yandex.ru",
)
_CLICK_IDS: tuple[str, ...] = (
    "gclid=",
    "fbclid=",
    "ttclid=",
    "msclkid=",
    "gbraid=",
    "wbraid=",
    "dclid=",
)

_EMAIL = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
_IPV4 = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_IPV6 = re.compile(r"\b(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}\b", re.IGNORECASE)
_UUID = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)
_CAMEL = re.compile(r"([a-z0-9])([A-Z])")


class PrivacyRefusalError(ValueError):
    """Raised when a payload violates the privacy analytics contract.

    `detail` is a field name. It must not carry the rejected value.
    """

    def __init__(self, code: PrivacyRefusal, detail: str = "payload") -> None:
        self.code = code
        self.detail = detail
        super().__init__(f"{code.value}: {detail}")


def refusal_catalog() -> tuple[str, ...]:
    """Refusal codes in stable priority order."""

    return tuple(item.value for item in PrivacyRefusal)


def norm_key(key: str) -> str:
    spaced = _CAMEL.sub(r"\1_\2", key)
    return re.sub(r"[^a-z0-9]+", "_", spaced.lower()).strip("_")


def unique_refusals(codes: tuple[PrivacyRefusal, ...] | list[PrivacyRefusal]) -> tuple[PrivacyRefusal, ...]:
    present = set(codes)
    return tuple(code for code in PrivacyRefusal if code in present)


def collect_refusals(value: Any) -> tuple[PrivacyRefusal, ...]:
    """Return every privacy refusal in `value`, highest priority first."""

    found: list[PrivacyRefusal] = []
    _walk(value, found, key=None)
    return unique_refusals(found)


def _walk(value: Any, found: list[PrivacyRefusal], key: str | None) -> None:
    if key is not None:
        code = _KEY_CODES.get(norm_key(key))
        if code is not None:
            found.append(code)
        if key == "route_family" and isinstance(value, str) and "/" in value:
            found.append(PrivacyRefusal.NOT_AGGREGATE)
    if value is None or value == "":
        found.append(PrivacyRefusal.UNKNOWN_COLLAPSED)
        return
    if isinstance(value, str):
        _scan_string(value, found)
        return
    if isinstance(value, bool):
        found.append(PrivacyRefusal.SCHEMA_INVALID)
        return
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        found.append(PrivacyRefusal.SCHEMA_INVALID)
        return
    if isinstance(value, (int, float)):
        return
    if isinstance(value, Mapping):
        for child_key, child in value.items():
            if not isinstance(child_key, str):
                found.append(PrivacyRefusal.SCHEMA_INVALID)
                continue
            _walk(child, found, key=child_key)
        return
    if isinstance(value, (list, tuple)):
        found.append(PrivacyRefusal.NOT_AGGREGATE)
        for child in value:
            _walk(child, found, key=None)
        return
    found.append(PrivacyRefusal.SCHEMA_INVALID)


def _scan_string(text: str, found: list[PrivacyRefusal]) -> None:
    lowered = text.lower()
    exact = _EXACT_VALUES.get(lowered)
    if exact is not None:
        found.append(exact)
    if any(host in lowered for host in _AD_HOSTS) or any(token in lowered for token in _CLICK_IDS):
        found.append(PrivacyRefusal.THIRD_PARTY_AD_BEACON)
    elif any(host in lowered for host in _TRACKING_HOSTS):
        found.append(PrivacyRefusal.USER_LEVEL_TRACKING)
    elif "://" in text:
        found.append(PrivacyRefusal.NOT_AGGREGATE)
    if _EMAIL.search(text) or _IPV4.search(text) or _IPV6.search(text) or _UUID.search(text):
        found.append(PrivacyRefusal.IDENTIFIER)
    if any(character.isspace() for character in text):
        found.append(PrivacyRefusal.USER_CONTENT)
