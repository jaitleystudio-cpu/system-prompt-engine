"""Reconstruction contract.

Output boundary: authorized URL + captured site → WebsiteXRay → WebReconstructionContract.
The contract says what may be rebuilt from observations. It does not mint authority,
assign a semantic category, score quality, or call K3.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from spe_runtime.webrecon.acquisition import (
    AcquisitionAuthorization,
    AcquisitionDecision,
    decide_acquisition,
)
from spe_runtime.webrecon.assets import Asset, resolve_reference
from spe_runtime.webrecon.css_scan import scan_stylesheets
from spe_runtime.webrecon.digest import digest_json, digest_text
from spe_runtime.webrecon.html_css import (
    CustomProperty,
    DocumentMetadata,
    HtmlParse,
    parse_html,
)
from spe_runtime.webrecon.interactions import Interaction
from spe_runtime.webrecon.isolation import (
    IsolatedSidecar,
    IsolationError,
    IsolationReport,
    QuarantineEvent,
    isolate_sidecar,
    sanitize_css,
)
from spe_runtime.webrecon.layout import LayoutNode
from spe_runtime.webrecon.limits import ObservationLimits
from spe_runtime.webrecon.motion import CameraObservation, MotionDescription, unobserved_camera
from spe_runtime.webrecon.reasons import ReasonCode
from spe_runtime.webrecon.typography import TypographyHint, tokens_from_hints
from spe_runtime.webrecon.webgl import WebGlObservation
from spe_runtime.webrecon.xray import IR_ID, WebsiteXRay

CONTRACT_ID = "spe.webrecon.reconstruction-contract.v1"

LIMITATIONS = (
    "PARSER_IS_NOT_A_BROWSER",
    "NETWORK_NOT_PERFORMED",
    "NO_DNS_RESOLUTION",
    "SCRIPTS_NOT_EXECUTED",
    "WEBGL_NOT_EXECUTED",
    "NO_SEMANTIC_AUTHORITY",
    "FIELD_VALUES_OMITTED",
    "EXTERNAL_RESOURCES_NOT_FETCHED",
    "CSS_SCANNER_IS_CONSERVATIVE",
    "NO_HOST_WILDCARDS",
    "HOST_MATCH_IGNORES_PORT",
    "NO_K3_INTEGRATION",
)

PROHIBITIONS = (
    "DO_NOT_EXECUTE_SCRIPTS",
    "DO_NOT_EXECUTE_WEBGL",
    "DO_NOT_FETCH_NETWORK",
    "DO_NOT_MINT_AUTHORITY",
    "DO_NOT_ASSIGN_SEMANTIC_CATEGORY",
    "DO_NOT_FILL_UNOBSERVED",
    "DO_NOT_INTEGRATE_K3",
    "DO_NOT_CLAIM_QUALITY_SCORE",
    "DO_NOT_PROMOTE_TO_VERIFIED",
    "DO_NOT_REPLAY_RAW_DOCUMENT",
    "DO_NOT_CARRY_FIELD_VALUES",
    "DO_NOT_CARRY_QUARANTINED_SOURCE",
)

OBLIGATIONS = (
    "REBUILD_OBSERVED_LAYOUT_ONLY",
    "PRESERVE_TYPOGRAPHY_TOKENS",
    "PRESERVE_ASSET_INVENTORY",
    "PRESERVE_BREAKPOINT_QUERIES",
    "PRESERVE_INTERACTION_INVENTORY",
    "PRESERVE_MOTION_AS_DESCRIBED",
    "PRESERVE_WEBGL_AS_UNEXECUTED_OBSERVATION",
    "KEEP_UNTRUSTED_TAINT",
    "PRESERVE_GAPS",
)

_SURFACES = (
    "METADATA",
    "ASSETS",
    "LAYOUT",
    "TYPOGRAPHY",
    "BREAKPOINTS",
    "INTERACTIONS",
    "MOTION",
    "WEBGL",
)
_SURFACE_GAPS = {
    "METADATA": frozenset({"META_CAP"}),
    "ASSETS": frozenset({"ASSET_CAP"}),
    "LAYOUT": frozenset({"LAYOUT_NODE_CAP", "LAYOUT_DEPTH_CAP"}),
    "TYPOGRAPHY": frozenset({"CSS_SHEET_OVER_LIMIT"}),
    "BREAKPOINTS": frozenset({"CSS_SHEET_OVER_LIMIT"}),
    "INTERACTIONS": frozenset({"INTERACTION_CAP"}),
    "MOTION": frozenset({"CSS_SHEET_OVER_LIMIT"}),
    "WEBGL": frozenset(),
}
_ASSET_EXT = {
    ".css": "STYLESHEET",
    ".woff": "FONT",
    ".woff2": "FONT",
    ".ttf": "FONT",
    ".otf": "FONT",
    ".js": "SCRIPT",
    ".mjs": "SCRIPT",
    ".mp4": "VIDEO",
    ".webm": "VIDEO",
    ".mp3": "AUDIO",
    ".wav": "AUDIO",
    ".png": "IMAGE",
    ".jpg": "IMAGE",
    ".jpeg": "IMAGE",
    ".gif": "IMAGE",
    ".svg": "IMAGE",
    ".webp": "IMAGE",
    ".ico": "ICON",
}


@dataclass(frozen=True)
class FidelityItem:
    surface: str
    coverage: str
    gap_codes: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "surface": self.surface,
            "coverage": self.coverage,
            "gap_codes": list(self.gap_codes),
        }


@dataclass(frozen=True)
class WebReconstructionContract:
    """What a reconstructor may build from one X-Ray, and what it must not do."""

    contract_id: str
    status: str
    reason_codes: tuple[str, ...]
    limitations: tuple[str, ...]
    obligations: tuple[str, ...]
    prohibitions: tuple[str, ...]
    fidelity: tuple[FidelityItem, ...]
    gaps: tuple[str, ...]
    xray: WebsiteXRay | None
    semantic_authority: str
    network_performed: bool
    k3_integrated: bool

    def __post_init__(self) -> None:
        if self.contract_id != CONTRACT_ID:
            raise ValueError(f"contract_id must be {CONTRACT_ID}")
        if self.status not in {"CONTRACT_READY", "REFUSE", "INCOMPLETE"}:
            raise ValueError("contract status is not a v1 value")
        if self.status == "CONTRACT_READY" and self.xray is None:
            raise ValueError("CONTRACT_READY requires an xray")
        if self.status == "REFUSE" and self.xray is not None:
            raise ValueError("REFUSE does not carry an xray")
        if self.status == "REFUSE" and not self.reason_codes:
            raise ValueError("REFUSE requires a reason code")
        if self.status == "CONTRACT_READY" and self.reason_codes:
            raise ValueError("CONTRACT_READY does not carry refusal reasons")
        object.__setattr__(self, "semantic_authority", "NONE")
        object.__setattr__(self, "network_performed", False)
        object.__setattr__(self, "k3_integrated", False)
        object.__setattr__(self, "limitations", LIMITATIONS)
        object.__setattr__(self, "prohibitions", PROHIBITIONS)

    def to_dict(self) -> dict[str, Any]:
        return {
            "contract_id": self.contract_id,
            "status": self.status,
            "reason_codes": list(self.reason_codes),
            "limitations": list(self.limitations),
            "obligations": list(self.obligations),
            "prohibitions": list(self.prohibitions),
            "fidelity": [item.to_dict() for item in self.fidelity],
            "gaps": list(self.gaps),
            "xray": None if self.xray is None else self.xray.to_dict(),
            "semantic_authority": "NONE",
            "network_performed": False,
            "k3_integrated": False,
        }


def _refuse(
    decision: AcquisitionDecision | None,
    reasons: tuple[str, ...],
) -> WebReconstructionContract:
    del decision
    return WebReconstructionContract(
        contract_id=CONTRACT_ID,
        status="REFUSE",
        reason_codes=reasons,
        limitations=LIMITATIONS,
        obligations=(),
        prohibitions=PROHIBITIONS,
        fidelity=(),
        gaps=(),
        xray=None,
        semantic_authority="NONE",
        network_performed=False,
        k3_integrated=False,
    )


def _capture_size(html: str, css: tuple[str, ...]) -> int:
    total = len(html.encode("utf-8"))
    for sheet in css:
        total += len(sheet.encode("utf-8"))
    return total


def _captured_at(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise IsolationError("WR_CAPTURED_AT_INVALID", "captured_at must be a string")
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in value) or len(value) > 64:
        raise IsolationError("WR_CAPTURED_AT_INVALID", "captured_at is invalid")
    return value


def _asset_kind(url: str) -> str:
    path = url.split("?", 1)[0].split("#", 1)[0].lower()
    for ext, kind in _ASSET_EXT.items():
        if path.endswith(ext):
            return kind
    return "OTHER"


def _assert_layout_safe(node: LayoutNode) -> None:
    for attr in node.attributes:
        if attr.name == "value" or (attr.name.startswith("on") and len(attr.name) > 2):
            raise RuntimeError(f"unsafe layout attribute survived isolation: {attr.name}")
    for child in node.children:
        _assert_layout_safe(child)


def _fidelity(gaps: tuple[str, ...]) -> tuple[FidelityItem, ...]:
    present = set(gaps)
    items: list[FidelityItem] = []
    for surface in _SURFACES:
        codes = tuple(code for code in gaps if code in _SURFACE_GAPS[surface])
        coverage = "PARTIAL" if present & _SURFACE_GAPS[surface] else "OBSERVED"
        items.append(FidelityItem(surface=surface, coverage=coverage, gap_codes=codes))
    return tuple(items)


def _assemble(
    *,
    html: str,
    css: tuple[str, ...],
    page_url: str,
    authorization: AcquisitionAuthorization,
    decision: AcquisitionDecision,
    captured_at: str | None,
    sidecar: IsolatedSidecar,
    limits: ObservationLimits,
    parse: HtmlParse,
    sheets: tuple[tuple[str, str], ...],
    events: tuple[QuarantineEvent, ...],
    gaps: tuple[str, ...],
) -> WebsiteXRay:
    scan = scan_stylesheets(sheets)
    hints: list[TypographyHint] = list(scan.typography)
    for raw in parse.inline_font_hints:
        hints.append(
            TypographyHint(
                font_family=raw.get("font_family"),
                font_size=raw.get("font_size"),
                font_weight=raw.get("font_weight"),
                line_height=raw.get("line_height"),
                letter_spacing=raw.get("letter_spacing"),
                font_shorthand=raw.get("font_shorthand"),
                source=str(raw.get("source") or "inline-style"),
            )
        )
    hints.extend(sidecar.typography)
    typography = tokens_from_hints(tuple(hints))

    assets: list[Asset] = []
    seen: set[str] = set()
    for ref in parse.asset_refs:
        if len(assets) >= limits.max_assets:
            break
        if ref.declared_ref in {"inline", "data:"}:
            resolved, host, same = None, None, False
        else:
            resolved, host, same = resolve_reference(page_url, ref.declared_ref)
        key = f"{ref.kind}|{ref.declared_ref}|{ref.node_id}"
        if key in seen:
            continue
        seen.add(key)
        assets.append(
            Asset(
                asset_id=f"asset:{len(assets)}",
                kind=ref.kind,
                declared_ref=ref.declared_ref,
                resolved_ref=resolved,
                host=host,
                same_document=same,
                fetch_status=ref.fetch_status,
                execution=ref.execution,
                integrity=ref.integrity,
                digest=ref.digest,
            )
        )
    for url_ref in scan.urls:
        if len(assets) >= limits.max_assets:
            if "ASSET_CAP" not in gaps:
                gaps = (*gaps, "ASSET_CAP")
            break
        kind = _asset_kind(url_ref.declared_ref)
        key = f"{kind}|{url_ref.declared_ref}|css"
        if key in seen:
            continue
        seen.add(key)
        resolved, host, same = resolve_reference(page_url, url_ref.declared_ref)
        assets.append(
            Asset(
                asset_id=f"asset:{len(assets)}",
                kind=kind,
                declared_ref=url_ref.declared_ref,
                resolved_ref=resolved,
                host=host,
                same_document=same,
                fetch_status="NOT_FETCHED",
                execution="FORBIDDEN" if kind == "SCRIPT" else "NOT_APPLICABLE",
                integrity=None,
                digest=None,
            )
        )

    interactions = list(parse.interactions)
    for selector, states in scan.pseudo_selectors:
        if len(interactions) >= limits.max_interactions:
            if "INTERACTION_CAP" not in gaps:
                gaps = (*gaps, "INTERACTION_CAP")
            break
        interactions.append(
            Interaction(
                kind="PSEUDO_STATE",
                node_id=None,
                target=selector[:200],
                method=None,
                fields=(),
                states_observed=states,
                neutralized=False,
            )
        )

    if sidecar.camera is not None or parse.camera_declared:
        hint = sidecar.camera
        kind = None
        if hint is not None and hint.kind:
            kind = hint.kind
        elif parse.camera_declared:
            kind = parse.camera_declared[0]
        camera = CameraObservation(
            status="DECLARED",
            kind=kind,
            position=() if hint is None else hint.position,
            target=() if hint is None else hint.target,
            fov=None if hint is None else hint.fov,
            near=None if hint is None else hint.near,
            far=None if hint is None else hint.far,
            notes=None if hint is None else hint.notes,
        )
    else:
        camera = unobserved_camera()
    motion = MotionDescription(
        scroll=scan.scroll,
        animations=scan.animations,
        transitions=scan.transitions,
        camera=camera,
    )

    library_hints = list(parse.script_hints)
    if sidecar.webgl is not None:
        for name in sidecar.webgl.library_declared:
            if name not in library_hints:
                library_hints.append(name)
        webgl = WebGlObservation(
            status="STRUCTURED_OBSERVATION",
            canvas_count=parse.canvas_count,
            library_hints=tuple(library_hints),
            renderer=sidecar.webgl.renderer,
            camera_count=sidecar.webgl.camera_count,
            light_count=sidecar.webgl.light_count,
            object_count=sidecar.webgl.object_count,
            executed=False,
            notes=sidecar.webgl.notes,
        )
    elif parse.canvas_count or library_hints:
        webgl = WebGlObservation(
            status="DECLARED_UNEXECUTED",
            canvas_count=parse.canvas_count,
            library_hints=tuple(library_hints),
            renderer=None,
            camera_count=None,
            light_count=None,
            object_count=None,
            executed=False,
            notes=None,
        )
    else:
        webgl = WebGlObservation(
            status="ABSENT",
            canvas_count=0,
            library_hints=(),
            renderer=None,
            camera_count=None,
            light_count=None,
            object_count=None,
            executed=False,
            notes=None,
        )

    seed = parse.metadata_seed
    metadata = DocumentMetadata(
        doctype=seed["doctype"],
        html_lang=seed["html_lang"],
        charset=seed["charset"],
        title=seed["title"],
        viewport=seed["viewport"],
        base_href=seed["base_href"],
        meta=seed["meta"],
        stylesheet_links=seed["stylesheet_links"],
        inline_style_block_count=seed["inline_style_block_count"],
        custom_properties=tuple(
            CustomProperty(name=name, value=value, source=source)
            for name, value, source in scan.custom_properties
        ),
    )
    _assert_layout_safe(parse.layout)

    labels = ["UNTRUSTED_DOCUMENT"]
    if any(event.kind.startswith("SCRIPT") or event.kind == "EVENT_HANDLER" for event in events):
        labels.append("SCRIPT_QUARANTINED")
    if any(event.kind.startswith("CSS_") or event.kind == "JAVASCRIPT_URL" for event in events):
        labels.append("ACTIVE_CONTENT_STRIPPED")
    css_text = "\n".join(sheet for _, sheet in sheets)
    isolation = IsolationReport(
        taint_labels=tuple(labels),
        events=events,
        executable_content="QUARANTINED",
        parser="HTML_PARSER_DATA_ONLY",
        sanitized_css_digest=digest_text(css_text),
    )
    document_digest = digest_json({"css": list(css), "html": html})
    observation_id = digest_json(
        {
            "authorization_id": authorization.authorization_id,
            "captured_at": captured_at,
            "document_digest": document_digest,
            "ir_id": IR_ID,
            "limits": limits.to_dict(),
            "url_identity": decision.url_identity,
        }
    )
    ordered_gaps = tuple(dict.fromkeys(gaps))
    return WebsiteXRay(
        ir_id=IR_ID,
        observation_id=observation_id,
        source_url=page_url,
        url_identity=decision.url_identity or page_url,
        fragment=decision.fragment,
        authorization_id=authorization.authorization_id,
        captured_at=captured_at,
        document_digest=document_digest,
        semantic_authority="NONE",
        network_performed=False,
        isolation=isolation,
        metadata=metadata,
        assets=tuple(assets),
        layout=parse.layout,
        typography=typography,
        breakpoints=scan.breakpoints,
        interactions=tuple(interactions),
        motion=motion,
        webgl=webgl,
        gaps=ordered_gaps,
        taint_labels=isolation.taint_labels,
    )


def build_reconstruction_contract(
    *,
    url: str,
    authorization: AcquisitionAuthorization,
    html: str | None = None,
    css: tuple[str, ...] | list[str] = (),
    captured_at: str | None = None,
    sidecar: Mapping[str, Any] | None = None,
    limits: ObservationLimits | None = None,
) -> WebReconstructionContract:
    """Build the reconstruction contract for one authorized capture.

    No network I/O is performed. `html` must already be in hand.
    """

    sheets_in = tuple(str(sheet) for sheet in css)
    decision = decide_acquisition(url, authorization)
    if decision.status != "ALLOW_CAPTURE":
        return _refuse(decision, decision.reason_codes)
    if html is None:
        return _refuse(decision, (ReasonCode.CAPTURE_REQUIRED.value,))
    if not isinstance(html, str):
        raise TypeError("html must be a string or None")
    if not html.strip():
        return _refuse(decision, (ReasonCode.EMPTY_DOCUMENT.value,))

    try:
        stamp = _captured_at(captured_at)
        isolated = isolate_sidecar(sidecar)
    except IsolationError as exc:
        code = exc.code
        if code not in {item.value for item in ReasonCode}:
            code = ReasonCode.SIDECAR_INVALID.value
        return _refuse(decision, (code,))

    bounds = limits or ObservationLimits()
    if _capture_size(html, sheets_in) > authorization.max_capture_bytes:
        return _refuse(decision, (ReasonCode.CAPTURE_TOO_LARGE.value,))
    if len(html) > bounds.max_html_chars:
        return WebReconstructionContract(
            contract_id=CONTRACT_ID,
            status="INCOMPLETE",
            reason_codes=(ReasonCode.OBSERVATION_TRUNCATED.value,),
            limitations=LIMITATIONS,
            obligations=(),
            prohibitions=PROHIBITIONS,
            fidelity=(),
            gaps=("HTML_OVER_OBSERVATION_LIMIT",),
            xray=None,
            semantic_authority="NONE",
            network_performed=False,
            k3_integrated=False,
        )

    page_url = decision.url_identity or url
    parse = parse_html(html, page_url=page_url, limits=bounds)
    events = list(parse.events)
    events.extend(isolated.events)
    gaps = list(parse.gaps)
    truncated = parse.truncated
    sheets: list[tuple[str, str]] = list(parse.style_sheets)
    for index, sheet in enumerate(sheets_in):
        if len(sheet) > bounds.max_css_chars:
            gaps.append("CSS_SHEET_OVER_LIMIT")
            truncated = True
            continue
        sanitized, css_events = sanitize_css(sheet, source=f"css:{index}")
        events.extend(css_events)
        sheets.append((f"css:{index}", sanitized))

    xray = _assemble(
        html=html,
        css=sheets_in,
        page_url=page_url,
        authorization=authorization,
        decision=decision,
        captured_at=stamp,
        sidecar=isolated,
        limits=bounds,
        parse=parse,
        sheets=tuple(sheets),
        events=tuple(events),
        gaps=tuple(gaps),
    )
    if xray.gaps:
        truncated = True
    status = "INCOMPLETE" if truncated else "CONTRACT_READY"
    reasons = (ReasonCode.OBSERVATION_TRUNCATED.value,) if truncated else ()
    return WebReconstructionContract(
        contract_id=CONTRACT_ID,
        status=status,
        reason_codes=reasons,
        limitations=LIMITATIONS,
        obligations=OBLIGATIONS,
        prohibitions=PROHIBITIONS,
        fidelity=_fidelity(xray.gaps),
        gaps=xray.gaps,
        xray=xray,
        semantic_authority="NONE",
        network_performed=False,
        k3_integrated=False,
    )
