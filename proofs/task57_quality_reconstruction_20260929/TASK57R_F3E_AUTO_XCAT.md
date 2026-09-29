# Task 57R-F3E — AUTO-XCAT / default task routing

**Superseded.** `auto_route_task` is not the tip router. See `TASK57R_F3E_AUTO_XCAT_CLOSURE.md`.

Status: implementation on `cursor/spe-quality-delta-planb-validate-only-20260929`.
F3D at `83c354f51af1c4a967811ed03284b4e539925e55` remains the prior HOLD inspection.
This document does not reopen that inspection and does not authorize merge, deploy, or host.

## Contract

`auto_route_task` (`xcat.auto.v1`) is the canonical task→XCAT receipt.
`route_mission_stage` (`xcat.router.v1`) is unchanged: explicit `CAT:Cxx` only, never a C01 default.

Precedence:

1. Explicit evidence that `route_mission_stage` would mark `ROUTED` stays `ROUTED`.
   Recovered ids are `CAT:C01`, `CAT:C02`, `CAT:C03`, `CAT:C06`, `CAT:C07` (`protocol_status=RECOVERED`).
   Explicit `CAT:C04`, `CAT:C05`, `CAT:C08`–`CAT:C12` stay `ROUTED` with `protocol_status=NOT_RECOVERED`.
   Self-selected category without evidence stays `UNKNOWN`.
2. Product bridges inside the receipt only: Research→`CAT:C02`, Analysis→`CAT:C06`, Writing→`CAT:C03`.
   Writing is not added to K3 `DISPLAY_LABEL_XCAT`.
3. Product or protocol names for unrecovered categories (`Coding`, `Business`, `Education`, `Creative`, `Multilingual`, `Website / 3D`, `Image`, `Video`, and their protocol ids) are `PROTOCOL_HOLD` with `primary_category=null`.
4. Exactly one raw structured flag maps to a recovered id: retrieval→C02, comparison→C06, revision→C03, execution prep→C07.
   Two or more flags are `NEEDS_DISAMBIGUATION`. Prose does not infer C07.
5. Otherwise a whole-token goal scan may route one recovered group.
   Unrecovered name tokens hold. Zero or several recovered groups disambiguate.
6. Generic Create (`AI Assistant`, no recovered signal) is `NEEDS_DISAMBIGUATION`.
   `AI Assistant` is a presentation label, not an XCAT id. Taxonomy remains C01–C12.

Every receipt sets `execution_authorized=false`, `claims_pass=false`, and `effect_plan="NO_EFFECT_PLAN"`.
That sentinel is not a compiled prompt and is not `prompt_effect_plan`.

## K3 and Quality

K3 attaches `category_context.auto_xcat` after `inputs_digest`.
Technique selection, `xcat_id`, `selection_id`, and `prompt_effect_plan` stay on the frozen selector.

Quality `subject_from_k3` keeps an explicit `xcat_id` when present.
A recovered `ROUTED` receipt may fill `active_category` only for C01/C02/C03/C06/C07.
Hold dispositions leave the category empty and mark `bind:xcat` `UNKNOWN`
(`AUTO_XCAT_NEEDS_DISAMBIGUATION`, `AUTO_XCAT_PROTOCOL_HOLD`, or `AUTO_XCAT_UNKNOWN`).
Hand-built subjects without a receipt keep `UNSATISFIED` / `CATEGORY_MISMATCH`.
`VALIDATE_ONLY` with that UNKNOWN obligation does not return PASS.
`_xcat_identity` does not include `auto_disposition`.

## Claim boundary

Proven only by the tests named in `TASK57R_F3E_RESULTS.md`.
Unrecovered category protocols are not invented.
No TypeScript semantic brain, no hosting, no deploy, no other-lane edits.

DO NOT MERGE.
DO NOT DEPLOY.
DO NOT HOST.
