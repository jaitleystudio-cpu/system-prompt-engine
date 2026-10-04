"""R1 oracles for supplied-capture → Website X-Ray → ReconstructionContract.

Each check returns a list of failure strings. An empty list is a pass.
These functions do not fetch, do not execute active content, and do not
modify donor runtime. A failure here is donor evidence.
"""

from __future__ import annotations

import json
import socket
import urllib.request
from pathlib import Path
from typing import Callable
from urllib.parse import urlsplit

from spe_runtime.webrecon import (
    AcquisitionAuthorization,
    ObservationLimits,
    build_reconstruction_contract,
    decide_acquisition,
)

ROOT = Path(__file__).resolve().parents[2]
PAGE = "https://harbor.example/books"
STAMP = "2026-09-30T00:00:00Z"

Check = Callable[[], list[str]]


def _auth(**overrides: object) -> AcquisitionAuthorization:
    values: dict[str, object] = {
        "authorization_id": "auth-r1",
        "allowed_hosts": ("harbor.example",),
        "allowed_schemes": ("https",),
        "max_capture_bytes": 200_000,
    }
    values.update(overrides)
    return AcquisitionAuthorization(**values)  # type: ignore[arg-type]


def _build(html: str, **overrides: object):
    values: dict[str, object] = {
        "url": PAGE,
        "authorization": _auth(),
        "html": html,
        "captured_at": STAMP,
    }
    values.update(overrides)
    return build_reconstruction_contract(**values)  # type: ignore[arg-type]


def _dump(contract) -> str:
    return json.dumps(contract.to_dict(), sort_keys=True)


def _tags(node, acc: list[str]) -> None:
    acc.append(node.tag)
    for child in node.children:
        _tags(child, acc)


def _ids(node, acc: list[str]) -> None:
    for attr in node.attributes:
        if attr.name == "id":
            acc.append(attr.value)
    for child in node.children:
        _ids(child, acc)


def network_none_and_no_socket() -> list[str]:
    failures: list[str] = []
    tripped: list[str] = []
    orig_socket = socket.socket
    orig_urlopen = urllib.request.urlopen

    def _socket(*_args: object, **_kwargs: object) -> socket.socket:
        tripped.append("socket")
        raise RuntimeError("NETWORK socket")

    def _urlopen(*_args: object, **_kwargs: object) -> object:
        tripped.append("urlopen")
        raise RuntimeError("NETWORK urlopen")

    socket.socket = _socket  # type: ignore[misc, assignment]
    urllib.request.urlopen = _urlopen  # type: ignore[assignment]
    try:
        contract = _build(
            "<a href='https://evil.example/land'>x</a>"
            "<meta http-equiv='refresh' content='0;url=https://evil.example/refresh'>"
            "<link rel='stylesheet' href='https://cdn.example/app.css'>"
        )
    except Exception as exc:  # noqa: BLE001 — qualification records the failure
        failures.append(f"NETWORK: build raised {type(exc).__name__}: {exc}")
        return failures
    finally:
        socket.socket = orig_socket  # type: ignore[misc]
        urllib.request.urlopen = orig_urlopen

    if tripped:
        failures.append(f"NETWORK: live acquisition attempted: {tripped}")
    if contract.network_performed is not False:
        failures.append("NETWORK: network_performed attribute is not false")
    if contract.to_dict()["network_performed"] is not False:
        failures.append("NETWORK: network_performed in the contract dict is not false")
    if contract.xray is None:
        failures.append("NETWORK: capture produced no xray")
        return failures
    if contract.xray.network_performed is not False:
        failures.append("NETWORK: xray.network_performed is not false")
    for asset in contract.xray.assets:
        if asset.fetch_status not in {"NOT_FETCHED", "INLINE", "QUARANTINED"}:
            failures.append(f"NETWORK: asset {asset.declared_ref} status {asset.fetch_status}")
        if asset.host == "evil.example" and asset.fetch_status != "NOT_FETCHED":
            failures.append(f"NETWORK: fetched {asset.declared_ref}")
    return failures


