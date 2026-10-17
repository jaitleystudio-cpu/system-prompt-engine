# Supply-chain tests

File: `tests/release/test_wasm_canonical_supply_chain.py`.

These checks are limited to the candidate build recipe. They do not claim a broader security guarantee.

| Check | Result |
| --- | --- |
| Floating Rust channel `stable` rejected before cargo | PASS, exit 2 |
| Wrong target `wasm32-wasip1` rejected before cargo | PASS, exit 2 |
| Target inside `apps/web/public` rejected | PASS, exit 2, public bytes untouched |
| Target equal to the `copy-wasm` source directory rejected | PASS, exit 2 |
| Pre-existing wasm in a clean target directory is deleted and rebuilt | PASS |
| Rebuilt sha256 differs from the planted bytes | PASS |
| Printed sha256 matches the file | PASS |
| Rebuilt module imports | 0 |
| Absolute checkout, home, cargo-home, and developer markers absent from the wasm | PASS |
| Candidate manifest build A sha256 equals build B sha256 equals artifact sha256 | PASS |
| Manifest contains no absolute local paths | PASS |
| On-disk canonical artifact matches the manifest when present | PASS |
| Tracked public wasm sha256 remains `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830` | PASS |
| Build script has no `copyFileSync` and does not invoke `scripts/copy-wasm.mjs` | PASS |
| Success output says `promoted=no` | PASS |

The full Python run executed these tests. The only Python failure was the pre-existing shipped-hash assertion, which still compares the public module with the gitignored default target when that file exists.
