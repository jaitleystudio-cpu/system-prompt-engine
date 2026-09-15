use serde_json::{json, Value};
use spe_core_rs::evaluate_fixture;
use spe_core_rs::semantic::detect_attack;
use std::fs;
use std::path::PathBuf;

fn negative_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../data/conformance/universal_negative_v1.jsonl")
}

fn load_negatives() -> Vec<Value> {
    let raw = fs::read_to_string(negative_path()).expect("negative fixtures");
    raw.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| serde_json::from_str::<Value>(l).expect("jsonl row"))
        .collect()
}

#[test]
fn all_frozen_negatives_report_exact_reason() {
    let rows = load_negatives();
    assert!(rows.len() >= 50);
    let mut failed = Vec::new();
    for row in &rows {
        let id = row.get("id").and_then(|v| v.as_str()).unwrap_or("?");
        let expect = row
            .get("expect_reason")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        match evaluate_fixture(row) {
            Ok(result) => {
                if result.disposition != "INVALID" || result.reason_code.as_deref() != Some(expect)
                {
                    failed.push(format!(
                        "{id}: expected {expect} got {:?} / {}",
                        result.reason_code, result.disposition
                    ));
                }
            }
            Err(e) => failed.push(format!("{id}: err {}", e.code())),
        }
    }
    assert!(failed.is_empty(), "negatives failed:\n{}", failed.join("\n"));
}

fn base() -> Value {
    json!({
        "envelope_id": "mut-env",
        "goal_identity": "mut-goal",
        "facts": [{"fact_id": "f", "statement": "s", "provenance_ids": ["p"]}],
        "provenance": [{"provenance_id": "p", "source": "src"}],
        "uncertainties": [{"uncertainty_id": "u", "description": "maybe"}],
        "hard_constraints": [{"constraint_id": "c", "statement": "must", "strength": "HARD"}],
        "user_preferences": [{"preference_id": "pref", "statement": "concise"}],
        "analysis": {"kind": "analysis", "summary": "s"},
        "recommendation": {"option": "A", "conditional": true, "status": "READY"},
        "rendering": null,
        "authority_state": {"level": 0, "status": "DENIED", "grants": []},
        "execution_grants": [{
            "grant_id": "g1",
            "target": "file:/tmp/x",
            "arguments": {"path": "/tmp/x"},
            "status": "ACTIVE"
        }],
        "failures": [{"failure_id": "f1", "status": "UNKNOWN", "message": ""}],
        "taint_labels": ["external_untrusted"],
        "sensitivity_labels": ["USER_PRIVATE"],
        "category_trace": ["CAT:C06"],
        "operation_id": "op-A",
        "outcome": "PARTIAL"
    })
}

fn overlay(mut base: Value, patch: Value) -> Value {
    if let Some(obj) = patch.as_object() {
        for (k, v) in obj {
            base[k] = v.clone();
        }
    }
    base
}

