#!/usr/bin/env python3
"""Outer driver for CWC-1 R1 shard 2. Does not modify frozen harness.py.
Catches BoxingGym ValueError crashes so remaining tasks still run before 16:05 IST."""
from __future__ import annotations
import json, os, sys, time, traceback
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, "/workspace/spe-brain/cwc1-r1")
os.environ.setdefault("PYTENSOR_FLAGS", "cxx=")
os.environ.setdefault("BOXING_GYM_ROOT", "/tmp/boxing-gym")

from spe_runtime.research.cwc1.harness import HOLDOUT, Ollama, episode  # frozen

CUTOFF = datetime(2026, 10, 14, 16, 5, tzinfo=ZoneInfo("Asia/Calcutta"))
OUT = "evidence/cwc1/r1/scored"
LOG = "evidence/cwc1/r1/run_logs/seed101_shard2_resilient.log"
MODEL = "qwen2.5-3b-instruct-q4km-hf:latest"
URL = "http://127.0.0.1:11434"
SEED = 101
ARMS = ("A", "B", "C")
# shard 2/3: indices where k % 3 == 2
TASKS = [t for k, t in enumerate(HOLDOUT) if k % 3 == 2]

def log(msg: str) -> None:
    line = f"{datetime.now(ZoneInfo('Asia/Calcutta')).isoformat(timespec='seconds')} {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")

def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    backend = Ollama(model=MODEL, url=URL)
    log(f"START shard2 resilient tasks={TASKS}")
    for env_name, goal_name in TASKS:
        for arm in ARMS:
            if datetime.now(ZoneInfo("Asia/Calcutta")) >= CUTOFF:
                log("CUTOFF reached; stop")
                return 0
            fn = f"{OUT}/SCORED_{env_name}_{goal_name}_{SEED}_{arm}.json"
            # Skip only if a prior attempt already wrote a finished episode with raw_error or score_error
            if os.path.exists(fn):
                try:
                    prev = json.load(open(fn))
                    if prev.get("raw_error") is not None or prev.get("score_error") or prev.get("episode_error"):
                        log(f"SKIP existing {fn}")
                        continue
                except Exception:
                    pass
            log(f"RUN {env_name} {goal_name} {SEED} {arm}")
            t0 = time.time()
            try:
                result = episode(backend, env_name, goal_name, SEED, arm)
                result["label"] = "SCORED"
                result["model_tag"] = MODEL
            except Exception as e:
                result = {
                    "label": "SCORED",
                    "env": env_name,
                    "goal": goal_name,
                    "seed": SEED,
                    "arm": arm,
                    "model_tag": MODEL,
                    "raw_error": None,
                    "std_error": None,
                    "episode_error": repr(e)[:500],
                    "traceback": traceback.format_exc()[-1500:],
                    "calls": None,
                }
                log(f"CATCH {env_name} {goal_name} {arm}: {e!r}")
            with open(fn, "w") as f:
                json.dump(result, f, indent=1, sort_keys=True, default=str)
            log(f"WROTE {fn} in {time.time()-t0:.1f}s raw_error={result.get('raw_error')} err={result.get('episode_error') or result.get('score_error')}")
    log("DONE shard2 resilient")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
