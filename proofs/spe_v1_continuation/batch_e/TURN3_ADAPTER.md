# Batch E Turn 3 — Thin Capability ABI Adapter + Local-First Routing

**HOSTING=FORBIDDEN. WORLD#1=NOT_PROVEN.**

## Custody

| Field | Value |
|-------|-------|
| Branch | `grok/spe-v1-full-product-continuation-20260925` |
| Base SHA (Turn 2) | `319b1b6eac7e64527e4b5fc3a85bb13dec21e717` |
| Scope | Turn 3 ONLY (thin provider adapter + local-first routing) |
| Not done | Turns 4–5 (UI panel, execution_record bind, `.spe` lineage) |
| Forbidden | push, deploy/host, workflow edits, Cloud Agent, clone |

## Deliverable

Thin Capability ABI adapter selecting Turn 2 provider profiles under deterministic local-first policy:

- `select_profile(need, policy) → ProfileSelection(profile_id, status, reason)`
- Preference: `DETERMINISTIC` → `LOCAL_WASM` → `EXTERNAL_OPTIONAL` (only when `allow_external=true`) → else `BLOCKED` / `UNAVAILABLE`
- Never silently falls back from local/private to remote
- Selection ≠ AuthorityGrant; network not auto-enabled; credentials not released
- Does not mint authority, mutate ProtectedIntent, or compile prompts

### Wiring (reuse, no second brain)

| Piece | Role |
|-------|------|
| `spe_runtime/providers/profiles.py` + `data/provider_profiles_v1.json` | Turn 2 registry (unchanged contract) |
| `spe_runtime/providers/adapter.py` | New thin selector |
| `spe_runtime/protocols/capability_routing.py` | Extended with DATA-only wraps (`capability_profile_for_provider`, `build_auto_route_node_for_provider`) — not a parallel router |
| `spe_runtime/portability/abi.py` / `capability.py` | Unchanged ABI + capability downgrade law |

### Policy flags

- `allow_external` / `explicit_allow_external` — required for `EXTERNAL_OPTIONAL`
- `allow_network` / `explicit_allow_network` — required when need is `network_required`
- `credentials_available` — informational only; never auto-enables external or releases secrets

## Files added / changed

- `spe_runtime/providers/adapter.py` (new)
- `spe_runtime/providers/__init__.py` (exports)
- `spe_runtime/protocols/capability_routing.py` (thin wraps)
- `spe_runtime/protocols/__init__.py` (exports)
- `tests/unit/test_provider_adapter_routing.py` (new)
- `proofs/spe_v1_continuation/batch_e/TURN3_ADAPTER.md` (this file)

## Test commands

### New adapter suite

```
uv run --with pytest --with jsonschema pytest tests/unit/test_provider_adapter_routing.py -v --tb=short
```

- Exit code: **0**
- Result: **12 passed**

### Turn 2 registry + cheap related routing/capability/ABI

```
uv run --with pytest --with jsonschema pytest tests/unit/test_provider_profiles_registry.py tests/unit/test_provider_adapter_routing.py tests/portability/test_capability.py tests/unit/test_protocol_merge_and_routing.py tests/portability/test_abi.py -v --tb=short
```

- Exit code: **0**
- Result: **42 passed**

## Residual / Turn 4 next

- UI panel for provider profile inspection / selection display (read-only; no live spend)
- Do **not** bind `execution_record` or `.spe` lineage until Turn 5
- Do not implement live external calls; keep credentials gated
- Keep HOSTING forbidden; WORLD#1 remains NOT_PROVEN

## Final SHA

Filled post-commit via `git rev-parse HEAD`.
