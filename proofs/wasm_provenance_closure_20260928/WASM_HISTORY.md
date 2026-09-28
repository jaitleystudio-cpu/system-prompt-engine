# Shipped WASM history

Tracked files:

- `apps/web/public/spe_wasm.wasm`
- `apps/web/public/spe_wasm.sha256.json`

Current bytes, unchanged from introduction through frozen HEAD `e0497f79898689a00a30abeab67652d5f6a9193c`:

- size 671614
- sha256 `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830`

## Introduction of these exact bytes

Commit `04bc493656aa03d648c7cd9ff220d3716cae7683`

- Author: Prawin Naidu `<prawin@jaitleystudio.com>`
- AuthorDate and CommitDate: Thu Sep 24 16:33:43 2026 +0530
- Subject: `feat: expose context protocol compiler through wasm`
- Body: empty
- Parent: `f7eed0bbf8b611908c1e2b028219d081ec667fdf`
- `git name-rev`: `remotes/origin/chatgpt/context-protocol-compiler-design-20260924~4`

`git diff --stat 04bc493 e0497f7` is empty for:

- `portable/spe-core-rs`
- `portable/spe-wasm`
- `apps/web/scripts/copy-wasm.mjs`
- both public WASM files
- `data/grounding`
- `data/protocols` (the `include_str!` inputs)

`portable/spe-wasm/Cargo.lock` blob is `f26fd3d70b52645034b33b27bf5b95664d3a6103` at both commits.

`data/provider_profiles_v1.json` was added after `04bc493`. It is not an `include_str!` input of the kernel, so it does not explain the binary.

No `rust-toolchain*` file and no `.cargo/config*` exist at the frozen SHA. Repository search finds no `wasm-opt` or `wasm-bindgen` invocation.

Release profile in `portable/spe-wasm/Cargo.toml` (unchanged):

```
[profile.release]
lto = true
opt-level = "s"
panic = "abort"
```

## Every content change of the tracked binary

Content sha256 (not git blob id):

| Commit | Date | Size | SHA-256 | Subject |
| --- | --- | --- | --- | --- |
| `4e6c694b5d8b9379c5acfbaac416dcfa89b1768e` | 2026-09-15 | 252714 | `74a12864ffc205ca2b3880b5f3740bf374621808aff55b2876f8e89d8db27e69` | feat(sprint6): Web/PWA universal client foundation |
| `442b765bd7ef3ea8a09a4723823245b1fa2e2ec3` | 2026-09-19 | 249893 | `8e535b8a6972a2af1505000d43b570b2966ed6950777fbb705dccc2e74655129` | feat(spe-web-01): website foundation |
| `6d8d56a7ca14dd16797db031d5e28e5086fdd88e` | 2026-09-21 | 237899 | `cff055778cc53606fd2f03879b89e360cf2080b3b1b0df5dfbaffb040f542b10` | Rebuild SPE Prompt Studio |
| `638fe851c1f3dd786fc62a82071cc5210925d13f` | 2026-09-24 04:20:25 +0530 | 237900 | `95cf51ceab7b51ab2a459ec8a32d51e182749f8f3b51cf29c69de675a2fd0a80` | fix(integration): validate consolidated baseline |
| `8066a2a061f2b35113b52bd9743cb7bc4a695786` | 2026-09-24 04:20:42 +0530 | 237900 | same `95cf51ce…` | chore: keep shipped WASM non-executable (mode only) |
| `2c543dd13750b83bbac7092e998823a22083e2ba` | 2026-09-24 05:42:17 +0530 | 254821 | `72452f941bd438ab77ff255bc7a7200717f924a1b083f44537bc0a946b577f28` | feat(web): SPE Website V1 launch candidate |
| `04bc493656aa03d648c7cd9ff220d3716cae7683` | 2026-09-24 16:33:43 +0530 | 671614 | `8d482a17…` | feat: expose context protocol compiler through wasm |

`apps/web/public/spe_wasm.sha256.json` also changed in `5d66bb291e83a24849fd24a3c9d5345e2eda2b17` (2026-09-24 13:52:30 +0530, “Fix stale WASM mismatch…”) before `04bc493` replaced both the binary and the manifest with the current digest.

## What the producers section proves

The tracked file’s custom `producers` section (77 bytes, section sha256 prefix `5d67a49632a1c5b6`) decodes to:

- language: Rust
- processed-by: `rustc 1.98.1 (48a229cea 2026-09-01)`

`target_features` (148 bytes, prefix `97ceea95e0687b14`): bulk-memory, bulk-memory-opt, call-indirect-overlong, multivalue, mutable-globals, nontrapping-fptoint, reference-types, sign-ext.

A local `rustc 1.83.0 (90b35a623 2024-11-26)` rebuild does not share those sections. The compiler identity is read from the artifact, not inferred from file size.

Embedded path shape in the tracked file:

- `./portable/spe-core-rs/src/lib.rs`
- `./.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/...`
- `/rustc/48a229ceaefd4985c50990b14116b6d856af0985/library/...`
- `/rust/deps/dlmalloc-0.2.13/src/dlmalloc.rs`
- `/rust/deps/hashbrown-0.17.1/src/raw.rs`

No `/Users/`, `/home/`, `/workspace`, `/spe-source`, or `/rust-deps` markers.

## Custody that is a copy, not a compile

`proofs/context_protocol_v1/` records `rebuilt_during_task15: false`. Its `npm run build` log shows `copy-wasm` writing the existing 671614-byte file. That is custody of a copy of an already-built release artifact.

## GitHub

`gh pr view 42` (draft “Context Grounding + Category Protocol Compiler implementation”, base `grok/spe-v1-launch-20260924`, head `chatgpt/context-protocol-compiler-design-20260924`) contains `04bc493` in a 31-commit stack. The PR body and commit comments do not record rustc, cargo, RUSTFLAGS, the build host, or a reproduction command.

Documented recipes that do **not** match this artifact’s embedded paths:

- `docs/web04/REVIEW.md`: remap `$HOME` to `/rust-deps` and `$PWD` to `/spe-source`. That review’s published hash is the older `cff05577…`.
- `.github/workflows/sdd-validation.yml`: `dtolnay/rust-toolchain@stable` plus remap `/home/runner` and `/home` to `/rustc`. Workflows were not modified.
- `docs/integration/BRANCH_CONSOLIDATION.md`: remap the repo to `/spe-source` and home to `/rust-deps`.

## Original build command

UNKNOWN. The commit message, PR #42 body, and tracked proofs do not preserve the rustc invocation that produced `8d482a17…`. The producers section and path strings constrain the compiler and the remap *shape*. They do not recover `-C metadata`, extra `--cfg`, or the cargo version that invoked rustc.
