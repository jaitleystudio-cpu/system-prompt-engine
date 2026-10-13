# ADR P0-REQS-1: User-Confirmed Requirements (Option B)

- **Status**: Accepted (Owner-Directed Product Decision)
- **Date**: 2026-10-13
- **Deciders**: SPE Product Owner, Antigravity (Implementation Owner), Grok (Architecture Review & Acceptance Criteria)
- **Target Release**: October 26, 2026

---

## 1. Context & Problem Statement
Users worldwide need SPE (System Prompt Engine) to generate production-ready system prompts that strictly preserve their intended requirements without hallucinations, drift, or invented obligations.

While callers can supply structured constraints programmatically through the ABI fixture, the web application currently accepts a natural-language brief without an intuitive mechanism for users to explicitly state what the generated prompt **MUST FOLLOW** and what it **MUST NOT** do.

A proposed Option A advocated adding a complex client-side natural language processing (NLP) extraction engine in TypeScript to infer constraints from free text. However, ungrounded heuristic extraction risks misinterpreting negative constraints, inventing unwanted obligations, adding runtime bloat, and modifying frozen engine contracts prior to the October 26 release freeze.

## 2. Decision: Option B (User-Confirmed Requirements)
We adopt **Option B: User-Confirmed Requirements**:
1. **Preserve Simplicity**: The default one-line prompt generation flow remains completely frictionless. A beginner enters an idea and immediately generates a prompt.
2. **Optional Expandable Control**: An optional, accessible Requirements section allows users to supply explicit, confirmed constraints before compilation.
3. **Two Distinct Controls**:
   - **`MUST FOLLOW`**: Explicit positive requirements to preserve (e.g., output schema, TypeScript types, exact numerical limits).
   - **`MUST NOT`**: Explicit negative prohibitions to enforce (e.g., no external dependencies, no placeholder comments, no unverified APIs).
4. **Canonical Mapping**: Confirmed requirements map directly into the existing `intent.confirmed` array as `IntentAtom` structures.
5. **Frozen Contract Preservation**: No changes to Python, Rust, or WASM contracts. The canonical WASM hash remains pinned at `ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d`.
6. **Local-First Privacy**: All requirements remain 100% on-device ($0 cloud spend, zero data egress).

---

## 3. Data Representation & Polarity Preservation

### 3.1 Intent Representation
In `@spe/web-runtime`:
```typescript
export type IntentAtom = {
  id: string;
  kind: "confirmed" | "assumed" | "unknown" | "conflict";
  label: string;
  text: string;
};
```

### 3.2 Negative Constraint Polarity Rule
For `MUST NOT` items, negative meaning is strictly preserved. If an item text does not already begin with a negative directive (`must not`, `do not`, `never`, `forbidden`), it is normalized with `"Must not: "` or `"Must not "` prefix upon conversion to `hard_constraints`.

### 3.3 ABI Fixture Envelope Mapping
In `packages/web-runtime/src/envelope.ts`, confirmed atoms are transformed into hard constraints:
```typescript
const hard = (input.confirmed ?? [])
  .filter((a) => a.text.trim())
  .map((a, i) => ({
    constraint_id: a.id || `c-${i + 1}`,
    statement: a.text,
    strength: "HARD",
  }));
```

In `promptSynthesizer.mjs`, each hard constraint is rendered directly into the generated prompt's Operating Guidelines:
```markdown
# Operating Guidelines & Governing Principles
- **Constraint**: Include strict TypeScript types and interfaces
- **Constraint**: Must not use any external dependencies or npm packages
```

---

## 4. Acceptance Criteria & Test Battery

The implementation is evaluated against the following deterministic criteria:

1. **Positive Constraints Preserved**: Added `MUST FOLLOW` items appear in the synthesized prompt under `- **Constraint**: <text>`.
2. **Negative Constraints Preserved**: Added `MUST NOT` items appear with unambiguous negative polarity (e.g., `- **Constraint**: Must not <text>`).
3. **Exact Numerical Constraints**: Numerical specifications (e.g. `p95 <= 250ms`, `max 3 items`) are preserved verbatim with zero float rounding.
4. **Edits Update Prompt**: Modifying a requirement updates the generated prompt upon recompilation.
5. **Deletions Remove Constraints**: Removing a requirement removes it from subsequent compilations.
6. **No Invented Obligations**: If the user supplies zero requirements, no phantom constraints are manufactured.
7. **Zero Regression on Default Flow**: Existing natural-language quick-start generation functions identically with zero requirements.
8. **Frozen Engine Invariants**: Pinned WASM hash and ABI structures remain unmodified.
9. **UI Accessibility & Mobile Standards**: Touch targets $\ge 42\text{px}$, full keyboard navigation, zero emojis.
10. **Zero Copy-Check Violations**: `npm --prefix apps/web run spe:copy-check` passes with 0 violations.
