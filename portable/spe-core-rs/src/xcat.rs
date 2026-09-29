//! XCAT DOMAIN API — route / apply / taxonomy validation.
//! Python `spe_runtime.xcat` + `spe_runtime.categories.apply` is the semantic oracle.
//! This module must not reinterpret laws.

use crate::reasons::SpeError;
use crate::sha256_lite::sha256_hex;
use serde_json::{json, Map, Value};
use std::collections::{BTreeSet, HashSet};

const TWIN_VERSION: &str = "xcat.router.v1";
pub(crate) const CURRENT_TAXONOMY_VERSION: &str = "2";
const LEGACY_TAXONOMY_VERSION: &str = "1";
const CANON_CONFIRM_KEY: &str = "confirm_canon_overwrite";

fn category_ids() -> HashSet<&'static str> {
    [
        "CAT:C01", "CAT:C02", "CAT:C03", "CAT:C04", "CAT:C05", "CAT:C06", "CAT:C07", "CAT:C08",
        "CAT:C09", "CAT:C10", "CAT:C11", "CAT:C12",
    ]
    .into_iter()
    .collect()
}

fn legacy_collision_ids() -> HashSet<&'static str> {
    [
        "CAT:C04", "CAT:C05", "CAT:C08", "CAT:C09", "CAT:C10", "CAT:C11", "CAT:C12",
    ]
    .into_iter()
    .collect()
}

fn legacy_name(category_id: &str) -> &'static str {
    match category_id {
        "CAT:C04" => "Plan",
        "CAT:C05" => "Verify",
        "CAT:C08" => "Recover",
        "CAT:C09" => "Privacy",
        "CAT:C10" => "Authority",
        "CAT:C11" => "Provenance",
        "CAT:C12" => "Capability",
        _ => "?",
    }
}

fn forbidden_payload_keys() -> HashSet<&'static str> {
    [
        "permit",
        "permits",
        "verified_outcome",
        "verified_success",
        "execution_grant",
        "authority",
        "receipt",
        "receipts",
        "EXECUTED",
        "VERIFIED_SUCCESS",
        "PROMOTE",
    ]
    .into_iter()
    .collect()
}

fn allowed_fields(category_id: &str) -> Option<&'static [&'static str]> {
    Some(match category_id {
        "CAT:C01" => &[
            "options",
            "criteria",
            "constraints",
            "evidence",
            "uncertainty",
            "sensitivity",
            "reversibility",
            "decision_authority",
        ],
        "CAT:C02" => &[
            "question",
            "search_strategy",
            "source_classes",
            "freshness",
            "contradiction_map",
            "gaps",
            "synthesis",
        ],
        "CAT:C03" => &[
            "communicative_goal",
            "audience",
            "facts_claims",
            "voice",
            "format",
            "prohibited_claims",
        ],
        "CAT:C04" => &[
            "source_language",
            "target_language",
            "protected_terms",
            "localization_policy",
            "transliteration_policy",
            "alignment_map",
        ],
        "CAT:C05" => &[
            "learner_state",
            "concept_graph",
            "progression",
            "practice",
            "mastery_evidence",
        ],
        "CAT:C06" => &[
            "source_objects",
            "dimensions",
            "extraction",
            "normalization",
            "calculations",
            "anomalies",
            "conclusions",
        ],
        "CAT:C07" => &[
            "desired_action",
            "authority",
            "credentials_reference",
            "reversibility",
            "approvals",
            "postconditions",
            "receipt",
        ],
        "CAT:C08" => &[
            "customer",
            "market",
            "offer",
            "channels",
            "pricing",
            "unit_economics",
            "experiments",
            "metrics",
        ],
        "CAT:C09" => &[
            "repository",
            "architecture",
            "interfaces",
            "tests",
            "environment",
            "security_constraints",
            "performance_constraints",
            "rollback",
            "proof_artifacts",
        ],
        "CAT:C10" => &[
            "medium",
            "source_assets",
            "storyboard",
            "visual_audio_language",
            "timing",
            "rights_provenance",
            "visual_observations",
            "image_to_prompt_mode",
            "preserve_change_regions",
            "reference_image_roles",
            "target_adapter_requirements",
        ],
        "CAT:C11" => &[
            "profile",
            "target_role",
            "evidence_of_skills",
            "gaps",
            "opportunities",
            "compensation_geography",
            "plan",
        ],
        "CAT:C12" => &[
            "canon",
            "timeline",
            "characters",
            "knowledge_states",
            "relationships",
            "plot",
            "scenes",
            "roleplay_branching_franchise_state",
        ],
        _ => return None,
    })
}

