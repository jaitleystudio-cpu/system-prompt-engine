"""Apply WR1-01..WR1-20 to a temporary copy of the donor package.

The worktree copy of spe_runtime is not modified. A mutant is killed only when
an oracle that passed on the donor fails on the mutant. An oracle that already
fails on the donor is donor evidence, not a kill.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROOF = ROOT / "proofs" / "webrecon_r1_20260930"
DONOR_SHA = "f2f67c0f00982c738485a103de807adde03ea80f"
PYTEST = os.environ.get("WR1_PYTEST", sys.executable)


def _patches() -> dict[str, dict[str, object]]:
    return {
        "WR1-01": {
            "defect": "script executed",
            "target": "active_script_onclick_svg_form_not_executed",
            "patches": [
                (
                    "html_css.py",
                    '        if self.stack and self.stack[-1].tag == "script":\n            node_id = self.stack[-1].node_id\n            self.stack.pop()',
                    '        if self.stack and self.stack[-1].tag == "script":\n            node_id = self.stack[-1].node_id\n            self.stack[-1].text_parts.append(payload)\n            self.stack.pop()',
                    1,
                )
            ],
        },
        "WR1-02": {
            "defect": "onclick active",
            "target": "active_script_onclick_svg_form_not_executed",
            "patches": [
                (
                    "html_css.py",
                    """            if name.startswith("on") and len(name) > 2:
                self.events.append(
                    QuarantineEvent(
                        kind="EVENT_HANDLER",
                        node_hint=node.node_id,
                        digest=digest_text(value),
                        byte_length=len(value.encode("utf-8")),
                        detail="EVENT_HANDLER_DROPPED",
                    )
                )
                continue""",
                    """            if name.startswith("on") and len(name) > 2:
                kept.append(LayoutAttribute(name=name, value=value))
                continue""",
                    1,
                )
            ],
        },
        "WR1-03": {
            "defect": "javascript URL active",
            "target": "css_javascript_url_not_activated",
            "patches": [
                (
                    "html_css.py",
                    '''def _active_url(value: str) -> bool:
    stripped = value.strip().lower()
    return stripped.startswith("javascript:") or stripped.startswith("vbscript:")''',
                    '''def _active_url(value: str) -> bool:
    del value
    return False''',
                    1,
                )
            ],
        },
        "WR1-04": {
            "defect": "secret copied",
            "target": "sensitive_textarea_option_withheld",
            "patches": [
                (
                    "html_css.py",
                    '            if name == "style" or name == "srcdoc" or name == "value":\n                continue',
                    '            if name == "style" or name == "srcdoc":\n                continue\n            if name == "value":\n                kept.append(LayoutAttribute(name=name, value=value))\n                continue',
                    1,
                )
            ],
        },
        "WR1-05": {
            "defect": "data payload copied",
            "target": "data_payload_not_copied",
            "patches": [
                (
                    "html_css.py",
                    '                    declared_ref="data:",',
                    "                    declared_ref=payload[:500],",
                    1,
                )
            ],
        },
        "WR1-06": {
            "defect": "network silently enabled",
            "target": "network_none_and_no_socket",
            "patches": [
                (
                    "acquisition.py",
                    'object.__setattr__(self, "network_performed", False)',
                    'object.__setattr__(self, "network_performed", True)',
                    1,
                ),
                (
                    "acquisition.py",
                    '"network_performed": False,',
                    '"network_performed": True,',
                    1,
                ),
                (
                    "contract.py",
                    'object.__setattr__(self, "network_performed", False)',
                    'object.__setattr__(self, "network_performed", True)',
                    1,
                ),
                (
                    "contract.py",
                    '"network_performed": False,',
                    '"network_performed": True,',
                    1,
                ),
                (
                    "xray.py",
                    'object.__setattr__(self, "network_performed", False)',
                    'object.__setattr__(self, "network_performed", True)',
                    1,
                ),
                (
                    "xray.py",
                    '"network_performed": False,',
                    '"network_performed": True,',
                    1,
                ),
            ],
        },
        "WR1-07": {
            "defect": "malformed marked complete",
            "target": "malformed_not_complete",
            "patches": [
                (
                    "contract.py",
                    "    if not html.strip():\n        return _refuse(decision, (ReasonCode.EMPTY_DOCUMENT.value,))",
                    "    if False and not html.strip():\n        return _refuse(decision, (ReasonCode.EMPTY_DOCUMENT.value,))",
                    1,
                )
            ],
        },
        "WR1-08": {
            "defect": "unknown asset known",
            "target": "unknown_asset_not_retyped",
            "patches": [
                (
                    "contract.py",
                    '        if path.endswith(ext):\n            return kind\n    return "OTHER"',
                    '        if path.endswith(ext):\n            return kind\n    return "IMAGE"',
                    1,
                )
            ],
        },
        "WR1-09": {
            "defect": "missing CSS inferred",
            "target": "missing_css_not_inferred",
            "patches": [
                (
                    "html_css.py",
                    """        if "stylesheet" in rel.split():
            self.stylesheet_links.append(href)
            self._add_asset(node_id, "STYLESHEET", href, integrity, "NOT_FETCHED", "NOT_APPLICABLE")""",
                    """        if "stylesheet" in rel.split():
            self.stylesheet_links.append(href)
            self.styles.append((f"inferred:{href}", ":root{--inferred:InferredMissing}@media (max-width:1px){body{color:red}}"))
            self._add_asset(node_id, "STYLESHEET", href, integrity, "NOT_FETCHED", "NOT_APPLICABLE")""",
                    1,
                )
            ],
        },
        "WR1-10": {
            "defect": "source order lost",
            "target": "source_order_preserved",
            "patches": [
                (
                    "html_css.py",
                    "        children=tuple(_freeze(child, limit) for child in node.children),",
                    "        children=tuple(_freeze(child, limit) for child in reversed(node.children)),",
                    1,
                )
            ],
        },
        "WR1-11": {
            "defect": "media query fabricated",
            "target": "media_query_not_fabricated",
            "patches": [
                (
                    "css_scan.py",
                    """    for label, css in sheets:
        cleaned = _strip_comments(css)
        _walk(cleaned, label, builder)
    return CssScan(""",
                    """    for label, css in sheets:
        cleaned = _strip_comments(css)
        _walk(cleaned, label, builder)
    builder.breakpoints.append(
        Breakpoint(
            query="(max-width: 1px)",
            min_width_px=None,
            max_width_px=1,
            features=("max-width: 1px",),
            source="@media (max-width: 1px)",
        )
    )
    return CssScan(""",
                    1,
                )
            ],
        },
        "WR1-12": {
            "defect": "WebGL becomes execution",
            "target": "webgl_observation_only",
            "patches": [
                (
                    "webgl.py",
                    '        object.__setattr__(self, "executed", False)',
                    '        object.__setattr__(self, "executed", True)',
                    1,
                ),
                (
                    "webgl.py",
                    '            "executed": False,',
                    '            "executed": True,',
                    1,
                ),
            ],
        },
        "WR1-13": {
            "defect": "camera invented",
            "target": "camera_not_invented",
            "patches": [
                (
                    "motion.py",
                    """def unobserved_camera() -> CameraObservation:
    return CameraObservation(
        status="UNOBSERVED",
        kind=None,
        position=(),""",
                    """def unobserved_camera() -> CameraObservation:
    return CameraObservation(
        status="DECLARED",
        kind="PerspectiveCamera",
        position=("0", "1", "5"),""",
                    1,
                )
            ],
        },
        "WR1-14": {
            "defect": "private IP accepted",
            "target": "obfuscated_loopback_refused",
            "patches": [
                (
                    "acquisition.py",
                    """    elif _restricted_host(parsed.host) and not authorization.allow_private_hosts:
        reasons.append(ReasonCode.PRIVATE_HOST_REFUSED)
""",
                    "",
                    1,
                )
            ],
        },
        "WR1-15": {
            "defect": "credential URL accepted",
            "target": "unsafe_schemes_and_credentials_refused",
            "patches": [
                (
                    "acquisition.py",
                    """    if parts.username is not None or parts.password is not None:
        return None, [ReasonCode.CREDENTIALS_IN_URL]
""",
                    "",
                    1,
                )
            ],
        },
        "WR1-16": {
            "defect": "path traversal retained",
            "target": "path_encoded_and_page_url_not_retained",
            "patches": [
                (
                    "assets.py",
                    "    absolute = urljoin(page_url, ref)",
                    '    absolute = ref if (".." in ref or "%2e" in ref.lower()) else urljoin(page_url, ref)',
                    1,
                )
            ],
        },
        "WR1-17": {
            "defect": "duplicate IDs normalized as proven",
            "target": "duplicate_ids_not_normalized",
            "patches": [
                (
                    "html_css.py",
                    '        attr_map = {name.lower(): ("" if value is None else value) for name, value in attrs}',
                    """        attr_map = {name.lower(): ("" if value is None else value) for name, value in attrs}
        seen_ids = getattr(self, "_seen_ids", None)
        if seen_ids is None:
            seen_ids = set()
            self._seen_ids = seen_ids
        if "id" in attr_map:
            if attr_map["id"] in seen_ids:
                attr_map["id"] = attr_map["id"] + "-normalized-proven"
            else:
                seen_ids.add(attr_map["id"])""",
                    1,
                )
            ],
        },
        "WR1-18": {
            "defect": "huge capture bypasses budget",
            "target": "huge_capture_budget",
            "patches": [
                (
                    "contract.py",
                    """    if _capture_size(html, sheets_in) > authorization.max_capture_bytes:
        return _refuse(decision, (ReasonCode.CAPTURE_TOO_LARGE.value,))
    if len(html) > bounds.max_html_chars:""",
                    """    if False and _capture_size(html, sheets_in) > authorization.max_capture_bytes:
        return _refuse(decision, (ReasonCode.CAPTURE_TOO_LARGE.value,))
    if False and len(html) > bounds.max_html_chars:""",
                    1,
                )
            ],
        },
        "WR1-19": {
            "defect": "gap disappears",
            "target": "gaps_remain",
            "patches": [
                (
                    "contract.py",
                    """    status = "INCOMPLETE" if truncated else "CONTRACT_READY"
    reasons = (ReasonCode.OBSERVATION_TRUNCATED.value,) if truncated else ()""",
                    """    status = "CONTRACT_READY"
    reasons = ()""",
                    1,
                ),
                (
                    "contract.py",
                    """        fidelity=_fidelity(xray.gaps),
        gaps=xray.gaps,""",
                    """        fidelity=_fidelity(()),
        gaps=(),""",
                    1,
                ),
            ],
        },
        "WR1-20": {
            "defect": "semantic_authority elevated",
            "target": "semantic_authority_none",
            "patches": [
                (
                    "contract.py",
                    '"semantic_authority": "NONE",',
                    '"semantic_authority": "VERIFIED",',
                    1,
                ),
                (
                    "xray.py",
                    '"semantic_authority": "NONE",',
                    '"semantic_authority": "VERIFIED",',
                    1,
                ),
            ],
        },
    }


def _apply(package: Path, patches: list[tuple[str, str, str, int]]) -> None:
    for filename, old, new, expected in patches:
        path = package / filename
        text = path.read_text(encoding="utf-8")
        found = text.count(old)
        if found != expected:
            raise RuntimeError(f"{filename} contains {old!r} {found} times, expected {expected}")
        path.write_text(text.replace(old, new, expected), encoding="utf-8")


def _stage(root: Path, patches: list[tuple[str, str, str, int]]) -> None:
    shutil.copytree(
        ROOT / "spe_runtime",
        root / "spe_runtime",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    _apply(root / "spe_runtime" / "webrecon", patches)


def _run_oracles(stage: Path | None) -> dict[str, dict[str, object]]:
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    prefix = ""
    if stage is not None:
        prefix = f"import sys; sys.path.insert(0, {str(stage)!r}); "
    code = (
        prefix
        + "import json; "
        + "from qualification.webrecon_r1.oracles import run_all; "
        + "print(json.dumps(run_all()))"
    )
    completed = subprocess.run(
        [sys.executable, "-c", code],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=120,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr[-2000:] or completed.stdout[-2000:])
    line = next(line for line in reversed(completed.stdout.splitlines()) if line.startswith("{"))
    payload = json.loads(line)
    if not isinstance(payload, dict):
        raise RuntimeError("oracle payload was not an object")
    return payload


def _pytest() -> dict[str, object]:
    PROOF.mkdir(parents=True, exist_ok=True)
    junit = PROOF / "junit.xml"
    log = PROOF / "pytest.txt"
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["PYTHONPATH"] = str(ROOT)
    completed = subprocess.run(
        [
            PYTEST,
            "-m",
            "pytest",
            "tests/unit/test_webrecon_foundation.py",
            "tests/unit/test_webrecon_r1_qualification.py",
            "-q",
            "--tb=line",
            f"--junitxml={junit}",
        ],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=180,
        check=False,
    )
    log.write_text(completed.stdout + "\n" + completed.stderr, encoding="utf-8")
    counts = {"collected": 0, "passed": 0, "failed": 0, "skipped": 0, "errors": 0, "exit_code": completed.returncode}
    if junit.exists():
        suite = ET.parse(junit).getroot()
        # pytest may wrap testsuites
        suites = [suite] if suite.tag == "testsuite" else list(suite.findall("testsuite"))
        for item in suites:
            counts["collected"] += int(item.attrib.get("tests", "0"))
            counts["failed"] += int(item.attrib.get("failures", "0"))
            counts["skipped"] += int(item.attrib.get("skipped", "0"))
            counts["errors"] += int(item.attrib.get("errors", "0"))
        counts["passed"] = counts["collected"] - counts["failed"] - counts["skipped"] - counts["errors"]
    return counts


def _runtime_dirty() -> list[str]:
    completed = subprocess.run(
        ["git", "status", "--porcelain", "--", "spe_runtime", "portable/spe-core-rs", "schemas"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    return [line for line in completed.stdout.splitlines() if line.strip()]


def _on_donor_line(head: str) -> bool:
    if head == DONOR_SHA:
        return True
    completed = subprocess.run(
        ["git", "merge-base", "--is-ancestor", DONOR_SHA, head],
        cwd=ROOT,
        check=False,
    )
    return completed.returncode == 0


def main() -> int:
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if not _on_donor_line(head):
        raise SystemExit(f"HEAD {head} is not a descendant of donor {DONOR_SHA}")
    sys.path.insert(0, str(ROOT))
    from qualification.webrecon_r1.oracles import run_all

    baseline = run_all()
    baseline_pass = {name for name, row in baseline.items() if row["pass"]}
    mutants_out: list[dict[str, object]] = []
    defined = _patches()
    with tempfile.TemporaryDirectory(prefix="wr1-") as tmp:
        tmp_path = Path(tmp)
        for mutant_id in [f"WR1-{index:02d}" for index in range(1, 21)]:
            spec = defined[mutant_id]
            stage = tmp_path / mutant_id
            try:
                _stage(stage, spec["patches"])  # type: ignore[arg-type]
                report = _run_oracles(stage)
            except Exception as exc:  # noqa: BLE001 — harness records a broken mutant
                mutants_out.append(
                    {
                        "id": mutant_id,
                        "defect": spec["defect"],
                        "target": spec["target"],
                        "status": "BROKEN",
                        "detail": f"{type(exc).__name__}: {exc}",
                        "donor_exhibits_target": baseline.get(str(spec["target"]), {}).get("pass") is False,
                        "discriminating_failures": [],
                    }
                )
                continue
            mutant_fail = {name for name, row in report.items() if not row["pass"]}
            discriminating = sorted(mutant_fail & baseline_pass)
            target = str(spec["target"])
            exhibits = baseline[target]["pass"] is False
            status = "KILLED" if discriminating else "SURVIVED"
            mutants_out.append(
                {
                    "id": mutant_id,
                    "defect": spec["defect"],
                    "target": target,
                    "status": status,
                    "donor_exhibits_target": exhibits,
                    "discriminating_failures": discriminating,
                }
            )
    counts = _pytest()
    killed = sum(1 for row in mutants_out if row["status"] == "KILLED")
    survived = sum(1 for row in mutants_out if row["status"] == "SURVIVED")
    broken = sum(1 for row in mutants_out if row["status"] == "BROKEN")
    exhibits = [row["id"] for row in mutants_out if row["donor_exhibits_target"]]
    baseline_failures = {name: row["failures"] for name, row in baseline.items() if not row["pass"]}
    dirty = _runtime_dirty()
    payload = {
        "head": head,
        "donor_sha": DONOR_SHA,
        "expected_donor_sha": DONOR_SHA,
        "defined": 20,
        "killed": killed,
        "survived": survived,
        "broken": broken,
        "donor_exhibits_target": exhibits,
        "baseline_failures": baseline_failures,
        "baseline_passed": sorted(baseline_pass),
        "mutants": mutants_out,
        "pytest": counts,
        "source_runtime_modified": bool(dirty),
        "source_runtime_status": dirty,
        "network_acquisition": "NONE",
        "live_fetch": False,
        "k3_integrated": False,
    }
    PROOF.mkdir(parents=True, exist_ok=True)
    (PROOF / "mutation_results.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    (PROOF / "baseline_oracles.json").write_text(json.dumps(baseline, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "killed": killed,
        "survived": survived,
        "broken": broken,
        "baseline_failures": list(baseline_failures),
        "pytest": counts,
        "source_runtime_modified": bool(dirty),
        "exhibits": exhibits,
    }, indent=2))
    if survived or broken or dirty:
        return 2
    if baseline_failures or counts["failed"] or counts["errors"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
