# Batch E Turn 2 — Versioned Provider Profile Registry

**HOSTING=FORBIDDEN. WORLD#1=NOT_PROVEN.**

## Custody

| Field | Value |
|-------|-------|
| Branch | `grok/spe-v1-full-product-continuation-20260925` |
| Base SHA | `5e3feb04b1cf60b5e8a13041db4556417a7bd2c5` |
| Scope | Turn 2 ONLY (provider profile registry + unit tests) |
| Not done | Turns 3–5 (adapter wiring, UI panel, execution_record/.spe bind) |
| Forbidden | push, deploy/host, workflow edits, Cloud Agent, clone |

## Deliverable

Versioned **provider** profile registry (data, not product prose), distinct from domain grounding profiles:

- Domain grounding remains: `spe_runtime/grounding/profiles.py` + `data/grounding/domain_profiles.json`
- Provider profiles (new): `spe_runtime/providers/profiles.py` + `data/provider_profiles_v1.json` + `schemas/provider_profile.schema.json`

### Profiles shipped

| profile_id | local_or_external | requires_network | requires_credentials | authority_capabilities |
|------------|-------------------|------------------|----------------------|------------------------|
| LOCAL_WASM | local | false | false | `[]` |
| DETERMINISTIC | local | false | false | `["read_status"]` |
| EXTERNAL_OPTIONAL | external | true | true | `[]` |

`EXTERNAL_OPTIONAL` sets `privacy_behavior.auto_enable=false` and `requires_explicit_opt_in=true` — network is declared, not auto-enabled.

`pricing_metadata_if_known` is `null` for all three (no fabricated live prices).

### API (Python)

- `load_provider_profile_registry()`
- `get_provider_profile(profile_id, version=None)` — unknown id / version mismatch → `KeyError`
- `list_provider_profile_ids()` / `list_provider_profiles()`
- `provider_profile_digest` / `provider_registry_digest` (canonical_dumps + sha256)
- `validate_provider_profile` — required fields + non-escalating authority

Registry digest: `18db28831eed1c7d93c3f52756e26483a4969b157373b00d37210c43dec5e1fd`

## Files added

- `data/provider_profiles_v1.json`
- `schemas/provider_profile.schema.json`
- `spe_runtime/providers/__init__.py`
- `spe_runtime/providers/profiles.py`
- `tests/unit/test_provider_profiles_registry.py`
- `proofs/spe_v1_continuation/batch_e/TURN2_REGISTRY.md`

## Test commands

### New unit suite

```
uv run --with pytest --with jsonschema pytest tests/unit/test_provider_profiles_registry.py -v --tb=short
```

- Exit code: **0**
- Result: **14 passed** in ~0.27s

### Related regression (cheap)

```
uv run --with pytest --with jsonschema pytest tests/portability/test_canonical.py tests/portability/test_capability.py tests/unit/test_grounding_models.py -v --tb=short
```

- Exit code: **0**
- Result: **12 passed** in ~0.06s

## Residual / Turn 3 next

- Wire adapter selection to profile_id (no live spend; gate credentials).
- Do not overload grounding domain profiles.
- Do not bind execution_record / `.spe` until Turn 5.
- Keep HOSTING forbidden; WORLD#1 remains NOT_PROVEN.

## Final SHA

Filled in commit message / post-commit `git rev-parse HEAD` (see PR evidence after local commit).
