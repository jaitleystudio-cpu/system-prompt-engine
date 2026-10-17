# SOURCE_CUSTODY

## Clone A

```
git clone https://github.com/jaitleystudio-cpu/system-prompt-engine.git spe-independent-repro
cd spe-independent-repro
git checkout 96ce1ceb000ff04d8fcd324de1da5dfe0d70c909
```

Observed:

```
HEAD=96ce1ceb000ff04d8fcd324de1da5dfe0d70c909
working tree: CLEAN
```

## Clone B (second absolute path)

```
git clone https://github.com/jaitleystudio-cpu/system-prompt-engine.git /tmp/spe-independent-path-b
cd /tmp/spe-independent-path-b
git checkout 96ce1ceb000ff04d8fcd324de1da5dfe0d70c909
```

Observed:

```
HEAD=96ce1ceb000ff04d8fcd324de1da5dfe0d70c909
working tree: CLEAN
no target-canonical before build
```

## Recipe vs semantic product base

Task A recipe commit: `96ce1ceb000ff04d8fcd324de1da5dfe0d70c909`  
Semantic product base: `e0497f79898689a00a30abeab67652d5f6a9193c`

Diff of semantic engines `e049..96ce1ce`:

| Tree | Diff |
| --- | --- |
| `portable/spe-core-rs` | empty |
| `portable/spe-wasm/src` | empty |
| `portable/spe-wasm/Cargo.toml` | empty |
| `portable/spe-wasm/Cargo.lock` | empty |
| `spe_runtime` | empty |

Cargo.lock custody (matches Task A manifest):

```
sha256=f7d262321e41b5b9b2b495040663d92f98e03e2894b95238891bfe39ab3a56e3
git blob=f26fd3d70b52645034b33b27bf5b95664d3a6103
```

Recipe-only additions on top of e049 are the toolchain file, rustc wrapper, canonical build script, candidate proofs, and related release tooling — not semantic engine source.

## Inputs not used

- Task A's generated WASM file
- Task A's `target/` / `target-canonical/`
- Copied Cargo build outputs
- Manual `RUSTFLAGS` overrides
- Public `apps/web/public/spe_wasm.wasm` as a build input
