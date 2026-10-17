//! Context grounding contracts — need compilation, firewall, freshness.
//! Mirrors `spe_runtime.grounding` for portable parity. No network.

use crate::reasons::{SpeError, PORTABILITY_INVALID_FIXTURE};
use crate::sha256_lite::sha256_hex;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::OnceLock;

const PROFILES_JSON: &str = include_str!("../../../data/grounding/domain_profiles.json");
const RECIPES_JSON: &str = include_str!("../../../data/grounding/context_recipes.json");
const POLICIES_JSON: &str = include_str!("../../../data/grounding/source_policies.json");

const FORBIDDEN_PAYLOAD_KEYS: &[&str] = &[
    "EXECUTED", "PROMOTE", "VERIFIED_SUCCESS", "authority", "execution_grant", "permit",
    "permits", "receipt", "receipts", "verified_outcome", "verified_success",
];

const CITATION_FORGERY_KEYS: &[&str] = &[
    "verified_citation", "citation_authority", "authority_label", "mint_authority",
    "peer_review_badge", "is_authoritative",
];

const ALLOWED_AUTHORITY: &[&str] = &["REFERENCE", "DATA", "OBSERVATION", "NONE"];

const ROUTE_RULES: &[(&str, &[&str], &str)] = &[
    ("writing_communication", &["birthday", "happy birthday", "congratulat", "thank-you note", "thank you note"], "recipe.none.local_only"),
    ("personal_planning", &["grocery list", "packing list", "reminder to", "to-do list", "todo list"], "recipe.personal.local_only"),
    ("coding", &["react", "migrate", "typescript", "javascript", "api migration", "latest api", "framework", "npm package", "python package", "sdk", "library docs"], "recipe.coding.official_docs"),
    ("debugging", &["stack trace", "segfault", "nullpointer", "bugfix", "debug this"], "recipe.coding.official_docs"),
    ("research", &["research whether", "research if", "systematic review", "peer-reviewed", "peer reviewed", "meta-analysis", "empirical evidence", "affects sleep", "blue light"], "recipe.research.scholarly"),
    ("health_information", &["symptom", "diagnosis", "treatment guideline", "medical advice"], "recipe.research.scholarly"),
    ("news_current", &["breaking news", "today's news", "current events", "latest headlines"], "recipe.general.default"),
];


#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ContextType {
    None, StaticReference, CurrentFacts, ScholarlyEvidence, OfficialDocumentation,
    UserData, LiveData, MediaObservation, DeterministicComputation, LocalInformation,
    RegulatorySource, ComparativeMarketData,
}