def live_redirect_script_modes_refused() -> list[str]:
    failures: list[str] = []
    allowed = _auth()
    none = decide_acquisition(PAGE, allowed)
    if none.status != "ALLOW_CAPTURE" or none.network_performed is not False:
        failures.append(f"NETWORK: network_mode NONE was not accepted: {none.status} {none.reason_codes}")
    for mode in ("LIVE", "REDIRECT", "SCRIPT", "FETCH"):
        decision = decide_acquisition(PAGE, _auth(network_mode=mode))
        if decision.status != "REFUSE" or "WR_NETWORK_NOT_AUTHORIZED" not in decision.reason_codes:
            failures.append(f"NETWORK: mode {mode} was not refused: {decision.status} {decision.reason_codes}")
        if decision.network_performed is not False or decision.to_dict()["network_performed"] is not False:
            failures.append(f"NETWORK: mode {mode} set network_performed")
    return failures


def unsafe_schemes_and_credentials_refused() -> list[str]:
    failures: list[str] = []
    cases = {
        "javascript:alert(1)": "WR_SCHEME_REFUSED",
        "file:///etc/passwd": "WR_SCHEME_REFUSED",
        "data:text/html,hi": "WR_SCHEME_REFUSED",
        "https://user:pw@harbor.example/a": "WR_CREDENTIALS_IN_URL",
        "https://other.example/a": "WR_HOST_NOT_ALLOWLISTED",
    }
    for url, code in cases.items():
        decision = decide_acquisition(url, _auth())
        if decision.status != "REFUSE" or code not in decision.reason_codes:
            failures.append(f"URL_SAFETY: {url} -> {decision.status} {decision.reason_codes}, expected {code}")
        if decision.network_performed is not False:
            failures.append(f"URL_SAFETY: {url} performed network")
    return failures


def canonical_private_ips_refused() -> list[str]:
    failures: list[str] = []
    cases = (
        ("http://127.0.0.1/", "127.0.0.1", "http"),
        ("http://10.0.0.1/", "10.0.0.1", "http"),
        ("http://169.254.169.254/", "169.254.169.254", "http"),
        ("http://localhost/", "localhost", "http"),
        ("https://metadata.google.internal/", "metadata.google.internal", "https"),
        ("http://[::1]/", "::1", "http"),
    )
    for url, host, scheme in cases:
        auth = AcquisitionAuthorization(
            authorization_id="auth-private",
            allowed_hosts=(host,),
            allowed_schemes=(scheme,),
            allow_private_hosts=False,
        )
        decision = decide_acquisition(url, auth)
        if "WR_PRIVATE_HOST_REFUSED" not in decision.reason_codes or decision.status != "REFUSE":
            failures.append(f"URL_SAFETY: {url} -> {decision.status} {decision.reason_codes}")
    opted = AcquisitionAuthorization(
        authorization_id="auth-private-opt",
        allowed_hosts=("127.0.0.1",),
        allowed_schemes=("http",),
        allow_private_hosts=True,
    )
    opted_decision = decide_acquisition("http://127.0.0.1/x", opted)
    if opted_decision.network_performed is not False:
        failures.append("URL_SAFETY: private opt-in performed network")
    if opted_decision.status == "ALLOW_CAPTURE":
        contract = build_reconstruction_contract(
            url="http://127.0.0.1/x",
            authorization=opted,
            html="<p>local</p>",
            captured_at=STAMP,
        )
        if contract.semantic_authority != "NONE" or contract.to_dict()["semantic_authority"] != "NONE":
            failures.append("URL_SAFETY: private opt-in minted semantic authority")
        if contract.network_performed is not False:
            failures.append("URL_SAFETY: private opt-in set network_performed")
    return failures


def obfuscated_loopback_refused() -> list[str]:
    """Short, octal, and decimal loopback forms are private hosts."""

    failures: list[str] = []
    forms = ("http://127.1/", "http://0177.0.0.1/", "http://2130706433/")
    for url in forms:
        host = urlsplit(url).hostname or ""
        auth = AcquisitionAuthorization(
            authorization_id="auth-obfuscated",
            allowed_hosts=(host,),
            allowed_schemes=("http",),
            allow_private_hosts=False,
        )
        decision = decide_acquisition(url, auth)
        if decision.status != "REFUSE" or "WR_PRIVATE_HOST_REFUSED" not in decision.reason_codes:
            failures.append(
                "URL_SAFETY: obfuscated loopback gained capture authority: "
                f"{url} -> {decision.status} {decision.reason_codes} host={decision.host}"
            )
    return failures


