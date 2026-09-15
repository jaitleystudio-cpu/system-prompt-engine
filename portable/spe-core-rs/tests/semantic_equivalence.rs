use serde_json::json;
use spe_core_rs::protected::compare_protected;
use spe_core_rs::semantic::{detect_attack, semantic_equivalent};
use spe_core_rs::value::canonical_dumps;

fn env(over: serde_json::Value) -> serde_json::Value {
    let mut base = json!({
        "envelope_id": "e1",
        "goal_identity": "g1",
        "facts": [{"fact_id": "f1", "statement": "s", "provenance_ids": ["p1"]}],
        "provenance": [{"provenance_id": "p1", "source": "src"}],
        "uncertainties": [{"uncertainty_id": "u1", "description": "maybe", "status": "UNKNOWN"}],
        "hard_constraints": [{"constraint_id": "c1", "statement": "hard", "strength": "HARD"}],
        "user_preferences": [{"preference_id": "pref1", "statement": "concise"}],
        "analysis": null,
        "recommendation": {"option": "A", "conditional": false, "status": "READY"},
        "rendering": null,
        "authority_state": {"level": 0, "status": "DENIED", "grants": []},
        "execution_grants": [{"grant_id": "g1", "target": "file:/tmp/x", "arguments": {"path": "/tmp/x"}}],
        "failures": [{"failure_id": "x", "status": "UNKNOWN", "message": ""}],
        "taint_labels": ["external_untrusted"],
        "sensitivity_labels": ["USER_PRIVATE"],
        "category_trace": ["CAT:C02"],
        "operation_id": "op-1",
        "outcome": "PARTIAL"
    });
    if let Some(obj) = over.as_object() {
        for (k, v) in obj {
            base[k] = v.clone();
        }
    }
    base
}

#[test]
fn unknown_vs_pass_not_equivalent() {
    let a = env(json!({}));
    let mut b = a.clone();
    b["failures"] = json!([{"failure_id": "x", "status": "PASS", "message": ""}]);
    assert!(!semantic_equivalent(&a, &b));
    assert!(detect_attack(&a, &b).is_some());
}

#[test]
fn fail_vs_pass_not_equivalent() {
    let a = env(json!({"failures": [{"failure_id": "x", "status": "FAIL", "message": ""}]}));
    let mut b = a.clone();
    b["failures"] = json!([{"failure_id": "x", "status": "PASS", "message": ""}]);
    assert!(!semantic_equivalent(&a, &b));
}

#[test]
fn denied_vs_granted_not_equivalent() {
    let a = env(json!({}));
    let mut b = a.clone();
    b["authority_state"] = json!({"level": 1, "status": "GRANTED", "grants": ["g"]});
    assert!(!semantic_equivalent(&a, &b));
    assert_eq!(
        detect_attack(&a, &b).as_deref(),
        Some(spe_core_rs::reasons::P_DENIED_TO_GRANTED)
    );
}

#[test]
fn conditional_vs_unconditional_recommendation() {
    let a = env(json!({"recommendation": {"option": "A", "conditional": true, "status": "READY"}}));
    let b = env(json!({"recommendation": {"option": "A", "conditional": false, "status": "READY"}}));
    let cmp = compare_protected(&a, &b);
    assert!(!cmp.equivalent);
    assert!(cmp.drift.iter().any(|d| d == "recommendation"));
}

#[test]
fn different_provenance_origin() {
    let a = env(json!({}));
    let mut b = a.clone();
    b["provenance"] = json!([{"provenance_id": "p1", "source": "OTHER"}]);
    assert!(!semantic_equivalent(&a, &b));
}

#[test]
fn different_hard_constraint() {
    let a = env(json!({}));
    let mut b = a.clone();
    b["hard_constraints"] = json!([{"constraint_id": "c1", "statement": "DIFFERENT", "strength": "HARD"}]);
    assert!(!semantic_equivalent(&a, &b));
}

#[test]
fn different_recommended_option() {
    let a = env(json!({}));
    let mut b = a.clone();
    b["recommendation"] = json!({"option": "B", "conditional": false, "status": "READY"});
    let cmp = compare_protected(&a, &b);
    assert!(!cmp.equivalent);
}

#[test]
fn different_sensitivity_privacy() {
    let a = env(json!({}));
    let mut b = a.clone();
    b["sensitivity_labels"] = json!(["PUBLIC"]);
    assert_eq!(
        detect_attack(&a, &b).as_deref(),
        Some(spe_core_rs::reasons::P_PRIVACY_ESCALATION)
    );
}

#[test]
fn different_taint() {
    let a = env(json!({}));
    let mut b = a.clone();
    b["taint_labels"] = json!([]);
    assert_eq!(
        detect_attack(&a, &b).as_deref(),
        Some(spe_core_rs::reasons::P_TRUST_ESCALATION)
    );
}

#[test]
fn different_operation_id() {
    let a = env(json!({}));
    let mut b = a.clone();
    b["operation_id"] = json!("op-2");
    assert_eq!(
        detect_attack(&a, &b).as_deref(),
        Some(spe_core_rs::reasons::P_OPERATION_ID_MUTATION)
    );
}

#[test]
fn different_authority_target() {
    let a = env(json!({}));
    let mut b = a.clone();
    b["execution_grants"] =
        json!([{"grant_id": "g1", "target": "file:/tmp/y", "arguments": {"path": "/tmp/x"}}]);
    assert_eq!(
        detect_attack(&a, &b).as_deref(),
        Some(spe_core_rs::reasons::C07_TARGET_DRIFT)
    );
}

#[test]
fn different_authority_argument_bounds() {
    let a = env(json!({}));
    let mut b = a.clone();
    b["execution_grants"] = json!([{
        "grant_id": "g1",
        "target": "file:/tmp/x",
        "arguments": {"path": "/tmp/x", "extra": true}
    }]);
    assert_eq!(
        detect_attack(&a, &b).as_deref(),
        Some(spe_core_rs::reasons::C07_ARGUMENT_DRIFT)
    );
}

#[test]
fn map_key_order_is_incidental() {
    let left = json!({"b": 1, "a": {"z": 2, "y": 3}});
    let right = json!({"a": {"y": 3, "z": 2}, "b": 1});
    assert!(semantic_equivalent(&left, &right));
    assert_eq!(
        canonical_dumps(&left).unwrap(),
        canonical_dumps(&right).unwrap()
    );
}
