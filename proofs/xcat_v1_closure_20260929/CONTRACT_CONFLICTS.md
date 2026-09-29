# XCAT v1 Contract Conflicts — 2026-09-29

Base SHA: `04bc003ce358fc72279ce40cb96fa2990f8033c6`

Conflicts below are **documented, not silently resolved into invented XCAT engines**.

## C1. Name registry vs protocol absence

- **A:** `data/category_registry_v1.json` lists C04/C05/C08–C12 with English names.
- **B:** No ownership table, engine, schema (non-stub), fixture, or mutation defines their writes/reads.
- **Precedence:** Name alone is insufficient (founder Evidence Law). Status = NOT_RECOVERED.
- **Resolution:** HOLD — do not invent from English meaning.

## C2. CAT:C04 Plan vs K3 CognitivePlan

- **A:** Registry name “Plan”.
- **B:** K3 owns `CognitivePlan` / technique plan-kinds / PlanningHints (G1R-7R, K3_CONTRACT_RECOVERY).
- **Precedence:** Ring-0/K3 frozen contract outranks bare category name.
- **Resolution:** Cannot promote K3 plan artifacts into CAT:C04 without an explicit XCAT bridge contract (absent).

## C3. CAT:C05 Verify vs K2 verification receipt

- **A:** Registry name “Verify”.
- **B:** RING0_WORKING_CONTRACT assigns verification receipt / proof verify to **K2**.
- **C:** Sprint 3 forbids C07 claiming VERIFIED_SUCCESS without evidence — Execute constraint, not Verify category.
- **Resolution:** HOLD. CATEGORY != KERNEL OWNER — C05 must not become a duplicate verification oracle.

## C4. CAT:C08 Recover vs K7 RecoveryPlan

- **A:** Registry name “Recover”.
- **B:** `recovery_plan.schema.json` + `spe_runtime/recovery/plan.py` are **K7 Ring-1** journal recovery.
- **Resolution:** HOLD. Do not alias Ring-1 recovery plan as CAT:C08.

## C5. CAT:C09 Privacy vs K4 privacy_projection

- **A:** Registry name “Privacy”; stub `privacy_label.schema.json`.
- **B:** K4 owns privacy projection + egress (G1R-5, RING0).
- **C:** Grounding PrivacyClass is a separate layer.
- **Resolution:** HOLD. Inventing C09 as writer duplicates K4.

## C6. CAT:C10 Authority vs K4 AuthorityGrant

- **A:** Registry name “Authority”; stub authority_state schema.
- **B:** K4 is sole Ring-0 authority writer; C07 consumes external grants and must not mint.
- **C:** Envelope `authority_state` exists as a field without an XCAT C10 engine.
- **Resolution:** HOLD. C10 cannot self-mint or duplicate K4.

## C7. CAT:C11 Provenance vs C02 / K1 provenance writers

- **A:** Registry name “Provenance”; stub provenance_record schema.
- **B:** C02 is the implemented XCAT writer of envelope provenance; semantic_writer_map assigns `facts_provenance_uncertainty` to K1/C02.
- **C:** K0/K1 provenance rules modules exist separately.
- **Resolution:** HOLD. Second provenance writer would violate SINGLE WRITER LAW.

## C8. CAT:C12 Capability vs K3/K7/providers

- **A:** Registry name “Capability”; stub capability_manifest schema.
- **B:** K3 “capability routing (prompt/strategy)”; K7 `capability_status`; providers `CapabilityNeed` (non-authority).
- **C:** Product protocol auto-routing (2026-09-24) is not XCAT.
- **D:** `spe_runtime/capabilities/` RETIRE stub in G1 disposition.
- **Resolution:** HOLD.

## C9. Display labels vs XCAT IDs

- **A:** UI labels Writing/Coding/Business/… in `DISPLAY_LABEL_PROTOCOL`.
- **B:** Only `Research→CAT:C02` and `Analysis→CAT:C06` in `DISPLAY_LABEL_XCAT`.
- **Resolution:** Do not force-map UI protocols to C04–C12.

## C10. Product “category protocol compiler” vs XCAT

- **A:** Docs/plans titled “category protocol” (bd0dcb8, 8b336ad, a858eb0) define product/domain protocols.
- **B:** XCAT CAT:Cxx is a separate namespace with CrossCategoryEnvelope ownership.
- **Resolution:** Treat product protocols as non-normative for XCAT C04–C12 recovery.

## Unresolvable without new founder freeze

All conflicts C2–C8 require an explicit normative XCAT protocol (or an explicit “category invokes kernel X as read-only projector” contract) before implementation. None was found in tree or history.

---

## APPENDIX — Task 56B DOMAIN resolution (2026-09-29)

Task 56A / early Task 56 conflicts C1–C8 were correctly **HOLD** under legacy registry names (Plan/Verify/Recover/Privacy/Authority/Provenance/Capability).

**Resolution path (not a silent 56A approval):** founder ratified DOMAIN taxonomy on 2026-09-29. Collision English names are superseded:

| Legacy conflict | DOMAIN resolution |
|-----------------|-------------------|
| C04 Plan vs K3 CognitivePlan | C04 = Translate / Localize; CognitivePlan remains K3 |
| C05 Verify vs K2 | C05 = Learn; verification remains K2 |
| C08 Recover vs K7 | C08 = Business; recovery remains K7 |
| C09 Privacy vs K4 | C09 = Code; privacy remains K4 |
| C10 Authority vs K4 | C10 = Multimedia; authority remains K4 |
| C11 Provenance vs C02/K1 | C11 = Career; provenance writers unchanged |
| C12 Capability vs K3/K7 | C12 = Creative; capability registries unchanged |

CATEGORY ≠ KERNEL OWNER preserved. `duplicate_writers=0`. Legacy payloads → migrate or `LEGACY_TAXONOMY_UNMIGRATED`.