def active_script_onclick_svg_form_not_executed() -> list[str]:
    html = """<svg>
      <script>SVG_SCRIPT_SECRET</script>
      <a href="javascript:SVG_JS_SECRET()" onclick="SVG_CLICK_SECRET()">x</a>
    </svg>
    <button onclick="ONCLICK_SECRET()">Go</button>
    <form action="javascript:FORMJS_SECRET()"><input name="a" value="INPUT_VALUE_SECRET"></form>
    <script>SCRIPT_BODY_SECRET</script>
    <style>.bad{background:expression(EXPRESSION_SECRET);behavior:url(BEHAVIOR_SECRET.htc)}</style>
    """
    contract = _build(html)
    rendered = _dump(contract)
    failures: list[str] = []
    for secret in (
        "SVG_SCRIPT_SECRET",
        "SVG_JS_SECRET",
        "SVG_CLICK_SECRET",
        "ONCLICK_SECRET",
        "FORMJS_SECRET",
        "SCRIPT_BODY_SECRET",
        "INPUT_VALUE_SECRET",
        "EXPRESSION_SECRET",
        "BEHAVIOR_SECRET",
    ):
        if secret in rendered:
            failures.append(f"ACTIVE_CONTENT: {secret} was copied into the contract")
    if contract.xray is None:
        return failures + ["ACTIVE_CONTENT: expected an xray for the quarantined document"]
    if contract.xray.isolation.executable_content != "QUARANTINED":
        failures.append("ACTIVE_CONTENT: executable_content is not QUARANTINED")
    if any(asset.execution not in {"FORBIDDEN", "NOT_APPLICABLE"} for asset in contract.xray.assets):
        failures.append("ACTIVE_CONTENT: an asset execution value is outside the closed set")
    scripts = [asset for asset in contract.xray.assets if asset.kind == "SCRIPT"]
    if not scripts or any(asset.execution != "FORBIDDEN" for asset in scripts):
        failures.append("ACTIVE_CONTENT: script asset is not execution FORBIDDEN")
    links = [item for item in contract.xray.interactions if item.kind == "LINK"]
    if not any(item.neutralized and item.target is None for item in links):
        failures.append("ACTIVE_CONTENT: javascript link was not neutralized")
    forms = [item for item in contract.xray.interactions if item.kind == "FORM"]
    if not any(item.neutralized and item.target is None for item in forms):
        failures.append("ACTIVE_CONTENT: javascript form action was not neutralized")
    details = {event.detail for event in contract.xray.isolation.events}
    for required in ("SCRIPT_BODY_WITHHELD", "EVENT_HANDLER_DROPPED", "JAVASCRIPT_URL_NEUTRALIZED"):
        if required not in details:
            failures.append(f"ACTIVE_CONTENT: missing quarantine event {required}")
    return failures


def css_javascript_url_not_activated() -> list[str]:
    contract = _build("<style>a{background:url(javascript:JSURL_SECRET)}</style>")
    rendered = _dump(contract)
    failures: list[str] = []
    if "JSURL_SECRET" in rendered:
        failures.append("ACTIVE_CONTENT: javascript CSS url residue JSURL_SECRET was copied and resolved")
    if contract.xray is not None:
        for asset in contract.xray.assets:
            if asset.same_document and asset.resolved_ref and "JSURL_SECRET" in asset.declared_ref:
                failures.append(f"ACTIVE_CONTENT: javascript URL became same-document asset {asset.resolved_ref}")
    return failures


def css_import_javascript_not_activated() -> list[str]:
    contract = _build("<style>@import 'javascript:IMPORT_SECRET';</style>")
    rendered = _dump(contract)
    failures: list[str] = []
    if "IMPORT_SECRET" in rendered:
        failures.append("ACTIVE_CONTENT: CSS import javascript residue IMPORT_SECRET was copied")
    if contract.xray is not None:
        for asset in contract.xray.assets:
            if "IMPORT_SECRET" in (asset.resolved_ref or "") or "IMPORT_SECRET" in asset.declared_ref:
                failures.append(
                    "ACTIVE_CONTENT: CSS import javascript URL stayed active as "
                    f"{asset.declared_ref} -> {asset.resolved_ref} same_document={asset.same_document}"
                )
    return failures


def meta_refresh_https_not_fetched() -> list[str]:
    contract = _build("<meta http-equiv='refresh' content='0;url=https://evil.example/land'><p>stay</p>")
    failures: list[str] = []
    if contract.network_performed is not False:
        failures.append("NETWORK: meta refresh performed network")
    if contract.xray is not None and any(asset.host == "evil.example" for asset in contract.xray.assets):
        failures.append("NETWORK: meta refresh created an asset for the redirect target")
    return failures


