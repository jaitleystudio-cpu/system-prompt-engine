# TAXONOMY RING-0 COLLISION ANALYSIS — Task 56A

**Base SHA:** `9208a57a48a3ed3b53d3389e2280f1ab954c7bba`  
**Law preserved:** CATEGORY ≠ KERNEL OWNER. Categories may consume/invoke/project canonical kernel semantics; they may **not** create second authorities for truth, proof, privacy, authority, provenance, capability qualification, or lifecycle.

**Important:** This section analyzes **semantic coherence / duplicate-writer risk**. It is **not** historical proof of which taxonomy is authoritative.

Ring-0 owners (from v2.3 normative core / `SPE_KERNEL_OWNER_DAG_v2.json`):

| Owner | Owns (abbrev.) |
|-------|----------------|
| K0 | Constitution / Intent |
| K1 | Requirement / Epistemic (claims, evidence, …) |
| K2 | Proof transaction / verification receipts |
| K3 | Strategy / CognitivePlan / CapabilityRegistry / prompts |
| K4 | Authority + Privacy |
| K5 | ABI / Schema / Errors |
| K6 | Artifact + Lineage |
| K7 | Qualification + Lifecycle |

PDF/F28 also maps legacy L2 → category route/payload and L5 → strategy/cognitive plan/capabilities, L6 → authority, L12 → privacy/security, L13 → qualification, L15 → lifecycle — reinforcing separation of category payload from kernel facts.

---

## Current repo taxonomy — collision screen

| ID | Registry name | Nearby kernel/legacy owner | Duplicate-writer risk if promoted to canonical writer without bridge contract |
|----|---------------|----------------------------|-------------------------------------------------------------------------------|
| C04 | Plan | K3 `CognitivePlanIR` / L5 strategy-cognitive-plan | **HIGH** — second plan authority |
| C05 | Verify | K2 verification receipts / proof verify | **HIGH** — second verification oracle |
| C08 | Recover | K7 / Ring-1 recovery_plan | **HIGH** — second recovery plan writer |
| C09 | Privacy | K4 `PrivacyContractIR` / L12 | **HIGH** — second privacy authority |
| C10 | Authority | K4 `AuthorityGrantIR` / L6 | **HIGH** — second authority mint path |
| C11 | Provenance | K1/C02 provenance writers; lineage K6 | **HIGH** — second provenance writer |
| C12 | Capability | K3 CapabilityRegistry / K7 qualification / providers | **HIGH** — second capability authority |

Recovered engines C01/C02/C03/C06/C07 were previously shown compatible when constrained (e.g., C07 consumes external grants; does not mint). The seven unrecovered names above are the collision set Task 56 already documented.

**current_repo collision summary:** MATERIAL for C04/C05/C08–C12 vs Ring-0/Ring-1 owners.

---

## Alleged domain taxonomy — collision screen

*(Names treated as **hypothetical / secondary-reported**, not recovered bytes.)*

| ID | Alleged name | Nearby kernel owners | Duplicate-writer risk |
|----|--------------|----------------------|------------------------|
| C04 | Translate / Localize / Language Transform | Cross-lingual prompt compilation (F23) is a fabric/technique concern, not K2/K4 truth | **LOW** for kernel truth/privacy/authority — domain payload specialization |
| C05 | Learn | No Ring-0 “Learn” owner | **LOW** if payload-only |
| C08 | Business | Product/UI Business label exists; not a kernel owner | **LOW** if payload-only |
| C09 | Code | Repo intelligence fabric F4 is expansion fabric, not Ring-0 writer for privacy/authority | **LOW** if payload-only |
| C10 | Multimedia | Media fabrics deferred in Phase-A | **LOW** if payload-only |
| C11 | Career | No kernel owner | **LOW** if payload-only |
| C12 | Creative / Story / Roleplay | Product Creative label; not kernel owner | **LOW** if payload-only |

Caveat required by PDF: category modules must **not** redefine truth, provenance, authority, privacy, uncertainty (stated as architectural preference in Task 56A brief; PDF/v2.3 establish unique ownership — category payloads under L2 must not become extra canonical writers for K1/K2/K4/K7 facts).

**domain_taxonomy collision summary:** Conceptually cleaner vs Ring-0 **if** categories only specialize payloads. **Still not proven as frozen authority** because master-design bytes were not recovered.

---

## Architectural ownership evidence (not taxonomy names)

From PDF / v2.3:

- Exactly eight Ring-0 canonical semantic owners.
- Legacy L0–L15/F1–F52 preserved as atlas; **not** additional canonical writers.
- L2 owns category route / category payload (ownership slot exists; **name table absent**).

This supports the **CATEGORY ≠ KERNEL OWNER** law and explains why inventing C09 Privacy / C10 Authority engines would violate F28 — independent of which English names are eventually ratified.

---

## Do-not-promote list

Do **not** treat coherence preference as ratification. Founder must still freeze one taxonomy (or supply master-design bytes that were already frozen).

---

## APPENDIX — Task 56B DOMAIN ratification effect (2026-09-29)

56A concluded domain names were conceptually cleaner **if** payload-only, but **not proven as authority**. That remains historically true for 56A.

**Update:** founder ratification (`XCAT_V1_DOMAIN_TAXONOMY_FOUNDER_RATIFIED`) freezes DOMAIN names. Collision screen for **legacy** names still stands as why those names must not return as canonical writers.

DOMAIN collision screen (payload-only engines):

| ID | DOMAIN name | Duplicate-writer risk vs Ring-0 |
|----|-------------|----------------------------------|
| C04 | Translate / Localize | LOW if payload-only (observed) |
| C05 | Learn | LOW if payload-only |
| C08 | Business | LOW if payload-only |
| C09 | Code | LOW if payload-only (≠ Privacy) |
| C10 | Multimedia | LOW if payload-only (≠ Authority) |
| C11 | Career | LOW if payload-only |
| C12 | Creative | LOW if payload-only |

Enforcement: `apply_category_payload` + ownership matrix + mutations M11/M14/M16. `duplicate_writers=0` required and checked in 56B proofs.
