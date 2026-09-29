//! Obligation-level quality delta, bounded reconstruction, and target modes.
//! Python `spe_runtime.quality.engine` is the semantic oracle.

use crate::reasons::SpeError;
use crate::sha256_lite::sha256_hex;
use crate::value::canonical_dumps;
use serde_json::{json, Map, Value};
use std::collections::BTreeSet;

const DELTA_VERSION: &str = "spe.quality_delta.v1";
const RECONSTRUCTION_VERSION: &str = "spe.reconstruction_plan.v1";
const RECEIPT_VERSION: &str = "spe.validation_receipt.v1";
const MAX_ATTEMPTS: i64 = 1;

const REPAIR_OPS: &[&str] = &[
    "RESTORE_MISSING_CONSTRAINT",
    "RESTORE_UNKNOWN_MARKER",
    "RESTORE_REQUIRED_SECTION",
    "RENDER_FROM_BOUND_EFFECT_PLAN",
    "RESTORE_AUTHORIZED_OUTPUT_CONTRACT",
    "REMOVE_UNAUTHORIZED_ADDITION",
];
const FORBIDDEN: &[&str] = &[
    "CHANGE_USER_GOAL",
    "INVENT_FACT",
    "INVENT_EXAMPLE",
    "INVENT_RETRIEVAL_RESULT",
    "MINT_AUTHORITY",
    "CHANGE_CATEGORY",
    "CHANGE_K3_TECHNIQUE",
    "EXECUTE_TOOL",
    "WEAKEN_CONSTRAINT",
];
const UNSUPPORTED: &[&str] = &[
    "browsing happened",
    "sources were fetched",
    "citations exist",
    "internet access is authorized",
];
const PROTECTED: &[&str] = &[
    "HARD_CONSTRAINT",
    "GOAL_IDENTITY",
    "AUTHORITY_BOUND",
    "UNKNOWN_MARKER",
    "FACT_BOUND",
    "UNAUTHORIZED_ADDITION",
    "UNSUPPORTED_CLAIM",
];

fn digest(payload: &Value) -> Result<String, SpeError> {
    Ok(sha256_hex(canonical_dumps(payload)?.as_bytes()))
}

fn as_object(value: Option<&Value>) -> Option<&Map<String, Value>> {
    value.and_then(|item| item.as_object())
}

fn as_list(value: Option<&Value>) -> Vec<Value> {
    value
        .and_then(|item| item.as_array())
        .cloned()
        .unwrap_or_default()
}

fn string_list(value: Option<&Value>) -> Vec<String> {
    as_list(value)
        .into_iter()
        .filter_map(|item| item.as_str().map(|text| text.to_string()))
        .collect()
}

fn record_text(item: &Value) -> Result<String, SpeError> {
    if let Some(text) = item.as_str() {
        return Ok(text.to_string());
    }
    if let Some(map) = item.as_object() {
        if let Some(text) = map.get("statement").and_then(|v| v.as_str()) {
            return Ok(text.to_string());
        }
        if let Some(text) = map.get("description").and_then(|v| v.as_str()) {
            return Ok(text.to_string());
        }
    }
    canonical_dumps(item)
}

fn norm_authority(value: Option<&Value>) -> Value {
    let map = value.and_then(|item| item.as_object());
    let grants = map
        .and_then(|item| item.get("grants"))
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|text| Value::String(text.to_string())))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let level = map
        .and_then(|item| item.get("level"))
        .and_then(|item| item.as_i64())
        .unwrap_or(0);
    let status = map
        .and_then(|item| item.get("status"))
        .and_then(|item| item.as_str())
        .filter(|text| !text.is_empty())
        .unwrap_or("NONE");
    json!({"grants": grants, "level": level, "status": status})
}

fn shared_protected(value: Option<&Value>) -> Option<Value> {
    let map = as_object(value)?;
    let goal = map
        .get("goal")
        .and_then(|item| item.as_str())
        .unwrap_or("")
        .to_string();
    Some(json!({
        "authority_state": norm_authority(map.get("authority_state")),
        "budget": map.get("budget").cloned().unwrap_or(Value::Null),
        "desired_output": map.get("desired_output").cloned().unwrap_or(Value::Null),
        "facts": as_list(map.get("facts")),
        "goal": goal,
        "hard_constraints": as_list(map.get("hard_constraints")),
        "provenance": as_list(map.get("provenance")),
    }))
}

fn full_protected(value: Option<&Value>) -> Option<Value> {
    let mut shared = shared_protected(value)?;
    let map = as_object(value)?;
    let category = map
        .get("category")
        .and_then(|item| item.as_str())
        .unwrap_or("")
        .to_string();
    let obj = shared.as_object_mut()?;
    obj.insert("category".into(), Value::String(category));
    obj.insert("unknowns".into(), Value::Array(as_list(map.get("unknowns"))));
    obj.insert(
        "user_preferences".into(),
        Value::Array(as_list(map.get("user_preferences"))),
    );
    Some(shared)
}

fn effect_identity(plan: Option<&Value>) -> Option<Value> {
    let map = as_object(plan)?;
    Some(json!({
        "blocked_operations": as_list(map.get("blocked_operations")),
        "disposition": map.get("disposition").and_then(|v| v.as_str()).unwrap_or(""),
        "effect_version": map.get("effect_version").and_then(|v| v.as_str()).unwrap_or(""),
        "operations": string_list(map.get("operations")),
        "renderable": map.get("renderable").and_then(|v| v.as_bool()) == Some(true),
        "requirement_graph_digest": map.get("requirement_graph_digest").and_then(|v| v.as_str()).unwrap_or(""),
        "schema_version": map.get("schema_version").and_then(|v| v.as_str()).unwrap_or(""),
        "sections": as_list(map.get("sections")),
        "selection_id": map.get("selection_id").and_then(|v| v.as_str()).unwrap_or(""),
        "techniques": string_list(map.get("techniques")),
    }))
}

fn k3_identity(value: Option<&Value>) -> Option<Value> {
    let map = as_object(value)?;
    Some(json!({
        "selection_id": map.get("selection_id").and_then(|v| v.as_str()).unwrap_or(""),
        "techniques": string_list(map.get("techniques")),
    }))
}

fn xcat_identity(value: Option<&Value>) -> Option<Value> {
    let map = as_object(value)?;
    Some(json!({
        "active_category": map.get("active_category").and_then(|v| v.as_str()).unwrap_or(""),
        "taxonomy_version": map.get("taxonomy_version").and_then(|v| v.as_str()).unwrap_or(""),
    }))
}

fn graph_digest(value: Option<&Value>) -> String {
    as_object(value)
        .and_then(|map| map.get("graph_digest"))
        .and_then(|item| item.as_str())
        .unwrap_or("")
        .to_string()
}

fn opt_json(value: Option<Value>) -> Value {
    value.unwrap_or(Value::Null)
}

fn subject_view(subject: &Value) -> Value {
    let prompt = subject
        .get("compiled_prompt")
        .and_then(|item| item.as_str())
        .map(|text| Value::String(text.to_string()))
        .unwrap_or(Value::Null);
    json!({
        "compiled_prompt": prompt,
        "effect_identity": opt_json(effect_identity(subject.get("effect_plan"))),
        "k3": opt_json(k3_identity(subject.get("k3"))),
        "protected_intent": opt_json(full_protected(subject.get("protected_intent"))),
        "requirement_graph_digest": graph_digest(subject.get("requirement_graph")),
        "xcat": opt_json(xcat_identity(subject.get("xcat"))),
    })
}

fn subject_digest(subject: &Value) -> Result<String, SpeError> {
    digest(&subject_view(subject))
}

fn authority_line(auth: &Value) -> String {
    let grants = auth
        .get("grants")
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|text| text.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let joined = if grants.is_empty() {
        "none".to_string()
    } else {
        grants.join(",")
    };
    let level = auth.get("level").and_then(|item| item.as_i64()).unwrap_or(0);
    let status = auth
        .get("status")
        .and_then(|item| item.as_str())
        .unwrap_or("NONE");
    format!("level={level}; status={status}; grants={joined}")
}

fn parse_sections(prompt: &str) -> Option<Vec<(String, String)>> {
    if !prompt.starts_with("## ") {
        return None;
    }
    let mut sections = Vec::new();
    let mut seen = Vec::new();
    for chunk in prompt.split("\n\n") {
        if !chunk.starts_with("## ") {
            return None;
        }
        let rest = &chunk[3..];
        let (head, body) = rest.split_once('\n')?;
        if head.is_empty() || seen.iter().any(|item: &String| item == head) {
            return None;
        }
        seen.push(head.to_string());
        sections.push((head.to_string(), body.to_string()));
    }
    Some(sections)
}

