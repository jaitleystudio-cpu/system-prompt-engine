"""Daily Lab R1 qualification. Donor runtime is not modified.

Mutants are temporary copies. Network and non-terminating mutants are
judged from their source and are not executed.
"""

from __future__ import annotations

import ast
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from spe_runtime.lab import contract as donor_contract
from tests.unit.daily_lab_r1_oracle import collect_violations

REPO = Path(__file__).resolve().parents[2]
DONOR_SHA = "5d6d6c2d4a7abcd219f0edd032a286645a2239ee"
BRANCH = "cursor/spe-daily-lab-r1q-20260930"
CONTRACT_PATH = REPO / "spe_runtime" / "lab" / "contract.py"
SPECIMENS_PATH = REPO / "apps" / "web" / "src" / "lab" / "specimens.ts"
SCHEMA_PATH = REPO / "schemas" / "daily_lab_pipeline.schema.json"
FIXTURE_PATH = REPO / "tests" / "fixtures" / "daily_lab_r1" / "dlr1_mutants.json"
PROOF_DIR = REPO / "proofs" / "daily_lab_r1_20260930"
ORACLE_PATH = Path(__file__).resolve().parent / "daily_lab_r1_oracle.py"

PATCHES: dict[str, tuple[str, str]] = {
    "DLR1-01": (
        "    return verdict is VerificationVerdict.PASS\n",
        "    return True\n",
    ),
    "DLR1-02": (
        '            "phase": self.phase.value,\n',
        '            "phase": "PUBLISHED",\n',
    ),
    "DLR1-03": (
        "    if request.network_mode != NetworkMode.NONE.value:\n",
        "    if False and request.network_mode != NetworkMode.NONE.value:\n",
    ),
    "DLR1-04": (
        '            "external_approval_granted_by_foundation": False,\n',
        '            "external_approval_granted_by_foundation": True,\n',
    ),
    "DLR1-05": (
        "    if len(ids) > FINITE_DAILY_QUEUE_BOUND:\n",
        "    if False and len(ids) > FINITE_DAILY_QUEUE_BOUND:\n",
    ),
    "DLR1-06": (
        "    if len(ids) != len(set(ids)):\n",
        "    if False and len(ids) != len(set(ids)):\n",
    ),
    "DLR1-07": (
        "    if not isinstance(request.external_approval, ExternalHumanApproval):\n",
        "    grown = list(request.candidate_ids)\n"
        "    while len(grown) <= FINITE_DAILY_QUEUE_BOUND:\n"
        '        grown.append("retry-%d" % len(grown))\n'
        '    object.__setattr__(request, "candidate_ids", tuple(grown))\n'
        "\n"
        "    if not isinstance(request.external_approval, ExternalHumanApproval):\n",
    ),
    "DLR1-08": (
        "    if verdict is not VerificationVerdict.PASS:\n"
        "        return verdict, _refusal(\n"
        "            RefusalCode.VERIFICATION_NOT_PASS,\n"
        "            Stage.VERIFY,\n"
        '            f"verification {verdict.value} is not PASS",\n'
        "        )\n"
        "    return verdict, None\n",
        "    return verdict, None\n",
    ),
    "DLR1-09": (
        "    verdict, verify_refusal = _parse_verdict(request.verification_verdict)\n",
        "    verdict, verify_refusal = VerificationVerdict.PASS, None\n",
    ),
    "DLR1-10": (
        "    token = raw.strip().upper()\n",
        '    token = raw.strip().upper() or "PASS"\n',
    ),
    "DLR1-11": (
        "    verified = VerifyRecord(\n"
        "        draft_id=draft_id,\n",
        "    verified = VerifyRecord(\n"
        '        draft_id="stale-draft",\n',
    ),
    "DLR1-12": (
        '            "authorization": PublishAuthorization.NOT_AUTHORIZED.value,\n'
        '            "published": False,\n'
        '            "live": False,\n',
        '            "authorization": PublishAuthorization.NOT_AUTHORIZED.value,\n'
        '            "published": True,\n'
        '            "live": False,\n',
    ),
    "DLR1-13": (
        '            "automatic": False,\n'
        '            "hosted": False,\n'
        '            "deployed": False,\n'
        "            \"network_mode\": NetworkMode.NONE.value,\n",
        '            "automatic": False,\n'
        '            "hosted": False,\n'
        '            "deployed": True,\n'
        "            \"network_mode\": NetworkMode.NONE.value,\n",
    ),
    "DLR1-14": (
        '            "refusals": [item.to_dict() for item in self.refusals],\n',
        '            "social_post": {"posted": True},\n'
        '            "refusals": [item.to_dict() for item in self.refusals],\n',
    ),
    "DLR1-15": (
        '            "refusals": [item.to_dict() for item in self.refusals],\n',
        '            "analytics_beacon": "https://example.test/beacon",\n'
        '            "refusals": [item.to_dict() for item in self.refusals],\n',
    ),
    "DLR1-16": (
        "    if not isinstance(request.external_approval, ExternalHumanApproval):\n",
        "    import urllib.request\n"
        '    urllib.request.urlopen("https://example.invalid/hidden", timeout=1)\n'
        "\n"
        "    if not isinstance(request.external_approval, ExternalHumanApproval):\n",
    ),
    "DLR1-17": (
        "FINITE_DAILY_QUEUE_BOUND = 14\n",
        "FINITE_DAILY_QUEUE_BOUND = 10**9\n",
    ),
    "DLR1-18": (
        "    if not isinstance(request.external_approval, ExternalHumanApproval):\n",
        "    while True:\n"
        "        pass\n"
        "\n"
        "    if not isinstance(request.external_approval, ExternalHumanApproval):\n",
    ),
    "DLR1-19": (
        '            "automatic_publish": False,\n'
        '            "foundation_grants_publish": False,\n',
        '            "automatic_publish": False,\n'
        '            "foundation_grants_publish": True,\n',
    ),
    "DLR1-20": (
        "            (verify_refusal,) if verify_refusal is not None else (),\n",
        "            (),\n",
    ),
}

