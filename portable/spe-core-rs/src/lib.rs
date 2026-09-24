//! SPE portable semantic kernel — Sprint 5.
//! NEW_IMPLEMENTATION. not_a_release. Python remains the semantic oracle.

pub mod abi;
pub mod capabilities;
pub mod conformance;
pub mod protected;
pub mod reasons;
pub mod semantic;
pub mod value;
pub mod sha256_lite;
pub mod grounding;
pub mod protocols;

use serde::Serialize;
use serde_json::Value;

pub use conformance::evaluate_fixture;
pub use reasons::SpeError;

#[derive(Debug, Clone, Serialize)]
pub struct ConformanceResult {
    pub disposition: String,
    pub reason_code: Option<String>,
    pub output: Value,
}

impl ConformanceResult {
    pub fn valid(output: Value) -> Self {
        Self {
            disposition: "VALID".to_string(),
            reason_code: None,
            output,
        }
    }

    pub fn invalid(reason_code: impl Into<String>, output: Value) -> Self {
        Self {
            disposition: "INVALID".to_string(),
            reason_code: Some(reason_code.into()),
            output,
        }
    }

    pub fn status(&self) -> &'static str {
        if self.disposition == "VALID" && self.reason_code.is_none() {
            "VALID"
        } else {
            "INVALID"
        }
    }
}

/// JSON-in / JSON-out entry used by the CLI and WASM wrapper.
pub fn evaluate_json_str(input: &str) -> String {
    let parsed = match serde_json::from_str::<Value>(input) {
        Ok(v) => v,
        Err(_) => {
            return wrap_error("PORTABILITY_INVALID_FIXTURE", "malformed JSON");
        }
    };
    // Context-protocol / grounding differential API (Task 11).
    if parsed.get("spe_api").and_then(|v| v.as_str()) == Some("context_protocol") {
        return match protocols::evaluate_context_protocol(&parsed) {
            Ok(output) => wrap_raw_output(output),
            Err(err) => wrap_error(err.code(), &err.message),
        };
    }
    if parsed.get("spe_api").and_then(|v| v.as_str()) == Some("grounding") {
        return match grounding::evaluate_grounding(&parsed) {
            Ok(output) => wrap_raw_output(output),
            Err(err) => wrap_error(err.code(), &err.message),
        };
    }
    match evaluate_fixture(&parsed) {
        Ok(result) => wrap_result(&result),
        Err(err) => wrap_error(err.code(), &err.message),
    }
}

fn wrap_raw_output(output: Value) -> String {
    let body = serde_json::json!({
        "status": "VALID",
        "disposition": "VALID",
        "reason_code": null,
        "output": output,
    });
    value::canonical_dumps(&body).unwrap_or_else(|_| "{}".to_string())
}

fn wrap_result(result: &ConformanceResult) -> String {
    let body = serde_json::json!({
        "status": result.status(),
        "disposition": result.disposition,
        "reason_code": result.reason_code,
        "output": result.output,
    });
    value::canonical_dumps(&body).unwrap_or_else(|_| "{}".to_string())
}

fn wrap_error(code: &str, message: &str) -> String {
    let body = serde_json::json!({
        "status": "INVALID",
        "disposition": "INVALID",
        "reason_code": code,
        "output": serde_json::json!({"message": message}),
    });
    value::canonical_dumps(&body).unwrap_or_else(|_| "{}".to_string())
}
