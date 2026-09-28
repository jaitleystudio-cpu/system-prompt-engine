//! K3 technique selector. Python `select_prompt_techniques` is the semantic oracle.
//! This module must not grow a second interpretation.

use crate::protocols::list_protocol_domains;
use crate::reasons::SpeError;
use crate::sha256_lite::sha256_hex;
use crate::value::canonical_dumps;
use serde_json::{json, Map, Value};
use std::collections::BTreeSet;

const SELECTOR_VERSION: &str = "k3.g1r7r";
const SCHEMA_VERSION: &str = "technique_selection.v1";
const PLAN_SCHEMA_VERSION: &str = "cognitive_plan.v1";
const STRATEGY_SCHEMA_VERSION: &str = "prompt_strategy.v1";
const STANDARD_MAX: usize = 3;

fn priority(tech: &str) -> i32 {
    match tech {
        "RETRIEVE_REASON" => 0,
        "STRUCTURED_OUTPUT" => 1,
        "DECOMPOSE_PLAN_SOLVE" => 2,
        "CRITIQUE_REVISE" => 3,
        "FEW_SHOT" => 4,
        "CONTEXTUAL" => 5,
        "ROLE_PERSONA" => 6,
        "STEP_BACK" => 7,
        "ZERO_SHOT" => 8,
        _ => 100,
    }
}

fn strength_rank(strength: &str) -> i32 {
    match strength {
        "MUST" => 0,
        "SHOULD" => 1,
        "PREFERENCE" => 2,
        "HINT" => 3,
        "PLAN" => 4,
        _ => 9,
    }
}

fn key_hints(tech: &str) -> &'static [&'static str] {
    match tech {
        "RETRIEVE_REASON" => &["evidence", "research", "citation", "cite", "source", "retrieval"],
        "STRUCTURED_OUTPUT" => &["json", "schema", "structured", "format", "fields"],
        "CRITIQUE_REVISE" => &["revise", "revision", "critique", "review", "improve", "repair"],
        "DECOMPOSE_PLAN_SOLVE" => &["decompose", "subproblem", "stages", "steps"],
        "FEW_SHOT" => &["example", "examples", "few_shot"],
        "ROLE_PERSONA" => &["role", "persona", "expertise"],
        "CONTEXTUAL" => &["context"],
        "STEP_BACK" => &["principles", "step_back"],
        _ => &[],
    }
}

fn plan_steps(kind: &str) -> Vec<Value> {
    let steps: &[&str] = match kind {
        "DIRECT" => &["understand", "produce"],
        "DECOMPOSE" => &["identify_subproblems", "solve_parts", "synthesize"],
        "RETRIEVE_THEN_REASON" => &[
            "identify_evidence_needs",
            "gather_allowed_evidence",
            "synthesize",
        ],
        "COMPARE" => &["define_criteria", "compare_candidates", "report"],
        "CRITIQUE_REVISE" => &["draft", "critique", "revise_once"],
        "PLAN_THEN_EXECUTE" => &["plan_steps", "prepare_execution_notes", "produce"],
        "STRUCTURED_ANALYSIS" => &["map_schema", "fill_fields", "validate_shape"],
        _ => &[],
    };
    steps.iter().map(|s| Value::String((*s).to_string())).collect()
}

fn instruction_mode(kind: &str) -> &'static str {
    match kind {
        "DIRECT" => "direct_instruction",
        "DECOMPOSE" => "decompose_then_solve",
        "RETRIEVE_THEN_REASON" => "evidence_then_synthesize",
        "COMPARE" => "compare_then_report",
        "CRITIQUE_REVISE" => "draft_critique_revise_once",
        "PLAN_THEN_EXECUTE" => "plan_then_produce",
        "STRUCTURED_ANALYSIS" => "schema_constrained",
        _ => "direct_instruction",
    }
}

fn implemented_xcat(id: &str) -> bool {
    matches!(id, "CAT:C01" | "CAT:C02" | "CAT:C03" | "CAT:C06" | "CAT:C07")
}

