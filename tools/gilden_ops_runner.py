#!/usr/bin/env python3
"""Local Gilden operations runner.

Read one operations document from --request or stdin and write a receipt to
stdout. This process does not post, send, host, deploy, emit analytics, merge,
publish, or search the network.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from spe_runtime.gilden.runner import run_text


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate a Gilden operations document locally. "
            "External actions stay NOT_AUTHORIZED."
        )
    )
    parser.add_argument(
        "--request",
        type=Path,
        help="Path to one operations JSON document. Omit to read stdin.",
    )
    args = parser.parse_args(argv)
    if args.request is not None:
        raw = args.request.read_text(encoding="utf-8")
    else:
        raw = sys.stdin.read()
    code, receipt = run_text(raw)
    json.dump(receipt, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