/// Match Python `json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)`.
fn python_compatible_dumps(value: &Value) -> String {
    let mut out = String::new();
    write_python_json(value, &mut out);
    out
}

fn write_python_json(value: &Value, out: &mut String) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(true) => out.push_str("true"),
        Value::Bool(false) => out.push_str("false"),
        Value::Number(n) => out.push_str(&n.to_string()),
        Value::String(s) => write_json_string(s, out),
        Value::Array(items) => {
            out.push('[');
            for (i, item) in items.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                write_python_json(item, out);
            }
            out.push(']');
        }
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            out.push('{');
            for (i, k) in keys.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                write_json_string(k, out);
                out.push(':');
                write_python_json(&map[*k], out);
            }
            out.push('}');
        }
    }
}

fn write_json_string(s: &str, out: &mut String) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{08}' => out.push_str("\\b"),
            '\u{0C}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

fn routing_id(evidence: &Value) -> String {
    let digest = sha256_hex(python_compatible_dumps(evidence).as_bytes());
    format!("route-{digest}")
}

fn as_category(value: Option<&Value>) -> Option<String> {
    let s = value?.as_str()?.trim();
    if category_ids().contains(s) {
        Some(s.to_string())
    } else {
        None
    }
}

fn collect_evidence_refs(evidence: &Map<String, Value>) -> Vec<Value> {
    let mut refs: Vec<Value> = Vec::new();
    for key in ["category_ref", "primary_category", "stage_category", "xcat_id"] {
        if evidence.contains_key(key) {
            refs.push(json!({"key": key, "value": evidence.get(key).cloned().unwrap_or(Value::Null)}));
        }
    }
    if let Some(Value::Object(stage)) = evidence.get("stage") {
        for key in ["category_ref", "primary_category", "xcat_id"] {
            if stage.contains_key(key) {
                refs.push(json!({
                    "key": format!("stage.{key}"),
                    "value": stage.get(key).cloned().unwrap_or(Value::Null)
                }));
            }
        }
    }
    if let Some(Value::Array(explicit)) = evidence.get("category_evidence") {
        for item in explicit {
            if let Value::Object(obj) = item {
                refs.push(Value::Object(obj.clone()));
            }
        }
    }
    refs
}