impl ContextType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::None => "NONE",
            Self::StaticReference => "STATIC_REFERENCE",
            Self::CurrentFacts => "CURRENT_FACTS",
            Self::ScholarlyEvidence => "SCHOLARLY_EVIDENCE",
            Self::OfficialDocumentation => "OFFICIAL_DOCUMENTATION",
            Self::UserData => "USER_DATA",
            Self::LiveData => "LIVE_DATA",
            Self::MediaObservation => "MEDIA_OBSERVATION",
            Self::DeterministicComputation => "DETERMINISTIC_COMPUTATION",
            Self::LocalInformation => "LOCAL_INFORMATION",
            Self::RegulatorySource => "REGULATORY_SOURCE",
            Self::ComparativeMarketData => "COMPARATIVE_MARKET_DATA",
        }
    }
    pub fn parse(s: &str) -> Result<Self, SpeError> {
        Ok(match s {
            "NONE" => Self::None,
            "STATIC_REFERENCE" => Self::StaticReference,
            "CURRENT_FACTS" => Self::CurrentFacts,
            "SCHOLARLY_EVIDENCE" => Self::ScholarlyEvidence,
            "OFFICIAL_DOCUMENTATION" => Self::OfficialDocumentation,
            "USER_DATA" => Self::UserData,
            "LIVE_DATA" => Self::LiveData,
            "MEDIA_OBSERVATION" => Self::MediaObservation,
            "DETERMINISTIC_COMPUTATION" => Self::DeterministicComputation,
            "LOCAL_INFORMATION" => Self::LocalInformation,
            "REGULATORY_SOURCE" => Self::RegulatorySource,
            "COMPARATIVE_MARKET_DATA" => Self::ComparativeMarketData,
            other => return Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, format!("invalid ContextType: {other}"))),
        })
    }
    fn is_version_bound(&self) -> bool {
        matches!(self, Self::OfficialDocumentation | Self::RegulatorySource)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PrivacyClass { Public, Private, Sensitive }
impl PrivacyClass {
    pub fn as_str(&self) -> &'static str {
        match self { Self::Public => "PUBLIC", Self::Private => "PRIVATE", Self::Sensitive => "SENSITIVE" }
    }
    pub fn parse(s: &str) -> Result<Self, SpeError> {
        Ok(match s {
            "PUBLIC" => Self::Public, "PRIVATE" => Self::Private, "SENSITIVE" => Self::Sensitive,
            other => return Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, format!("invalid PrivacyClass: {other}"))),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SupportStatus {
    Supported, PartiallySupported, Contradicted, Mixed, Insufficient, PreprintOnly, Unverified,
}
impl SupportStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Supported => "SUPPORTED",
            Self::PartiallySupported => "PARTIALLY_SUPPORTED",
            Self::Contradicted => "CONTRADICTED",
            Self::Mixed => "MIXED",
            Self::Insufficient => "INSUFFICIENT",
            Self::PreprintOnly => "PREPRINT_ONLY",
            Self::Unverified => "UNVERIFIED",
        }
    }
    pub fn parse(s: &str) -> Result<Self, SpeError> {
        Ok(match s {
            "SUPPORTED" => Self::Supported,
            "PARTIALLY_SUPPORTED" => Self::PartiallySupported,
            "CONTRADICTED" => Self::Contradicted,
            "MIXED" => Self::Mixed,
            "INSUFFICIENT" => Self::Insufficient,
            "PREPRINT_ONLY" => Self::PreprintOnly,
            "UNVERIFIED" => Self::Unverified,
            other => return Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, format!("invalid SupportStatus: {other}"))),
        })
    }
}


#[derive(Debug, Clone)]
pub struct ContextNeed {
    pub need_id: String,
    pub domain_tags: Vec<String>,
    pub context_types: Vec<ContextType>,
    pub freshness_required: bool,
    pub risk_level: String,
    pub privacy_class: PrivacyClass,
    pub query_minimization_required: bool,
    pub required_source_classes: Vec<String>,
    pub optional_source_classes: Vec<String>,
    pub max_sources: i64,
    pub max_context_bytes: i64,
    pub abstain_if_missing: bool,
    pub reason_codes: Vec<String>,
}
impl ContextNeed {
    pub fn to_value(&self) -> Value {
        json!({
            "need_id": self.need_id,
            "domain_tags": self.domain_tags,
            "context_types": self.context_types.iter().map(|c| c.as_str()).collect::<Vec<_>>(),
            "freshness_required": self.freshness_required,
            "risk_level": self.risk_level,
            "privacy_class": self.privacy_class.as_str(),
            "query_minimization_required": self.query_minimization_required,
            "required_source_classes": self.required_source_classes,
            "optional_source_classes": self.optional_source_classes,
            "max_sources": self.max_sources,
            "max_context_bytes": self.max_context_bytes,
            "abstain_if_missing": self.abstain_if_missing,
            "reason_codes": self.reason_codes,
        })
    }
}

