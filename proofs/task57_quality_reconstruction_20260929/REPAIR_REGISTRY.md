# Repair registry

Lawful operations, in smallest-first order:

1. `RESTORE_MISSING_CONSTRAINT`
2. `RESTORE_UNKNOWN_MARKER`
3. `REMOVE_UNAUTHORIZED_ADDITION`
4. `RESTORE_AUTHORIZED_OUTPUT_CONTRACT`
5. `RESTORE_REQUIRED_SECTION`
6. `RENDER_FROM_BOUND_EFFECT_PLAN`

`RENDER_FROM_BOUND_EFFECT_PLAN` copies `effect_plan.compiled_prompt` only when the plan is renderable, its protected fields match the protected intent, its techniques match K3, and its category matches XCAT taxonomy version 2.

Forbidden operations, which are refused and never applied:

- `CHANGE_USER_GOAL`
- `INVENT_FACT`
- `INVENT_EXAMPLE`
- `INVENT_RETRIEVAL_RESULT`
- `MINT_AUTHORITY`
- `CHANGE_CATEGORY`
- `CHANGE_K3_TECHNIQUE`
- `EXECUTE_TOOL`
- `WEAKEN_CONSTRAINT`

No repair operation calls a model, opens a network connection, or mints authority.