def meta_refresh_javascript_not_copied() -> list[str]:
    contract = _build("<meta http-equiv='refresh' content='0;url=javascript:METAREFRESH_SECRET'>")
    rendered = _dump(contract)
    if "METAREFRESH_SECRET" in rendered:
        return [
            "ACTIVE_CONTENT: meta refresh javascript URL METAREFRESH_SECRET was copied into the contract"
        ]
    return []


def sensitive_control_values_withheld() -> list[str]:
    contract = _build(
        "<form><input type='password' name='pw' value='PASSWORD_SECRET'>"
        "<input type='hidden' name='tok' value='HIDDEN_SECRET'></form>"
    )
    rendered = _dump(contract)
    failures = []
    for secret in ("PASSWORD_SECRET", "HIDDEN_SECRET"):
        if secret in rendered:
            failures.append(f"SENSITIVE_FIELDS: {secret} was copied")
    return failures


def sensitive_textarea_option_withheld() -> list[str]:
    contract = _build(
        "<form><textarea name='note'>TEXTAREA_SECRET</textarea>"
        "<select name='s'><option>OPTION_SECRET</option></select></form>"
    )
    rendered = _dump(contract)
    failures = []
    for secret in ("TEXTAREA_SECRET", "OPTION_SECRET"):
        if secret in rendered:
            failures.append(f"SENSITIVE_FIELDS: field value {secret} was copied through the contract")
    return failures


def data_payload_not_copied() -> list[str]:
    contract = _build("<img src=\"data:image/svg+xml,DATA_PAYLOAD_SECRET\">")
    rendered = _dump(contract)
    failures = []
    if "DATA_PAYLOAD_SECRET" in rendered:
        failures.append("SENSITIVE_FIELDS: data URL payload DATA_PAYLOAD_SECRET was copied")
    if contract.xray is None or not any(
        asset.declared_ref == "data:" and asset.fetch_status == "QUARANTINED" for asset in contract.xray.assets
    ):
        failures.append("ACTIVE_CONTENT: data URL was not recorded as a quarantined data: reference")
    return failures


def path_literal_relative_not_retained_in_target() -> list[str]:
    contract = _build("<a href='../secret/file'>go</a>")
    failures = []
    if contract.xray is None:
        return ["URL_SAFETY: missing xray"]
    links = [item for item in contract.xray.interactions if item.kind == "LINK"]
    if len(links) != 1 or not links[0].target:
        return ["URL_SAFETY: literal relative link did not resolve to one target"]
    segments = [segment for segment in urlsplit(links[0].target).path.split("/") if segment]
    if ".." in segments or "." in segments:
        failures.append(f"URL_SAFETY: traversal retained in interaction target {links[0].target}")
    if contract.semantic_authority != "NONE" or contract.network_performed is not False:
        failures.append("URL_SAFETY: relative link minted authority or network")
    return failures


def path_encoded_and_page_url_not_retained() -> list[str]:
    failures: list[str] = []
    decision = decide_acquisition("https://harbor.example/../../etc/passwd", _auth())
    identity = decision.url_identity or ""
    segments = [segment for segment in urlsplit(identity).path.split("/") if segment]
    if decision.status == "ALLOW_CAPTURE" and (".." in segments or "%2e" in identity.lower()):
        failures.append(
            "URL_SAFETY: path traversal retained in url_identity "
            f"status={decision.status} identity={identity}"
        )
    contract = _build("<img src='%2e%2e/%2e%2e/etc/passwd'><img src='..%2fsecret'>")
    if contract.xray is None:
        failures.append("URL_SAFETY: missing xray for encoded traversal")
        return failures
    for asset in contract.xray.assets:
        resolved = asset.resolved_ref or ""
        lowered = resolved.lower()
        if "%2e%2e" in lowered or "..%2f" in lowered or "/.." in resolved:
            failures.append(
                "URL_SAFETY: path traversal retained in resolved_ref "
                f"{asset.declared_ref} -> {resolved} same_document={asset.same_document}"
            )
    return failures


