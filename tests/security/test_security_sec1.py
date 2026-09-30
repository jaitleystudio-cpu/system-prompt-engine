"""SEC1-01..SEC1-20 mutation qualification for the Lane F security donor.

Mutants are applied to a temporary copy. A mutant is killed only when the
oracle passes on the donor and fails on that copy. A law that already fails
on the donor is a donor defect, not a kill. Survived must stay empty.
"""

from __future__ import annotations

import json
import shutil
import socket
import subprocess
import tempfile
from pathlib import Path
from typing import Callable

import pytest

from tests.security.sec1_oracle import (
    LAW_IDS,
    qualify_root,
    repo_root_from,
    style_src_unsafe_inline,
)

Patch = Callable[[Path], None]
HEADERS = "apps/web/public/_headers"
INDEX = "apps/web/index.html"
URL_INGEST = "apps/web/src/media/urlIngest.ts"
UNTRUSTED = "apps/web/src/media/untrusted.ts"
SERVICE_WORKER = "apps/web/public/sw.js"
SBOM = "proofs/generated/web_sbom_cyclonedx.json"
INVENTORY = "proofs/generated/web_dependency_inventory.json"
LOCK = "apps/web/package-lock.json"
PACKAGE = "apps/web/package.json"
AUDIT = "apps/web/scripts/audit-deps.mjs"
STAGED = (
    "apps/web/src",
    HEADERS,
    INDEX,
    SERVICE_WORKER,
    AUDIT,
    PACKAGE,
    LOCK,
    SBOM,
    INVENTORY,
    "spe_runtime",
)
DONOR_SHA = "1837e81a0a756182725f6841f77cdcdd0166411a"
HOLD_REASONS = {
    "SEC1-14": "A same-origin URL containing dot-dot segments is normalized and fetch is attempted.",
    "SEC1-16": "The grounding firewall keeps bypass, authorized, isAdmin, and auth_bypass booleans.",
    "SEC1-18": "A missing connect-src policy allows a remote fetch.",
}


