//! Explicit protected-field manifest. Do not infer protection from fixtures.

use crate::semantic::{detect_attack, semantic_equivalent};
use crate::value::{canonicalize, strict_equal};
use serde_json::Value;

/// Frozen Sprint-4 protected semantics ∪ Sprint-5 plan fields.
pub const PROTECTED_FIELDS: &[&str] = &[
    "envelope_id",
    "goal_identity",
    "facts",
    "provenance",
    "uncertainties",
    "hard_constraints",
    "user_preferences",
    "recommendation",
    "authority_state",
    "execution_grants",
    "failures",
    "taint_labels",
    "sensitivity_labels",
    "operation_id",
    "outcome",
];

#[derive(Debug, Clone, Default)]
pub struct SemanticComparison {
    pub equivalent: bool,
    pub drift: Vec<String>,
}

pub fn extract_protected(value: &Value) -> Value {
    let payload = unwrap_payload(value);
    match payload {
        Value::Object(map) => {
            let mut out = serde_json::Map::new();
            for field in PROTECTED_FIELDS {
                if let Some(v) = map.get(*field) {
                    out.insert((*field).to_string(), v.clone());
                }
            }
            Value::Object(out)
        }
        other => other.clone(),
    }
}

fn unwrap_payload(value: &Value) -> &Value {
    if let Some(output) = value.get("output") {
        if output.is_object() {
            if output.get("envelope_id").is_some() {
                return output;
            }
            if let Some(p) = output.get("payload") {
                return p;
            }
            return output;
        }
    }
    if let Some(p) = value.get("payload") {
        if p.is_object() && value.get("envelope_id").is_none() {
            return p;
        }
    }
    value
}

pub fn compare_protected(a: &Value, b: &Value) -> SemanticComparison {
    let pa = match canonicalize(&extract_protected(a)) {
        Ok(v) => v,
        Err(_) => {
            return SemanticComparison {
                equivalent: false,
                drift: vec!["canonicalize".into()],
            }
        }
    };
    let pb = match canonicalize(&extract_protected(b)) {
        Ok(v) => v,
        Err(_) => {
            return SemanticComparison {
                equivalent: false,
                drift: vec!["canonicalize".into()],
            }
        }
    };
    let mut drift = Vec::new();
    match (&pa, &pb) {
        (Value::Object(ma), Value::Object(mb)) => {
            let mut keys: Vec<&str> = PROTECTED_FIELDS.to_vec();
            keys.sort();
            for k in keys {
                let av = ma.get(k);
                let bv = mb.get(k);
                match (av, bv) {
                    (None, None) => {}
                    (Some(x), Some(y)) if strict_equal(x, y) => {}
                    _ => drift.push(k.to_string()),
                }
            }
        }
        _ if !strict_equal(&pa, &pb) => drift.push("root".into()),
        _ => {}
    }
    SemanticComparison {
        equivalent: drift.is_empty() && semantic_equivalent(&pa, &pb),
        drift,
    }
}

pub fn attack_or_nonequivalent(before: &Value, after: &Value) -> Option<String> {
    detect_attack(before, after)
}
