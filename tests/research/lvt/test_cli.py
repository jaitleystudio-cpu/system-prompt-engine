import json
from pathlib import Path
import subprocess
import sys

from spe_runtime.research.lvt.paired_gate_v2 import Observation, StudyProtocol


def _fixture(path: Path, n=24, improved=True):
    p = StudyProtocol(
        study_id='SPEC-TEST',
        generator_id='gen-1',
        evaluator_id='eva-2',
        evaluator_kind='independent_static_oracle',
        oracle_digest='a' * 64,
        model_digest='b' * 64,
        alpha=0.05,
        primary_effect_floor=0.05,
        min_heldout_families=20,
        family_level_significance=True,
        multiplicity=2,
    )
    train = []
    hold = []
    for i in range(n):
        train.append(Observation(f't{i}', f'tfamily{i}', f'{i+3:064x}', 0.2, 0.9, 0.1))
        hold.append(Observation(f'h{i}', f'hfamily{i}', f'{i+n+3:064x}', 0.1, 0.9 if improved else 0.05))
    path.write_text(
        json.dumps({
            'protocol': p.__dict__,
            'train': [o.__dict__ for o in train],
            'heldout': [o.__dict__ for o in hold],
        }),
        encoding='utf-8',
    )


def _run(path):
    cli_path = Path(__file__).parent.parent.parent.parent / 'spe_runtime' / 'research' / 'lvt' / 'cli.py'
    return subprocess.run(
        [sys.executable, str(cli_path), str(path)],
        text=True,
        capture_output=True,
    )


def test_cli_outputs_research_only_result(tmp_path):
    path = tmp_path / 'valid.json'
    _fixture(path)
    r = _run(path)
    assert r.returncode == 0, r.stderr
    data = json.loads(r.stdout)
    assert data['status'] == 'RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED'
    assert data['production_qualified'] is False
    assert len(data['evidence_hash']) == 64


def test_cli_negative_holdout_produces_exit_2(tmp_path):
    path = tmp_path / 'bad.json'
    _fixture(path, improved=False)
    r = _run(path)
    assert r.returncode == 2, r.stderr
    assert json.loads(r.stdout)['status'] == 'REJECTED'


def test_cli_malformed_experiment_fails_closed(tmp_path):
    path = tmp_path / 'bad.json'
    path.write_text('{broken json')
    r = _run(path)
    assert r.returncode == 3
    assert 'error' in json.loads(r.stderr)
