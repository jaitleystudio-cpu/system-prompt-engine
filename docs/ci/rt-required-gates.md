# RT required gates (CI)

Remote merge-gate workflow for RT-VR2. **YAML alone ≠ PASS** — a green Actions run of
`rt-required-gates` with `final-gate=success` is required.

## Scope

- Workflow: `.github/workflows/rt-required-gates.yml`
- Helpers: `scripts/ci/*`
- Production RT code is **out of scope** for this CI-only branch tip delta.
- Frozen production tip: `afe1453c515be3b189b27828e20d03d64f80cbdd`
  (tree `46c8bb358aa01d6910ce66668784c43d6b450a86`).

## Jobs

| Job | What it runs |
|---|---|
| custody | Ancestor of frozen SHA; non-CI path diff empty; frozen tree match |
| rt-continuation | `node tests/test_task_continuation_engine.mjs` |
| rt-adversarial-oracles | `node tests/test_rt_q0_adversarial_oracles.mjs` |
| pytest-grounding | VR1 12-file set; builds `spe-core-eval` for Rust/WASM parity |
| privacy | `node apps/web/scripts/test-truth-privacy-closure.mjs` |
| quality-custody | `node apps/web/scripts/test-quality-runtime-custody.mjs` |
| wasm-custody | sha256 == `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` |
| false-proof | `node tests/test_rt_vr1_truth_fail_closed.mjs` + no LIVE_* PASS claims |
| final-gate | Aggregates all; fails on FAIL/CANCELLED/SKIPPED/UNKNOWN |

## Non-claims

- LIVE_INDEX=HOLD, LIVE_RETRACTION=HOLD (not implemented / not PASS)
- LOCAL / remote CI green ≠ PRODUCT QUALIFIED
- Independent VR2-V is a separate Bro dispatch

## Required check (branch protection)

When permissions allow, require status check name:

`rt-required-gates / final-gate`