#[derive(Debug, Clone)]
pub struct ContextCapsule {
    pub capsule_id: String,
    pub domain_id: String,
    pub context_type: ContextType,
    pub claim_or_observation: String,
    pub value: String,
    pub source_id: String,
    pub source_class: String,
    pub authority_class: String,
    pub retrieved_at: String,
    pub valid_as_of: String,
    pub fresh_until: Option<String>,
    pub license: String,
    pub allowed_use: String,
    pub confidence: f64,
    pub support_status: SupportStatus,
    pub contradiction_group: Option<String>,
    pub provenance_digest: String,
    pub taint_labels: Vec<String>,
    pub sensitivity_labels: Vec<String>,
}
impl ContextCapsule {
    pub fn from_value(raw: &Value) -> Result<Self, SpeError> {
        let obj = raw.as_object().ok_or_else(|| SpeError::new(PORTABILITY_INVALID_FIXTURE, "capsule must be object"))?;
        let get_str = |k: &str| -> Result<String, SpeError> {
            obj.get(k).and_then(|v| v.as_str()).map(|s| s.to_string())
                .ok_or_else(|| SpeError::new(PORTABILITY_INVALID_FIXTURE, format!("missing {k}")))
        };
        let fresh_until = match obj.get("fresh_until") {
            None | Some(Value::Null) => None,
            Some(v) => Some(v.as_str().ok_or_else(|| SpeError::new(PORTABILITY_INVALID_FIXTURE, "fresh_until must be string"))?.to_string()),
        };
        let contradiction_group = match obj.get("contradiction_group") {
            None | Some(Value::Null) => None,
            Some(v) => Some(v.as_str().ok_or_else(|| SpeError::new(PORTABILITY_INVALID_FIXTURE, "contradiction_group must be string"))?.to_string()),
        };
        let confidence = obj.get("confidence").and_then(|v| v.as_f64())
            .ok_or_else(|| SpeError::new(PORTABILITY_INVALID_FIXTURE, "confidence required"))?;
        if !(0.0..=1.0).contains(&confidence) {
            return Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, "confidence must be in 0.0..1.0"));
        }
        let list = |k: &str| -> Vec<String> {
            obj.get(k).and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()).unwrap_or_default()
        };
        Ok(Self {
            capsule_id: get_str("capsule_id")?,
            domain_id: get_str("domain_id")?,
            context_type: ContextType::parse(&get_str("context_type")?)?,
            claim_or_observation: get_str("claim_or_observation")?,
            value: get_str("value")?,
            source_id: get_str("source_id")?,
            source_class: get_str("source_class")?,
            authority_class: get_str("authority_class")?,
            retrieved_at: get_str("retrieved_at")?,
            valid_as_of: get_str("valid_as_of")?,
            fresh_until,
            license: get_str("license")?,
            allowed_use: get_str("allowed_use")?,
            confidence,
            support_status: SupportStatus::parse(&get_str("support_status")?)?,
            contradiction_group,
            provenance_digest: get_str("provenance_digest")?,
            taint_labels: list("taint_labels"),
            sensitivity_labels: list("sensitivity_labels"),
        })
    }
    pub fn to_value(&self) -> Value {
        json!({
            "capsule_id": self.capsule_id, "domain_id": self.domain_id,
            "context_type": self.context_type.as_str(),
            "claim_or_observation": self.claim_or_observation, "value": self.value,
            "source_id": self.source_id, "source_class": self.source_class,
            "authority_class": self.authority_class, "retrieved_at": self.retrieved_at,
            "valid_as_of": self.valid_as_of, "fresh_until": self.fresh_until,
            "license": self.license, "allowed_use": self.allowed_use,
            "confidence": self.confidence, "support_status": self.support_status.as_str(),
            "contradiction_group": self.contradiction_group,
            "provenance_digest": self.provenance_digest,
            "taint_labels": self.taint_labels, "sensitivity_labels": self.sensitivity_labels,
        })
    }
}

#[derive(Debug, Clone)]
pub struct GroundingBundle {
    pub request_text: String,
    pub capsules: Vec<ContextCapsule>,
    pub reason_codes: Vec<String>,
}
impl GroundingBundle {
    pub fn to_value(&self) -> Value {
        json!({
            "request_text": self.request_text,
            "capsules": self.capsules.iter().map(|c| c.to_value()).collect::<Vec<_>>(),
            "reason_codes": self.reason_codes,
        })
    }
}

#[derive(Debug, Clone)]
pub struct RefreshPlan {
    pub action: String,
    pub original_capsule_id: String,
    pub new_capsule_id: String,
    pub new_lineage_id: String,
    pub reason: String,
    pub freshness_state: String,
}
impl RefreshPlan {
    pub fn to_value(&self) -> Value {
        json!({
            "action": self.action,
            "original_capsule_id": self.original_capsule_id,
            "new_capsule_id": self.new_capsule_id,
            "new_lineage_id": self.new_lineage_id,
            "reason": self.reason,
            "freshness_state": self.freshness_state,
        })
    }
}


#[derive(Clone)]
struct DomainProfile {
    preferred_source_classes: Vec<String>,
    freshness_policy: String,
    abstention_policy: String,
}
#[derive(Clone)]
struct ContextRecipe {
    source_policies: Vec<String>,
    freshness_rules: HashMap<String, Value>,
}
#[derive(Clone)]
struct SourcePolicy {
    required_source_classes: Vec<String>,
    optional_source_classes: Vec<String>,
}

