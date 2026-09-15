//! Wrapper conversions must match spe-core-rs exactly (no duplicated validator).

use serde_json::json;

fn payload() -> serde_json::Value {
    json!({
        "kind": "positive",
        "capabilities_required": ["CORE_CONTRACT", "XCAT_HANDOFF", "PROVENANCE"],
        "payload": {
            "envelope_id": "wasm-e1",
            "goal_identity": "wasm-g1",
            "facts": [{"fact_id": "f", "statement": "s", "provenance_ids": ["p"]}],
            "provenance": [{"provenance_id": "p", "source": "src"}],
            "uncertainties": [],
            "hard_constraints": [],
            "user_preferences": [],
            "analysis": null,
            "recommendation": null,
            "rendering": null,
            "authority_state": {"level": 0, "status": "NONE", "grants": []},
            "execution_grants": [],
            "failures": [],
            "taint_labels": [],
            "sensitivity_labels": ["USER_PRIVATE"],
            "category_trace": []
        }
    })
}

#[test]
fn wrapper_matches_core_on_positive() {
    let input = serde_json::to_string(&payload()).unwrap();
    let via_wrap = spe_wasm::evaluate_json(&input);
    let via_core = spe_core_rs::evaluate_json_str(&input);
    assert_eq!(via_wrap, via_core);
    let v: serde_json::Value = serde_json::from_str(&via_wrap).unwrap();
    assert_eq!(v["status"], "VALID");
}

#[test]
fn wrapper_matches_core_on_negative() {
    let input = serde_json::json!({
        "kind": "negative",
        "attack": "PROVENANCE_REMOVED",
        "expect_reason": "P_PROVENANCE_REMOVED",
        "before": {
            "provenance": [{"provenance_id": "p", "source": "s"}],
            "facts": [],
            "hard_constraints": [],
            "user_preferences": [],
            "uncertainties": [],
            "failures": [],
            "taint_labels": [],
            "sensitivity_labels": ["USER_PRIVATE"],
            "authority_state": {"status": "NONE", "level": 0, "grants": []}
        },
        "after": {
            "provenance": [],
            "facts": [],
            "hard_constraints": [],
            "user_preferences": [],
            "uncertainties": [],
            "failures": [],
            "taint_labels": [],
            "sensitivity_labels": ["USER_PRIVATE"],
            "authority_state": {"status": "NONE", "level": 0, "grants": []}
        }
    });
    let text = serde_json::to_string(&input).unwrap();
    assert_eq!(spe_wasm::evaluate_json(&text), spe_core_rs::evaluate_json_str(&text));
    let v: serde_json::Value = serde_json::from_str(&spe_wasm::evaluate_json(&text)).unwrap();
    assert_eq!(v["reason_code"], "P_PROVENANCE_REMOVED");
}
