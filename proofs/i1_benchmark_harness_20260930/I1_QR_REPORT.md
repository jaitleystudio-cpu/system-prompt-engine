# SPE I1-QR REPORT

WASM reproducibility root-cause reconciliation. Proof only. The WASM pin, frozen runtime, build law, and semantic sources were not modified.

```
RUNTIME_SHA=
145b844d59161d54d8ea58d2586ec2cae16dbe8a

FROZEN_WASM_SHA=
b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b

GROK_REBUILD_A=
b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b
bytes_a=1340112
imports_a=0

GROK_REBUILD_B=
b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b
bytes_b=1340112
imports_b=0

CURSOR_REBUILD=
931d154a2002bb5fa85a00f2b59b966b3bf452821ad47affcb6cb460fea0fad5
bytes=1339801
bytes_in_custody=NO

F4_TOOLCHAIN=
rustc_release=1.98.1
rustc_commit=48a229ceaefd4985c50990b14116b6d856af0985
cargo=cargo 1.98.1 (797e8a9bc 2026-08-05)
node=v22.14.0
npm=10.9.7
os=Ubuntu 24.04.4 LTS, Linux 6.12.94+, x86_64
rustc_Vv_full=UNKNOWN
llvm=UNKNOWN
host_triple=UNKNOWN
wasm32_rust_std_hash=UNKNOWN
cargo_lock_sha256=f7d262321e41b5b9b2b495040663d92f98e03e2894b95238891bfe39ab3a56e3
rust_toolchain_toml_sha256=dbc9ef41d801c3173680ffbadb5b0afbd818eb8b06fee6ed6d88cc8f375984dd
cargo_config=ABSENT
RUSTFLAGS_env=UNKNOWN
CARGO_ENCODED_RUSTFLAGS=UNKNOWN
SOURCE_DATE_EPOCH=UNKNOWN
profile=release
post_rust_tools=UNKNOWN
canonical_script_invokes_wasm_opt=NO

CURRENT_TOOLCHAIN=
rustc_release=1.98.1
rustc_commit=48a229ceaefd4985c50990b14116b6d856af0985
rustc_commit_date=2026-09-01
host=x86_64-unknown-linux-gnu
llvm=22.1.8
cargo=cargo 1.98.1 (797e8a9bc 2026-08-05)
active=1.98.1-x86_64-unknown-linux-gnu overridden by rust-toolchain.toml
wasm_target=wasm32-unknown-unknown installed
rustc_bin_sha256=859254978c0a0402c32f949f6de0d99aee73be8d15f45aac00ae1448aac51e74
cargo_bin_sha256=da77c8b33849312255ccde3179198ada4c8deb370488d050286146b1d1b27e14
wasm32_rust_std_files=54
wasm32_rust_std_rel_manifest_sha256=6bdec021caa2224af352d4a636a9a6091c7430d953e7b305ef045ac59d68b832
node=v22.14.0
npm=10.9.7
os=Ubuntu 24.04.4 LTS, Linux 6.12.94+, x86_64, 4 cores
RUSTFLAGS_env=UNSET
CARGO_ENCODED_RUSTFLAGS=UNSET
SOURCE_DATE_EPOCH=UNSET
CARGO_BUILD_JOBS=UNSET
cargo_config=ABSENT
wasm-opt=NOT_INSTALLED
wasm-strip=NOT_INSTALLED
wasm-tools=NOT_INSTALLED
wasm-objdump=NOT_INSTALLED
wasm2wat=NOT_INSTALLED
profile=release

TOOLCHAIN_DIFFERENCES=
NONE_PROVEN
F4 fields not written in the F4 proof remain UNKNOWN. They are not counted as drift.

BUILD_INPUT_DIFFERENCES=
NONE
shared_input_tree_sha256=4c32aadffc2bbc75c907d8ac519c4cd8573d4ffbf7fd652309080ca4c63a1b78
paths=40
blob_diffs=0

BINARY_DIFFERENCE_CLASS=
UNKNOWN

CURSOR_VERIFIER_SUPERSESSION=
ce0e2675971fab31482513353706643c72c3eab1
bytes_in_custody=NO
verdict=I1_QV_HOLD
canonical_build_gate_exit=1

G1_WRAPPER_OFF=
checkout=/tmp/i1qr/runtime-145b844
RUSTC_WRAPPER=absent
sha256=326ea6b95a20bc459bd4858946cfc61c2541dcc7a0c08c542fa61ff14dc2e365
bytes=1340128
delta_vs_pin=+16
equals_cursor_931d154a=NO
changed_section=custom name only (282803 -> 282819)
code_payload_sha256=unchanged
data_payload_sha256=unchanged
applied_to_cursor_gap=NO

PINNED_PARITY=
PASS
positive=55
negative=55
python_rust_mismatches=0
rust_wasm_mismatches=0
python_wasm_mismatches=0
semantic_mismatches=0

REBUILT_PARITY=
GROK_REBUILD_B=PASS (byte-identical to the pin; same 55+55 vector tool; all mismatch counters 0)
CURSOR_931d154a=UNKNOWN (artifact bytes not in custody)

ROOT_CAUSE=
F. UNRESOLVED

REMEDIATION_PROPOSAL=
Do not change the pin, the frozen SHA, or the build law.
Obtain the Cursor artifact bytes for 931d154a and Cursor's rustc -Vv, cargo -V, rustup show, wasm32 rust-std manifest hash, and a section-size table from the same canonical script.
Compare that table to the pinned section inventory in this report.
If the producers rustc string differs, the minimal toolchain identity to require is rustc commit 48a229ceaefd4985c50990b14116b6d856af0985, LLVM 22.1.8, cargo 1.98.1 (797e8a9bc 2026-08-05), and wasm32 rust-std rel-manifest sha256 6bdec021caa2224af352d4a636a9a6091c7430d953e7b305ef045ac59d68b832.
If producers and target_features match and the code or data payload size differs, inspect the rustc wrapper metadata replacement log before any hermeticity change.
I2 stays unauthorized until a founder accepts a cause.

SOURCE_MODIFIED=NO
PIN_MODIFIED=NO

I1_QUALIFIED=NO
I1_FINAL_QUALIFIED=NO
I2_AUTHORIZED=NO

FINAL:
I1_QR_HOLD
```

