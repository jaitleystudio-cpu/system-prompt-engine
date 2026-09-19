#!/usr/bin/env bash
cd "/workspace/formal"
exec java -XX:+UseParallelGC -Xmx3559m -jar "/workspace/tools/tlc/tla2tools.jar" \
  -config "/workspace/formal/cfg/C1_stale_patch.cfg" \
  -workers 4 \
  -coverage 1 \
  SPELeaseCommit
