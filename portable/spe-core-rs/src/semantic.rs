//! Protected-semantic detectors matching the Python oracle order.

use crate::reasons::{
    C07_ARGUMENT_DRIFT, C07_AUTHORITY_CONSUMED, C07_AUTHORITY_EXPIRED, C07_AUTHORITY_REVOKED,
    C07_EXECUTION_MISSING_AUTHORITY, C07_OPERATION_ID_REPLACED, C07_PARTIAL_TO_SUCCESS,
    C07_TARGET_DRIFT, C07_TOOL_SUCCESS_TO_OUTCOME, C07_UNKNOWN_OUTCOME_RETRY, P_AUTHORITY_ESCALATION,
    P_DENIED_TO_GRANTED, P_HARD_TO_PREFERENCE, P_OPERATION_ID_MUTATION, P_OUTCOME_ESCALATION,
    P_PRIVACY_ESCALATION, P_PROVENANCE_REMOVED, P_SEMANTIC_NONEQUIVALENT, P_STATUS_COLLAPSE,
    P_TRUST_ESCALATION, P_UNKNOWN_NULLIFIED, X01_CONSTRAINT_WEAKENED, X03_UNCERTAINTY_ERASED,
};
use crate::value::{canonicalize, strict_equal};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

const OUTCOME_RANK: &[(&str, i32)] = &[
    ("FAILED", 0),
    ("BLOCKED", 1),
    ("PARTIAL", 2),
    ("SUCCESS", 3),
    ("VERIFIED_SUCCESS", 4),
];

fn rank(outcome: &str) -> i32 {
    OUTCOME_RANK
        .iter()
        .find(|(k, _)| *k == outcome)
        .map(|(_, r)| *r)
        .unwrap_or(-1)
}

fn ids(items: Option<&Value>, key: &str) -> BTreeSet<String> {
    let mut out = BTreeSet::new();
    if let Some(Value::Array(arr)) = items {
        for item in arr {
            if let Some(id) = item.get(key).and_then(|v| as_id(v)) {
                out.insert(id);
            }
        }
    }
    out
}

fn as_id(v: &Value) -> Option<String> {
    match v {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn auth<'a>(payload: &'a Value) -> &'a Value {
    payload
        .get("authority_state")
        .filter(|v| v.is_object())
        .unwrap_or(&Value::Null)
}

pub fn semantic_equivalent(a: &Value, b: &Value) -> bool {
    match (canonicalize(a), canonicalize(b)) {
        (Ok(x), Ok(y)) => strict_equal(&x, &y),
        _ => false,
    }
}

