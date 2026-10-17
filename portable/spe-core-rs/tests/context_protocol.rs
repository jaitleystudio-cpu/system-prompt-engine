//! Context + protocol compiler conformance (Task 11).
//! Vectors are frozen Python oracle outputs under tests/portability/.

use serde_json::Value;
use spe_core_rs::grounding::{
    compile_context_need, freshness_state, plan_refresh, sanitize_external_payload,
    ContextCapsule,
};
use spe_core_rs::protocols::{
    compile_execution_contract, render_execution_contract, select_protocol_depth,
    CapabilityProfile, DepthSignals, ProtocolDepth,
};
use spe_core_rs::value::canonical_dumps;
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;

fn vectors_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/portability/context_protocol_vectors.json")
}

fn vectors() -> &'static Value {
    static V: OnceLock<Value> = OnceLock::new();
    V.get_or_init(|| {
        let raw = fs::read_to_string(vectors_path()).expect("read context_protocol_vectors.json");
        serde_json::from_str(&raw).expect("parse vectors")
    })
}

fn fixture(id: &str) -> &'static Value {
    vectors()
        .get("fixtures")
        .and_then(|v| v.as_array())
        .expect("fixtures")
        .iter()
        .find(|f| f.get("id").and_then(|x| x.as_str()) == Some(id))
        .unwrap_or_else(|| panic!("missing fixture {id}"))
}

struct CompileOut {
    rendered: String,
    contract: Value,
}

fn compile_fixture(id: &str) -> Result<CompileOut, String> {
    let f = fixture(id);
    let input = f.get("input").ok_or("missing input")?;
    let domain_ids: Vec<String> = input
        .get("domain_ids")
        .and_then(|v| v.as_array())
        .ok_or("domain_ids")?
        .iter()
        .map(|v| v.as_str().unwrap().to_string())
        .collect();
    let depth = ProtocolDepth::parse(input.get("depth").and_then(|v| v.as_str()).unwrap())
        .map_err(|e| e.message)?;
    let profile = match input.get("capability_profile") {
        None | Some(Value::Null) => None,
        Some(v) => Some(CapabilityProfile::from_value(v).map_err(|e| e.message)?),
    };
    let contract = compile_execution_contract(&domain_ids, depth, profile).map_err(|e| e.message)?;
    let adapter = input
        .get("adapter_id")
        .and_then(|v| v.as_str())
        .unwrap_or("ANY_AI");
    let rendered = render_execution_contract(&contract, adapter).map_err(|e| e.message)?;
    Ok(CompileOut {
        rendered,
        contract: contract.to_value(),
    })
}

fn canon(v: &Value) -> String {
    canonical_dumps(v).expect("canon")
}

mod context_protocol {
    use super::*;

    #[test]
    fn research_critical_keeps_all_required_stages() {
        let out = compile_fixture("research-critical").unwrap();
        assert!(out.rendered.contains("Contradictory Evidence"));
        assert!(out.rendered.contains("Replication / Independent Check"));
    }

    #[test]
    fn research_critical_matches_frozen_vector() {
        let f = fixture("research-critical");
        let out = compile_fixture("research-critical").unwrap();
        let expected_rendered = f["expected"]["rendered"].as_str().unwrap();
        assert_eq!(out.rendered, expected_rendered);
        assert_eq!(canon(&out.contract), canon(&f["expected"]["contract"]));
    }

    #[test]
    fn no_context_writing_matches_vector() {
        let f = fixture("no-context-writing");
        let text = f["input"]["request_text"].as_str().unwrap();
        let need = compile_context_need(text, None).unwrap();
        assert_eq!(canon(&need.to_value()), canon(&f["expected"]["need"]));
    }

    #[test]
    fn current_coding_docs_matches_vector() {
        let f = fixture("current-coding-docs");
        let text = f["input"]["request_text"].as_str().unwrap();
        let need = compile_context_need(text, None).unwrap();
        assert_eq!(canon(&need.to_value()), canon(&f["expected"]["need"]));
        let out = compile_fixture("current-coding-docs").unwrap();
        assert_eq!(out.rendered, f["expected"]["rendered"].as_str().unwrap());
        assert_eq!(canon(&out.contract), canon(&f["expected"]["contract"]));
    }

    #[test]
    fn multi_domain_merge_dedupes_auto_route() {
        let f = fixture("multi-domain-merge");
        let out = compile_fixture("multi-domain-merge").unwrap();
        assert_eq!(canon(&out.contract), canon(&f["expected"]["contract"]));
        assert_eq!(out.rendered, f["expected"]["rendered"].as_str().unwrap());
        let nodes = out.contract["graph"]["nodes"].as_array().unwrap();
        let count = nodes
            .iter()
            .filter(|n| n["merge_key"].as_str() == Some("capability.auto_route"))
            .count();
        assert_eq!(count as i64, f["expected"]["auto_route_count"].as_i64().unwrap());
    }

    #[test]
    fn unknown_capabilities_conditional_routing() {
        let f = fixture("unknown-capabilities");
        let out = compile_fixture("unknown-capabilities").unwrap();
        assert_eq!(out.rendered, f["expected"]["rendered"].as_str().unwrap());
        for s in f["expected"]["must_contain"].as_array().unwrap() {
            assert!(out.rendered.contains(s.as_str().unwrap()));
        }
        for s in f["expected"]["must_not_contain"].as_array().unwrap() {
            assert!(!out.rendered.contains(s.as_str().unwrap()));
        }
    }

    #[test]
    fn many_capabilities_names_inventory_prefers_minimal() {
        let f = fixture("many-capabilities");
        let out = compile_fixture("many-capabilities").unwrap();
        assert_eq!(out.rendered, f["expected"]["rendered"].as_str().unwrap());
        for s in f["expected"]["must_contain"].as_array().unwrap() {
            assert!(
                out.rendered.contains(s.as_str().unwrap()),
                "missing {}",
                s
            );
        }
    }

    #[test]
    fn stale_context_refresh_plan_matches_vector() {
        let f = fixture("stale-context");
        let capsule = ContextCapsule::from_value(&f["input"]["capsule"]).unwrap();
        let now = f["input"]["now_iso"].as_str().unwrap();
        let state = freshness_state(&capsule, now);
        assert_eq!(state, f["expected"]["freshness_state"].as_str().unwrap());
        let plan = plan_refresh(&capsule, now).expect("refresh plan");
        assert_eq!(canon(&plan.to_value()), canon(&f["expected"]["refresh_plan"]));
    }

    #[test]
    fn malicious_source_payload_rejected() {
        let f = fixture("malicious-source-payload-rejection");
        let mal = &f["input"]["malicious"];
        let err = sanitize_external_payload(mal).unwrap_err();
        assert!(
            err.message.contains("forbidden keys"),
            "got {}",
            err.message
        );
        let clean = sanitize_external_payload(&f["input"]["clean"]).unwrap();
        assert_eq!(canon(&clean), canon(&f["expected"]["clean"]));
    }

    #[test]
    fn depth_routing_thresholds_match_vector() {
        let f = fixture("depth-routing-thresholds");
        let cases = f["input"]["cases"].as_array().unwrap();
        let expected = f["expected"]["depths"].as_array().unwrap();
        for (case, exp) in cases.iter().zip(expected.iter()) {
            let signals = DepthSignals::from_value(&case["signals"]).unwrap();
            let depth = select_protocol_depth(signals);
            assert_eq!(depth.as_str(), exp.as_str().unwrap());
        }
    }
}
