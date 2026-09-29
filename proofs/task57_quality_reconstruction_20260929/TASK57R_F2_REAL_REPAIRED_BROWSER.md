# Task57R-F2 real repaired browser path

Starting head: `0332aae19cb4d36b4fca480e22110b6c15b42ccc`.

## Fault injection

The Chrome test wraps `window.Worker` before the page loads. On the repaired case only, that wrap copies the real `type: "quality"` message and removes the first hard-constraint bullet from `compiled_prompt` before `postMessage`. The page's own request object is not mutated. Production source has no query flag and no debug mutation mode. The wrap exists only in `apps/web/scripts/test-create-quality-browser.mjs`.

## What Chrome observed

Request: "Write a four-week launch checklist. Budget must remain $2000. Do not invent extra spend."

Removed bullet: `Preserve the user's stated goal without inventing obligations`.

Real WASM `from_k3` result:

| Field | Observed |
| --- | --- |
| quality posts | 1 |
| `reconstruction.kept` | `original` |
| `plan.disposition` | `UNRESOLVED` |
| `quality_delta.disposition` | `UNRESOLVED` |
| `plan.attempt_index` | 1 |
| `plan.max_attempts` | 1 |
| `plan.reason_codes` | `SCOPE_ESCAPE`, `UNRESOLVED` |
| `receipt.verdict` | `FAIL` |
| visible prompt equals kernel kept prompt | no |
| visible prompt equals corrupted candidate | no |

The visible prompt stayed the canonical pre-corruption prompt. Copy, JSON, `.spe`, and history matched that visible prompt. They did not match the corrupted candidate.

An unarmed Create click also kept the canonical prompt. Its plan disposition was `UNRESOLVED`, not a repaired swap. Aborting `spe_wasm.wasm` still showed Safe fallback, kept the request text, did not say verified, and offered no `.spe` download.

## Why this is not a repaired PASS

`qualifyRepairedBrowserObservation` refuses the case. Receipt text is not consulted. A pass requires `visible == kept_subject.compiled_prompt`, `visible != corrupted`, `kept == repaired`, plan `ACCEPTED`, delta `IMPROVED`, empty `protected_regressions`, receipt `PASS`, one quality post, and `max_attempts == 1`.

The same live subject, checked in Python before the browser run, chooses `RESTORE_MISSING_CONSTRAINT` and then returns delta `UNRESOLVED` with reason codes `CATEGORY_MISMATCH`, `MISSING_CONSTRAINT`, and `MISSING_PROOF`. Real K3 output has no `proof_refs` and no `taxonomy_version`. F2 forbids changing proof refs, ProtectedIntent, the requirement graph, XCAT, K3 techniques, the effect plan, authority, or budget. Adding those fields in the test would not be a prompt-only fault. No production backdoor was added.

## Hold

`HOLD_LIVE_CREATE_REPAIR_NOT_ACCEPTED`

The repaired browser qualification is not closed.