def _replace(root: Path, rel: str, old: str, new: str) -> None:
    path = root / rel
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise AssertionError(f"mutation anchor missing for {rel}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def _stage(repo: Path) -> Path:
    tmp = Path(tempfile.mkdtemp(prefix="sec1-"))
    for rel in STAGED:
        src = repo / rel
        dest = tmp / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if src.is_dir():
            shutil.copytree(src, dest)
        else:
            shutil.copy2(src, dest)
    return tmp


def _drop_csp(root: Path) -> None:
    path = root / HEADERS
    lines = [
        line
        for line in path.read_text(encoding="utf-8").splitlines(True)
        if "Content-Security-Policy:" not in line
    ]
    path.write_text("".join(lines), encoding="utf-8")


def _allow_script_inline(root: Path) -> None:
    _replace(
        root,
        HEADERS,
        "script-src 'self' 'wasm-unsafe-eval'",
        "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
    )


def _allow_script_eval(root: Path) -> None:
    _replace(
        root,
        HEADERS,
        "script-src 'self' 'wasm-unsafe-eval'",
        "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
    )


def _drop_frame_ancestors(root: Path) -> None:
    _replace(root, HEADERS, " frame-ancestors 'none';", "")


def _drop_hsts(root: Path) -> None:
    path = root / HEADERS
    lines = [
        line
        for line in path.read_text(encoding="utf-8").splitlines(True)
        if "Strict-Transport-Security:" not in line
    ]
    path.write_text("".join(lines), encoding="utf-8")


def _claim_cve_clean(root: Path) -> None:
    path = root / INVENTORY
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["cve_status"] = "clean"
    path.write_text(json.dumps(payload), encoding="utf-8")


def _invent_sbom_component(root: Path) -> None:
    path = root / SBOM
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["components"].append(
        {
            "type": "library",
            "name": "invented-telemetry",
            "version": "9.9.9",
            "purl": "pkg:npm/invented-telemetry@9.9.9",
        }
    )
    path.write_text(json.dumps(payload), encoding="utf-8")


def _execute_html(root: Path) -> None:
    path = root / UNTRUSTED
    path.write_text(
        path.read_text(encoding="utf-8") + "\nfunction sec1Sink(el, html) {\n  el.innerHTML = html;\n}\n",
        encoding="utf-8",
    )


def _allow_script_url(root: Path) -> None:
    _replace(
        root,
        URL_INGEST,
        'if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {',
        'if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:" && parsed.protocol !== "javascript:")) {',
    )


def _allow_egress_fetch(root: Path) -> None:
    _replace(
        root,
        URL_INGEST,
        "): boolean {\n  if (!connectSrc) return false;",
        "): boolean {\n  return true;\n  if (!connectSrc) return false;",
    )


def _allow_websocket(root: Path) -> None:
    _replace(root, HEADERS, "connect-src 'self'", "connect-src 'self' wss://evil.example")


def _log_secret(root: Path) -> None:
    path = root / UNTRUSTED
    path.write_text(
        path.read_text(encoding="utf-8")
        + "\nfunction sec1Log() {\n  console.log(\"sec1-marker\");\n}\n",
        encoding="utf-8",
    )


def _persist_secret_query(root: Path) -> None:
    _replace(
        root,
        SERVICE_WORKER,
        "  if (url.search && url.search.length > 0) {\n"
        "    // Never cache requests with query strings to avoid private leakage.\n"
        "    return;\n"
        "  }\n",
        "",
    )


def _note_traversal(root: Path) -> None:
    _replace(
        root,
        URL_INGEST,
        "rawUrlHasPathTraversal(examined)",
        "false",
    )


def _allow_metadata(root: Path) -> None:
    _replace(
        root,
        URL_INGEST,
        "  if (!connectSrc) return false;",
        '  if (target.hostname === "169.254.169.254") return true;\n  if (!connectSrc) return false;',
    )


def _note_auth_bypass(root: Path) -> None:
    _replace(
        root,
        "spe_runtime/grounding/firewall.py",
        "        if _is_untrusted_authority_key(name):\n            continue\n",
        "",
    )


def _skip_pin(root: Path) -> None:
    path = root / LOCK
    payload = json.loads(path.read_text(encoding="utf-8"))
    for key, details in payload["packages"].items():
        if key and isinstance(details, dict) and details.get("integrity"):
            details.pop("integrity")
            break
    path.write_text(json.dumps(payload), encoding="utf-8")


def _note_unknown_header(root: Path) -> None:
    _replace(
        root,
        URL_INGEST,
        "  if (!connectSrc) return false;",
        "  if (!connectSrc) return true;",
    )


def _elevate_authority(root: Path) -> None:
    _replace(
        root,
        UNTRUSTED,
        "  return [\n    UNTRUSTED_OPEN,",
        '  return [\n    "Semantic-Authority: ROOT",\n    UNTRUSTED_OPEN,',
    )


def _authorize_hosting(root: Path) -> None:
    _replace(
        root,
        AUDIT,
        "not_a_release: true,",
        "not_a_release: false,\n      hosting_is_authorization: true,",
    )


MUTANTS: tuple[tuple[str, str, Patch], ...] = (
    ("SEC1-01", "CSP dropped", _drop_csp),
    ("SEC1-02", "unsafe-inline allowed on script-src", _allow_script_inline),
    ("SEC1-03", "unsafe-eval allowed on script-src", _allow_script_eval),
    ("SEC1-04", "frame-ancestors removed", _drop_frame_ancestors),
    ("SEC1-05", "HSTS absent treated as present", _drop_hsts),
    ("SEC1-06", "dependency CVE marked clean without evidence", _claim_cve_clean),
    ("SEC1-07", "SBOM component invented", _invent_sbom_component),
    ("SEC1-08", "untrusted HTML assigned to innerHTML", _execute_html),
    ("SEC1-09", "javascript URL allowed", _allow_script_url),
    ("SEC1-10", "egress fetch allowed under connect-src self", _allow_egress_fetch),
    ("SEC1-11", "websocket origin allowed", _allow_websocket),
    ("SEC1-12", "secret logged", _log_secret),
    ("SEC1-13", "secret query persisted by the service worker", _persist_secret_query),
    ("SEC1-14", "path traversal left fetchable", _note_traversal),
    ("SEC1-15", "metadata IP allowed", _allow_metadata),
    ("SEC1-16", "auth bypass boolean left accepted", _note_auth_bypass),
    ("SEC1-17", "supply-chain integrity pin skipped", _skip_pin),
    ("SEC1-18", "absent connect-src treated as allow", _note_unknown_header),
    ("SEC1-19", "semantic authority elevated outside the data boundary", _elevate_authority),
    ("SEC1-20", "hosting treated as authorization", _authorize_hosting),
)


def _git_head(repo: Path) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", "HEAD"],
        cwd=repo,
        text=True,
    ).strip()