fn display_xcat(label: &str) -> Option<&'static str> {
    match label {
        "Research" => Some("CAT:C02"),
        "Analysis" => Some("CAT:C06"),
        _ => None,
    }
}

fn display_protocol(label: &str) -> Option<&'static str> {
    match label {
        "AI Assistant" => Some("general"),
        "Writing" => Some("writing_communication"),
        "Coding" => Some("coding"),
        "Research" => Some("research"),
        "Business" => Some("business_strategy"),
        "Education" => Some("education"),
        "Analysis" => Some("data_statistics"),
        "Structured Data" => Some("data_statistics"),
        "Creative" => Some("creative_media"),
        "Multilingual" => Some("translation_localization"),
        "Website / 3D" => Some("ux_ui_web_design"),
        "Image" => Some("image_generation"),
        "Video" => Some("video_generation"),
        _ => None,
    }
}

fn digest(payload: &Value, prefix: &str) -> Result<String, SpeError> {
    let text = canonical_dumps(payload)?;
    Ok(format!("{prefix}{}", sha256_hex(text.as_bytes())))
}

fn strip_opt(value: Option<&Value>) -> Option<String> {
    let text = value?.as_str()?.trim();
    if text.is_empty() {
        None
    } else {
        Some(text.to_string())
    }
}

fn bool_flag(value: Option<&Value>) -> Option<bool> {
    value.and_then(|v| v.as_bool())
}

fn obj<'a>(root: &'a Value, key: &str) -> Map<String, Value> {
    root.get(key)
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default()
}

fn kind_strength(kind: &str) -> &'static str {
    match kind {
        "MUST" | "MUST_NOT" => "MUST",
        "SHOULD" => "SHOULD",
        _ => "PREFERENCE",
    }
}

#[derive(Clone)]
struct Atom {
    requirement_id: String,
    semantic_key: String,
    kind: String,
}

fn atoms_from(task: &Map<String, Value>) -> Vec<Atom> {
    let Some(raw) = task.get("semantic_atoms").and_then(|v| v.as_array()) else {
        return Vec::new();
    };
    let mut atoms = Vec::new();
    for item in raw {
        let Some(obj) = item.as_object() else { continue };
        let rid = obj.get("requirement_id").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        let key = obj.get("semantic_key").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        let kind = obj.get("kind").and_then(|v| v.as_str()).unwrap_or("").trim().to_uppercase();
        if rid.is_empty() || key.is_empty() || !matches!(kind.as_str(), "MUST" | "MUST_NOT" | "SHOULD" | "PREFERENCE") {
            continue;
        }
        atoms.push(Atom { requirement_id: rid, semantic_key: key, kind });
    }
    atoms.sort_by(|a, b| a.requirement_id.cmp(&b.requirement_id));
    atoms
}

fn best_strength(atoms: &[Atom], technique: &str) -> (Option<String>, Vec<String>) {
    let tokens = key_hints(technique);
    if tokens.is_empty() {
        return (None, Vec::new());
    }
    let mut best: Option<String> = None;
    let mut refs = Vec::new();
    for atom in atoms {
        let key = atom.semantic_key.to_lowercase();
        if tokens.iter().any(|tok| key.contains(tok)) {
            let strength = kind_strength(&atom.kind).to_string();
            refs.push(atom.requirement_id.clone());
            let replace = match &best {
                None => true,
                Some(current) => strength_rank(&strength) < strength_rank(current),
            };
            if replace {
                best = Some(strength);
            }
        }
    }
    refs.sort();
    (best, refs)
}

fn resolve_strength(atoms: &[Atom], technique: &str, fallback: &str) -> (String, Vec<String>) {
    let (best, refs) = best_strength(atoms, technique);
    match best {
        Some(strength) => (strength, refs),
        None => (fallback.to_string(), Vec::new()),
    }
}