fn render(sections: &[(String, String)]) -> String {
    sections
        .iter()
        .map(|(heading, body)| format!("## {heading}\n{body}"))
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn set_section(prompt: &str, heading: &str, body: &str, after: Option<&str>) -> Option<String> {
    let sections = parse_sections(prompt)?;
    let mut updated = Vec::new();
    let mut replaced = false;
    for (current, text) in sections {
        if current == heading {
            updated.push((heading.to_string(), body.to_string()));
            replaced = true;
        } else {
            updated.push((current, text));
        }
    }
    if !replaced {
        let index = match after {
            None => 0,
            Some(name) => updated
                .iter()
                .position(|(current, _)| current == name)
                .map(|pos| pos + 1)
                .unwrap_or(updated.len()),
        };
        updated.insert(index, (heading.to_string(), body.to_string()));
    }
    Some(render(&updated))
}

fn unknown_statements(protected: &Value) -> Result<Vec<(String, String)>, SpeError> {
    let mut found = Vec::new();
    for (index, item) in as_list(protected.get("unknowns")).iter().enumerate() {
        let item_id = item
            .get("uncertainty_id")
            .or_else(|| item.get("id"))
            .and_then(|value| value.as_str())
            .map(|text| text.to_string())
            .unwrap_or_else(|| format!("u{index}"));
        found.push((item_id, record_text(item)?));
    }
    for (index, item) in as_list(protected.get("facts")).iter().enumerate() {
        let unknown = item.get("status").and_then(|v| v.as_str()) == Some("UNKNOWN")
            || item.get("marker").and_then(|v| v.as_str()) == Some("UNKNOWN");
        if unknown {
            let item_id = item
                .get("fact_id")
                .and_then(|v| v.as_str())
                .map(|text| text.to_string())
                .unwrap_or_else(|| format!("f{index}"));
            found.push((item_id, record_text(item)?));
        }
    }
    Ok(found)
}

fn is_example_text(value: &Value) -> bool {
    value
        .as_str()
        .map(|text| text.contains("EXAMPLE / USER_SUPPLIED") || text.contains("NON-AUTHORITATIVE"))
        .unwrap_or(false)
}

fn plan_section_text(plan: &Value, code: &str) -> Option<String> {
    as_list(plan.get("sections")).into_iter().find_map(|section| {
        if section.get("code").and_then(|v| v.as_str()) == Some(code) {
            section
                .get("text")
                .and_then(|v| v.as_str())
                .map(|text| text.to_string())
        } else {
            None
        }
    })
}

fn obligation(
    obligation_id: &str,
    obligation_type: &str,
    source_ref: &str,
    status: &str,
    evidence: Vec<String>,
    mut reasons: Vec<String>,
) -> Value {
    let mut evidence = evidence;
    evidence.sort();
    evidence.dedup();
    reasons.sort();
    reasons.dedup();
    json!({
        "evidence_refs": evidence,
        "obligation_id": obligation_id,
        "obligation_type": obligation_type,
        "reason_codes": reasons,
        "source_ref": source_ref,
        "status": status,
    })
}

fn malformed(obligation_id: &str, obligation_type: &str, source_ref: &str) -> Value {
    obligation(
        obligation_id,
        obligation_type,
        source_ref,
        "UNKNOWN",
        vec!["artifact:compiled_prompt".into()],
        vec!["MALFORMED_ARTIFACT".into()],
    )
}

fn strings_of(value: &Value, key: &str) -> Vec<String> {
    value
        .get(key)
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|text| text.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

fn status_rank(status: &str) -> i64 {
    match status {
        "NONE" => 0,
        "RECOMMEND" => 1,
        "AUTHORIZE" => 2,
        "GRANTED" => 3,
        _ => 99,
    }
}

fn parse_authority(body: &str) -> Option<(i64, String, Vec<String>)> {
    let rest = body.strip_prefix("level=")?;
    let (level_raw, rest) = rest.split_once("; status=")?;
    let level = level_raw.parse::<i64>().ok()?;
    let (status, rest) = rest.split_once("; grants=")?;
    let token = |text: &str| {
        !text.is_empty()
            && text
                .chars()
                .all(|ch| ch.is_ascii_uppercase() || ch.is_ascii_digit() || ch == '_')
    };
    if !token(status) {
        return None;
    }
    if rest == "none" {
        return Some((level, status.to_string(), Vec::new()));
    }
    let grants: Vec<String> = rest.split(',').map(|item| item.to_string()).collect();
    if grants.iter().any(|item| !token(item)) {
        return None;
    }
    Some((level, status.to_string(), grants))
}

fn evaluate_obligations(subject: &Value) -> Result<Vec<Value>, SpeError> {
    let protected = full_protected(subject.get("protected_intent"));
    let plan = subject.get("effect_plan").and_then(|item| item.as_object());
    let prompt = subject.get("compiled_prompt").and_then(|item| item.as_str());
    let mut results = Vec::new();
    if protected.is_none() || plan.is_none() || prompt.is_none() {
        results.push(malformed("artifact:shape", "ARTIFACT", "compiled_prompt"));
        results.sort_by(|left, right| {
            left["obligation_id"]
                .as_str()
                .unwrap_or("")
                .cmp(right["obligation_id"].as_str().unwrap_or(""))
        });
        return Ok(results);
    }
    let protected = protected.unwrap();
    let plan_value = subject.get("effect_plan").cloned().unwrap_or(Value::Null);
    let prompt = prompt.unwrap();
    let sections = parse_sections(prompt);
    let section_body = sections.as_ref().map(|items| {
        items
            .iter()
            .map(|(heading, body)| (heading.clone(), body.clone()))
            .collect::<Vec<_>>()
    });
    let body = |heading: &str| -> Option<String> {
        section_body.as_ref().and_then(|items| {
            items
                .iter()
                .find(|(current, _)| current == heading)
                .map(|(_, text)| text.clone())
        })
    };
    if sections.is_none() {
        results.push(malformed("artifact:sections", "ARTIFACT", "compiled_prompt"));
    }
    let goal = protected.get("goal").and_then(|v| v.as_str()).unwrap_or("");
    let objective = body("Objective");
    if sections.is_none() {
        results.push(malformed("goal:identity", "GOAL_IDENTITY", "goal"));
    } else if objective.as_deref() == Some(goal) {
        results.push(obligation(
            "goal:identity",
            "GOAL_IDENTITY",
            "goal",
            "SATISFIED",
            vec!["section:Objective".into()],
            vec![],
        ));
    } else {
        results.push(obligation(
            "goal:identity",
            "GOAL_IDENTITY",
            "goal",
            "UNSATISFIED",
            vec!["section:Objective".into()],
            vec![if objective.is_some() {
                "GOAL_MISMATCH"
            } else {
                "MISSING_SECTION"
            }
            .into()],
        ));
    }
    let hard_body = body("Hard constraints");
    for (index, item) in as_list(protected.get("hard_constraints")).iter().enumerate() {
        let constraint_id = item
            .get("constraint_id")
            .and_then(|v| v.as_str())
            .map(|text| text.to_string())
            .unwrap_or_else(|| format!("c{index}"));
        let statement = record_text(item)?;
        let bullet = format!("- {statement}");
        let obligation_id = format!("hard:{constraint_id}");
        if sections.is_none() {
            results.push(malformed(&obligation_id, "HARD_CONSTRAINT", &constraint_id));
            continue;
        }
        let Some(hard_body) = hard_body.as_deref() else {
            results.push(obligation(
                &obligation_id,
                "HARD_CONSTRAINT",
                &constraint_id,
                "UNSATISFIED",
                vec!["section:Hard constraints".into()],
                vec!["MISSING_SECTION".into()],
            ));
            continue;
        };
        let waived = hard_body.contains(&format!("waive: {statement}"))
            || hard_body.contains(&format!("constraint removed: {statement}"));
        let present = hard_body.split('\n').any(|line| line == bullet);
        if waived {
            results.push(obligation(
                &obligation_id,
                "HARD_CONSTRAINT",
                &constraint_id,
                "CONFLICT",
                vec!["section:Hard constraints".into()],
                vec!["CONSTRAINT_WEAKENED".into()],
            ));
        } else if present {
            results.push(obligation(
                &obligation_id,
                "HARD_CONSTRAINT",
                &constraint_id,
                "SATISFIED",
                vec!["section:Hard constraints".into()],
                vec![],
            ));
        } else {
            results.push(obligation(
                &obligation_id,
                "HARD_CONSTRAINT",
                &constraint_id,
                "UNSATISFIED",
                vec!["section:Hard constraints".into()],
                vec!["MISSING_CONSTRAINT".into()],
            ));
        }
    }
    let auth = protected
        .get("authority_state")
        .cloned()
        .unwrap_or(json!({"grants": [], "level": 0, "status": "NONE"}));
    let expected_auth = authority_line(&auth);
    let auth_body = body("Authority");
    if sections.is_none() {
        results.push(malformed("authority:bound", "AUTHORITY_BOUND", "authority_state"));
    } else if auth_body.is_none() {
        results.push(obligation(
            "authority:bound",
            "AUTHORITY_BOUND",
            "authority_state",
            "UNSATISFIED",
            vec!["section:Authority".into()],
            vec!["MISSING_SECTION".into()],
        ));
    } else if auth_body.as_deref() == Some(expected_auth.as_str()) {
        results.push(obligation(
            "authority:bound",
            "AUTHORITY_BOUND",
            "authority_state",
            "SATISFIED",
            vec!["section:Authority".into()],
            vec![],
        ));
    } else {
        let mut reasons = vec!["AUTHORITY_MISMATCH".to_string()];
        if let Some(text) = auth_body.as_deref() {
            if let Some((level, status, grants)) = parse_authority(text) {
                let protected_grants = strings_of(&auth, "grants");
                let protected_level = auth.get("level").and_then(|v| v.as_i64()).unwrap_or(0);
                let protected_status = auth.get("status").and_then(|v| v.as_str()).unwrap_or("NONE");
                let subset = grants.iter().all(|item| protected_grants.iter().any(|have| have == item));
                if level > protected_level || status_rank(&status) > status_rank(protected_status) || !subset {
                    reasons = vec!["AUTHORITY_EXPANSION".into()];
                }
            } else {
                reasons = vec!["AUTHORITY_EXPANSION".into()];
            }
        }
        results.push(obligation(
            "authority:bound",
            "AUTHORITY_BOUND",
            "authority_state",
            "UNSATISFIED",
            vec!["section:Authority".into()],
            reasons,
        ));
    }
    let fact_body = body("Facts");
    let fact_lines: Vec<String> = fact_body
        .as_deref()
        .map(|text| text.split('\n').map(|line| line.to_string()).collect())
        .unwrap_or_default();
    let mut allowed_facts = Vec::new();
    for (index, item) in as_list(protected.get("facts")).iter().enumerate() {
        let fact_id = item
            .get("fact_id")
            .and_then(|v| v.as_str())
            .map(|text| text.to_string())
            .unwrap_or_else(|| format!("f{index}"));
        let statement = record_text(item)?;
        allowed_facts.push(statement.clone());
        let obligation_id = format!("fact:{fact_id}");
        if sections.is_none() {
            results.push(malformed(&obligation_id, "FACT_BOUND", &fact_id));
        } else if fact_lines.iter().any(|line| line == &format!("- {statement}")) {
            results.push(obligation(
                &obligation_id,
                "FACT_BOUND",
                &fact_id,
                "SATISFIED",
                vec!["section:Facts".into()],
                vec![],
            ));
        } else {
            results.push(obligation(
                &obligation_id,
                "FACT_BOUND",
                &fact_id,
                "UNSATISFIED",
                vec!["section:Facts".into()],
                vec![if fact_body.is_some() {
                    "MISSING_FACT"
                } else {
                    "MISSING_SECTION"
                }
                .into()],
            ));
        }
    }
    let extras = fact_lines.iter().any(|line| {
        line.starts_with("- ") && !allowed_facts.iter().any(|item| line == &format!("- {item}"))
    });
    let invented = prompt.contains("INVENTED FACT:");
    if sections.is_none() {
        results.push(malformed("fact:unauthorized", "UNAUTHORIZED_ADDITION", "facts"));
    } else if extras || invented {
        results.push(obligation(
            "fact:unauthorized",
            "UNAUTHORIZED_ADDITION",
            "facts",
            "UNSATISFIED",
            vec!["section:Facts".into()],
            vec!["UNSUPPORTED_FACT".into()],
        ));
    } else {
        results.push(obligation(
            "fact:unauthorized",
            "UNAUTHORIZED_ADDITION",
            "facts",
            "SATISFIED",
            vec!["section:Facts".into()],
            vec![],
        ));
    }
    let lowered = prompt.to_lowercase();
    let claim_hits = UNSUPPORTED.iter().any(|phrase| lowered.contains(phrase));
    if sections.is_none() {
        results.push(malformed(
            "claim:unsupported",
            "UNSUPPORTED_CLAIM",
            "compiled_prompt",
        ));
    } else if claim_hits {
        results.push(obligation(
            "claim:unsupported",
            "UNSUPPORTED_CLAIM",
            "compiled_prompt",
            "UNSATISFIED",
            vec!["compiled_prompt".into()],
            vec!["UNSUPPORTED_CLAIM".into()],
        ));
    } else {
        results.push(obligation(
            "claim:unsupported",
            "UNSUPPORTED_CLAIM",
            "compiled_prompt",
            "SATISFIED",
            vec!["compiled_prompt".into()],
            vec![],
        ));
    }
    let plan_prompt = plan_value
        .get("compiled_prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    let invented_example = lowered.contains("invented example") && !plan_prompt.contains("invented example");
    if sections.is_none() {
        results.push(malformed(
            "example:unauthorized",
            "UNAUTHORIZED_ADDITION",
            "examples",
        ));
    } else if invented_example {
        results.push(obligation(
            "example:unauthorized",
            "UNAUTHORIZED_ADDITION",
            "examples",
            "UNSATISFIED",
            vec!["compiled_prompt".into()],
            vec!["INVENTED_EXAMPLE".into()],
        ));
    } else {
        results.push(obligation(
            "example:unauthorized",
            "UNAUTHORIZED_ADDITION",
            "examples",
            "SATISFIED",
            vec!["compiled_prompt".into()],
            vec![],
        ));
    }
    for (item_id, statement) in unknown_statements(&protected)? {
        let obligation_id = format!("unknown:{item_id}");
        if sections.is_none() {
            results.push(malformed(&obligation_id, "UNKNOWN_MARKER", &item_id));
            continue;
        }
        let open_body = body("Open questions").unwrap_or_default();
        let line = open_body
            .split('\n')
            .find(|item| item.contains(&statement))
            .unwrap_or("")
            .to_string();
        let laundered = !line.is_empty()
            && (line.contains("SATISFIED") || line.to_lowercase().contains("verified"))
            && !line.contains("UNKNOWN");
        if laundered || (prompt.contains(&statement) && prompt.contains("SATISFIED") && !prompt.contains("UNKNOWN"))
        {
            results.push(obligation(
                &obligation_id,
                "UNKNOWN_MARKER",
                &item_id,
                "CONFLICT",
                vec!["section:Open questions".into()],
                vec!["UNKNOWN_LAUNDERED".into()],
            ));
        } else if !line.is_empty() && line.contains("UNKNOWN") {
            results.push(obligation(
                &obligation_id,
                "UNKNOWN_MARKER",
                &item_id,
                "SATISFIED",
                vec!["section:Open questions".into()],
                vec![],
            ));
        } else {
            results.push(obligation(
                &obligation_id,
                "UNKNOWN_MARKER",
                &item_id,
                "UNSATISFIED",
                vec!["section:Open questions".into()],
                vec!["MISSING_UNKNOWN_MARKER".into()],
            ));
        }
    }
    if let Some(desired) = protected.get("desired_output") {
        if !desired.is_null() && !is_example_text(desired) {
            let rendered = if let Some(text) = desired.as_str() {
                text.to_string()
            } else {
                canonical_dumps(desired)?
            };
            let deliverable = body("Deliverable");
            if sections.is_none() {
                results.push(malformed("output:desired", "OUTPUT_CONTRACT", "desired_output"));
            } else if deliverable.as_deref() == Some(rendered.as_str()) {
                results.push(obligation(
                    "output:desired",
                    "OUTPUT_CONTRACT",
                    "desired_output",
                    "SATISFIED",
                    vec!["section:Deliverable".into()],
                    vec![],
                ));
            } else {
                results.push(obligation(
                    "output:desired",
                    "OUTPUT_CONTRACT",
                    "desired_output",
                    "UNSATISFIED",
                    vec!["section:Deliverable".into()],
                    vec!["MISSING_OUTPUT_CONTRACT".into()],
                ));
            }
        }
    }
    for code in string_list(plan_value.get("operations")) {
        let obligation_id = format!("effect:{code}");
        let expected = plan_section_text(&plan_value, &code);
        let actual = body(&format!("Effect: {code}"));
        if sections.is_none() {
            results.push(malformed(&obligation_id, "EFFECT_OPERATION", &code));
        } else if expected.is_some() && actual == expected {
            results.push(obligation(
                &obligation_id,
                "EFFECT_OPERATION",
                &code,
                "SATISFIED",
                vec![format!("section:Effect: {code}")],
                vec![],
            ));
        } else {
            results.push(obligation(
                &obligation_id,
                "EFFECT_OPERATION",
                &code,
                "UNSATISFIED",
                vec![format!("section:Effect: {code}")],
                vec!["MISSING_EFFECT_OPERATION".into()],
            ));
        }
        if code == "STRUCTURED_OUTPUT" {
            if sections.is_none() {
                results.push(malformed("output:structured", "OUTPUT_CONTRACT", &code));
            } else if expected.is_some() && actual == expected {
                results.push(obligation(
                    "output:structured",
                    "OUTPUT_CONTRACT",
                    &code,
                    "SATISFIED",
                    vec![format!("section:Effect: {code}")],
                    vec![],
                ));
            } else {
                results.push(obligation(
                    "output:structured",
                    "OUTPUT_CONTRACT",
                    &code,
                    "UNSATISFIED",
                    vec![format!("section:Effect: {code}")],
                    vec!["MISSING_OUTPUT_CONTRACT".into()],
                ));
            }
        }
    }
    let shared_subject = shared_protected(subject.get("protected_intent"));
    let shared_plan = shared_protected(plan_value.get("protected_fields"));
    if shared_subject.is_some()
        && shared_plan.is_some()
        && canonical_dumps(&shared_subject.unwrap())? == canonical_dumps(&shared_plan.unwrap())?
    {
        results.push(obligation(
            "bind:protected",
            "PROTECTED_INTENT_BINDING",
            "protected_fields",
            "SATISFIED",
            vec!["effect_plan.protected_fields".into()],
            vec![],
        ));
    } else {
        results.push(obligation(
            "bind:protected",
            "PROTECTED_INTENT_BINDING",
            "protected_fields",
            "UNSATISFIED",
            vec!["effect_plan.protected_fields".into()],
            vec!["UNBOUND_EFFECT_PLAN".into()],
        ));
    }
    let graph = subject.get("requirement_graph");
    let graph_digest_value = graph_digest(graph);
    let plan_digest = plan_value
        .get("requirement_graph_digest")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if graph.and_then(|item| item.get("validity")).and_then(|v| v.as_str()) == Some("CONFLICTED") {
        results.push(obligation(
            "requirement:conflict",
            "REQUIREMENT_CONFLICT",
            "requirement_graph",
            "CONFLICT",
            vec!["requirement_graph.validity".into()],
            vec!["REQUIREMENT_CONFLICT".into()],
        ));
    }
    if !graph_digest_value.is_empty() && graph_digest_value == plan_digest {
        results.push(obligation(
            "bind:graph",
            "REQUIREMENT_GRAPH_BINDING",
            "graph_digest",
            "SATISFIED",
            vec!["requirement_graph.graph_digest".into()],
            vec![],
        ));
    } else if graph_digest_value.is_empty() || plan_digest.is_empty() {
        results.push(obligation(
            "bind:graph",
            "REQUIREMENT_GRAPH_BINDING",
            "graph_digest",
            "UNKNOWN",
            vec!["requirement_graph.graph_digest".into()],
            vec!["MISSING_PROOF".into()],
        ));
    } else {
        results.push(obligation(
            "bind:graph",
            "REQUIREMENT_GRAPH_BINDING",
            "graph_digest",
            "UNSATISFIED",
            vec!["requirement_graph.graph_digest".into()],
            vec!["REQUIREMENT_GRAPH_MISMATCH".into()],
        ));
    }
    let k3 = k3_identity(subject.get("k3"));
    if k3.is_none() {
        results.push(obligation(
            "bind:k3",
            "K3_BINDING",
            "techniques",
            "UNKNOWN",
            vec!["k3".into()],
            vec!["MISSING_K3".into()],
        ));
    } else if k3.as_ref().and_then(|item| item.get("techniques")).and_then(|v| v.as_array())
        == Some(
            &string_list(plan_value.get("techniques"))
                .into_iter()
                .map(Value::String)
                .collect::<Vec<_>>(),
        )
    {
        results.push(obligation(
            "bind:k3",
            "K3_BINDING",
            "techniques",
            "SATISFIED",
            vec!["k3.techniques".into()],
            vec![],
        ));
    } else {
        results.push(obligation(
            "bind:k3",
            "K3_BINDING",
            "techniques",
            "UNSATISFIED",
            vec!["k3.techniques".into()],
            vec!["K3_MISMATCH".into()],
        ));
    }
    let xcat = xcat_identity(subject.get("xcat"));
    let category = protected.get("category").and_then(|v| v.as_str()).unwrap_or("");
    if xcat.is_none() {
        results.push(obligation(
            "bind:xcat",
            "XCAT_BINDING",
            "active_category",
            "UNKNOWN",
            vec!["xcat".into()],
            vec!["MISSING_XCAT".into()],
        ));
    } else if xcat.as_ref().and_then(|item| item.get("taxonomy_version")).and_then(|v| v.as_str())
        == Some("2")
        && xcat
            .as_ref()
            .and_then(|item| item.get("active_category"))
            .and_then(|v| v.as_str())
            == Some(category)
    {
        results.push(obligation(
            "bind:xcat",
            "XCAT_BINDING",
            "active_category",
            "SATISFIED",
            vec!["xcat.active_category".into()],
            vec![],
        ));
    } else {
        results.push(obligation(
            "bind:xcat",
            "XCAT_BINDING",
            "active_category",
            "UNSATISFIED",
            vec!["xcat.active_category".into()],
            vec!["CATEGORY_MISMATCH".into()],
        ));
    }
    let proof_refs = subject.get("proof_refs").and_then(|v| v.as_array());
    if proof_refs.is_some()
        && !proof_refs.unwrap().is_empty()
        && proof_refs
            .unwrap()
            .iter()
            .all(|item| item.as_str().map(|text| !text.is_empty()).unwrap_or(false))
    {
        results.push(obligation(
            "proof:present",
            "PROOF",
            "proof_refs",
            "SATISFIED",
            vec!["proof_refs".into()],
            vec![],
        ));
    } else {
        results.push(obligation(
            "proof:present",
            "PROOF",
            "proof_refs",
            "UNKNOWN",
            vec!["proof_refs".into()],
            vec!["MISSING_PROOF".into()],
        ));
    }
    results.sort_by(|left, right| {
        left["obligation_id"]
            .as_str()
            .unwrap_or("")
            .cmp(right["obligation_id"].as_str().unwrap_or(""))
    });
    Ok(results)
}

fn field_str(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(|item| item.as_str())
        .unwrap_or("")
        .to_string()
}

fn reason_list(value: &Value) -> Vec<String> {
    strings_of(value, "reason_codes")
}

fn sorted_unique(mut items: Vec<String>) -> Vec<String> {
    items.sort();
    items.dedup();
    items
}

fn contains_code(items: &[String], code: &str) -> bool {
    items.iter().any(|item| item == code)
}

fn proof_refs(subject: &Value) -> Vec<String> {
    sorted_unique(
        subject
            .get("proof_refs")
            .and_then(|item| item.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().filter(|text| !text.is_empty()).map(|text| text.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
    )
}

fn quality_delta(before: &Value, after: &Value) -> Result<Value, SpeError> {
    let before_pi = full_protected(before.get("protected_intent"));
    let after_pi = full_protected(after.get("protected_intent"));
    let before_obs = evaluate_obligations(before)?;
    let after_obs = evaluate_obligations(after)?;
    let mut ids: Vec<String> = before_obs
        .iter()
        .chain(after_obs.iter())
        .filter_map(|item| item.get("obligation_id").and_then(|v| v.as_str()).map(|text| text.to_string()))
        .collect();
    ids = sorted_unique(ids);
    let find = |rows: &[Value], id: &str| -> Option<Value> {
        rows.iter()
            .find(|item| item.get("obligation_id").and_then(|v| v.as_str()) == Some(id))
            .cloned()
    };
    let mut rows = Vec::new();
    let mut improved = Vec::new();
    let mut regressed = Vec::new();
    let mut unchanged = Vec::new();
    let mut unresolved = Vec::new();
    let mut protected_ids = Vec::new();
    let mut reasons = Vec::new();
    let intent_mismatch = before_pi.is_none()
        || after_pi.is_none()
        || canonical_dumps(before_pi.as_ref().unwrap())? != canonical_dumps(after_pi.as_ref().unwrap())?;
    let governing_mismatch = graph_digest(before.get("requirement_graph"))
        != graph_digest(after.get("requirement_graph"))
        || canonical_dumps(&opt_json(xcat_identity(before.get("xcat"))))?
            != canonical_dumps(&opt_json(xcat_identity(after.get("xcat"))))?
        || canonical_dumps(&opt_json(k3_identity(before.get("k3"))))?
            != canonical_dumps(&opt_json(k3_identity(after.get("k3"))))?
        || canonical_dumps(&opt_json(effect_identity(before.get("effect_plan"))))?
            != canonical_dumps(&opt_json(effect_identity(after.get("effect_plan"))))?;
    let malformed = before_obs
        .iter()
        .chain(after_obs.iter())
        .any(|item| item.get("obligation_id").and_then(|v| v.as_str()) == Some("artifact:shape"));
    for obligation_id in &ids {
        let left = find(&before_obs, obligation_id);
        let right = find(&after_obs, obligation_id);
        let before_status = left
            .as_ref()
            .map(|item| field_str(item, "status"))
            .unwrap_or_else(|| "NOT_APPLICABLE".into());
        let after_status = right
            .as_ref()
            .map(|item| field_str(item, "status"))
            .unwrap_or_else(|| "NOT_APPLICABLE".into());
        let source = right.as_ref().or(left.as_ref()).cloned().unwrap_or(json!({}));
        let obligation_type = field_str(&source, "obligation_type");
        let source_ref = field_str(&source, "source_ref");
        let evidence = strings_of(&source, "evidence_refs");
        let before_reasons = left.as_ref().map(reason_list).unwrap_or_default();
        let after_reasons = right.as_ref().map(reason_list).unwrap_or_default();
        let mut row_reasons = before_reasons.clone();
        row_reasons.extend(after_reasons.clone());
        rows.push(json!({
            "after_status": after_status,
            "before_status": before_status,
            "evidence_refs": sorted_unique(evidence),
            "obligation_id": obligation_id,
            "obligation_type": obligation_type,
            "reason_codes": sorted_unique(row_reasons.clone()),
            "source_ref": source_ref,
        }));
        let laundered = (contains_code(&after_reasons, "UNKNOWN_LAUNDERED")
            && !contains_code(&before_reasons, "UNKNOWN_LAUNDERED"))
            || (obligation_type == "UNKNOWN_MARKER"
                && before_status == "UNKNOWN"
                && after_status == "SATISFIED");
        let beneficial = matches!(
            (before_status.as_str(), after_status.as_str()),
            ("UNSATISFIED", "SATISFIED") | ("CONFLICT", "SATISFIED")
        );
        if before_status == after_status && after_status != "UNKNOWN" && after_status != "CONFLICT" {
            unchanged.push(obligation_id.clone());
        } else if beneficial && !laundered && !contains_code(&after_reasons, "UNKNOWN_LAUNDERED") {
            improved.push(obligation_id.clone());
        } else if before_status == "SATISFIED" && after_status != "SATISFIED" {
            regressed.push(obligation_id.clone());
        } else if after_status == "UNKNOWN"
            || after_status == "CONFLICT"
            || before_status == "UNKNOWN"
            || before_status == "CONFLICT"
        {
            unresolved.push(obligation_id.clone());
        } else if before_status != after_status {
            regressed.push(obligation_id.clone());
        } else {
            unresolved.push(obligation_id.clone());
        }
        let newly_bad = [
            "AUTHORITY_EXPANSION",
            "CONSTRAINT_WEAKENED",
            "UNSUPPORTED_FACT",
            "INVENTED_EXAMPLE",
            "UNSUPPORTED_CLAIM",
        ]
        .iter()
        .any(|code| contains_code(&after_reasons, code) && !contains_code(&before_reasons, code));
        let protected_type = PROTECTED.iter().any(|item| *item == obligation_type);
        if protected_type
            && (laundered || newly_bad || (before_status == "SATISFIED" && after_status != "SATISFIED"))
            && !protected_ids.iter().any(|item| item == obligation_id)
        {
            protected_ids.push(obligation_id.clone());
        }
        if laundered {
            reasons.push("UNKNOWN_LAUNDERED".into());
        }
        reasons.extend(row_reasons);
    }
    let disposition: String;
    if malformed {
        disposition = "UNRESOLVED".into();
        reasons.push("MALFORMED_ARTIFACT".into());
        improved.clear();
    } else if intent_mismatch {
        disposition = "UNRESOLVED".into();
        reasons.push("PROTECTED_INTENT_MISMATCH".into());
        improved.clear();
    } else if governing_mismatch {
        disposition = "UNRESOLVED".into();
        reasons.push("GOVERNING_STATE_MISMATCH".into());
        improved.clear();
    } else if !protected_ids.is_empty() || !regressed.is_empty() {
        disposition = "REGRESSED".into();
    } else if !improved.is_empty() {
        let proof_ok = !proof_refs(before).is_empty() && !proof_refs(after).is_empty();
        let proof_status = find(&after_obs, "proof:present")
            .map(|item| field_str(&item, "status"))
            .unwrap_or_default();
        let unknown_laundered = contains_code(&reasons, "UNKNOWN_LAUNDERED");
        if !proof_ok || proof_status != "SATISFIED" || unknown_laundered {
            disposition = "UNRESOLVED".into();
            reasons.push(
                if !proof_ok || proof_status != "SATISFIED" {
                    "MISSING_PROOF"
                } else {
                    "UNKNOWN_LAUNDERED"
                }
                .into(),
            );
            unresolved.extend(improved.drain(..));
        } else {
            disposition = "IMPROVED".into();
        }
    } else if rows.iter().any(|item| {
        let status = field_str(item, "after_status");
        status == "UNKNOWN" || status == "CONFLICT"
    }) {
        disposition = "UNRESOLVED".into();
    } else {
        disposition = "NON_INFERIOR".into();
        let before_prompt = before.get("compiled_prompt").and_then(|v| v.as_str());
        let after_prompt = after.get("compiled_prompt").and_then(|v| v.as_str());
        if let (Some(left), Some(right)) = (before_prompt, after_prompt) {
            if left != right {
                reasons.push("LENGTH_NOT_QUALITY".into());
            }
        }
        if subject_digest(before)? == subject_digest(after)? {
            reasons.push("SAME_CANDIDATE".into());
        }
    }
    let show_improved = if disposition == "IMPROVED" {
        sorted_unique(improved)
    } else {
        Vec::new()
    };
    Ok(json!({
        "disposition": disposition,
        "effect_plan_digest": digest(&opt_json(effect_identity(before.get("effect_plan"))))?,
        "improved_obligation_ids": show_improved,
        "k3_digest": digest(&opt_json(k3_identity(before.get("k3"))))?,
        "obligation_results": rows,
        "proof_refs": sorted_unique(proof_refs(before).into_iter().chain(proof_refs(after)).collect()),
        "protected_intent_digest": digest(&opt_json(before_pi))?,
        "protected_regressions": if intent_mismatch { Vec::<String>::new() } else { sorted_unique(protected_ids) },
        "reason_codes": sorted_unique(reasons),
        "regressed_obligation_ids": if intent_mismatch { Vec::<String>::new() } else { sorted_unique(regressed) },
        "requirement_graph_digest": graph_digest(before.get("requirement_graph")),
        "subject_after_digest": subject_digest(after)?,
        "subject_before_digest": subject_digest(before)?,
        "unchanged_obligation_ids": sorted_unique(unchanged),
        "unresolved_obligation_ids": sorted_unique(unresolved),
        "version": DELTA_VERSION,
        "xcat_digest": digest(&opt_json(xcat_identity(before.get("xcat"))))?,
    }))
}

fn bad(item: &Value) -> bool {
    matches!(item.get("status").and_then(|v| v.as_str()), Some("UNSATISFIED") | Some("CONFLICT"))
}

fn ids_of(items: &[&Value]) -> Vec<String> {
    items
        .iter()
        .filter_map(|item| item.get("obligation_id").and_then(|v| v.as_str()).map(|text| text.to_string()))
        .collect()
}

fn choose_repair(obligations: &[Value]) -> (Option<String>, Vec<String>, Vec<String>) {
    let hard: Vec<&Value> = obligations
        .iter()
        .filter(|item| item.get("obligation_type").and_then(|v| v.as_str()) == Some("HARD_CONSTRAINT") && bad(item))
        .collect();
    if !hard.is_empty() {
        return (
            Some("RESTORE_MISSING_CONSTRAINT".into()),
            ids_of(&hard),
            vec!["MISSING_CONSTRAINT".into()],
        );
    }
    let unknowns: Vec<&Value> = obligations
        .iter()
        .filter(|item| item.get("obligation_type").and_then(|v| v.as_str()) == Some("UNKNOWN_MARKER") && bad(item))
        .collect();
    if !unknowns.is_empty() {
        return (
            Some("RESTORE_UNKNOWN_MARKER".into()),
            ids_of(&unknowns),
            vec!["MISSING_UNKNOWN_MARKER".into()],
        );
    }
    let unauthorized: Vec<&Value> = obligations
        .iter()
        .filter(|item| {
            matches!(
                item.get("obligation_id").and_then(|v| v.as_str()),
                Some("fact:unauthorized") | Some("example:unauthorized") | Some("claim:unsupported")
            ) && bad(item)
        })
        .collect();
    let authority = obligations
        .iter()
        .find(|item| item.get("obligation_id").and_then(|v| v.as_str()) == Some("authority:bound"));
    let authority_expansion = authority
        .map(|item| contains_code(&reason_list(item), "AUTHORITY_EXPANSION"))
        .unwrap_or(false);
    if !unauthorized.is_empty() || authority_expansion {
        let mut ids = ids_of(&unauthorized);
        if authority_expansion {
            if let Some(item) = authority {
                if let Some(id) = item.get("obligation_id").and_then(|v| v.as_str()) {
                    ids.push(id.to_string());
                }
            }
        }
        return (Some("REMOVE_UNAUTHORIZED_ADDITION".into()), ids, vec!["UNAUTHORIZED_ADDITION".into()]);
    }
    let output: Vec<&Value> = obligations
        .iter()
        .filter(|item| item.get("obligation_type").and_then(|v| v.as_str()) == Some("OUTPUT_CONTRACT") && bad(item))
        .collect();
    if !output.is_empty() {
        return (
            Some("RESTORE_AUTHORIZED_OUTPUT_CONTRACT".into()),
            ids_of(&output),
            vec!["MISSING_OUTPUT_CONTRACT".into()],
        );
    }
    let required: Vec<&Value> = obligations
        .iter()
        .filter(|item| {
            matches!(
                item.get("obligation_id").and_then(|v| v.as_str()),
                Some("goal:identity") | Some("authority:bound")
            ) && bad(item)
        })
        .collect();
    let missing_hard: Vec<&Value> = obligations
        .iter()
        .filter(|item| {
            item.get("obligation_type").and_then(|v| v.as_str()) == Some("HARD_CONSTRAINT")
                && contains_code(&reason_list(item), "MISSING_SECTION")
        })
        .collect();
    if !required.is_empty() || !missing_hard.is_empty() {
        let mut ids = ids_of(&required);
        ids.extend(ids_of(&missing_hard));
        return (Some("RESTORE_REQUIRED_SECTION".into()), ids, vec!["MISSING_SECTION".into()]);
    }
    let effects: Vec<&Value> = obligations
        .iter()
        .filter(|item| item.get("obligation_type").and_then(|v| v.as_str()) == Some("EFFECT_OPERATION") && bad(item))
        .collect();
    if !effects.is_empty() {
        return (
            Some("RENDER_FROM_BOUND_EFFECT_PLAN".into()),
            ids_of(&effects),
            vec!["MISSING_EFFECT_OPERATION".into()],
        );
    }
    let conflict: Vec<&Value> = obligations
        .iter()
        .filter(|item| item.get("obligation_type").and_then(|v| v.as_str()) == Some("REQUIREMENT_CONFLICT"))
        .collect();
    if !conflict.is_empty() {
        return (None, ids_of(&conflict), vec!["UNREPAIRABLE_CONFLICT".into()]);
    }
    let unbound: Vec<&Value> = obligations
        .iter()
        .filter(|item| {
            matches!(
                item.get("obligation_id").and_then(|v| v.as_str()),
                Some("bind:protected") | Some("bind:k3") | Some("bind:xcat") | Some("bind:graph")
            ) && bad(item)
        })
        .collect();
    if !unbound.is_empty() {
        return (None, ids_of(&unbound), vec!["UNREPAIRABLE_BINDING".into()]);
    }
    (None, Vec::new(), Vec::new())
}

fn effect_prompt_authorized(subject: &Value) -> Result<bool, SpeError> {
    let Some(plan) = subject.get("effect_plan") else {
        return Ok(false);
    };
    let Some(protected) = shared_protected(subject.get("protected_intent")) else {
        return Ok(false);
    };
    if plan.get("renderable").and_then(|v| v.as_bool()) != Some(true) {
        return Ok(false);
    }
    let Some(prompt) = plan.get("compiled_prompt").and_then(|v| v.as_str()) else {
        return Ok(false);
    };
    if prompt.trim().is_empty() {
        return Ok(false);
    }
    let Some(plan_fields) = shared_protected(plan.get("protected_fields")) else {
        return Ok(false);
    };
    if canonical_dumps(&plan_fields)? != canonical_dumps(&protected)? {
        return Ok(false);
    }
    let Some(k3) = k3_identity(subject.get("k3")) else {
        return Ok(false);
    };
    if string_list(k3.get("techniques")) != string_list(plan.get("techniques")) {
        return Ok(false);
    }
    let Some(xcat) = xcat_identity(subject.get("xcat")) else {
        return Ok(false);
    };
    let Some(full) = full_protected(subject.get("protected_intent")) else {
        return Ok(false);
    };
    if xcat.get("active_category") != full.get("category") || field_str(&xcat, "taxonomy_version") != "2" {
        return Ok(false);
    }
    Ok(true)
}

fn apply_repair(operation: &str, subject: &Value) -> Result<Option<String>, SpeError> {
    let Some(prompt) = subject.get("compiled_prompt").and_then(|v| v.as_str()) else {
        return Ok(None);
    };
    let Some(protected) = full_protected(subject.get("protected_intent")) else {
        return Ok(None);
    };
    let Some(plan) = subject.get("effect_plan").cloned() else {
        return Ok(None);
    };
    if operation == "RENDER_FROM_BOUND_EFFECT_PLAN" {
        if !effect_prompt_authorized(subject)? {
            return Ok(None);
        }
        return Ok(plan
            .get("compiled_prompt")
            .and_then(|v| v.as_str())
            .map(|text| text.to_string()));
    }
    if operation == "RESTORE_MISSING_CONSTRAINT" {
        let mut updated = prompt.to_string();
        for item in as_list(protected.get("hard_constraints")) {
            let statement = record_text(&item)?;
            let Some(sections) = parse_sections(&updated) else {
                return Ok(None);
            };
            let body = sections
                .iter()
                .find(|(heading, _)| heading == "Hard constraints")
                .map(|(_, text)| text.clone());
            let Some(body) = body else {
                let bullets = as_list(protected.get("hard_constraints"))
                    .iter()
                    .map(|entry| Ok(format!("- {}", record_text(entry)?)))
                    .collect::<Result<Vec<_>, SpeError>>()?;
                let text = if bullets.is_empty() {
                    "none".to_string()
                } else {
                    bullets.join("\n")
                };
                return Ok(set_section(&updated, "Hard constraints", &text, Some("Objective")));
            };
            let mut lines: Vec<String> = body
                .split('\n')
                .filter(|line| !line.is_empty() && !line.starts_with("waive:") && !line.starts_with("constraint removed:"))
                .map(|line| line.to_string())
                .collect();
            if lines == ["none".to_string()] {
                lines.clear();
            }
            let bullet = format!("- {statement}");
            if !lines.iter().any(|line| line == &bullet) {
                lines.push(bullet);
            }
            let Some(next) = set_section(&updated, "Hard constraints", &lines.join("\n"), Some("Objective")) else {
                return Ok(None);
            };
            updated = next;
        }
        return Ok(Some(updated));
    }
    if operation == "RESTORE_UNKNOWN_MARKER" {
        let lines = unknown_statements(&protected)?
            .into_iter()
            .map(|(_, statement)| format!("- {statement} [UNKNOWN]"))
            .collect::<Vec<_>>();
        let body = if lines.is_empty() { "none".to_string() } else { lines.join("\n") };
        return Ok(set_section(prompt, "Open questions", &body, Some("Authority")));
    }
    if operation == "REMOVE_UNAUTHORIZED_ADDITION" {
        let Some(sections) = parse_sections(prompt) else {
            return Ok(None);
        };
        let allowed = as_list(protected.get("facts"))
            .iter()
            .map(record_text)
            .collect::<Result<Vec<_>, _>>()?;
        let mut updated = Vec::new();
        for (heading, mut body) in sections {
            if heading.to_lowercase().contains("invented") {
                continue;
            }
            if heading == "Facts" {
                let mut kept: Vec<String> = body
                    .split('\n')
                    .filter(|line| !line.starts_with("- ") || allowed.iter().any(|item| *line == format!("- {item}")))
                    .map(|line| line.to_string())
                    .collect();
                if kept.is_empty() {
                    kept = if allowed.is_empty() {
                        vec!["none".into()]
                    } else {
                        allowed.iter().map(|item| format!("- {item}")).collect()
                    };
                }
                body = kept.join("\n");
            }
            if heading == "Authority" {
                body = authority_line(protected.get("authority_state").unwrap_or(&json!({})));
            }
            let filtered: Vec<String> = body
                .split('\n')
                .filter(|line| {
                    let lowered = line.to_lowercase();
                    !lowered.contains("invented example")
                        && !UNSUPPORTED.iter().any(|phrase| lowered.contains(phrase))
                        && !line.starts_with("INVENTED FACT:")
                })
                .map(|line| line.to_string())
                .collect();
            let next_body = if filtered.is_empty() {
                "none".to_string()
            } else {
                filtered.join("\n")
            };
            updated.push((heading, next_body));
        }
        return Ok(Some(render(&updated)));
    }
    if operation == "RESTORE_AUTHORIZED_OUTPUT_CONTRACT" {
        let mut updated = prompt.to_string();
        if let Some(desired) = protected.get("desired_output") {
            if !desired.is_null() && !is_example_text(desired) {
                let rendered = if let Some(text) = desired.as_str() {
                    text.to_string()
                } else {
                    canonical_dumps(desired)?
                };
                let Some(next) = set_section(&updated, "Deliverable", &rendered, Some("Authority")) else {
                    return Ok(None);
                };
                updated = next;
            }
        }
        if string_list(plan.get("operations")).iter().any(|item| item == "STRUCTURED_OUTPUT") {
            let Some(text) = plan_section_text(&plan, "STRUCTURED_OUTPUT") else {
                return Ok(None);
            };
            return Ok(set_section(&updated, "Effect: STRUCTURED_OUTPUT", &text, Some("Category presentation")));
        }
        return Ok(Some(updated));
    }
    if operation == "RESTORE_REQUIRED_SECTION" {
        let mut updated = prompt.to_string();
        let Some(sections) = parse_sections(&updated) else {
            return Ok(None);
        };
        let headings: Vec<String> = sections.iter().map(|(heading, _)| heading.clone()).collect();
        let objective = sections
            .iter()
            .find(|(heading, _)| heading == "Objective")
            .map(|(_, text)| text.clone());
        let goal = field_str(&protected, "goal");
        if !headings.iter().any(|item| item == "Objective") || objective.as_deref() != Some(goal.as_str()) {
            let Some(next) = set_section(&updated, "Objective", &goal, None) else {
                return Ok(None);
            };
            updated = next;
        }
        if !headings.iter().any(|item| item == "Hard constraints") {
            let bullets = as_list(protected.get("hard_constraints"))
                .iter()
                .map(|item| Ok(format!("- {}", record_text(item)?)))
                .collect::<Result<Vec<_>, SpeError>>()?;
            let text = if bullets.is_empty() { "none".into() } else { bullets.join("\n") };
            let Some(next) = set_section(&updated, "Hard constraints", &text, Some("Objective")) else {
                return Ok(None);
            };
            updated = next;
        }
        if !headings.iter().any(|item| item == "Authority") {
            return Ok(set_section(
                &updated,
                "Authority",
                &authority_line(protected.get("authority_state").unwrap_or(&json!({}))),
                Some("Provenance"),
            ));
        }
        return Ok(Some(updated));
    }
    Ok(None)
}

fn forbidden_value() -> Value {
    Value::Array(FORBIDDEN.iter().map(|item| Value::String((*item).to_string())).collect())
}

fn plan_value(
    subject: &Value,
    kept: &Value,
    disposition: &str,
    deficits: Vec<String>,
    causes: Vec<String>,
    operations: Vec<String>,
    reasons: Vec<String>,
    attempt_index: i64,
) -> Result<Value, SpeError> {
    Ok(json!({
        "attempt_index": attempt_index,
        "candidate_digest": subject_digest(kept)?,
        "cause_codes": sorted_unique(causes),
        "disposition": disposition,
        "forbidden_changes": forbidden_value(),
        "max_attempts": MAX_ATTEMPTS,
        "proof_refs": proof_refs(subject),
        "reason_codes": sorted_unique(reasons),
        "repair_operations": operations,
        "allowed_sections": [],
        "source_artifact_digest": subject_digest(subject)?,
        "triggering_deficit_ids": sorted_unique(deficits),
        "version": RECONSTRUCTION_VERSION,
    }))
}

fn reconstruction_result(
    _subject: &Value,
    kept_subject: Value,
    kept: &str,
    plan: Value,
    delta: Value,
) -> Value {
    json!({
        "kept": kept,
        "kept_subject": kept_subject,
        "plan": plan,
        "quality_delta": delta,
    })
}

fn changed_headings(before: &str, after: &str) -> Option<BTreeSet<String>> {
    let left = parse_sections(before)?;
    let right = parse_sections(after)?;
    let mut left_map = std::collections::BTreeMap::new();
    let mut right_map = std::collections::BTreeMap::new();
    for (heading, body) in left {
        left_map.insert(heading, body);
    }
    for (heading, body) in right {
        right_map.insert(heading, body);
    }
    let mut changed = BTreeSet::new();
    let mut names = BTreeSet::new();
    names.extend(left_map.keys().cloned());
    names.extend(right_map.keys().cloned());
    for heading in names {
        if left_map.get(&heading) != right_map.get(&heading) {
            changed.insert(heading);
        }
    }
    Some(changed)
}

fn identity_same(before: &Value, after: &Value) -> Result<bool, SpeError> {
    let same = |left: Value, right: Value| -> Result<bool, SpeError> {
        Ok(canonical_dumps(&left)? == canonical_dumps(&right)?)
    };
    Ok(same(
        full_protected(before.get("protected_intent")).unwrap_or(json!({})),
        full_protected(after.get("protected_intent")).unwrap_or(json!({})),
    )? && same(
        Value::String(graph_digest(before.get("requirement_graph"))),
        Value::String(graph_digest(after.get("requirement_graph"))),
    )? && same(
        xcat_identity(before.get("xcat")).unwrap_or(json!({})),
        xcat_identity(after.get("xcat")).unwrap_or(json!({})),
    )? && same(
        k3_identity(before.get("k3")).unwrap_or(json!({})),
        k3_identity(after.get("k3")).unwrap_or(json!({})),
    )? && same(
        effect_identity(before.get("effect_plan")).unwrap_or(json!({})),
        effect_identity(after.get("effect_plan")).unwrap_or(json!({})),
    )?)
}

fn repair_sections(operation: &str) -> Option<BTreeSet<String>> {
    let names: &[&str] = match operation {
        "RESTORE_MISSING_CONSTRAINT" => &["Hard constraints"],
        "RESTORE_UNKNOWN_MARKER" => &["Open questions"],
        "REMOVE_UNAUTHORIZED_ADDITION" => &["Facts", "Authority"],
        "RESTORE_AUTHORIZED_OUTPUT_CONTRACT" => &["Deliverable", "Effect: STRUCTURED_OUTPUT"],
        "RESTORE_REQUIRED_SECTION" => &["Objective", "Hard constraints", "Authority"],
        _ => return None,
    };
    Some(names.iter().map(|item| (*item).to_string()).collect())
}

fn json_string_list(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(|item| item.as_array())
        .map(|items| items.iter().filter_map(|item| item.as_str().map(|text| text.to_string())).collect())
        .unwrap_or_default()
}

fn repair_is_admissible(
    before: &Value,
    after: &Value,
    operation: &str,
    causes: &[String],
    triggering: &[String],
) -> Result<bool, SpeError> {
    if !identity_same(before, after)? {
        return Ok(false);
    }
    let Some(before_prompt) = before.get("compiled_prompt").and_then(|item| item.as_str()) else {
        return Ok(false);
    };
    let Some(after_prompt) = after.get("compiled_prompt").and_then(|item| item.as_str()) else {
        return Ok(false);
    };
    if operation == "RENDER_FROM_BOUND_EFFECT_PLAN" {
        let bound = before
            .get("effect_plan")
            .and_then(|item| item.get("compiled_prompt"))
            .and_then(|item| item.as_str());
        if !causes.iter().any(|item| item == "FINAL_RENDER_DRIFT_FROM_BOUND_EFFECT_PLAN")
            || !effect_prompt_authorized(before)?
            || Some(after_prompt) != bound
        {
            return Ok(false);
        }
    } else {
        let Some(allowed) = repair_sections(operation) else {
            return Ok(false);
        };
        let Some(changed) = changed_headings(before_prompt, after_prompt) else {
            return Ok(false);
        };
        if !changed.is_subset(&allowed) {
            return Ok(false);
        }
    }
    let delta = quality_delta(before, after)?;
    if delta.get("disposition").and_then(|item| item.as_str()) != Some("IMPROVED")
        || !json_string_list(delta.get("protected_regressions")).is_empty()
    {
        return Ok(false);
    }
    let trigger: BTreeSet<String> = triggering.iter().cloned().collect();
    if json_string_list(delta.get("regressed_obligation_ids"))
        .into_iter()
        .any(|item| !trigger.contains(&item))
    {
        return Ok(false);
    }
    let improved: BTreeSet<String> = json_string_list(delta.get("improved_obligation_ids")).into_iter().collect();
    if !trigger.is_empty() && improved.intersection(&trigger).next().is_none() {
        return Ok(false);
    }
    Ok(true)
}

fn reconstruct(
    subject: &Value,
    attempt_index: i64,
    requested_repair: Option<&str>,
) -> Result<Value, SpeError> {
    let prior = subject
        .get("prior_reconstruction_attempts")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    if attempt_index > MAX_ATTEMPTS || prior >= MAX_ATTEMPTS {
        let plan = plan_value(
            subject,
            subject,
            "REFUSED",
            vec![],
            vec!["ATTEMPT_BUDGET_EXCEEDED".into()],
            vec![],
            vec!["ATTEMPT_BUDGET_EXCEEDED".into()],
            MAX_ATTEMPTS,
        )?;
        let delta = quality_delta(subject, subject)?;
        return Ok(reconstruction_result(subject, subject.clone(), "original", plan, delta));
    }
    if let Some(name) = requested_repair {
        if !REPAIR_OPS.contains(&name) {
            let plan = plan_value(
                subject,
                subject,
                "REFUSED",
                vec![],
                vec!["FORBIDDEN_REPAIR".into()],
                vec![],
                vec!["FORBIDDEN_REPAIR".into(), name.to_string()],
                1,
            )?;
            return Ok(reconstruction_result(
                subject,
                subject.clone(),
                "original",
                plan,
                quality_delta(subject, subject)?,
            ));
        }
    }
    let obligations = evaluate_obligations(subject)?;
    let (operation, deficits, mut causes) = choose_repair(&obligations);
    if operation.is_none() && deficits.is_empty() {
        let plan = plan_value(
            subject,
            subject,
            "NOT_TRIGGERED",
            vec![],
            vec!["NO_DEFICIT".into()],
            vec![],
            vec!["NO_DEFICIT".into()],
            1,
        )?;
        return Ok(reconstruction_result(
            subject,
            subject.clone(),
            "original",
            plan,
            quality_delta(subject, subject)?,
        ));
    }
    if operation.is_none() {
        let cause = if causes.is_empty() {
            vec!["UNREPAIRABLE".into()]
        } else {
            causes.clone()
        };
        let plan = plan_value(
            subject,
            subject,
            "UNRESOLVED",
            deficits,
            cause.clone(),
            vec![],
            cause,
            1,
        )?;
        return Ok(reconstruction_result(
            subject,
            subject.clone(),
            "original",
            plan,
            quality_delta(subject, subject)?,
        ));
    }
    let operation = operation.unwrap();
    if operation == "RENDER_FROM_BOUND_EFFECT_PLAN" && !effect_prompt_authorized(subject)? {
        let plan = plan_value(
            subject,
            subject,
            "UNRESOLVED",
            deficits,
            vec![
                "FINAL_RENDER_DRIFT_FROM_BOUND_EFFECT_PLAN".into(),
                "UNBOUND_EFFECT_PLAN".into(),
            ],
            vec![operation],
            vec!["UNRESOLVED".into(), "UNBOUND_EFFECT_PLAN".into()],
            1,
        )?;
        return Ok(reconstruction_result(
            subject,
            subject.clone(),
            "original",
            plan,
            quality_delta(subject, subject)?,
        ));
    }
    if operation == "RENDER_FROM_BOUND_EFFECT_PLAN" {
        causes = vec!["FINAL_RENDER_DRIFT_FROM_BOUND_EFFECT_PLAN".into()];
    }
    if let Some(name) = requested_repair {
        if name != operation {
            let plan = plan_value(
                subject,
                subject,
                "REFUSED",
                deficits,
                vec!["REPAIR_NOT_MINIMAL".into()],
                vec![],
                vec!["REPAIR_NOT_MINIMAL".into()],
                1,
            )?;
            return Ok(reconstruction_result(
                subject,
                subject.clone(),
                "original",
                plan,
                quality_delta(subject, subject)?,
            ));
        }
    }
    let repaired_prompt = apply_repair(&operation, subject)?;
    if repaired_prompt.is_none() || repaired_prompt.as_deref() == subject.get("compiled_prompt").and_then(|v| v.as_str())
    {
        let mut cause = causes.clone();
        cause.push("REPAIR_UNAVAILABLE".into());
        let plan = plan_value(
            subject,
            subject,
            "UNRESOLVED",
            deficits,
            cause,
            vec![operation],
            vec!["REPAIR_UNAVAILABLE".into()],
            1,
        )?;
        return Ok(reconstruction_result(
            subject,
            subject.clone(),
            "original",
            plan,
            quality_delta(subject, subject)?,
        ));
    }
    let mut repaired = subject.clone();
    if let Some(map) = repaired.as_object_mut() {
        map.insert(
            "compiled_prompt".into(),
            Value::String(repaired_prompt.unwrap()),
        );
        map.insert("prior_reconstruction_attempts".into(), json!(1));
    }
    let delta = quality_delta(subject, &repaired)?;
    let admissible = repair_is_admissible(subject, &repaired, &operation, &causes, &deficits)?;
    let mut allowed: Vec<String> = repair_sections(&operation)
        .map(|items| items.into_iter().collect())
        .unwrap_or_default();
    if operation == "RENDER_FROM_BOUND_EFFECT_PLAN" {
        let bound = subject
            .get("effect_plan")
            .and_then(|item| item.get("compiled_prompt"))
            .and_then(|item| item.as_str())
            .unwrap_or("");
        allowed = parse_sections(bound)
            .map(|sections| sections.into_iter().map(|(heading, _)| heading).collect())
            .unwrap_or_default();
    }
    allowed.sort();
    allowed.dedup();
    if delta.get("disposition").and_then(|v| v.as_str()) == Some("IMPROVED")
        && delta
            .get("protected_regressions")
            .and_then(|v| v.as_array())
            .map(|items| items.is_empty())
            .unwrap_or(false)
        && admissible
    {
        let mut plan = plan_value(
            subject,
            &repaired,
            "ACCEPTED",
            deficits,
            causes,
            vec![operation],
            vec!["IMPROVED".into()],
            1,
        )?;
        if let Some(map) = plan.as_object_mut() {
            map.insert(
                "allowed_sections".into(),
                Value::Array(allowed.into_iter().map(Value::String).collect()),
            );
        }
        return Ok(reconstruction_result(subject, repaired, "repaired", plan, delta));
    }
    let delta_disposition = field_str(&delta, "disposition");
    let failure = if delta_disposition == "NON_INFERIOR" {
        "NO_IMPROVEMENT"
    } else {
        "UNRESOLVED"
    };
    let mut cause = causes;
    cause.push(delta_disposition.clone());
    let mut reasons = vec![failure.to_string(), delta_disposition];
    if !admissible {
        reasons.push("SCOPE_ESCAPE".into());
    }
    let plan = plan_value(
        subject,
        subject,
        failure,
        deficits,
        cause,
        vec![operation],
        reasons,
        1,
    )?;
    Ok(reconstruction_result(subject, subject.clone(), "original", plan, delta))
}

fn receipt(
    mode: &str,
    verdict: &str,
    mut reasons: Vec<String>,
    mut proof_class: &str,
    reconstruction_eligible: bool,
    quality: Value,
) -> Value {
    if proof_class == "EXECUTION_OBSERVED" {
        proof_class = "DECLARED_POLICY";
        reasons.push("EXECUTION_OBSERVED_REJECTED".into());
    }
    json!({
        "authority_minted": false,
        "credentials_used": false,
        "execution_authorized": false,
        "execution_observed": false,
        "external_effect": false,
        "external_write": false,
        "integrity_state": "ABSENT",
        "mode": mode,
        "network": false,
        "outcome": "NOT_EXECUTED",
        "proof_class": proof_class,
        "quality_delta": quality,
        "reason_codes": sorted_unique(reasons),
        "reconstruction_eligible": reconstruction_eligible,
        "runtime_path": "",
        "subject_digest": "",
        "verdict": verdict,
        "version": RECEIPT_VERSION,
        "wasm_sha256": "",
    })
}

fn sha64(value: Option<&Value>) -> Option<String> {
    let text = value.and_then(|item| item.as_str())?;
    if text.len() == 64 && text.bytes().all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase()) {
        Some(text.to_string())
    } else {
        None
    }
}

fn runtime_fields(evidence: Option<&Value>) -> (String, String, String) {
    let Some(map) = evidence.and_then(|item| item.as_object()) else {
        return ("ABSENT".to_string(), String::new(), String::new());
    };
    let state = map
        .get("integrity_state")
        .and_then(|item| item.as_str())
        .filter(|text| !text.is_empty())
        .unwrap_or("ABSENT");
    let path = map.get("runtime_path").and_then(|item| item.as_str()).unwrap_or("");
    let sha = sha64(map.get("wasm_sha256")).unwrap_or_default();
    (state.to_string(), path.to_string(), sha)
}

fn runtime_verified(evidence: Option<&Value>) -> bool {
    let Some(map) = evidence.and_then(|item| item.as_object()) else {
        return false;
    };
    if map.get("verified").and_then(|item| item.as_bool()) != Some(true) {
        return false;
    }
    if map.get("imports").and_then(|item| item.as_i64()) != Some(0) {
        return false;
    }
    let (state, path, sha) = runtime_fields(evidence);
    state == "VERIFIED" && path == "worker-wasm" && !sha.is_empty()
}

fn with_custody(request: &Value, mut body: Value) -> Result<Value, SpeError> {
    let evidence = request.get("runtime_evidence").filter(|item| item.is_object());
    let digest = match request.get("artifact").filter(|item| item.is_object()) {
        Some(artifact) => subject_digest(artifact)?,
        None => String::new(),
    };
    let (state, path, sha) = runtime_fields(evidence);
    if let Some(map) = body.as_object_mut() {
        map.insert("integrity_state".into(), Value::String(state));
        map.insert("runtime_path".into(), Value::String(path));
        map.insert("subject_digest".into(), Value::String(digest));
        map.insert("wasm_sha256".into(), Value::String(sha));
    }
    Ok(body)
}

fn normalize_category_id(value: Option<&Value>) -> String {
    let Some(text) = value.and_then(|item| item.as_str()) else {
        return String::new();
    };
    let trimmed = text.trim();
    trimmed
        .strip_prefix("CAT:")
        .unwrap_or(trimmed)
        .trim()
        .to_string()
}

fn eligible(subject: &Value) -> Result<bool, SpeError> {
    Ok(choose_repair(&evaluate_obligations(subject)?).0.is_some())
}

fn run_mode(request: &Value) -> Result<Value, SpeError> {
    with_custody(request, validate_mode(request)?)
}

fn validate_mode(request: &Value) -> Result<Value, SpeError> {
    let mode = request.get("mode").and_then(|v| v.as_str());
    if !matches!(mode, Some("DRY_RUN") | Some("VALIDATE_ONLY") | Some("EXECUTE")) {
        return Ok(receipt(
            mode.unwrap_or(""),
            "FAIL",
            vec!["UNSUPPORTED_MODE".into()],
            "DECLARED_POLICY",
            false,
            Value::Null,
        ));
    }
    let mode = mode.unwrap();
    let Some(artifact) = request.get("artifact").filter(|item| item.is_object()) else {
        return Ok(receipt(
            mode,
            "FAIL",
            vec!["MALFORMED_ARTIFACT".into()],
            "DECLARED_POLICY",
            false,
            Value::Null,
        ));
    };
    let effects = request
        .get("requested_effects")
        .and_then(|v| v.as_array())
        .map(|items| items.iter().filter_map(|item| item.as_str().map(|text| text.to_string())).collect::<Vec<_>>())
        .unwrap_or_default();
    let blocked: Vec<String> = effects
        .into_iter()
        .filter(|item| matches!(item.as_str(), "network" | "credential" | "external_write" | "execute"))
        .collect();
    let enforcement = request.get("enforcement").and_then(|v| v.as_str());
    let wasm_available = request.get("wasm_available").and_then(|v| v.as_bool()).unwrap_or(true);
    let caller_proof = request.get("proof_class").and_then(|v| v.as_str());
    if mode == "EXECUTE" {
        let mut reasons = vec!["EXECUTION_NOT_AUTHORIZED".into(), "EXECUTION_NOT_OBSERVED".into()];
        reasons.extend(blocked.iter().map(|item| format!("{}_FORBIDDEN", item.to_uppercase())));
        if caller_proof == Some("EXECUTION_OBSERVED") {
            reasons.push("EXECUTION_OBSERVED_REJECTED".into());
        }
        return Ok(receipt(mode, "FAIL", reasons, "DECLARED_POLICY", false, Value::Null));
    }
    if mode == "DRY_RUN" {
        let mut reasons = vec!["LOCAL_PREVIEW_ONLY".into()];
        let mut verdict = "PREVIEW";
        if !blocked.is_empty() {
            verdict = "REFUSED";
            reasons.extend(blocked.iter().map(|item| format!("{}_FORBIDDEN", item.to_uppercase())));
        }
        if caller_proof == Some("EXECUTION_OBSERVED") {
            reasons.push("EXECUTION_OBSERVED_REJECTED".into());
        }
        return Ok(receipt(mode, verdict, reasons, "DECLARED_POLICY", false, Value::Null));
    }
    let mut reasons = Vec::new();
    if caller_proof == Some("EXECUTION_OBSERVED") {
        reasons.push("EXECUTION_OBSERVED_REJECTED".into());
    }
    if enforcement != Some("AVAILABLE") || !wasm_available {
        reasons.push("ENFORCEMENT_UNAVAILABLE".into());
        return Ok(receipt("VALIDATE_ONLY", "FAIL", reasons, "DECLARED_POLICY", false, Value::Null));
    }
    if !blocked.is_empty() {
        reasons.extend(blocked.iter().map(|item| format!("{}_FORBIDDEN", item.to_uppercase())));
        return Ok(receipt(
            "VALIDATE_ONLY",
            "FAIL",
            reasons,
            "ENFORCEMENT_AVAILABLE",
            false,
            Value::Null,
        ));
    }
    let obligations = evaluate_obligations(artifact)?;
    if obligations
        .iter()
        .any(|item| item.get("obligation_id").and_then(|v| v.as_str()) == Some("artifact:shape"))
    {
        reasons.push("MALFORMED_ARTIFACT".into());
        return Ok(receipt(
            "VALIDATE_ONLY",
            "FAIL",
            reasons,
            "ENFORCEMENT_AVAILABLE",
            false,
            Value::Null,
        ));
    }
    let find = |id: &str| {
        obligations
            .iter()
            .find(|item| item.get("obligation_id").and_then(|v| v.as_str()) == Some(id))
    };
    for (obligation_id, code) in [
        ("bind:protected", "PROTECTED_INTENT_MISMATCH"),
        ("bind:graph", "REQUIREMENT_GRAPH_MISMATCH"),
        ("bind:xcat", "CATEGORY_MISMATCH"),
        ("bind:k3", "K3_MISMATCH"),
    ] {
        if let Some(item) = find(obligation_id) {
            let status = field_str(item, "status");
            if (status == "UNSATISFIED" || status == "UNKNOWN") && code != "K3_MISMATCH" {
                if obligation_id == "bind:graph" && status == "UNKNOWN" {
                    reasons.push("UNKNOWN_PROOF".into());
                    return Ok(receipt(
                        "VALIDATE_ONLY",
                        "UNKNOWN",
                        reasons,
                        "ENFORCEMENT_AVAILABLE",
                        false,
                        Value::Null,
                    ));
                }
                if status == "UNSATISFIED" {
                    reasons.push(code.into());
                    return Ok(receipt(
                        "VALIDATE_ONLY",
                        "FAIL",
                        reasons,
                        "ENFORCEMENT_AVAILABLE",
                        false,
                        Value::Null,
                    ));
                }
            }
        }
    }
    if find("bind:k3").map(|item| field_str(item, "status")) == Some("UNSATISFIED".into()) {
        reasons.push("K3_MISMATCH".into());
        return Ok(receipt(
            "VALIDATE_ONLY",
            "FAIL",
            reasons,
            "ENFORCEMENT_AVAILABLE",
            false,
            Value::Null,
        ));
    }
    if !artifact.get("effect_plan").map(|item| item.is_object()).unwrap_or(false) {
        reasons.push("MISSING_EFFECT_PLAN".into());
        return Ok(receipt(
            "VALIDATE_ONLY",
            "FAIL",
            reasons,
            "ENFORCEMENT_AVAILABLE",
            false,
            Value::Null,
        ));
    }
    if find("proof:present").map(|item| field_str(item, "status")) == Some("UNKNOWN".into()) {
        reasons.push("UNKNOWN_PROOF".into());
        return Ok(receipt(
            "VALIDATE_ONLY",
            "UNKNOWN",
            reasons,
            "ENFORCEMENT_AVAILABLE",
            eligible(artifact)?,
            Value::Null,
        ));
    }
    if obligations.iter().any(|item| field_str(item, "status") == "UNKNOWN") {
        reasons.push("OBLIGATION_UNKNOWN".into());
        return Ok(receipt(
            "VALIDATE_ONLY",
            "UNKNOWN",
            reasons,
            "ENFORCEMENT_AVAILABLE",
            eligible(artifact)?,
            Value::Null,
        ));
    }
    if obligations
        .iter()
        .any(|item| matches!(field_str(item, "status").as_str(), "UNSATISFIED" | "CONFLICT"))
    {
        reasons.push("OBLIGATION_UNSATISFIED".into());
        return Ok(receipt(
            "VALIDATE_ONLY",
            "FAIL",
            reasons,
            "ENFORCEMENT_AVAILABLE",
            eligible(artifact)?,
            Value::Null,
        ));
    }
    reasons.push("OBLIGATIONS_SATISFIED".into());
    let proof_class = if runtime_verified(request.get("runtime_evidence")) {
        "ENFORCEMENT_VERIFIED"
    } else {
        "ENFORCEMENT_AVAILABLE"
    };
    Ok(receipt(
        "VALIDATE_ONLY",
        "PASS",
        reasons,
        proof_class,
        false,
        Value::Null,
    ))
}

fn quality_loop(subject: &Value, mode: &str) -> Result<Value, SpeError> {
    let reconstruction = reconstruct(subject, 1, None)?;
    let kept = reconstruction.get("kept_subject").cloned().unwrap_or(Value::Null);
    let mut request = Map::new();
    request.insert("artifact".into(), kept);
    request.insert(
        "enforcement".into(),
        subject.get("enforcement").cloned().unwrap_or(Value::String("AVAILABLE".into())),
    );
    request.insert("mode".into(), Value::String(mode.to_string()));
    if let Some(proof) = subject.get("proof_class") {
        request.insert("proof_class".into(), proof.clone());
    }
    request.insert(
        "wasm_available".into(),
        subject.get("wasm_available").cloned().unwrap_or(Value::Bool(true)),
    );
    let mut receipt = run_mode(&Value::Object(request))?;
    if let Some(map) = receipt.as_object_mut() {
        map.insert(
            "quality_delta".into(),
            reconstruction.get("quality_delta").cloned().unwrap_or(Value::Null),
        );
    }
    Ok(json!({
        "quality_delta": reconstruction.get("quality_delta").cloned().unwrap_or(Value::Null),
        "receipt": receipt,
        "reconstruction": reconstruction,
    }))
}

fn string_items(value: Option<&Value>) -> Vec<Value> {
    value
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|text| Value::String(text.to_string())))
                .collect()
        })
        .unwrap_or_default()
}