## Locked status

| Field | Value |
| --- | --- |
| I1_IMPLEMENTATION_PASS | YES |
| GROK_I1_Q_PASS | VALID_WITHIN_GROK_ENVIRONMENT |
| CURSOR_I1_QV | HOLD |
| CROSS_ENVIRONMENT_REPRODUCIBILITY | UNRESOLVED |
| I1_INTEGRATION_QUALIFIED | NO |
| I1_WASM_REPRODUCIBILITY | HOLD |
| I2_AUTHORIZED | NO |

STOP. DO NOT START I2. DO NOT MERGE. DO NOT DEPLOY. DO NOT HOST.

## 1. Rebuild on the runtime SHA

Detached worktree `/tmp/i1qr/runtime-145b844` at `145b844d59161d54d8ea58d2586ec2cae16dbe8a`. `git status --porcelain` was empty. `git diff` was empty. The worktree is an ancestor of proof parent `26bf1eaeef5ad8efd03b39637dd01b06bdd48f03`. The only name difference between that proof parent and the runtime SHA is `proofs/i1_benchmark_harness_20260930/I1_Q_REPORT.md`.

Both builds used `tools/wasm_canonical_build.mjs` with `SPE_WASM_MEASURE_ONLY=1`. Build B set `SPE_WASM_CANDIDATE_TARGET_DIR=/tmp/i1qr/target-b`. The script deletes the target directory and runs `cargo build --locked --target wasm32-unknown-unknown --release`. The public file was not copied onto the cargo output. Result inodes differ from `apps/web/public/spe_wasm.wasm`. Cargo also hardlinks the release wasm to `deps/spe_wasm.wasm` inside the same target directory.

| Build | sha256 | bytes | imports | exports |
| --- | --- | --- | --- | --- |
| A | `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` | 1340112 | 0 | memory, spe_alloc, spe_evaluate, spe_free |
| B | `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` | 1340112 | 0 | memory, spe_alloc, spe_evaluate, spe_free |

