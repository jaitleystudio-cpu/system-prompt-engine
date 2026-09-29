# TAXONOMY TIMELINE — Task 56A

**Base SHA:** `9208a57a48a3ed3b53d3389e2280f1ab954c7bba`  
**Rule:** IMPLEMENTED ≠ APPROVED ARCHITECTURE. Do not infer approval from code existence.

| DATE | SOURCE | SHA / FILE | TAXONOMY | STATUS | EXPLICIT OWNER APPROVAL? | NORMATIVE / DESIGN / IMPLEMENTATION / STUB | SUPERSEDES WHAT? | EVIDENCE |
|------|--------|------------|----------|--------|--------------------------|---------------------------------------------|------------------|----------|
| ≤2026-09-18 (pack date) | PDF Part V + ZIP | `SPE_OMEGA_V2_1_FINAL_CLOSURE_ADDENDUM_v6_FEASIBILITY.md` @ SHA `3645d645…` inside hermetic ZIP | L0–L15 ownership incl. L2 = category route/payload; **no C01–C12 name table** | Atlas / design inventory | No freeze of C01–C12 names found | DESIGN (atlas) | N/A — does not name XCAT Cxx | PDF precedence item 4; F28 ownership map |
| 2026-09-18 | PDF + embed | `SPE_OMEGA_V2_3_NORMATIVE_CORE_SPEC.md` SHA `aa60bd9b…` | K0–K7 Ring-0 owners only; legacy L0–L15/F1–F52 “not additional canonical writers” | DESIGN-CLOSED subject = compact kernel, not XCAT taxonomy | Freeze subject is Ring-0 kernel packet, **not** XCAT C01–C12 names | NORMATIVE (Ring-0) | Does not define/supersede XCAT category names | Embedded MD + PDF Part IV |
| 2026-09-18 | PDF + embed | `SPE_OMEGA_V2_4_1_REVIEWER_HARDENING_PLAN.md` SHA `34a5fb84…` | Gate order G0→G9; no C01–C12 table | Sequencing correction | N/A for taxonomy | NORMATIVE (lifecycle/sequencing) | Prior wrong TLC-before-binding roadmap | PDF precedence item 1–2 |
| 2026-09-18 | Founder PDF package | `SPE_OMEGA_V2_4_1_FULL_FINAL_ARCHITECTURE.pdf` SHA `f854db17…` | Source precedence law; F28 unique ownership; **no C04 Translate / C04 Plan taxonomy tables** | Consolidated architecture package | Package itself is human-readable consolidation; G0 PASS only for hermetic fixtures | DESIGN+NORMATIVE mix per precedence | Older atlas text yields to later corrections **when conflicting** — but no Cxx name conflict is stated in PDF | Extracted text + attachments |
| **NOT RECOVERED** | Claimed ChatGPT/SPE Library | `SPE_OMEGA_V2_1_MASTER_ARCHITECTURE_DESIGN.md` | Alleged domain C01–C12 (Translate/Learn/Business/…) | Claimed “DESIGN HARDENED — pending owner review/freeze” in task brief | **No recoverable “Approved, freeze v2.1” bytes in repo/PDF/local search** | Unverified secondary report | Cannot evaluate supersession without bytes | File not found; see TAXONOMY_SOURCE_MATRIX.md |
| 2026-09-15 11:28 UTC | Git commit | `6c7fa1d654d73fcbaf35699a5c226261538fd46f` | Introduces `data/category_registry_v1.json` with **current** C01–C12 English names | NEW_IMPLEMENTATION Sprint 1 | **NO** — commit message is feat/xcat Sprint 1; no founder freeze receipt for taxonomy | IMPLEMENTATION (names) + STUB schema | No prior registry in repo to supersede; no citation of domain taxonomy | `git show 6c7fa1d` |
| 2026-09-15→ | Git | Sprint 2 `a8078e8` / Sprint 3 `f8d7bf2` | Implements C01/C02/C03/C06/C07 engines only | Partial XCAT runtime | Implementation PRs #1–#3; not a taxonomy freeze of C04–C12 | IMPLEMENTATION | Leaves C04/C05/C08–C12 as names without protocols | SPE-CHANGELOG; engines tree |
| 2026-09-xx | Git | K3 registry `IMPLEMENTED_XCAT` / `UNIMPLEMENTED_XCAT` | Marks seven IDs unimplemented | Fail-closed selection | No | IMPLEMENTATION disposition | Does not rename categories | `spe_runtime/k3/registry.py` |
| Product UI | HEAD | `DISPLAY_LABEL_PROTOCOL` | Writing/Coding/Business/Creative/Multilingual/… | Product display protocols | No | IMPLEMENTATION (UI/product) | Explicitly **not** XCAT IDs (only Research→C02, Analysis→C06 mapped) | `DISPLAY_LABEL_XCAT` |
| 2026-09-29 | Task 56 | proofs `06dcb59`→`9208a57` | Documents unrecovered C04/C05/C08–C12 under **current names** | HOLD | N/A | CUSTODY PROOF | Does not invent semantics | `FINAL_REPORT.md` |
| 2026-09-29 | Task 56A | this pack | Authority reconciliation | **XCAT_TAXONOMY_AUTHORITY_HOLD** | Neither taxonomy proven authoritative | CUSTODY PROOF | No runtime change | This timeline |

## Timeline reading (non-inferential)

1. **Authoritative PDF package (2026-09-18)** freezes Ring-0 ownership and sequencing; preserves F1–F52 atlas; **does not publish an XCAT C01–C12 name table**.
2. **Repository registry (2026-09-15)** publishes a 12-name table in an implementation commit **without** an accompanying founder freeze that those names supersede any domain taxonomy.
3. **Alleged domain taxonomy** appears only as a secondary claim in the Task 56A brief; authoritative master-design bytes were **not recovered** in this pass.
4. Therefore chronology alone cannot award authority to either taxonomy.

## Gaps requiring founder action

- Supply `SPE_OMEGA_V2_1_MASTER_ARCHITECTURE_DESIGN.md` bytes (or prove absence), **or**
- Explicitly ratify CURRENT_REPO or DOMAIN taxonomy as the normative XCAT C01–C12 table.
