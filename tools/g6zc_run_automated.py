#!/usr/bin/env python3
"""G6-ZC automated offline product-value checks (no LLM judges, no paid APIs)."""

from __future__ import annotations

import hashlib
import json
import statistics
import sys
import time
import traceback
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from spe_runtime.core import compile_portable_request
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.prompt.techniques import STANDARD_MAX_TECHNIQUES

BM = ROOT / "benchmarks/g6zc"
PROOF = ROOT / "proofs/g6zc"
PROOF.mkdir(parents=True, exist_ok=True)
(PROOF / "failures").mkdir(exist_ok=True)


def load_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


@dataclass
class ArmResult:
    ok: bool
    rendered: str = ""
    digest: str = ""
    techniques: tuple = ()
    error_code: str | None = None
    error_msg: str = ""
    contract_validity: str = ""
    elapsed_ms: float = 0.0


def compile_task(task: dict) -> ArmResult:
    """Compile ARM B. Conflict-tagged tasks use same-key opposing requirements."""
    from spe_runtime.contract import ProtectedIntentContract, propose_requirement
    from spe_runtime.provenance import Provenance
    from spe_runtime.prompt import build_prompt_artifact
    from spe_runtime.requirements import RequirementKind

    t0 = time.perf_counter()
    tags = set(task.get("tags") or [])
    try:
        if "conflict" in tags or task.get("expected_conflicts"):
            c = ProtectedIntentContract()
            c = propose_requirement(
                c,
                semantic_key="goal",
                kind=RequirementKind.MUST,
                value=task["raw_request"],
                provenance=Provenance.USER_EXPLICIT,
                source_ref="user.request",
            )
            musts = list(task.get("must") or [])
            must_nots = list(task.get("must_not") or [])
            # Prefer explicit MUST/MUST_NOT on shared keys when values overlap
            shared = [v for v in musts if v in must_nots]
            if shared:
                for i, v in enumerate(shared):
                    key = f"conflict.{i}"
                    c = propose_requirement(
                        c, semantic_key=key, kind=RequirementKind.MUST, value=v,
                        provenance=Provenance.USER_EXPLICIT, source_ref=f"conflict.must.{i}",
                    )
                    c = propose_requirement(
                        c, semantic_key=key, kind=RequirementKind.MUST_NOT, value=v,
                        provenance=Provenance.USER_EXPLICIT, source_ref=f"conflict.must_not.{i}",
                    )
            elif len(musts) >= 2:
                # Mutually exclusive MUSTs on same semantic key (e.g. JSON vs prose)
                key = "format"
                for i, v in enumerate(musts[:2]):
                    c = propose_requirement(
                        c, semantic_key=key, kind=RequirementKind.MUST, value=v,
                        provenance=Provenance.USER_EXPLICIT, source_ref=f"conflict.fmt.{i}",
                    )
            else:
                # Fall back to portable compile
                return _compile_portable(task, t0)

            art = build_prompt_artifact(c)
            elapsed = (time.perf_counter() - t0) * 1000
            return ArmResult(
                ok=True,
                rendered=art.rendered_prompt,
                digest=art.prompt_content_digest,
                contract_validity=str(c.validity),
                elapsed_ms=elapsed,
            )

        return _compile_portable(task, t0)
    except SpeTypedError as exc:
        elapsed = (time.perf_counter() - t0) * 1000
        return ArmResult(
            ok=False,
            error_code=exc.code.value if hasattr(exc.code, "value") else str(exc.code),
            error_msg=str(exc),
            elapsed_ms=elapsed,
        )


def _compile_portable(task: dict, t0: float) -> ArmResult:
    kw = task.get("compile_kwargs") or {}
    r = compile_portable_request(
        task["raw_request"],
        must=kw.get("must") or (),
        must_not=kw.get("must_not") or (),
        preferences=kw.get("preferences") or (),
    )
    art = r.prompt_artifact
    elapsed = (time.perf_counter() - t0) * 1000
    return ArmResult(
        ok=True,
        rendered=art.rendered_prompt,
        digest=art.prompt_content_digest,
        contract_validity=str(r.contract.validity),
        elapsed_ms=elapsed,
    )


def substring_hits(text: str, needles: list[str]) -> tuple[int, int]:
    if not needles:
        return 0, 0
    hits = sum(1 for n in needles if n and n.lower() in text.lower())
    return hits, len(needles)


