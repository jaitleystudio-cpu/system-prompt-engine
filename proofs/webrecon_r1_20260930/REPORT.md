# SPE CURSOR C1 WEBRECON R1 REPORT

DONOR_SHA: `f2f67c0f00982c738485a103de807adde03ea80f`
BRANCH: `cursor/spe-webrecon-r1q-20260930`
QUALIFICATION_HEAD: branch tip that contains this proof. Runtime source is still the donor SHA.
SOURCE_RUNTIME_MODIFIED: false
LIVE_FETCH: false
K3_INTEGRATED: false
NETWORK_ACQUISITION: NONE

FINAL: **HOLD**

The donor fails 7 R1 oracles. Those failures are preserved. Tests were not weakened. `spe_runtime/webrecon` was not edited.

## Tests

Command: `python -m pytest tests/unit/test_webrecon_foundation.py tests/unit/test_webrecon_r1_qualification.py -q --tb=line`

| Suite | collected | passed | failed | skipped | errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| `tests/unit/test_webrecon_foundation.py` | 8 | 8 | 0 | 0 | 0 |
| `tests/unit/test_webrecon_r1_qualification.py` | 29 | 22 | 7 | 0 | 0 |
| Combined | 37 | 30 | 7 | 0 | 0 |

Pytest summary: `7 failed, 30 passed`. JUnit: `tests=37 failures=7 skipped=0 errors=0`.

## Mutants

Defined WR1-01 through WR1-20. Killed 20. Survived 0. Broken 0.

A kill means an oracle that passes on the unmodified donor fails on a temporary copy. The worktree package is not patched.

Donor already fails the target oracle for WR1-03, WR1-04, WR1-07, WR1-14, and WR1-16. Those five mutants are still killed by a different oracle that passes on the donor.

| ID | Defect | Result | Killed by |
| --- | --- | --- | --- |
| WR1-01 | script executed | KILLED | active script/onclick/svg/form quarantine |
| WR1-02 | onclick active | KILLED | active script/onclick/svg/form quarantine |
| WR1-03 | javascript URL active | KILLED | active script/onclick/svg/form quarantine |
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
| WR1-14 | private IP accepted | KILLED | canonical private hosts stay refused |
| WR1-15 | credential URL accepted | KILLED | credential URLs stay refused |
| WR1-16 | path traversal retained | KILLED | literal `../` target drops the `..` segment |
| WR1-17 | duplicate IDs normalized as proven | KILLED | both `id=dup` stay |
| WR1-18 | huge capture bypasses budget | KILLED | capture and html budgets hold |
| WR1-19 | gap disappears | KILLED | LAYOUT_NODE_CAP stays INCOMPLETE |
| WR1-20 | semantic_authority elevated | KILLED | semantic_authority stays NONE |

## Field results

NETWORK: PASS. `network_mode=NONE` is `ALLOW_CAPTURE`. `LIVE`, `REDIRECT`, `SCRIPT`, and `FETCH` return `WR_NETWORK_NOT_AUTHORIZED`. `network_performed` stays false on the decision, the contract, and the X-Ray. A capture containing an external link, a stylesheet link, and an https meta refresh opened no socket and called no `urlopen`. The https refresh did not create an asset.

ACTIVE_CONTENT: HOLD. Script bodies, onclick handlers, SVG script, javascript form actions, CSS `expression`, and CSS `behavior` stay quarantined, and script assets stay `execution=FORBIDDEN`. Three javascript carriers do not:

- `url(javascript:JSURL_SECRET)` becomes asset `JSURL_SECRET` resolved to `https://harbor.example/JSURL_SECRET` with `same_document=true`.
- `@import 'javascript:IMPORT_SECRET'` becomes asset `IMPORT_SECRET` resolved to `https://harbor.example/IMPORT_SECRET` with `same_document=true`.
- `<meta http-equiv="refresh" content="0;url=javascript:METAREFRESH_SECRET">` copies `METAREFRESH_SECRET` into the contract.

Obligation: hostile script, onclick, javascript URL, CSS import, SVG, form, and meta refresh never execute, and a javascript URL does not become a resolved same-document reference or a copied payload.

SENSITIVE_FIELDS: HOLD. Password and hidden `value` attributes are absent from the contract. `<textarea>TEXTAREA_SECRET</textarea>` and `<option>OPTION_SECRET</option>` are copied into layout text.

Obligation: sensitive field values are not copied through.

URL_SAFETY: HOLD.

- `https://harbor.example/../../etc/passwd` is `ALLOW_CAPTURE` with `url_identity=https://harbor.example/../../etc/passwd`.
- `%2e%2e/%2e%2e/etc/passwd` resolves to `https://harbor.example/%2e%2e/%2e%2e/etc/passwd` with `same_document=true`.
- `..%2fsecret` resolves to `https://harbor.example/..%2fsecret` with `same_document=true`.
- Allowlisted `127.1`, `0177.0.0.1`, and `2130706433` are `ALLOW_CAPTURE` while `allow_private_hosts` is false. Canonical `127.0.0.1`, `10.0.0.1`, `169.254.169.254`, `localhost`, `metadata.google.internal`, and `[::1]` stay `WR_PRIVATE_HOST_REFUSED`.

`javascript:`, `file:`, and `data:` page URLs stay `WR_SCHEME_REFUSED`. Credential URLs stay `WR_CREDENTIALS_IN_URL`. A literal relative `../secret/file` interaction target does not keep a `..` path segment.

Obligation: unsafe schemes, private IPs, credential URLs, and path traversal do not gain authority, and path traversal is not retained in `url_identity` or `resolved_ref`.

MALFORMED_INPUT: HOLD. `<<<<not-a-document>>>>` returns `CONTRACT_READY`, `gaps=()`, and every fidelity surface `OBSERVED`. The layout tags are `#document` and `not-a-document`. Whitespace capture still returns `REFUSE` / `WR_EMPTY_DOCUMENT`.

Obligation: malformed documents stay PARTIAL, UNKNOWN, or REFUSED, and never a fake complete X-Ray.

DETERMINISM: PASS. The same html bytes, css bytes, URL, authorization, and `captured_at` produce equal contracts, including `observation_id`.

WEBGL_BOUNDARY: PASS. A canvas is `DECLARED_UNEXECUTED` with `executed=false` and null camera, light, and object counts. CSS `perspective` leaves the camera `UNOBSERVED`. A sidecar `executed=true` stays `executed=false`. A page with no canvas is `ABSENT` and does not invent a camera.

SCALE_BOUNDARY: PASS. `max_capture_bytes` overage is `REFUSE` / `WR_CAPTURE_TOO_LARGE`. `max_html_chars` overage is `INCOMPLETE` with `HTML_OVER_OBSERVATION_LIMIT` and no X-Ray. `max_nodes` leaves `INCOMPLETE`, gap `LAYOUT_NODE_CAP`, and layout fidelity `PARTIAL`.

SEMANTIC_AUTHORITY: PASS on the authority oracle. Contract and X-Ray `semantic_authority` stay `NONE`. A sidecar key `semantic_authority` is `REFUSE` / `WR_FORBIDDEN_PAYLOAD`. This does not clear the HOLD above.

LIVE_FETCH: false
K3_INTEGRATED: false

## Evidence

- `proofs/webrecon_r1_20260930/pytest.txt`
- `proofs/webrecon_r1_20260930/junit.xml`
- `proofs/webrecon_r1_20260930/baseline_oracles.json`
- `proofs/webrecon_r1_20260930/mutation_results.json`

STOP. No donor repair, no merge, no deploy, no host, no main, no I2.
