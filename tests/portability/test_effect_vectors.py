"""Effect vectors through Python and native Rust. WASM is checked when the host artifact exists."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from spe_runtime.k3.effect import bind_prompt_effects
from spe_runtime.k3.registry import UNIMPLEMENTED_XCAT
from spe_runtime.k3.selector import select_prompt_techniques
from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.requirements.project import build_requirement_graph

REPO = Path(__file__).resolve().parents[2]
RUST_BIN = REPO / "portable" / "spe-core-rs" / "target" / "debug" / "spe-core-eval"
PUBLIC_WASM = REPO / "apps" / "web" / "public" / "spe_wasm.wasm"
WASM_HOST = REPO / "tools" / "spe_wasm_node_host.js"

BASE = {
    "goal": "Summarize the supplied notes.",
    "hard_constraints": [{"constraint_id": "c1", "statement": "Do not add obligations."}],
    "budget": {"amount": 2000, "currency": "USD", "hard": True},
    "desired_output": "A short summary.",
    "facts": [{"fact_id": "f1", "statement": "Notes exist."}],
    "authority_state": {"level": 0, "status": "NONE", "grants": []},
    "provenance": [{"provenance_id": "p1", "source": "user"}],
}


def _protected(**overrides: object) -> dict:
    merged = json.loads(json.dumps(BASE))
    merged.update(overrides)
    return merged


def _example() -> dict:
    body = _protected()
    body["user_preferences"] = [
        {
            "preference_id": "desired-example",
            "statement": "=== EXAMPLE / USER_SUPPLIED (NON-AUTHORITATIVE) ===\nPattern A\n=== END EXAMPLE / USER_SUPPLIED ===",
        }
    ]
    return body


def _role() -> dict:
    body = _protected()
    body["user_preferences"] = [{"preference_id": "brief-role", "statement": "a careful editor"}]
    return body


def _schema() -> dict:
    return _protected(desired_output={"type": "object", "required": ["summary"]})


def _selection(techniques: list[str], protected: dict, **extra: object) -> dict:
    graph = build_requirement_graph(protected, extra.get("category") if isinstance(extra.get("category"), dict) else None)
    binding = {
        "goal": protected.get("goal") if isinstance(protected.get("goal"), str) else "",
        "hard_constraints": list(protected.get("hard_constraints") or []),
        "budget": protected.get("budget", None),
        "desired_output": protected.get("desired_output", None),
        "facts": list(protected.get("facts") or []),
        "authority_state": dict(protected.get("authority_state") or {}),
        "provenance": list(protected.get("provenance") or []),
    }
    return {
        "disposition": extra.get("disposition", "SELECTED"),
        "techniques": techniques,
        "selection_id": extra.get("selection_id", "tsel-vector"),
        "notes": extra.get("notes", ["SELECTED"]),
        "deferred_techniques": extra.get("deferred", []),
        "protected_binding": binding,
        "requirement_graph": graph,
        "claims_pass": False,
    }


def vectors() -> list[dict]:
    rows: list[dict] = []
    normal_techniques = [
        ("N01", ["ZERO_SHOT"], _protected()),
        ("N02", ["FEW_SHOT"], _example()),
        ("N03", ["ROLE_PERSONA"], _role()),
        ("N04", ["ROLE_PERSONA"], _protected()),
        ("N05", ["CONTEXTUAL"], _protected()),
        ("N06", ["STEP_BACK"], _protected()),
        ("N07", ["DECOMPOSE_PLAN_SOLVE"], _protected()),
        ("N08", ["RETRIEVE_REASON"], _protected()),
        ("N09", ["CRITIQUE_REVISE"], _protected()),
        ("N10", ["STRUCTURED_OUTPUT"], _schema()),
        ("N11", ["CONTEXTUAL", "ZERO_SHOT"], _protected()),
        ("N12", ["DECOMPOSE_PLAN_SOLVE", "ZERO_SHOT"], _protected()),
        ("N13", ["CRITIQUE_REVISE", "ZERO_SHOT"], _protected()),
        ("N14", ["RETRIEVE_REASON", "STEP_BACK", "ZERO_SHOT"], _protected()),
        ("N15", ["STRUCTURED_OUTPUT", "ZERO_SHOT"], _schema()),
        ("N16", ["ROLE_PERSONA", "STEP_BACK", "ZERO_SHOT"], _role()),
        ("N17", ["CONTEXTUAL", "STEP_BACK", "ZERO_SHOT"], _protected()),
        ("N18", ["DECOMPOSE_PLAN_SOLVE", "CRITIQUE_REVISE", "ZERO_SHOT"], _protected()),
    ]
    for vid, techniques, protected in normal_techniques:
        rows.append({"id": vid, "kind": "normal", "mode": "bind", "selection": _selection(techniques, protected), "protected": protected})
    rows.append(
        {
            "id": "N19",
            "kind": "normal",
            "mode": "bind",
            "selection": _selection(
                ["RETRIEVE_REASON", "STRUCTURED_OUTPUT", "DECOMPOSE_PLAN_SOLVE"],
                _schema(),
                deferred=["FEW_SHOT", "STEP_BACK"],
                notes=["SELECTED", "BUDGET_TRUNCATED_MAX_3"],
            ),
            "protected": _schema(),
        }
    )
    rows.append({"id": "N20", "kind": "normal", "mode": "select", "protected": _protected(), "category": {}, "task": {}})
    rows.append(
        {
            "id": "N21",
            "kind": "normal",
            "mode": "select",
            "protected": _protected(),
            "category": {"display_label": "Research"},
            "task": {},
        }
    )
    rows.append(
        {
            "id": "N22",
            "kind": "normal",
            "mode": "select",
            "protected": _protected(),
            "category": {"display_label": "Analysis"},
            "task": {},
        }
    )
    rows.append(
        {
            "id": "N23",
            "kind": "normal",
            "mode": "select",
            "protected": _protected(),
            "category": {"display_label": "Coding"},
            "task": {},
        }
    )
    rows.append(
        {
            "id": "N24",
            "kind": "normal",
            "mode": "select",
            "protected": _protected(authority_state={"level": 0, "status": "NONE", "grants": ["READ_LOCAL"]}),
            "category": {},
            "task": {},
        }
    )
    rows.append(
        {
            "id": "N25",
            "kind": "normal",
            "mode": "bind",
            "selection": _selection(["FEW_SHOT", "CONTEXTUAL"], _example()),
            "protected": _example(),
        }
    )
    rows.append(
        {
            "id": "N26",
            "kind": "normal",
            "mode": "bind",
            "selection": _selection(["STRUCTURED_OUTPUT", "CRITIQUE_REVISE"], _schema()),
            "protected": _schema(),
        }
    )
    rows.append(
        {
            "id": "N27",
            "kind": "normal",
            "mode": "bind",
            "selection": _selection(["DECOMPOSE_PLAN_SOLVE", "RETRIEVE_REASON"], _protected()),
            "protected": _protected(),
        }
    )
    rows.append(
        {
            "id": "N28",
            "kind": "normal",
            "mode": "bind",
            "selection": _selection(["STEP_BACK", "CONTEXTUAL", "ROLE_PERSONA"], _role()),
            "protected": _role(),
        }
    )
    rows.append(
        {
            "id": "N29",
            "kind": "normal",
            "mode": "select",
            "protected": _protected(budget={"amount": 0, "hard": True}),
            "category": {},
            "task": {},
        }
    )
    rows.append(
        {
            "id": "N30",
            "kind": "normal",
            "mode": "select",
            "protected": _example(),
            "category": {},
            "task": {"needs_examples": True, "example_count": 1},
        }
    )
    rows.append({"id": "A01", "kind": "adversarial", "mode": "bind", "selection": _selection([], _protected(), disposition="NO_SELECTION")})
    rows.append({"id": "A02", "kind": "adversarial", "mode": "select", "protected": _protected(), "category": {}, "task": {"ambiguous": True}})
    rows.append(
        {
            "id": "A03",
            "kind": "adversarial",
            "mode": "bind",
            "selection": _selection(
                ["ZERO_SHOT"],
                _protected(hard_constraints=[{"constraint_id": "c", "statement": "[CONFLICT] stop"}]),
            ),
        }
    )
    for index, xcat in enumerate(sorted(UNIMPLEMENTED_XCAT), start=4):
        rows.append(
            {
                "id": f"A{index:02d}",
                "kind": "adversarial",
                "mode": "select",
                "protected": _protected(),
                "category": {"xcat_id": xcat},
                "task": {},
            }
        )
    rows.append({"id": "A11", "kind": "adversarial", "mode": "bind", "selection": _selection(["NOT_A_TECHNIQUE"], _protected())})
    rows.append({"id": "A12", "kind": "adversarial", "mode": "bind", "selection": _selection(["FEW_SHOT"], _protected())})
    rows.append({"id": "A13", "kind": "adversarial", "mode": "bind", "selection": _selection(["STRUCTURED_OUTPUT"], _protected(desired_output=None))})
    rows.append({"id": "A14", "kind": "adversarial", "mode": "bind", "selection": _selection(["ZERO_SHOT", "FEW_SHOT"], _example())})
    rows.append({"id": "A15", "kind": "adversarial", "mode": "bind", "selection": _selection(["RETRIEVE_REASON"], _protected())})
    rows.append({"id": "A16", "kind": "adversarial", "mode": "bind", "selection": _selection(["CRITIQUE_REVISE"], _protected())})
    rows.append(
        {
            "id": "A17",
            "kind": "adversarial",
            "mode": "bind",
            "selection": _selection(["ZERO_SHOT"], _protected(goal="Return JSON schema for the notes.")),
        }
    )
    rows.append({"id": "A18", "kind": "adversarial", "mode": "bind", "selection": _selection([], _protected(), disposition="SELECTED")})
    rows.append({"id": "A19", "kind": "adversarial", "mode": "select", "protected": _protected(), "category": {}, "task": {"force_zero_shot": True, "needs_examples": True}})
    rows.append(
        {
            "id": "A20",
            "kind": "adversarial",
            "mode": "select",
            "protected": _protected(),
            "category": {"display_label": "Research", "xcat_id": "CAT:C04"},
            "task": {},
        }
    )
    return rows


def _python(row: dict) -> dict:
    if row["mode"] == "bind":
        return bind_prompt_effects(row["selection"])
    result = select_prompt_techniques(row["protected"], row.get("category"), row.get("task"))
    return result


def _run_json(cmd: list[str], payload: dict) -> dict:
    proc = subprocess.run(cmd, input=json.dumps(payload), capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-2000:] or proc.stdout[-500:])
    wrapped = json.loads(proc.stdout)
    assert wrapped["status"] == "VALID"
    return wrapped["output"]


def _payload(row: dict) -> dict:
    if row["mode"] == "bind":
        return {"spe_api": "k3", "op": "bind", "selection": row["selection"]}
    return {
        "spe_api": "k3",
        "op": "select",
        "protected": row["protected"],
        "category": row.get("category") or {},
        "task": row.get("task") or {},
    }


def test_vector_counts() -> None:
    rows = vectors()
    assert sum(1 for row in rows if row["kind"] == "normal") == 30
    assert sum(1 for row in rows if row["kind"] == "adversarial") == 20


def test_python_rust_effect_vectors() -> None:
    assert RUST_BIN.is_file()
    for row in vectors():
        py = _python(row)
        rs = _run_json([str(RUST_BIN)], _payload(row))
        assert canonical_dumps(py) == canonical_dumps(rs), row["id"]
        plan = py if row["mode"] == "bind" else py["prompt_effect_plan"]
        if row["mode"] == "bind":
            expected_goal = row["selection"]["protected_binding"]["goal"]
        else:
            expected_goal = row["protected"].get("goal") if isinstance(row["protected"].get("goal"), str) else ""
        assert plan["protected_fields"]["goal"] == expected_goal
        if plan["renderable"]:
            assert expected_goal in plan["compiled_prompt"]
            lowered = plan["compiled_prompt"].lower()
            assert "chain of thought" not in lowered
            assert "show your reasoning" not in lowered
            assert "think step by step" not in lowered
            assert "reveal reasoning" not in lowered
            assert "private reasoning" not in lowered
            assert "sources were fetched" not in lowered
            assert "browsing happened" not in lowered
        else:
            assert plan["compiled_prompt"] is None
            assert plan["claims_pass"] is False


def test_python_wasm_effect_vectors() -> None:
    assert PUBLIC_WASM.is_file()
    assert WASM_HOST.is_file()
    probe = _run_json(
        ["node", str(WASM_HOST), str(PUBLIC_WASM)],
        {"spe_api": "k3", "op": "select", "protected": _protected(), "category": {}, "task": {}},
    )
    assert "prompt_effect_plan" in probe
    for row in vectors():
        py = _python(row)
        wasm = _run_json(["node", str(WASM_HOST), str(PUBLIC_WASM)], _payload(row))
        assert canonical_dumps(py) == canonical_dumps(wasm), row["id"]