A equals B and equals the frozen pin. Grok still reproduces the pin on this runtime SHA. This is stability inside the Grok environment since I1-Q. It does not explain the Cursor hash.

## 2. F4 toolchain recovered from proof `97ef090`

Source: `proofs/f4_independent_reproduction_20260930/F4_REPORT.md`, `logs/npm-build.txt`, `logs/wasm-build-a.txt`, `logs/wasm-build-b.txt`. A search of that proof tree found no `rustc -Vv` dump, no `SOURCE_DATE_EPOCH`, no `CARGO_ENCODED_RUSTFLAGS`, and no wasm-opt, wasm-tools, or binaryen version.

The npm log line `rustc_commit=48a229ceaefd4985c50990b14116b6d856af0985` is the canonical script echoing `EXPECTED_COMMIT` after `assertCompiler` required the live `rustc -Vv` text to contain that commit-hash and `release: 1.98.1`. The full `-Vv` text was not saved. LLVM, host triple, and the wasm32 rust-std hash are UNKNOWN for F4.

`git ls-tree` of the F4 commit has `rust-toolchain.toml` and no `.cargo/` directory. F4 and this runtime SHA have the same blob for that file.

The canonical script sets `RUSTFLAGS` to `--remap-path-prefix` for the repo root and `CARGO_HOME`, sets `CARGO_INCREMENTAL=0`, and sets `RUSTC_WRAPPER` to `tools/spe_wasm_rustc_wrapper.mjs`. It does not call wasm-opt, wasm-strip, or wasm-tools. Whether any of those tools were installed on the F4 machine is UNKNOWN. The script's own post-Rust step is absent in the shared script blob.

Cargo.lock sha256 below is the blob shared by F4 and `145b844`, computed in this mission. F4 did not record it.

| Field | F4 |
| --- | --- |
| rustc release | 1.98.1 |
| rustc commit-hash gate | `48a229ceaefd4985c50990b14116b6d856af0985` |
| rustc -Vv full text | UNKNOWN |
| LLVM | UNKNOWN |
| host triple | UNKNOWN |
| cargo | `cargo 1.98.1 (797e8a9bc 2026-08-05)` |
| active toolchain raw rustup line | UNKNOWN. The script prints a normalized `1.98.1 (overridden by repository rust-toolchain.toml)` after requiring the raw line to start with `1.98.1` |
| wasm32-unknown-unknown installed | implied by the successful build. Target-library hashes UNKNOWN |
| Node | v22.14.0 |
| npm | 10.9.7 |
| OS | Ubuntu 24.04.4 LTS, Linux 6.12.94+, x86_64 |
| `.cargo/config*` | absent from the tree |
| `RUSTFLAGS` outside the script | UNKNOWN |
| `CARGO_ENCODED_RUSTFLAGS` | UNKNOWN |
| `SOURCE_DATE_EPOCH` | UNKNOWN |
| profile | release (`--release` in the canonical script) |
| linker flags beyond the script's RUSTFLAGS | UNKNOWN |
| wasm-opt / wasm-strip / wasm-tools / binaryen | UNKNOWN as installed versions. Not invoked by the shared canonical script |

## 3. Current Grok fingerprint

Collected on this machine while the runtime worktree was checked out.

```
rustc 1.98.1 (48a229cea 2026-09-01)
commit-hash: 48a229ceaefd4985c50990b14116b6d856af0985
commit-date: 2026-09-01
host: x86_64-unknown-linux-gnu
release: 1.98.1
LLVM version: 22.1.8
cargo 1.98.1 (797e8a9bc 2026-08-05)
active: 1.98.1-x86_64-unknown-linux-gnu
active because: overridden by rust-toolchain.toml
installed targets: wasm32-unknown-unknown, x86_64-unknown-linux-gnu
```

`rustc` binary sha256 `859254978c0a0402c32f949f6de0d99aee73be8d15f45aac00ae1448aac51e74`. `cargo` binary sha256 `da77c8b33849312255ccde3179198ada4c8deb370488d050286146b1d1b27e14`.

