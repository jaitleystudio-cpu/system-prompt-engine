# Batch E Turn 4 — Profile UI + Contract / Record / `.spe` Bind

**HOSTING=FORBIDDEN. WORLD#1=NOT_PROVEN.**

## Custody

| Field | Value |
|-------|-------|
| Branch | `grok/spe-v1-full-product-continuation-20260925` |
| Base SHA (Turn 3) | `e90b689b10bc8212fb2effcb3476e30cb7c25318` |
| Batch E stack base | `5e3feb04b1cf60b5e8a13041db4556417a7bd2c5` |
| Scope | Turn 4 ONLY (UI + persistence bind) |
| Not done | Turn 5 (adversarial suite / full Batch E report) |
| Forbidden | push, deploy/host, workflow edits, Cloud Agent, Batch F |

## Deliverable

1. **Minimal UI — ACTIVE PROFILE** on `ExecutionContractPanel`, clearly separate from AUTHORITY (CONTRACT · ACTIVE PROFILE · AUTHORITY). TrustPanel notes bind/display honesty. No Tailwind/shadcn redesign.
2. **Execution Contract bind** — `provider_profile_id`, `profile_version`, `provider_profile_digest`, selection status/reason on `BoundExecutionContract` inside `LocalExecutionRecord`.
3. **Persist on `execution_record`** (packages/web-runtime) — not ProofReceipt. PASS/FAIL/UNKNOWN preserved; UNKNOWN never launders to PASS. New check `profile-not-authority`.
4. **`.spe` export/import/round-trip** preserves provider-profile lineage (TS + Python). Backward compatible when `execution_record` absent.
5. **Honesty:** UI display + web dry-run bind use a **TS mirror** of Turn 2 registry ids/versions/digests (`providerProfiles.ts`). Semantic owner remains `spe_runtime.providers.profiles+adapter`. No TS semantic fallback inventing a new brain; no WASM select_profile parity this turn.

### Default bind (web dry-run)

Local-first mirror with `allow_external=false` → **DETERMINISTIC** `1.0.0`  
digest `241a3cd79fbfe921dc84835145e89639a8c90703574b87f77d06b158a93afe8d`  
(`profile_authority_granted: false` always)

## Files added / changed

| Path | Role |
|------|------|
| `packages/web-runtime/src/providerProfiles.ts` | NEW — thin TS mirror + `selectMirroredProfile` |
| `packages/web-runtime/src/executionRecord.ts` | Bind profile fields + `profile-not-authority` check |
| `packages/web-runtime/src/index.ts` | Export mirror |
| `apps/web/src/workspace/ExecutionContractPanel.tsx` | ACTIVE PROFILE card + record dl |
| `apps/web/src/ui/TrustPanel.tsx` | Honest display/bind note |
| `apps/web/src/index.css` | 3-col grid + profile card styles |
| `apps/web/scripts/test-execution-contract.mjs` | Profile + round-trip + no-escalation asserts |
| `spe_runtime/portability/spe_artifact.py` | Persist optional `execution_record` (no `receipt`) |
| `schemas/spe_artifact.schema.json` | Optional `execution_record` property |
| `tests/unit/test_provider_profile_bind_spe.py` | NEW — Python `.spe` profile lineage round-trip |
| `proofs/spe_v1_continuation/batch_e/TURN4_BIND.md` | This evidence |

## Test commands

### Web: execution contract + profile bind + artifact

```
cd apps/web && npm run test:execution-contract && npm run test:artifact
```

- Exit code: **0**
- Result: **PASS** execution contract + profile bind + local record + conformance laws; **PASS** artifact round-trip

### Python: profile bind + Turn 2/3 + spe round-trip regression

```
uv run --with pytest --with jsonschema pytest \
  tests/unit/test_provider_profile_bind_spe.py \
  tests/unit/test_provider_profiles_registry.py \
  tests/unit/test_provider_adapter_routing.py \
  tests/portability/test_spe_context_protocol_roundtrip.py -v --tb=short
```

- Exit code: **0**
- Result: **36 passed**

### Typecheck

```
cd apps/web && npx tsc --noEmit
```

- Exit code: **0**

## Residual / Turn 5 next

- Adversarial suite / full Batch E report
- Optional: WASM/Rust parity for `select_profile` (today display/bind is ts_mirror)
- Screenshots of ACTIVE PROFILE panel (optional; not blocking Turn 4)
- Do **not** start Batch F; keep HOSTING forbidden; WORLD#1 remains NOT_PROVEN

## Final SHA

Tip for this Turn 4 evidence (no self-hash in-blob — amend would drift):

```
git log -1 --format=%H --grep='profile UI + contract/record/.spe bind (Turn 4)'
```

Or `git rev-parse HEAD` on branch `grok/spe-v1-full-product-continuation-20260925` after this commit. **Do not push.**
