# SPE Ω — Batch E Report (Provider Profiles + Adapter + Bind + Adversarial)

**Scope:** Versioned provider profile registry → thin local-first adapter →
execution_record / `.spe` / UI bind → adversarial closure (Turn 5)  
**Base tip (Batch E stack):** `5e3feb04b1cf60b5e8a13041db4556417a7bd2c5`  
**Turn 4 tip (pre–Turn 5):** `4441d041504f246c919fa5288d636606181f2279`  
**Final tip (this report / Turn 5 commit):** post-commit `git rev-parse HEAD` on this branch (message `test(batch-e): adversarial suite + BATCH_E_REPORT (Turn 5)`). No self-hash in-blob — amend would drift.  
**Branch:** `grok/spe-v1-full-product-continuation-20260925`  
**HOSTING:** **FORBIDDEN**  
**WORLD #1 / INDEPENDENTLY_REPLICATED:** **NOT_PROVEN**

## Custody

| Field | Value |
|-------|-------|
| Machine | Mac checkout `0d308a2c-330c-430b-85e3-74d647e69e59` |
| Local only | Yes — **no push**, no Cloud Agent, no workflow edits, no deploy/host |
| Turns covered | 2 (registry) → 3 (adapter) → 4 (UI/bind) → **5 (adversarial + report)** |
| Not started | Batch F |
| Screenshots | **Missing this turn** (optional; not blocking). Turn 4 ACTIVE PROFILE UI not re-captured. |

## Allowed claims (supported)

| Claim | Status | Evidence |
|-------|--------|----------|
| `BATCH_E_IMPLEMENTATION_PRESENT` | **SUPPORTED** | Turns 2–4 code + Turn 5 adversarial suite present on branch |
| `BATCH_E_TESTED_WITHIN_DECLARED_SCOPE` | **SUPPORTED** | Commands + exits below (local Mac checkout) |
| `WORLD#1` | **NOT_PROVEN** | No independent external replication |
| `INDEPENDENTLY_REPLICATED` | **NOT_PROVEN** | Same |
| `HOSTING` | **FORBIDDEN** | Deploy safety gate exit `2` (fail-closed) |

## Vertical slice (Batch E)

1. **Turn 2** — Versioned provider profile registry (`LOCAL_WASM`, `DETERMINISTIC`, `EXTERNAL_OPTIONAL`); distinct from domain grounding profiles; authority flags read-only / empty only.
2. **Turn 3** — Thin Capability ABI adapter `select_profile(need, policy)` with local-first order; `allow_external` default false; selection ≠ AuthorityGrant; network/credentials never auto-enabled.
3. **Turn 4** — ACTIVE PROFILE UI card; bind into `execution_record` + `.spe` round-trip; TS mirror for display/bind; `profile-not-authority` check; UNKNOWN never launders to PASS.
4. **Turn 5** — Adversarial suite proving the six closed properties listed below.

## Adversarial properties proven (declared scope)

| # | Property | Result |
|---|----------|--------|
| 1 | Provider/profile cannot grant itself authority | **PASS** — registry validation + `ProfileSelection` coerce flags false |
| 2 | External profile cannot silently activate network; `allow_external` default false | **PASS** |
| 3 | Profile change / bind / refresh cannot mutate ProtectedIntent | **PASS** |
| 4 | Unknown profile cannot become PASS / SELECTED | **PASS** — `UNAVAILABLE`; re-select after forged `.spe` stays closed |
| 5 | `.spe` import cannot escalate capabilities | **PASS** — registry unchanged; `detect_capability_escalation` rejects widening; validate rejects mint/execute |
| 6 | Local failure does not silently switch to cloud | **PASS** — `BLOCKED`/`UNAVAILABLE`, never silent `EXTERNAL_OPTIONAL` |

## Files added / changed (Turn 5 only)

| Path | Role |
|------|------|
| `tests/unit/test_batch_e_adversarial.py` | NEW — adversarial suite (9 tests) |
| `proofs/spe_v1_continuation/batch_e/BATCH_E_REPORT.md` | This evidence |

Prior Turns 2–4 files remain as previously committed (registry, adapter, UI/bind, TURN*_*.md).

## Tests executed

### Turn 5 adversarial (new)

```
uv run --with pytest --with jsonschema pytest tests/unit/test_batch_e_adversarial.py -v --tb=short
```

- Exit: **0**
- Result: **9 passed**

### Turn 2–4 Python suites + adversarial + spe round-trip regression

```
uv run --with pytest --with jsonschema pytest \
  tests/unit/test_provider_profiles_registry.py \
  tests/unit/test_provider_adapter_routing.py \
  tests/unit/test_provider_profile_bind_spe.py \
  tests/unit/test_batch_e_adversarial.py \
  tests/portability/test_spe_context_protocol_roundtrip.py \
  -v --tb=short
```

- Exit: **0**
- Result: **45 passed**

### Batch D cheap regressions (web)

```
cd apps/web && npm run test:execution-contract
```

- Exit: **0** — PASS execution contract + profile bind + local record + conformance laws

```
cd apps/web && npm run test:artifact
```

- Exit: **0** — PASS artifact round-trip + bounded reconstruction contract

### Deploy safety gate (expect fail-closed)

```
node tools/deployment-safety-gate.mjs
```

- Exit: **2** (expected)
- `HOSTING=FORBIDDEN`; failed checks include `founder_unlock`, `tls`, `ddos_protection`, etc.

## Diff from Batch E base `5e3feb0`

Commits on branch after base (local, not pushed as of Turn 5):

- `319b1b6` feat(batch-e): versioned provider profile registry (Turn 2)
- `e90b689` feat(batch-e): thin provider adapter + local-first routing (Turn 3)
- `4441d04` feat(batch-e): profile UI + contract/record/.spe bind (Turn 4)
- *(this commit)* test(batch-e): adversarial suite + BATCH_E_REPORT (Turn 5)

`git diff --stat 5e3feb04b1cf60b5e8a13041db4556417a7bd2c5..HEAD` prior to Turn 5 commit:
22 files, +2151 / −12 (Turns 2–4). Turn 5 adds the adversarial test + this report.

## Residual risks / claims NOT proven

- **WASM / Rust `select_profile` parity** — **NOT done** (optional; not cheap). Web display/bind remains `ts_mirror`; semantic owner is Python `spe_runtime.providers.profiles+adapter`.
- **Screenshots** of ACTIVE PROFILE panel — **missing** this turn (optional).
- **Live external provider calls / credential release / network enablement** — out of scope; not exercised.
- **Python `loads_spe_artifact` does not re-validate forged `execution_record.conformance.overall`** the way the TS import path rejects UNKNOWN→PASS laundering. Adversarial coverage proves re-selection + registry stay closed; full durable-record re-lint on Python import is a residual.
- **No independent replication / WORLD#1** — **NOT_PROVEN**.
- **Hosting / public deploy** — **FORBIDDEN**; gate exit 2.
- **Batch F** — not started.

## Honesty

Selection is observational routing only. It does not mint AuthorityGrant, enable network, release credentials, compile prompts, or mutate ProtectedIntent. `EXTERNAL_OPTIONAL` requires explicit `allow_external`. Default policy is local-first and closed.