fn subject_from_k3(k3_output: &Value, compiled_prompt: &str) -> Result<Value, SpeError> {
    if !k3_output.is_object() {
        return Err(SpeError::new("MALFORMED_K3", "k3 output must be an object"));
    }
    let mut protected = full_protected(k3_output.get("protected_binding"))
        .ok_or_else(|| SpeError::new("MALFORMED_K3", "protected binding missing"))?;
    let context = k3_output.get("category_context").filter(|item| item.is_object());
    let category = normalize_category_id(context.and_then(|item| item.get("xcat_id")));
    let taxonomy = context
        .and_then(|item| item.get("taxonomy_version"))
        .and_then(|item| item.as_str())
        .unwrap_or("");
    if let Some(obj) = protected.as_object_mut() {
        obj.insert("category".into(), Value::String(category.clone()));
    }
    let selection = k3_output
        .get("selection_id")
        .and_then(|item| item.as_str())
        .unwrap_or("");
    let techniques = match k3_output.get("techniques").and_then(|item| item.as_array()) {
        Some(items) => items
            .iter()
            .map(|item| Value::String(item.as_str().unwrap_or("").to_string()))
            .collect::<Vec<_>>(),
        None => Vec::new(),
    };
    let effect = k3_output
        .get("prompt_effect_plan")
        .filter(|item| item.is_object())
        .cloned()
        .unwrap_or(Value::Null);
    let graph = k3_output
        .get("requirement_graph")
        .filter(|item| item.is_object())
        .cloned()
        .unwrap_or_else(|| json!({}));
    let proof_refs = string_items(k3_output.get("proof_refs"))
        .into_iter()
        .filter(|item| item.as_str().map(|text| !text.is_empty()).unwrap_or(false))
        .collect::<Vec<_>>();
    Ok(json!({
        "compiled_prompt": compiled_prompt,
        "effect_plan": effect,
        "k3": {"selection_id": selection, "techniques": techniques},
        "proof_refs": proof_refs,
        "protected_intent": protected,
        "requirement_graph": graph,
        "xcat": {"active_category": category, "taxonomy_version": taxonomy},
    }))
}

