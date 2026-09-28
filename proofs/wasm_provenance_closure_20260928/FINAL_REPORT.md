# SPE WASM PROVENANCE CLOSURE REPORT

BASE SHA: `e0497f79898689a00a30abeab67652d5f6a9193c`

FINAL SHA: recorded in git after this proof commit. The parent of the proof commit is the frozen product SHA. No production source commit sits between them.

## Test drift

Daily Lab

- OLD ASSERTION: `Daily 3D Lab` inside `DailyLab.tsx` (`test_v1_media_and_lab.py:54` at frozen HEAD)
- NEW CONTRACT: kicker `Daily Lab`, route `/daily-lab`, 14-item `DAILY_3D_QUEUE`, local-date modulo, `LabStage` / `spe-lab-3d`, `specimensForDate`, `FINITE_QUEUE`. Obsolete kicker must be absent.
- RED/GREEN: RED exit 1 on frozen copy, GREEN 2 passed after the test-only edit
- Closing commit of the copy: `1a8ec2e3a9082ea4c211961dd79c1de74e02b02c` (2026-09-28 03:54:30 +0000)

Privacy

- OLD ASSERTION: `Privacy / Proof` inside `Nav.tsx` (line 70 at frozen HEAD)
- NEW CONTRACT: nav `{ id: "privacy", label: "Privacy" }`, `pathForView`, route `/privacy`, proof page still has `Your thinking stays with you` and `data-copy-depth="PROOF"`. Obsolete nav label must be absent.
- RED/GREEN: same RED/GREEN pair as Daily Lab

## Python

- collected = 693
- passed = 692
- failed = 1
- skipped = 0
- PYTHON_NON_WASM_FAILURES = 0

## WASM tracked

- size = 671614
- sha256 = `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830`
- PUBLIC_WASM_REPLACED = NO

## Original artifact

- INTRODUCED BY commit = `04bc493656aa03d648c7cd9ff220d3716cae7683`
- PR = present on draft PR #42’s branch history; that PR does not record a build recipe. Commit comments: none.
- date = 2026-09-24 16:33:43 +0530
- ORIGINAL SOURCE SHA = portable kernel, wasm crate, Cargo.lock, and `include_str!` data are identical from `04bc493` to `e0497f7`. The binary was introduced at `04bc493`.
- ORIGINAL TOOLCHAIN = `rustc 1.98.1 (48a229cea 2026-09-01)` from the producers section. Cargo version UNKNOWN.
- ORIGINAL BUILD COMMAND = UNKNOWN
- ORIGINAL FLAGS = PARTIAL. Embedded paths show repo root remapped to `./` and the cargo registry remapped to `./.cargo`. Release profile in Cargo.toml is lto, opt-level s, panic abort. Extra `-C metadata` / cfg UNKNOWN. Symbol disambiguator in the shipped name section is `Cs6EG9aAzivax`; a clean 1.98.1 rebuild with the same remap shape yields `CsjLVy9SMUV0m` and different code bytes.
- PROVENANCE = PARTIAL
- LEGACY_ARTIFACT_PROVENANCE = PARTIAL

## Reproduction

See `REPRODUCTION_MATRIX.md`. Six evidence-backed rows. Exact byte match NO. Closest deterministic rebuild is B3 `55d61171…` (671613). B6 confirms the absolute path preimage is not the code difference.

EXACT BYTE MATCH: NO

SEMANTIC PARITY: PASS

OFFICIAL BUILD: BLOCKED (exit 1, missing gitignored artifact; script not changed)

## Other gates

- TS_FALLBACK = false
- REAL_MUTATION_ENGINE = NO
- Rust negative mutation tests = 2
- SEMANTIC FILES CHANGED = NONE
- PRODUCTION FILES CHANGED = none (test file and this proof directory only)
- DEPLOYMENT GATE = exit 2, HOSTING FORBIDDEN
- TEST_DRIFT_1 = CLOSED
- TEST_DRIFT_2 = CLOSED

## Rebaseline proposal (not executed)

1. Freeze the canonical source SHA (`e0497f7`, whose portable tree matches `04bc493`).
2. Pin rustc 1.98.1 (`48a229cea`) inside the repo.
3. Pin the `./` and `./.cargo` remap that matches the embedded path shape, plus whatever extra cargo/rustc metadata the founder accepts as the new canonical session.
4. Produce the WASM twice from clean directories and require identical hashes.
5. Run the Python, Rust, and WASM parity suites, including the 55 negative rows.
6. Reproduce that hash in a second environment.
7. Only then review replacing `apps/web/public/spe_wasm.wasm` and `spe_wasm.sha256.json`.
8. Point `npm run build` at that pinned compile, then hash-check, then copy.

Do not treat `55d61171…` as the new public artifact without that review. Semantic agreement is already true and is not sufficient.

NEXT DECISION: FOUNDER_REBASELINE_REVIEW_REQUIRED

FINAL: HOLD_WASM_BYTES_NOT_REPRODUCED
