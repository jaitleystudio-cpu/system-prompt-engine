"""Explicit one-URL acquisition grant for the existing Website X-Ray owner.

Default acquisition stays no-socket. This module opens a connection only when
the caller passes an ExampleComGrant, and only to https://example.com/.
The body is untrusted data. It is not executed and it is not recovered source.
Product live-URL reconstruction stays NOT_AVAILABLE. A successful fetch is
labeled LIVE_URL_SCOPED on the receipt only.
"""

from __future__ import annotations

import hashlib
import http.client
import re
import ssl
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from spe_runtime.webrecon.acquisition import (
    AcquisitionAuthorization,
    decide_acquisition,
)
from spe_runtime.webrecon.contract import (
    WebReconstructionContract,
    build_reconstruction_contract,
)

SCOPED_URL = "https://example.com/"
SCOPED_HOST = "example.com"
SCOPED_TIMEOUT_SECONDS = 5.0
SCOPED_MAX_BYTES = 65_536
PRODUCT_LIVE_URL_RECONSTRUCTION = "NOT_AVAILABLE"
SCOPED_LABEL = "LIVE_URL_SCOPED"

_SCRIPT_BLOCK = re.compile(r"<script\b[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL)
_STYLE_BLOCK = re.compile(r"<style\b[^>]*>.*?</style>", re.IGNORECASE | re.DOTALL)
_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")


def _example_authorization(grant_id: str) -> AcquisitionAuthorization:
    return AcquisitionAuthorization(
        authorization_id=grant_id,
        allowed_hosts=(SCOPED_HOST,),
        allowed_schemes=("https",),
        allow_private_hosts=False,
        network_mode="NONE",
        purpose="STRUCTURAL_RECONSTRUCTION",
    )


@dataclass(frozen=True)
class ExampleComGrant:
    """Explicit permission to fetch https://example.com/ once.

    Constructing this object is the grant. Passing None is not a grant.
    The URL cannot be changed.
    """

    grant_id: str

    def __post_init__(self) -> None:
        grant_id = str(self.grant_id).strip()
        if not grant_id:
            raise ValueError("grant_id must be a non-empty string")
        object.__setattr__(self, "grant_id", grant_id)


@dataclass(frozen=True)
class ScopedAcquisitionReceipt:
    """What a scoped fetch actually returned. Inference is always NONE."""

    status: str
    http_status: int | None
    digest: str | None
    fetched_at: str | None
    final_url: str | None
    observed_text: str | None
    inference: str
    executed: bool
    recovered_source: bool
    network_performed: bool
    product_live_url_reconstruction: str
    scoped_label: str | None
    reason: str | None
    retained_bytes: bytes
    truncated: bool
    isolation_executable: str | None

    def __post_init__(self) -> None:
        status = str(self.status)
        if status not in {"REFUSED", "SCOPED", "UNKNOWN"}:
            raise ValueError("scoped status must be REFUSED, SCOPED, or UNKNOWN")
        object.__setattr__(self, "status", status)
        object.__setattr__(self, "executed", False)
        object.__setattr__(self, "recovered_source", False)
        object.__setattr__(self, "inference", "NONE")
        object.__setattr__(self, "product_live_url_reconstruction", PRODUCT_LIVE_URL_RECONSTRUCTION)
        object.__setattr__(self, "retained_bytes", bytes(self.retained_bytes))
        if status != "SCOPED":
            object.__setattr__(self, "scoped_label", None)
        else:
            object.__setattr__(self, "scoped_label", SCOPED_LABEL)
            if self.network_performed is not True:
                raise ValueError("SCOPED requires network_performed")
            if not self.digest or not str(self.digest).startswith("sha256:"):
                raise ValueError("SCOPED requires a sha256 digest of retained bytes")
            if self.final_url != SCOPED_URL:
                raise ValueError("SCOPED final_url must be https://example.com/")
            if self.http_status is None:
                raise ValueError("SCOPED requires an HTTP status")
            if not self.fetched_at:
                raise ValueError("SCOPED requires a timestamp")
        if status == "REFUSED":
            object.__setattr__(self, "network_performed", False)
            object.__setattr__(self, "digest", None)
            object.__setattr__(self, "retained_bytes", b"")
            object.__setattr__(self, "http_status", None)
            object.__setattr__(self, "final_url", None)
            object.__setattr__(self, "fetched_at", None)

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "http_status": self.http_status,
            "digest": self.digest,
            "fetched_at": self.fetched_at,
            "final_url": self.final_url,
            "observed_text": self.observed_text,
            "inference": "NONE",
            "executed": False,
            "recovered_source": False,
            "network_performed": self.network_performed,
            "product_live_url_reconstruction": PRODUCT_LIVE_URL_RECONSTRUCTION,
            "scoped_label": self.scoped_label,
            "reason": self.reason,
            "retained_byte_length": len(self.retained_bytes),
            "truncated": self.truncated,
            "isolation_executable": self.isolation_executable,
        }


def visible_text(html: str) -> str:
    """Text left after active-content blocks are removed. Not an interpretation."""

    without_active = _STYLE_BLOCK.sub(" ", _SCRIPT_BLOCK.sub(" ", html))
    return _SPACE.sub(" ", _TAG.sub(" ", without_active)).strip()