fn route_mission_stage(evidence: &Value) -> Result<Value, SpeError> {
    let evidence_map = evidence.as_object().ok_or_else(|| {
        SpeError::new("PORTABILITY_INVALID_FIXTURE", "evidence must be a mapping")
    })?;
    let rid = routing_id(evidence);
    let refs = collect_evidence_refs(evidence_map);

    if evidence_map.contains_key("self_selected_category") && refs.is_empty() {
        let self_selected = evidence_map.get("self_selected_category");
        let rejected = as_category(self_selected)
            .unwrap_or_else(|| match self_selected {
                Some(Value::String(s)) => s.clone(),
                Some(other) => other.to_string(),
                None => String::new(),
            });
        return Ok(json!({
            "routing_id": rid,
            "twin_version": TWIN_VERSION,
            "primary_category": Value::Null,
            "secondary_categories": [],
            "confidence_basis": ["SELF_SELECTED_WITHOUT_EVIDENCE"],
            "category_evidence": [],
            "rejected_categories": [rejected],
            "cross_category_dependencies": [],
            "escalation_conditions": ["REQUIRE_EXPLICIT_CATEGORY_EVIDENCE"],
            "routing_receipt": {"routing_id": rid, "basis": "rejected_self_selection"},
            "disposition": "UNKNOWN",
        }));
    }

    let mut candidates: Vec<String> = Vec::new();
    let mut basis: Vec<String> = Vec::new();
    for ref_item in &refs {
        let cat = if let Some(obj) = ref_item.as_object() {
            if obj.contains_key("value") {
                as_category(obj.get("value"))
            } else {
                as_category(obj.get("category"))
            }
        } else {
            None
        };
        if let Some(cat) = cat {
            if !candidates.contains(&cat) {
                let key = ref_item
                    .get("key")
                    .and_then(|v| v.as_str())
                    .unwrap_or("category_ref");
                basis.push(key.to_string());
                candidates.push(cat);
            }
        }
    }

    let mut secondaries: Vec<String> = Vec::new();
    if let Some(Value::Array(raw)) = evidence_map.get("secondary_categories") {
        for item in raw {
            if let Some(cat) = as_category(Some(item)) {
                if !secondaries.contains(&cat) && candidates.first() != Some(&cat) {
                    secondaries.push(cat);
                }
            }
        }
    }

    let mut deps: Vec<Value> = Vec::new();
    if let Some(Value::Array(raw_deps)) = evidence_map.get("cross_category_dependencies") {
        for d in raw_deps {
            if let Value::Object(obj) = d {
                deps.push(Value::Object(obj.clone()));
            }
        }
    }

    if candidates.is_empty() {
        return Ok(json!({
            "routing_id": rid,
            "twin_version": TWIN_VERSION,
            "primary_category": Value::Null,
            "secondary_categories": secondaries,
            "confidence_basis": ["NO_EXPLICIT_CATEGORY_EVIDENCE"],
            "category_evidence": refs,
            "rejected_categories": [],
            "cross_category_dependencies": deps,
            "escalation_conditions": ["NEEDS_DISAMBIGUATION"],
            "routing_receipt": {"routing_id": rid, "basis": "insufficient_evidence"},
            "disposition": "NEEDS_DISAMBIGUATION",
        }));
    }

    let primary = candidates[0].clone();
    let mut seen: HashSet<String> = HashSet::new();
    let mut ordered_extra: Vec<String> = Vec::new();
    for c in candidates.iter().skip(1).chain(secondaries.iter()) {
        if c != &primary && seen.insert(c.clone()) {
            ordered_extra.push(c.clone());
        }
    }
    let confidence_basis = if basis.is_empty() {
        vec!["EXPLICIT_CATEGORY_REF".to_string()]
    } else {
        basis
    };

    Ok(json!({
        "routing_id": rid,
        "twin_version": TWIN_VERSION,
        "primary_category": primary,
        "secondary_categories": ordered_extra,
        "confidence_basis": confidence_basis,
        "category_evidence": refs,
        "rejected_categories": [],
        "cross_category_dependencies": deps,
        "escalation_conditions": [],
        "routing_receipt": {
            "routing_id": rid,
            "basis": "explicit_evidence",
            "primary_category": primary,
        },
        "disposition": "ROUTED",
    }))
}

pub fn validate_taxonomy_version(version: Option<&Value>) -> Value {
    let Some(Value::String(raw)) = version else {
        return json!({
            "status": "error",
            "code": "UNKNOWN_TAXONOMY_VERSION",
            "message": "taxonomy_version must be a non-empty string",
        });
    };
    let v = raw.trim();
    if v.is_empty() {
        return json!({
            "status": "error",
            "code": "UNKNOWN_TAXONOMY_VERSION",
            "message": "taxonomy_version must be a non-empty string",
        });
    }
    if v == CURRENT_TAXONOMY_VERSION {
        return json!({
            "status": "ok",
            "code": "CURRENT",
            "message": "taxonomy version current",
        });
    }
    if v == LEGACY_TAXONOMY_VERSION {
        return json!({
            "status": "ok",
            "code": "LEGACY",
            "message": "legacy taxonomy — migration required before reinterpretation",
        });
    }
    json!({
        "status": "error",
        "code": "UNKNOWN_TAXONOMY_VERSION",
        "message": format!("unknown taxonomy_version: '{}'", v.replace('\'', "\\'")),
    })
}