wasm32 rust-std: 54 files under `lib/rustlib/wasm32-unknown-unknown`. Relative manifest sha256 `6bdec021caa2224af352d4a636a9a6091c7430d953e7b305ef045ac59d68b832` (sha256 over sorted relative path, NUL, and the file's sha256). F4 has no recorded counterpart, so this hash is current-only.

Environment at collection time: `SOURCE_DATE_EPOCH` unset, `RUSTFLAGS` unset, `CARGO_ENCODED_RUSTFLAGS` unset, `CARGO_BUILD_JOBS` unset. The canonical script supplies its own `RUSTFLAGS` for the cargo child. Node v22.14.0. npm 10.9.7. Ubuntu 24.04.4 LTS, Linux 6.12.94+, 4 cores.

`wasm-opt`, `wasm-strip`, `wasm-tools`, `wasm-objdump`, and `wasm2wat` are not installed. Section data below is from a structural walk of the WASM module (magic, version, section id, LEB128 payload length, custom-section name) plus `WebAssembly.compile` for imports and exports.

### Field comparison

Known on both sides and equal: rustc release 1.98.1, rustc commit-hash `48a229ceaefd4985c50990b14116b6d856af0985`, cargo `1.98.1 (797e8a9bc 2026-08-05)`, Node v22.14.0, npm 10.9.7, Ubuntu 24.04.4 LTS, Linux 6.12.94+, x86_64, release profile, absent `.cargo` config, identical `rust-toolchain.toml`, identical canonical script.

Known only on the current machine (F4 UNKNOWN, not a proven difference): full `rustc -Vv`, LLVM 22.1.8, host triple, rustc and cargo binary hashes, wasm32 rust-std manifest, raw `rustup show` line, unset `SOURCE_DATE_EPOCH` / `RUSTFLAGS` / `CARGO_ENCODED_RUSTFLAGS`, absence of wasm-opt and wasm-tools.

Proven toolchain differences: none.

Cursor's toolchain was not provided and was not found in PR #71 comments. It is UNKNOWN. Toolchain drift against Cursor is not confirmed.

## 4. Build input manifest

Compared `97ef090` to `145b844` for `portable/spe-core-rs/**`, `portable/spe-wasm/**`, `rust-toolchain.toml`, `tools/wasm_canonical_build.mjs`, `tools/spe_wasm_rustc_wrapper.mjs`, `tools/spe_wasm_node_host.js`, `tools/wasm_candidate_engine_fixture.mjs`, `tools/wasm_candidate_vectors.py`, and every `Cargo.toml`, `Cargo.lock`, and `build.rs` those trees contain. No `build.rs` is present. No `.cargo` config is present.

| Result | Value |
| --- | --- |
| F4 path count | 40 |
| runtime path count | 40 |
| only on F4 | 0 |
| only on runtime | 0 |
| differing blobs | 0 |
| tree hash | `4c32aadffc2bbc75c907d8ac519c4cd8573d4ffbf7fd652309080ca4c63a1b78` |

Content sha256 at `145b844` (identical blobs on F4):

| Input | sha256 |
| --- | --- |
| `portable/spe-wasm/Cargo.lock` | `f7d262321e41b5b9b2b495040663d92f98e03e2894b95238891bfe39ab3a56e3` |
| `portable/spe-wasm/Cargo.toml` | `2bee7cbbf07dab553aeb9cbc58f542943b32023b6ad331ff4c5c1413d5a879b5` |
| `portable/spe-core-rs/Cargo.lock` | `612443c73331ef78fef96c3fb9fe5369bf26c86d1c7e0fb868577d24c8d383e2` |
| `portable/spe-core-rs/Cargo.toml` | `6d62162be5062145d38ef2cb15d8d6073fe244ba1179d4a53a870a7d8d321d69` |
| `rust-toolchain.toml` | `dbc9ef41d801c3173680ffbadb5b0afbd818eb8b06fee6ed6d88cc8f375984dd` |
| `tools/wasm_canonical_build.mjs` | `425c9e731641b72069e95b753ea8e74d22bdd5976078720041e922338e5f4633` |
| `tools/spe_wasm_rustc_wrapper.mjs` | `e198d2a9f5e87c865cce11a1328b824d65f77ff5c9ec023e58196883795d9ff9` |

`apps/web/public/spe_wasm.wasm` blob `83ecafb9853ce44d5aadcc9fb0d8bd00cf80aa5b` is the pin on both commits. Source custody mismatch for these shared frozen-core paths is not supported.

## 5. Binary differential

Grok rebuild A, Grok rebuild B, and the pinned file are the same sha256. There is no byte difference to classify between the pin and the Grok rebuild. Environment drift since I1-Q is not observed: I1-Q records the same hash, byte count, and import count.

The Cursor artifact `931d154a2002bb5fa85a00f2b59b966b3bf452821ad47affcb6cb460fea0fad5` is not in this workspace, not in PR #71 comments, and not in the git history searched here. A byte-level diff was not performed. The 311-byte figure is the arithmetic difference of the supplied sizes (1340112 − 1339801). It was not re-measured.

Pinned module inventory (version 1, 12 sections, import section absent):

| Order | Id | Section | Payload bytes | Payload sha256 |
| --- | --- | --- | --- | --- |
| 0 | 1 | type | 361 | `23af8d23dcf3882b7778ea9cc82d185303d920abe3995874a7ec0ef5af8057b9` |
| 1 | 3 | function | 1591 | `3606aacf3b1a8f17f9a67c08b026e067f6d85b28bb27c828a8dd77c63c9c2053` |
| 2 | 4 | table | 7 | `94ca378d5c3a2e6aa0f37b4e1d6b1baa8d6368c6a46936f06104577fa9a9f6e9` |
| 3 | 5 | memory | 3 | `2e2461dd6852f58de2d470cabcf5c41b6e56fdb6ee9169954fe02a13b3ef4bae` |
| 4 | 6 | global | 9 | `da3c74f89a28b8e9a570d349d0f0a216ef8e69818c7226007164845feaceaf63` |
| 5 | 7 | export | 48 | `b869d9a550c8a4cad77ac0389067d0016a6b66caf599b9968a921c42e4d09f1a` |
| 6 | 9 | elem | 255 | `071f578d55bad820f33baea404d7d4f1a77803f198a27ecb7587740c4460bdf3` |
| 7 | 10 | code | 828565 | `c374a3f33b680b27106b740e190622aa031124a56e17fb57081c68950af0982d` |
| 8 | 11 | data | 226203 | `038ab7d04d3153d5930e0455c410be24f4640d06270d70e53d2d3fd57ee1f6f6` |
| 9 | 0 | custom `name` | 282803 | `4bcbef50b12a53577f38fcaf8b6eef833931ebd1f15055fc54172e2f565f3d1a` |
| 10 | 0 | custom `producers` | 77 | `5d67a49632a1c5b6a451f6db7067a5e4bd58780d933cf33c3e503dca590b5642` |
| 11 | 0 | custom `target_features` | 148 | `97ceea95e0687b14437e21c205ebb40eea27aa5ecaa971f7d87601e3aa213bfd` |

Custom sections present: `name`, `producers`, `target_features`. The `producers` payload contains the strings `language`, `Rust`, `processed-by`, `rustc`, and `1.98.1 (48a229cea 2026-09-01)`. The `target_features` payload names `bulk-memory`, `bulk-memory-opt`, `call-indirect-overlong`, `multivalue`, `mutable-globals`, `nontrapping-fptoint`, `reference-types`, and `sign-ext`.

Code-section difference versus Cursor: UNKNOWN. Data-section difference versus Cursor: UNKNOWN. Custom-section difference versus Cursor: UNKNOWN.

`BINARY_DIFFERENCE_CLASS=UNKNOWN`. The producers payload is 77 bytes, so that section alone is smaller than the supplied 311-byte gap. That observation does not identify which section changed.

## 6. Semantic parity

Tool: `python3 tools/wasm_candidate_vectors.py <artifact>` from the runtime worktree. The tool compares Python, `spe-core-eval`, and the given wasm file. It does not read the pin file when an explicit path is passed.

| Artifact | Result |
| --- | --- |
| Pinned `apps/web/public/spe_wasm.wasm` | PASS. 55 positive, 55 negative. semantic, python↔rust, rust↔wasm, python↔wasm, negative-reason, authority, and protocol mismatches all 0 |
| Grok rebuild B `/tmp/i1qr/target-b/wasm32-unknown-unknown/release/spe_wasm.wasm` | PASS. Same counters. sha256 equals the pin |
| Cursor `931d154a…` | UNKNOWN. Bytes were not available to the vector tool |

Behavioral agreement between the pin and the Grok rebuild does not clear the cross-environment reproducibility HOLD.

## 7. Classification

| Class | Evidence |
| --- | --- |
| A. TOOLCHAIN_DRIFT_CONFIRMED | Not selected. Every F4 field that was actually recorded matches this machine. Cursor's toolchain is UNKNOWN |
| B. BUILD_PIPELINE_NON_HERMETIC | Not selected. The wrapper documents that Cargo metadata can embed an absolute path and replaces `-C metadata` for `spe_core_rs` and `spe_wasm`. This mission did not show an undeclared input that changes the bytes. Both Grok builds match the pin |
| C. FROZEN_PIN_STALE | Not selected. Two fresh builds at the runtime SHA reproduce `b707f5eb` / 1340112 / imports 0 |
| D. SOURCE_OR_CUSTODY_MISMATCH | Not selected. The 40 shared build-input paths have identical blobs on F4 and `145b844` |
| E. OTHER_PROVEN_CAUSE | Not selected. No other cause was proven |
| F. UNRESOLVED | Selected |

## 8. Remediation proposal (not executed)

The pin stays `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b`. The runtime SHA stays `145b844d59161d54d8ea58d2586ec2cae16dbe8a`. No build script, wrapper, toolchain file, or semantic source should be edited as part of this HOLD.

What would resolve the class:

1. Place the Cursor wasm bytes for `931d154a2002bb5fa85a00f2b59b966b3bf452821ad47affcb6cb460fea0fad5` where a later evidence pass can hash them and walk sections with the same parser.
2. Record Cursor `rustc -Vv`, `cargo -V`, `rustup show`, the wasm32 rust-std relative manifest hash defined above, Node version, and confirmation that `tools/wasm_canonical_build.mjs` ran with `SPE_WASM_MEASURE_ONLY=1` and the repo `RUSTC_WRAPPER`.
3. Diff section payload lengths and payload sha256 values against the table in section 5.
4. If the `producers` rustc string differs, treat that as toolchain drift and require the current-machine identity before any future rebuild is compared to the pin: rustc commit `48a229ceaefd4985c50990b14116b6d856af0985`, LLVM 22.1.8, cargo `1.98.1 (797e8a9bc 2026-08-05)`, wasm32 rust-std rel-manifest `6bdec021caa2224af352d4a636a9a6091c7430d953e7b305ef045ac59d68b832`.
5. If `producers` and `target_features` match and the code or data payload differs, capture the wrapper's `-C metadata` replacement log for `spe_core_rs` and `spe_wasm` on both machines before changing the build law.

Until that evidence exists, I1 stays integration-unqualified and I2 stays unauthorized.

## 9. Evidence file

`proofs/i1_benchmark_harness_20260930/I1_QR_EVIDENCE.json` stores the rebuild hashes, the parity counters, the full pinned section payload digests, the Cursor verifier supersession custody, and the wrapper-off negative.

## 10. G1 reinforcement

Additional custody is commit `ce0e2675971fab31482513353706643c72c3eab1` on `cursor/spe-i1-q-20260930` (author Prawin Palisetty, 2026-09-30 07:12:06 +0530, parent `d34d822534d2834b4a5d29742f5b23ff0c628436`). The diff against runtime `145b844d59161d54d8ea58d2586ec2cae16dbe8a` is three files: `MEMORY.md`, `proofs/i1_q_20260930/SPE_I1_QV_HOLD_SUPERSESSION.md`, and `proofs/i1_q_20260930/SPE_I1_Q_REPORT.md`. None of those files contains the rebuilt WASM bytes, a section table, or a `rustc -Vv` dump. Those files were not copied onto this branch.

The supersession note records:

- `d34d822` report = SUPERSEDED, because a canonical WASM clean rebuild mismatch was discovered afterward.
- Runtime under test stays `145b844d59161d54d8ea58d2586ec2cae16dbe8a`. Runtime modified = NO.
- Verifier verdict = `I1_QV_HOLD`.
- Pinned WASM sha256 `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b`, 1340112 bytes, imports 0.
- Rebuild A and B sha256 `931d154a2002bb5fa85a00f2b59b966b3bf452821ad47affcb6cb460fea0fad5`, 1339801 bytes, imports 0.
- A equals B. A and B do not equal the frozen pin.
- Canonical build gate exit 1.
- The note does not repair the mismatch, retarget the pin, or authorize I2.
- `MEMORY.md` from `d34d822` must not be replayed onto the integration line.
- Canonical owner remains the Grok I1 agent on PR #71.
- HOSTING forbidden. DEPLOYMENT forbidden. NO MERGE.

The superseded report hashed the tracked public wasm and built the web app without running `tools/wasm_canonical_build.mjs`. That is why the earlier Cursor I1-Q pass did not see the mismatch. The supersession confirms the hash, size, and import count independently. It does not put the Cursor bytes in custody.

Exit-code law in `tools/wasm_canonical_build.mjs`, read and not modified: `policy()` exits 2 before a candidate exists (toolchain, public-pin, and target-dir checks). `assertCompiler` requires live `rustc -Vv` to contain `release: 1.98.1` and `commit-hash: 48a229ceaefd4985c50990b14116b6d856af0985`, and requires cargo 1.98.1 plus the wasm32 target. `fail()` exits 1 after a candidate exists. On the pin-checked path, size is compared before sha256 is printed. A recorded gate exit of 1 is consistent with a candidate that failed the size check (1339801 != 1340112) or a later `fail()`. Their stderr was not observed, so this is not a claim that their log was read. Measure-only mode returns 0 after printing sha256 and would not be exit 1.

### Wrapper omitted on this checkout

A diagnostic cargo build of the same detached worktree omitted `RUSTC_WRAPPER`. It kept the canonical script's remap `RUSTFLAGS`, `CARGO_INCREMENTAL=0`, `--locked`, `--target wasm32-unknown-unknown`, and `--release`. Target directory `/tmp/i1qr/no-wrapper`. The artifact was not copied over the pin and is not committed.

| Field | Pin | Wrapper off |
| --- | --- | --- |
| sha256 | `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` | `326ea6b95a20bc459bd4858946cfc61c2541dcc7a0c08c542fa61ff14dc2e365` |
| bytes | 1340112 | 1340128 |
| equals Cursor `931d154a…` | NO | NO |

Section walk of both modules (version 1, 12 sections, import section absent). Payload sha256 matches the pin for type, function, table, memory, global, export, elem, code (`c374a3f33b680b27106b740e190622aa031124a56e17fb57081c68950af0982d`, 828565 bytes), data (`038ab7d04d3153d5930e0455c410be24f4640d06270d70e53d2d3fd57ee1f6f6`, 226203 bytes), producers, and target_features. The only difference is custom `name`: pin 282803 bytes / `4bcbef50b12a53577f38fcaf8b6eef833931ebd1f15055fc54172e2f565f3d1a`, wrapper-off 282819 bytes / `69c1f407aa6b22cd46957699728b178597476540774fc397f8f57df21397c44a`. First differing byte offset 1057076. 267332 bytes differ inside the overlapping prefix. Tail is +16 bytes.

On this checkout path, omitting the metadata wrapper changes only the name custom section, by 16 bytes, and does not produce `931d154a` or the −311 size. That class is not applied to the Cursor gap. A different checkout path without the wrapper was not measured.

`BINARY_DIFFERENCE_CLASS` of the Cursor artifact versus the pin stays `UNKNOWN`. `ROOT_CAUSE` stays `F. UNRESOLVED`. `FINAL` stays `I1_QR_HOLD`.

STOP. DO NOT START I2. DO NOT MERGE. DO NOT DEPLOY. DO NOT HOST.
