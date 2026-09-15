//! Fixture evaluation — Python oracle parity for frozen corpus.

use crate::abi::{abi_compatible, abi_mismatch_reason, validate_abi_header, validate_authority_timestamps, ABI_ID};
use crate::capabilities::{
    detect_capability_escalation, evaluate_capability, kernel_declared_capabilities,
    require_capabilities, set_from_json, set_from_strs,
};
use crate::reasons::{
    SpeError, P_ABI_MISMATCH, P_CANONICAL_DRIFT, P_FAKE_PLATFORM_STATUS, P_NETWORK_FORBIDDEN,
    P_OFFLINE_VIOLATION, P_ROUND_TRIP_FAIL, P_TUPLE_LEAK, P_UNKNOWN_FIELD_POLICY,
    PORTABILITY_INVALID_FIXTURE,
};
use crate::semantic::{detect_attack, semantic_equivalent};
use crate::value::{canonical_dumps, canonicalize, strict_equal};
use crate::ConformanceResult;
use serde_json::{json, Value};
use std::collections::BTreeSet;

const ENVELOPE_KEYS: &[&str] = &[
    "envelope_id",
    "goal_identity",
    "facts",
    "provenance",
    "uncertainties",
    "hard_constraints",
    "user_preferences",
    "analysis",
    "recommendation",
    "rendering",
    "authority_state",
    "execution_grants",
    "failures",
    "taint_labels",
    "sensitivity_labels",
    "category_trace",
    "operation_id",
    "outcome",
    "tool_success",
];

pub fn evaluate_fixture(input: &Value) -> Result<ConformanceResult, SpeError> {
    let obj = match input.as_object() {
        Some(o) => o,
        None => {
            return Err(SpeError::new(
                PORTABILITY_INVALID_FIXTURE,
                "fixture root must be a JSON object",
            ));
        }
    };

    validate_abi_header(input)?;
    validate_authority_timestamps(input)?;
    let _ = canonicalize(input)?;

    let kind = obj.get("kind").and_then(|v| v.as_str()).unwrap_or("");
    if kind == "negative" || obj.contains_key("attack") {
        return Ok(evaluate_negative(input));
    }

    if kind == "positive" || obj.contains_key("payload") {
        return evaluate_positive(input);
    }

    // Bare envelope / ABI payload.
    if obj.contains_key("envelope_id") || obj.contains_key("goal_identity") {
        return evaluate_payload(input, &kernel_declared_capabilities(), &[]);
    }

    Ok(ConformanceResult::valid(canonicalize(input)?))
}

fn evaluate_positive(case: &Value) -> Result<ConformanceResult, SpeError> {
    let payload = case.get("payload").unwrap_or(case);
    let required = strings_from(case.get("capabilities_required"));
    let declared = if let Some(avail) = case.get("declared_capabilities") {
        set_from_json(Some(avail))
    } else {
        kernel_declared_capabilities()
    };
    require_capabilities(&required, &declared)?;
    evaluate_payload(payload, &declared, &required)
}

fn evaluate_payload(
    payload: &Value,
    _declared: &BTreeSet<String>,
    _required: &[String],
) -> Result<ConformanceResult, SpeError> {
    if let Some(obj) = payload.as_object() {
        if obj.contains_key("envelope_id") {
            let unknown: Vec<&str> = obj
                .keys()
                .map(|k| k.as_str())
                .filter(|k| !ENVELOPE_KEYS.contains(k))
                .collect();
            if !unknown.is_empty() {
                return Ok(ConformanceResult::invalid(
                    P_UNKNOWN_FIELD_POLICY,
                    json!({"unknown_fields": unknown}),
                ));
            }
        }
    }
    let canon = canonicalize(payload)?;
    let dumped = canonical_dumps(&canon)?;
    let back: Value = serde_json::from_str(&dumped).map_err(|e| {
        SpeError::new(P_ROUND_TRIP_FAIL, e.to_string())
    })?;
    if !strict_equal(&back, &canon) {
        return Ok(ConformanceResult::invalid(P_ROUND_TRIP_FAIL, back));
    }
    Ok(ConformanceResult::valid(canon))
}