#[test]
fn constructed_mutations_do_not_escape() {
    let b = base();
    let cases: Vec<(&str, Value, Option<&str>)> = vec![
        (
            "constraint_loss",
            overlay(b.clone(), json!({"hard_constraints": []})),
            Some(spe_core_rs::reasons::X01_CONSTRAINT_WEAKENED),
        ),
        (
            "provenance_loss",
            overlay(b.clone(), json!({"provenance": []})),
            Some(spe_core_rs::reasons::P_PROVENANCE_REMOVED),
        ),
        (
            "uncertainty_drift",
            overlay(b.clone(), json!({"uncertainties": []})),
            Some(spe_core_rs::reasons::X03_UNCERTAINTY_ERASED),
        ),
        (
            "preference_drift",
            overlay(
                b.clone(),
                json!({"user_preferences": [{"preference_id": "pref", "statement": "verbose"}]}),
            ),
            Some(spe_core_rs::reasons::P_SEMANTIC_NONEQUIVALENT),
        ),
        (
            "private_to_public",
            overlay(b.clone(), json!({"sensitivity_labels": ["PUBLIC"]})),
            Some(spe_core_rs::reasons::P_PRIVACY_ESCALATION),
        ),
        (
            "taint_removal",
            overlay(b.clone(), json!({"taint_labels": []})),
            Some(spe_core_rs::reasons::P_TRUST_ESCALATION),
        ),
        (
            "c06_recommendation",
            overlay(
                b.clone(),
                json!({"recommendation": {"option": "B", "conditional": true, "status": "READY"}}),
            ),
            Some(spe_core_rs::reasons::P_SEMANTIC_NONEQUIVALENT),
        ),
        (
            "c01_authority_creation",
            overlay(
                overlay(b.clone(), json!({"authority_state": {"level": 0, "status": "NONE", "grants": []}})),
                json!({"authority_state": {"level": 1, "status": "GRANTED", "grants": ["minted"]}}),
            ),
            Some(spe_core_rs::reasons::P_AUTHORITY_ESCALATION),
        ),
        (
            "c03_recommendation_drift",
            overlay(
                b.clone(),
                json!({"recommendation": {"option": "A", "conditional": false, "status": "READY"}}),
            ),
            Some(spe_core_rs::reasons::P_SEMANTIC_NONEQUIVALENT),
        ),
        (
            "c07_missing_authority",
            overlay(b.clone(), json!({"execution_grants": []})),
            Some(spe_core_rs::reasons::C07_EXECUTION_MISSING_AUTHORITY),
        ),
        (
            "target_drift",
            overlay(
                b.clone(),
                json!({"execution_grants": [{"grant_id": "g1", "target": "file:/tmp/Y", "arguments": {"path": "/tmp/x"}, "status": "ACTIVE"}]}),
            ),
            Some(spe_core_rs::reasons::C07_TARGET_DRIFT),
        ),
        (
            "argument_expansion",
            overlay(
                b.clone(),
                json!({"execution_grants": [{"grant_id": "g1", "target": "file:/tmp/x", "arguments": {"path": "/tmp/x", "mode": "rw"}, "status": "ACTIVE"}]}),
            ),
            Some(spe_core_rs::reasons::C07_ARGUMENT_DRIFT),
        ),
        (
            "expired_grant",
            overlay(
                b.clone(),
                json!({"execution_grants": [{"grant_id": "g1", "target": "file:/tmp/x", "arguments": {"path": "/tmp/x"}, "status": "ACTIVE", "expired": true}]}),
            ),
            Some(spe_core_rs::reasons::C07_AUTHORITY_EXPIRED),
        ),
        (
            "revoked_grant",
            overlay(
                b.clone(),
                json!({"execution_grants": [{"grant_id": "g1", "target": "file:/tmp/x", "arguments": {"path": "/tmp/x"}, "status": "REVOKED"}]}),
            ),
            Some(spe_core_rs::reasons::C07_AUTHORITY_REVOKED),
        ),
        (
            "consumed_grant",
            overlay(
                b.clone(),
                json!({"execution_grants": [{"grant_id": "g1", "target": "file:/tmp/x", "arguments": {"path": "/tmp/x"}, "status": "CONSUMED"}]}),
            ),
            Some(spe_core_rs::reasons::C07_AUTHORITY_CONSUMED),
        ),
        (
            "unknown_to_pass",
            overlay(
                b.clone(),
                json!({"failures": [{"failure_id": "f1", "status": "PASS", "message": ""}]}),
            ),
            Some(spe_core_rs::reasons::P_STATUS_COLLAPSE),
        ),
        (
            "partial_to_success",
            overlay(b.clone(), json!({"outcome": "SUCCESS"})),
            Some(spe_core_rs::reasons::P_OUTCOME_ESCALATION),
        ),
        (
            "tool_success_to_verified",
            overlay(b.clone(), json!({"tool_success": true, "outcome": "VERIFIED_SUCCESS"})),
            Some(spe_core_rs::reasons::P_OUTCOME_ESCALATION),
        ),
        (
            "operation_id_replacement",
            overlay(b.clone(), json!({"operation_id": "op-B"})),
            Some(spe_core_rs::reasons::P_OPERATION_ID_MUTATION),
        ),
    ];

    let mut escapes = Vec::new();
    for (name, after, expect) in cases {
        let before = if name == "c01_authority_creation" {
            overlay(base(), json!({"authority_state": {"level": 0, "status": "NONE", "grants": []}}))
        } else if name == "tool_success_to_verified" {
            overlay(base(), json!({"tool_success": true, "outcome": "PARTIAL"}))
        } else {
            base()
        };
        let got = detect_attack(&before, &after);
        if got.as_deref() != expect {
            escapes.push(format!("{name}: expected {expect:?} got {got:?}"));
        }
    }
    assert!(escapes.is_empty(), "mutation escapes:\n{}", escapes.join("\n"));
}
