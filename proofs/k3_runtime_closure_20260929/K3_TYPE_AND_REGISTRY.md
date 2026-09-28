# K3 type and registry

Selector version: `k3.g1r7r`
Selection schema: `technique_selection.v1`
Plan schema: `cognitive_plan.v1`
Strategy schema: `prompt_strategy.v1`
Canonical writer: `select_prompt_techniques` (`spe_runtime/k3/selector.py`; Rust `spe_core_rs::k3::select`)

## TechniqueSelection

Fields that enter `selection_id` (`tsel-` + sha256 of canonical JSON):

- `schema_version`
- `cognitive_plan_id`
- `techniques`
- `justifications` (`technique`, `reason_code`, `source_refs`, `strength`)
- `deferred_techniques`
- `budget_truncated`
- `notes`

Portable fields that do not change the id: `disposition`, `selector_version`, `claims_pass` (always false), authority-effect flags (always false / empty), `category_context`, `strategy`, `protected_binding`, `inputs_digest`, `task_resolved`.

`disposition` is `SELECTED`, `SAFE_DEFAULT`, `NO_SELECTION`, or `UNKNOWN`.
`SAFE_DEFAULT` is G1R-7R `DIRECT` + `ZERO_SHOT` + `HINT_DIRECT_DEFAULT`.
`UNKNOWN` and `NO_SELECTION` are not acceptance and not PASS.

## Registry

Nine active techniques, unchanged from G1R-7R `PromptTechnique`:

`RETRIEVE_REASON`, `STRUCTURED_OUTPUT`, `DECOMPOSE_PLAN_SOLVE`, `CRITIQUE_REVISE`, `FEW_SHOT`, `CONTEXTUAL`, `ROLE_PERSONA`, `STEP_BACK`, `ZERO_SHOT`.

Budget: 3. Keep order: MUST, SHOULD, PREFERENCE, HINT, PLAN, then the priority table in `spe_runtime/k3/registry.py`, then id.
`ZERO_SHOT` and `FEW_SHOT` cannot both be selected.
No technique sets network, credentials, execute, sharing, or external write.

Implemented XCAT ids consumed as context: `CAT:C01`, `CAT:C02`, `CAT:C03`, `CAT:C06`, `CAT:C07`.
Unimplemented ids `CAT:C04`, `CAT:C05`, `CAT:C08`–`CAT:C12` return `NO_SELECTION`.
