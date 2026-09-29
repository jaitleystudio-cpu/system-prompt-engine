# TAXONOMY SOURCE MATRIX — Task 56A

**Date:** 2026-09-29  
**Base SHA:** `9208a57a48a3ed3b53d3389e2280f1ab954c7bba`  
**Mission:** SPEC CUSTODY / ARCHITECTURE AUTHORITY RECONCILIATION — proof only

## Evidence classes (mandatory distinction)

| Class | Meaning | Normative? |
|-------|---------|------------|
| **EXPLICIT_TAXONOMY** | Exact C01–C12 name table recovered from authoritative bytes | Candidate for authority |
| **ARCH_OWNERSHIP** | Unique-writer / layer-ownership / kernel-owner law | Constrains writers; does **not** by itself name C04–C12 |
| **INFERENCE** | Conversation paraphrase, elegance argument, UI label similarity | **Not** normative |

---

## Primary external package (founder-supplied)

**File:** `SPE_OMEGA_V2_4_1_FULL_FINAL_ARCHITECTURE.pdf`  
**Path inspected:** `/Users/prawinpalisetty/Downloads/SPE_OMEGA_V2_4_1_FULL_FINAL_ARCHITECTURE.pdf`  
**SHA-256:** `f854db173d33a06ff5ef9b88c33899e342f19a3f06e2f92967ce6b793d0b69d2`  
**Pages:** 105  
**Text extract chars:** 109387 (via pypdf)

### Explicit source-precedence law (PDF bytes)

```text
v2.4.1 Reviewer-Corrected Gate Order - lifecycle and sequencing.
v2.4 Reviewer Hardening Plan - hermetic replay, proof typing, concurrency realism, enterprise compatibility.
v2.3 Verifiable Normative Core - Ring-0 semantic kernel.
v2.1 F1-F52 Architecture Atlas - complete preserved product vision and deferred fabrics.
```

### Embedded attachments (extracted)

| Attachment | SHA-256 | Role |
|------------|---------|------|
| `SPE_OMEGA_V2_4_HERMETIC_REVIEWER_PACK_v4.zip` | `b8a512c9c3b44938a7b91238476067c17b26e8c2bfd9985a5db3b6a0c5da4a29` | Hermetic G0 pack |
| `SPE_OMEGA_V2_4_1_REVIEWER_HARDENING_PLAN.md` | `34a5fb84f89641ef5e112e2eca1fc83227ab99d548c2adb84c4ce62c530c4f30` | Gate-order plan |
| `SPE_OMEGA_V2_3_NORMATIVE_CORE_SPEC.md` | `aa60bd9b044267c94596e86c0f3e94813622e452955820f992b0dfd681c3f981` | Ring-0 freeze subject |
| `SPE_G0_INDEPENDENT_REPLAY_RECEIPT_v1.json` | `05eb4f50661d2bca682211ddb1583b0dc87d1f9c53c4ec01014d2fba91a09e59` | G0 receipt |

### Taxonomy byte search in PDF + attachments

| Needle | In PDF text? | In embedded MD/JSON? | In hermetic ZIP contents? |
|--------|--------------|----------------------|---------------------------|
| `CAT:C04` / `C04 Translate` / `C04 Plan` | **NO** | **NO** | **NO** |
| `LanguageTransferProjectIR` | **NO** | **NO** | **NO** |
| `LearningProjectIR` / `BusinessProjectIR` / `CodeProjectIR` / `MultimediaProjectIR` / `CareerProjectIR` / `CreativeProjectIR` | **NO** | **NO** | **NO** |
| `CategoryRouterIR` / `XCATEnvelopeIR` | **NO** | **NO** | **NO** |
| `taxonomy` (as C01–C12 table) | **NO** | **NO** | **NO** |
| `XCAT` | **NO** | **NO** | **NO** |
| `category route / category payload → L2` | **YES** (F28) | via v2.1 addendum in ZIP | **YES** |
| Unique semantic ownership / no legacy duplicate writers | **YES** | **YES** (v2.3 core) | **YES** |