/// First deterministic portability attack reason, else None.
pub fn detect_attack(before: &Value, after: &Value) -> Option<String> {
    let b = canonicalize(before).ok()?;
    let a = canonicalize(after).ok()?;
    if !b.is_object() || !a.is_object() {
        return Some(P_SEMANTIC_NONEQUIVALENT.to_string());
    }

    if b.get("operation_id").is_some() || a.get("operation_id").is_some() {
        if b.get("operation_id") != a.get("operation_id") {
            return Some(P_OPERATION_ID_MUTATION.to_string());
        }
    }

    if b.get("outcome").is_some() || a.get("outcome").is_some() {
        let br = rank(b.get("outcome").and_then(|v| v.as_str()).unwrap_or(""));
        let ar = rank(a.get("outcome").and_then(|v| v.as_str()).unwrap_or(""));
        if br >= 0 && ar > br {
            return Some(P_OUTCOME_ESCALATION.to_string());
        }
    }

    let b_prov = ids(b.get("provenance"), "provenance_id");
    let a_prov = ids(a.get("provenance"), "provenance_id");
    if !(&b_prov - &a_prov).is_empty() {
        return Some(P_PROVENANCE_REMOVED.to_string());
    }

    let b_fails = fail_map(&b);
    let a_fails = fail_map(&a);
    for (fid, status) in &b_fails {
        if status.as_deref() == Some("UNKNOWN") {
            if let Some(after_st) = a_fails.get(fid) {
                if after_st.is_none() {
                    return Some(P_UNKNOWN_NULLIFIED.to_string());
                }
                if after_st.as_deref() == Some("") {
                    return Some(P_STATUS_COLLAPSE.to_string());
                }
            }
        }
    }

    let b_hard = obj_map(&b, "hard_constraints", "constraint_id");
    let a_hard_ids = ids(a.get("hard_constraints"), "constraint_id");
    let a_prefs = obj_map(&a, "user_preferences", "preference_id");
    for cid in b_hard.keys() {
        if !a_hard_ids.contains(cid) && a_prefs.contains_key(cid) {
            return Some(P_HARD_TO_PREFERENCE.to_string());
        }
    }
    for (cid, cobj) in &b_hard {
        if !a_hard_ids.contains(cid) {
            if !a_prefs.contains_key(cid) {
                return Some(X01_CONSTRAINT_WEAKENED.to_string());
            }
        } else if let Some(after_c) = a
            .get("hard_constraints")
            .and_then(|v| v.as_array())
            .and_then(|arr| {
                arr.iter().find(|c| {
                    c.get("constraint_id")
                        .and_then(as_id)
                        .as_deref()
                        == Some(cid.as_str())
                })
            })
        {
            let before_s = cobj
                .get("strength")
                .and_then(|v| v.as_str())
                .unwrap_or("HARD");
            let after_s = after_c
                .get("strength")
                .and_then(|v| v.as_str())
                .unwrap_or("HARD");
            if before_s == "HARD" && after_s == "SOFT" {
                return Some(X01_CONSTRAINT_WEAKENED.to_string());
            }
        }
    }

    let b_unc = ids(b.get("uncertainties"), "uncertainty_id");
    let a_unc = ids(a.get("uncertainties"), "uncertainty_id");
    if !(&b_unc - &a_unc).is_empty() {
        return Some(X03_UNCERTAINTY_ERASED.to_string());
    }

    let b_auth = auth(&b);
    let a_auth = auth(&a);
    let b_st = b_auth.get("status").and_then(|v| v.as_str()).unwrap_or("");
    let a_st = a_auth.get("status").and_then(|v| v.as_str()).unwrap_or("");
    if b_st == "DENIED" && a_st == "GRANTED" {
        return Some(P_DENIED_TO_GRANTED.to_string());
    }
    if b_st != "GRANTED" && a_st == "GRANTED" {
        let bl = b_auth.get("level").and_then(|v| v.as_i64()).unwrap_or(0);
        let al = a_auth.get("level").and_then(|v| v.as_i64()).unwrap_or(0);
        if al > bl {
            return Some(P_AUTHORITY_ESCALATION.to_string());
        }
    }

    let b_sens = label_set(b.get("sensitivity_labels"));
    let a_sens = label_set(a.get("sensitivity_labels"));
    if b_sens.contains("USER_PRIVATE") && !a_sens.contains("USER_PRIVATE") {
        return Some(P_PRIVACY_ESCALATION.to_string());
    }

    let b_taint = label_set(b.get("taint_labels"));
    let a_taint = label_set(a.get("taint_labels"));
    if b_taint.contains("external_untrusted") && !a_taint.contains("external_untrusted") {
        return Some(P_TRUST_ESCALATION.to_string());
    }

    if let Some(code) = extra_protected_detectors(&b, &a) {
        return Some(code);
    }

    if !strict_equal(&b, &a) {
        return Some(P_SEMANTIC_NONEQUIVALENT.to_string());
    }
    None
}