fn str_list(item: &Value, key: &str) -> Vec<String> {
    item.get(key).and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()).unwrap_or_default()
}

fn profiles() -> &'static HashMap<String, DomainProfile> {
    static P: OnceLock<HashMap<String, DomainProfile>> = OnceLock::new();
    P.get_or_init(|| {
        let raw: Value = serde_json::from_str(PROFILES_JSON).expect("profiles");
        let list = raw.get("profiles").and_then(|v| v.as_array()).expect("profiles");
        let mut map = HashMap::new();
        for item in list {
            let id = item.get("domain_id").and_then(|v| v.as_str()).unwrap().to_string();
            map.insert(id, DomainProfile {
                preferred_source_classes: str_list(item, "preferred_source_classes"),
                freshness_policy: item.get("freshness_policy").and_then(|v| v.as_str()).unwrap_or("prefer_current").to_string(),
                abstention_policy: item.get("abstention_policy").and_then(|v| v.as_str()).unwrap_or("warn_if_missing").to_string(),
            });
        }
        map
    })
}
fn recipes() -> &'static HashMap<String, ContextRecipe> {
    static R: OnceLock<HashMap<String, ContextRecipe>> = OnceLock::new();
    R.get_or_init(|| {
        let raw: Value = serde_json::from_str(RECIPES_JSON).expect("recipes");
        let list = raw.get("recipes").and_then(|v| v.as_array()).expect("recipes");
        let mut map = HashMap::new();
        for item in list {
            let id = item.get("recipe_id").and_then(|v| v.as_str()).unwrap().to_string();
            let freshness = item.get("freshness_rules").and_then(|v| v.as_object())
                .map(|o| o.iter().map(|(k, v)| (k.clone(), v.clone())).collect()).unwrap_or_default();
            map.insert(id, ContextRecipe { source_policies: str_list(item, "source_policies"), freshness_rules: freshness });
        }
        map
    })
}
fn policies() -> &'static HashMap<String, SourcePolicy> {
    static P: OnceLock<HashMap<String, SourcePolicy>> = OnceLock::new();
    P.get_or_init(|| {
        let raw: Value = serde_json::from_str(POLICIES_JSON).expect("policies");
        let list = raw.get("policies").and_then(|v| v.as_array()).expect("policies");
        let mut map = HashMap::new();
        for item in list {
            let id = item.get("policy_id").and_then(|v| v.as_str()).unwrap().to_string();
            map.insert(id, SourcePolicy {
                required_source_classes: str_list(item, "required_source_classes"),
                optional_source_classes: str_list(item, "optional_source_classes"),
            });
        }
        map
    })
}

fn normalize(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase()
}
fn route(request_text: &str) -> (String, String) {
    let text = normalize(request_text);
    for (domain_id, keywords, recipe_id) in ROUTE_RULES {
        for keyword in *keywords {
            if text.contains(&keyword.to_lowercase()) {
                return ((*domain_id).to_string(), (*recipe_id).to_string());
            }
        }
    }
    ("general".to_string(), "recipe.general.default".to_string())
}
fn make_need_id(request_text: &str, domain_id: &str) -> String {
    let digest = &sha256_hex(request_text.as_bytes())[..16];
    format!("need-{domain_id}-{digest}")
}
fn context_types_for(domain_id: &str, recipe_id: &str) -> Vec<ContextType> {
    if recipe_id == "recipe.none.local_only" || recipe_id == "recipe.personal.local_only" {
        return vec![ContextType::None];
    }
    if domain_id == "coding" || recipe_id == "recipe.coding.official_docs" {
        return vec![ContextType::OfficialDocumentation];
    }
    if domain_id == "research" || recipe_id == "recipe.research.scholarly" {
        return vec![ContextType::ScholarlyEvidence];
    }
    if domain_id == "news_current" { return vec![ContextType::CurrentFacts]; }
    if domain_id == "math_engineering" || domain_id == "data_statistics" {
        return vec![ContextType::DeterministicComputation];
    }
    vec![ContextType::None]
}
fn risk_for(domain_id: &str) -> &'static str {
    match domain_id {
        "research" | "health_information" | "legal_information" | "finance" | "cybersecurity" => "HIGH",
        "coding" | "debugging" | "news_current" | "shopping" => "MEDIUM",
        _ => "LOW",
    }
}
fn abstain_for(domain_id: &str, profile_policy: &str) -> bool {
    if profile_policy == "abstain_if_insufficient" || profile_policy == "abstain_if_stale" { return true; }
    matches!(domain_id, "research" | "health_information" | "legal_information" | "finance")
}
fn freshness_req_for(recipe: &ContextRecipe, profile_policy: &str) -> bool {
    if let Some(v) = recipe.freshness_rules.get("required") {
        return v.as_bool().unwrap_or(false);
    }
    profile_policy != "not_required" && profile_policy != "version_insensitive"
}


