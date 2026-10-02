# Lane privacy egress truth

START_SHA: `ac3df92a6b69e16409bf5f6cc2af9b587c7f79d4`
Ancestry: `spe-c10-privacy-preflight` (`cursor/spe-privacy-binding-preflight-20260930`), which contains open PR #69 tip `f7c2e66930aef3cb4fe5f25c8392321d569847b0`.
Lane N runtime files stay byte-identical to SOURCE_SHA `885d75d615d91e712668660592ffc4e1c584bce5`. No collector was added. ₹0. No merge.

## Reproduced before the fix

`node apps/web/scripts/egress-proof.mjs` with `SPE_WASM_PATH` missing exited 0 and wrote `zero_egress: true` plus `engine_error: ENGINE_UNAVAILABLE`. `eval-fixture.mjs` `fail()` had invented `fetch_during_evaluate: 0` without evaluating.

`proofs/privacy_binding_preflight_20260930/C10_REPORT.md` ended with `FINAL: PRIVACY_BINDING_PREFLIGHT_PASS` because pytest fixture counts were green. The lock test required that string.

`tests/unit/test_privacy_egress_truth.py` failed on both facts before the fix (2 failed).

## What this change proves

- An engine error, including fake zero fetch counts, is not `zero_egress`.
- `outbound_safe` is false for raw private bytes. A measured zero fetch count does not make those bytes outbound-safe.
- A missing consent field does not set `missing_consent_allows_egress`.
- Fixture `expect: PASS` and pytest pass counts stay `PRIVACY_QUALIFICATION: NOT_A_PASS`.
- Result label is `FINAL: HOLD`. This note does not claim a privacy pass.

## Not claimed

No consent product was added. Lane N aggregate analytics were not re-qualified. I11 stays unwired. Web shell routing, scholarly grounding, media, webrecon, project library, vision, and locale catalogs were not edited.