fn extra_protected_detectors(b: &Value, a: &Value) -> Option<String> {
    // UNKNOWN → PASS on failures
    let b_fails = fail_map(b);
    let a_fails = fail_map(a);
    for (fid, status) in &b_fails {
        if status.as_deref() == Some("UNKNOWN") && a_fails.get(fid).and_then(|s| s.as_deref()) == Some("PASS")
        {
            return Some(P_STATUS_COLLAPSE.to_string());
        }
        if status.as_deref() == Some("FAIL") && a_fails.get(fid).and_then(|s| s.as_deref()) == Some("PASS")
        {
            return Some(P_SEMANTIC_NONEQUIVALENT.to_string());
        }
    }

    // recommendation conditionality / option drift (C06 / C03)
    if rec_changed(b.get("recommendation"), a.get("recommendation")) {
        return Some(P_SEMANTIC_NONEQUIVALENT.to_string());
    }

    // preference drift
    if ids(b.get("user_preferences"), "preference_id")
        != ids(a.get("user_preferences"), "preference_id")
        || !strict_equal(
            b.get("user_preferences").unwrap_or(&Value::Null),
            a.get("user_preferences").unwrap_or(&Value::Null),
        )
    {
        // only if not already caught; fall through to nonequivalent later
    }

    // C01 authority creation: NONE/absent → GRANTED
    let b_auth = auth(b);
    let a_auth = auth(a);
    let b_st = b_auth.get("status").and_then(|v| v.as_str()).unwrap_or("NONE");
    let a_st = a_auth.get("status").and_then(|v| v.as_str()).unwrap_or("NONE");
    if b_st != "GRANTED" && a_st == "GRANTED" && b_st != "DENIED" {
        // minting authority
        return Some(P_AUTHORITY_ESCALATION.to_string());
    }

    // execution grants: target/args/expiry/revoke/consume / missing authority
    if let Some(code) = grant_detectors(b, a) {
        return Some(code);
    }

    // UNKNOWN outcome → PASS/SUCCESS retry laundering
    let bo = b.get("outcome").and_then(|v| v.as_str());
    let ao = a.get("outcome").and_then(|v| v.as_str());
    if bo == Some("UNKNOWN") && matches!(ao, Some("PASS" | "SUCCESS" | "VERIFIED_SUCCESS")) {
        return Some(C07_UNKNOWN_OUTCOME_RETRY.to_string());
    }
    if bo == Some("PARTIAL") && ao == Some("SUCCESS") {
        return Some(C07_PARTIAL_TO_SUCCESS.to_string());
    }
    if b.get("tool_success") == Some(&Value::Bool(true))
        && ao == Some("VERIFIED_SUCCESS")
        && bo != Some("VERIFIED_SUCCESS")
    {
        return Some(C07_TOOL_SUCCESS_TO_OUTCOME.to_string());
    }

    None
}

fn rec_changed(before: Option<&Value>, after: Option<&Value>) -> bool {
    match (before, after) {
        (None, None) => false,
        (Some(Value::Null), Some(Value::Null)) => false,
        (Some(b), Some(a)) => {
            if b.get("conditional") != a.get("conditional")
                || b.get("conditionality") != a.get("conditionality")
                || b.get("status") != a.get("status")
                || b.get("option") != a.get("option")
                || b.get("recommended_option") != a.get("recommended_option")
                || b.get("certainty") != a.get("certainty")
            {
                return true;
            }
            !strict_equal(b, a)
        }
        _ => true,
    }
}