pub fn compile_context_need(request_text: &str, user_flags: Option<&Value>) -> Result<ContextNeed, SpeError> {
    let flags = user_flags.and_then(|v| v.as_object());
    let (mut domain_id, mut recipe_id) = route(request_text);
    if let Some(f) = flags {
        if let Some(d) = f.get("domain_id").and_then(|v| v.as_str()) {
            if !d.is_empty() { domain_id = d.to_string(); }
        }
        if let Some(r) = f.get("recipe_id").and_then(|v| v.as_str()) {
            if !r.is_empty() { recipe_id = r.to_string(); }
        }
    }
    let profile = profiles().get(&domain_id).ok_or_else(|| {
        SpeError::new(PORTABILITY_INVALID_FIXTURE, format!("unknown domain_id: {domain_id}"))
    })?;
    let recipe = recipes().get(&recipe_id).ok_or_else(|| {
        SpeError::new(PORTABILITY_INVALID_FIXTURE, format!("unknown recipe_id: {recipe_id}"))
    })?;

    let (mut required, mut optional) = if let Some(pid) = recipe.source_policies.first() {
        let policy = policies().get(pid).ok_or_else(|| {
            SpeError::new(PORTABILITY_INVALID_FIXTURE, format!("unknown policy_id: {pid}"))
        })?;
        (policy.required_source_classes.clone(), policy.optional_source_classes.clone())
    } else if !profile.preferred_source_classes.is_empty() {
        (profile.preferred_source_classes[..1].to_vec(), profile.preferred_source_classes[1..].to_vec())
    } else {
        (vec![], vec![])
    };

    let mut freshness_required = freshness_req_for(recipe, &profile.freshness_policy);
    let context_types = context_types_for(&domain_id, &recipe_id);
    let is_none = context_types.len() == 1 && context_types[0] == ContextType::None;

    let (max_sources, max_context_bytes, reason_codes, abstain_if_missing) = if is_none {
        required.clear();
        optional.clear();
        freshness_required = false;
        (0i64, 0i64, vec!["NO_EXTERNAL_CONTEXT_REQUIRED".to_string()], false)
    } else {
        let max_sources = flags.and_then(|f| f.get("max_sources")).and_then(|v| v.as_i64()).unwrap_or(12);
        let max_context_bytes = flags.and_then(|f| f.get("max_context_bytes")).and_then(|v| v.as_i64()).unwrap_or(65536);
        let reason_codes = vec![
            format!("ROUTED_{}", domain_id.to_uppercase()),
            format!("RECIPE_{}", recipe_id.replace('.', "_").to_uppercase()),
        ];
        (max_sources, max_context_bytes, reason_codes, abstain_for(&domain_id, &profile.abstention_policy))
    };

    let privacy_raw = flags.and_then(|f| f.get("privacy_class")).and_then(|v| v.as_str()).unwrap_or("PRIVATE");
    Ok(ContextNeed {
        need_id: make_need_id(request_text, &domain_id),
        domain_tags: vec![domain_id.clone()],
        context_types,
        freshness_required,
        risk_level: risk_for(&domain_id).to_string(),
        privacy_class: PrivacyClass::parse(privacy_raw)?,
        query_minimization_required: true,
        required_source_classes: required,
        optional_source_classes: optional,
        max_sources,
        max_context_bytes,
        abstain_if_missing,
        reason_codes,
    })
}


