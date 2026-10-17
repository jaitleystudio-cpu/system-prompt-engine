# Task57R runtime custody

Caller fields do not mint `ENFORCEMENT_VERIFIED`.

- `apps/web/scripts/test-quality-runtime-custody.mjs` passed.
- A dedicated Worker `type: "quality"` path verifies WASM bytes, refuses imports, and overwrites caller `proof_class`, `wasm_available`, `wasm_sha256`, and `enforcement` before evaluation.
- Generic `evaluate` of `spe_api=quality` returns `TRUSTED_QUALITY_PATH_REQUIRED`.
- Hash mismatch and import count > 0 return no result and `trusted: false`.
- Receipts bind `subject_digest`, `wasm_sha256`, `runtime_path`, and `integrity_state`.
- Absent runtime evidence caps proof at `ENFORCEMENT_AVAILABLE`.
- Verified worker evidence plus a passing quality run can be `ENFORCEMENT_VERIFIED`.
- `EXECUTE` never becomes `EXECUTION_OBSERVED`.

Shipped WASM SHA at this writing: `0537fc879b42524d36cf94b965e1234f02cf557c47cc55c7b1612d5643c70fcb`.
