//! AUTO semantic frames for CategoryRouterIR.
//! Python `spe_runtime.xcat.auto_route` is the oracle. This is not a second router.

use crate::reasons::SpeError;
use crate::value::canonical_dumps;
use crate::xcat::routing_id;
use serde_json::{json, Map, Value};

const AUTO_LABEL: &str = "AI Assistant";
const TWIN_VERSION: &str = "xcat.router.v1";

const PREFIXES: &[&str] = &[
    "i would like you to ",
    "i would like to ",
    "i'd like you to ",
    "i'd like to ",
    "i need you to ",
    "i want you to ",
    "could you ",
    "would you ",
    "i need to ",
    "i want to ",
    "can you ",
    "help me ",
    "please ",
    "kindly ",
];

const HEADS: &[(&str, &str)] = &[
    ("business offer", "business"),
    ("business plan", "business"),
    ("business case", "business"),
    ("career plan", "career"),
    ("investigate", "research"),
    ("communicate", "write"),
    ("storyboard", "multimedia"),
    ("translate", "translate"),
    ("recommend", "advise"),
    ("role-play", "creative"),
    ("carry out", "execute"),
    ("localize", "translate"),
    ("localise", "translate"),
    ("roleplay", "creative"),
    ("research", "research"),
    ("analyze", "analyze"),
    ("analyse", "analyze"),
    ("compare", "analyze"),
    ("extract", "analyze"),
    ("execute", "execute"),
    ("rewrite", "write"),
    ("program", "code"),
    ("business", "business"),
    ("advise", "advise"),
    ("decide", "advise"),
    ("career", "career"),
    ("debug", "code"),
    ("draft", "write"),
    ("learn", "learn"),
    ("study", "learn"),
    ("teach", "learn"),
    ("write", "write"),
    ("story", "creative"),
    ("code", "code"),
    ("plan", "advise"),
];

const FIELD_GROUPS: &[(&str, &[&str])] = &[
    (
        "CAT:C01",
        &[
            "options",
            "criteria",
            "constraints",
            "evidence",
            "uncertainty",
            "sensitivity",
            "reversibility",
            "decision_authority",
        ],
    ),
    (
        "CAT:C02",
        &[
            "question",
            "search_strategy",
            "source_classes",
            "freshness",
            "contradiction_map",
            "gaps",
            "synthesis",
        ],
    ),
    (
        "CAT:C03",
        &[
            "communicative_goal",
            "audience",
            "facts_claims",
            "voice",
            "format",
            "prohibited_claims",
        ],
    ),
    (
        "CAT:C04",
        &[
            "source_language",
            "target_language",
            "protected_terms",
            "localization_policy",
            "transliteration_policy",
            "alignment_map",
        ],
    ),
    (
        "CAT:C05",
        &[
            "learner_state",
            "concept_graph",
            "progression",
            "practice",
            "mastery_evidence",
        ],
    ),
    (
        "CAT:C06",
        &[
            "source_objects",
            "dimensions",
            "extraction",
            "normalization",
            "calculations",
            "anomalies",
            "conclusions",
        ],
    ),
    (
        "CAT:C07",
        &[
            "desired_action",
            "authority",
            "credentials_reference",
            "reversibility",
            "approvals",
            "postconditions",
            "receipt",
        ],
    ),
    (
        "CAT:C08",
        &[
            "customer",
            "market",
            "offer",
            "channels",
            "pricing",
            "unit_economics",
            "experiments",
            "metrics",
        ],
    ),
    (
        "CAT:C09",
        &[
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
    ),
    (
        "CAT:C10",
        &[
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
    ),
    (
        "CAT:C11",
        &[
            "profile",
            "target_role",
            "evidence_of_skills",
            "gaps",
            "opportunities",
            "compensation_geography",
            "plan",
        ],
    ),
    (
        "CAT:C12",
        &[
            "canon",
            "timeline",
            "characters",
            "knowledge_states",
            "relationships",
            "plot",
            "scenes",
            "roleplay_branching_franchise_state",
        ],
    ),
];

fn act_category(act: &str) -> &'static str {
    match act {
        "advise" => "CAT:C01",
        "research" => "CAT:C02",
        "write" => "CAT:C03",
        "translate" => "CAT:C04",
        "learn" => "CAT:C05",
        "analyze" => "CAT:C06",
        "execute" => "CAT:C07",
        "business" => "CAT:C08",
        "code" => "CAT:C09",
        "multimedia" => "CAT:C10",
        "career" => "CAT:C11",
        "creative" => "CAT:C12",
        _ => "",
    }
}

pub fn display_label_bridge(label: &str) -> Option<&'static str> {
    match label {
        "Research" => Some("CAT:C02"),
        "Analysis" => Some("CAT:C06"),
        _ => None,
    }
}