def malformed_not_complete() -> list[str]:
    contract = _build("<<<<not-a-document>>>>")
    failures: list[str] = []
    coverages = [(item.surface, item.coverage) for item in contract.fidelity]
    tags: list[str] = []
    if contract.xray is not None:
        _tags(contract.xray.layout, tags)
    if contract.status == "CONTRACT_READY" and not contract.gaps:
        failures.append(
            "MALFORMED_INPUT: malformed document became a complete X-Ray "
            f"status={contract.status} gaps={contract.gaps} fidelity={coverages} tags={tags}"
        )
    allowed = {"REFUSE", "INCOMPLETE"}
    if contract.status not in allowed and contract.status != "UNKNOWN":
        if contract.status == "CONTRACT_READY":
            pass
        else:
            failures.append(f"MALFORMED_INPUT: unexpected status {contract.status}")
    if contract.status == "CONTRACT_READY":
        failures.append(
            "MALFORMED_INPUT: status CONTRACT_READY is a fake complete X-Ray for <<<<not-a-document>>>>"
        )
    return failures


def empty_document_refused() -> list[str]:
    contract = _build("   ")
    if contract.status != "REFUSE" or contract.reason_codes != ("WR_EMPTY_DOCUMENT",) or contract.xray is not None:
        return [
            f"MALFORMED_INPUT: empty document -> {contract.status} {contract.reason_codes} xray={contract.xray is not None}"
        ]
    return []


def determinism() -> list[str]:
    html = "<main><p id='z'>Same</p></main>"
    css = ("body{font-family:SameFace}",)
    first = _build(html, css=css)
    second = _build(html, css=css)
    if first.to_dict() != second.to_dict():
        return ["DETERMINISM: same bytes produced different contracts"]
    if first.xray is None or first.xray.observation_id != second.xray.observation_id:
        return ["DETERMINISM: observation_id changed for the same bytes"]
    return []


def webgl_observation_only() -> list[str]:
    plain = _build("<style>body{perspective:800px;transform:translateZ(1px)}</style><canvas id='c'></canvas>")
    failures: list[str] = []
    if plain.xray is None:
        return ["WEBGL_BOUNDARY: missing xray"]
    webgl = plain.xray.webgl
    if webgl.executed is not False or plain.xray.to_dict()["webgl"]["executed"] is not False:
        failures.append("WEBGL_BOUNDARY: canvas observation set executed")
    if webgl.status != "DECLARED_UNEXECUTED":
        failures.append(f"WEBGL_BOUNDARY: canvas status {webgl.status}")
    if webgl.camera_count is not None or webgl.light_count is not None or webgl.object_count is not None:
        failures.append("WEBGL_BOUNDARY: geometry counts were invented for a bare canvas")
    if plain.xray.motion.camera.status != "UNOBSERVED" or plain.xray.motion.camera.position != ():
        failures.append(
            "WEBGL_BOUNDARY: CSS perspective invented a camera "
            f"{plain.xray.motion.camera.status} {plain.xray.motion.camera.position}"
        )
    claimed = _build(
        "<canvas></canvas>",
        sidecar={
            "webgl": {
                "library_declared": ["three"],
                "renderer": "WebGLRenderer",
                "camera_count": 1,
                "object_count": 4,
                "executed": True,
            }
        },
    )
    if claimed.xray is None or claimed.xray.webgl.executed is not False:
        failures.append("WEBGL_BOUNDARY: sidecar executed=true survived")
    if claimed.to_dict()["xray"]["webgl"]["executed"] is not False:
        failures.append("WEBGL_BOUNDARY: serialized webgl.executed is not false")
    if "three" not in claimed.xray.webgl.library_hints:
        failures.append("WEBGL_BOUNDARY: declared library hint was dropped")
    return failures


def camera_not_invented() -> list[str]:
    contract = _build("<p>no camera</p>")
    if contract.xray is None:
        return ["WEBGL_BOUNDARY: missing xray"]
    camera = contract.xray.motion.camera
    if camera.status != "UNOBSERVED" or camera.kind is not None or camera.position or camera.target or camera.fov:
        return [f"WEBGL_BOUNDARY: camera invented {camera.to_dict()}"]
    if contract.xray.webgl.status != "ABSENT":
        return [f"WEBGL_BOUNDARY: missing canvas became {contract.xray.webgl.status}"]
    if contract.xray.webgl.camera_count not in (None,):
        return ["WEBGL_BOUNDARY: missing webgl camera_count was filled"]
    return []


