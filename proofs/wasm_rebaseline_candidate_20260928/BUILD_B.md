# Build B

Second clean canonical build. Same recipe. Different absolute checkout directory and a different clean target directory, outside the repository.

| Field | Value |
| --- | --- |
| Path class | `external-clean-target` |
| Checkout class | second worktree of the same source SHA, not the build A checkout |
| Source git SHA | `e0497f79898689a00a30abeab67652d5f6a9193c` |
| Cargo.lock git blob | `f26fd3d70b52645034b33b27bf5b95664d3a6103` |
| rustc | 1.98.1 (`48a229ceaefd4985c50990b14116b6d856af0985`, 2026-09-01) |
| cargo | cargo 1.98.1 (797e8a9bc 2026-08-05) |
| active toolchain | 1.98.1, overridden by that checkout's `rust-toolchain.toml` |
| target | `wasm32-unknown-unknown` |
| RUSTFLAGS shape | repository root of that checkout mapped to `./`; cargo home mapped to `./.cargo` |
| command | `node tools/wasm_canonical_build.mjs` with `SPE_WASM_CANDIDATE_TARGET_DIR` set to a fresh external directory |
| size | 671621 |
| sha256 | `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` |
| imports | 0 |
| promoted | no |

`BUILD_A_SHA256 == BUILD_B_SHA256`.

A third rebuild with the diagnostic `SPE_WASM_RUSTC_LOG` environment variable, which does not change rustc arguments, produced the same sha256. A verbose cargo invocation using the same wrapper, remap, incremental setting, and release profile also produced the same sha256. Verbose mode is not part of the canonical command.
