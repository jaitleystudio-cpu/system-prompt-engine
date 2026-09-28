//! K1 Requirement Graph. Python `build_requirement_graph` is the semantic oracle.

use crate::reasons::SpeError;
use crate::sha256_lite::sha256_hex;
use crate::value::canonical_dumps;
use crate::value::canonicalize;
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;

const SCHEMA_VERSION: &str = "requirement_graph.g1r3";
const EXPLICIT_BUDGET_REF: &str = "explicit-budget";

struct Atom {
    requirement_id: String,
    semantic_key: String,
    kind: String,
    value: Value,
    provenance: String,
    source_ref: Option<String>,
    statement: Option<String>,
}

impl Atom {
    fn to_json(&self) -> Value {
        json!({
            "requirement_id": self.requirement_id,
            "semantic_key": self.semantic_key,
            "kind": self.kind,
            "value": self.value,
            "provenance": self.provenance,
            "source_ref": self.source_ref.clone().map(Value::String).unwrap_or(Value::Null),
            "statement": self.statement.clone().map(Value::String).unwrap_or(Value::Null),
        })
    }
}

fn digest_hex(payload: &Value) -> Result<String, SpeError> {
    let text = canonical_dumps(payload)?;
    Ok(sha256_hex(text.as_bytes()))
}

fn requirement_id(
    semantic_key: &str,
    kind: &str,
    value: &Value,
    source_ref: Option<&str>,
) -> Result<String, SpeError> {
    let payload = json!({
        "semantic_key": semantic_key,
        "kind": kind,
        "value": value,
        "source_ref": source_ref.map(|text| Value::String(text.to_string())).unwrap_or(Value::Null),
    });
    Ok(format!("req-{}", &digest_hex(&payload)?[..32]))
}

fn conflict_identity(conflict_type: &str, left: &str, right: &str) -> Result<String, SpeError> {
    let mut pair = [left, right];
    pair.sort();
    let payload = json!({
        "conflict_type": conflict_type,
        "left": pair[0],
        "right": pair[1],
    });
    Ok(format!("cnf-{}", &digest_hex(&payload)?[..32]))
}

fn is_known_provenance(value: &str) -> bool {
    matches!(
        value,
        "USER_EXPLICIT"
            | "USER_CONFIRMED"
            | "SYSTEM_REQUIRED"
            | "INFERRED"
            | "MODEL_PROPOSED"
            | "SPE_SUGGESTED"
            | "EXTERNAL_EVIDENCE"
            | "UNKNOWN"
    )
}

fn is_protected(provenance: &str) -> bool {
    matches!(provenance, "USER_EXPLICIT" | "USER_CONFIRMED" | "SYSTEM_REQUIRED")
}

fn is_example(value: &Value) -> bool {
    let markers = ["EXAMPLE / USER_SUPPLIED", "NON-AUTHORITATIVE"];
    let blob = match value {
        Value::String(text) => text.clone(),
        Value::Object(map) => ["classification", "statement", "text", "label"]
            .iter()
            .filter_map(|key| map.get(*key).and_then(|v| v.as_str()))
            .collect::<Vec<_>>()
            .join(" "),
        _ => return false,
    };
    markers.iter().any(|marker| blob.contains(marker))
}

fn source_provenance(record: &Map<String, Value>) -> String {
    if let Some(explicit) = record.get("provenance").and_then(|v| v.as_str()) {
        if is_known_provenance(explicit) {
            return explicit.to_string();
        }
    }
    let Some(source) = record.get("source").and_then(|v| v.as_str()) else {
        return "UNKNOWN".to_string();
    };
    if source.trim().is_empty() {
        return "UNKNOWN".to_string();
    }
    if source.to_lowercase().contains("user") {
        "USER_EXPLICIT".to_string()
    } else {
        "EXTERNAL_EVIDENCE".to_string()
    }
}

fn as_array(value: Option<&Value>) -> Vec<Value> {
    value.and_then(|v| v.as_array()).cloned().unwrap_or_default()
}

fn nonempty_str(value: Option<&Value>) -> Option<String> {
    let text = value?.as_str()?;
    if text.trim().is_empty() {
        None
    } else {
        Some(text.to_string())
    }
}