fn reject_legacy_payload_reinterpretation(
    taxonomy_version: Option<&Value>,
    category_id: &str,
) -> Result<(), SpeError> {
    let check = validate_taxonomy_version(taxonomy_version);
    let code = check.get("code").and_then(|v| v.as_str()).unwrap_or("");
    if code == "UNKNOWN_TAXONOMY_VERSION" {
        let shown = match taxonomy_version {
            Some(Value::String(s)) => format!("'{}'", s.replace('\'', "\\'")),
            Some(other) => other.to_string(),
            None => "None".to_string(),
        };
        return Err(SpeError::new(
            "UNKNOWN_TAXONOMY_VERSION",
            format!("UNKNOWN_TAXONOMY_VERSION: {shown}"),
        ));
    }
    let version_str = taxonomy_version
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if version_str == LEGACY_TAXONOMY_VERSION && legacy_collision_ids().contains(category_id) {
        let legacy = legacy_name(category_id);
        return Err(SpeError::new(
            "LEGACY_TAXONOMY_UNMIGRATED",
            format!(
                "LEGACY_TAXONOMY_UNMIGRATED: category {category_id} \
                 (legacy name '{legacy}') cannot be reinterpreted under \
                 taxonomy_version='{LEGACY_TAXONOMY_VERSION}'; migrate to \
                 {CURRENT_TAXONOMY_VERSION} first"
            ),
        ));
    }
    Ok(())
}

fn reject_unknown_fields(category_id: &str, payload: &Map<String, Value>) -> Result<(), SpeError> {
    let allowed = allowed_fields(category_id).ok_or_else(|| {
        SpeError::new(
            "PORTABILITY_INVALID_FIXTURE",
            format!("unknown category_id for payload spec: '{category_id}'"),
        )
    })?;
    let allowed_set: HashSet<&str> = allowed.iter().copied().collect();
    let mut unknown: BTreeSet<String> = BTreeSet::new();
    for key in payload.keys() {
        if !allowed_set.contains(key.as_str()) {
            unknown.insert(key.clone());
        }
    }
    if !unknown.is_empty() {
        let list: Vec<String> = unknown
            .into_iter()
            .map(|k| format!("'{k}'"))
            .collect();
        return Err(SpeError::new(
            "PORTABILITY_INVALID_FIXTURE",
            format!("{category_id} payload contains unknown fields: [{list}]", list = list.join(", ")),
        ));
    }
    Ok(())
}

fn reject_forbidden_payload_keys(
    category_id: &str,
    payload: &Map<String, Value>,
) -> Result<(), SpeError> {
    let forbidden = forbidden_payload_keys();
    let allowed: HashSet<&str> = allowed_fields(category_id)
        .unwrap_or(&[])
        .iter()
        .copied()
        .collect();
    let mut bad: BTreeSet<String> = BTreeSet::new();
    for key in payload.keys() {
        if forbidden.contains(key.as_str()) && !allowed.contains(key.as_str()) {
            bad.insert(key.clone());
        }
    }
    if !bad.is_empty() {
        let list: Vec<String> = bad.into_iter().collect();
        return Err(SpeError::new(
            "PORTABILITY_INVALID_FIXTURE",
            format!("category_payload contains forbidden keys: {list:?}"),
        ));
    }
    Ok(())
}

fn status_claims_mastered(value: Option<&Value>) -> bool {
    match value {
        Some(Value::String(s)) => s.eq_ignore_ascii_case("MASTERED"),
        Some(Value::Object(obj)) => {
            if let Some(Value::String(status)) = obj.get("status") {
                if status.eq_ignore_ascii_case("MASTERED") {
                    return true;
                }
            }
            if let Some(Value::String(level)) = obj.get("level") {
                if level.eq_ignore_ascii_case("MASTERED") {
                    return true;
                }
            }
            false
        }
        _ => false,
    }
}