def missing_css_not_inferred() -> list[str]:
    contract = _build("<link rel='stylesheet' href='/missing.css'><p style='font-family: ObservedOnly'>t</p>")
    failures = []
    if contract.xray is None:
        return ["GAP: missing xray"]
    rendered = _dump(contract)
    if "InferredMissing" in rendered:
        failures.append("GAP: missing stylesheet was inferred")
    families = [token.font_family or "" for token in contract.xray.typography]
    if not any("ObservedOnly" in family for family in families):
        failures.append(f"GAP: observed inline font missing: {families}")
    if contract.xray.breakpoints:
        failures.append(f"GAP: breakpoints invented without a media query: {contract.xray.breakpoints}")
    sheets = [asset for asset in contract.xray.assets if asset.declared_ref == "/missing.css"]
    if len(sheets) != 1 or sheets[0].fetch_status != "NOT_FETCHED" or sheets[0].kind != "STYLESHEET":
        failures.append(f"GAP: missing css asset was not an unfetched stylesheet: {sheets}")
    return failures


def unknown_asset_not_retyped() -> list[str]:
    contract = _build("<p>x</p>", css=("body{background:url(/files/widget.zzz)}",))
    if contract.xray is None:
        return ["GAP: missing xray"]
    matches = [asset for asset in contract.xray.assets if "widget.zzz" in asset.declared_ref]
    if len(matches) != 1:
        return [f"GAP: unknown asset count {len(matches)}"]
    asset = matches[0]
    if asset.kind != "OTHER":
        return [f"GAP: unknown asset retyped as {asset.kind}"]
    if asset.fetch_status != "NOT_FETCHED":
        return [f"GAP: unknown asset fetch status {asset.fetch_status}"]
    return []


def source_order_preserved() -> list[str]:
    contract = _build("<main><em>A</em><em>B</em><em>C</em></main>")
    if contract.xray is None:
        return ["DETERMINISM: missing xray"]
    main = contract.xray.layout.children[0]
    excerpts = [child.text_excerpt for child in main.children]
    if excerpts != ["A", "B", "C"]:
        return [f"DETERMINISM: source order lost {excerpts}"]
    return []


def media_query_not_fabricated() -> list[str]:
    contract = _build("<style>@media (min-width: 800px){body{color:red}}</style>")
    if contract.xray is None:
        return ["GAP: missing xray"]
    queries = [item.query for item in contract.xray.breakpoints]
    widths = [item.min_width_px for item in contract.xray.breakpoints]
    if queries != ["(min-width: 800px)"] or widths != [800]:
        return [f"GAP: media queries fabricated or dropped {queries} {widths}"]
    if any(item.max_width_px == 1 for item in contract.xray.breakpoints):
        return ["GAP: fabricated max-width 1px breakpoint"]
    return []


def duplicate_ids_not_normalized() -> list[str]:
    contract = _build("<div id='dup'></div><span id='dup'></span>")
    if contract.xray is None:
        return ["GAP: missing xray"]
    found: list[str] = []
    _ids(contract.xray.layout, found)
    rendered = _dump(contract)
    failures = []
    if found != ["dup", "dup"]:
        failures.append(f"GAP: duplicate ids normalized as {found}")
    if "normalized-proven" in rendered or "IDS_PROVEN" in rendered:
        failures.append("GAP: duplicate ids were marked proven")
    return failures


def gaps_remain() -> list[str]:
    contract = _build("<main><p>a</p><p>b</p><p>c</p><p>d</p></main>", limits=ObservationLimits(max_nodes=4, max_depth=8))
    failures = []
    if contract.status != "INCOMPLETE":
        failures.append(f"SCALE_BOUNDARY: node cap status {contract.status}")
    if "LAYOUT_NODE_CAP" not in contract.gaps:
        failures.append(f"GAP: LAYOUT_NODE_CAP disappeared from {contract.gaps}")
    layout = next((item for item in contract.fidelity if item.surface == "LAYOUT"), None)
    if layout is None or layout.coverage != "PARTIAL" or "LAYOUT_NODE_CAP" not in layout.gap_codes:
        failures.append(f"GAP: layout fidelity did not stay partial {layout}")
    return failures


def huge_capture_budget() -> list[str]:
    failures = []
    huge = _build("<p>budget</p>", authorization=_auth(max_capture_bytes=8))
    if huge.status != "REFUSE" or huge.reason_codes != ("WR_CAPTURE_TOO_LARGE",) or huge.xray is not None:
        failures.append(f"SCALE_BOUNDARY: capture budget -> {huge.status} {huge.reason_codes}")
    truncated = _build("<p>" + ("x" * 80) + "</p>", limits=ObservationLimits(max_html_chars=10))
    if truncated.status != "INCOMPLETE" or "HTML_OVER_OBSERVATION_LIMIT" not in truncated.gaps or truncated.xray is not None:
        failures.append(
            f"SCALE_BOUNDARY: html budget -> {truncated.status} {truncated.reason_codes} gaps={truncated.gaps}"
        )
    return failures


