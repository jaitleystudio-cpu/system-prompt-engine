# Gilden operations v1

Contract id: `spe.gilden.operations.v1`

This is an operations schema and a local runner boundary. It is not a live agency. `live_agency` is false. `network_mode` is `NONE`. The package is not a release.

The runner reads one operations document and writes a receipt to stdout. A local record may retain a maintenance note, a search review of supplied material, a research queue entry, an unsent social draft, a growth note, a report shell, or a controls snapshot.

## Actions that stay NOT_AUTHORIZED

| Action | Meaning |
| --- | --- |
| POST | No posting |
| SEND | No sending |
| HOST | No hosting |
| DEPLOY | No deployment |
| ANALYTICS_BEACON | No analytics beacon |
| AUTOMATIC_MERGE | No automatic merge |
| LIVE_SEARCH | No live search |
| PUBLISH | No publishing |

`RECORD` is the only local action. It does not change the register. There is no input that sets an external disposition to anything other than NOT_AUTHORIZED.

Effect flags on every receipt stay false: `network_used`, `posted`, `sent`, `hosted`, `deployed`, `beacon_emitted`, `merged`, `fetched`. `external_effects` stays empty.

## Reports

A `REPORTING` item or a `SEARCH_REVIEW` item without accepted evidence has report status `UNKNOWN`.

Accepted evidence is a local summary whose SHA-256 digest matches, from `LOCAL_FIXTURE`, `OPERATOR_NOTE`, or `PRIOR_LOCAL_RECORD`. A claim that does not cite accepted evidence stays `UNKNOWN`.

`EVIDENCE_ATTACHED` means local evidence is bound to that report. It is not proof beyond the local record, and it does not authorize sending or publishing the report.

## Kinds

| Kind | Local retention | Closed actions |
| --- | --- | --- |
| MAINTENANCE | Note | HOST, DEPLOY, AUTOMATIC_MERGE |
| SEARCH_REVIEW | Review note. Findings stay UNKNOWN without evidence | LIVE_SEARCH |
| RESEARCH_QUEUE | Queue entry. `fetched` stays false | LIVE_SEARCH |
| SOCIAL_DRAFT | Unsent draft. Empty body is not a draft | POST, SEND, PUBLISH |
| GROWTH_NOTES | Note | ANALYTICS_BEACON |
| REPORTING | Report shell. Status UNKNOWN without evidence | SEND, PUBLISH, POST |
| CONTROLS | Snapshot of the register | AUTOMATIC_MERGE and every other external action |

Any external action on any kind is refused. The controls register on the receipt lists all eight actions as NOT_AUTHORIZED.

## Run locally

```bash
python3 tools/gilden_ops_runner.py --request path/to/operations.json
```

Omit `--request` to read stdin. Exit 0 means the document was evaluated, including refusals. Exit 2 means the document was rejected. A rejected document still returns a receipt with disposition NOT_AUTHORIZED and report status UNKNOWN.

The runner does not open a socket, send mail, launch a browser, or start a subprocess. Documents larger than 512 KiB are rejected. `work_id` values in one document must be unique.

## Honesty

Lineage stays `NEW_IMPLEMENTATION`. `not_a_release` is true. Cost is ₹0. No paid API, hosting, analytics, or deployment is required to evaluate a document.