fn collect_keys(value: &Value, depth: usize) -> HashSet<String> {
    let mut keys = HashSet::new();
    if depth > 8 {
        return keys;
    }
    match value {
        Value::Object(map) => {
            for (k, v) in map {
                keys.insert(k.clone());
                keys.extend(collect_keys(v, depth + 1));
            }
        }
        Value::Array(items) => {
            for item in items {
                keys.extend(collect_keys(item, depth + 1));
            }
        }
        _ => {}
    }
    keys
}

fn enforce_c04(payload: &Map<String, Value>) -> Result<(), SpeError> {
    let mut certified = false;
    if let Some(Value::Object(policy)) = payload.get("localization_policy") {
        if let Some(Value::String(cert)) = policy
            .get("certification")
            .or_else(|| policy.get("status"))
        {
            let normalized = cert.to_uppercase().replace('-', "_");
            if normalized.contains("HUMAN_CERTIFIED") {
                certified = true;
            }
        }
        if policy.get("human_certified") == Some(&Value::Bool(true)) {
            certified = true;
        }
    }
    if certified {
        let has_alignment = match payload.get("alignment_map") {
            None | Some(Value::Null) => false,
            Some(Value::Bool(false)) => false,
            Some(Value::String(s)) if s.is_empty() => false,
            Some(Value::Array(a)) if a.is_empty() => false,
            Some(Value::Object(o)) if o.is_empty() => false,
            Some(_) => true,
        };
        if !has_alignment {
            return Err(SpeError::new(
                "PORTABILITY_INVALID_FIXTURE",
                "C04: cannot claim translation human-certified without evidence",
            ));
        }
    }
    Ok(())
}

fn enforce_c05(payload: &Map<String, Value>) -> Result<(), SpeError> {
    let mastered = status_claims_mastered(payload.get("learner_state"))
        || status_claims_mastered(payload.get("progression"));
    if mastered {
        let has_evidence = match payload.get("mastery_evidence") {
            None | Some(Value::Null) => false,
            Some(Value::Bool(false)) => false,
            Some(Value::String(s)) if s.is_empty() => false,
            Some(Value::Array(a)) if a.is_empty() => false,
            Some(Value::Object(o)) if o.is_empty() => false,
            Some(_) => true,
        };
        if !has_evidence {
            return Err(SpeError::new(
                "PORTABILITY_INVALID_FIXTURE",
                "C05: MUST NOT claim MASTERED without mastery_evidence",
            ));
        }
    }
    Ok(())
}

fn enforce_c08(payload: &Map<String, Value>) -> Result<(), SpeError> {
    if let Some(Value::Object(experiments)) = payload.get("experiments") {
        let status = experiments
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_uppercase();
        let kind = experiments
            .get("kind")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase();
        if matches!(status.as_str(), "COMPLETED" | "DONE" | "FACT" | "PROVEN")
            && matches!(kind.as_str(), "hypothesis" | "plan" | "experiment_plan")
        {
            return Err(SpeError::new(
                "PORTABILITY_INVALID_FIXTURE",
                "C08: MUST NOT elevate hypothesis/experiment plan to completed/fact",
            ));
        }
        if experiments.get("promote_to_fact") == Some(&Value::Bool(true)) {
            return Err(SpeError::new(
                "PORTABILITY_INVALID_FIXTURE",
                "C08: MUST NOT elevate hypothesis→fact",
            ));
        }
    }
    for key in ["hypothesis_as_fact", "experiment_completed", "promote_to_fact"] {
        if payload.contains_key(key) {
            return Err(SpeError::new(
                "PORTABILITY_INVALID_FIXTURE",
                format!("C08: forbidden status laundering key: {key}"),
            ));
        }
    }
    if let Some(Value::Object(metrics)) = payload.get("metrics") {
        if metrics.get("hypothesis_as_fact") == Some(&Value::Bool(true)) {
            return Err(SpeError::new(
                "PORTABILITY_INVALID_FIXTURE",
                "C08: MUST NOT elevate hypothesis→fact",
            ));
        }
    }
    Ok(())
}