fn justification(technique: &str, reason: &str, refs: Vec<String>, strength: &str) -> Value {
    json!({
        "technique": technique,
        "reason_code": reason,
        "source_refs": refs,
        "strength": strength,
    })
}

fn protected_view(protected: &Map<String, Value>) -> Value {
    let goal = protected.get("goal").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let hard_constraints = protected.get("hard_constraints").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let facts = protected.get("facts").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let provenance = protected.get("provenance").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let budget = protected.get("budget").cloned().unwrap_or(Value::Null);
    let desired = protected.get("desired_output").cloned().unwrap_or(Value::Null);
    let authority = if let Some(auth) = protected.get("authority_state").and_then(|v| v.as_object()) {
        let level = auth.get("level").and_then(|v| v.as_i64()).unwrap_or(0);
        let status = auth.get("status").and_then(|v| v.as_str()).unwrap_or("NONE").to_string();
        let grants = auth.get("grants").and_then(|v| v.as_array()).map(|items| {
            items.iter().filter_map(|g| g.as_str().map(|s| Value::String(s.to_string()))).collect::<Vec<_>>()
        }).unwrap_or_default();
        json!({"level": level, "status": status, "grants": grants})
    } else {
        json!({"level": 0, "status": "NONE", "grants": []})
    };
    json!({
        "goal": goal,
        "hard_constraints": hard_constraints,
        "budget": budget,
        "desired_output": desired,
        "facts": facts,
        "authority_state": authority,
        "provenance": provenance,
    })
}

fn has_conflict(protected: &Map<String, Value>) -> bool {
    if let Some(conflicts) = protected.get("conflicts").and_then(|v| v.as_array()) {
        if !conflicts.is_empty() {
            return true;
        }
    }
    let Some(constraints) = protected.get("hard_constraints").and_then(|v| v.as_array()) else {
        return false;
    };
    for item in constraints {
        if let Some(obj) = item.as_object() {
            if let Some(statement) = obj.get("statement").and_then(|v| v.as_str()) {
                if statement.starts_with("[CONFLICT]") {
                    return true;
                }
            }
        } else if let Some(text) = item.as_str() {
            if text.starts_with("[CONFLICT]") {
                return true;
            }
        }
    }
    false
}

fn resolve_category(category: &Map<String, Value>, domains: &BTreeSet<String>) -> Value {
    let display = strip_opt(category.get("display_label"));
    let mut xcat = strip_opt(category.get("xcat_id"));
    let mut protocol = strip_opt(category.get("protocol_domain_id"));
    if xcat.is_none() {
        if let Some(label) = &display {
            if let Some(mapped) = display_xcat(label) {
                xcat = Some(mapped.to_string());
            }
        }
    }
    if protocol.is_none() {
        if let Some(label) = &display {
            if let Some(mapped) = display_protocol(label) {
                protocol = Some(mapped.to_string());
            }
        }
    }
    let implemented = xcat.as_ref().map(|id| implemented_xcat(id));
    let known = protocol.as_ref().map(|id| domains.contains(id));
    json!({
        "xcat_id": xcat,
        "xcat_implemented": implemented,
        "protocol_domain_id": protocol,
        "protocol_domain_known": known,
        "display_label": display,
    })
}

fn flag(task: &Map<String, Value>, name: &str, default: bool) -> bool {
    match bool_flag(task.get(name)) {
        Some(value) => value,
        None => default,
    }
}