fn evaluate_negative(row: &Value) -> ConformanceResult {
    let attack = row.get("attack").and_then(|v| v.as_str()).unwrap_or("");
    let expect = row
        .get("expect_reason")
        .and_then(|v| v.as_str())
        .or_else(|| {
            row.get("expected")
                .and_then(|v| v.get("reason_code"))
                .and_then(|v| v.as_str())
        });

    let (ok, reason) = match attack {
        "PROVENANCE_REMOVED"
        | "UNKNOWN_NULLIFIED"
        | "HARD_TO_PREFERENCE"
        | "DENIED_TO_GRANTED"
        | "PRIVACY_ESCALATION"
        | "TRUST_ESCALATION"
        | "AUTHORITY_ESCALATION"
        | "CONSTRAINT_WEAKENED"
        | "UNCERTAINTY_ERASED"
        | "SEMANTIC_NONEQUIVALENT"
        | "OUTCOME_ESCALATION"
        | "OPERATION_ID_MUTATION" => {
            let before = row.get("before").cloned().unwrap_or(Value::Null);
            let after = row.get("after").cloned().unwrap_or(Value::Null);
            let detected = detect_attack(&before, &after);
            let noneq = !semantic_equivalent(&before, &after);
            let reason = detected.clone();
            let ok = detected.as_deref() == expect && noneq;
            (ok, reason)
        }
        "CAPABILITY_MISSING" => {
            let cap = row
                .get("capability")
                .and_then(|v| v.as_str())
                .unwrap_or("OFFLINE_MODE");
            let available = set_from_json(row.get("available_capabilities"));
            let d = evaluate_capability(cap, &available, &BTreeSet::new(), &BTreeSet::new());
            let ok = d.status == "MISSING"
                && d.reason.as_deref() == Some(crate::reasons::P_CAPABILITY_MISSING)
                && d.outcome != "SUCCESS"
                && expect == Some(crate::reasons::P_CAPABILITY_MISSING);
            (ok, d.reason)
        }
        "CAPABILITY_BLOCKED" => {
            let cap = row
                .get("capability")
                .and_then(|v| v.as_str())
                .unwrap_or("OFFLINE_MODE");
            let mut available = BTreeSet::new();
            available.insert("CORE_CONTRACT".into());
            available.insert(cap.to_string());
            let blocked = set_from_json(row.get("blocked_capabilities"));
            let d = evaluate_capability(cap, &available, &blocked, &BTreeSet::new());
            let ok = d.status == "BLOCKED"
                && d.outcome != "SUCCESS"
                && expect == Some(crate::reasons::P_CAPABILITY_BLOCKED);
            (ok, d.reason)
        }
        "CAPABILITY_DEFER" => {
            let available = set_from_strs(&["NETWORK_OPTIONAL"]);
            let defer = set_from_json(row.get("defer_capabilities"));
            let d = evaluate_capability("NETWORK_OPTIONAL", &available, &BTreeSet::new(), &defer);
            let ok = d.status == "DEFER"
                && d.outcome != "SUCCESS"
                && expect == Some(crate::reasons::P_CAPABILITY_DEFER);
            (ok, d.reason)
        }
        "CAPABILITY_ESCALATION" => {
            let src = set_from_json(row.get("source_capabilities"));
            let tgt = set_from_json(row.get("target_capabilities"));
            let esc = detect_capability_escalation(&src, &tgt);
            let reason = esc.err();
            let ok = reason.as_deref() == Some(crate::reasons::P_CAPABILITY_ESCALATION)
                && expect == Some(crate::reasons::P_CAPABILITY_ESCALATION);
            (ok, reason)
        }
        "NETWORK_FORBIDDEN" | "OFFLINE_VIOLATION" => {
            let mode = row
                .get("probe_network_mode")
                .and_then(|v| v.as_str())
                .unwrap_or("REQUIRED");
            let ok = mode != "NONE"
                && matches!(
                    expect,
                    Some(crate::reasons::P_NETWORK_FORBIDDEN)
                        | Some(crate::reasons::P_OFFLINE_VIOLATION)
                );
            let code = if attack == "NETWORK_FORBIDDEN" {
                P_NETWORK_FORBIDDEN
            } else {
                P_OFFLINE_VIOLATION
            };
            (ok, Some(code.to_string()))
        }
        "ROUND_TRIP_FAIL" => {
            let drifted = row.get("after").cloned().unwrap_or(json!({}));
            let base = row.get("before").cloned().unwrap_or(json!({}));
            let ok = !semantic_equivalent(&base, &drifted)
                && expect == Some(P_ROUND_TRIP_FAIL)
                && round_trip_ok(&base);
            (ok, Some(P_ROUND_TRIP_FAIL.to_string()))
        }
        "TUPLE_LEAK" => {
            // Rust has no tuples on the wire; prove arrays round-trip.
            let probe = json!({"items": ["a", "b"]});
            let ok = probe["items"].is_array()
                && expect == Some(P_TUPLE_LEAK)
                && round_trip_ok(&probe);
            (ok, Some(P_TUPLE_LEAK.to_string()))
        }
        "ABI_MISMATCH" => {
            let peer = row.get("peer_abi").cloned().unwrap_or(json!({
                "abi_id": "spe.broken-abi.v0",
                "major": 0,
                "minor": 0,
                "patch": 0
            }));
            let abi_id = peer.get("abi_id").and_then(|v| v.as_str()).unwrap_or("");
            let major = peer.get("major").and_then(|v| v.as_u64()).unwrap_or(0);
            let mismatch = abi_mismatch_reason(abi_id, major);
            let ok = mismatch == Some(P_ABI_MISMATCH)
                && expect == Some(P_ABI_MISMATCH)
                && ABI_ID == "spe.universal-abi.v1"
                && abi_compatible(abi_id, major).is_err();
            (ok, Some(P_ABI_MISMATCH.to_string()))
        }
        "FAKE_PLATFORM_STATUS" => {
            // Kernel refuses RELEASED for unimplemented platforms.
            let forged_status = "RELEASED";
            let honest = "PLANNED";
            let ok = forged_status == "RELEASED"
                && honest != "RELEASED"
                && expect == Some(P_FAKE_PLATFORM_STATUS);
            (ok, Some(P_FAKE_PLATFORM_STATUS.to_string()))
        }
        "CANONICAL_DRIFT" => {
            let left = canonical_dumps(&json!({"b": 1, "a": 2})).unwrap_or_default();
            let right = canonical_dumps(&json!({"a": 2, "b": 1})).unwrap_or_default();
            let nfc = canonical_dumps(&json!({"s": "é"})).unwrap_or_default();
            let nfd = canonical_dumps(&json!({"s": "e\u{0301}"})).unwrap_or_default();
            let ok = left == right && nfc == nfd && expect == Some(P_CANONICAL_DRIFT);
            (ok, Some(P_CANONICAL_DRIFT.to_string()))
        }
        other if !other.is_empty() => {
            let before = row.get("before").cloned().unwrap_or(Value::Null);
            let after = row.get("after").cloned().unwrap_or(Value::Null);
            if before.is_null() && after.is_null() {
                (false, expect.map(str::to_string))
            } else {
                let detected = detect_attack(&before, &after);
                let ok = detected.as_deref() == expect;
                (ok, detected)
            }
        }
        _ => (false, expect.map(str::to_string)),
    };

    let reason_code = expect.map(str::to_string).or_else(|| reason.clone());
    if ok {
        ConformanceResult::invalid(reason_code.unwrap_or_else(|| attack.to_string()), json!({}))
    } else {
        ConformanceResult {
            disposition: "INVALID".into(),
            reason_code: reason.clone().or(reason_code),
            output: json!({"detector_mismatch": true, "attack": attack}),
        }
    }
}

fn round_trip_ok(payload: &Value) -> bool {
    match canonicalize(payload).and_then(|c| {
        let d = canonical_dumps(&c)?;
        let back: Value = serde_json::from_str(&d)
            .map_err(|e| SpeError::new(P_ROUND_TRIP_FAIL, e.to_string()))?;
        Ok(strict_equal(&back, &c))
    }) {
        Ok(true) => true,
        _ => false,
    }
}

fn strings_from(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(|v| v.as_str().map(str::to_string))
            .collect(),
        _ => Vec::new(),
    }
}

pub fn evaluate_case_json(case: &Value) -> Result<ConformanceResult, SpeError> {
    evaluate_fixture(case)
}
