#!/bin/bash
# Baseline runner. Each command logged with exit code.
cd "$(git rev-parse --show-toplevel)"
OUT=evidence/hostile-gym-r1/baseline
echo "# attempt $(date +%FT%T%z)" >> $OUT/exit_codes.tsv
run(){ name=$1; shift; echo "### $name: $*" ; ( "$@" ) > $OUT/$name.log 2>&1; ec=$?; printf "%s\t%s\t%s\n" "$name" "$ec" "$*" >> $OUT/exit_codes.tsv; echo "$name exit=$ec"; }
run eval_pos env SPE_FIXTURE_ID=POS-001 node apps/web/scripts/eval-fixture.mjs
run eval_neg env SPE_FIXTURE_ID=NEG-001 node apps/web/scripts/eval-fixture.mjs
run egress_proof env SPE_PROOF_OUT=$PWD/$OUT/egress_proof.json node apps/web/scripts/egress-proof.mjs
run copy_golden node tests/copy/golden-and-adversarial.mjs
run validate_repo python3 tools/validate_repo.py
run pytest env CARGO_TARGET_DIR=/tmp/hg-r1-target RUSTUP_TOOLCHAIN=stable /Volumes/4TB-WD/spe-egac-venv/bin/python -m pytest -q tests
run cargo_core env RUSTUP_TOOLCHAIN=stable CARGO_TARGET_DIR=/tmp/hg-r1-target cargo test --manifest-path portable/spe-core-rs/Cargo.toml -q
run cargo_wasm env RUSTUP_TOOLCHAIN=stable CARGO_TARGET_DIR=/tmp/hg-r1-target cargo test --manifest-path portable/spe-wasm/Cargo.toml -q
run web04_prompt node tools/web04-prompt-regression.mjs
run web04_worker node tools/web04-worker-client-regression.mjs
run web_integrity node tools/web-integrity-regression.mjs
run web_sw node tools/web-service-worker-regression.mjs
run conformance_s5 /Volumes/4TB-WD/spe-egac-venv/bin/python tools/sprint5_conformance.py
echo DONE