pub fn is_auto(evidence: &Map<String, Value>) -> bool {
    if evidence.get("routing_mode").and_then(|v| v.as_str()) == Some("AUTO") {
        return true;
    }
    evidence
        .get("display_label")
        .and_then(|v| v.as_str())
        .map(|label| label.trim() == AUTO_LABEL)
        .unwrap_or(false)
}

fn nonempty(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => false,
        Some(Value::String(text)) => !text.is_empty(),
        Some(_) => true,
    }
}

pub fn explicit_category_keys_present(evidence: &Map<String, Value>) -> bool {
    for key in [
        "xcat_id",
        "category_ref",
        "primary_category",
        "stage_category",
        "self_selected_category",
    ] {
        if evidence.contains_key(key) && nonempty(evidence.get(key)) {
            return true;
        }
    }
    if let Some(Value::Object(stage)) = evidence.get("stage") {
        for key in ["category_ref", "primary_category", "xcat_id"] {
            if stage.contains_key(key) && nonempty(stage.get(key)) {
                return true;
            }
        }
    }
    false
}

fn push_unique(found: &mut Vec<String>, value: &Value) {
    let text = match value {
        Value::String(text) => text.trim().to_string(),
        Value::Null => return,
        other => other.to_string(),
    };
    let text = text.trim().to_string();
    if !text.is_empty() && !found.iter().any(|item| item == &text) {
        found.push(text);
    }
}

fn forged_values(evidence: &Map<String, Value>) -> Vec<String> {
    let mut found = Vec::new();
    for key in [
        "xcat_id",
        "category_ref",
        "primary_category",
        "stage_category",
        "self_selected_category",
    ] {
        if evidence.contains_key(key) && nonempty(evidence.get(key)) {
            if let Some(value) = evidence.get(key) {
                push_unique(&mut found, value);
            }
        }
    }
    if let Some(Value::Object(stage)) = evidence.get("stage") {
        for key in ["category_ref", "primary_category", "xcat_id"] {
            if stage.contains_key(key) && nonempty(stage.get(key)) {
                if let Some(value) = stage.get(key) {
                    push_unique(&mut found, value);
                }
            }
        }
    }
    if let Some(Value::Array(items)) = evidence.get("category_evidence") {
        for item in items {
            if let Some(obj) = item.as_object() {
                for key in ["value", "category", "proof"] {
                    if let Some(value) = obj.get(key) {
                        push_unique(&mut found, value);
                    }
                }
            }
        }
    }
    found
}

fn norm(text: &str) -> String {
    let mut out = String::new();
    let mut prev_space = true;
    for ch in text.chars() {
        if ch.is_whitespace() {
            if !prev_space && !out.is_empty() {
                out.push(' ');
                prev_space = true;
            }
        } else {
            for lower in ch.to_lowercase() {
                out.push(lower);
            }
            prev_space = false;
        }
    }
    if out.ends_with(' ') {
        out.pop();
    }
    out
}

