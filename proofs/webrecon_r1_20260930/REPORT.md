# SPE CURSOR C1 WEBRECON R1 REPORT

DONOR_SHA: `f2f67c0f00982c738485a103de807adde03ea80f`
REPAIR_SHA: `4f5a770f868c13a45848b377a2a3f9551a7a0ae8`
BRANCH: `cursor/spe-webrecon-r1q-20260930`
SOURCE_RUNTIME_MODIFIED: false at the scored commit
LIVE_FETCH: false
K3_INTEGRATED: false
NETWORK_ACQUISITION: NONE

FINAL: **WEBRECON_R1_REPAIR_PASS**

The seven donor failures are fixed in the runtime. The R1 oracles were not weakened. `network_performed` stays false, `semantic_authority` stays NONE, WebGL stays unexecuted, and the capture size budget still refuses oversized input.

## Tests

Command: `python -m pytest tests/unit/test_webrecon_foundation.py tests/unit/test_webrecon_r1_qualification.py -q --tb=line`

| Suite | collected | passed | failed | skipped | errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| Combined | 37 | 37 | 0 | 0 | 0 |

Pytest summary: `37 passed`. JUnit: `tests=37 failures=0 skipped=0 errors=0`.

## Mutants

Defined WR1-01 through WR1-20. Killed 20. Survived 0. Broken 0.

A kill means an oracle that passes on this repair fails on a temporary copy. The worktree package is not patched.

| ID | Defect | Result | Killed by |
| --- | --- | --- | --- |
| WR1-01 | script executed | KILLED | active script/onclick/svg/form quarantine |
| WR1-02 | onclick active | KILLED | active script/onclick/svg/form quarantine |
| WR1-03 | javascript URL active | KILLED | active script quarantine and meta refresh withholding |
| WR1-04 | secret copied | KILLED | password/hidden value withholding |
| WR1-05 | data payload copied | KILLED | data payload withholding |
| WR1-06 | network silently enabled | KILLED | network_performed stays false |
| WR1-07 | malformed marked complete | KILLED | empty document stays REFUSE |
| WR1-08 | unknown asset known | KILLED | unknown extension stays OTHER |
| WR1-09 | missing CSS inferred | KILLED | missing stylesheet is not inferred |
| WR1-10 | source order lost | KILLED | source order preserved |
| WR1-11 | media query fabricated | KILLED | media query set stays exact |
| WR1-12 | WebGL becomes execution | KILLED | webgl.executed stays false |
| WR1-13 | camera invented | KILLED | camera stays UNOBSERVED |
| WR1-14 | private IP accepted | KILLED | canonical and obscured loopback stay refused |
| WR1-15 | credential URL accepted | KILLED | credential URLs stay refused |
| WR1-16 | path traversal retained | KILLED | literal `../` target still resolves without a `..` segment |
| WR1-17 | duplicate IDs normalized as proven | KILLED | both `id=dup` stay |
| WR1-18 | huge capture bypasses budget | KILLED | capture and html budgets hold |
| WR1-19 | gap disappears | KILLED | LAYOUT_NODE_CAP stays INCOMPLETE |
| WR1-20 | semantic_authority elevated | KILLED | semantic_authority stays NONE |

## Field results

NETWORK: PASS. `network_performed` stays false. No socket and no `urlopen`.

ACTIVE_CONTENT: PASS. `url(javascript:...)`, `@import 'javascript:...'`, and javascript meta refresh are digested and do not become same-document assets or copied secrets. Script, onclick, SVG, and form javascript stay quarantined.

SENSITIVE_FIELDS: PASS. Password, hidden, textarea, and option values stay out of the contract.

URL_SAFETY: PASS. Encoded `%2e%2e` and `%2f` do not remain in `url_identity` or `resolved_ref`. `127.1`, `0177.0.0.1`, and `2130706433` are `WR_PRIVATE_HOST_REFUSED`. `javascript:`, `file:`, `data:`, and credential URLs stay refused.

MALFORMED_INPUT: PASS. `<<<<not-a-document>>>>` is `REFUSE` / `WR_MALFORMED_DOCUMENT`. Whitespace capture stays `REFUSE` / `WR_EMPTY_DOCUMENT`.

DETERMINISM: PASS.

WEBGL_BOUNDARY: PASS. `executed` stays false.

SCALE_BOUNDARY: PASS. Capture and html budgets hold. `LAYOUT_NODE_CAP` stays `INCOMPLETE` with layout fidelity `PARTIAL`.

SEMANTIC_AUTHORITY: PASS. Authority stays `NONE`.

LIVE_FETCH: false
K3_INTEGRATED: false

## Evidence

- `proofs/webrecon_r1_20260930/pytest.txt`
- `proofs/webrecon_r1_20260930/junit.xml`
- `proofs/webrecon_r1_20260930/baseline_oracles.json`
- `proofs/webrecon_r1_20260930/mutation_results.json`

No merge, no deploy, no host.