fn walk_forbidden(obj: &Value, path: &str) -> Result<(), SpeError> {
    match obj {
        Value::Object(map) => {
            for k in map.keys() {
                if FORBIDDEN_PAYLOAD_KEYS.contains(&k.as_str()) || CITATION_FORGERY_KEYS.contains(&k.as_str()) {
                    let loc = if path.is_empty() { String::new() } else { format!(" at {path}") };
                    return Err(SpeError::new(
                        PORTABILITY_INVALID_FIXTURE,
                        format!("external payload contains forbidden keys{loc}: {k}"),
                    ));
                }
            }
            for (k, v) in map {
                let child = if path.is_empty() { k.clone() } else { format!("{path}.{k}") };
                walk_forbidden(v, &child)?;
            }
            Ok(())
        }
        Value::Array(items) => {
            for (i, item) in items.iter().enumerate() {
                walk_forbidden(item, &format!("{path}[{i}]"))?;
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

fn sanitize_text(value: &str) -> String {
    // Strip <script>...</script>, HTML tags, and control/zero-width chars.
    let s = value;
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    loop {
        let low = rest.to_ascii_lowercase();
        if let Some(start) = low.find("<script") {
            out.push_str(&rest[..start]);
            out.push(' ');
            let after = &rest[start..];
            let alow = after.to_ascii_lowercase();
            if let Some(end_rel) = alow.find("</script") {
                let after_close = &after[end_rel..];
                if let Some(gt) = after_close.find('>') {
                    rest = &after_close[gt + 1..];
                    continue;
                }
            }
            // malformed — drop rest of script open
            break;
        } else {
            out.push_str(rest);
            break;
        }
    }
    // strip tags
    let mut no_tags = String::new();
    let mut chars = out.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '<' {
            // look ahead for tag
            let mut tag = String::from("<");
            let mut is_tag = false;
            if let Some(&n) = chars.peek() {
                if n == '/' || n.is_ascii_alphabetic() {
                    is_tag = true;
                }
            }
            if is_tag {
                for ch in chars.by_ref() {
                    tag.push(ch);
                    if ch == '>' { break; }
                }
                no_tags.push(' ');
                continue;
            }
        }
        no_tags.push(c);
    }
    // strip controls / zero-width
    let mut cleaned = String::new();
    for ch in no_tags.chars() {
        let u = ch as u32;
        let drop = matches!(u,
            0x00..=0x08 | 0x0B | 0x0C | 0x0E..=0x1F | 0x7F..=0x9F
            | 0x200B..=0x200F | 0x202A..=0x202E | 0x2060..=0x206F | 0xFEFF
        );
        if !drop { cleaned.push(ch); }
    }
    // collapse spaces like Python: [ \t]+\n -> \n ; [ \t]{2,} -> space
    let mut result = String::new();
    let lines: Vec<&str> = cleaned.split('\n').collect();
    for (li, line) in lines.iter().enumerate() {
        let mut collapsed = String::new();
        let mut spaces = 0;
        for ch in line.chars() {
            if ch == ' ' || ch == '\t' {
                spaces += 1;
            } else {
                if spaces > 0 {
                    collapsed.push(' ');
                    spaces = 0;
                }
                collapsed.push(ch);
            }
        }
        // trailing spaces on line before newline already dropped by not emitting
        let trimmed = collapsed.trim_end_matches(|c| c == ' ' || c == '\t');
        result.push_str(trimmed);
        if li + 1 < lines.len() { result.push('\n'); }
    }
    result.trim().to_string()
}

fn sanitize_value(value: &Value) -> Value {
    match value {
        Value::String(s) => Value::String(sanitize_text(s)),
        Value::Object(map) => {
            let mut out = Map::new();
            for (k, v) in map { out.insert(k.clone(), sanitize_value(v)); }
            Value::Object(out)
        }
        Value::Array(items) => Value::Array(items.iter().map(sanitize_value).collect()),
        other => other.clone(),
    }
}

pub fn sanitize_external_payload(payload: &Value) -> Result<Value, SpeError> {
    let obj = payload.as_object().ok_or_else(|| {
        SpeError::new(PORTABILITY_INVALID_FIXTURE, "payload must be a mapping")
    })?;
    walk_forbidden(payload, "")?;
    let mut out = Map::new();
    for (k, v) in obj {
        out.insert(k.clone(), sanitize_value(v));
    }
    let mut labels: Vec<String> = match out.get("taint_labels") {
        Some(Value::String(s)) => vec![s.clone()],
        Some(Value::Array(a)) => a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect(),
        _ => vec![],
    };
    if !labels.iter().any(|l| l == "UNTRUSTED_SOURCE") {
        labels.push("UNTRUSTED_SOURCE".to_string());
    }
    out.insert("taint_labels".to_string(), json!(labels));
    Ok(Value::Object(out))
}

pub fn freshness_state(capsule: &ContextCapsule, now_iso: &str) -> String {
    if capsule.context_type.is_version_bound() {
        return "VERSION_BOUND".to_string();
    }
    match &capsule.fresh_until {
        None => "UNKNOWN".to_string(),
        Some(until) if until.trim().is_empty() => "UNKNOWN".to_string(),
        Some(until) => {
            if now_iso > until.as_str() { "STALE".to_string() } else { "FRESH".to_string() }
        }
    }
}

pub fn plan_refresh(capsule: &ContextCapsule, now_iso: &str) -> Option<RefreshPlan> {
    let state = freshness_state(capsule, now_iso);
    if state == "FRESH" { return None; }
    let digest = &sha256_hex(format!("{}|{}|{}", capsule.capsule_id, now_iso, state).as_bytes())[..16];
    let reason = match state.as_str() {
        "STALE" => "FRESH_UNTIL_ELAPSED",
        "VERSION_BOUND" => "VERSION_BOUND_REFRESH",
        "UNKNOWN" => "FRESHNESS_UNKNOWN",
        _ => "REFRESH_REQUIRED",
    };
    Some(RefreshPlan {
        action: "REFRESH".to_string(),
        original_capsule_id: capsule.capsule_id.clone(),
        new_capsule_id: format!("{}:refresh:{}", capsule.capsule_id, digest),
        new_lineage_id: format!("lineage:{}:{}", capsule.capsule_id, digest),
        reason: reason.to_string(),
        freshness_state: state,
    })
}

fn capsule_text_bytes(c: &ContextCapsule) -> usize {
    c.claim_or_observation.len() + c.value.len() + c.source_id.len() + c.provenance_digest.len()
}

fn validate_capsule(capsule: &ContextCapsule) -> Result<(), SpeError> {
    if capsule.source_id.trim().is_empty() {
        return Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, "capsule missing source_id (source)"));
    }
    if capsule.provenance_digest.trim().is_empty() {
        return Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, "capsule missing provenance_digest (provenance)"));
    }
    let authority = capsule.authority_class.trim().to_uppercase();
    if !ALLOWED_AUTHORITY.contains(&authority.as_str()) {
        return Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, format!(
            "capsule authority_class {:?} violates firewall DATA-only law", capsule.authority_class
        )));
    }
    let labels: Vec<String> = capsule.taint_labels.iter().map(|x| x.to_uppercase()).collect();
    if labels.iter().any(|l| l == "RETRACTED") {
        return Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, format!(
            "retracted source rejected: capsule carries RETRACTED taint (capsule_id={})", capsule.capsule_id
        )));
    }
    if capsule.context_type != ContextType::UserData {
        if !capsule.taint_labels.iter().any(|l| l == "UNTRUSTED_SOURCE") {
            return Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, "capsule missing UNTRUSTED_SOURCE taint label (firewall/taint)"));
        }
    }
    let payload = capsule.to_value();
    if let Some(obj) = payload.as_object() {
        for k in obj.keys() {
            if FORBIDDEN_PAYLOAD_KEYS.contains(&k.as_str()) {
                return Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, format!("capsule contains forbidden keys (firewall): {k}")));
            }
        }
    }
    sanitize_external_payload(&payload)?;
    Ok(())
}

