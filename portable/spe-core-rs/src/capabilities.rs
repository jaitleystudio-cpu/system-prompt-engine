//! Capability containment — never infer, never fake SUCCESS.

use crate::reasons::{
    SpeError, P_CAPABILITY_BLOCKED, P_CAPABILITY_DEFER, P_CAPABILITY_ESCALATION,
    P_CAPABILITY_MISSING, PORTABILITY_REQUIRED_CAPABILITY_MISSING,
};
use serde_json::Value;
use std::collections::BTreeSet;

pub const CAPABILITY_IDS: &[&str] = &[
    "CORE_CONTRACT",
    "XCAT_HANDOFF",
    "C02_RESEARCH",
    "C06_ANALYZE",
    "C01_DECIDE",
    "C03_COMMUNICATE",
    "C07_EXECUTION_INTENT",
    "AUTHORITY_VALIDATION",
    "PROVENANCE",
    "UNCERTAINTY",
    "PRIVACY_LABELS",
    "PROOF_RECEIPTS",
    "LOCAL_STORAGE",
    "LOCAL_EXECUTION",
    "NETWORK_OPTIONAL",
    "OFFLINE_MODE",
];

/// Capabilities this kernel actually implements. Never inferred from OS/lang.
pub fn kernel_declared_capabilities() -> BTreeSet<String> {
    [
        "CORE_CONTRACT",
        "XCAT_HANDOFF",
        "C02_RESEARCH",
        "C06_ANALYZE",
        "C01_DECIDE",
        "C03_COMMUNICATE",
        "C07_EXECUTION_INTENT",
        "AUTHORITY_VALIDATION",
        "PROVENANCE",
        "UNCERTAINTY",
        "PRIVACY_LABELS",
        "PROOF_RECEIPTS",
        "OFFLINE_MODE",
    ]
    .into_iter()
    .map(str::to_string)
    .collect()
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CapabilityDecision {
    pub capability: String,
    pub status: String,
    pub reason: Option<String>,
    pub outcome: String,
}

pub fn evaluate_capability(
    capability: &str,
    available: &BTreeSet<String>,
    blocked: &BTreeSet<String>,
    defer: &BTreeSet<String>,
) -> CapabilityDecision {
    if blocked.contains(capability) {
        return CapabilityDecision {
            capability: capability.to_string(),
            status: "BLOCKED".into(),
            reason: Some(P_CAPABILITY_BLOCKED.into()),
            outcome: "CAPABILITY_BLOCKED".into(),
        };
    }
    if defer.contains(capability) {
        return CapabilityDecision {
            capability: capability.to_string(),
            status: "DEFER".into(),
            reason: Some(P_CAPABILITY_DEFER.into()),
            outcome: "CAPABILITY_DEFER".into(),
        };
    }
    if !available.contains(capability) {
        return CapabilityDecision {
            capability: capability.to_string(),
            status: "MISSING".into(),
            reason: Some(P_CAPABILITY_MISSING.into()),
            outcome: "CAPABILITY_MISSING".into(),
        };
    }
    CapabilityDecision {
        capability: capability.to_string(),
        status: "AVAILABLE".into(),
        reason: None,
        outcome: "SUCCESS".into(),
    }
}

pub fn detect_capability_escalation(
    source: &BTreeSet<String>,
    target: &BTreeSet<String>,
) -> Result<(), String> {
    let extra: Vec<&String> = target.difference(source).collect();
    if extra.is_empty() {
        Ok(())
    } else {
        Err(P_CAPABILITY_ESCALATION.to_string())
    }
}

pub fn require_capabilities(
    required: &[String],
    declared: &BTreeSet<String>,
) -> Result<(), SpeError> {
    for cap in required {
        if !declared.contains(cap) {
            return Err(SpeError::new(
                PORTABILITY_REQUIRED_CAPABILITY_MISSING,
                format!("required capability {cap} is not declared"),
            ));
        }
    }
    Ok(())
}

/// Strict containment: required ⊆ declared. Never infer AUTHORITY_VALIDATION.
pub fn cannot_infer_from_environment(cap: &str) -> bool {
    // OS / language / library presence must not mint capabilities.
    let _ = std::env::consts::OS;
    !kernel_declared_capabilities().contains(cap)
}

pub fn set_from_json(value: Option<&Value>) -> BTreeSet<String> {
    let mut out = BTreeSet::new();
    if let Some(Value::Array(items)) = value {
        for item in items {
            if let Some(s) = item.as_str() {
                out.insert(s.to_string());
            }
        }
    }
    out
}

pub fn set_from_strs(items: &[&str]) -> BTreeSet<String> {
    items.iter().map(|s| s.to_string()).collect()
}
