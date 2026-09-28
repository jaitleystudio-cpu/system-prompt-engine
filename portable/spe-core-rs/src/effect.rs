//! Prompt effect plan. Python `spe_runtime.k3.effect` is the semantic oracle.

use crate::reasons::SpeError;
use crate::sha256_lite::sha256_hex;
use crate::value::canonical_dumps;
use serde_json::{json, Map, Value};

const EFFECT_SCHEMA: &str = "prompt_effect_plan.v1";
const EFFECT_VERSION: &str = "k3.effect.g1r7r";

const DIRECT: &str = "Follow the objective directly. Do not invent examples.";
const DECOMPOSE: &str = "Decompose the task into visible parts, then synthesize. Do not change the objective. Parts: identify_subproblems; solve_parts; synthesize.";
const STEP_BACK: &str = "State the governing principles and acceptance criteria before producing the result. Do not disclose private deliberation.";
const GROUNDING: &str = "Use only supplied evidence. Separate evidence from assumption. Do not state that any page was opened, that any source was obtained, or that any reference was located. Network access remains unauthorized.";
const CRITIQUE: &str = "Review the result once against the requirements, then revise once. Do not repeat the review.";
const ROLE_DEFAULT: &str = "Working default role: presentation only. It does not change the objective.";

fn technique_operation(technique: &str) -> Option<&'static str> {
    match technique {
        "ZERO_SHOT" => Some("DIRECT"),
        "FEW_SHOT" => Some("USE_USER_EXAMPLES"),
        "ROLE_PERSONA" => Some("ROLE_CALIBRATION"),
        "CONTEXTUAL" => Some("USE_CONTEXT"),
        "STEP_BACK" => Some("STEP_BACK"),
        "DECOMPOSE_PLAN_SOLVE" => Some("DECOMPOSE"),
        "RETRIEVE_REASON" => Some("ADD_GROUNDING_CONTRACT"),
        "CRITIQUE_REVISE" => Some("CRITIQUE_REVISE_ONCE"),
        "STRUCTURED_OUTPUT" => Some("STRUCTURED_OUTPUT"),
        _ => None,
    }
}

fn digest(payload: &Value) -> Result<String, SpeError> {
    let text = canonical_dumps(payload)?;
    Ok(format!("pbind-{}", sha256_hex(text.as_bytes())))
}