fn evaluate_from_k3(payload: &Value) -> Result<Value, SpeError> {
    let compiled = payload.get("compiled_prompt").and_then(|item| item.as_str());
    let k3_output = payload.get("k3_output");
    if k3_output.map(|item| item.is_object()) != Some(true) || compiled.is_none() {
        let mode = payload.get("mode").and_then(|item| item.as_str()).unwrap_or("");
        return Ok(json!({
            "receipt": receipt(mode, "FAIL", vec!["MALFORMED_K3".into()], "DECLARED_POLICY", false, Value::Null),
            "subject": Value::Null,
        }));
    }
    let subject = subject_from_k3(k3_output.expect("checked"), compiled.expect("checked"))?;
    let mode = payload.get("mode").and_then(|item| item.as_str()).unwrap_or("VALIDATE_ONLY");
    let mut request = Map::new();
    request.insert("artifact".into(), subject.clone());
    request.insert("enforcement".into(), Value::String("AVAILABLE".into()));
    request.insert("mode".into(), Value::String(mode.to_string()));
    if let Some(evidence) = payload.get("runtime_evidence").filter(|item| item.is_object()) {
        request.insert("runtime_evidence".into(), evidence.clone());
    }
    let mode_receipt = run_mode(&Value::Object(request))?;
    Ok(json!({"receipt": mode_receipt, "subject": subject}))
}