fn resolve_task(task: &Map<String, Value>, xcat_id: Option<&str>) -> Value {
    let retrieval_default = xcat_id == Some("CAT:C02");
    let execution_default = xcat_id == Some("CAT:C07");
    let complexity_raw = task.get("complexity_class").and_then(|v| v.as_str()).unwrap_or("");
    let complexity = match complexity_raw.trim().to_uppercase().as_str() {
        "SIMPLE" | "STANDARD" | "COMPLEX" => complexity_raw.trim().to_uppercase(),
        _ => "STANDARD".to_string(),
    };
    let count = task.get("example_count").and_then(|v| v.as_i64()).unwrap_or(0).max(0);
    let role = task.get("role_label").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(|s| s.to_string());
    let atoms = atoms_from(task);
    let atom_values: Vec<Value> = atoms.iter().map(|atom| json!({
        "requirement_id": atom.requirement_id,
        "semantic_key": atom.semantic_key,
        "kind": atom.kind,
    })).collect();
    json!({
        "needs_decomposition": flag(task, "needs_decomposition", false),
        "needs_retrieval": flag(task, "needs_retrieval", retrieval_default),
        "needs_comparison": flag(task, "needs_comparison", false),
        "needs_revision": flag(task, "needs_revision", false),
        "needs_structured_output": flag(task, "needs_structured_output", false),
        "needs_examples": flag(task, "needs_examples", false),
        "needs_execution_prep": flag(task, "needs_execution_prep", execution_default),
        "has_context": flag(task, "has_context", false),
        "role_label": role,
        "example_count": count,
        "complexity_class": complexity,
        "force_zero_shot": task.get("force_zero_shot").and_then(|v| v.as_bool()) == Some(true),
        "ambiguous": task.get("ambiguous").and_then(|v| v.as_bool()) == Some(true),
        "semantic_atoms": atom_values,
    })
}

fn task_bool(task: &Value, key: &str) -> bool {
    task.get(key).and_then(|v| v.as_bool()).unwrap_or(false)
}

fn select_kind(task: &Value) -> (&'static str, &'static str) {
    if task_bool(task, "needs_retrieval") {
        return ("RETRIEVE_THEN_REASON", "HINT_NEEDS_RETRIEVAL");
    }
    if task_bool(task, "needs_comparison") {
        return ("COMPARE", "HINT_NEEDS_COMPARISON");
    }
    if task_bool(task, "needs_revision") {
        return ("CRITIQUE_REVISE", "HINT_NEEDS_REVISION");
    }
    if task_bool(task, "needs_decomposition") {
        return ("DECOMPOSE", "HINT_NEEDS_DECOMPOSITION");
    }
    if task_bool(task, "needs_execution_prep") {
        return ("PLAN_THEN_EXECUTE", "HINT_NEEDS_EXECUTION_PREP");
    }
    if task_bool(task, "needs_structured_output") && task.get("complexity_class").and_then(|v| v.as_str()) != Some("SIMPLE") {
        return ("STRUCTURED_ANALYSIS", "HINT_NEEDS_STRUCTURED_OUTPUT");
    }
    ("DIRECT", "HINT_DIRECT_DEFAULT")
}

fn envelope(
    disposition: &str,
    selection_id: String,
    cognitive_plan_id: Value,
    techniques: Vec<Value>,
    justifications: Vec<Value>,
    deferred: Vec<Value>,
    budget_truncated: bool,
    notes: Vec<Value>,
    strategy: Value,
    category_context: Value,
    protected_binding: Value,
    inputs_digest: String,
    task_resolved: Value,
) -> Value {
    json!({
        "schema_version": SCHEMA_VERSION,
        "selector_version": SELECTOR_VERSION,
        "selection_id": selection_id,
        "cognitive_plan_id": cognitive_plan_id,
        "disposition": disposition,
        "techniques": techniques,
        "justifications": justifications,
        "deferred_techniques": deferred,
        "budget_truncated": budget_truncated,
        "notes": notes,
        "claims_pass": false,
        "network_enabled": false,
        "execution_authorized": false,
        "credentials_granted": false,
        "sharing_approved": false,
        "external_write_authorized": false,
        "authority_effects": [],
        "category_context": category_context,
        "strategy": strategy,
        "protected_binding": protected_binding,
        "inputs_digest": inputs_digest,
        "task_resolved": task_resolved,
    })
}