pub fn compile_context(
    request_text: &str,
    capsules: &[ContextCapsule],
    max_context_bytes: Option<i64>,
    max_sources: Option<i64>,
) -> Result<GroundingBundle, SpeError> {
    if let Some(n) = max_context_bytes { if n < 0 { return Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, "max_context_bytes must be >= 0")); } }
    if let Some(n) = max_sources { if n < 0 { return Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, "max_sources must be >= 0")); } }
    let mut reason_codes: Vec<String> = Vec::new();
    let mut accepted: Vec<ContextCapsule> = Vec::new();
    let mut seen_sources = std::collections::HashSet::new();
    let mut total_bytes: usize = 0;
    for capsule in capsules {
        validate_capsule(capsule)?;
        let size = capsule_text_bytes(capsule);
        if let Some(maxb) = max_context_bytes {
            if (total_bytes + size) as i64 > maxb {
                return Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, format!(
                    "oversized context: adding capsule {} exceeds max_context_bytes={maxb}", capsule.capsule_id
                )));
            }
        }
        let source_key = capsule.source_id.trim().to_string();
        if seen_sources.contains(&source_key) {
            if !reason_codes.iter().any(|c| c == "DUPLICATE_SOURCE_SPAM_SUPPRESSED") {
                reason_codes.push("DUPLICATE_SOURCE_SPAM_SUPPRESSED".to_string());
            }
            continue;
        }
        if let Some(maxs) = max_sources {
            if accepted.len() as i64 >= maxs {
                if !reason_codes.iter().any(|c| c == "MAX_SOURCES_EXCEEDED") {
                    reason_codes.push("MAX_SOURCES_EXCEEDED".to_string());
                }
                continue;
            }
        }
        seen_sources.insert(source_key);
        accepted.push(capsule.clone());
        total_bytes += size;
    }
    let mut groups: HashMap<String, Vec<&ContextCapsule>> = HashMap::new();
    for c in &accepted {
        if let Some(g) = &c.contradiction_group {
            groups.entry(g.clone()).or_default().push(c);
        }
    }
    for group_caps in groups.values() {
        if group_caps.len() > 1 {
            if !reason_codes.iter().any(|c| c == "CONFLICTING_SOURCES") {
                reason_codes.push("CONFLICTING_SOURCES".to_string());
            }
            break;
        }
        if let Some(first) = group_caps.first() {
            if matches!(first.support_status, SupportStatus::Contradicted | SupportStatus::Mixed) {
                if !reason_codes.iter().any(|c| c == "CONFLICTING_SOURCES") {
                    reason_codes.push("CONFLICTING_SOURCES".to_string());
                }
            }
        }
    }
    if accepted.is_empty() {
        reason_codes.push("NO_CAPSULES_ACCEPTED".to_string());
    } else {
        reason_codes.push("CAPSULES_VALIDATED".to_string());
    }
    Ok(GroundingBundle { request_text: request_text.to_string(), capsules: accepted, reason_codes })
}

