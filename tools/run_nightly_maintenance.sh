#!/bin/bash
set -euo pipefail

REPO_DIR="/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine"
NODE_BIN="/Users/prawinpalisetty/.nvm/versions/node/v22.23.2/bin/node"

export PATH="/Users/prawinpalisetty/.nvm/versions/node/v22.23.2/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

echo "=================================================================="
echo "🌙 SPE Ω — NIGHTLY AUTONOMOUS MAINTENANCE DISPATCHER"
echo "   Timestamp: $(date)"
echo "=================================================================="

cd "$REPO_DIR"

# 1. Continuous Frontier Model Synchronization
echo "Step 1: Running Frontier Model Continuous Synchronizer..."
"$NODE_BIN" apps/web/scripts/nightly-model-sync.mjs --apply

# 2. Autonomous Website Evolution Loop
echo "Step 2: Running Website Evolution Loop..."
"$NODE_BIN" apps/web/scripts/nightly-evolution-loop.mjs --ci

# 3. Master Autonomous Pipeline Execution
echo "Step 3: Running Autonomous A-to-Z Master Pipeline..."
"$NODE_BIN" tools/autonomous_pipeline.mjs

# 4. Continuous Zero-Downtime Autonomous Brain Evolution & Hot-Swap
echo "Step 4: Running 24/7 Autonomous Brain Evolution & Hot-Swap Cycle..."
"$NODE_BIN" tools/autonomous_247_brain_loop.mjs --once

echo "=================================================================="
echo "🎉 NIGHTLY AUTONOMOUS MAINTENANCE COMPLETED: $(date)"
echo "=================================================================="