def _git_branch(repo: Path) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=repo,
        text=True,
    ).strip()


def build_ledger(repo: Path) -> dict[str, object]:
    donor_laws = qualify_root(repo)
    rows: list[dict[str, object]] = []
    for law, attack, patch in MUTANTS:
        staged = _stage(repo)
        try:
            patch(staged)
            mutated = qualify_root(staged)
        finally:
            shutil.rmtree(staged)
        donor_result = donor_laws[law]
        mutant_result = mutated[law]
        if donor_result != "PASS":
            status = "DONOR_DEFECT"
        elif mutant_result == "FAIL":
            status = "KILLED"
        else:
            status = "SURVIVED"
        row = {
            "id": law,
            "attack": attack,
            "executed": True,
            "donor": donor_result,
            "mutant": mutant_result,
            "status": status,
        }
        if status == "DONOR_DEFECT" and law in HOLD_REASONS:
            row["reason"] = HOLD_REASONS[law]
        rows.append(row)
    killed = [row["id"] for row in rows if row["status"] == "KILLED"]
    survived = [row["id"] for row in rows if row["status"] == "SURVIVED"]
    defects = [row["id"] for row in rows if row["status"] == "DONOR_DEFECT"]
    final = (
        "SECURITY_R1_REPAIR_PASS"
        if not survived and not defects and len(killed) == len(LAW_IDS)
        else "HOLD"
    )
    return {
        "donor_sha": DONOR_SHA,
        "tested_head": _git_head(repo),
        "branch": _git_branch(repo),
        "pr": "NONE",
        "pr_status": "NOT_OPENED",
        "style_src_unsafe_inline": style_src_unsafe_inline(repo),
        "cve_disposition": "UNKNOWN",
        "semantic_authority": "NOT_ELEVATED" if donor_laws["SEC1-19"] == "PASS" else "ELEVATED",
        "egress": "ZERO",
        "pentest": "NOT_PERFORMED",
        "killed": len(killed),
        "survived": survived,
        "donor_defects": defects,
        "final": final,
        "mutants": rows,
    }


@pytest.fixture(autouse=True)
def _block_python_sockets(monkeypatch: pytest.MonkeyPatch) -> None:
    def blocked(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("egress")

    monkeypatch.setattr(socket.socket, "connect", blocked)


def test_sec1_qualification_ledger() -> None:
    repo = repo_root_from(Path(__file__).resolve())
    subprocess.check_call(
        ["git", "merge-base", "--is-ancestor", DONOR_SHA, "HEAD"],
        cwd=repo,
    )
    ledger = build_ledger(repo)
    proof = repo / "proofs" / "security_r1_20260930" / "mutant_ledger.json"
    proof.parent.mkdir(parents=True, exist_ok=True)
    proof.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")
    assert ledger["egress"] == "ZERO"
    assert ledger["pentest"] == "NOT_PERFORMED"
    assert ledger["cve_disposition"] == "UNKNOWN"
    assert ledger["pr"] == "NONE"
    assert ledger["survived"] == []
    assert ledger["donor_defects"] == []
    assert ledger["killed"] == 20
    assert ledger["semantic_authority"] == "NOT_ELEVATED"
    assert ledger["final"] == "SECURITY_R1_REPAIR_PASS"
    assert [row["id"] for row in ledger["mutants"]] == list(LAW_IDS)
