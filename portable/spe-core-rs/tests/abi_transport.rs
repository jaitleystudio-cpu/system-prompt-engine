use serde_json::json;
use spe_core_rs::reasons::{
    PORTABILITY_ABI_UNSUPPORTED, PORTABILITY_INVALID_FIXTURE, PORTABILITY_NONPORTABLE_NUMBER,
    PORTABILITY_TIMESTAMP_AMBIGUOUS,
};
use spe_core_rs::value::{canonical_dumps, reject_nonportable_f64, strict_equal};
use spe_core_rs::{evaluate_fixture, evaluate_json_str};

#[test]
fn rejects_non_object_fixture_root() {
    let input = json!(["not", "an", "object"]);
    let err = evaluate_fixture(&input).unwrap_err();
    assert_eq!(err.code(), PORTABILITY_INVALID_FIXTURE);
}

#[test]
fn unknown_abi_major_is_unsupported() {
    let input = json!({
        "abi_id": "spe.universal-abi.v1",
        "major": 99,
        "minor": 0,
        "patch": 0,
        "payload": {"envelope_id": "e1", "goal_identity": "g1"}
    });
    let err = evaluate_fixture(&input).unwrap_err();
    assert_eq!(err.code(), PORTABILITY_ABI_UNSUPPORTED);
}

#[test]
fn unknown_remains_distinct_from_absent_and_null() {
    let unknown = json!({"failures": [{"failure_id": "f", "status": "UNKNOWN", "message": ""}]});
    let null_v = json!({"failures": [{"failure_id": "f", "status": null, "message": ""}]});
    let absent = json!({"failures": [{"failure_id": "f", "message": ""}]});
    assert!(!spe_core_rs::semantic::semantic_equivalent(&unknown, &null_v));
    assert!(!spe_core_rs::semantic::semantic_equivalent(&unknown, &absent));
    assert!(!spe_core_rs::semantic::semantic_equivalent(&null_v, &absent));
    assert!(spe_core_rs::semantic::unknown_distinct(&unknown, &null_v, &absent));
}

#[test]
fn rejects_nonportable_numeric_representation() {
    let err = reject_nonportable_f64(f64::NAN).unwrap_err();
    assert_eq!(err.code(), PORTABILITY_NONPORTABLE_NUMBER);
    let err = reject_nonportable_f64(f64::INFINITY).unwrap_err();
    assert_eq!(err.code(), PORTABILITY_NONPORTABLE_NUMBER);
}

#[test]
fn preserves_multilingual_utf8() {
    let payload = json!({"msg": "हिन्दी-日本語-😀", "n": 1});
    let text = canonical_dumps(&payload).unwrap();
    assert!(text.contains("हिन्दी"));
    assert!(text.contains("日本語"));
    assert!(text.contains("😀"));
    let back: serde_json::Value = serde_json::from_str(&text).unwrap();
    assert!(strict_equal(&back, &payload));
}

#[test]
fn rejects_naive_authority_timestamps() {
    let input = json!({
        "envelope_id": "e1",
        "goal_identity": "g1",
        "authority_state": {
            "status": "GRANTED",
            "level": 1,
            "grants": [],
            "granted_at": "2026-09-15T12:00:00"
        }
    });
    let err = evaluate_fixture(&input).unwrap_err();
    assert_eq!(err.code(), PORTABILITY_TIMESTAMP_AMBIGUOUS);
}

#[test]
fn timezone_aware_authority_timestamp_is_accepted() {
    let input = json!({
        "envelope_id": "e1",
        "goal_identity": "g1",
        "facts": [],
        "provenance": [],
        "uncertainties": [],
        "hard_constraints": [],
        "user_preferences": [],
        "analysis": null,
        "recommendation": null,
        "rendering": null,
        "authority_state": {
            "status": "GRANTED",
            "level": 1,
            "grants": [],
            "granted_at": "2026-09-15T12:00:00Z"
        },
        "execution_grants": [],
        "failures": [],
        "taint_labels": [],
        "sensitivity_labels": [],
        "category_trace": []
    });
    let result = evaluate_fixture(&input).unwrap();
    assert_eq!(result.disposition, "VALID");
}

#[test]
fn json_str_malformed_is_invalid_fixture() {
    let out = evaluate_json_str("[1,2,3]");
    let v: serde_json::Value = serde_json::from_str(&out).unwrap();
    assert_eq!(v["reason_code"], PORTABILITY_INVALID_FIXTURE);
}