fn statement_of(item: &Map<String, Value>) -> Option<String> {
    if let Some(text) = item.get("statement").and_then(|v| v.as_str()) {
        return Some(text.to_string());
    }
    item.get("description").and_then(|v| v.as_str()).map(|s| s.to_string())
}

fn id_ref(item: &Map<String, Value>, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(text) = item.get(*key).and_then(|v| v.as_str()) {
            if !text.is_empty() {
                return Some(text.to_string());
            }
        }
    }
    None
}

fn make_atom(
    semantic_key: &str,
    kind: &str,
    value: &Value,
    provenance: &str,
    source_ref: Option<&str>,
    statement: Option<String>,
) -> Result<Atom, SpeError> {
    let stored = canonicalize(value)?;
    let requirement_id = requirement_id(semantic_key, kind, &stored, source_ref)?;
    Ok(Atom {
        requirement_id,
        semantic_key: semantic_key.to_string(),
        kind: kind.to_string(),
        value: stored,
        provenance: provenance.to_string(),
        source_ref: source_ref.map(|s| s.to_string()),
        statement,
    })
}

fn insert_atom(atoms: &mut BTreeMap<String, Atom>, atom: Atom) {
    match atoms.get(&atom.requirement_id) {
        None => {
            atoms.insert(atom.requirement_id.clone(), atom);
        }
        Some(existing) if atom_eq(existing, &atom) => {}
        Some(existing)
            if is_protected(&existing.provenance) && !is_protected(&atom.provenance) => {}
        Some(existing) if is_protected(&atom.provenance) && !is_protected(&existing.provenance) => {
            atoms.insert(atom.requirement_id.clone(), atom);
        }
        Some(_) => {}
    }
}

fn atom_eq(left: &Atom, right: &Atom) -> bool {
    left.requirement_id == right.requirement_id
        && left.semantic_key == right.semantic_key
        && left.kind == right.kind
        && left.value == right.value
        && left.provenance == right.provenance
        && left.source_ref == right.source_ref
        && left.statement == right.statement
}

fn statement_ref(text: &str) -> Result<String, SpeError> {
    let digest = digest_hex(&Value::String(text.to_string()))?;
    Ok(format!("stmt-{}", &digest[..16]))
}

fn hard_key(explicit: Option<&str>, source_ref: &str) -> String {
    match explicit {
        Some(key) => key.to_string(),
        None => format!("hard_constraint:{source_ref}"),
    }
}

fn hard_kind(item: &Map<String, Value>) -> &'static str {
    if item
        .get("kind")
        .and_then(|v| v.as_str())
        .map(|kind| kind.trim().eq_ignore_ascii_case("MUST_NOT"))
        .unwrap_or(false)
    {
        "MUST_NOT"
    } else {
        "MUST"
    }
}

struct Conflict {
    conflict_id: String,
    left_requirement_id: String,
    right_requirement_id: String,
    conflict_type: String,
    severity: String,
    summary: String,
}

impl Conflict {
    fn to_json(&self) -> Value {
        json!({
            "conflict_id": self.conflict_id,
            "left_requirement_id": self.left_requirement_id,
            "right_requirement_id": self.right_requirement_id,
            "conflict_type": self.conflict_type,
            "severity": self.severity,
            "resolution_state": "UNRESOLVED",
            "summary": self.summary,
        })
    }
}

fn ordered_pair<'a>(left: &'a Atom, right: &'a Atom) -> (&'a Atom, &'a Atom) {
    if left.requirement_id <= right.requirement_id {
        (left, right)
    } else {
        (right, left)
    }
}

fn make_conflict(left: &Atom, right: &Atom, conflict_type: &str) -> Result<Conflict, SpeError> {
    let (first, second) = ordered_pair(left, right);
    let conflict_id = conflict_identity(conflict_type, &first.requirement_id, &second.requirement_id)?;
    Ok(Conflict {
        conflict_id,
        left_requirement_id: first.requirement_id.clone(),
        right_requirement_id: second.requirement_id.clone(),
        conflict_type: conflict_type.to_string(),
        severity: "HARD".to_string(),
        summary: format!(
            "{conflict_type}:{}|{}",
            first.requirement_id, second.requirement_id
        ),
    })
}

