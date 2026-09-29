# No second brain

Python `spe_runtime/quality/engine.py` is the semantic reference. Rust `portable/spe-core-rs/src/quality.rs` is checked against it by `tests/portability/test_quality_parity_57.py`. WASM calls `spe_core_rs::evaluate_json_str` with `spe_api=quality`.

`apps/web/src/engine/qualityTransport.ts` only JSON-encodes a request and returns the kernel output. It does not choose a repair, compute a disposition, or map `UNKNOWN` to `PASS`. `tests/web/test_web_architecture_gates.py::test_ts_quality_transport_does_not_decide_delta` locks that boundary.

There is no model call, no network import, and no hidden rewrite loop in the quality module.