**Conclusion for PDF package:** establishes **ARCH_OWNERSHIP** (single writer; L2 owns category route/payload; legacy atlas is not an extra canonical writer). Does **not** establish **EXPLICIT_TAXONOMY** for either the current-repo C04–C12 names or the alleged domain C04–C12 names.

---

## Claimed external master design (not recovered as bytes here)

| Claimed file | Status in this reconciliation |
|--------------|-------------------------------|
| `SPE_OMEGA_V2_1_MASTER_ARCHITECTURE_DESIGN.md` | **NOT FOUND** as readable bytes in: PDF attachments, hermetic ZIP, git object history (`git log -S` / `git grep` for `LanguageTransferProjectIR` / filename), Downloads, Desktop/`spe data`, Documents/Codex (shallow), Spotlight name/content queries |

**What exists instead in the PDF/ZIP lineage:**  
`SPE_OMEGA_V2_1_FINAL_CLOSURE_ADDENDUM_v6_FEASIBILITY.md` (SHA-256 `3645d645…`) — F1–F52 atlas / feasibility; owns L2 category *route/payload* slot; **does not** define the alleged C01–C12 domain name table.

**Conversation / task-brief quotes** of the master taxonomy are classified **INFERENCE / SECONDARY REPORT**, not EXPLICIT_TAXONOMY, until the master file bytes are supplied and hashed.

---

## Repository sources

| Source | SHA / path | Evidence class | Content |
|--------|------------|----------------|---------|
| `data/category_registry_v1.json` | introduced `6c7fa1d654d73fcbaf35699a5c226261538fd46f` (2026-09-15) | EXPLICIT_TAXONOMY (names only) | C01 Decide … C12 Capability |
| `schemas/category_registry.schema.json` | same commit | STUB | `additionalProperties: true` |
| Sprint docs `xcat-core-s1.md`, s2, s3 | `6c7fa1d` / `a8078e8` / `f8d7bf2` | Implementation contract for C01/C02/C03/C06/C07 only | No protocols for C04/C05/C08–C12 |
| K3 `IMPLEMENTED_XCAT` / `UNIMPLEMENTED_XCAT` | `spe_runtime/k3/registry.py` @ HEAD | Implementation disposition | Seven IDs unimplemented → `NO_SELECTION` |
| `DISPLAY_LABEL_PROTOCOL` | `spe_runtime/k3/registry.py` | Product/UI labels — **not** XCAT IDs | Writing, Coding, Business, Creative, Multilingual, … |
| Task 56 proof pack | `proofs/xcat_v1_closure_20260929/*` | Custody of unrecovered protocols | HOLD for seven categories |

---

## Two competing taxonomies (as stated in mission)

### A — Current repo registry (bytes present)

```text
C01 Decide
C02 Research
C03 Communicate
C04 Plan
C05 Verify
C06 Analyze
C07 Execute
C08 Recover
C09 Privacy
C10 Authority
C11 Provenance
C12 Capability
```

Authority status of this table as **founder-frozen XCAT taxonomy:** **NOT PROVEN** (implementation introduction; no freeze/approval receipt found).

### B — Alleged master/domain taxonomy (bytes NOT recovered)

```text
C01 Advise / Plan / Decide
C02 Research
C03 Write / Rewrite / Communicate
C04 Translate / Localize / Language Transform
C05 Learn
C06 Analyze / Compare / Extract
C07 Work / Execute
C08 Business
C09 Code
C10 Multimedia
C11 Career
C12 Creative / Story / Roleplay
```

Authority status: **CANNOT BE PROVEN from available authoritative bytes** — file not located; do not promote to normative.

---

## Matrix verdict

| Question | Answer |
|----------|--------|
| Does PDF define old C04/C05/C08–C12 domain names? | **NO** (exact bytes absent) |
| Does PDF forbid duplicate canonical writers? | **YES** (ARCH_OWNERSHIP) |
| Does repo define current C04–C12 names? | **YES** (names only) |
| Was current taxonomy explicitly approved as supersession of domain taxonomy? | **NO evidence** |
| Was domain taxonomy frozen with recoverable approval text? | **NO — master file bytes missing** |
| Safe promotion of either full taxonomy? | **NO → HOLD** |