fn enforce_c09(payload: &Map<String, Value>) -> Result<(), SpeError> {
    let keys = collect_keys(&Value::Object(payload.clone()), 0);
    let forbidden: HashSet<&str> = [
        "BUILD_PASS",
        "TEST_PASS",
        "VERIFIED",
        "build_pass",
        "test_pass",
        "verified",
    ]
    .into_iter()
    .collect();
    if keys.iter().any(|k| forbidden.contains(k.as_str())) {
        return Err(SpeError::new(
            "PORTABILITY_INVALID_FIXTURE",
            "C09: MUST NOT claim BUILD_PASS/TEST_PASS/VERIFIED from mere code generation",
        ));
    }
    Ok(())
}

fn enforce_c10(payload: &Map<String, Value>) -> Result<(), SpeError> {
    let rights_oracle: HashSet<&str> = [
        "LICENSED",
        "licensed",
        "rights_oracle",
        "license_verified",
        "copyright_cleared",
    ]
    .into_iter()
    .collect();
    if payload.keys().any(|k| rights_oracle.contains(k.as_str())) {
        return Err(SpeError::new(
            "PORTABILITY_INVALID_FIXTURE",
            "C10: PUBLICLY_VIEWABLE != LICENSED; no rights oracle claims",
        ));
    }
    if let Some(Value::Object(rights)) = payload.get("rights_provenance") {
        let status = rights
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_uppercase();
        if matches!(
            status.as_str(),
            "LICENSED" | "LICENSE_VERIFIED" | "COPYRIGHT_CLEARED"
        ) {
            return Err(SpeError::new(
                "PORTABILITY_INVALID_FIXTURE",
                "C10: PUBLICLY_VIEWABLE != LICENSED; no rights oracle claims",
            ));
        }
        if rights.get("PUBLICLY_VIEWABLE") == Some(&Value::Bool(true))
            && rights.get("LICENSED") == Some(&Value::Bool(true))
        {
            return Err(SpeError::new(
                "PORTABILITY_INVALID_FIXTURE",
                "C10: PUBLICLY_VIEWABLE != LICENSED; no rights oracle claims",
            ));
        }
    }
    Ok(())
}

fn enforce_c11(payload: &Map<String, Value>) -> Result<(), SpeError> {
    let launder: HashSet<&str> = [
        "VERIFIED_CREDENTIAL",
        "verified_credential",
        "credential_verified",
        "USER_CLAIM_AS_VERIFIED",
    ]
    .into_iter()
    .collect();
    if payload.keys().any(|k| launder.contains(k.as_str())) {
        return Err(SpeError::new(
            "PORTABILITY_INVALID_FIXTURE",
            "C11: USER_CLAIM != VERIFIED_CREDENTIAL; forbidden status laundering",
        ));
    }
    if let Some(Value::Object(evidence)) = payload.get("evidence_of_skills") {
        if evidence.get("USER_CLAIM") == Some(&Value::Bool(true))
            && evidence.get("VERIFIED_CREDENTIAL") == Some(&Value::Bool(true))
        {
            return Err(SpeError::new(
                "PORTABILITY_INVALID_FIXTURE",
                "C11: USER_CLAIM != VERIFIED_CREDENTIAL; forbidden status laundering",
            ));
        }
        let status = evidence
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_uppercase();
        let has_artifact = match evidence.get("verification_artifact") {
            None | Some(Value::Null) => false,
            Some(Value::Bool(false)) => false,
            Some(Value::String(s)) if s.is_empty() => false,
            Some(_) => true,
        };
        if status == "VERIFIED_CREDENTIAL" && !has_artifact {
            return Err(SpeError::new(
                "PORTABILITY_INVALID_FIXTURE",
                "C11: USER_CLAIM != VERIFIED_CREDENTIAL; forbidden status laundering",
            ));
        }
    }
    Ok(())
}

