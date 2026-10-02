#!/usr/bin/env bash
# RT-VR2 custody: HEAD must descend from FROZEN_SHA; non-CI paths must match frozen tree.
set -euo pipefail
FROZEN_SHA="${FROZEN_SHA:-afe1453c515be3b189b27828e20d03d64f80cbdd}"
FROZEN_TREE="${FROZEN_TREE:-46c8bb358aa01d6910ce66668784c43d6b450a86}"

echo "HEAD=$(git rev-parse HEAD)"
echo "HEAD_TREE=$(git rev-parse HEAD^{tree})"
echo "FROZEN_SHA=$FROZEN_SHA"
OBS_TREE=$(git rev-parse "${FROZEN_SHA}^{tree}")
echo "FROZEN_OBS_TREE=$OBS_TREE"
if [[ "$OBS_TREE" != "$FROZEN_TREE" ]]; then
  echo "RT_VR2_CUSTODY_FAIL: frozen tree mismatch"
  exit 1
fi
if ! git merge-base --is-ancestor "$FROZEN_SHA" HEAD; then
  echo "RT_VR2_CUSTODY_FAIL: FROZEN_SHA is not ancestor of HEAD"
  exit 1
fi
# Only CI-allowed paths may differ from frozen tip
DIFF=$(git diff --name-only "$FROZEN_SHA" HEAD -- . \
  ':(exclude).github/workflows/**' \
  ':(exclude)scripts/ci/**' \
  ':(exclude)docs/ci/**' || true)
if [[ -n "${DIFF}" ]]; then
  echo "RT_VR2_CUSTODY_FAIL: non-CI paths changed vs FROZEN_SHA:"
  echo "$DIFF"
  exit 1
fi
echo "CUSTODY_OK=YES"
