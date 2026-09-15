use serde_json::json;
use spe_core_rs::capabilities::{
    cannot_infer_from_environment, evaluate_capability, kernel_declared_capabilities,
    require_capabilities, set_from_strs,
};
use spe_core_rs::reasons::PORTABILITY_REQUIRED_CAPABILITY_MISSING;
use spe_core_rs::evaluate_fixture;
use std::collections::BTreeSet;

#[test]
fn core_contract_runtime_cannot_run_local_execution() {
    let declared = set_from_strs(&["CORE_CONTRACT"]);
    let required = vec!["LOCAL_EXECUTION".to_string()];
    let err = require_capabilities(&required, &declared).unwrap_err();
    assert_eq!(err.code(), PORTABILITY_REQUIRED_CAPABILITY_MISSING);

    let input = json!({
        "kind": "positive",
        "capabilities_required": ["LOCAL_EXECUTION"],
        "declared_capabilities": ["CORE_CONTRACT"],
        "payload": {
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
            "authority_state": {"level": 0, "status": "NONE", "grants": []},
            "execution_grants": [],
            "failures": [],
            "taint_labels": [],
            "sensitivity_labels": [],
            "category_trace": []
        }
    });
    let err = evaluate_fixture(&input).unwrap_err();
    assert_eq!(err.code(), PORTABILITY_REQUIRED_CAPABILITY_MISSING);
}

#[test]
fn cannot_infer_authority_validation_from_os_language_library() {
    // Even though this process is Linux/Rust/serde, a runtime that did not
    // declare AUTHORITY_VALIDATION must not gain it from the environment.
    let declared = set_from_strs(&["CORE_CONTRACT"]);
    assert!(!declared.contains("AUTHORITY_VALIDATION"));
    assert!(cannot_infer_from_environment("AUTHORITY_VALIDATION") || !declared.contains("AUTHORITY_VALIDATION"));
    let err = require_capabilities(&["AUTHORITY_VALIDATION".into()], &declared).unwrap_err();
    assert_eq!(err.code(), PORTABILITY_REQUIRED_CAPABILITY_MISSING);
    let _ = std::env::consts::OS;
    let _ = std::env::consts::ARCH;
}

#[test]
fn exactly_satisfied_capability_sets_pass() {
    let declared = kernel_declared_capabilities();
    require_capabilities(
        &["CORE_CONTRACT".into(), "XCAT_HANDOFF".into(), "PROVENANCE".into()],
        &declared,
    )
    .unwrap();
    let available = declared;
    let d = evaluate_capability("CORE_CONTRACT", &available, &BTreeSet::new(), &BTreeSet::new());
    assert_eq!(d.status, "AVAILABLE");
    assert_eq!(d.outcome, "SUCCESS");
}

#[test]
fn missing_never_fakes_success() {
    let d = evaluate_capability(
        "LOCAL_EXECUTION",
        &set_from_strs(&["CORE_CONTRACT"]),
        &BTreeSet::new(),
        &BTreeSet::new(),
    );
    assert_eq!(d.status, "MISSING");
    assert_ne!(d.outcome, "SUCCESS");
}