fn enforce_c12(
    envelope: &Map<String, Value>,
    confirm_canon_overwrite: bool,
) -> Result<(), SpeError> {
    let existing = match envelope.get("category_payload") {
        Some(Value::Object(obj)) => obj,
        _ => return Ok(()),
    };
    if !existing.contains_key("canon") {
        return Ok(());
    }
    if !confirm_canon_overwrite {
        return Err(SpeError::new(
            "PORTABILITY_INVALID_FIXTURE",
            "C12: cannot silently overwrite canon without confirm_canon_overwrite",
        ));
    }
    Ok(())
}

fn category_law(
    category_id: &str,
    envelope: &Map<String, Value>,
    payload: &Map<String, Value>,
    confirm_canon_overwrite: bool,
) -> Result<(), SpeError> {
    match category_id {
        "CAT:C04" => enforce_c04(payload),
        "CAT:C05" => enforce_c05(payload),
        "CAT:C08" => enforce_c08(payload),
        "CAT:C09" => enforce_c09(payload),
        "CAT:C10" => enforce_c10(payload),
        "CAT:C11" => enforce_c11(payload),
        "CAT:C12" => enforce_c12(envelope, confirm_canon_overwrite),
        _ => Ok(()),
    }
}

fn default_envelope() -> Map<String, Value> {
    let mut m = Map::new();
    m.insert("envelope_id".into(), json!(""));
    m.insert("goal_identity".into(), json!(""));
    m.insert("facts".into(), json!([]));
    m.insert("provenance".into(), json!([]));
    m.insert("uncertainties".into(), json!([]));
    m.insert("hard_constraints".into(), json!([]));
    m.insert("user_preferences".into(), json!([]));
    m.insert("analysis".into(), Value::Null);
    m.insert("recommendation".into(), Value::Null);
    m.insert("rendering".into(), Value::Null);
    m.insert(
        "authority_state".into(),
        json!({"level": 0, "status": "NONE", "grants": []}),
    );
    m.insert("execution_grants".into(), json!([]));
    m.insert("failures".into(), json!([]));
    m.insert("taint_labels".into(), json!([]));
    m.insert("sensitivity_labels".into(), json!([]));
    m.insert("category_trace".into(), json!([]));
    m.insert("taxonomy_version".into(), json!("2"));
    m.insert("active_category".into(), Value::Null);
    m.insert("category_payload".into(), Value::Null);
    m.insert("proof_obligation_proposals".into(), json!([]));
    m
}

fn normalize_envelope(raw: &Value) -> Result<Map<String, Value>, SpeError> {
    let obj = raw.as_object().ok_or_else(|| {
        SpeError::new("PORTABILITY_INVALID_FIXTURE", "envelope must be a mapping")
    })?;
    let mut out = default_envelope();
    for (k, v) in obj {
        out.insert(k.clone(), v.clone());
    }
    if !out.contains_key("taxonomy_version")
        || out.get("taxonomy_version").map(|v| v.is_null()).unwrap_or(true)
    {
        out.insert("taxonomy_version".into(), json!("2"));
    } else if let Some(Value::Number(n)) = out.get("taxonomy_version").cloned() {
        out.insert("taxonomy_version".into(), json!(n.to_string()));
    }
    Ok(out)
}

fn values_equal(a: &Value, b: &Value) -> bool {
    a == b
}