def observe_untrusted_html(
    html: str,
    *,
    captured_at: str = "2026-10-04T00:00:00Z",
    authorization_id: str = "untrusted-html-data",
) -> WebReconstructionContract:
    """Hand an already-held body to the existing X-Ray parser. No socket."""

    return build_reconstruction_contract(
        url=SCOPED_URL,
        authorization=_example_authorization(authorization_id),
        html=html,
        captured_at=captured_at,
    )


def _refuse(reason: str) -> ScopedAcquisitionReceipt:
    return ScopedAcquisitionReceipt(
        status="REFUSED",
        http_status=None,
        digest=None,
        fetched_at=None,
        final_url=None,
        observed_text=None,
        inference="NONE",
        executed=False,
        recovered_source=False,
        network_performed=False,
        product_live_url_reconstruction=PRODUCT_LIVE_URL_RECONSTRUCTION,
        scoped_label=None,
        reason=reason,
        retained_bytes=b"",
        truncated=False,
        isolation_executable=None,
    )


def _unknown(reason: str, *, network_performed: bool) -> ScopedAcquisitionReceipt:
    return ScopedAcquisitionReceipt(
        status="UNKNOWN",
        http_status=None,
        digest=None,
        fetched_at=None,
        final_url=None,
        observed_text=None,
        inference="NONE",
        executed=False,
        recovered_source=False,
        network_performed=network_performed,
        product_live_url_reconstruction=PRODUCT_LIVE_URL_RECONSTRUCTION,
        scoped_label=None,
        reason=reason,
        retained_bytes=b"",
        truncated=False,
        isolation_executable=None,
    )


def _stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _digest(payload: bytes) -> str:
    return "sha256:" + hashlib.sha256(payload).hexdigest()


def _bounded(timeout_seconds: float, max_bytes: int) -> tuple[float, int] | None:
    try:
        timeout = float(timeout_seconds)
        limit = int(max_bytes)
    except (TypeError, ValueError):
        return None
    if timeout <= 0 or timeout > SCOPED_TIMEOUT_SECONDS:
        return None
    if limit < 1 or limit > SCOPED_MAX_BYTES:
        return None
    return timeout, limit


def acquire_scoped_example(
    grant: ExampleComGrant | None,
    *,
    timeout_seconds: float = SCOPED_TIMEOUT_SECONDS,
    max_bytes: int = SCOPED_MAX_BYTES,
) -> ScopedAcquisitionReceipt:
    """Fetch https://example.com/ only when `grant` is an ExampleComGrant.

    No grant, a non-grant object, or a URL the existing boundary refuses
    returns REFUSED and does not open a socket. Transport failure is UNKNOWN
    with no digest.
    """

    if grant is None or not isinstance(grant, ExampleComGrant):
        return _refuse("NO_GRANT")
    bounds = _bounded(timeout_seconds, max_bytes)
    if bounds is None:
        return _refuse("BOUNDS_REFUSED")
    timeout, limit = bounds
    decision = decide_acquisition(SCOPED_URL, _example_authorization(grant.grant_id))
    if decision.status != "ALLOW_CAPTURE" or decision.url_identity != SCOPED_URL:
        return _refuse("URL_BOUNDARY_REFUSED")
    if decision.network_performed:
        return _refuse("DECISION_CLAIMED_NETWORK")

    try:
        connection = http.client.HTTPSConnection(
            SCOPED_HOST,
            port=443,
            timeout=timeout,
            context=ssl.create_default_context(),
        )
        try:
            connection.request(
                "GET",
                "/",
                body=None,
                headers={
                    "Host": SCOPED_HOST,
                    "Accept": "text/html",
                    "User-Agent": "SPE-WebRecon-scoped-example/1",
                    "Connection": "close",
                },
            )
            response = connection.getresponse()
            http_status = int(response.status)
            location = response.getheader("Location")
            raw = response.read(limit + 1)
        finally:
            connection.close()
    except (http.client.HTTPException, TimeoutError, OSError, ssl.SSLError):
        return _unknown("FETCH_FAILED", network_performed=True)

    if http_status in {301, 302, 303, 307, 308}:
        return _unknown("REDIRECT_NOT_FOLLOWED", network_performed=True)
    if location:
        return _unknown("REDIRECT_NOT_FOLLOWED", network_performed=True)
    if not 200 <= http_status <= 299:
        return _unknown("HTTP_STATUS_NOT_SUCCESS", network_performed=True)

    truncated = len(raw) > limit
    retained = raw[:limit]
    if not retained:
        return _unknown("EMPTY_RESPONSE", network_performed=True)
    fetched_at = _stamp()
    decoded = retained.decode("utf-8", errors="replace")
    contract = observe_untrusted_html(
        decoded,
        captured_at=fetched_at,
        authorization_id=grant.grant_id,
    )
    isolation = None
    if contract.xray is not None:
        isolation = contract.xray.isolation.executable_content
    observed = visible_text(decoded)
    return ScopedAcquisitionReceipt(
        status="SCOPED",
        http_status=http_status,
        digest=_digest(retained),
        fetched_at=fetched_at,
        final_url=SCOPED_URL,
        observed_text=observed,
        inference="NONE",
        executed=False,
        recovered_source=False,
        network_performed=True,
        product_live_url_reconstruction=PRODUCT_LIVE_URL_RECONSTRUCTION,
        scoped_label=SCOPED_LABEL,
        reason=None if not truncated else "RESPONSE_TRUNCATED",
        retained_bytes=retained,
        truncated=truncated,
        isolation_executable=isolation,
    )
