"""CLI for local-only LVT-2 research scoring. Does not contact external systems."""
from __future__ import annotations
import argparse
from dataclasses import asdict
import json
from pathlib import Path
import sys

from spe_runtime.research.lvt.paired_gate_v2 import Observation, StudyProtocol, StudyInvalid, run_study

MAX_INPUT_BYTES = 5_000_000


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description='Offline, unqualified LVT-2 research gate')
    p.add_argument('study_json', help='JSON {protocol,train,heldout}; local file only')
    args = p.parse_args(argv)
    try:
        file = Path(args.study_json)
        if not file.is_file():
            raise StudyInvalid('study file not found')
        if file.stat().st_size > MAX_INPUT_BYTES:
            raise StudyInvalid('study file exceeds 5MB cap')
        obj = json.loads(file.read_text(encoding='utf-8'))
        if not isinstance(obj, dict) or set(obj) != {'protocol', 'train', 'heldout'}:
            raise StudyInvalid('expected protocol/train/heldout keys')
        if not isinstance(obj['train'], list) or not isinstance(obj['heldout'], list):
            raise StudyInvalid('train and heldout must be lists')
        proto = StudyProtocol(**obj['protocol'])
        train = [Observation(**v) for v in obj['train']]
        heldout = [Observation(**v) for v in obj['heldout']]
        result = run_study(proto, train, heldout)
    except (ValueError, TypeError, UnicodeError, OSError, KeyError) as exc:
        print(json.dumps({'error': type(exc).__name__, 'status': 'INVALID_STUDY', 'detail': str(exc)}), file=sys.stderr)
        return 3
    print(json.dumps(asdict(result), sort_keys=True, indent=2))
    return 0 if result.status == 'RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED' else 2


if __name__ == '__main__':
    raise SystemExit(main())