fn string_list(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(|v| v.as_array())
        .map(|items| items.iter().filter_map(|item| item.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default()
}

fn protected_fields(binding: &Value) -> Value {
    let obj = binding.as_object();
    let goal = obj
        .and_then(|map| map.get("goal"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let hard_constraints = obj
        .and_then(|map| map.get("hard_constraints"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let facts = obj
        .and_then(|map| map.get("facts"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let provenance = obj
        .and_then(|map| map.get("provenance"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let budget = obj
        .and_then(|map| map.get("budget"))
        .cloned()
        .unwrap_or(Value::Null);
    let desired = obj
        .and_then(|map| map.get("desired_output"))
        .cloned()
        .unwrap_or(Value::Null);
    let authority = if let Some(auth) = obj.and_then(|map| map.get("authority_state")).and_then(|v| v.as_object()) {
        let level = auth.get("level").and_then(|v| v.as_i64()).unwrap_or(0);
        let status_raw = auth.get("status").and_then(|v| v.as_str()).unwrap_or("");
        let status = if status_raw.is_empty() { "NONE" } else { status_raw };
        let grants = auth
            .get("grants")
            .and_then(|v| v.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(|text| Value::String(text.to_string())))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        json!({"grants": grants, "level": level, "status": status})
    } else {
        json!({"grants": [], "level": 0, "status": "NONE"})
    };
    json!({
        "authority_state": authority,
        "budget": budget,
        "desired_output": desired,
        "facts": facts,
        "goal": goal,
        "hard_constraints": hard_constraints,
        "provenance": provenance,
    })
}

fn digest_body(fields: &Value) -> Value {
    json!({
        "authority_state": fields.get("authority_state").cloned().unwrap_or(Value::Null),
        "budget": fields.get("budget").cloned().unwrap_or(Value::Null),
        "facts": fields.get("facts").cloned().unwrap_or(json!([])),
        "goal": fields.get("goal").cloned().unwrap_or(Value::String(String::new())),
        "hard_constraints": fields.get("hard_constraints").cloned().unwrap_or(json!([])),
        "provenance": fields.get("provenance").cloned().unwrap_or(json!([])),
    })
}

fn nodes_of(graph: &Value) -> Vec<Value> {
    let Some(nodes) = graph.get("graph").and_then(|v| v.get("nodes")).and_then(|v| v.as_object()) else {
        return Vec::new();
    };
    let mut keys: Vec<&String> = nodes.keys().collect();
    keys.sort();
    keys.iter().filter_map(|key| nodes.get(*key).cloned()).collect()
}

fn node_text(node: &Value) -> Result<String, SpeError> {
    if let Some(statement) = node.get("statement").and_then(|v| v.as_str()) {
        if !statement.trim().is_empty() {
            return Ok(statement.to_string());
        }
    }
    if let Some(value) = node.get("value").and_then(|v| v.as_str()) {
        if !value.trim().is_empty() {
            return Ok(value.to_string());
        }
    }
    if let Some(value) = node.get("value").and_then(|v| v.as_object()) {
        for key in ["statement", "text", "description"] {
            if let Some(item) = value.get(key).and_then(|v| v.as_str()) {
                if !item.trim().is_empty() {
                    return Ok(item.to_string());
                }
            }
        }
    }
    canonical_dumps(node.get("value").unwrap_or(&Value::Null))
}

fn is_example_text(value: &Value) -> bool {
    value
        .as_str()
        .map(|text| text.contains("EXAMPLE / USER_SUPPLIED") || text.contains("NON-AUTHORITATIVE"))
        .unwrap_or(false)
}

fn semantic_key(node: &Value) -> &str {
    node.get("semantic_key").and_then(|v| v.as_str()).unwrap_or("")
}

fn is_role_node(node: &Value) -> bool {
    let key = semantic_key(node).to_lowercase();
    if key.contains("role") || key.contains("persona") || key.contains("expertise") {
        return true;
    }
    node.get("value")
        .and_then(|v| v.get("preference_id"))
        .and_then(|v| v.as_str())
        == Some("brief-role")
}

fn example_nodes(nodes: &[Value]) -> Vec<&Value> {
    nodes.iter().filter(|node| semantic_key(node) == "user_supplied_pattern").collect()
}

fn role_nodes(nodes: &[Value]) -> Vec<&Value> {
    nodes.iter().filter(|node| is_role_node(node)).collect()
}

fn schema_nodes(nodes: &[Value]) -> Vec<&Value> {
    nodes
        .iter()
        .filter(|node| {
            let key = semantic_key(node);
            if key == "user_supplied_pattern" {
                return false;
            }
            let lowered = key.to_lowercase();
            key == "desired_output"
                || lowered.contains("json")
                || lowered.contains("schema")
                || lowered.contains("structured")
                || lowered.contains("format")
                || lowered.contains("fields")
        })
        .collect()
}

fn context_nodes(nodes: &[Value]) -> Vec<&Value> {
    nodes
        .iter()
        .filter(|node| {
            let key = semantic_key(node);
            (key == "fact" || key == "user_preference") && !is_role_node(node) && key != "user_supplied_pattern"
        })
        .collect()
}

fn preference_nodes(nodes: &[Value]) -> Vec<&Value> {
    nodes
        .iter()
        .filter(|node| semantic_key(node) == "user_preference" && !is_role_node(node))
        .collect()
}

fn unknown_nodes(nodes: &[Value]) -> Vec<&Value> {
    nodes.iter().filter(|node| semantic_key(node) == "unknown").collect()
}

fn category_label(nodes: &[Value]) -> String {
    let mut labels = Vec::new();
    for node in nodes {
        if semantic_key(node) != "category_ref" {
            continue;
        }
        let Some(value) = node.get("value").and_then(|v| v.as_object()) else {
            continue;
        };
        let mut label = value.get("display_label").and_then(|v| v.as_str()).unwrap_or("");
        if label.trim().is_empty() {
            label = value.get("category").and_then(|v| v.as_str()).unwrap_or("");
        }
        let trimmed = label.trim();
        if !trimmed.is_empty() && !labels.iter().any(|item| item == trimmed) {
            labels.push(trimmed.to_string());
        }
    }
    if labels.is_empty() {
        "unspecified".to_string()
    } else {
        labels.join("; ")
    }
}

fn record_text(item: &Value) -> Result<String, SpeError> {
    if let Some(text) = item.as_str() {
        return Ok(text.to_string());
    }
    if let Some(obj) = item.as_object() {
        if let Some(statement) = obj.get("statement").and_then(|v| v.as_str()) {
            return Ok(statement.to_string());
        }
        if let Some(description) = obj.get("description").and_then(|v| v.as_str()) {
            return Ok(description.to_string());
        }
        return canonical_dumps(item);
    }
    canonical_dumps(item)
}

fn bullet(items: &[String]) -> String {
    if items.is_empty() {
        "none".to_string()
    } else {
        items.iter().map(|item| format!("- {item}")).collect::<Vec<_>>().join("\n")
    }
}

fn section(heading: &str, body: &str) -> String {
    format!("## {heading}\n{body}")
}

fn effect_text(code: &str, nodes: &[Value]) -> Result<String, SpeError> {
    match code {
        "DIRECT" => Ok(DIRECT.to_string()),
        "USE_USER_EXAMPLES" => {
            let mut lines = Vec::new();
            for node in example_nodes(nodes) {
                lines.push(format!("- {} [non-authoritative]", node_text(node)?));
            }
            Ok(format!(
                "Use only these authorized examples. Do not invent additional examples.\n{}",
                lines.join("\n")
            ))
        }
        "USE_CONTEXT" => {
            let mut lines = Vec::new();
            for node in context_nodes(nodes) {
                lines.push(node_text(node)?);
            }
            if lines.is_empty() {
                Ok("Make the supplied context explicit. Do not invent context.\nSupplied context: none.".to_string())
            } else {
                let listed = lines.iter().map(|line| format!("- {line}")).collect::<Vec<_>>().join("\n");
                Ok(format!("Make the supplied context explicit. Do not invent context.\n{listed}"))
            }
        }
        "ADD_GROUNDING_CONTRACT" => Ok(GROUNDING.to_string()),
        "DECOMPOSE" => Ok(DECOMPOSE.to_string()),
        "STEP_BACK" => Ok(STEP_BACK.to_string()),
        "CRITIQUE_REVISE_ONCE" => Ok(CRITIQUE.to_string()),
        "STRUCTURED_OUTPUT" => {
            let mut rendered = Vec::new();
            for node in schema_nodes(nodes) {
                rendered.push(canonical_dumps(node.get("value").unwrap_or(&Value::Null))?);
            }
            Ok(format!(
                "Use only this authorized output structure. Do not invent a schema.\n{}",
                rendered.join("\n")
            ))
        }
        "ROLE_CALIBRATION" => {
            let mut roles = Vec::new();
            for node in role_nodes(nodes) {
                roles.push(node_text(node)?);
            }
            if roles.is_empty() {
                Ok(ROLE_DEFAULT.to_string())
            } else {
                Ok(format!(
                    "Use this user-supplied role. It does not change the objective.\n{}",
                    roles.join("\n")
                ))
            }
        }
        _ => Err(SpeError::new("PORTABILITY_INVALID_FIXTURE", "unknown effect code")),
    }
}

fn compiled_prompt(fields: &Value, nodes: &[Value], sections: &[Value]) -> Result<String, SpeError> {
    let goal = fields.get("goal").and_then(|v| v.as_str()).unwrap_or("");
    let mut parts = vec![
        section("Objective", goal),
        section(
            "Hard constraints",
            &bullet(
                &fields
                    .get("hard_constraints")
                    .and_then(|v| v.as_array())
                    .unwrap_or(&Vec::new())
                    .iter()
                    .map(record_text)
                    .collect::<Result<Vec<_>, _>>()?,
            ),
        ),
    ];
    let budget = fields.get("budget").cloned().unwrap_or(Value::Null);
    let budget_text = if budget.is_null() {
        "none".to_string()
    } else if let Some(text) = budget.as_str() {
        text.to_string()
    } else {
        canonical_dumps(&budget)?
    };
    parts.push(section("Budget", &budget_text));
    parts.push(section(
        "Facts",
        &bullet(
            &fields
                .get("facts")
                .and_then(|v| v.as_array())
                .unwrap_or(&Vec::new())
                .iter()
                .map(record_text)
                .collect::<Result<Vec<_>, _>>()?,
        ),
    ));
    let provenance_lines = fields
        .get("provenance")
        .and_then(|v| v.as_array())
        .unwrap_or(&Vec::new())
        .iter()
        .map(|item| {
            if let Some(text) = item.as_str() {
                Ok(text.to_string())
            } else {
                canonical_dumps(item)
            }
        })
        .collect::<Result<Vec<_>, _>>()?;
    parts.push(section("Provenance", &bullet(&provenance_lines)));
    let authority = fields.get("authority_state").cloned().unwrap_or(json!({}));
    let level = authority.get("level").and_then(|v| v.as_i64()).unwrap_or(0);
    let status = authority.get("status").and_then(|v| v.as_str()).unwrap_or("NONE");
    let grants = authority
        .get("grants")
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|text| text.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let grant_text = if grants.is_empty() { "none".to_string() } else { grants.join(",") };
    parts.push(section("Authority", &format!("level={level}; status={status}; grants={grant_text}")));
    if let Some(desired) = fields.get("desired_output") {
        if !desired.is_null() && !is_example_text(desired) {
            let rendered = if let Some(text) = desired.as_str() {
                text.to_string()
            } else {
                canonical_dumps(desired)?
            };
            parts.push(section("Deliverable", &rendered));
        }
    }
    let patterns = example_nodes(nodes);
    if !patterns.is_empty() {
        let mut lines = Vec::new();
        for node in patterns {
            lines.push(format!("- {} [non-authoritative]", node_text(node)?));
        }
        parts.push(section("Supplied patterns", &lines.join("\n")));
    }
    let roles = role_nodes(nodes);
    if !roles.is_empty() {
        let mut lines = Vec::new();
        for node in roles {
            lines.push(node_text(node)?);
        }
        parts.push(section("Supplied role", &lines.join("\n")));
    }
    let preferences = preference_nodes(nodes);
    if !preferences.is_empty() {
        let mut lines = Vec::new();
        for node in preferences {
            lines.push(node_text(node)?);
        }
        parts.push(section("Preferences", &bullet(&lines)));
    }
    let unknowns = unknown_nodes(nodes);
    if !unknowns.is_empty() {
        let mut lines = Vec::new();
        for node in unknowns {
            lines.push(node_text(node)?);
        }
        parts.push(section("Open questions", &bullet(&lines)));
    }
    parts.push(section("Category presentation", &category_label(nodes)));
    for item in sections {
        let code = item.get("code").and_then(|v| v.as_str()).unwrap_or("");
        let text = item.get("text").and_then(|v| v.as_str()).unwrap_or("");
        parts.push(section(&format!("Effect: {code}"), text));
    }
    Ok(parts.join("\n\n"))
}

fn closed_plan(
    selection_id: &str,
    disposition: &str,
    reason: &str,
    fields: Value,
    graph_digest: &str,
    techniques: &[String],
    deferred: &[String],
    extra_notes: &[String],
    blocked: &[String],
) -> Result<Value, SpeError> {
    let mut notes = vec![Value::String(disposition.to_string()), Value::String(reason.to_string())];
    notes.extend(extra_notes.iter().cloned().map(Value::String));
    Ok(json!({
        "authority_escalation": false,
        "blocked_operations": blocked,
        "claims_pass": false,
        "compiled_prompt": Value::Null,
        "deferred_techniques": deferred,
        "disposition": disposition,
        "effect_version": EFFECT_VERSION,
        "notes": notes,
        "operations": [],
        "protected_binding_digest": digest(&digest_body(&fields))?,
        "protected_fields": fields,
        "renderable": false,
        "requirement_graph_digest": graph_digest,
        "schema_version": EFFECT_SCHEMA,
        "sections": [],
        "selection_id": selection_id,
        "techniques": techniques,
    }))
}

pub fn bind(selection: &Value) -> Result<Value, SpeError> {
    let source = selection.as_object().cloned().unwrap_or_else(Map::new);
    let binding = protected_fields(source.get("protected_binding").unwrap_or(&Value::Null));
    let graph = source.get("requirement_graph").cloned().unwrap_or(Value::Null);
    let graph_digest = graph.get("graph_digest").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let selection_id = source.get("selection_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let techniques = string_list(source.get("techniques"));
    let deferred = string_list(source.get("deferred_techniques"));
    let disposition = source.get("disposition").and_then(|v| v.as_str()).unwrap_or("");
    let selection_notes = string_list(source.get("notes"));
    if disposition != "SELECTED" && disposition != "SAFE_DEFAULT" {
        let reason = if disposition.is_empty() { "NO_SELECTION" } else { disposition };
        return closed_plan(
            &selection_id,
            "REFUSED",
            reason,
            binding,
            &graph_digest,
            &techniques,
            &deferred,
            &[],
            &[],
        );
    }
    if graph.get("validity").and_then(|v| v.as_str()) == Some("CONFLICTED") {
        return closed_plan(
            &selection_id,
            "REFUSED",
            "CONFLICTED_GRAPH",
            binding,
            &graph_digest,
            &techniques,
            &deferred,
            &[],
            &[],
        );
    }
    if techniques.is_empty() || techniques.iter().any(|item| technique_operation(item).is_none()) {
        return closed_plan(
            &selection_id,
            "REFUSED",
            "INVALID_TECHNIQUE",
            binding,
            &graph_digest,
            &techniques,
            &deferred,
            &[],
            &[],
        );
    }
    if techniques.iter().any(|item| item == "ZERO_SHOT") && techniques.iter().any(|item| item == "FEW_SHOT") {
        return closed_plan(
            &selection_id,
            "REFUSED",
            "INCOMPATIBLE_TECHNIQUES",
            binding,
            &graph_digest,
            &techniques,
            &deferred,
            &[],
            &[],
        );
    }
    let nodes = nodes_of(&graph);
    let mut blocked: Vec<String> = Vec::new();
    let mut block_notes: Vec<String> = Vec::new();
    if techniques.iter().any(|item| item == "FEW_SHOT") && example_nodes(&nodes).is_empty() {
        blocked.push("USE_USER_EXAMPLES".to_string());
        block_notes.push("EXAMPLES_REQUIRED_BUT_MISSING".to_string());
    }
    if techniques.iter().any(|item| item == "STRUCTURED_OUTPUT") && schema_nodes(&nodes).is_empty() {
        blocked.push("STRUCTURED_OUTPUT".to_string());
        block_notes.push("STRUCTURED_OUTPUT_UNAUTHORIZED".to_string());
    }
    if !blocked.is_empty() {
        let reason = block_notes[0].clone();
        let extra = if block_notes.len() > 1 { block_notes[1..].to_vec() } else { Vec::new() };
        return closed_plan(
            &selection_id,
            "DEFERRED",
            &reason,
            binding,
            &graph_digest,
            &techniques,
            &deferred,
            &extra,
            &blocked,
        );
    }
    let operations: Vec<String> = techniques
        .iter()
        .map(|item| technique_operation(item).unwrap().to_string())
        .collect();
    let mut sections = Vec::new();
    for code in &operations {
        sections.push(json!({"code": code, "text": effect_text(code, &nodes)?}));
    }
    let mut notes = vec![Value::String("BOUND".to_string())];
    for note in &selection_notes {
        if note.starts_with("BUDGET_TRUNCATED") {
            notes.push(Value::String(note.clone()));
        }
    }
    let prompt = compiled_prompt(&binding, &nodes, &sections)?;
    Ok(json!({
        "authority_escalation": false,
        "blocked_operations": [],
        "claims_pass": false,
        "compiled_prompt": prompt,
        "deferred_techniques": deferred,
        "disposition": "BOUND",
        "effect_version": EFFECT_VERSION,
        "notes": notes,
        "operations": operations,
        "protected_binding_digest": digest(&digest_body(&binding))?,
        "protected_fields": binding,
        "renderable": true,
        "requirement_graph_digest": graph_digest,
        "schema_version": EFFECT_SCHEMA,
        "sections": sections,
        "selection_id": selection_id,
        "techniques": techniques,
    }))
}
