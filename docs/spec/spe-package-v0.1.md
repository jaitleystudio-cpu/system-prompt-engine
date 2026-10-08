# SPE Package Specification v0.1 — Schema & Packaging Standard

**Spec Version:** `0.1.0`  
**JSON Schema Draft:** `https://json-schema.org/draft/2020-12/schema`  
**Status:** Canonical Standard  
**Maintainer:** System Prompt Engine Architecture Working Group  

---

## 1. Overview

The `.spe` package format defines an open, reproducible, content-addressed archive for AI instructions. It packages:
1. `manifest.json`: Root package manifest and SHA-256 digest map.
2. `intent.json`: `ProtectedIntent` (goals, invariants, non-negotiables).
3. `requirements.json`: Atomic verifiable requirements.
4. `prompt-ir.json`: Intermediate Representation (Prompt ABI).
5. `effect-plan.json`: Transpilation and layout effect schedule.
6. Standard subdirectories: `providers/`, `tests/`, `policies/`, `capabilities/`, `provenance/`, `evidence/`, `model-passports/`, `sbom/`, `signatures/`.

---

## 2. JSON Schema Definitions

### 2.1 `manifest.json` Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SpePackageManifest",
  "type": "object",
  "required": [
    "spec_version",
    "package_id",
    "package_version",
    "protected_intent_digest",
    "provider_targets",
    "content_digests",
    "dependencies",
    "minimum_spe_version",
    "license",
    "created_at"
  ],
  "properties": {
    "spec_version": { "type": "string", "const": "0.1.0" },
    "package_id": { "type": "string", "pattern": "^[a-z0-9_.-]+$" },
    "package_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+" },
    "protected_intent_digest": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "provider_targets": {
      "type": "array",
      "items": { "type": "string", "enum": ["openai", "anthropic", "gemini", "local", "cursor-rules"] }
    },
    "content_digests": {
      "type": "object",
      "additionalProperties": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
    },
    "dependencies": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "minimum_spe_version": { "type": "string" },
    "license": { "type": "string" },
    "created_at": { "type": "string", "format": "date-time" },
    "signature_metadata": {
      "type": ["object", "null"],
      "properties": {
        "signer_key_id": { "type": "string" },
        "signature_ed25519": { "type": "string" },
        "signed_at": { "type": "string", "format": "date-time" }
      }
    }
  }
}
```

### 2.2 `intent.json` Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ProtectedIntent",
  "type": "object",
  "required": ["goal", "non_negotiables", "authority_scope", "invariants"],
  "properties": {
    "goal": { "type": "string" },
    "non_negotiables": {
      "type": "array",
      "items": { "type": "string" }
    },
    "authority_scope": { "type": "string" },
    "invariants": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

### 2.3 `requirements.json` Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "RequirementGraph",
  "type": "object",
  "required": ["requirements"],
  "properties": {
    "requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["requirement_id", "category", "description", "is_hard_constraint"],
        "properties": {
          "requirement_id": { "type": "string" },
          "category": { "type": "string" },
          "description": { "type": "string" },
          "is_hard_constraint": { "type": "boolean" },
          "source_span_id": { "type": "string" }
        }
      }
    }
  }
}
```

### 2.4 `prompt-ir.json` Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PromptIntermediateRepresentation",
  "type": "object",
  "required": ["system_core", "constraints", "output_schema"],
  "properties": {
    "system_core": { "type": "string" },
    "constraints": {
      "type": "array",
      "items": { "type": "string" }
    },
    "operational_context": { "type": "string" },
    "tool_contracts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "parameters"],
        "properties": {
          "name": { "type": "string" },
          "parameters": { "type": "object" }
        }
      }
    },
    "output_schema": { "type": "object" }
  }
}
```

### 2.5 `effect-plan.json` Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PromptEffectPlan",
  "type": "object",
  "required": ["plan_id", "target_dialect", "operations"],
  "properties": {
    "plan_id": { "type": "string" },
    "target_dialect": { "type": "string" },
    "operations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["op_type", "section", "clause_ref"],
        "properties": {
          "op_type": { "type": "string", "enum": ["INJECT_RULE", "ENCLOSE_XML", "ALIGN_KV", "SANDWICH_DEFENSE"] },
          "section": { "type": "string" },
          "clause_ref": { "type": "string" }
        }
      }
    }
  }
}
```

---

## 3. Toolchain Adherence & Verification

All standard `.spe` toolchain operations strictly adhere to these schemas:
- `spe pack <dir>`: Compiles directory, verifies all core files against schemas, updates digests, and archives.
- `spe unpack <archive> <dir>`: Validates SHA-256 digests and schemas during extraction.
- `spe inspect <dir>`: Validates component schemas and outputs manifest summary.
- `spe check <file>`: Enforces intent preservation and schema conformance.