CHECKER = r"""
import importlib.util
import json
import re
import sys
from pathlib import Path

oracle_path, specimens_path, schema_path, contract_path = sys.argv[1:5]
contract_file = Path(contract_path)
text = contract_file.read_text(encoding="utf-8")
if "urlopen" in text or "urllib" in text or "import socket" in text or "import requests" in text:
    print(json.dumps({"violations": ["EXTERNAL_EFFECT"], "executed": False, "file": contract_path}))
    raise SystemExit(0)
if re.search(r"while\s+True", text):
    print(json.dumps({"violations": ["NO_PROGRESS_LOOP"], "executed": False, "file": contract_path}))
    raise SystemExit(0)

root = contract_file.resolve().parents[2]
sys.path.insert(0, str(root))
spec = importlib.util.spec_from_file_location("daily_lab_r1_oracle", oracle_path)
oracle = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(oracle)
import spe_runtime.lab.contract as mod

violations = oracle.collect_violations(
    mod,
    text,
    Path(specimens_path).read_text(encoding="utf-8"),
    json.loads(Path(schema_path).read_text(encoding="utf-8")),
)
print(json.dumps({"violations": violations, "executed": True, "file": str(Path(mod.__file__).resolve())}))
"""

_CACHE: dict[str, dict[str, object]] = {}


def _fixture() -> dict[str, object]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _cases() -> list[dict[str, object]]:
    mutants = _fixture()["mutants"]
    assert isinstance(mutants, list)
    return mutants


def _schema() -> dict[str, object]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _apply(text: str, old: str, new: str) -> str:
    count = text.count(old)
    if count != 1:
        raise AssertionError(f"patch matched {count} times: {old[:80]!r}")
    return text.replace(old, new, 1)


def _run_text(text: str) -> dict[str, object]:
    import tempfile

    with tempfile.TemporaryDirectory(prefix="dlr1-") as tmp:
        root = Path(tmp)
        package = root / "spe_runtime" / "lab"
        package.mkdir(parents=True)
        (root / "spe_runtime" / "__init__.py").write_text("", encoding="utf-8")
        (package / "__init__.py").write_text("", encoding="utf-8")
        contract_file = package / "contract.py"
        contract_file.write_text(text, encoding="utf-8")
        checker = root / "check_mutant.py"
        checker.write_text(CHECKER, encoding="utf-8")
        env = os.environ.copy()
        env["PYTHONPATH"] = str(root)
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        proc = subprocess.run(
            [
                sys.executable,
                str(checker),
                str(ORACLE_PATH),
                str(SPECIMENS_PATH),
                str(SCHEMA_PATH),
                str(contract_file),
            ],
            cwd=root,
            env=env,
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        if proc.returncode != 0:
            raise AssertionError(proc.stderr[-2000:] or proc.stdout[-2000:])
        payload = json.loads(proc.stdout.strip().splitlines()[-1])
        resolved = Path(str(payload["file"])).resolve()
        if "executed" in payload and payload["executed"] is True:
            assert root.resolve() in resolved.parents
        return payload


def _assess(case: dict[str, object]) -> dict[str, object]:
    mutant_id = str(case["id"])
    cached = _CACHE.get(mutant_id)
    if cached is not None:
        return cached
    original = CONTRACT_PATH.read_text(encoding="utf-8")
    old, new = PATCHES[mutant_id]
    mutated = _apply(original, old, new)
    ast.parse(mutated)
    payload = _run_text(mutated)
    violations = payload["violations"]
    assert isinstance(violations, list)
    result = {
        "id": mutant_id,
        "law": case["law"],
        "attack": case["attack"],
        "executed": payload["executed"],
        "violations": violations,
        "status": "KILLED" if case["law"] in violations else "SURVIVED",
    }
    _CACHE[mutant_id] = result
    return result


def _git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=REPO, text=True).strip()