def semantic_authority_none() -> list[str]:
    contract = _build("<p>plain</p>")
    failures = []
    payload = contract.to_dict()
    if contract.semantic_authority != "NONE" or payload["semantic_authority"] != "NONE":
        failures.append(f"SEMANTIC_AUTHORITY: elevated to {contract.semantic_authority} / {payload['semantic_authority']}")
    if contract.xray is None or contract.xray.semantic_authority != "NONE" or contract.xray.to_dict()["semantic_authority"] != "NONE":
        failures.append("SEMANTIC_AUTHORITY: xray authority is not NONE")
    smuggled = _build("<p>plain</p>", sidecar={"semantic_authority": "VERIFIED"})
    if smuggled.status != "REFUSE" or "WR_FORBIDDEN_PAYLOAD" not in smuggled.reason_codes:
        failures.append(f"SEMANTIC_AUTHORITY: sidecar authority was accepted {smuggled.status} {smuggled.reason_codes}")
    return failures


def k3_not_integrated() -> list[str]:
    contract = _build("<p>plain</p>")
    failures = []
    if contract.k3_integrated is not False or contract.to_dict()["k3_integrated"] is not False:
        failures.append("K3_INTEGRATED: flag is not false")
    package = ROOT / "spe_runtime" / "webrecon"
    for path in sorted(package.glob("*.py")):
        text = path.read_text(encoding="utf-8")
        for banned in ("spe_runtime.k3", "spe_runtime.xcat", "spe_runtime.quality", "urlopen(", "import socket", "urllib.request"):
            if banned in text:
                failures.append(f"K3_INTEGRATED: {path.name} contains {banned}")
    return failures


CHECKS: dict[str, Check] = {
    "network_none_and_no_socket": network_none_and_no_socket,
    "live_redirect_script_modes_refused": live_redirect_script_modes_refused,
    "unsafe_schemes_and_credentials_refused": unsafe_schemes_and_credentials_refused,
    "canonical_private_ips_refused": canonical_private_ips_refused,
    "obfuscated_loopback_refused": obfuscated_loopback_refused,
    "active_script_onclick_svg_form_not_executed": active_script_onclick_svg_form_not_executed,
    "css_javascript_url_not_activated": css_javascript_url_not_activated,
    "css_import_javascript_not_activated": css_import_javascript_not_activated,
    "meta_refresh_https_not_fetched": meta_refresh_https_not_fetched,
    "meta_refresh_javascript_not_copied": meta_refresh_javascript_not_copied,
    "sensitive_control_values_withheld": sensitive_control_values_withheld,
    "sensitive_textarea_option_withheld": sensitive_textarea_option_withheld,
    "data_payload_not_copied": data_payload_not_copied,
    "path_literal_relative_not_retained_in_target": path_literal_relative_not_retained_in_target,
    "path_encoded_and_page_url_not_retained": path_encoded_and_page_url_not_retained,
    "malformed_not_complete": malformed_not_complete,
    "empty_document_refused": empty_document_refused,
    "determinism": determinism,
    "webgl_observation_only": webgl_observation_only,
    "camera_not_invented": camera_not_invented,
    "missing_css_not_inferred": missing_css_not_inferred,
    "unknown_asset_not_retyped": unknown_asset_not_retyped,
    "source_order_preserved": source_order_preserved,
    "media_query_not_fabricated": media_query_not_fabricated,
    "duplicate_ids_not_normalized": duplicate_ids_not_normalized,
    "gaps_remain": gaps_remain,
    "huge_capture_budget": huge_capture_budget,
    "semantic_authority_none": semantic_authority_none,
    "k3_not_integrated": k3_not_integrated,
}


def run_all() -> dict[str, dict[str, object]]:
    report: dict[str, dict[str, object]] = {}
    for name, check in CHECKS.items():
        try:
            failures = check()
        except Exception as exc:  # noqa: BLE001 — qualification records the crash
            failures = [f"{name}: raised {type(exc).__name__}: {exc}"]
        report[name] = {"pass": not failures, "failures": failures}
    return report
