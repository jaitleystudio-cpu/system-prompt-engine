# WASM byte diff

Compared without modifying `apps/web/public/spe_wasm.wasm`.

`wasm-tools`, `wasm-objdump`, and `wasm2wat` are not installed. Sections were parsed with a local LEB128 walk (id, payload size, payload sha256). Custom section names were read from the payload. This is structural evidence, not a claim of semantic equivalence.

## Section table

Public `8d482a17…` (671614 bytes):

| Section | Size | Payload sha256 prefix |
| --- | ---: | --- |
| type | 240 | `eb701cc2b13223bb` |
| function | 852 | `12f183a57b06ca88` |
| table | 5 | `605080e5c37be634` |
| memory | 3 | `2e2461dd6852f58d` |
| global | 9 | `da3c74f89a28b8e9` |
| export | 48 | `b869d9a550c8a4ca` |
| element | 207 | `43ba630d92669a6c` |
| code | 337534 | `40784dbf9901966b` |
| data | 199355 | `5097d3749e9a8c94` |
| custom name | 133094 | `eebd2d554f2aec4f` |
| custom producers | 77 | `5d67a49632a1c5b6` |
| custom target_features | 148 | `97ceea95e0687b14` |

No import section. Export payload matches every rustc 1.98.1 rebuild below.

## Against local binaries

| Build | Size | Producers | target_features | table/memory/global/export | code size | code payload |
| --- | ---: | --- | --- | --- | ---: | --- |
| rustc 1.83.0 `27c73e90…` | 677268 | DIFF (`1.83.0`) | DIFF (smaller feature set) | memory SAME; table/global/export DIFF | 363978 | DIFF |
| 1.98.1 no remap `86fc0dc7…` | 671711 | SAME | SAME | SAME | 337534 | DIFF |
| 1.98.1 `./` remap `55d61171…` | 671613 | SAME | SAME | SAME | 337534 | DIFF (`0dc998e3698f4dcd`) |
| 1.98.1 `/spe-source` `b22e2e22…` | 671717 | SAME | SAME | SAME | 337534 | DIFF |
| 1.98.1 worktree `./` remap `8a06dc35…` | 671620 | SAME | SAME | SAME | 337534 | SAME payload as `55d61171…` |

First differing byte of public vs the `./` remap is inside the type section (offset 72).

## What is metadata, and what is code

Producers and target features of the shipped file are byte-identical to every local rustc 1.98.1 build. Compiler identity matches.

The code section is the same *length* as those 1.98.1 builds (337534) and a different payload. Equal-length comparison against `55d61171…` has 8525 differing runs. That is executable code, not a custom-section-only delta.

Type section: 33 function types. Indices 10 and 11 are swapped (`4×i32→()` vs `6×i32→()`). Remapping those two indices does **not** make the function section match: 207 of 850 type indices still differ. The difference is not a two-type permutation.

Data section: public 199355 vs `./` remap 199363. Early data bytes include the same `PORTABILITY_INVALID_FIXTURE` JSON; later windows diverge (public contains panic/recipe strings at offsets where the remap is padding). Not metadata-only.

Name section: public symbols use crate disambiguator `Cs6EG9aAzivax`. The deterministic `./` remap uses `CsjLVy9SMUV0m`. Rustc’s stable crate id differs. That id is a session fingerprint (source identity after remap, `--cfg`, and `-C metadata` as passed by cargo). It is visible in the name section and accompanies different code bytes.

## Path preimage does not explain the code gap

Two clean directories, both rustc 1.98.1, both remapped to `./portable` and `./.cargo`:

- `/workspace` → code payload `0dc998e3698f4dcd`, data payload `981d7879baa6bbe2`
- `/tmp/spe-wt` → the same code and data payloads

The worktree binary is 7 bytes larger only in the name section (133089 vs 133082). Absolute path before a successful `./` remap does not change the code section on this compiler.

The shipped code payload `40784dbf9901966b` matches neither. Embedded strings still show the same `./portable` and `./.cargo/registry` shape, so the remaining gap is an unrecorded rustc session input, not a missing path-prefix spelling we have already tested.

## Semantic vectors are a separate property

Node WebAssembly, imports = 0, 110 conformance rows (55 positive `data/conformance/universal_core_v1.jsonl` + 55 negative `data/conformance/universal_negative_v1.jsonl`):

Every local binary’s stdout matched the tracked public binary on all 110 rows. Runtime errors = 0. Stdout mismatches = 0.

That does not make the bytes equivalent.