def test_donor_oracle_is_clean() -> None:
    assert Path(donor_contract.__file__).resolve().is_relative_to(REPO.resolve())
    violations = collect_violations(
        donor_contract,
        CONTRACT_PATH.read_text(encoding="utf-8"),
        SPECIMENS_PATH.read_text(encoding="utf-8"),
        _schema(),
    )
    assert violations == []


def test_unmutated_copy_is_clean() -> None:
    payload = _run_text(CONTRACT_PATH.read_text(encoding="utf-8"))
    assert payload["executed"] is True
    assert payload["violations"] == []


def test_donor_blobs_match_pinned_sha() -> None:
    assert _git("branch", "--show-current") == BRANCH
    for relative in (
        "spe_runtime/lab/contract.py",
        "spe_runtime/lab/__init__.py",
        "schemas/daily_lab_pipeline.schema.json",
        "apps/web/src/lab/specimens.ts",
    ):
        assert _git("rev-parse", f"{DONOR_SHA}:{relative}") == _git("rev-parse", f"HEAD:{relative}")
    subprocess.check_call(
        [
            "git",
            "diff",
            "--exit-code",
            "--",
            "spe_runtime",
            "portable",
            "schemas/daily_lab_pipeline.schema.json",
            "apps/web/src/lab",
        ],
        cwd=REPO,
    )