fn closed(
    disposition: &str,
    notes: &[&str],
    category_context: Value,
    protected_binding: Value,
    inputs_digest: String,
    task_resolved: Value,
) -> Result<Value, SpeError> {
    let note_values: Vec<Value> = notes.iter().map(|n| Value::String((*n).to_string())).collect();
    let payload = json!({
        "schema_version": SCHEMA_VERSION,
        "cognitive_plan_id": Value::Null,
        "techniques": [],
        "justifications": [],
        "deferred_techniques": [],
        "budget_truncated": false,
        "notes": note_values,
    });
    let selection_id = digest(&payload, "tsel-")?;
    let notes_out = payload.get("notes").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    Ok(envelope(
        disposition,
        selection_id,
        Value::Null,
        Vec::new(),
        Vec::new(),
        Vec::new(),
        false,
        notes_out,
        Value::Null,
        category_context,
        protected_binding,
        inputs_digest,
        task_resolved,
    ))
}

fn strategy_of(
    plan_id: &str,
    plan_kind: &str,
    techniques: &[String],
    selection_id: &str,
    task: &Value,
    notes: &[String],
) -> Result<Value, SpeError> {
    let tech: BTreeSet<&str> = techniques.iter().map(|s| s.as_str()).collect();
    let context_mode = if tech.contains("CONTEXTUAL") || task_bool(task, "has_context") {
        "with_context"
    } else {
        "no_context"
    };
    let evidence_mode = if tech.contains("RETRIEVE_REASON") {
        "local_or_supplied_evidence_only"
    } else {
        "no_retrieval"
    };
    let example_mode = if tech.contains("FEW_SHOT") {
        "few_shot"
    } else if notes.iter().any(|n| n == "EXAMPLES_REQUIRED_BUT_MISSING") {
        "examples_required_missing"
    } else {
        "zero_shot"
    };
    let output_mode = if tech.contains("STRUCTURED_OUTPUT") { "structured" } else { "prose_or_unspecified" };
    let revision_mode = if tech.contains("CRITIQUE_REVISE") { "single_critique_revise" } else { "none" };
    let selected: Vec<Value> = techniques.iter().cloned().map(Value::String).collect();
    let payload = json!({
        "cognitive_plan_id": plan_id,
        "instruction_mode": instruction_mode(plan_kind),
        "context_mode": context_mode,
        "evidence_mode": evidence_mode,
        "example_mode": example_mode,
        "output_mode": output_mode,
        "revision_mode": revision_mode,
        "selected_technique_ids": selected,
        "technique_selection_id": selection_id,
        "schema_version": STRATEGY_SCHEMA_VERSION,
    });
    let strategy_id = digest(&payload, "pstrategy-")?;
    let mut out = payload.as_object().cloned().unwrap_or_default();
    out.insert("strategy_id".to_string(), Value::String(strategy_id));
    Ok(Value::Object(out))
}

