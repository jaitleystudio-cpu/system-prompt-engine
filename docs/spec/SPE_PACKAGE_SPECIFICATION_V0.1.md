# SPE Open Package Specification v0.1 (Draft Standard)

**Spec Version:** `0.1.0`  
**Minimum SPE Engine Version:** `0.1.0`  
**Status:** Canonical Experimental Standard  
**Maintainer:** System Prompt Engine Architecture Working Group

---

## 1. Abstract & Motivation
AI instructions have historically been treated as fragile, untyped string literals scattered throughout codebases, notebook scripts, and cloud dashboards. This lack of a formal representation causes silent regressions, tool authorization leaks, unanchored prompt drift across model upgrades, and unprovable compliance.

The `.spe` package format defines an **open, portable, content-addressed, and evidence-backed container** for AI instructions. It decouples human intent from provider-specific markup while packaging requirements, tests, capability grants, model passports, and cryptographic provenance receipts into a single verifiable package.

---

## 2. Directory Layout & Structure
A `.spe` package directory (or uncompressed unpacked directory) conforms to the following standardized layout:

```
<package-root>/
├── manifest.json              # Core package metadata, targets, and SHA-256 digest map
├── intent.json                # ProtectedIntent specification (goals, non-negotiables, authority scope)
├── requirements.json          # RequirementGraph definitions and semantic category tags
├── prompt-ir.json             # Provider-independent Prompt Intermediate Representation (ABI)
├── effect-plan.json           # Transpilation and prompt compilation effect plan
├── providers/                 # Provider-specific lowering configurations (OpenAI, Anthropic, Gemini, Local)
├── tests/                     # Test suites (unit tests, metamorphic tests, mutation tests)
├── policies/                  # Organizational policy constraints and governance contracts
├── capabilities/              # Capability grants for files, databases, network, and tools
├── provenance/                # Causal Proof Graph nodes, human source spans, and audit trail
├── evidence/                  # Empirical evaluation receipts, benchmark logs, and execution traces
├── model-passports/           # Empirical model behavior profiles and known drift characteristics
├── sbom/                      # AI Instruction Software Bill of Materials (InstructionSBOM)
└── signatures/                # RFC 8785 JCS canonical digests and Ed25519 digital signatures
```

---

## 3. Core Component Schemas

### 3.1 `manifest.json`
The manifest is the root manifest governing package integrity:

```json
{
  "spec_version": "0.1.0",
  "package_id": "spe.finance.fraud-analyst",
  "package_version": "1.0.0",
  "protected_intent_digest": "sha256:4a8b...19e",
  "provider_targets": ["openai", "anthropic", "gemini", "local"],
  "content_digests": {
    "intent.json": "sha256:...",
    "requirements.json": "sha256:...",
    "prompt-ir.json": "sha256:...",
    "effect-plan.json": "sha256:..."
  },
  "dependencies": {},
  "minimum_spe_version": "0.1.0",
  "license": "Apache-2.0",
  "created_at": "2026-10-08T00:00:00Z",
  "signature_metadata": {
    "signer_key_id": "spe-authority:ed25519:...",
    "signature": "..."
  }
}
```

### 3.2 `intent.json`
Captures immutable organizational intent (`ProtectedIntent`):

```json
{
  "goal": "Analyze suspected transaction fraud and produce verified audit reports.",
  "non_negotiables": [
    "Never execute customer account freezes without human dual-authorization.",
    "Never transmit unmasked PII (SSN, credit card numbers) to external endpoints."
  ],
  "authority_scope": "READ_TRANSACTIONS, DRAFT_REPORT",
  "invariants": [
    "output_format == json",
    "schema_conformance == 1.0"
  ]
}
```

---

## 4. Packaging & Archive Serialization
1. **Archive Format:** Standard POSIX PAX tarball compressed with Gzip (`.spe` or `.tar.gz`).
2. **Determinism:** File entries are added in lexicographical order by relative path. Timestamps and metadata are canonicalized.
3. **Digest Integrity:** Every file in the archive is hashed using SHA-256 and matched against `manifest.json.content_digests`. Any discrepancy causes `PackageVerificationError`.

---

## 5. Toolchain Support
- `spe pack <dir> [--verify]` — Validates structure, computes digests, and packs into archive.
- `spe unpack <archive> <dir>` — Extracts archive and validates all SHA-256 digests.
- `spe inspect <dir>` — Validates and displays components, targets, and ProtectedIntent status.
- `spe check <file>` — Runs CI/CD evidence gate over package components.