fn sorted_prefixes() -> Vec<&'static str> {
    let mut items = PREFIXES.to_vec();
    items.sort_by(|left, right| right.len().cmp(&left.len()).then(left.cmp(right)));
    items
}

fn strip_prefixes(text: &str) -> String {
    let mut body = text.to_string();
    let prefixes = sorted_prefixes();
    loop {
        let mut changed = false;
        for prefix in &prefixes {
            if body.starts_with(prefix) {
                body = body[prefix.len()..].to_string();
                changed = true;
                break;
            }
        }
        if !changed {
            break;
        }
    }
    body
}

fn sorted_heads() -> Vec<(&'static str, &'static str)> {
    let mut items = HEADS.to_vec();
    items.sort_by(|left, right| right.0.len().cmp(&left.0.len()).then(left.0.cmp(right.0)));
    items
}

fn match_act_head(text: &str) -> Option<&'static str> {
    let body = strip_prefixes(&norm(text));
    if body.is_empty() {
        return None;
    }
    for (phrase, act) in sorted_heads() {
        if !body.starts_with(phrase) {
            continue;
        }
        let rest = body[phrase.len()..].chars().next();
        if rest.map(|ch| !ch.is_alphanumeric()).unwrap_or(true) {
            return Some(act);
        }
    }
    None
}

fn frame(act: &str, category: &str, ordinal: usize, source_ref: &str) -> Value {
    json!({
        "act": act,
        "category": category,
        "key": "semantic_frame",
        "ordinal": ordinal,
        "provenance": "KERNEL_DERIVED",
        "source_ref": source_ref,
    })
}

fn goal_frames(goal: &str) -> (&'static str, Vec<Value>) {
    let body = strip_prefixes(&norm(goal));
    if body.is_empty() {
        return ("none", Vec::new());
    }
    if let Some((left, right)) = body.split_once(" or ") {
        if match_act_head(left).is_some() && match_act_head(right).is_some() {
            return ("conflict", Vec::new());
        }
    }
    let mut acts: Vec<&str> = Vec::new();
    for segment in body.split(" and ") {
        if let Some(act) = match_act_head(segment) {
            if acts.last().copied() != Some(act) {
                acts.push(act);
            }
        }
    }
    let mut chosen: Vec<(&str, &str)> = Vec::new();
    let mut cats: Vec<&str> = Vec::new();
    for act in acts {
        let cat = act_category(act);
        if cats.last().copied() != Some(cat) {
            cats.push(cat);
            chosen.push((act, cat));
        }
    }
    if chosen.len() > 2 {
        return ("conflict", Vec::new());
    }
    if chosen.is_empty() {
        return ("none", Vec::new());
    }
    let frames = chosen
        .into_iter()
        .enumerate()
        .map(|(index, (act, cat))| frame(act, cat, index, "goal"))
        .collect();
    ("ok", frames)
}

fn exclusive_owner(field: &str) -> Option<&'static str> {
    let mut owner: Option<&str> = None;
    for (category, fields) in FIELD_GROUPS {
        if fields.contains(&field) {
            if owner.is_some() {
                return None;
            }
            owner = Some(*category);
        }
    }
    owner
}

fn structured_frames(objects: &[Value]) -> (&'static str, Vec<Value>) {
    let mut chosen: Vec<&str> = Vec::new();
    for obj in objects {
        let Some(map) = obj.as_object() else { continue };
        let mut owners: Vec<&str> = Vec::new();
        for key in map.keys() {
            if let Some(owner) = exclusive_owner(key) {
                if !owners.contains(&owner) {
                    owners.push(owner);
                }
            }
        }
        if owners.len() > 1 {
            return ("conflict", Vec::new());
        }
        if owners.len() == 1 && !chosen.contains(&owners[0]) {
            chosen.push(owners[0]);
        }
    }
    if chosen.len() > 2 {
        return ("conflict", Vec::new());
    }
    let frames = chosen
        .into_iter()
        .enumerate()
        .map(|(index, cat)| frame("project_ir", cat, index, "structured_evidence"))
        .collect();
    ("ok", frames)
}

