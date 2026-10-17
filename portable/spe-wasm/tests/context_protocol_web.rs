//! Task 12: web compile fields flow through the thin WASM wrapper (no TS).

use serde_json::json;

#[test]
fn wrapper_exposes_context_protocol_compile_fields() {
    let input = json!({
        "spe_api": "context_protocol",
        "op": "compile",
        "request_text": "research the latest evidence on topic X",
        "source_mode": "AUTO",
        "requested_depth": "DEEP",
        "adapter_id": "ANY_AI"
    });
    let text = serde_json::to_string(&input).unwrap();
    let via_wrap = spe_wasm::evaluate_json(&text);
    let via_core = spe_core_rs::evaluate_json_str(&text);
    assert_eq!(via_wrap, via_core);
    let v: serde_json::Value = serde_json::from_str(&via_wrap).unwrap();
    assert_eq!(v["status"], "VALID");
    let out = &v["output"];
    assert_eq!(out["source_mode"], "AUTO");
    assert_eq!(out["requested_depth"], "DEEP");
    assert_eq!(out["resolved_depth"], "DEEP");
    assert!(out.get("context_summary").is_some());
    assert!(out.get("execution_contract").is_some());
    assert!(out.get("quality_record").is_some());
    assert_eq!(out["capability_profile_mode"], "CONDITIONAL");
}

#[test]
fn wrapper_maps_fast_to_quick_and_off_sources() {
    let input = json!({
        "spe_api": "context_protocol",
        "op": "compile",
        "request_text": "write a short poem about rain",
        "source_mode": "OFF",
        "requested_depth": "FAST",
    });
    let text = serde_json::to_string(&input).unwrap();
    let v: serde_json::Value =
        serde_json::from_str(&spe_wasm::evaluate_json(&text)).unwrap();
    assert_eq!(v["status"], "VALID");
    assert_eq!(v["output"]["resolved_depth"], "QUICK");
    assert_eq!(v["output"]["source_mode"], "OFF");
    assert_eq!(v["output"]["context_summary"]["max_sources"], 0);
}
