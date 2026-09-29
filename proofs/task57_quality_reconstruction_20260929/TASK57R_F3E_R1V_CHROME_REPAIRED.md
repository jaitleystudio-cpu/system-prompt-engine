# Task57R-F3E-R1V repaired Chrome

**Base SHA:** `f07511d9e2def7aa7129fa2c718b76e4ec9f1407`
**Harness:** `apps/web/scripts/test-create-quality-r1v.mjs`
**Fault:** the same one-shot worker wrap as F3/F3E. `dropOneHardConstraint` removes the first `- ` bullet under `## Hard constraints`. The fixture supplies `Preserve the user's stated goal without inventing obligations` when the idea has no extra hard-constraint atoms. `max_attempts` stays 1. Production bundles do not contain the fault.

Qualification uses `qualifyRepairedBrowserObservation` from `apps/web/scripts/repaired-browser-qualification.mjs`. A row is PASS only when that function returns no errors and the kernel category is unchanged. That function requires:

- quality posts = 1
- `attempt_index` ≤ 1 and `max_attempts` = 1
- kept = `repaired`
- plan = `ACCEPTED`
- delta = `IMPROVED`
- protected regressions empty
- receipt verdict = `PASS`
- visible, history artifact, history prompt, copy, JSON, and `.spe` equal the kept prompt
- visible is not the corrupted prompt
- only the diagnosed hard constraint is restored

| Category | Active | Route | Plan | Kept | Attempts | Receipt | claims_pass | execution_authorized | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CAT:C01 | C01 | CAT:C01 | ACCEPTED | repaired | 1 / 1 | PASS | false | false | PASS |
| CAT:C02 | C02 | CAT:C02 | ACCEPTED | repaired | 1 / 1 | PASS | false | false | PASS |
| CAT:C03 | C03 | CAT:C03 | ACCEPTED | repaired | 1 / 1 | PASS | false | false | PASS |
| CAT:C04 | C04 | CAT:C04 | ACCEPTED | repaired | 1 / 1 | PASS | false | false | PASS |
| CAT:C05 | C05 | CAT:C05 | ACCEPTED | repaired | 1 / 1 | PASS | false | false | PASS |
| CAT:C06 | C06 | CAT:C06 | ACCEPTED | repaired | 1 / 1 | PASS | false | false | PASS |
| CAT:C07 | C07 | CAT:C07 | ACCEPTED | repaired | 1 / 1 | PASS | false | false | PASS |
| CAT:C08 | C08 | CAT:C08 | ACCEPTED | repaired | 1 / 1 | PASS | false | false | PASS |
| CAT:C09 | C09 | CAT:C09 | ACCEPTED | repaired | 1 / 1 | PASS | false | false | PASS |
| CAT:C10 | C10 | CAT:C10 | ACCEPTED | repaired | 1 / 1 | PASS | false | false | PASS |
| CAT:C11 | C11 | CAT:C11 | ACCEPTED | repaired | 1 / 1 | PASS | false | false | PASS |
| CAT:C12 | C12 | CAT:C12 | ACCEPTED | repaired | 1 / 1 | PASS | false | false | PASS |

`VALIDATE_ONLY` does not elevate `UNKNOWN` to `PASS`. Display label remains `AI Assistant` on every repaired row. Kernel category is the short id above. External hosts: empty. Harness exit: 0.