/// JSON API ops for differential harness.
pub fn evaluate_grounding(input: &Value) -> Result<Value, SpeError> {
    let op = input.get("op").and_then(|v| v.as_str())
        .ok_or_else(|| SpeError::new(PORTABILITY_INVALID_FIXTURE, "missing op"))?;
    match op {
        "compile_context_need" => {
            let text = input.get("request_text").and_then(|v| v.as_str())
                .ok_or_else(|| SpeError::new(PORTABILITY_INVALID_FIXTURE, "request_text required"))?;
            let flags = input.get("user_flags");
            Ok(json!({"need": compile_context_need(text, flags)?.to_value()}))
        }
        "sanitize_external_payload" => {
            let payload = input.get("payload")
                .ok_or_else(|| SpeError::new(PORTABILITY_INVALID_FIXTURE, "payload required"))?;
            match sanitize_external_payload(payload) {
                Ok(v) => Ok(json!({"ok": true, "payload": v})),
                Err(e) => Ok(json!({"ok": false, "error": e.message})),
            }
        }
        "freshness" => {
            let capsule = ContextCapsule::from_value(
                input.get("capsule").ok_or_else(|| SpeError::new(PORTABILITY_INVALID_FIXTURE, "capsule required"))?
            )?;
            let now = input.get("now_iso").and_then(|v| v.as_str())
                .ok_or_else(|| SpeError::new(PORTABILITY_INVALID_FIXTURE, "now_iso required"))?;
            let state = freshness_state(&capsule, now);
            let plan = plan_refresh(&capsule, now);
            Ok(json!({
                "freshness_state": state,
                "refresh_plan": plan.map(|p| p.to_value()),
            }))
        }
        "compile_context" => {
            let text = input.get("request_text").and_then(|v| v.as_str()).unwrap_or("");
            let caps_raw = input.get("capsules").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            let mut caps = Vec::new();
            for c in caps_raw { caps.push(ContextCapsule::from_value(&c)?); }
            let max_b = input.get("max_context_bytes").and_then(|v| v.as_i64());
            let max_s = input.get("max_sources").and_then(|v| v.as_i64());
            Ok(json!({"bundle": compile_context(text, &caps, max_b, max_s)?.to_value()}))
        }
        other => Err(SpeError::new(PORTABILITY_INVALID_FIXTURE, format!("unknown grounding op: {other}"))),
    }
}
