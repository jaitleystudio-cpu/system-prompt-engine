# TAXONOMY AUTHORITY RECONCILIATION — Task 56A

**Mission class:** SPEC CUSTODY / ARCHITECTURE AUTHORITY RECONCILIATION  
**No runtime implementation.**  
**Base SHA:** `9208a57a48a3ed3b53d3389e2280f1ab954c7bba`  
**Branch:** `cursor/spe-xcat-v1-closure-20260929`  
**PR:** #56 (append only; no merge)

## Central question

Was the current repository taxonomy (C04 Plan, C05 Verify, C08 Recover, C09 Privacy, C10 Authority, C11 Provenance, C12 Capability) an **explicitly approved intentional supersession** of a domain-oriented v2.1 taxonomy — or was it introduced without sufficient normative authority?

## Authority precedence applied

1. Explicit founder-approved frozen spec  
2. Explicit founder-approved amendment/version  
3. Normative repository contract explicitly bound to that approval  
4. Accepted implementation contract  
5. Implementation/test artifacts  
6. Design-hardened but unapproved specs  
7. Brainstorming  
8. Bare registry names  

Later timestamp alone does **not** override explicit authority.

## Findings (compressed)

### 1. Founder primary package inspected

`SPE_OMEGA_V2_4_1_FULL_FINAL_ARCHITECTURE.pdf` (SHA-256 `f854db17…`) including all four embedded attachments and hermetic ZIP contents.

**Proven from those bytes:**

- Source-precedence law (v2.4.1 → v2.4 → v2.3 → v2.1 atlas).
- Unique semantic ownership (F28); legacy atlas must not create duplicate canonical writers.
- Ring-0 freeze subject = K0–K7 compact kernel.
- L2 owns **category route / category payload** (ownership slot).

**Not proven from those bytes:**

- Any C01–C12 English name table matching either CURRENT_REPO or DOMAIN taxonomy.
- Strings `LanguageTransferProjectIR`, `LearningProjectIR`, `BusinessProjectIR`, `CategoryRouterIR`, `C04 Translate`, `C04 Plan`, `XCAT` as taxonomy registry.

Per founder correction: do **not** assume the PDF contains the old C04/C05/C08–C12 taxonomy unless exact bytes are found. They were **not** found.

### 2. Claimed master design file

`SPE_OMEGA_V2_1_MASTER_ARCHITECTURE_DESIGN.md` was **not recovered** as authoritative bytes in this environment (PDF/ZIP/git/local Spotlight/Downloads/Desktop/Documents searches).  

Task-brief quotes of its taxonomy are **INFERENCE / SECONDARY REPORT**, not EXPLICIT_TAXONOMY.

### 3. Repository registry

Introduced `6c7fa1d` (2026-09-15) as Sprint 1 **NEW_IMPLEMENTATION**. Names only; companion schema STUB. No freeze receipt binding those names to founder approval or to a supersession of a domain taxonomy.

### 4. Owner approval

**EXPLICIT APPROVAL FOUND: NO** for (A) freezing domain taxonomy, (B) superseding it with repo taxonomy, or (C) freezing repo taxonomy as canonical XCAT names. See `TAXONOMY_OWNER_APPROVAL.md`.

### 5. Coherence (non-authority)

Current C04/C05/C08–C12 names collide with Ring-0/Ring-1 owners if treated as second writers. Alleged domain names are conceptually cleaner as payload specialties — **coherence ≠ authority**. See `TAXONOMY_RING0_COLLISION_ANALYSIS.md`.

## Allowed outcomes evaluation

| Outcome | Condition | Met? |
|---------|-----------|------|
| A DOMAIN_TAXONOMY_AUTHORITY_PROVEN | Master/domain taxonomy frozen; no later approved supersession | **NO** — master bytes + freeze quote unrecovered |
| B CURRENT_REPO_TAXONOMY_AUTHORITY_PROVEN | Explicit approved supersession exists | **NO** |
| C XCAT_TAXONOMY_AUTHORITY_HOLD | Neither conclusive | **YES** |

## Prepared choices for founder ratification (no implementation)

**Choice 1 — CURRENT_REPO**  
Retain registry names; still require explicit protocols that avoid Ring-0 duplicate writers (likely “category invokes kernel X as read-only projector” contracts) before any engine work.

**Choice 2 — DOMAIN**  
Ratify Translate/Learn/Business/Code/Multimedia/Career/Creative (and aligned C01–C03/C06/C07 labels) as XCAT C01–C12; migrate registry; still forbid second writers for truth/privacy/authority/provenance/capability/lifecycle.

Until one choice is explicitly ratified (or master-design freeze bytes are supplied and verified), **do not implement missing categories**.

## Runtime

**NONE** — no registry, Rust, WASM, TypeScript, schema, routing, or UI edits in Task 56A.

## Relation to Task 56

Task 56 HOLD (`XCAT_CONTRACT_RECOVERY_HOLD_C04_C05_C08_C09_C10_C11_C12`) remains valid for unrecovered **protocols** under the current name table. Task 56A adds: the **name table’s own normative authority** is also unresolved.
