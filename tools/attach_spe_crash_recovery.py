#!/usr/bin/env python3
"""Attach reviewed R0 browser observations to an EXISTING canonical .spe file.

This tool does not compile an .spe, execute AI, attest a browser, promote
authority, or deploy anything. It rejects malformed/tampered source artifacts.
Usage:
 python tools/attach_spe_crash_recovery.py \
   --source-spe path/to/original.spe \
   --manifest private-proof/living-spe-recovery.json \
   --evidence-dir private-proof \
   --output-spe path/to/annotated.spe
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
import sys
from pathlib import Path

# Direct script invocation sets sys.path[0] to tools/, not the repository root.
# Resolve our own repository root; never require an external PYTHONPATH.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from spe_runtime.portability.browser_recovery_lineage import (
    attach_recovery_to_spe,
    dump_attached_spe,
)
from spe_runtime.portability.spe_artifact import loads_spe_artifact


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-spe", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--output-spe", type=Path, required=True)
    args = parser.parse_args()
    source = args.source_spe.resolve(strict=True)
    manifest_path = args.manifest.resolve(strict=True)
    output = args.output_spe.absolute()
    if source == output or output.exists():
        parser.error("output must be a NEW path; never overwrite an original .spe")
    original = loads_spe_artifact(source.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    attached = attach_recovery_to_spe(original, manifest, args.evidence_dir)
    data = dump_attached_spe(attached)
    output.parent.mkdir(parents=True, exist_ok=True)

    # Stage a complete file, then atomically rename; do not truncate existing .spe.
    handle, staged = tempfile.mkstemp(prefix=".spe-recovery-", dir=output.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as f:
            os.fchmod(f.fileno(), 0o600)
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        # Hard-link is atomic and fails with FileExistsError: unlike os.replace
        # it never clobbers a concurrently created .spe artifact.
        os.link(staged, output)
    finally:
        if os.path.exists(staged):
            os.unlink(staged)
    print("WROTE_CANONICAL_SPE:", output)
    print("EXECUTION_AUTHORITY: NONE")
    print("QUALIFICATION: REVIEW_ONLY_UNATTESTED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
