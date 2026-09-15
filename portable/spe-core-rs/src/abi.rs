//! spe.universal-abi.v1 transport semantics.

use crate::reasons::{SpeError, PORTABILITY_ABI_UNSUPPORTED, PORTABILITY_TIMESTAMP_AMBIGUOUS, P_ABI_MISMATCH};
use crate::value::{canonicalize, is_naive_iso8601};
use serde_json::{json, Map, Value};

pub const ABI_ID: &str = "spe.universal-abi.v1";
pub const ABI_MAJOR: u64 = 1;
pub const ABI_MINOR: u64 = 0;
pub const ABI_PATCH: u64 = 0;

const AUTHORITY_TIME_KEYS: &[&str] = &[
    "granted_at",
    "expires_at",
    "revoked_at",
    "not_before",
    "not_after",
    "timestamp",
    "issued_at",
    "consumed_at",
];

pub fn abi_compatible(peer_abi_id: &str, peer_major: u64) -> Result<(), SpeError> {
    if peer_abi_id != ABI_ID || peer_major != ABI_MAJOR {
        return Err(SpeError::new(
            PORTABILITY_ABI_UNSUPPORTED,
            format!(
                "unsupported ABI {} major {} (expected {} {})",
                peer_abi_id, peer_major, ABI_ID, ABI_MAJOR
            ),
        ));
    }
    Ok(())
}

pub fn abi_mismatch_reason(peer_abi_id: &str, peer_major: u64) -> Option<&'static str> {
    if peer_abi_id != ABI_ID || peer_major != ABI_MAJOR {
        Some(P_ABI_MISMATCH)
    } else {
        None
    }
}

/// Validate optional ABI envelope fields on a fixture root.
pub fn validate_abi_header(input: &Value) -> Result<(), SpeError> {
    let obj = match input.as_object() {
        Some(o) => o,
        None => return Ok(()),
    };
    if let Some(abi_id) = obj.get("abi_id").and_then(|v| v.as_str()) {
        let major = obj
            .get("major")
            .and_then(|v| v.as_u64())
            .unwrap_or(u64::MAX);
        abi_compatible(abi_id, major)?;
    } else if let Some(ver) = obj.get("abi_version").and_then(|v| v.as_object()) {
        let abi_id = ver
            .get("abi_id")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let major = ver.get("major").and_then(|v| v.as_u64()).unwrap_or(u64::MAX);
        abi_compatible(abi_id, major)?;
    }
    Ok(())
}

pub fn validate_authority_timestamps(value: &Value) -> Result<(), SpeError> {
    walk_authority_times(value, false)
}

fn walk_authority_times(value: &Value, in_authority: bool) -> Result<(), SpeError> {
    match value {
        Value::Object(map) => {
            let here = in_authority
                || map.contains_key("grants") && map.contains_key("status")
                || map.contains_key("grant_id")
                || map.contains_key("expires_at")
                || map.contains_key("target");
            for (k, v) in map {
                if here && AUTHORITY_TIME_KEYS.contains(&k.as_str()) {
                    if let Some(s) = v.as_str() {
                        if is_naive_iso8601(s) {
                            return Err(SpeError::new(
                                PORTABILITY_TIMESTAMP_AMBIGUOUS,
                                format!("authority timestamp {k} is local-time-only"),
                            ));
                        }
                    }
                }
                walk_authority_times(v, here || k == "authority_state" || k == "execution_grants")?;
            }
            Ok(())
        }
        Value::Array(items) => {
            for item in items {
                walk_authority_times(item, in_authority)?;
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

pub fn transport_canonicalize(value: &Value) -> Result<Value, SpeError> {
    canonicalize(value)
}

pub fn implementation_declaration(capabilities: &[String]) -> Value {
    let mut caps = capabilities.to_vec();
    caps.sort();
    json!({
        "implementation_id": "spe-core-rs",
        "platform_id": "PLATFORM:RUST_KERNEL",
        "abi_version": {
            "abi_id": ABI_ID,
            "major": ABI_MAJOR,
            "minor": ABI_MINOR,
            "patch": ABI_PATCH,
        },
        "capabilities": caps,
        "network_mode": "NONE",
        "status": "CONFORMANCE_PARTIAL",
        "new_implementation": true,
        "not_a_release": true,
    })
}

pub fn utf8_preserved(s: &str) -> bool {
    std::str::from_utf8(s.as_bytes()).is_ok()
}

pub fn empty_object() -> Map<String, Value> {
    Map::new()
}