fn marker_conflict(atom: &Atom) -> Result<Conflict, SpeError> {
    let conflict_id = conflict_identity(
        "EXPLICIT_CONFIRMED",
        &atom.requirement_id,
        &atom.requirement_id,
    )?;
    Ok(Conflict {
        conflict_id,
        left_requirement_id: atom.requirement_id.clone(),
        right_requirement_id: atom.requirement_id.clone(),
        conflict_type: "EXPLICIT_CONFIRMED".to_string(),
        severity: "HARD".to_string(),
        summary: atom.statement.clone().unwrap_or_else(|| "EXPLICIT_CONFIRMED".to_string()),
    })
}

fn detect_conflicts(nodes: &[Atom], extra: Vec<Conflict>) -> Result<Vec<Conflict>, SpeError> {
    let mut found: BTreeMap<String, Conflict> = BTreeMap::new();
    for record in extra {
        found.insert(record.conflict_id.clone(), record);
    }
    for index in 0..nodes.len() {
        for right_index in (index + 1)..nodes.len() {
            let left = &nodes[index];
            let right = &nodes[right_index];
            if left.requirement_id == right.requirement_id || left.semantic_key != right.semantic_key {
                continue;
            }
            if left.kind == "PREFERENCE" && right.kind == "PREFERENCE" {
                continue;
            }
            if ((left.kind == "MUST" && right.kind == "MUST_NOT")
                || (left.kind == "MUST_NOT" && right.kind == "MUST"))
                && left.value == right.value
            {
                let record = make_conflict(left, right, "MUST_MUST_NOT")?;
                found.insert(record.conflict_id.clone(), record);
                continue;
            }
            if left.kind == "MUST" && right.kind == "MUST" && left.value != right.value {
                let mixed = (is_protected(&left.provenance) && !is_protected(&right.provenance))
                    || (is_protected(&right.provenance) && !is_protected(&left.provenance));
                let explicit_confirmed = matches!(
                    (left.provenance.as_str(), right.provenance.as_str()),
                    ("USER_EXPLICIT", "USER_CONFIRMED") | ("USER_CONFIRMED", "USER_EXPLICIT")
                );
                let conflict_type = if mixed {
                    "INFERENCE_CONFLICT"
                } else if explicit_confirmed {
                    "EXPLICIT_CONFIRMED"
                } else {
                    "MUTUALLY_EXCLUSIVE"
                };
                let record = make_conflict(left, right, conflict_type)?;
                found.insert(record.conflict_id.clone(), record);
                continue;
            }
            if left.value != right.value
                && ((is_protected(&left.provenance) && !is_protected(&right.provenance))
                    || (is_protected(&right.provenance) && !is_protected(&left.provenance)))
            {
                let record = make_conflict(left, right, "INFERENCE_CONFLICT")?;
                found.insert(record.conflict_id.clone(), record);
            }
        }
    }
    Ok(found.into_values().collect())
}

fn edge_id(left: &str, right: &str) -> String {
    let mut pair = [left, right];
    pair.sort();
    format!("edge-CONFLICTS_WITH-{}-{}", pair[0], pair[1])
}

