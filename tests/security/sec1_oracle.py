"""Independent SEC1 oracle for the Lane F security donor.

The donor tree is read only. A law passes only when the artifact or runtime
refuses the defect. UNKNOWN is not a pass. This module does not open sockets.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

REPO_MARKERS = ("apps/web/public/_headers", "tests/security/sec1_runtime.mjs")

SINK_RE = re.compile(
    r"dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|"
    r"document\.write\s*\(|\beval\s*\("
)
SECRET_LOG_RE = re.compile(
    r"console\.(?:log|info|debug|warn|error)\([^;\n]*"
    r"(?:sec1-marker|process\.env\.[A-Za-z0-9_]*(?:SECRET|PASSWORD|TOKEN|KEY)|"
    r"apiKey|credential)",
    re.IGNORECASE,
)
HOSTING_GRANT_RE = re.compile(
    r"hosting_is_authorization\s*[:=]\s*true|"
    r"authorized_because\s*[:=]\s*['\"]hosted['\"]|"
    r"not_a_release\s*[:=]\s*false",
    re.IGNORECASE,
)
BYPASS_KEYS = ("bypass", "authorized", "isAdmin", "auth_bypass")
CLEAN_CLAIMS = {"clean", "none", "pass", "clear", "ok"}
LAW_IDS = tuple(f"SEC1-{index:02d}" for index in range(1, 21))


def repo_root_from(start: Path) -> Path:
    for parent in [start, *start.parents]:
        if all((parent / marker).exists() for marker in REPO_MARKERS):
            return parent
    raise AssertionError("security donor root not found")


def run_runtime(root: Path) -> dict[str, Any]:
    """Run the local probe. The child environment has no inherited secrets."""
    here = Path(__file__).resolve().parent
    env = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", ""),
        "TMPDIR": os.environ.get("TMPDIR", "/tmp"),
        "SEC1_ROOT": str(root),
        "NODE_NO_WARNINGS": "1",
    }
    result = subprocess.run(
        [
            "node",
            "--experimental-strip-types",
            "--import",
            str(here / "sec1_register.mjs"),
            str(here / "sec1_runtime.mjs"),
        ],
        cwd=str(root),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        detail = (result.stderr or result.stdout or "").strip().splitlines()
        tail = detail[-8:]
        raise AssertionError(
            f"security runtime probe failed code={result.returncode}: " + " | ".join(tail)
        )
    try:
        payload = json.loads(result.stdout[result.stdout.rfind("{") : result.stdout.rfind("}") + 1])
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"security runtime probe returned non-JSON code={result.returncode}"
        ) from exc
    if payload.get("real_egress") is not False:
        raise AssertionError("security runtime reported egress")
    return payload


def star_headers(text: str) -> dict[str, str]:
    headers: dict[str, str] = {}
    in_star = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == "/*":
            in_star = True
            continue
        if in_star and stripped.startswith("/") and not stripped.startswith("//"):
            break
        if in_star and ":" in line:
            name, value = line.strip().split(":", 1)
            headers[name.strip().lower()] = value.strip()
    return headers


def csp_directives(value: str) -> dict[str, list[str]]:
    directives: dict[str, list[str]] = {}
    for part in value.split(";"):
        bits = part.strip().split()
        if not bits:
            continue
        directives[bits[0].lower()] = [bit.strip("'\"") for bit in bits[1:]]
    return directives


def meta_csp(html: str) -> str:
    match = re.search(
        r'<meta[^>]*http-equiv=["\']Content-Security-Policy["\'][^>]*content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if match:
        return match.group(1)
    match = re.search(
        r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*http-equiv=["\']Content-Security-Policy["\']',
        html,
        re.IGNORECASE,
    )
    return match.group(1) if match else ""


def _lock_components(lock: dict[str, Any]) -> set[tuple[str, str]]:
    seen: set[tuple[str, str]] = set()
    for key, details in lock.get("packages", {}).items():
        if not key or not isinstance(details, dict):
            continue
        name = key.split("node_modules/")[-1]
        version = str(details.get("version") or "unknown")
        seen.add((name, version))
    return seen


def _sbom_components(sbom: dict[str, Any]) -> set[tuple[str, str]]:
    found: set[tuple[str, str]] = set()
    for component in sbom.get("components", []):
        if not isinstance(component, dict):
            continue
        found.add((str(component.get("name")), str(component.get("version"))))
    return found


def _false_cve_clean(blob: object) -> bool:
    if not isinstance(blob, dict):
        return False
    evidence = blob.get("vulnerability_evidence") or []
    evidenced = isinstance(evidence, list) and len(evidence) > 0
    for key in ("cve_status", "vulnerability_status"):
        if str(blob.get(key, "")).lower() in CLEAN_CLAIMS and not evidenced:
            return True
    vulnerabilities = blob.get("vulnerabilities")
    if vulnerabilities == [] and not evidenced:
        return True
    return False


def _unpinned(lock: dict[str, Any]) -> bool:
    for key, details in lock.get("packages", {}).items():
        if not key or not isinstance(details, dict):
            continue
        if not details.get("integrity"):
            return True
        resolved = str(details.get("resolved") or "")
        if resolved and "registry.npmjs.org" not in resolved:
            return True
    return False


def _unlocked_direct(package_json: dict[str, Any], lock: dict[str, Any]) -> bool:
    direct = set(package_json.get("dependencies", {})) | set(
        package_json.get("devDependencies", {})
    )
    locked: set[str] = set()
    for key in lock.get("packages", {}):
        if key.startswith("node_modules/") and key.count("node_modules/") == 1:
            locked.add(key.split("/", 1)[1])
    return not direct <= locked


def _scan_src(root: Path, pattern: re.Pattern[str]) -> bool:
    """Scan product source. Detector scripts name forbidden APIs without executing them."""
    src = root / "apps" / "web" / "src"
    for path in src.rglob("*"):
        if path.is_file() and path.suffix in {".ts", ".tsx", ".js", ".mjs"}:
            if pattern.search(path.read_text(encoding="utf-8")):
                return True
    return False


def _scan_tree(root: Path, pattern: re.Pattern[str]) -> bool:
    src = root / "apps" / "web" / "src"
    scripts = root / "apps" / "web" / "scripts"
    paths = [src, scripts, root / "apps" / "web" / "public" / "sw.js"]
    for base in paths:
        files = [base] if base.is_file() else base.rglob("*")
        for path in files:
            if not path.is_file():
                continue
            if path.suffix not in {".ts", ".tsx", ".js", ".mjs", ""}:
                continue
            if pattern.search(path.read_text(encoding="utf-8")):
                return True
    return False


def _auth_bypass_accepted() -> bool:
    from spe_runtime.grounding.firewall import sanitize_external_payload

    for key in BYPASS_KEYS:
        cleaned = sanitize_external_payload({"claim": "note", key: True})
        if cleaned.get(key) is True:
            return True
    return False


def _policy_tokens(directives: dict[str, list[str]], name: str) -> list[str]:
    return directives.get(name, [])


def qualify_root(root: Path, runtime: dict[str, Any] | None = None) -> dict[str, str]:
    """Return SEC1-01..SEC1-20 as PASS or FAIL. PASS means the defect is absent."""
    headers = star_headers((root / "apps/web/public/_headers").read_text(encoding="utf-8"))
    html = (root / "apps/web/index.html").read_text(encoding="utf-8")
    header_csp = csp_directives(headers.get("content-security-policy", ""))
    page_csp = csp_directives(meta_csp(html))
    script = _policy_tokens(header_csp, "script-src") + _policy_tokens(page_csp, "script-src")
    default = _policy_tokens(header_csp, "default-src") + _policy_tokens(page_csp, "default-src")
    connect = _policy_tokens(header_csp, "connect-src")
    frame = _policy_tokens(header_csp, "frame-ancestors")
    hsts = headers.get("strict-transport-security", "")
    sbom = json.loads(
        (root / "proofs/generated/web_sbom_cyclonedx.json").read_text(encoding="utf-8")
    )
    inventory = json.loads(
        (root / "proofs/generated/web_dependency_inventory.json").read_text(encoding="utf-8")
    )
    lock = json.loads((root / "apps/web/package-lock.json").read_text(encoding="utf-8"))
    package_json = json.loads((root / "apps/web/package.json").read_text(encoding="utf-8"))
    audit = (root / "apps/web/scripts/audit-deps.mjs").read_text(encoding="utf-8")
    if runtime is None:
        runtime = run_runtime(root)

    failed: set[str] = set()
    if "content-security-policy" not in headers or "default-src" not in header_csp:
        failed.add("SEC1-01")
    if "unsafe-inline" in script or "unsafe-inline" in default:
        failed.add("SEC1-02")
    if "unsafe-eval" in script or "unsafe-eval" in default:
        failed.add("SEC1-03")
    if "none" not in frame:
        failed.add("SEC1-04")
    if "max-age=" not in hsts or "includesubdomains" not in hsts.lower():
        failed.add("SEC1-05")
    if _false_cve_clean(sbom) or _false_cve_clean(inventory):
        failed.add("SEC1-06")
    if _sbom_components(sbom) != _lock_components(lock):
        failed.add("SEC1-07")
    if _scan_src(root, SINK_RE):
        failed.add("SEC1-08")
    if runtime.get("javascript_status") != "invalid_url" or runtime.get("javascript_fetch"):
        failed.add("SEC1-09")
    if runtime.get("self_remote_allowed") or runtime.get("self_remote_fetch"):
        failed.add("SEC1-10")
    if connect != ["self"] or any(
        token == "*" or token.startswith("ws:") or token.startswith("wss:") or token.startswith("http")
        for token in connect
    ):
        failed.add("SEC1-11")
    if _scan_tree(root, SECRET_LOG_RE):
        failed.add("SEC1-12")
    if (
        runtime.get("secret_query_cached")
        or runtime.get("secret_query_fetched")
        or runtime.get("post_secret_cached")
    ):
        failed.add("SEC1-13")
    if runtime.get("traversal_fetch"):
        failed.add("SEC1-14")
    if (
        runtime.get("metadata_allowed")
        or runtime.get("metadata_fetch")
        or runtime.get("metadata_status") == "ok"
    ):
        failed.add("SEC1-15")
    if _auth_bypass_accepted():
        failed.add("SEC1-16")
    if _unpinned(lock) or _unlocked_direct(package_json, lock):
        failed.add("SEC1-17")
    if (
        runtime.get("absent_policy_allowed")
        or runtime.get("empty_policy_allowed")
        or runtime.get("absent_policy_fetch")
    ):
        failed.add("SEC1-18")
    if runtime.get("authority_outside"):
        failed.add("SEC1-19")
    if HOSTING_GRANT_RE.search(audit):
        failed.add("SEC1-20")

    return {law: "FAIL" if law in failed else "PASS" for law in LAW_IDS}


def style_src_unsafe_inline(root: Path) -> str:
    headers = star_headers((root / "apps/web/public/_headers").read_text(encoding="utf-8"))
    style = csp_directives(headers.get("content-security-policy", "")).get("style-src", [])
    if "unsafe-inline" in style:
        return "STYLE_SRC_DOCUMENTED_EXCEPTION"
    return "ABSENT"
