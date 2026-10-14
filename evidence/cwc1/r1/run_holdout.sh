#!/bin/bash
# Amendment 3 driver: seed-major, 3 task shards in parallel, hard cutoff 16:05 IST.
cd /workspace/spe-brain/cwc1-r1
export PYTENSOR_FLAGS=cxx= BOXING_GYM_ROOT=/tmp/boxing-gym
CUTOFF=$(date -d "2026-10-14 16:05:00" +%s)
( while [ $(date +%s) -lt $CUTOFF ]; do sleep 10; done; echo "CUTOFF $(date)" >> evidence/cwc1/r1/run_logs/driver.log; pkill -f "cwc1.harness --backend ollama --model qwen2.5-3b" ) &
for S in 101 202 303; do
  [ $(date +%s) -ge $CUTOFF ] && break
  echo "SEED $S start $(date)" >> evidence/cwc1/r1/run_logs/driver.log
  for i in 0 1 2; do
    /tmp/bg312/bin/python -u -m spe_runtime.research.cwc1.harness --backend ollama --model qwen2.5-3b-instruct-q4km-hf:latest \
      --url http://127.0.0.1:11434 --tasks holdout --arms A,B,C --seeds $S --shard $i/3 --out evidence/cwc1/r1/scored \
      2>&1 | grep -v "^Sampling" > evidence/cwc1/r1/run_logs/seed${S}_shard$i.log &
  done
  wait -n; wait -n; wait -n
  echo "SEED $S end $(date)" >> evidence/cwc1/r1/run_logs/driver.log
done
echo "DRIVER DONE $(date)" >> evidence/cwc1/r1/run_logs/driver.log