fn derive(goal: &str, structured: &[Value]) -> (&'static str, Vec<Value>) {
    let (prose_status, prose) = goal_frames(goal);
    let (struct_status, structured_frames) = structured_frames(structured);
    if prose_status == "conflict" || struct_status == "conflict" {
        if !prose.is_empty() {
            return ("conflict", prose);
        }
        return ("conflict", structured_frames);
    }
    let prose_cats: Vec<&str> = prose.iter().filter_map(|item| item.get("category").and_then(|v| v.as_str())).collect();
    let struct_cats: Vec<&str> = structured_frames
        .iter()
        .filter_map(|item| item.get("category").and_then(|v| v.as_str()))
        .collect();
    if !prose_cats.is_empty() && !struct_cats.is_empty() && prose_cats != struct_cats {
        let mut both = prose;
        both.extend(structured_frames);
        return ("conflict", both);
    }
    if !prose.is_empty() {
        return ("ok", prose);
    }
    if !structured_frames.is_empty() {
        return ("ok", structured_frames);
    }
    ("none", Vec::new())
}

fn auto_result(
    rid: &str,
    primary: Option<&str>,
    secondaries: Vec<String>,
    basis: Vec<String>,
    frames: Vec<Value>,
    rejected: Vec<String>,
    deps: Vec<Value>,
    escalation: Vec<String>,
    receipt_basis: &str,
    disposition: &str,
) -> Value {
    let mut receipt = Map::new();
    receipt.insert("routing_id".to_string(), json!(rid));
    receipt.insert("basis".to_string(), json!(receipt_basis));
    if let Some(primary) = primary {
        receipt.insert("primary_category".to_string(), json!(primary));
        let acts: Vec<Value> = frames
            .iter()
            .filter_map(|frame| frame.get("act").cloned())
            .collect();
        receipt.insert("frame_acts".to_string(), Value::Array(acts));
    }
    json!({
        "routing_id": rid,
        "twin_version": TWIN_VERSION,
        "primary_category": primary,
        "secondary_categories": secondaries,
        "confidence_basis": basis,
        "category_evidence": frames,
        "rejected_categories": rejected,
        "cross_category_dependencies": deps,
        "escalation_conditions": escalation,
        "routing_receipt": receipt,
        "disposition": disposition,
    })
}

