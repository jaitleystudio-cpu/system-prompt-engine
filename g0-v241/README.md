# SPE Ω v2.4.1 G0 handoff

Do not treat this branch as a product release.

- G0 hermetic fixture pack: replayable
- Pack SHA-256: `b8a512c9c3b44938a7b91238476067c17b26e8c2bfd9985a5db3b6a0c5da4a29`
- Implementation binding: UNBOUND
- TLC: NOT RUN
- World #1: NOT PROVEN

This branch adds `g0-v241/` next to the existing NEW_IMPLEMENTATION tree on `main`.
It does not replace portable Rust/WASM work.

Download the full bytes from the conversation zip:
`SPE_OMEGA_V2_4_1_HANDOFF_FULL.zip`
sha256 `f2080d0750c3d47175e97dd8778a88aa77949127f5f0d4142790762f31470813`

## Replay (after unzipping g0-replay-only into this folder)

```bash
python3 spe_schema_profile_validator_v1.py
python3 spe_invariant_vector_runner_v2.py
python3 spe_contradiction_checker_v3.py
python3 spe_mutation_suite_v2.py
python3 spe_design_close_oracle_v4.py
```

PASS means fixture/design-contract conformance only.