fn grant_detectors(b: &Value, a: &Value) -> Option<String> {
    let b_grants = b.get("execution_grants").and_then(|v| v.as_array());
    let a_grants = a.get("execution_grants").and_then(|v| v.as_array());
    if let (Some(bg), Some(ag)) = (b_grants, a_grants) {
        if !bg.is_empty() && ag.is_empty() {
            return Some(C07_EXECUTION_MISSING_AUTHORITY.to_string());
        }
        for (before_g, after_g) in bg.iter().zip(ag.iter()) {
            if before_g.get("target") != after_g.get("target") {
                return Some(C07_TARGET_DRIFT.to_string());
            }
            if arguments_expanded(before_g.get("arguments"), after_g.get("arguments"))
                || arguments_expanded(before_g.get("argument_bounds"), after_g.get("argument_bounds"))
            {
                return Some(C07_ARGUMENT_DRIFT.to_string());
            }
            if flag_became_true(before_g, after_g, "expired")
                || time_expired(after_g)
            {
                return Some(C07_AUTHORITY_EXPIRED.to_string());
            }
            if flag_became_true(before_g, after_g, "revoked")
                || after_g.get("status").and_then(|v| v.as_str()) == Some("REVOKED")
                    && before_g.get("status").and_then(|v| v.as_str()) != Some("REVOKED")
            {
                return Some(C07_AUTHORITY_REVOKED.to_string());
            }
            if flag_became_true(before_g, after_g, "consumed")
                || after_g.get("status").and_then(|v| v.as_str()) == Some("CONSUMED")
                    && before_g.get("status").and_then(|v| v.as_str()) != Some("CONSUMED")
            {
                return Some(C07_AUTHORITY_CONSUMED.to_string());
            }
        }
    }
    // operation id replacement already handled; C07 alias when grant.operation_id drifts
    let b_op = b.get("operation_id");
    let a_op = a.get("operation_id");
    if b_op.is_some() && a_op.is_some() && b_op != a_op {
        return Some(C07_OPERATION_ID_REPLACED.to_string());
    }
    None
}

fn arguments_expanded(before: Option<&Value>, after: Option<&Value>) -> bool {
    match (before, after) {
        (Some(Value::Object(b)), Some(Value::Object(a))) => {
            a.len() > b.len() || a.keys().any(|k| !b.contains_key(k))
        }
        (Some(Value::Array(b)), Some(Value::Array(a))) => a.len() > b.len(),
        (Some(b), Some(a)) => !strict_equal(b, a),
        _ => false,
    }
}

fn flag_became_true(before: &Value, after: &Value, key: &str) -> bool {
    after.get(key) == Some(&Value::Bool(true)) && before.get(key) != Some(&Value::Bool(true))
}

fn time_expired(grant: &Value) -> bool {
    grant.get("expired") == Some(&Value::Bool(true))
}

fn fail_map(payload: &Value) -> BTreeMap<String, Option<String>> {
    let mut out = BTreeMap::new();
    if let Some(Value::Array(arr)) = payload.get("failures") {
        for f in arr {
            if let Some(id) = f.get("failure_id").and_then(as_id) {
                let status = match f.get("status") {
                    None => Some("__ABSENT__".into()),
                    Some(Value::Null) => None,
                    Some(Value::String(s)) => Some(s.clone()),
                    Some(other) => Some(other.to_string()),
                };
                // Python: missing key vs null:
                // if "status" not in f → we still record; UNKNOWN_NULLIFIED checks
                // a_fails[fid] is None only when status is JSON null (present).
                let status = if !f.as_object().map(|m| m.contains_key("status")).unwrap_or(false)
                {
                    Some("__ABSENT__".into())
                } else {
                    status
                };
                out.insert(id, status);
            }
        }
    }
    out
}

fn obj_map<'a>(payload: &'a Value, field: &str, key: &str) -> BTreeMap<String, &'a Value> {
    let mut out = BTreeMap::new();
    if let Some(Value::Array(arr)) = payload.get(field) {
        for item in arr {
            if let Some(id) = item.get(key).and_then(as_id) {
                out.insert(id, item);
            }
        }
    }
    out
}

fn label_set(value: Option<&Value>) -> BTreeSet<String> {
    let mut out = BTreeSet::new();
    if let Some(Value::Array(arr)) = value {
        for item in arr {
            if let Some(s) = item.as_str() {
                out.insert(s.to_string());
            }
        }
    }
    out
}

pub fn unknown_distinct(unknown: &Value, null_v: &Value, absent: &Value) -> bool {
    !semantic_equivalent(unknown, null_v)
        && !semantic_equivalent(unknown, absent)
        && !semantic_equivalent(null_v, absent)
}