pub fn route_auto(evidence: &Value) -> Result<Value, SpeError> {
    let evidence_map = evidence.as_object().ok_or_else(|| {
        SpeError::new("PORTABILITY_INVALID_FIXTURE", "evidence must be a mapping")
    })?;
    let rid = routing_id(evidence);
    let goal = evidence_map.get("goal").and_then(|v| v.as_str()).unwrap_or("");
    let structured: Vec<Value> = evidence_map
        .get("structured_evidence")
        .and_then(|v| v.as_array())
        .map(|items| items.iter().filter(|item| item.is_object()).cloned().collect())
        .unwrap_or_default();
    let (status, frames) = derive(goal, &structured);
    let forged = forged_values(evidence_map);
    if status == "conflict" {
        let mut rejected = Vec::new();
        for frame in &frames {
            if let Some(cat) = frame.get("category").and_then(|v| v.as_str()) {
                if !rejected.iter().any(|item: &String| item == cat) {
                    rejected.push(cat.to_string());
                }
            }
        }
        for item in &forged {
            if !rejected.iter().any(|existing| existing == item) {
                rejected.push(item.clone());
            }
        }
        return Ok(auto_result(
            &rid,
            None,
            Vec::new(),
            vec!["CONFLICTING_CATEGORY_EVIDENCE".to_string()],
            frames,
            rejected,
            Vec::new(),
            vec!["CONFLICTING_CATEGORY_EVIDENCE".to_string()],
            "conflicting_category_evidence",
            "UNKNOWN",
        ));
    }
    if frames.is_empty() && !forged.is_empty() {
        return Ok(auto_result(
            &rid,
            None,
            Vec::new(),
            vec!["SELF_SELECTED_WITHOUT_EVIDENCE".to_string()],
            Vec::new(),
            forged,
            Vec::new(),
            vec!["REQUIRE_EXPLICIT_CATEGORY_EVIDENCE".to_string()],
            "rejected_self_selection",
            "UNKNOWN",
        ));
    }
    if frames.is_empty() {
        let nonempty_goal = !goal.trim().is_empty();
        return Ok(auto_result(
            &rid,
            None,
            Vec::new(),
            vec![if nonempty_goal {
                "AMBIGUOUS_REQUEST".to_string()
            } else {
                "NO_EXPLICIT_CATEGORY_EVIDENCE".to_string()
            }],
            Vec::new(),
            Vec::new(),
            Vec::new(),
            vec!["NEEDS_DISAMBIGUATION".to_string()],
            if nonempty_goal { "ambiguous_request" } else { "insufficient_evidence" },
            "NEEDS_DISAMBIGUATION",
        ));
    }
    let primary = frames[0].get("category").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let mut secondaries = Vec::new();
    for frame in frames.iter().skip(1) {
        if let Some(cat) = frame.get("category").and_then(|v| v.as_str()) {
            if cat != primary && !secondaries.iter().any(|item: &String| item == cat) {
                secondaries.push(cat.to_string());
            }
        }
    }
    let mut deps = Vec::new();
    if let Some(secondary) = secondaries.first() {
        deps.push(json!({
            "from_category": primary,
            "relation": "COORDINATED_ACT",
            "to_category": secondary,
        }));
    }
    let basis: Vec<String> = frames
        .iter()
        .filter_map(|frame| frame.get("act").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .collect();
    Ok(auto_result(
        &rid,
        Some(&primary),
        secondaries,
        basis,
        frames,
        forged,
        deps,
        Vec::new(),
        "semantic_frame",
        "ROUTED",
    ))
}

pub fn structured_evidence_from_graph(graph: &Value) -> Result<Vec<Value>, SpeError> {
    let Some(nodes) = graph.get("graph").and_then(|body| body.get("nodes")).and_then(|v| v.as_object()) else {
        return Ok(Vec::new());
    };
    let mut objects = Vec::new();
    for node in nodes.values() {
        let Some(obj) = node.as_object() else { continue };
        if obj.get("semantic_key").and_then(|v| v.as_str()) == Some("category_ref") {
            continue;
        }
        if let Some(Value::Object(value)) = obj.get("value") {
            objects.push(Value::Object(value.clone()));
        }
    }
    objects.sort_by(|left, right| {
        let left_key = canonical_dumps(left).unwrap_or_default();
        let right_key = canonical_dumps(right).unwrap_or_default();
        left_key.cmp(&right_key)
    });
    Ok(objects)
}

pub fn build_auto_evidence(protected: &Value, category: &Value, graph: &Value) -> Result<Value, SpeError> {
    let display = category
        .get("display_label")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let goal = protected.get("goal").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let mut evidence = Map::new();
    evidence.insert("display_label".to_string(), json!(display));
    evidence.insert("goal".to_string(), json!(goal));
    evidence.insert("routing_mode".to_string(), json!("AUTO"));
    evidence.insert(
        "structured_evidence".to_string(),
        Value::Array(structured_evidence_from_graph(graph)?),
    );
    if let Some(xcat) = category.get("xcat_id").and_then(|v| v.as_str()) {
        let trimmed = xcat.trim();
        if !trimmed.is_empty() {
            evidence.insert("xcat_id".to_string(), json!(trimmed));
        }
    }
    Ok(Value::Object(evidence))
}
