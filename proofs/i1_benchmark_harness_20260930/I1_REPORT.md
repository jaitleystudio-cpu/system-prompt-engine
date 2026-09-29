# I1 benchmark harness report

Custody note for the SPE benchmark qualification harness on frozen core `bd4540a`. This file is not a quality score. `MEMORY.md` was not updated.

## Custody

| Field | Value |
| --- | --- |
| BASE_SHA | `bd4540a9c96801168f2e7363c001a4184bad4311` |
| EVIDENCE_SHA | `e4da47cdcf7e988f2df60f0a3bea84180abde1ee` |
| Branch | `grok/spe-i1-benchmark-harness-bd4540a-20260930` |
| PR base | `cursor/spe-quality-delta-planb-validate-only-20260929` |
| Ported from | PR #63 tip `885fe07a5a753803d1fb4200f008ef92e6b9ef8c` |
| F4 proof | `97ef09058b410d938dd18078c467b16e3306d783` (reference only; not the parent) |

HEAD was `bd4540a9c96801168f2e7363c001a4184bad4311` before the integration commits. The commands below were run on `EVIDENCE_SHA`. This report and `python_reference_trace.json` were added afterward and do not change the harness.

## Toolchain

- Python 3.12.3
- jsonschema 4.26.0
- pytest 9.1.1
- Linux 6.12.94+ x86_64
- Install: `pip install -e ".[dev]"` (existing project deps only)

## What was ported

From PR #63, and nothing else in that branch:

- `evaluations/spe_benchmark_qualification_v1/**`
- `schemas/spe_benchmark_*.schema.json`
- `tests/regression/test_spe_benchmark_qualification_harness.py`
- `tools/run_spe_benchmark.py`

I1 then added `tools/spe_benchmark_python_subject.py` and `tests/regression/test_spe_benchmark_python_subject.py`. The dataset README gained a subject section, so `hashes.sha256` and `manifest.json` were regenerated for that README only. Cases and schemas are the PR #63 bytes.

## What was excluded

- PR #63 was not merged into main.
- `MEMORY.md` from PR #63 was not ported.
- Website V1, ONNX, hero, and other PR #63 forge files were not ported.
- Lane C / PR #65 was not pulled.
- F3E proof files on `bd4540a` were left in place.

## Subject

`--subject python-reference` loads `tools.spe_benchmark_python_subject` and calls `spe_runtime.k3.selector.select_prompt_techniques` once per unlabeled case.

Protected envelope, and only that:

- `goal` = `raw_prompt`
- `hard_constraints` = `constraints`
- `uncertainties` = `declared_unknowns`

Category and task are empty. No XCAT id, desired output, provider call, or score is invented. `evaluate_from_k3` is not called. A compiled prompt is attached only when `prompt_effect_plan.compiled_prompt` is non-empty. Every measurement status stays `UNKNOWN`. A missing prompt stays `UNKNOWN` and is not `PASS`. The core's `claims_pass` must be false or the run is rejected.

Fixture mode does not import `spe_runtime`.

## Commands and hashes

`python3 tools/run_spe_benchmark.py --check-hashes` exit 0.

stdout sha256 `6ed7b18f5fc92b3d83059055356899a5e3ec33ff849fdeccc110304b14e79b08`

```
hashes=OK
frozen_files=11
measurement_default=UNKNOWN
scores_included=false
```

`python3 tools/run_spe_benchmark.py --fixture-only` exit 0.

stdout sha256 `5818ff775197dee079c48beb27ba2809c4536afbb2cccb80bfaa33975758d8d8`

`marked_pass_count=0`. All twelve comparison lines are `spe_prompt=UNKNOWN` and `measurement_statuses=UNKNOWN`.

`python3 tools/run_spe_benchmark.py --subject python-reference --format json` exit 0. stderr empty.

stdout sha256 `fdf09060cc149e312c77b2f7dd8dc94b4526e1e39787ce04de7e73b254aa2beb`

comparison json sha256 `a003548e18ef9881901917bf014a5215b6bba58e25f85b1929f67d25e926e228`

trace sha256 `7a2663aca80a37222c1c68e6cd081e7fdfedc1ed35bee51306a43bf3c2c7b1a9` (`python_reference_trace.json`)

Subject result: `mode=offline-record`, `marked_pass_count=0`, `provider_calls=0`, `network_used=false`, `prompts_attached=12`, `prompts_absent=0`, `scores_emitted=false`. Every measurement status in the report is `UNKNOWN`. All twelve captures are `SAFE_DEFAULT` / `ZERO_SHOT` / `claims_pass=false`. That is a compiled-prompt attachment, not a qualification PASS.

## Tests

`python3 -m pytest -q tests/regression/test_spe_benchmark_qualification_harness.py tests/regression/test_spe_benchmark_python_subject.py`

exit 0. `22 passed`.

`python3 -m pytest -q`

exit 0. `1040 passed` in 510.96s.

No test was weakened.

## Ownership

Diff vs `bd4540a` is the harness package, schemas, regression tests, the subject adapter, and this proofs directory.

No edits to the XCAT router, K3 selector, Quality engine, Core-B, WASM bytes or pin, scholarly fabric, or Create UX. The subject imports `select_prompt_techniques` and does not patch it.

## Boundary

HOSTING FORBIDDEN. DEPLOY FORBIDDEN. DO NOT MERGE TO MAIN. Do not start I2.

This integration does not claim WORLD #1 or launch readiness. I1_PASS means the harness runs on this frozen core and fails closed. It does not mean the product passed a benchmark.
