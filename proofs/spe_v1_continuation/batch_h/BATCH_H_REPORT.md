# SPE Ω — Batch H Report (repo / source / computer-use adapters)

**Scope:** Capability declaration + thin adapter/routing for `repository_access`, `file_access`, `browser_computer_use` (extend Batch E provider ABI; no desktop automation agent)  
**Base tip (Batch G PASS):** `ef39e2692a2c6c3e0b83ba3cbaf47a4b96003587`  
**Final tip:** post-commit `git rev-parse HEAD` on this branch (message starts `feat(batch-h):`). No self-hash in-blob — amend would drift.  
**Branch:** `grok/spe-v1-full-product-continuation-20260925`  
**PR:** #44 — https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/44  
**HOSTING:** **FORBIDDEN**  
**WORLD #1 / INDEPENDENTLY_REPLICATED:** **NOT_PROVEN**

## Custody

| Field | Value |
|-------|-------|
| Machine | Mac checkout `0d308a2c-330c-430b-85e3-74d647e69e59` |
| Start HEAD verified | `ef39e2692a2c6c3e0b83ba3cbaf47a4b96003587` |
| Safety tag | `local-pre-batch-h-20260926` |
| Push | Allowed when Batch H green (this report) |
| Cloud Agent | **Not used** |
| Workflows | **Not edited** |
| Deploy / host / DNS | **Not done** |
| Batch I+ | **Not started** |

## Requirement matrix (inspect → action)

| # | Requirement | Pre-H | Batch H |
|---|---|---|---|
| 1 | Repo access capability tag | MISSING | PRESENT on `LOCAL_WASM` |
| 2 | Source/file access + local_temp_file link | PARTIAL | PRESENT (`file_access` + laws link) |
| 3 | Browser/computer-use tag | MISSING | PRESENT on `EXTERNAL_OPTIONAL` |
| 4 | CapabilityNeed / select_profile covers tags | PARTIAL | PRESENT + `select_for_environment_need` |
| 5 | Selection ≠ AuthorityGrant | PRESENT | Kept + adversarial |
| 6 | Portable “If your environment provides…” | PRESENT | Extended env clauses |
| 7 | execution_record / `.spe` bind | PRESENT | Kept (digest bump for changed profiles) |
| 8 | UI ACTIVE PROFILE capability labels | PARTIAL | Thin capabilities line |
| 9 | Tool results UNTRUSTED_SOURCE | PARTIAL | PRESENT for env adapters |
| 10 | Full capability_manifest schema | BLOCKED stub | Left BLOCKED (no parallel registry) |
| 11 | Adversarial suite | PARTIAL | PRESENT (`test_batch_h_environment_adapters.py`) |
| 12 | Real desktop/browser automation | — | BLOCKED non-goal |

Full matrix: `proofs/spe_v1_continuation/batch_h/ADAPTER_MATRIX.md`.

## Vertical slice

1. Registry `1.1.0`: `LOCAL_WASM` declares `file_access` + `repository_access`; `EXTERNAL_OPTIONAL` declares `browser_computer_use`; `DETERMINISTIC` unchanged (digest stable for default dry-run bind).
2. Thin adapter `spe_runtime/adapters/environment_capabilities.py` — declare / select / classify / portable prompt; routes through `select_profile`; never mints authority or auto-enables side effects.
3. Protocol render helper appends portable env-capability clause for ANY_AI.
4. TS mirror digests + `ENVIRONMENT_CAPABILITY_TAGS`; ACTIVE PROFILE shows capability list from mirror.
5. Tests: 13 Batch H unit/adversarial; Batch E regression green.

## Files added / changed

| Path | Role |
|------|------|
| `data/provider_profiles_v1.json` | Registry 1.1.0 + Batch H tags |
| `spe_runtime/adapters/environment_capabilities.py` | NEW — env capability adapter |
| `spe_runtime/adapters/__init__.py` | Exports |
| `spe_runtime/adapters/protocol_render.py` | `render_with_environment_capability_clause` |
| `packages/web-runtime/src/providerProfiles.ts` | Mirror tags + digests |
| `apps/web/src/workspace/ExecutionContractPanel.tsx` | Capabilities line on ACTIVE PROFILE |
| `tests/unit/test_batch_h_environment_adapters.py` | NEW — unit + adversarial |
| `tests/copy/reviewed-inventory.json` | Reviewed new PRODUCT copy |
| `proofs/spe_v1_continuation/batch_h/*` | Matrix + this report |

## Tests executed

| Check | Exit | Result |
|---|---:|---|
| `uv run … pytest tests/unit/test_batch_h_environment_adapters.py -v` | `0` | **13 passed** |
| Batch E regression (profiles + adapter + bind + adversarial) + Batch H | `0` | **52 passed** |
| `cd apps/web && npx tsc --noEmit` | `0` | PASS |
| `cd apps/web && npx vite build && node scripts/cache-shell.mjs` | `0` | Vite + cache shell PASS (shipped `public/spe_wasm.wasm`; no local WASM rebuild) |
| `cd apps/web && npm run test:execution-contract` | `0` | PASS (DETERMINISTIC digest unchanged) |
| `node tools/copy-check.mjs` | `0` | 0 unreviewed, 0 violations |
| `cd apps/web && npm run test:predeploy-qa` | `0` | 18 predeploy cases PASS |
| `cd apps/web && node scripts/test-theme-routes.mjs` | `0` | PASS |
| `node tools/deployment-safety-gate.mjs` | **`2`** | expected fail-closed; `HOSTING=FORBIDDEN` |

### Full `npm run build` note

Same residual as F/G: local WASM target can embed `/Users/` paths; used shipped `public/spe_wasm.wasm` via `tsc` + `vite build` + `cache-shell`. WASM not rebuilt.

## Allowed claims

| Claim | Status | Evidence |
|-------|--------|----------|
| `BATCH_H_IMPLEMENTATION_PRESENT` | **SUPPORTED** | Tags + env adapter + select path + portable clause + thin UI |
| `BATCH_H_TESTED_WITHIN_DECLARED_SCOPE` | **SUPPORTED** | Commands + exits above (local Mac checkout) |
| `WORLD#1` | **NOT_PROVEN** | No ranking claim |
| `HOSTING` | **FORBIDDEN** | Deploy safety gate exit `2` |

## Residuals / non-goals (explicit)

- No real browser automation, Playwright drive of production sites, keylogging, or OS computer-use agent
- No C07 side-effect execution bridge
- `capability_manifest.schema.json` remains STUB (tags live on provider profiles + env adapter)
- WASM/Rust `select_profile` parity still out of scope (ts_mirror display/bind)
- Batch I (cross-runtime / mutation / a11y / perf qualification) **not started**
