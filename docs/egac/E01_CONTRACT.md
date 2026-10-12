# EGAC-E01 — JSON Minification Experiment Contract (FROZEN before any run)

Status: FROZEN. Committed (and its SHA-256 recorded) before the harness is run.
Program: SPE Ω PRO — Evidence-Gated Adaptive Compute (EGAC-1). Status: proposed invention; no novelty claims.
Cost: ₹0. Local model only (Ollama on owner's Mac mini). No external Optimization workspace, no paid API.

## 1. Question
Does structural JSON minification (technique T1, gated by the semantic-conservation gate) reduce prompt
tokens and latency without a non-inferior loss of task success, on a local small model?

## 2. Arms
- control  = minify OFF: JSON embedded pretty-printed (indent=2), byte-identical source document.
- treatment = minify ON: same document passed through `spe_runtime.egac.transforms.json_minify` via the
  conservation gate. If the gate refuses, the task is run unminified in both arms and counted as a refusal.
- Identical: model, model digest, system prompt, question text, options {temperature: 0, seed: 1729,
  num_predict: 48, num_ctx: 4096}. Only the JSON whitespace differs.

## 3. Tasks
- 120 tasks = 8 corpus categories x 15: config, api_response, nested_records, big_ints, unicode_escapes,
  numeric_arrays, deep_nesting, whitespace_in_strings.
- Generated deterministically from generator seed 20261012 (`spe_runtime/egac/e01.py::build_tasks`).
- Every task has a programmatic oracle (exact match after trimming surrounding whitespace, quotes and a
  trailing period; integers compared as exact digit strings — no float conversion).
- Repeats: 3 per task per arm (720 calls). Call order: all (task, arm, repeat) triples shuffled with seed 7.

## 4. Endpoints (pre-registered)
- Primary efficiency: per-task paired diff in prompt tokens (Ollama `prompt_eval_count`, treatment − control,
  mean over repeats). 95% percentile bootstrap CI, 10,000 resamples over tasks, seed 99.
- Secondary efficiency: per-task paired diff in total latency (`total_duration`, ms, mean over repeats),
  same bootstrap. Latency on a shared desktop is noisy; reported, not gating.
- Success unit: per task per arm, success = majority (≥2/3) of repeats correct.
- Success test: exact McNemar (two-sided binomial on discordant pairs), alpha 0.05.
- Non-inferiority: success-rate difference (treatment − control), 95% paired bootstrap CI over tasks;
  lower bound must be > −0.05 (margin 5 percentage points).

## 5. Canary suite (zero critical failures required)
A fixed set of adversarial JSON documents (≥ 12) covering: integers > 2^53 and 30+ digits, duplicate
keys, \u escapes incl. surrogate pairs, raw non-ASCII, escaped quotes/backslashes, significant whitespace
and newlines-as-escapes inside strings, empty containers, negative/exponent numbers, malformed input.
Critical failure = any of: a string/number/literal token not byte-identical and in order after minify;
duplicate-key count changed; a malformed document minified instead of refused; the gate allowing a transform
that alters a protected or exact-byte span. Canaries are deterministic (no model).

## 6. Verdict rule (fixed)
- PASS_WITHIN_TESTED_SCOPE iff: canary critical failures = 0 AND token-diff CI upper bound < 0 AND
  non-inferiority lower bound > −0.05 AND McNemar p ≥ 0.05 or treatment has more wins.
- FAIL iff: any canary critical failure OR token-diff CI lower bound ≥ 0 OR non-inferiority upper bound < −0.05.
- NOT_PROVEN otherwise.
- Scope: one small local model, synthetic tasks, one machine. No generalisation to paid providers.

## 7. Out of scope / BLOCKED
- Dollar value-of-savings (VSOD): requires a paid provider's billing — BLOCKED at ₹0.
- Provider-side experiment SPE-PRO-EGAC-E01-JSON: specified in E01_PROVIDER_CONFIG.md, not created/run by SPE.
- Independent replay by Bro (implementation agent cannot certify its own result).

## 8. Stopping / integrity
Single run. No peeking-and-rerun. If the run crashes it is restarted from scratch with the same seeds and the
crash is reported. Raw rows saved to evidence/egac/e01/rows.jsonl.