fn candidates(task: &Value, atoms: &[Atom], plan_kind: &str, plan_ref: &str) -> Vec<Value> {
    let mut out = Vec::new();
    let needs_examples = task_bool(task, "needs_examples");
    let example_count = task.get("example_count").and_then(|v| v.as_i64()).unwrap_or(0);
    if needs_examples && example_count > 0 {
        let (strength, mut refs) = resolve_strength(atoms, "FEW_SHOT", "HINT");
        let mut all = vec![plan_ref.to_string(), "hint:needs_examples".to_string()];
        all.append(&mut refs);
        out.push(justification("FEW_SHOT", "EXAMPLES_SUPPLIED", all, &strength));
    } else if !needs_examples {
        out.push(justification("ZERO_SHOT", "NO_EXAMPLES_REQUIRED", vec![plan_ref.to_string()], "PLAN"));
    }
    if task_bool(task, "has_context") {
        let (strength, mut refs) = resolve_strength(atoms, "CONTEXTUAL", "HINT");
        let mut all = vec![plan_ref.to_string(), "hint:has_context".to_string()];
        all.append(&mut refs);
        out.push(justification("CONTEXTUAL", "CONTEXT_SUPPLIED", all, &strength));
    }
    if let Some(role) = task.get("role_label").and_then(|v| v.as_str()) {
        if !role.is_empty() {
            let (strength, mut refs) = resolve_strength(atoms, "ROLE_PERSONA", "HINT");
            let mut all = vec![plan_ref.to_string(), format!("hint:role_len:{}", role.chars().count())];
            all.append(&mut refs);
            out.push(justification("ROLE_PERSONA", "ROLE_LABEL_SUPPLIED", all, &strength));
        }
    }
    let complexity = task.get("complexity_class").and_then(|v| v.as_str()).unwrap_or("");
    if matches!(plan_kind, "DECOMPOSE" | "PLAN_THEN_EXECUTE" | "RETRIEVE_THEN_REASON") || complexity == "COMPLEX" {
        out.push(justification(
            "STEP_BACK",
            "PLAN_BENEFITS_FROM_PRINCIPLES_FIRST",
            vec![plan_ref.to_string(), format!("plan_kind:{plan_kind}")],
            "PLAN",
        ));
    }
    if matches!(plan_kind, "DECOMPOSE" | "PLAN_THEN_EXECUTE") {
        let (strength, mut refs) = resolve_strength(atoms, "DECOMPOSE_PLAN_SOLVE", "PLAN");
        let mut all = vec![plan_ref.to_string(), format!("plan_kind:{plan_kind}")];
        all.append(&mut refs);
        out.push(justification("DECOMPOSE_PLAN_SOLVE", "PLAN_REQUIRES_STAGED_SOLVE", all, &strength));
    }
    let requires_evidence = task_bool(task, "needs_retrieval") || plan_kind == "RETRIEVE_THEN_REASON";
    if requires_evidence {
        let (strength, mut refs) = resolve_strength(atoms, "RETRIEVE_REASON", "HINT");
        let mut all = vec![plan_ref.to_string(), "plan:requires_evidence".to_string()];
        all.append(&mut refs);
        out.push(justification("RETRIEVE_REASON", "EVIDENCE_OR_RESEARCH_REQUIRED", all, &strength));
    }
    if plan_kind == "CRITIQUE_REVISE" || task_bool(task, "needs_revision") {
        let (strength, mut refs) = resolve_strength(atoms, "CRITIQUE_REVISE", "HINT");
        let mut all = vec![plan_ref.to_string(), "hint:needs_revision".to_string()];
        all.append(&mut refs);
        out.push(justification("CRITIQUE_REVISE", "REVISION_REQUIRED", all, &strength));
    }
    let requires_structured = task_bool(task, "needs_structured_output") || plan_kind == "STRUCTURED_ANALYSIS";
    if requires_structured {
        let (strength, mut refs) = resolve_strength(atoms, "STRUCTURED_OUTPUT", "HINT");
        let mut all = vec![plan_ref.to_string(), "hint:needs_structured_output".to_string()];
        all.append(&mut refs);
        out.push(justification("STRUCTURED_OUTPUT", "STRUCTURED_OUTPUT_REQUIRED", all, &strength));
    }
    out
}