pub fn build(protected: &Value, category: &Value) -> Result<Value, SpeError> {
    let source = protected.as_object();
    let mut atoms: BTreeMap<String, Atom> = BTreeMap::new();
    let mut markers: Vec<String> = Vec::new();

    if let Some(goal) = nonempty_str(source.and_then(|map| map.get("goal"))) {
        let atom = make_atom(
            "goal",
            "MUST",
            &Value::String(goal.clone()),
            "USER_EXPLICIT",
            None,
            Some(goal),
        )?;
        insert_atom(&mut atoms, atom);
    }

    for item in as_array(source.and_then(|map| map.get("hard_constraints"))) {
        if let Some(text) = nonempty_str(Some(&item)) {
            let source_ref = statement_ref(&text)?;
            let key = hard_key(None, &source_ref);
            let atom = make_atom(
                &key,
                "MUST",
                &Value::String(text.clone()),
                "USER_EXPLICIT",
                Some(&source_ref),
                Some(text.clone()),
            )?;
            if text.starts_with("[CONFLICT]") {
                markers.push(atom.requirement_id.clone());
            }
            insert_atom(&mut atoms, atom);
        } else if let Some(map) = item.as_object() {
            let statement = statement_of(map);
            let explicit = map
                .get("semantic_key")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|text| !text.is_empty());
            let mut source_ref = id_ref(map, &["constraint_id", "source_ref"]);
            if source_ref.is_none() {
                let digest = if let Some(text) = &statement {
                    digest_hex(&Value::String(text.clone()))?
                } else {
                    let object_json = canonical_dumps(&Value::Object(map.clone()))?;
                    digest_hex(&Value::String(object_json))?
                };
                source_ref = Some(format!("stmt-{}", &digest[..16]));
            }
            let source_ref = source_ref.unwrap();
            let key = hard_key(explicit, &source_ref);
            let value = if map.contains_key("value") {
                map.get("value").cloned().unwrap_or(Value::Null)
            } else if let Some(text) = &statement {
                Value::String(text.clone())
            } else {
                Value::Object(map.clone())
            };
            let provenance = map
                .get("provenance")
                .and_then(|v| v.as_str())
                .filter(|text| is_known_provenance(text))
                .unwrap_or("USER_EXPLICIT");
            let atom = make_atom(
                &key,
                hard_kind(map),
                &value,
                provenance,
                Some(&source_ref),
                statement.clone(),
            )?;
            if statement.as_deref().unwrap_or("").starts_with("[CONFLICT]") {
                markers.push(atom.requirement_id.clone());
            }
            insert_atom(&mut atoms, atom);
        }
    }

    let budget_present = source
        .and_then(|map| map.get("budget"))
        .map(|value| !value.is_null())
        .unwrap_or(false);
    let input_budget = if budget_present {
        canonicalize(source.and_then(|map| map.get("budget")).unwrap_or(&Value::Null))?
    } else {
        Value::Null
    };
    if budget_present {
        let budget_statement = if let Value::String(text) = &input_budget {
            Some(text.clone())
        } else if let Some(text) = input_budget.get("text").and_then(|v| v.as_str()) {
            Some(text.to_string())
        } else {
            None
        };
        insert_atom(
            &mut atoms,
            make_atom(
                "budget",
                "MUST",
                &input_budget,
                "USER_EXPLICIT",
                Some(EXPLICIT_BUDGET_REF),
                budget_statement,
            )?,
        );
    }

    if let Some(desired) = source.and_then(|map| map.get("desired_output")) {
        if !desired.is_null() {
            if is_example(desired) {
                let statement = desired.as_str().map(|s| s.to_string());
                insert_atom(
                    &mut atoms,
                    make_atom(
                        "user_supplied_pattern",
                        "PREFERENCE",
                        desired,
                        "USER_EXPLICIT",
                        Some("desired-output"),
                        statement,
                    )?,
                );
            } else {
                let statement = desired.as_str().map(|s| s.to_string());
                insert_atom(
                    &mut atoms,
                    make_atom(
                        "desired_output",
                        "MUST",
                        desired,
                        "USER_EXPLICIT",
                        Some("desired-output"),
                        statement,
                    )?,
                );
            }
        }
    }

    let provenance_records = as_array(source.and_then(|map| map.get("provenance")));
    let mut provenance_index: BTreeMap<String, Map<String, Value>> = BTreeMap::new();
    for record in &provenance_records {
        if let Some(map) = record.as_object() {
            if let Some(id) = map.get("provenance_id").and_then(|v| v.as_str()) {
                provenance_index.insert(id.to_string(), map.clone());
            }
            insert_atom(
                &mut atoms,
                make_atom(
                    "provenance_record",
                    "SHOULD",
                    record,
                    &source_provenance(map),
                    id_ref(map, &["provenance_id", "source_ref"]).as_deref(),
                    None,
                )?,
            );
        }
    }

    for fact in as_array(source.and_then(|map| map.get("facts"))) {
        let Some(map) = fact.as_object() else { continue };
        let provenance = if let Some(explicit) = map.get("provenance").and_then(|v| v.as_str()) {
            if is_known_provenance(explicit) {
                explicit.to_string()
            } else {
                fact_provenance(map, &provenance_index)
            }
        } else {
            fact_provenance(map, &provenance_index)
        };
        insert_atom(
            &mut atoms,
            make_atom(
                "fact",
                "SHOULD",
                &fact,
                &provenance,
                id_ref(map, &["fact_id", "source_ref"]).as_deref(),
                statement_of(map),
            )?,
        );
    }

    for unknown in as_array(source.and_then(|map| map.get("uncertainties"))) {
        if let Some(text) = nonempty_str(Some(&unknown)) {
            insert_atom(
                &mut atoms,
                make_atom(
                    "unknown",
                    "SHOULD",
                    &Value::String(text.clone()),
                    "UNKNOWN",
                    None,
                    Some(text),
                )?,
            );
        } else if let Some(map) = unknown.as_object() {
            insert_atom(
                &mut atoms,
                make_atom(
                    "unknown",
                    "SHOULD",
                    &unknown,
                    "UNKNOWN",
                    id_ref(map, &["uncertainty_id", "source_ref"]).as_deref(),
                    statement_of(map),
                )?,
            );
        }
    }

    for preference in as_array(source.and_then(|map| map.get("user_preferences"))) {
        if let Some(text) = nonempty_str(Some(&preference)) {
            let example = is_example(&Value::String(text.clone()));
            insert_atom(
                &mut atoms,
                make_atom(
                    if example { "user_supplied_pattern" } else { "user_preference" },
                    "PREFERENCE",
                    &Value::String(text.clone()),
                    "USER_EXPLICIT",
                    None,
                    Some(text),
                )?,
            );
        } else if let Some(map) = preference.as_object() {
            let statement = statement_of(map);
            let example = is_example(&preference)
                || statement.as_deref().map(|text| is_example(&Value::String(text.to_string()))).unwrap_or(false);
            insert_atom(
                &mut atoms,
                make_atom(
                    if example { "user_supplied_pattern" } else { "user_preference" },
                    "PREFERENCE",
                    &preference,
                    "USER_EXPLICIT",
                    id_ref(map, &["preference_id", "source_ref"]).as_deref(),
                    statement,
                )?,
            );
        }
    }

    for criterion in as_array(source.and_then(|map| map.get("acceptance_criteria"))) {
        if let Some(text) = nonempty_str(Some(&criterion)) {
            insert_atom(
                &mut atoms,
                make_atom(
                    "acceptance_criterion",
                    "MUST",
                    &Value::String(text.clone()),
                    "USER_EXPLICIT",
                    None,
                    Some(text),
                )?,
            );
        } else if let Some(map) = criterion.as_object() {
            insert_atom(
                &mut atoms,
                make_atom(
                    "acceptance_criterion",
                    "MUST",
                    &criterion,
                    "USER_EXPLICIT",
                    id_ref(map, &["criterion_id", "source_ref"]).as_deref(),
                    statement_of(map),
                )?,
            );
        }
    }

    for (offset, item) in as_array(source.and_then(|map| map.get("conflicts"))).into_iter().enumerate() {
        if let Some(text) = nonempty_str(Some(&item)) {
            let statement = if text.starts_with("[CONFLICT]") {
                text
            } else {
                format!("[CONFLICT] {text}")
            };
            let source_ref = format!("conflict-{offset}");
            let key = hard_key(None, &source_ref);
            let atom = make_atom(
                &key,
                "MUST",
                &Value::String(statement.clone()),
                "USER_EXPLICIT",
                Some(&source_ref),
                Some(statement),
            )?;
            markers.push(atom.requirement_id.clone());
            insert_atom(&mut atoms, atom);
        } else if let Some(map) = item.as_object() {
            let raw = statement_of(map).unwrap_or_default();
            let statement = if raw.is_empty() {
                None
            } else if raw.starts_with("[CONFLICT]") {
                Some(raw)
            } else {
                Some(format!("[CONFLICT] {raw}"))
            };
            let source_ref = id_ref(map, &["constraint_id", "source_ref"]).unwrap_or_else(|| format!("conflict-{offset}"));
            let key = hard_key(None, &source_ref);
            let atom = make_atom(
                &key,
                "MUST",
                &item,
                "USER_EXPLICIT",
                Some(&source_ref),
                statement,
            )?;
            markers.push(atom.requirement_id.clone());
            insert_atom(&mut atoms, atom);
        }
    }

    for (offset, trace) in as_array(source.and_then(|map| map.get("category_trace"))).into_iter().enumerate() {
        if trace.as_object().is_none() {
            continue;
        }
        let source_ref = format!("category-trace-{offset}");
        insert_atom(
            &mut atoms,
            make_atom(
                "category_ref",
                "PREFERENCE",
                &trace,
                "USER_EXPLICIT",
                Some(&source_ref),
                None,
            )?,
        );
    }

    if let Some(map) = category.as_object() {
        let mut fields = Map::new();
        for key in ["xcat_id", "protocol_domain_id", "display_label"] {
            if let Some(text) = map.get(key).and_then(|v| v.as_str()) {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    fields.insert(key.to_string(), Value::String(trimmed.to_string()));
                }
            }
        }
        if !fields.is_empty() {
            insert_atom(
                &mut atoms,
                make_atom(
                    "category_ref",
                    "PREFERENCE",
                    &Value::Object(fields),
                    "USER_EXPLICIT",
                    Some("category"),
                    None,
                )?,
            );
        }
    }

    let nodes: Vec<Atom> = atoms.into_values().collect();
    let mut extra = Vec::new();
    for marker in &markers {
        if let Some(atom) = nodes.iter().find(|atom| atom.requirement_id == *marker) {
            extra.push(marker_conflict(atom)?);
        }
    }
    let conflicts = detect_conflicts(&nodes, extra)?;
    let mut edges: BTreeMap<String, Value> = BTreeMap::new();
    for record in &conflicts {
        let id = edge_id(&record.left_requirement_id, &record.right_requirement_id);
        edges.entry(id).or_insert_with(|| {
            json!({
                "edge_type": "CONFLICTS_WITH",
                "left_id": record.left_requirement_id,
                "right_id": record.right_requirement_id,
                "meta": {
                    "conflict_id": record.conflict_id,
                    "conflict_type": record.conflict_type,
                }
            })
        });
    }
    let mut node_map = Map::new();
    let mut budget_values = Vec::new();
    for atom in &nodes {
        if atom.semantic_key == "budget" {
            budget_values.push(atom.value.clone());
        }
        node_map.insert(atom.requirement_id.clone(), atom.to_json());
    }
    let mut edge_map = Map::new();
    for (id, edge) in &edges {
        edge_map.insert(id.clone(), edge.clone());
    }
    let validity = if nodes.is_empty() {
        "INCOMPLETE"
    } else if conflicts.iter().any(|record| record.severity == "HARD") {
        "CONFLICTED"
    } else {
        "VALID"
    };
    let graph = json!({"nodes": node_map, "edges": edge_map});
    let graph_digest = format!("rg-{}", digest_hex(&graph)?);
    let bound = if budget_present { input_budget } else { Value::Null };
    let node_ids: Vec<Value> = nodes.iter().map(|atom| Value::String(atom.requirement_id.clone())).collect();
    let edge_ids: Vec<Value> = edges.keys().map(|id| Value::String(id.clone())).collect();
    let conflict_values: Vec<Value> = conflicts.iter().map(Conflict::to_json).collect();
    Ok(json!({
        "schema_version": SCHEMA_VERSION,
        "validity": validity,
        "graph_digest": graph_digest,
        "input_budget": bound.clone(),
        "graph_budget": bound.clone(),
        "output_bound_budget": bound,
        "budget_values": budget_values,
        "conflicts": conflict_values,
        "graph": graph,
        "node_ids": node_ids,
        "edge_ids": edge_ids,
    }))
}

fn fact_provenance(fact: &Map<String, Value>, index: &BTreeMap<String, Map<String, Value>>) -> String {
    let Some(linked) = fact.get("provenance_ids").and_then(|v| v.as_array()) else {
        return "UNKNOWN".to_string();
    };
    let mut saw_external = false;
    for item in linked {
        let Some(id) = item.as_str() else { continue };
        let Some(record) = index.get(id) else { continue };
        let provenance = source_provenance(record);
        if provenance == "USER_EXPLICIT" {
            return provenance;
        }
        if provenance == "EXTERNAL_EVIDENCE" {
            saw_external = true;
        }
    }
    if saw_external {
        "EXTERNAL_EVIDENCE".to_string()
    } else if linked.iter().any(|item| item.as_str().map(|id| index.contains_key(id)).unwrap_or(false)) {
        "UNKNOWN".to_string()
    } else {
        "UNKNOWN".to_string()
    }
}

pub fn evaluate(input: &Value) -> Result<Value, SpeError> {
    let protected = input.get("protected").cloned().unwrap_or_else(|| json!({}));
    let category = input.get("category").cloned().unwrap_or(Value::Null);
    build(&protected, &category)
}
