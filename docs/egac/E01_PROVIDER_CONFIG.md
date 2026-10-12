# SPE-PRO-EGAC-E01-JSON — provider-side experiment config

> **STATUS: NOT CREATED, NOT RUN BY SPE.** This is a specification for the owner to create manually in
> their own Optimization workspace if they choose. SPE made no calls to that workspace and no paid requests.
> Creating and running it bills the owner's provider API key.

## Experiment
| Field | Value |
|---|---|
| Name | `SPE-PRO-EGAC-E01-JSON` |
| Description | EGAC-E01 replication on paid provider: JSON minification OFF vs ON. Contract: docs/egac/E01_CONTRACT.md (sha256 c6e67071015c2feeabf01ef9df3b3d7ffab67bf2bfcfa964d55fe4b4f44f811e) |
| Technique under test | JSON minification only |
| Variant A (control) | JSON minification = **Force off** |
| Variant B (treatment) | JSON minification = **Force on** |
| All other techniques | Inherit / unchanged in both variants (do not toggle) |
| Split | **1:1** (50/50) |
| Workspace defaults | **Unchanged** — do NOT enable JSON minification (or any technique) at workspace level |
| Traffic enrollment | **None** — no application traffic enrolled; only requests that explicitly carry the experiment header |
| Model | One fixed model + version for both variants (record the exact ID) |
| Sampling | temperature 0, fixed seed if supported, max output tokens 48 |

## Requests
Send only the 120 E01 tasks (evidence/egac/e01/tasks.json, rendered with `make_prompt`) × 3 repeats per
variant, with the experiment header attached, in the shuffled order from seed 7. Do not send production traffic.

## Metrics to export
Per request: variant, input tokens, output tokens, latency, billed cost, response text. Then score with the
E01 oracle and apply the same statistics (paired bootstrap, McNemar, NI margin −5 pp). The dollar
value-of-savings (VSOD) is only computable from this provider run.

## Afterwards
Archive/stop the experiment. Confirm workspace defaults were never changed.
