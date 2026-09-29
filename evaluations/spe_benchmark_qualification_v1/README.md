# SPE benchmark and qualification harness v1

Foundation for recording a later SPE benchmark. This directory is frozen
structure: dataset, unlabeled cases, schemas, hashes, and reproduction steps.
It does not contain scores.

A missing measurement stays `UNKNOWN`. Nothing in this harness turns a missing
measurement into `PASS`.

`fixture_structure=VALID` means the files parse and the hashes match. It is
not a quality result.

## What a later run can record

Each case has a raw prompt. The SPE prompt slot starts as `UNKNOWN` until an
offline observation attaches a real compiled prompt and an evidence reference.
Attaching that text does not mark preservation as `PASS`.

Measurement slots, all defaulting to `UNKNOWN`:

- constraint preservation
- intent preservation
- unknown preservation
- category accuracy
- repair effectiveness
- unsupported-claim detection
- provider portability
- large-input preservation
- grounding fidelity
- latency (unmeasured stays `UNKNOWN`; a later number is `MEASURED`, not `PASS`)
- browser qualification
- human / blinded evaluation records

Human ratings are imported as rows. This harness does not aggregate them into
a case verdict, so the human measurement status stays `UNKNOWN` even when a
rater row is present.

## Python reference subject

`--subject python-reference` is the I1 read-only call into the frozen core.
It invokes `spe_runtime.k3.selector.select_prompt_techniques` once per case.
The protected envelope uses only fields already on the case:

- `goal` = `raw_prompt`
- `hard_constraints` = `constraints`
- `uncertainties` = `declared_unknowns`

Category and task are left empty. The harness does not invent an XCAT id, a
desired output, a provider call, or a score.

When the core returns a non-empty `prompt_effect_plan.compiled_prompt`, that
text is attached to the SPE arm with an evidence reference. The comparison
keeps `raw_prompt` as the baseline side. Every measurement status stays
`UNKNOWN`. If the core returns no compiled prompt, the SPE prompt slot stays
`UNKNOWN`. That absence is not `PASS`.

Fixture mode (`--fixture-only`) still does not import `spe_runtime`.

## What this harness does not do

It does not call a provider, open a browser, or run a live mode. It does not
score XCAT, K3, Quality, Core-B, category protocol, provider adapters,
Meta-Brain, Failure Atlas, Champion/Challenger, Success Genome, Massive
Intent, Scholarly Fabric, Search, Visual Intelligence, Security,
Accessibility, Localization, WebRecon, media intelligence, or the
desired-output compiler. Attaching a compiled prompt is not a quality result.

## Layout

| Path | Role |
| --- | --- |
| `dataset.json` | Dataset header and measurement catalog |
| `cases.jsonl` | Frozen unlabeled cases |
| `human_ratings.example.jsonl` | Import shape only. Not a collected rating |
| `manifest.json` | Frozen-file list, hashes, case ids. `scores_included` is false |
| `hashes.sha256` | `sha256sum` lines for the frozen inputs |
| `../../schemas/spe_benchmark_*.schema.json` | Case, dataset, result, comparison, manifest, observation, and human-rating schemas |
| `../../tools/run_spe_benchmark.py` | Offline runner |

Manifest and `hashes.sha256` are derived from the frozen inputs. They are not
themselves hashed, so the hash list is not circular. They contain no scores.

## Reproduce

From the repository root, with Python 3.11+ and the project dev extra
(`jsonschema`, `pytest`):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

python3 tools/run_spe_benchmark.py --check-hashes
python3 tools/run_spe_benchmark.py --fixture-only
python3 tools/run_spe_benchmark.py --fixture-only --format json
python3 tools/run_spe_benchmark.py --fixture-only --comparison-out /tmp/spe-bench-comparison.json
python3 tools/run_spe_benchmark.py --subject python-reference --format json
pytest tests/regression/test_spe_benchmark_qualification_harness.py -q
pytest tests/regression/test_spe_benchmark_python_subject.py -q
```

`--fixture-only` does not use the network. Two JSON runs on the same frozen
files are byte-identical. Do not commit that stdout as evidence of quality.

Expected text markers:

- `measurement_default=UNKNOWN`
- `marked_pass_count=0`
- `harness_invented_scores=false`
- `human_ratings_aggregated=false`
- `network_used=false`
- `provider_calls=0`
- `spe_prompt=UNKNOWN`

`--check-hashes` recomputes SHA-256 over the frozen bytes and compares them to
`hashes.sha256` and `manifest.json`. A mismatch is an error.

Rebuild the derived manifest only after an intentional edit to a frozen input:

```bash
python3 tools/run_spe_benchmark.py --write-manifest
```

That rewrite still does not score cases.

## Comparison output

`--format json` includes `comparison`. `--comparison-out` writes the same
comparison document alone.

Each pair has the raw prompt and its SHA-256, the SPE prompt (or `UNKNOWN`),
the fixture constraints, intent summary, and declared unknowns, and both arm
measurement slots. Those fixture fields are inputs, not verdicts.

## Observation import

`schemas/spe_benchmark_observation.schema.json` is the offline record format.

- `record_kind` `spe_prompt` stores a compiled prompt on the `SPE` arm when
  `evidence_ref`, `method`, and `measured_at` (`YYYY-MM-DDTHH:MM:SSZ`) are present.
- `record_kind` `measurement` stores one catalog measurement.
- Omitted, blank, or `UNKNOWN` status stays `UNKNOWN`.
- `PASS` and `FAIL` without evidence are rejected.
- Latency accepts `MEASURED` plus `value_ms`, and rejects `PASS`.
- `human_blinded_evaluation` cannot be set here. Use the human-rating import.
- `NOT_APPLICABLE` requires `notes` and is not a pass.

```bash
python3 tools/run_spe_benchmark.py --fixture-only --import-observations path/to/observations.jsonl
```

This repository does not ship an observation file. Add one only when the
evidence exists outside this frozen dataset.

## Human-rating import

`schemas/spe_benchmark_human_rating.schema.json` is the import format.
`human_ratings.example.jsonl` shows one row with `rating` `UNKNOWN` and
`example_only` true. The runner rejects that file so the example cannot be
counted as a rating.

A collected row names `case_id`, `arm_id` (`RAW` or `SPE`), `rater_id`, and
`blinded`. `PASS` or `FAIL` also requires `blinded` true, `evidence_ref`,
`method`, and `rated_at`. The row is appended under
`human_blinded_evaluation.records`. The measurement `status` stays `UNKNOWN`.

```bash
python3 tools/run_spe_benchmark.py --fixture-only --import-human-ratings path/to/ratings.jsonl
```
