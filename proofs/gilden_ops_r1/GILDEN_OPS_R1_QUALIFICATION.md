# SPE CURSOR C5 GILDEN OPS R1

Independent donor-foundation qualification. Local contract only. No merge, deploy, host, or live agency.

## Identity

- DONOR_SHA: `d02b4cb89d7501c773ac8356e781bd0252dd08fb`
- Donor branch: `origin/cursor/spe-gilden-ops-v1-20260930`
- Qualifier branch: `cursor/spe-gilden-r1q-20260930`
- Worktree: `/Volumes/4TB-WD/spe-worktrees/spe-c5-gilden-r1`
- LIVE_AGENCY: NO
- Runtime files: unchanged

## Result

HOLD

Two mutants survive. The other eighteen are killed. Donor unit tests pass. This is not a qualification pass.

## ACTION_REGISTRY

Standing register from `controls_register()` and `data/gilden/controls_register_v1.json`:

| Action | Disposition |
| --- | --- |
| ANALYTICS_BEACON | NOT_AUTHORIZED |
| AUTOMATIC_MERGE | NOT_AUTHORIZED |
| DEPLOY | NOT_AUTHORIZED |
| HOST | NOT_AUTHORIZED |
| LIVE_SEARCH | NOT_AUTHORIZED |
| POST | NOT_AUTHORIZED |
| PUBLISH | NOT_AUTHORIZED |
| SEND | NOT_AUTHORIZED |

`RECORD` is the local action. It has no external disposition.

## UNAUTHORIZED_ACTIONS

Canonical actions and the aliases in `tests/fixtures/gilden/gor1_aliases.json` stay `NOT_AUTHORIZED`. An alias fails the schema and the document receipt stays `NOT_AUTHORIZED` with empty items and closed effect flags. A second valid item in the same document is not recorded. `external_disposition` returns `NOT_AUTHORIZED` for every name other than `RECORD`.

Effect flags on those receipts stay false: `network_used`, `posted`, `sent`, `hosted`, `deployed`, `beacon_emitted`, `merged`, `fetched`. `external_effects` stays empty. `live_agency` stays false. `network_mode` stays `NONE`.

## RECORD_BEHAVIOR

`RECORD` retains a local note. Maintenance retention is `NOTE`. A social draft retention is `UNSENT_DRAFT` with `posted` false and `sent` false. A report without evidence stays `UNKNOWN` on a `REPORT_SHELL`. Disposition for these records is `LOCAL_RECORD`.

## APPROVAL_FORGERY

Document fields `approved`, `approval`, `admin`, `is_admin`, `signed`, `signature`, `authorized`, `authorization`, and `role` are rejected. The receipt disposition is `NOT_AUTHORIZED`. A forged signature value is absent from the receipt. The same flags on a direct item evaluation do not change `SEND` away from `NOT_AUTHORIZED`. `live_agency: true` is rejected and the receipt keeps `live_agency` false. Mutating a returned controls register does not authorize `POST`.

## CREDENTIAL_SAFETY

Log and file persistence are killed:

- Environment credentials are absent from receipts.
- `api_key`, `token`, `password`, and `secret` values on a document are absent from the receipt.
- The runner does not import `logging` or read `os.environ`.
- Evaluation does not open a file for write.

Echo survives (GOR1-12). `run_text` copies jsonschema messages into `detail` (240 characters). These invalid values are quoted in the receipt:

- `work_id` set to `cred-GOR1-MARKER`
- `requested_action` set to `cred-GOR1-MARKER`
- `title` longer than the schema maximum and beginning with `cred-GOR1-MARKER`
- `body` longer than the schema maximum and beginning with `cred-GOR1-MARKER`

Example detail: `items/0/work_id: 'cred-GOR1-MARKER' does not match '^[a-z0-9][a-z0-9._:-]{0,80}$'`

A digest-mismatch evidence summary is not copied into the receipt. That path stays closed.

## BUDGET

