# Task 57R-F3E results

**Superseded.** This note describes the recovered-only subset (`C01`, `C02`, `C03`, `C06`, `C07`) from an intermediate commit. The tip contract is `TASK57R_F3E_AUTO_XCAT_CLOSURE.md`: one `route_mission_stage`, categories `CAT:C01`–`CAT:C12`, no second router.

Parent inspection: `83c354f51af1c4a967811ed03284b4e539925e55` (F3D HOLD).
This note records the AUTO-XCAT implementation tests. It does not reopen F3D and does not authorize merge, deploy, or host.

## Contract checks

- `tests/unit/test_xcat_auto_route_f3e.py` — AI Assistant is not a category; no C01 default; recovered goal tokens route; unrecovered English names and product labels hold; Writing/Research/Analysis bridges stay receipt-only except the existing K3 Research/Analysis map; exclusive flags route; C07 is not inferred from prose "execute"; explicit unrecovered ids stay ROUTED with `NOT_RECOVERED`; frozen router unchanged; K3 digest and techniques stay frozen; receipt `effect_plan` is `NO_EFFECT_PLAN`.
- `tests/unit/test_quality_auto_xcat_f3e.py` — recovered auto route can satisfy `bind:xcat`; generic hold is `UNKNOWN` / `AUTO_XCAT_NEEDS_DISAMBIGUATION` and `VALIDATE_ONLY` is not PASS; Coding display is `PROTOCOL_HOLD`; explicit `xcat_id` wins.
- Display maps in `spe_runtime/xcat/auto_route.py` are local copies locked equal to `spe_runtime.k3.registry`. `auto_route` does not import K3.

## Runtime parity

Python, Rust `spe-core-eval`, and the promoted WASM agree on the F3E `auto_route` cases and on the frozen K3 vectors, including N01.

WASM pin:

- sha256 `e527b1f5b35f745c1e7f754a25d128c440326c8a23657453cec62c254ab167f7`
- bytes 1301412
- imports 0
- exports `memory`, `spe_alloc`, `spe_evaluate`, `spe_free`
- F3 historical pin remains `a2a2041b0c2b485b5e61347d6e2f13ce613f3a25c1e2dcccc0e178a7aad347bf` / 1275679
- measure-only build and the later pin-checked canonical rebuild were byte-identical; the supply-chain dirty-candidate rebuild matched the same digest

## Commands

```
python3 -m pytest -q \
  tests/unit/test_xcat_auto_route_f3e.py \
  tests/unit/test_quality_auto_xcat_f3e.py \
  tests/unit/test_k3_runtime.py \
  tests/unit/test_quality_task57r.py \
  tests/unit/test_xcat_vectors_56b.py \
  tests/portability/test_xcat_parity_56b.py \
  tests/portability/test_k3_cross_runtime.py \
  tests/portability/test_quality_parity_57.py \
  tests/portability/test_quality_parity_57r.py \
  tests/web/test_web_architecture_gates.py \
  tests/release/test_wasm_canonical_supply_chain.py
```

Result: 139 passed.

```
python3 -m pytest -q \
  tests/unit/test_quality_task57.py \
  tests/unit/test_xcat_domain_56b.py \
  tests/unit/test_xcat_mutations_56b.py \
  tests/unit/test_quality_task57r_f3.py \
  tests/unit/test_k3_effect.py \
  tests/unit/test_xcat_core.py \
  tests/integration/test_xcat_c02_c06_c01_c03.py
```

Result: 215 passed.

```
cargo test --manifest-path portable/spe-core-rs/Cargo.toml --lib --locked
cargo test --manifest-path portable/spe-core-rs/Cargo.toml --locked --test k3_selection
```

Result: 2 passed, then 2 passed.

## Claim

AUTO-XCAT is implemented for recovered signals only (C01, C02, C03, C06, C07).
Unrecovered categories are not given invented protocols.
A generic Create task with no recovered signal stays `NEEDS_DISAMBIGUATION`.
`UNKNOWN` is not `PASS`.
`NO_EFFECT_PLAN` is not a compiled prompt.

DO NOT MERGE.
DO NOT DEPLOY.
DO NOT HOST.