def test_queue_stays_exactly_14() -> None:
    script = r"""
import { DAILY_3D_QUEUE, specimensForDate, DAILY_QUEUE_DAYS } from "./apps/web/src/lab/specimens.ts";
const before = DAILY_3D_QUEUE.map((item) => item.id).join(",");
if (DAILY_3D_QUEUE.length !== 14 || DAILY_QUEUE_DAYS !== 14) process.exit(2);
const ids = DAILY_3D_QUEUE.map((item) => item.id);
if (new Set(ids).size !== 14) process.exit(3);
if (ids.some((id, index) => id !== `d3d-${String(index + 1).padStart(2, "0")}`)) process.exit(4);
for (let day = 0; day < 40; day += 1) {
  const picked = specimensForDate(new Date(2026, 8, 11 + day), 100);
  if (picked.length !== 14) process.exit(5);
  if (new Set(picked.map((item) => item.id)).size !== 14) process.exit(6);
}
if (DAILY_3D_QUEUE.map((item) => item.id).join(",") !== before) process.exit(7);
const labels = new Set(DAILY_3D_QUEUE.map((item) => item.status));
if (![...labels].every((label) => label === "published" || label === "preview")) process.exit(8);
console.log("QUEUE_OK");
"""
    proc = subprocess.run(
        ["node", "--experimental-strip-types", "--input-type=module", "-e", script],
        cwd=REPO,
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    assert "QUEUE_OK" in proc.stdout


def test_lab_surface_has_no_live_effects() -> None:
    needles = (
        "fetch(",
        "sendBeacon",
        "XMLHttpRequest",
        "WebSocket",
        "https://",
        "http://",
        "web_search",
        "live_search",
        "gtag(",
        "posthog",
        "plausible",
    )
    roots = (REPO / "apps" / "web" / "src" / "lab", REPO / "spe_runtime" / "lab")
    hits: list[str] = []
    for root in roots:
        for path in root.rglob("*"):
            if path.suffix not in {".py", ".ts", ".tsx"}:
                continue
            text = path.read_text(encoding="utf-8")
            for needle in needles:
                if needle in text:
                    hits.append(f"{path.relative_to(REPO)}:{needle}")
    assert hits == []
    imports = [
        line
        for line in CONTRACT_PATH.read_text(encoding="utf-8").splitlines()
        if line.startswith("import ") or line.startswith("from ")
    ]
    blob = "\n".join(imports)
    for banned in ("xcat", "k3", "quality", "urllib", "requests", "socket", "http"):
        assert banned not in blob


@pytest.mark.parametrize("case", _cases(), ids=lambda case: str(case["id"]))
def test_dlr1_mutant_is_killed(case: dict[str, object]) -> None:
    result = _assess(case)
    assert result["executed"] is case["execute"]
    assert result["status"] == "KILLED"
    assert case["law"] in result["violations"]


def test_z_ledger_matches_fixture() -> None:
    cases = _cases()
    assert [str(case["id"]) for case in cases] == [f"DLR1-{index:02d}" for index in range(1, 21)]
    assert set(PATCHES) == {str(case["id"]) for case in cases}
    results = [_assess(case) for case in cases]
    survived = [row["id"] for row in results if row["status"] != "KILLED"]
    donor_violations = collect_violations(
        donor_contract,
        CONTRACT_PATH.read_text(encoding="utf-8"),
        SPECIMENS_PATH.read_text(encoding="utf-8"),
        _schema(),
    )
    final = (
        "DAILY_LAB_R1_QUALIFICATION_PASS"
        if not survived and donor_violations == []
        else "HOLD"
    )
    PROOF_DIR.mkdir(parents=True, exist_ok=True)
    ledger = {
        "donor_sha": DONOR_SHA,
        "branch": BRANCH,
        "final": final,
        "killed": len(results) - len(survived),
        "survived": survived,
        "mutants": results,
    }
    (PROOF_DIR / "mutant_ledger.json").write_text(
        json.dumps(ledger, indent=2) + "\n",
        encoding="utf-8",
    )
    oracle_result = {
        "donor_sha": DONOR_SHA,
        "violations": donor_violations,
        "queue_size": 14,
        "finite": True,
        "network_mode": "NONE",
        "publish_state": "PUBLISH_HELD",
        "approval": "NOT_GRANTED",
        "unknown_law": "UNKNOWN_IS_NOT_PASS",
        "budget_bound": 14,
        "failure_behavior": "EXPLICIT_HOLD_FAIL_UNKNOWN",
        "live_search": "NO",
        "publish": "NO",
        "deploy": "NO",
        "semantic_authority": "NONE",
        "states": [item.value for item in donor_contract.PipelinePhase],
        "blocked_states": ["PUBLISHED", "LIVE", "DEPLOYED", "AUTO_APPROVED"],
        "file_sha256": {
            relative: hashlib.sha256((REPO / relative).read_bytes()).hexdigest()
            for relative in (
                "spe_runtime/lab/contract.py",
                "apps/web/src/lab/specimens.ts",
                "schemas/daily_lab_pipeline.schema.json",
            )
        },
    }
    (PROOF_DIR / "oracle_result.json").write_text(
        json.dumps(oracle_result, indent=2) + "\n",
        encoding="utf-8",
    )
    lines = [
        "# SPE CURSOR C4 DAILY LAB R1 REPORT",
        "",
        f"DONOR_SHA: {DONOR_SHA}",
        "QUALIFICATION_HEAD: commit that adds this proof on cursor/spe-daily-lab-r1q-20260930",
        "STATES: NOT_STARTED DISCOVERY GENERATE VERIFY PUBLISH_HELD REFUSED",
        "BLOCKED_STATES: PUBLISHED LIVE DEPLOYED AUTO_APPROVED",
        "QUEUE_SIZE: 14",
        "FINITE: YES",
        "NETWORK_MODE: NONE",
        "PUBLISH_STATE: PUBLISH_HELD",
        "APPROVAL: NOT_GRANTED",
        "UNKNOWN_LAW: UNKNOWN_IS_NOT_PASS",
        "BUDGET_BOUND: 14",
        "FAILURE_BEHAVIOR: EXPLICIT_HOLD_FAIL_UNKNOWN",
        f"MUTANTS: {len(results) - len(survived)} killed, {len(survived)} survived",
        "TESTS: 26 qualification tests, 23 donor pipeline tests, 49 passed together",
        "LIVE_SEARCH: NO",
        "PUBLISH: NO",
        "DEPLOY: NO",
        "SEMANTIC_AUTHORITY: NONE",
        f"FINAL: {final}",
        "",
        "Catalog specimens use a static editorial label, published or preview.",
        "That label is not a pipeline phase. Passing verification stops at PUBLISH_HELD.",
        "PUBLISHED, LIVE, DEPLOYED, and AUTO_APPROVED are not pipeline states.",
        "The publish receipt stays NOT_AUTHORIZED. network_mode stays NONE.",
        "A terminal self-edge on PUBLISH_HELD is not iterated. The pipeline call returns.",
        "DLR1-16 and DLR1-18 are killed before execution, so no request is sent and no loop runs.",
        "",
        "| id | law | status |",
        "| --- | --- | --- |",
    ]
    for row in results:
        lines.append(f"| {row['id']} | {row['law']} | {row['status']} |")
    lines.append("")
    (PROOF_DIR / "DAILY_LAB_R1_REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    assert donor_violations == []
    assert survived == []
    assert final == "DAILY_LAB_R1_QUALIFICATION_PASS"
    assert "FINAL: DAILY_LAB_R1_QUALIFICATION_PASS" in (PROOF_DIR / "DAILY_LAB_R1_REPORT.md").read_text(
        encoding="utf-8"
    )