pub fn evaluate(input: &Value) -> Result<Value, SpeError> {
    let op = input.get("op").and_then(|v| v.as_str()).unwrap_or("");
    match op {
        "obligations" => {
            let subject = input
                .get("subject")
                .filter(|item| item.is_object())
                .ok_or_else(|| SpeError::new("MALFORMED_SUBJECT", "subject must be an object"))?;
            Ok(json!({"obligations": evaluate_obligations(subject)?}))
        }
        "delta" => {
            let before = input
                .get("before")
                .filter(|item| item.is_object())
                .ok_or_else(|| SpeError::new("MALFORMED_SUBJECT", "before must be an object"))?;
            let after = input
                .get("after")
                .filter(|item| item.is_object())
                .ok_or_else(|| SpeError::new("MALFORMED_SUBJECT", "after must be an object"))?;
            quality_delta(before, after)
        }
        "reconstruct" => {
            let subject = input
                .get("subject")
                .filter(|item| item.is_object())
                .ok_or_else(|| SpeError::new("MALFORMED_SUBJECT", "subject must be an object"))?;
            let attempt = input.get("attempt_index").and_then(|v| v.as_i64()).unwrap_or(1);
            let requested = input.get("requested_repair").and_then(|v| v.as_str());
            reconstruct(subject, attempt, requested)
        }
        "mode" => validate_mode(input).and_then(|body| with_custody(input, body)),
        "from_k3" => evaluate_from_k3(input),
        "loop" => {
            let subject = input
                .get("subject")
                .filter(|item| item.is_object())
                .ok_or_else(|| SpeError::new("MALFORMED_SUBJECT", "subject must be an object"))?;
            let mode = input.get("mode").and_then(|v| v.as_str()).unwrap_or("VALIDATE_ONLY");
            quality_loop(subject, mode)
        }
        _ => Err(SpeError::new("UNSUPPORTED_OP", "unsupported quality op")),
    }
}