def invented_signal(task: dict, rendered: str) -> list[str]:
    """Heuristic drift detectors — flags only, not LLM judgments."""
    flags = []
    unknowns = task.get("expected_unknowns") or []
    # If SPE invents concrete platforms for ambiguous app requests
    if "platform" in unknowns or "framework" in unknowns:
        for word in ("React Native", "Flutter", "Firebase Auth", "MongoDB Atlas", "AWS Amplify"):
            if word.lower() in rendered.lower() and word.lower() not in task["raw_request"].lower():
                flags.append(f"possible_invented:{word}")
    # Fabricated citation patterns
    for pat in ("doi:", "http://example.com/proven", "according to studies proving"):
        if pat in rendered.lower():
            flags.append(f"possible_fabricated_evidence:{pat}")
    return flags


def main() -> int:
    corpus = load_json(BM / "corpus.json")
    manifest = load_json(BM / "benchmark_manifest.json")
    assert sha256_file(BM / "corpus.json") == manifest["corpus_sha256"]
    assert sha256_file(BM / "rubric.json") == (BM / "rubric_sha256.txt").read_text().split()[0]
    assert sha256_file(BM / "thresholds.json") == (BM / "thresholds_sha256.txt").read_text().split()[0]

    tasks = corpus["tasks"]
    results = []
    failures = []
    latencies = []
    digests_first = {}
    digests_second = {}

    must_raw_hits = must_spe_hits = must_total = 0
    must_not_raw = must_not_spe = must_not_total = 0
    conflict_ok = conflict_n = 0
    unknown_ok = unknown_n = 0
    trivial_bloat = []
    tech_notes = []
    drift_findings = []

    for task in tasks:
        tid = task["task_id"]
        raw = task["raw_request"]
        arm = compile_task(task)
        # determinism second compile for successful path
        arm2 = compile_task(task) if arm.ok or arm.error_code else arm

        raw_len = len(raw)
        spe_text = arm.rendered if arm.ok else ""
        spe_len = len(spe_text)
        expansion = (spe_len / raw_len) if raw_len else None

        # constraint recall vs RAW (RAW is just the user string)
        mh, mt = substring_hits(raw, task.get("must") or [])
        # For SPE: if conflict expected, success is typed conflict error
        if task.get("expected_conflicts"):
            conflict_n += 1
            if (not arm.ok) and arm.error_code == ErrorCode.K3_PROMPT_CONFLICTED_SOURCE.value:
                conflict_ok += 1
            elif (not arm.ok) and "CONFLICT" in (arm.error_code or ""):
                conflict_ok += 1
            else:
                # also check contract if somehow compiled
                failures.append({"task_id": tid, "kind": "conflict_not_fail_closed", "detail": arm.error_code})
            must_h, must_t = 0, len(task.get("must") or [])
            must_total += must_t
            # RAW "preservation" for conflicts is N/A — raw doesn't resolve
        else:
            must_h, must_t = substring_hits(spe_text, task.get("must") or [])
            must_total += must_t
            must_spe_hits += must_h
            must_raw_hits += mh
            mnh, mnt = substring_hits(spe_text, task.get("must_not") or [])
            # MUST_NOT recall: presence of the forbidden phrase in SPE prompt as a constraint mention is good;
            # we check the constraint text appears in protected sections rather than being dropped.
            must_not_total += mnt
            must_not_spe += mnh
            must_not_raw += substring_hits(raw, task.get("must_not") or [])[0]

        if task.get("expected_unknowns"):
            unknown_n += 1
            # Pass if SPE does not claim those unknowns as settled facts via invented_signal
            flags = invented_signal(task, spe_text) if arm.ok else []
            if not flags:
                unknown_ok += 1
            else:
                drift_findings.append({"task_id": tid, "flags": flags})
                failures.append({"task_id": tid, "kind": "possible_semantic_drift", "flags": flags})

        if "trivial" in (task.get("tags") or []) or task.get("complexity_class") == "simple" and "anti_gaming" in (task.get("tags") or []):
            if expansion is not None:
                trivial_bloat.append({"task_id": tid, "raw_len": raw_len, "spe_len": spe_len, "expansion": round(expansion, 3)})

        if arm.ok:
            digests_first[tid] = arm.digest
            digests_second[tid] = arm2.digest if arm2.ok else None
            latencies.append(arm.elapsed_ms)
            # technique budget: count TECHNIQUES section lines roughly
            tech_count = spe_text.count("===SPE_TECHNIQUES_V1===")
            tech_notes.append({"task_id": tid, "has_technique_section": tech_count > 0, "complexity": task.get("complexity_class")})

        results.append({
            "task_id": tid,
            "category": task["category"],
            "language": task["language"],
            "complexity_class": task["complexity_class"],
            "tags": task["tags"],
            "compile_ok": arm.ok,
            "error_code": arm.error_code,
            "raw_chars": raw_len,
            "spe_chars": spe_len,
            "expansion_ratio": round(expansion, 4) if expansion is not None else None,
            "digest": arm.digest or None,
            "elapsed_ms": round(arm.elapsed_ms, 3),
            "arm_a": raw,
            "arm_b_ok": arm.ok,
            "arm_b_preview": (spe_text[:240] + "…") if len(spe_text) > 240 else spe_text,
        })

    # Determinism
    det_mismatches = [tid for tid, d1 in digests_first.items() if digests_second.get(tid) != d1]
    determinism = {
        "compiled_ok": len(digests_first),
        "mismatches": len(det_mismatches),
        "mismatch_ids": det_mismatches[:20],
        "pass": len(det_mismatches) == 0,
    }

    def pct(num, den):
        return round(100.0 * num / den, 2) if den else None

    automated = {
        "n_tasks": len(tasks),
        "compile_success": sum(1 for r in results if r["compile_ok"]),
        "compile_typed_fail": sum(1 for r in results if not r["compile_ok"]),
        "MUST_preservation_SPE_hits": must_spe_hits,
        "MUST_preservation_RAW_hits": must_raw_hits,
        "MUST_total_atoms": must_total,
        "MUST_SPE_recall": pct(must_spe_hits, must_total),
        "MUST_RAW_recall": pct(must_raw_hits, must_total),
        "MUST_NOT_SPE_hits": must_not_spe,
        "MUST_NOT_total": must_not_total,
        "MUST_NOT_SPE_recall": pct(must_not_spe, must_not_total),
        "conflict_tasks": conflict_n,
        "conflict_fail_closed": conflict_ok,
        "conflict_preservation_rate": pct(conflict_ok, conflict_n),
        "unknown_tasks": unknown_n,
        "unknown_no_invent_flags": unknown_ok,
        "unknown_preservation_rate": pct(unknown_ok, unknown_n),
        "drift_findings_count": len(drift_findings),
        "STANDARD_MAX_TECHNIQUES": STANDARD_MAX_TECHNIQUES,
    }

    lat_sorted = sorted(latencies)
    def pctile(xs, p):
        if not xs:
            return None
        k = max(0, min(len(xs) - 1, int(round((p / 100) * (len(xs) - 1)))))
        return round(xs[k], 3)

    latency = {
        "n": len(latencies),
        "median_ms": round(statistics.median(latencies), 3) if latencies else None,
        "p95_ms": pctile(lat_sorted, 95),
        "p99_ms": pctile(lat_sorted, 99),
    }

    bloat = {
        "per_task": [
            {"task_id": r["task_id"], "raw_chars": r["raw_chars"], "spe_chars": r["spe_chars"], "expansion": r["expansion_ratio"], "complexity": r["complexity_class"]}
            for r in results if r["compile_ok"]
        ],
        "trivial_anti_gaming": trivial_bloat,
        "median_expansion_ok_compiles": round(
            statistics.median([r["expansion_ratio"] for r in results if r["compile_ok"] and r["expansion_ratio"]]),
            3,
        ) if any(r["compile_ok"] for r in results) else None,
    }

    # Local model inventory (detect only — do not download)
    local_model = {"ollama": False, "llama_cpp": False, "mlx": False, "onnx": False, "available": False}
    import shutil
    if shutil.which("ollama"):
        local_model["ollama"] = True
        local_model["available"] = True
    local_model["LOCAL_MODEL_OUTCOME_EVIDENCE"] = "AVAILABLE" if local_model["available"] else "NOT_AVAILABLE"
    local_model["required"] = False

    # Pair arms for evaluator (blinded files without labels)
    rand = load_json(BM / "randomization_manifest.json")["mapping"]
    # Build full SPE renders once from results + re-read compiled text from second pass store
    compiled_full = {}
    for task in tasks:
        ar = compile_task(task)
        compiled_full[task["task_id"]] = ar

    pairs = []
    for task in tasks:
        tid = task["task_id"]
        m = rand[tid]
        ar = compiled_full[tid]
        spe_render = ar.rendered if ar.ok else f"[COMPILE_FAILED:{ar.error_code}]"
        left_full = task["raw_request"] if m["raw_side"] == "LEFT" else spe_render
        right_full = task["raw_request"] if m["raw_side"] == "RIGHT" else spe_render
        pairs.append({
            "task_id": tid,
            "category": task["category"],
            "language": task["language"],
            "left": left_full,
            "right": right_full,
        })

    eval_dir = ROOT / "evaluations/g6zc"
    eval_dir.mkdir(parents=True, exist_ok=True)
    # Blind pairs for UI — no spe/raw labels
    (eval_dir / "blind_pairs.json").write_text(json.dumps({"pairs": pairs, "n": len(pairs)}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    # Secret mapping stays under proofs, not evaluations public UI folder note
    (PROOF / "randomization_secret_note.json").write_text(json.dumps({
        "mapping_path": "benchmarks/g6zc/randomization_manifest.json",
        "reveal_after_evaluation": True,
    }, indent=2) + "\n")

    # Write evidence
    (PROOF / "automated_semantic_results.json").write_text(json.dumps(automated, indent=2) + "\n")
    (PROOF / "constraint_preservation.json").write_text(json.dumps({
        "MUST_SPE_recall": automated["MUST_SPE_recall"],
        "MUST_RAW_recall": automated["MUST_RAW_recall"],
        "MUST_NOT_SPE_recall": automated["MUST_NOT_SPE_recall"],
        "note": "Substring recall of declared constraint atoms in prompt text; conflicts handled separately",
    }, indent=2) + "\n")
    (PROOF / "ambiguity_results.json").write_text(json.dumps({
        "unknown_preservation_rate": automated["unknown_preservation_rate"],
        "drift_findings": drift_findings,
    }, indent=2) + "\n")
    (PROOF / "conflict_results.json").write_text(json.dumps({
        "conflict_tasks": conflict_n,
        "fail_closed": conflict_ok,
        "rate": automated["conflict_preservation_rate"],
    }, indent=2) + "\n")
    (PROOF / "multilingual_results.json").write_text(json.dumps({
        "languages": manifest["languages"],
        "tasks_by_language": {
            lang: sum(1 for t in tasks if t["language"] == lang) for lang in manifest["languages"]
        },
        "note": "Does NOT claim universal multilingual support",
    }, indent=2) + "\n")
    (PROOF / "prompt_bloat.json").write_text(json.dumps(bloat, indent=2) + "\n")
    (PROOF / "technique_efficiency.json").write_text(json.dumps({
        "STANDARD_MAX_TECHNIQUES": STANDARD_MAX_TECHNIQUES,
        "notes": tech_notes[:30],
        "count": len(tech_notes),
    }, indent=2) + "\n")
    (PROOF / "latency.json").write_text(json.dumps(latency, indent=2) + "\n")
    (PROOF / "determinism.json").write_text(json.dumps(determinism, indent=2) + "\n")
    (PROOF / "local_model_inventory.json").write_text(json.dumps(local_model, indent=2) + "\n")
    (PROOF / "local_model_results.json").write_text(json.dumps({
        "ran": False,
        "reason": "LOCAL_MODEL_OUTCOME_EVIDENCE = NOT_AVAILABLE" if not local_model["available"] else "available_but_optional_lane_deferred_for_harness_pass",
    }, indent=2) + "\n")
    (PROOF / "failure_cases.json").write_text(json.dumps({"failures": failures, "count": len(failures)}, indent=2) + "\n")
    (PROOF / "task_compile_results.json").write_text(json.dumps({"results": results}, indent=2, ensure_ascii=False) + "\n")

    # Human results placeholder — no fabrication
    (PROOF / "human_results.json").write_text(json.dumps({
        "status": "NO_RATINGS_YET",
        "evaluators": 0,
        "paired_evaluations": 0,
        "SPE_preferred": None,
        "RAW_preferred": None,
        "ties": None,
        "limitation": "SINGLE_EVALUATOR_LIMITATION / PRODUCT_VALUE_REVIEW_PENDING until blinded ratings exist",
        "do_not_fabricate": True,
    }, indent=2) + "\n")
    (PROOF / "preference_results.json").write_text(json.dumps({
        "status": "PENDING_HUMAN_EVIDENCE",
    }, indent=2) + "\n")
    (PROOF / "category_results.json").write_text(json.dumps({
        "status": "PENDING_HUMAN_EVIDENCE",
        "automated_compile_by_category": {
            cid: {
                "n": sum(1 for r in results if r["category"] == cid),
                "compile_ok": sum(1 for r in results if r["category"] == cid and r["compile_ok"]),
            }
            for cid in sorted({r["category"] for r in results})
        },
    }, indent=2) + "\n")

    print(json.dumps({
        "compile_ok": automated["compile_success"],
        "compile_fail": automated["compile_typed_fail"],
        "conflict_rate": automated["conflict_preservation_rate"],
        "determinism_pass": determinism["pass"],
        "latency_median_ms": latency["median_ms"],
        "failures": len(failures),
        "local_model": local_model["LOCAL_MODEL_OUTCOME_EVIDENCE"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
