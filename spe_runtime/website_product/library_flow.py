"""Measured library journey for R3-D.

Browser UI code cannot import these packages. Tests call this module.
Nothing here opens a socket.
"""

from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path
from typing import Any

from spe_runtime.webrecon import (
    AcquisitionAuthorization,
    build_reconstruction_contract,
    decide_acquisition,
)
from spe_runtime.webrecon.isolation import sanitize_css

AI_GENERATION = "NOT_AVAILABLE"
SCENE_3D = "NOT_AVAILABLE"
LIVE_URL_RECONSTRUCTION = "NOT_AVAILABLE"
HOSTED_PUBLISH = "HOLD"
SCENE_IR_WIRED = False

_ACTIVE = re.compile(
    r"<\s*script\b|javascript\s*:|vbscript\s*:|<\s*iframe\b|<\s*object\b|<\s*embed\b|\son[a-z]+\s*=",
    re.IGNORECASE,
)
_REMOTE = re.compile(r"https?://", re.IGNORECASE)
_STYLE = re.compile(r"<style[^>]*>(.*?)</style>", re.IGNORECASE | re.DOTALL)

_NO_GRANT = AcquisitionAuthorization(
    authorization_id="r3d-no-grant",
    allowed_hosts=("reconstruction.invalid",),
    allowed_schemes=("https",),
)


def _labels() -> dict[str, Any]:
    return {
        "ai_generation": AI_GENERATION,
        "scene_3d": SCENE_3D,
        "live_url_reconstruction": LIVE_URL_RECONSTRUCTION,
        "hosted_publish": HOSTED_PUBLISH,
        "scene_ir_wired": SCENE_IR_WIRED,
        "network_performed": False,
        "fetched": False,
        "local_saved_html_is_live_url": False,
    }


def _generator():
    root = Path(__file__).resolve().parents[2] / "packages" / "website-generator"
    entry = str(root)
    if entry not in sys.path:
        sys.path.insert(0, entry)
    from website_generator import compile_site, hosted_export, parse_spec, sandbox_preview
    from website_generator.errors import WebsiteSpecError

    return compile_site, hosted_export, parse_spec, sandbox_preview, WebsiteSpecError


def assess_live_url(url: str) -> dict[str, Any]:
    """Refuse a URL. This does not fetch, even if the URL would otherwise parse."""

    decision = decide_acquisition(url, _NO_GRANT)
    return {
        **_labels(),
        "status": "REFUSED",
        "source_kind": "live_url",
        "acquisition_status": decision.status,
        "reason_codes": list(decision.reason_codes),
        "authorization_id": decision.authorization_id,
    }


def observe_attached_capture(
    *,
    url: str,
    html: str,
    authorization: AcquisitionAuthorization,
    captured_at: str,
) -> dict[str, Any]:
    """Structural contract from an already held capture. Not a live fetch."""

    decision = decide_acquisition(url, authorization)
    contract = build_reconstruction_contract(
        url=url,
        authorization=authorization,
        html=html,
        captured_at=captured_at,
    )
    webgl_executed = None
    if contract.xray is not None:
        webgl_executed = contract.xray.webgl.executed
    return {
        **_labels(),
        "status": "ATTACHED_CAPTURE_OBSERVED",
        "source_kind": "attached_capture",
        "acquisition_status": decision.status,
        "contract_status": contract.status,
        "contract_network_performed": contract.network_performed,
        "webgl_executed": webgl_executed,
        "live_url_reconstruction": LIVE_URL_RECONSTRUCTION,
    }


def assess_local_saved_html(filename: str, html: str) -> dict[str, Any]:
    """A saved file is not a URL and is not replayed as a site."""

    reasons: list[str] = []
    if not filename.strip() or not html.strip():
        reasons.append("LOCAL_DOCUMENT_EMPTY")
    if _ACTIVE.search(html) or _REMOTE.search(html):
        reasons.append("MALICIOUS_OR_REMOTE_MARKUP_REFUSED")
    quarantine: list[str] = []
    for index, style in enumerate(_STYLE.findall(html)):
        _cleaned, events = sanitize_css(style, source=f"{filename}#style-{index}")
        quarantine.extend(event.kind for event in events)
    if quarantine:
        reasons.append("CSS_ACTIVE_CONTENT_QUARANTINED")
    status = "REJECTED" if reasons else "REFUSED"
    if status == "REFUSED":
        reasons.append("LOCAL_SAVED_HTML_IS_NOT_A_SPEC")
        reasons.append("RAW_DOCUMENT_NOT_REPLAYED")
    return {
        **_labels(),
        "status": status,
        "source_kind": "local_saved_html",
        "reasons": reasons,
        "css_quarantine_kinds": quarantine,
        "preview_html": None,
    }


def compile_spec(spec: dict[str, Any]) -> dict[str, Any]:
    """Reuse website-generator. File production is not an AI or 3D pass."""

    compile_site, hosted_export, parse_spec, sandbox_preview, website_spec_error = _generator()
    try:
        parsed = parse_spec(spec)
        first = compile_site(parsed)
        second = compile_site(parsed)
    except website_spec_error as exc:
        return {
            **_labels(),
            "status": "REJECTED",
            "source_kind": "website_spec",
            "reasons": [str(exc)],
            "preview_html": None,
        }
    files = first.as_map()
    if files != second.as_map():
        return {
            **_labels(),
            "status": "REJECTED",
            "source_kind": "website_spec",
            "reasons": ["EXPORT_NOT_DETERMINISTIC"],
            "preview_html": None,
        }
    page = files.get("index.html", "")
    css = files.get("assets/site.css", "")
    if "<script" in page.lower():
        return {
            **_labels(),
            "status": "REJECTED",
            "source_kind": "website_spec",
            "reasons": ["SCRIPT_ELEMENT_REFUSED"],
            "preview_html": None,
        }
    hosted = hosted_export(parsed)
    sandbox = sandbox_preview(parsed)
    digest = hashlib.sha256(page.encode("utf-8")).hexdigest()
    return {
        **_labels(),
        "status": "LOCAL_EXPORT_READY",
        "source_kind": "website_spec",
        "reasons": ["STATIC_FILES_ONLY"],
        "export_sha256": digest,
        "reduced_motion": "prefers-reduced-motion" in css,
        "content_security_policy": 'http-equiv="Content-Security-Policy"' in page,
        "hosted_export_status": hosted.status,
        "hosted_export_passed": hosted.passed,
        "sandbox_status": sandbox.status,
        "sandbox_passed": sandbox.passed,
        "generator_network_mode": first.network_mode,
        "generator_hosted": first.hosted,
    }
