# Prompt Application Binary Interface (ABI) Specification v0.1

**Spec Version:** `0.1.0`  
**Status:** Canonical Experimental Standard  
**Maintainer:** System Prompt Engine Architecture Working Group

---

## 1. Abstract
The Prompt Application Binary Interface (ABI) defines the semantic interface between high-level human requirements (`ProtectedIntent`) and low-level provider representations (OpenAI developer prompts, Anthropic XML tag structures, Gemini system instructions, Cursor rules, local open-weight template formatting).

By establishing a typed, intermediate representation (Prompt IR), the Prompt ABI ensures that system prompt semantics, constraints, few-shot demonstrations, and tool authorization policies remain invariant across model providers and version upgrades.

---

## 2. Architectural Representation

```
   ProtectedIntent + RequirementGraph
                   │
                   ▼
          Prompt Intermediate Representation (IR)
  ┌────────────────┼────────────────┬────────────────┐
  │ System Core    │ Constraints    │ Tool Contracts │
  │ Context Anchor │ Guardrails     │ Output Schema  │
  └────────────────┼────────────────┴────────────────┘
                   │
                   ▼
        [Prompt ABI Lowering Adapters]
    ┌──────────────┬──────────────┬──────────────┐
    ▼              ▼              ▼              ▼
OpenAI Lowering  Anthropic XML   Gemini Format   Local GGUF / Llama
```

---

## 3. ABI Primitives & Structural Components

Every Prompt ABI definition is partitioned into structured semantic sections:

1. **System Persona & Primary Role:** The foundational authority identity.
2. **Hard Invariant Directives (`NON_NEGOTIABLES`):** Constraints that cannot be compromised regardless of user prompt framing.
3. **Operational Context & Grounding:** Verified facts and domain knowledge boundaries.
4. **Tool Definitions & Parameter Contracts:** Schema declarations and authority scope bounds.
5. **Output Conformance Specifications:** JSON schemas, markdown formats, and refusal protocols.
6. **Positional Salience Layout:** Optimized arrangement to combat "lost-in-the-middle" attention attenuation.

---

## 4. Lowering Pipeline & Dialect Rules

### 4.1 OpenAI Dialect Lowering
- Emits markdown section headers with clear structural separators.
- Enforces strict JSON Schema parameters when output schema is defined.
- Converts hard invariants into numbered priority rules.

### 4.2 Anthropic Dialect Lowering
- Encloses instructions within canonical XML tags (`<system_instructions>`, `<rules>`, `<examples>`, `<output_format>`).
- Utilizes `<thinking>` scratchpad tags for complex chain-of-thought routing.
- Positions immutable security constraints at both the header and footer (sandwich defense).

### 4.3 Local Open-Weight (Llama / Mistral / DeepSeek) Dialect Lowering
- Formats explicit system role tokens (`<|start_header_id|>system<|end_header_id|>`).
- Aligns token sequences to 16/32-token KV-cache boundaries for optimal prefill and page alignment.
- Employs concise, unambiguous directive syntax to avoid context degradation.

---

## 5. Verification & Conformance Testing
Lowered prompts must be provably consistent with the original ABI definition:
- **Semantic Equivalence:** Evaluated via embedding cosine similarity and LLM reflection oracles.
- **Constraint Retention:** All negative and positive constraints must be present in compiled output.
- **Zero-Contradiction Verification:** Bounded Horn-clause analysis must demonstrate 0 logical deadlocks.
