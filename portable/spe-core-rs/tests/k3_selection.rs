//! Frozen K3 vector expectations. Full digest parity is checked from Python.

use serde_json::{json, Value};
use spe_core_rs::k3::select;
use std::fs;
use std::path::PathBuf;

fn base() -> Value {
    json!({
        "goal": "Summarize the supplied notes.",
        "hard_constraints": [],
        "budget": null,
        "desired_output": "A short summary.",
        "facts": [{"fact_id": "f1", "statement": "Notes exist."}],
        "authority_state": {"level": 0, "status": "NONE", "grants": []},
        "provenance": [{"provenance_id": "p1", "source": "user"}]
    })
}

fn vectors() -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../proofs/k3_runtime_closure_20260929/K3_VECTORS.json");
    let text = fs::read_to_string(&path).unwrap_or_else(|err| panic!("vectors missing: {err}"));
    serde_json::from_str(&text).expect("vectors json")
}

#[test]
fn frozen_vectors_match_technique_ids_and_disposition() {
    let doc = vectors();
    let rows = doc["vectors"].as_array().expect("vectors");
    assert!(rows.len() >= 40);
    for row in rows {
        let mut protected = base();
        if let Some(extra) = row.get("protected").and_then(|v| v.as_object()) {
            let obj = protected.as_object_mut().unwrap();
            for (k, v) in extra {
                obj.insert(k.clone(), v.clone());
            }
        }
        let input = json!({
            "spe_api": "k3",
            "protected": protected,
            "category": row.get("category").cloned().unwrap_or(json!({})),
            "task": row.get("task").cloned().unwrap_or(json!({})),
        });
        let out = select(&input).expect("select");
        let expect = &row["expect"];
        assert_eq!(
            out["disposition"].as_str(),
            expect["disposition"].as_str(),
            "{}",
            row["id"]
        );
        assert_eq!(out["techniques"], expect["techniques"], "{}", row["id"]);
        assert_eq!(out["claims_pass"], false);
        assert_eq!(out["execution_authorized"], false);
        assert_eq!(out["network_enabled"], false);
    }
}

#[test]
fn unknown_is_not_pass() {
    let input = json!({
        "protected": base(),
        "task": {"ambiguous": true}
    });
    let out = select(&input).unwrap();
    assert_eq!(out["disposition"], "UNKNOWN");
    assert_eq!(out["claims_pass"], false);
    assert_eq!(out["techniques"], json!([]));
}