`run_text` rejects a raw document above `MAX_DOCUMENT_BYTES` (524288) before parsing. A `budget` or `bypass_budget` field inside that raw document cannot skip the cap. The detail is `document exceeds local size boundary`, disposition `NOT_AUTHORIZED`.

`budget`, `budget_limit`, and `skip_budget` on a publish attempt are rejected. Unlimited, `10**18`, `-1`, and null do not authorize `PUBLISH`.

GOR1-14 survives on `evaluate()`. A schema-valid document of 2127931 bytes is evaluated. The receipt has `evaluated` true, 32 local records, `posted` false, `network_used` false, `live_agency` false, and an empty `external_effects` list. The register stays `NOT_AUTHORIZED`. The documented size cap does not hold on this public entry.

## IDEMPOTENCY

A repeated `work_id` rejects the document before item evaluation. Items stay empty, effect flags stay false, and a second run returns the same receipt. No socket is opened.

## RETRY_BOUND

`retry`, `retries`, and `max_retries` are rejected. `run_text` calls `evaluate` once for that document. `runner.py` has no `while` loop. A 33-item document is rejected. Armed sockets stay at 0 calls.

## EVIDENCE_TRUTH

`REPORTING` and `SEARCH_REVIEW` without accepted evidence stay `UNKNOWN`. A mismatched digest stays `UNKNOWN` with no accepted evidence id. The receipt does not use `COMPLETED`, `completed`, or `PASS` as a status.

## NETWORK

Armed `socket.socket`, `socket.create_connection`, and `socket.getaddrinfo` record 0 calls across duplicate jobs, retries, destination attempts, and semantic-authority attempts. Gilden sources and `tools/gilden_ops_runner.py` do not import network or process modules. Unexpected egress is 0.

## Mutants

| Id | Attempt | Result |
| --- | --- | --- |
| GOR1-01 | POST and aliases | KILLED |
| GOR1-02 | SEND and aliases | KILLED |
| GOR1-03 | HOST and aliases | KILLED |
| GOR1-04 | DEPLOY and aliases | KILLED |
| GOR1-05 | ANALYTICS_BEACON and aliases | KILLED |
| GOR1-06 | AUTOMATIC_MERGE and aliases | KILLED |
| GOR1-07 | LIVE_SEARCH and aliases | KILLED |
| GOR1-08 | PUBLISH and aliases | KILLED |
| GOR1-09 | forged approval, admin, signed | KILLED |
| GOR1-10 | credential log | KILLED |
| GOR1-11 | credential persist | KILLED |
| GOR1-12 | credential echo | SURVIVED |
| GOR1-13 | duplicate job | KILLED |
| GOR1-14 | budget bypass | SURVIVED |
| GOR1-15 | unlimited budget | KILLED |
| GOR1-16 | retry storm | KILLED |
| GOR1-17 | missing evidence to completed | KILLED |
| GOR1-18 | local record to published | KILLED |
| GOR1-19 | destination to authority | KILLED |
| GOR1-20 | semantic authority and unexpected network | KILLED |

Killed: 18. Survived: 2. Catalog size: 20.

## Tests

Command:

`python -m pytest -q tests/mutation/test_gilden_gor1.py tests/unit/test_gilden_ops.py`

- Donor `tests/unit/test_gilden_ops.py`: 42 passed
- Qualifier `tests/mutation/test_gilden_gor1.py`: 20 passed, 2 failed
- Total: 62 passed, 2 failed

Failures:

- `test_gor1_12_credentials_are_not_echoed_in_receipts`
- `test_gor1_14_budget_cannot_be_bypassed`

## Forbidden actions

- POST: NOT_AUTHORIZED
- SEND: NOT_AUTHORIZED
- HOST: NOT_AUTHORIZED
- DEPLOY: NOT_AUTHORIZED
- ANALYTICS_BEACON: NOT_AUTHORIZED
- AUTOMATIC_MERGE: NOT_AUTHORIZED
- LIVE_SEARCH: NOT_AUTHORIZED
- PUBLISH: NOT_AUTHORIZED

FINAL: HOLD