pub fn select(input: &Value) -> Result<Value, SpeError> {
    let root = input.as_object().cloned().unwrap_or_default();
    let protected = obj(&Value::Object(root.clone()), "protected");
    let category = obj(&Value::Object(root.clone()), "category");
    let task_map = obj(&Value::Object(root), "task");
    let domains: BTreeSet<String> = list_protocol_domains().into_iter().collect();
    let binding = protected_view(&protected);
    let context = resolve_category(&category, &domains);
    let xcat = context.get("xcat_id").and_then(|v| v.as_str()).map(|s| s.to_string());
    let resolved_for_digest = resolve_task(&task_map, xcat.as_deref());
    let inputs_digest = digest(
        &json!({"category": context.clone(), "task": resolved_for_digest}),
        "idigest-",
    )?;

    if let Some(id) = xcat.as_deref() {
        if !implemented_xcat(id) {
            return closed(
                "NO_SELECTION",
                &["NO_SELECTION", "CATEGORY_NOT_IMPLEMENTED", "UNKNOWN"],
                context,
                binding,
                inputs_digest,
                json!({}),
            );
        }
    }
    if context.get("protocol_domain_id").and_then(|v| v.as_str()).is_some()
        && context.get("protocol_domain_known").and_then(|v| v.as_bool()) == Some(false)
    {
        return closed(
            "UNKNOWN",
            &["UNKNOWN", "PROTOCOL_DOMAIN_UNKNOWN"],
            context,
            binding,
            inputs_digest,
            json!({}),
        );
    }
    if has_conflict(&protected) {
        return closed(
            "UNKNOWN",
            &["UNKNOWN", "CONFLICTING_INPUTS"],
            context,
            binding,
            inputs_digest,
            json!({}),
        );
    }

    let resolved = resolve_task(&task_map, xcat.as_deref());
    if task_bool(&resolved, "ambiguous") {
        return closed("UNKNOWN", &["UNKNOWN", "AMBIGUOUS_TASK"], context, binding, inputs_digest, resolved);
    }
    if task_bool(&resolved, "force_zero_shot") && task_bool(&resolved, "needs_examples") {
        return closed("UNKNOWN", &["UNKNOWN", "CONFLICTING_INPUTS"], context, binding, inputs_digest, resolved);
    }

    let atoms = atoms_from(&task_map);
    let (plan_kind, plan_reason) = select_kind(&resolved);
    let req_ids: Vec<Value> = atoms.iter().map(|a| Value::String(a.requirement_id.clone())).collect();
    let protected_ids: Vec<Value> = atoms.iter().filter(|a| a.kind == "MUST" || a.kind == "MUST_NOT").map(|a| Value::String(a.requirement_id.clone())).collect();
    let requires_evidence = task_bool(&resolved, "needs_retrieval") || plan_kind == "RETRIEVE_THEN_REASON";
    let requires_structured = task_bool(&resolved, "needs_structured_output") || plan_kind == "STRUCTURED_ANALYSIS";
    let plan_stub = json!({
        "plan_kind": plan_kind,
        "requirement_ids": req_ids,
        "ordered_steps": plan_steps(plan_kind),
        "reason_codes": [plan_reason],
        "complexity_class": resolved.get("complexity_class").cloned().unwrap_or(Value::String("STANDARD".into())),
        "requires_evidence": requires_evidence,
        "requires_examples": task_bool(&resolved, "needs_examples"),
        "requires_structured_output": requires_structured,
        "protected_requirement_ids": protected_ids,
        "schema_version": PLAN_SCHEMA_VERSION,
    });
    let plan_id = digest(&plan_stub, "cplan-")?;
    let plan_ref = format!("plan:{plan_id}");
    let mut extra_notes: Vec<String> = Vec::new();
    if task_bool(&resolved, "needs_examples") && resolved.get("example_count").and_then(|v| v.as_i64()).unwrap_or(0) <= 0 {
        extra_notes.push("EXAMPLES_REQUIRED_BUT_MISSING".to_string());
    }
    let raw = candidates(&resolved, &atoms, plan_kind, &plan_ref);
    let mut seen = BTreeSet::new();
    let mut unique: Vec<Value> = Vec::new();
    for item in raw {
        let tech = item.get("technique").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if seen.contains(&tech) {
            continue;
        }
        if priority(&tech) == 100 {
            return closed("UNKNOWN", &["UNKNOWN", "INVALID_TECHNIQUE"], context, binding, inputs_digest, resolved);
        }
        seen.insert(tech);
        unique.push(item);
    }
    if seen.contains("ZERO_SHOT") && seen.contains("FEW_SHOT") {
        return closed("UNKNOWN", &["UNKNOWN", "K3_TECHNIQUE_INCOMPATIBLE"], context, binding, inputs_digest, resolved);
    }
    unique.sort_by(|a, b| {
        let sa = a.get("strength").and_then(|v| v.as_str()).unwrap_or("");
        let sb = b.get("strength").and_then(|v| v.as_str()).unwrap_or("");
        let ta = a.get("technique").and_then(|v| v.as_str()).unwrap_or("");
        let tb = b.get("technique").and_then(|v| v.as_str()).unwrap_or("");
        (strength_rank(sa), priority(ta), ta).cmp(&(strength_rank(sb), priority(tb), tb))
    });
    let budget_truncated = unique.len() > STANDARD_MAX;
    let kept: Vec<Value> = unique.iter().take(STANDARD_MAX).cloned().collect();
    let deferred: Vec<String> = unique.iter().skip(STANDARD_MAX).filter_map(|item| item.get("technique").and_then(|v| v.as_str()).map(|s| s.to_string())).collect();
    if budget_truncated {
        extra_notes.push(format!("BUDGET_TRUNCATED_MAX_{STANDARD_MAX}"));
        let kept_ranks: Vec<i32> = kept.iter().filter_map(|item| item.get("strength").and_then(|v| v.as_str()).map(strength_rank)).collect();
        for item in unique.iter().skip(STANDARD_MAX) {
            if item.get("strength").and_then(|v| v.as_str()) == Some("MUST") && kept_ranks.iter().any(|rank| *rank > strength_rank("MUST")) {
                return closed("UNKNOWN", &["UNKNOWN", "K3_STRATEGY_INVARIANT_VIOLATION"], context, binding, inputs_digest, resolved);
            }
        }
    }
    let techniques: Vec<String> = kept.iter().filter_map(|item| item.get("technique").and_then(|v| v.as_str()).map(|s| s.to_string())).collect();
    if techniques.is_empty() {
        let mut notes = vec!["UNKNOWN".to_string()];
        notes.extend(extra_notes);
        let note_refs: Vec<&str> = notes.iter().map(|s| s.as_str()).collect();
        return closed("UNKNOWN", &note_refs, context, binding, inputs_digest, resolved);
    }
    let safe = plan_kind == "DIRECT"
        && techniques.len() == 1
        && techniques[0] == "ZERO_SHOT"
        && !budget_truncated
        && extra_notes.is_empty();
    let disposition = if safe { "SAFE_DEFAULT" } else { "SELECTED" };
    let mut full_notes = vec![disposition.to_string(), plan_reason.to_string()];
    full_notes.extend(extra_notes);
    let note_values: Vec<Value> = full_notes.iter().cloned().map(Value::String).collect();
    let tech_values: Vec<Value> = techniques.iter().cloned().map(Value::String).collect();
    let deferred_values: Vec<Value> = deferred.iter().cloned().map(Value::String).collect();
    let payload = json!({
        "schema_version": SCHEMA_VERSION,
        "cognitive_plan_id": plan_id,
        "techniques": tech_values,
        "justifications": kept,
        "deferred_techniques": deferred_values,
        "budget_truncated": budget_truncated,
        "notes": note_values,
    });
    let selection_id = digest(&payload, "tsel-")?;
    let strategy = strategy_of(&plan_id, plan_kind, &techniques, &selection_id, &resolved, &full_notes)?;
    let notes_out = payload.get("notes").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let techniques_out = payload.get("techniques").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let just_out = payload.get("justifications").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let deferred_out = payload.get("deferred_techniques").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    Ok(envelope(
        disposition,
        selection_id,
        Value::String(plan_id),
        techniques_out,
        just_out,
        deferred_out,
        budget_truncated,
        notes_out,
        strategy,
        context,
        binding,
        inputs_digest,
        resolved,
    ))
}

pub fn evaluate(input: &Value) -> Result<Value, SpeError> {
    if !input.is_object() {
        return Err(SpeError::new("PORTABILITY_INVALID_FIXTURE", "k3 input must be an object"));
    }
    select(input)
}
