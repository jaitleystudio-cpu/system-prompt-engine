# Replication package — AGI-BRAIN R2
Requirements: Python ≥3.11, no network, no paid service. Branch `grok/agi-brain-r2`.
1. Integrity: `shasum -a 256 docs/agi-brain/CONTRACT_R2.md evidence/agi-brain/r2/starts.json` → `1911d6af6ef075e342fe9b6820657b262878995f071834dcc43d9ff3659cb735` and `f1623f25d3c365524651bafa3ce1ef11238a572275f8548239d3914ce84b30c9`; `git log --format='%h %ci %s' -- docs/agi-brain/CONTRACT_R2.md evidence/agi-brain/r2/rows.jsonl` shows contract commit precedes results.
2. (Optional) rebuild starts: `python3 -m spe_runtime.research.agi_brain.r2_starts /tmp/starts.json` and diff with `evidence/agi-brain/r2/starts.json` (deterministic).
3. Re-run: `mkdir -p /tmp/r2 && cp evidence/agi-brain/r2/starts.json /tmp/r2/ && python3 -m spe_runtime.research.agi_brain.experiment_r2 /tmp/r2` (~13 min on an M2 Mac mini with 4 workers).
4. Compare `/tmp/r2/results.json` with `evidence/agi-brain/r2/results.json`. Expect distributional, not byte, agreement (CPU-time budget). Re-verify every claimed network independently: `python3 -c "import json;from spe_runtime.research.agi_brain.evaluator_r2 import verify;print(all(verify(r['family'],r['net'])['valid'] for r in []))"` — rows store only `net_sha`; to re-verify networks re-run step 3 (networks are verified in-run by `evaluator_r2`).
5. Tests: `uv run --no-project --with pytest --with numpy python -m pytest -q tests/research/agi_brain tests/research/lvt3`.
Pass criterion for replay: same verdict class (no Holm-significant SPE-WM advantage) and 100% independent correctness.