fn apply_category_payload(
    envelope_raw: &Value,
    category_id: &str,
    payload_raw: &Value,
    proposals_raw: Option<&Value>,
) -> Result<Value, SpeError> {
    if !category_ids().contains(category_id) {
        return Err(SpeError::new(
            "PORTABILITY_INVALID_FIXTURE",
            format!("invalid category_id: '{category_id}'"),
        ));
    }
    let payload_obj = payload_raw.as_object().ok_or_else(|| {
        SpeError::new("PORTABILITY_INVALID_FIXTURE", "payload must be a mapping")
    })?;

    let before = normalize_envelope(envelope_raw)?;
    reject_legacy_payload_reinterpretation(before.get("taxonomy_version"), category_id)?;

    let mut working = payload_obj.clone();
    let confirm = working
        .remove(CANON_CONFIRM_KEY)
        .map(|v| v == Value::Bool(true))
        .unwrap_or(false);

    reject_forbidden_payload_keys(category_id, &working)?;
    reject_unknown_fields(category_id, &working)?;
    category_law(category_id, &before, &working, confirm)?;

    let proposals = match proposals_raw {
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(|p| p.as_object().map(|o| Value::Object(o.clone())))
            .collect::<Vec<_>>(),
        None => Vec::new(),
        Some(_) => {
            return Err(SpeError::new(
                "PORTABILITY_INVALID_FIXTURE",
                "proof_obligation_proposals must be a list",
            ))
        }
    };

    let mut after = before.clone();
    after.insert("category_payload".into(), Value::Object(working));
    after.insert("active_category".into(), json!(category_id));
    after.insert("proof_obligation_proposals".into(), Value::Array(proposals));
    let mut trace = match before.get("category_trace") {
        Some(Value::Array(items)) => items.clone(),
        _ => Vec::new(),
    };
    trace.push(json!(category_id));
    after.insert("category_trace".into(), Value::Array(trace));

    for field in [
        "facts",
        "provenance",
        "uncertainties",
        "hard_constraints",
        "goal_identity",
        "execution_grants",
    ] {
        if !values_equal(
            before.get(field).unwrap_or(&Value::Null),
            after.get(field).unwrap_or(&Value::Null),
        ) {
            return Err(SpeError::new(
                "PORTABILITY_INVALID_FIXTURE",
                format!("ownership violation: {field} mutated"),
            ));
        }
    }
    let b_auth = before.get("authority_state").cloned().unwrap_or(json!({}));
    let a_auth = after.get("authority_state").cloned().unwrap_or(json!({}));
    let b_level = b_auth.get("level").cloned().unwrap_or(json!(0));
    let a_level = a_auth.get("level").cloned().unwrap_or(json!(0));
    let b_status = b_auth.get("status").cloned().unwrap_or(json!("NONE"));
    let a_status = a_auth.get("status").cloned().unwrap_or(json!("NONE"));
    let b_grants = b_auth.get("grants").cloned().unwrap_or(json!([]));
    let a_grants = a_auth.get("grants").cloned().unwrap_or(json!([]));
    if b_level != a_level || b_status != a_status || b_grants != a_grants {
        return Err(SpeError::new(
            "PORTABILITY_INVALID_FIXTURE",
            "ownership violation: authority_state mutated",
        ));
    }

    Ok(Value::Object(after))
}

pub fn evaluate(input: &Value) -> Result<Value, SpeError> {
    if !input.is_object() {
        return Err(SpeError::new(
            "PORTABILITY_INVALID_FIXTURE",
            "xcat input must be an object",
        ));
    }
    let op = input
        .get("op")
        .and_then(|v| v.as_str())
        .ok_or_else(|| SpeError::new("PORTABILITY_INVALID_FIXTURE", "missing op"))?;
    match op {
        "route" => {
            let evidence = input.get("evidence").unwrap_or(&Value::Null);
            route_mission_stage(evidence)
        }
        "apply" => {
            let envelope = input.get("envelope").unwrap_or(&Value::Null);
            let category_id = input
                .get("category_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    SpeError::new("PORTABILITY_INVALID_FIXTURE", "missing category_id")
                })?;
            let payload = input.get("payload").unwrap_or(&Value::Null);
            let proposals = input.get("proof_obligation_proposals");
            apply_category_payload(envelope, category_id, payload, proposals)
        }
        "validate_taxonomy" => Ok(validate_taxonomy_version(input.get("taxonomy_version"))),
        other => Err(SpeError::new(
            "PORTABILITY_INVALID_FIXTURE",
            format!("unknown xcat op: {other}"),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routing_id_matches_python_sample() {
        let evidence = json!({
            "stage": {"category_ref": "CAT:C09"},
            "category_evidence": [{"key": "stage"}]
        });
        assert_eq!(
            routing_id(&evidence),
            "route-39a81275b2a4cc8618cf64c4fc2fdc262b7dc70858740f634701cde567ba23f7"
        );
    }
}
