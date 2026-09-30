"""Apply L10N1-01..L10N1-20 to a temporary copy of the donor locale module.

The worktree copy of packages/web-runtime is not modified. A mutant is killed
only when an oracle that passed on the donor fails on the mutant. An oracle
that already fails on the donor is donor evidence, not a kill.
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
PROOF = ROOT / "proofs" / "localization_r1_20260930"
DONOR_SHA = "693030a4419d76d7da6a648eb6af5129fcec81f8"
LOCALES = ROOT / "packages" / "web-runtime" / "src" / "locales.ts"
ORACLE = ROOT / "qualification" / "localization_r1" / "oracle.mjs"


def _can_import_pytest(python: str) -> bool:
    if not python or not Path(python).exists():
        return False
    probe = subprocess.run(
        [python, "-c", "import pytest"],
        capture_output=True,
        check=False,
    )
    return probe.returncode == 0


def _pytest_python() -> str:
    candidates: list[str] = []
    override = os.environ.get("L10N1_PYTEST")
    if override:
        candidates.append(override)
    candidates.append(sys.executable)
    pytest_bin = shutil.which("pytest")
    for bin_path in (
        pytest_bin,
        str(Path.home() / "system-prompt-engine/.venv/bin/pytest"),
        "/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/pytest",
    ):
        if not bin_path or not Path(bin_path).is_file():
            continue
        first = Path(bin_path).read_text(encoding="utf-8").splitlines()[0]
        if first.startswith("#!"):
            candidates.append(first[2:].strip())
    candidates.extend(
        [
            str(Path.home() / "system-prompt-engine/.venv/bin/python3.14"),
            "/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine/.venv/bin/python3.14",
        ]
    )
    for candidate in candidates:
        if _can_import_pytest(candidate):
            return candidate
    return sys.executable


def _patches() -> dict[str, dict[str, object]]:
    unpublished_gate = """    if (loc.id === DEFAULT_LOCALE.id) continue;
    // Strict Gate: Registered locale without published route must NEVER emit hreflang
    if (!published.has(loc.id)) continue;"""
    isolate = """export function isolateBidi(text: string): string {
  if (!text) return "";
  return `${BIDI_FSI}${text}${BIDI_PDI}`;
}"""
    xdefault = """    { hreflang: "x-default", href: cleanBase },"""
    en_push = """  if (published.has(DEFAULT_LOCALE.id)) {
    alternates.push({ hreflang: DEFAULT_LOCALE.id, href: cleanBase });
  }"""
    return {
        "L10N1-01": {
            "defect": "hreflang for unpublished locale",
            "target": "unpublished_registered_locales_omitted",
            "patches": [
                (
                    unpublished_gate,
                    "    if (loc.id === DEFAULT_LOCALE.id) continue;",
                    1,
                ),
                ("      : null;", "      : `https://unpublished.example/${loc.id}`;", 1),
            ],
        },
        "L10N1-02": {
            "defect": "hreflang for registered-only locale",
            "target": "unpublished_registered_locales_omitted",
            "patches": [
                (
                    "  return alternates;\n}",
                    """  for (const loc of SUPPORTED_LOCALES) {
    alternates.push({ hreflang: loc.id, href: `https://registered-only.example/${loc.id}` });
  }
  return alternates;
}""",
                    1,
                )
            ],
        },
        "L10N1-03": {
            "defect": "alternate URL invented",
            "target": "published_without_resolver_does_not_invent",
            "patches": [
                ("      : null;", "      : `${cleanBase}#invented-${loc.id}`;", 1),
            ],
        },
        "L10N1-04": {
            "defect": "x-default forged",
            "target": "default_alternates_point_at_published_canonical",
            "patches": [
                (xdefault, '    { hreflang: "x-default", href: "https://forged.example/x-default" },', 1),
            ],
        },
        "L10N1-05": {
            "defect": "RTL marks stripped",
            "target": "rtl_text_preserved_inside_isolate",
            "patches": [
                (
                    isolate,
                    """export function isolateBidi(text: string): string {
  if (!text) return "";
  const stripped = text.replace(/[\\u0590-\\u08FF]/g, "");
  return `${BIDI_FSI}${stripped}${BIDI_PDI}`;
}""",
                    1,
                )
            ],
        },
        "L10N1-06": {
            "defect": "bidi override accepted as content",
            "target": "bidi_override_not_accepted_as_content",
            "patches": [
                (
                    isolate,
                    """export function isolateBidi(text: string): string {
  return text ? text : "";
}""",
                    1,
                )
            ],
        },
        "L10N1-07": {
            "defect": "untranslated becomes translated",
            "target": "untranslated_locale_stays_marked",
            "patches": [('  return key;\n}', '  return "Home";\n}', 1)],
        },
        "L10N1-08": {
            "defect": "empty string becomes translation",
            "target": "empty_catalog_value_is_not_success",
            "patches": [("  return key;\n}", '  return "";\n}', 1)],
        },
        "L10N1-09": {
            "defect": "locale fallback silently changes meaning",
            "target": "locale_fallback_does_not_change_script_or_region",
            "patches": [
                (
                    """  if (LOCALE_BY_ID.has(clean)) {
    return LOCALE_BY_ID.get(clean)!;
  }""",
                    """  if (LOCALE_BY_ID.has(clean)) {
    return DEFAULT_LOCALE;
  }""",
                    1,
                )
            ],
        },
        "L10N1-10": {
            "defect": "language tag fabricated",
            "target": "hreflang_tags_are_registered_or_xdefault",
            "patches": [
                (
                    en_push,
                    en_push + '\n  alternates.push({ hreflang: "eng", href: cleanBase });',
                    1,
                )
            ],
        },
        "L10N1-11": {
            "defect": "region treated as translation",
            "target": "region_is_not_a_translation",
            "patches": [
                (
                    """  if (table && key in table) {
    return table[key];
  }""",
                    """  if (table && key in table) {
    return resolved.region || resolved.numberLocale;
  }""",
                    1,
                )
            ],
        },
        "L10N1-12": {
            "defect": "canonical locale dropped",
            "target": "canonical_en_emitted_when_published",
            "patches": [
                (
                    "  if (published.has(DEFAULT_LOCALE.id)) {",
                    "  if (false && published.has(DEFAULT_LOCALE.id)) {",
                    1,
                )
            ],
        },
        "L10N1-13": {
            "defect": "semantic authority elevated",
            "target": "semantic_authority_not_elevated",
            "patches": [
                (
                    "export const LANGUAGE_IS_NOT_COUNTRY = true as const;",
                    'export const LANGUAGE_IS_NOT_COUNTRY = true as const;\nexport const SEMANTIC_AUTHORITY = "FULL";',
                    1,
                )
            ],
        },
        "L10N1-14": {
            "defect": "hreflang for registered-only locale",
            "target": "publication_registry_is_published_en_only",
            "patches": [
                (
                    'export const PUBLISHED_LOCALES: readonly string[] = ["en"] as const;',
                    'export const PUBLISHED_LOCALES: readonly string[] = ["en", "es", "ar", "ja", "zh-Hans", "hi", "pt-BR", "de", "fr"] as const;',
                    1,
                ),
                ("      : null;", "      : `https://registered-only.example/${loc.id}`;", 1),
            ],
        },
        "L10N1-15": {
            "defect": "x-default forged",
            "target": "x_default_target_is_a_published_locale_url",
            "patches": [
                (
                    xdefault,
                    '    { hreflang: "x-default", href: "https://systempromptengine.com/ar/create" },',
                    1,
                )
            ],
        },
        "L10N1-16": {
            "defect": "RTL marks stripped",
            "target": "isolation_wraps_fsi_pdi",
            "patches": [
                (
                    isolate,
                    """export function isolateBidi(text: string): string {
  if (!text) return "";
  return `${BIDI_FSI}${text}`;
}""",
                    1,
                )
            ],
        },
        "L10N1-17": {
            "defect": "bidi override accepted as content",
            "target": "isolation_uses_fsi_not_override",
            "patches": [
                (
                    isolate,
                    """export function isolateBidi(text: string): string {
  if (!text) return "";
  return `\\u202E${text}${BIDI_PDI}`;
}""",
                    1,
                )
            ],
        },
        "L10N1-18": {
            "defect": "untranslated becomes translated",
            "target": "translated_catalog_kept",
            "patches": [
                (
                    '  const resolved = resolveLocale(localeId);',
                    '  const resolved = resolveLocale("en");',
                    1,
                )
            ],
        },
        "L10N1-19": {
            "defect": "language tag fabricated",
            "target": "fallback_locale_id_is_registered",
            "patches": [
                (
                    "  return DEFAULT_LOCALE;\n}",
                    '  return { ...DEFAULT_LOCALE, id: "zz-FABRICATED", language: "zz" };\n}',
                    1,
                )
            ],
        },
        "L10N1-20": {
            "defect": "semantic authority elevated",
            "target": "semantic_authority_not_elevated",
            "patches": [
                (
                    xdefault,
                    '    { hreflang: "x-default", href: cleanBase, semanticAuthority: "CANONICAL" },',
                    1,
                )
            ],
        },
    }


def _apply(text: str, patches: list[tuple[str, str, int]]) -> str:
    for old, new, count in patches:
        found = text.count(old)
        if found != count:
            raise RuntimeError(f"expected {count} occurrence(s), found {found} for {old[:120]!r}")
        text = text.replace(old, new)
    return text


def _run_oracles(module_path: Path) -> dict[str, dict[str, object]]:
    env = os.environ.copy()
    env["L10N_REPO_ROOT"] = str(ROOT)
    env["L10N_LOCALES_MODULE"] = str(module_path)
    completed = subprocess.run(
        ["node", "--experimental-strip-types", str(ORACLE)],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=60,
        check=False,
    )
    if not completed.stdout.strip():
        raise RuntimeError(completed.stderr.strip() or f"oracle exit {completed.returncode}")
    payload = json.loads(completed.stdout)
    if isinstance(payload, dict) and payload.get("__error"):
        raise RuntimeError(str(payload["__error"]))
    return payload


def _stage(directory: Path, patches: list[tuple[str, str, int]]) -> Path:
    directory.mkdir(parents=True)
    target = directory / "locales.ts"
    target.write_text(_apply(LOCALES.read_text(encoding="utf-8"), patches), encoding="utf-8")
    return target


def _pytest() -> dict[str, object]:
    PROOF.mkdir(parents=True, exist_ok=True)
    junit = PROOF / "junit.xml"
    log = PROOF / "pytest.txt"
    if junit.exists():
        junit.unlink()
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["L10N_REPO_ROOT"] = str(ROOT)
    python = _pytest_python()
    completed = subprocess.run(
        [
            python,
            "-m",
            "pytest",
            "tests/web/test_localization_architecture.py",
            "tests/web/test_localization_r1_qualification.py",
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
    counts: dict[str, object] = {
        "collected": 0,
        "passed": 0,
        "failed": 0,
        "skipped": 0,
        "errors": 0,
        "exit_code": completed.returncode,
    }
    if junit.exists():
        suite = ET.parse(junit).getroot()
        suites = [suite] if suite.tag == "testsuite" else list(suite.findall("testsuite"))
        collected = failed = skipped = errors = 0
        for item in suites:
            collected += int(item.attrib.get("tests", "0"))
            failed += int(item.attrib.get("failures", "0"))
            skipped += int(item.attrib.get("skipped", "0"))
            errors += int(item.attrib.get("errors", "0"))
        counts["collected"] = collected
        counts["failed"] = failed
        counts["skipped"] = skipped
        counts["errors"] = errors
        counts["passed"] = collected - failed - skipped - errors
    return counts


def _runtime_dirty() -> list[str]:
    completed = subprocess.run(
        [
            "git",
            "status",
            "--porcelain",
            "--",
            "packages/web-runtime",
            "apps/web/src",
            "apps/web/scripts",
            "spe_runtime",
            "portable/spe-core-rs",
        ],
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
    defined = _patches()
    expected = [f"L10N1-{index:02d}" for index in range(1, 21)]
    if list(defined) != expected:
        raise SystemExit(f"mutant catalog is {list(defined)}")
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if not _on_donor_line(head):
        raise SystemExit(f"HEAD {head} is not a descendant of donor {DONOR_SHA}")

    baseline = _run_oracles(LOCALES)
    baseline_pass = {name for name, row in baseline.items() if row["pass"]}
    mutants_out: list[dict[str, object]] = []
    with tempfile.TemporaryDirectory(prefix="l10n1-") as tmp:
        tmp_path = Path(tmp)
        for mutant_id in expected:
            spec = defined[mutant_id]
            stage = tmp_path / mutant_id
            try:
                module_path = _stage(stage, spec["patches"])  # type: ignore[arg-type]
                report = _run_oracles(module_path)
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
        "defined": 20,
        "killed": killed,
        "survived": survived,
        "broken": broken,
        "donor_exhibits_target": exhibits,
        "baseline_failures": baseline_failures,
        "baseline_passed": sorted(baseline_pass),
        "mutants": mutants_out,
        "pytest_python": _pytest_python(),
        "pytest": counts,
        "source_runtime_modified": bool(dirty),
        "source_runtime_status": dirty,
        "network_acquisition": "NONE",
        "live_fetch": False,
        "k3_integrated": False,
        "pr_number": None,
    }
    PROOF.mkdir(parents=True, exist_ok=True)
    (PROOF / "mutation_results.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    (PROOF / "baseline_oracles.json").write_text(json.dumps(baseline, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "killed": killed,
                "survived": survived,
                "broken": broken,
                "baseline_failures": list(baseline_failures),
                "pytest": counts,
                "source_runtime_modified": bool(dirty),
                "exhibits": exhibits,
                "broken_detail": [
                    {"id": row["id"], "detail": row.get("detail")}
                    for row in mutants_out
                    if row["status"] == "BROKEN"
                ],
                "survived_detail": [
                    {"id": row["id"], "defect": row["defect"]}
                    for row in mutants_out
                    if row["status"] == "SURVIVED"
                ],
            },
            indent=2,
        )
    )
    if survived or broken or dirty:
        return 2
    if baseline_failures or counts["failed"] or counts["errors"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
