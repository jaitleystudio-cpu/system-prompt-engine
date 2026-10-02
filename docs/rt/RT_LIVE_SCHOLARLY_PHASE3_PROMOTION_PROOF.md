# RT Live Scholarly -- Phase 3 Promotion Proof Pack

Captured: 2026-10-03 Asia/Calcutta
Branch: `grok/rt-live-scholarly-p3-promotion-proof-20261003`
Frozen parent (PR #99 tip, DO NOT MUTATE): `5056e8f053cdc0ba8b6e33c88b9d2f058ccce9a8`
Bro prior FINAL: **RT_LIVE_SCHOLARLY_V_PASS_WITHIN_TESTED_SCOPE**
Cost: INR 0 · MERGED=NO · DEPLOYED=NO · HOSTED=NO
WASM pin: `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` (unchanged)

## Mission

Close SURVIVOR_FOR_PROMOTION: independent multi-provider live+retraction mutant proof.

## Delivered

1. **Promotion gate** -- `evaluate_live_promotion_gate` / `evaluateLivePromotionGate`
2. **Product constants stay HOLD**
3. **Deterministic mutant suites** via injectable transports
4. **Known retracted DOI fixtures**
5. Optional `SPE_SCHOLARLY_LIVE=1` path retained

## Independent live API spot-check (2026-10-03, INR 0, outside SPE process)

DOI `10.1038/nature00870`:

| Provider | Result |
|---|---|
| OpenAlex | `is_retracted: true` |
| Crossref | `updated-by` includes `type: "retraction"` |

Supporting evidence only -- not in-process SPE live mutant kill.
Mac offline this turn; local suites pending re-run.

## Gate verdict

| Criterion | Status |
|---|---|
| Identity >=2 (injectable) | GREEN (tests authored) |
| Retraction explicit enum | GREEN |
| No NO_SIGNAL->NOT_RETRACTED | GREEN |
| Provenance | GREEN |
| Independent live network proof in SPE path | HOLD |
| Product LIVE_* | HOLD |

**FINAL:** `RT_LIVE_SCHOLARLY_P3_PROMOTION_HOLD`

## NEXT_MISSION recommendation (do not auto-start)

1. Bro V of Phase 3 on Mac + optional SPE_SCHOLARLY_LIVE=1
2. A9-LINK repair (PR #91) -- founder auth
3. R2-88 reconcile RV (PR #95) -- Bro RV / merge auth
4. VR2R merge readiness (PR #98) -- separate founder merge auth
