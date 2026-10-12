"""Regression tests for scripts/run_mutations.py (M01 interruption crash).

Before the repair, SIGTERM during a mutant's pytest left the mutated source on disk plus a
stray *.orig_backup (reproduced 2026-10-12). These tests run the harness against a throwaway
repo so production sources are never mutated.
"""
import os, signal, subprocess, sys, textwrap, time
from pathlib import Path

HARNESS = Path(__file__).resolve().parents[3] / "scripts" / "run_mutations.py"

DRIVER = textwrap.dedent('''
    import importlib.util, sys
    spec = importlib.util.spec_from_file_location("rm", sys.argv[1])
    rm = importlib.util.module_from_spec(spec); spec.loader.exec_module(rm)
    rm.MUTANTS[:] = [{"id": "MX", "name": "fake", "file": "src.py",
                      "target": "X = 1", "replacement": "X = 2", "test": sys.argv[2]}]
    rm.main()
''')


def _setup(tmp_path, test_body):
    (tmp_path / "src.py").write_text("X = 1\n")
    (tmp_path / "test_fake.py").write_text(test_body)
    (tmp_path / "driver.py").write_text(DRIVER)
    env = dict(os.environ, SPE_MUTATION_REPO_ROOT=str(tmp_path),
               SPE_MUTATION_JSON_LOG=str(tmp_path / "log.json"))
    return [sys.executable, str(tmp_path / "driver.py"), str(HARNESS), "test_fake.py"], env


def test_sigterm_mid_mutant_restores_source_and_removes_backup(tmp_path):
    cmd, env = _setup(tmp_path, "import time\ndef test_slow():\n    time.sleep(60)\n")
    p = subprocess.Popen(cmd, cwd=tmp_path, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    deadline = time.time() + 20
    while (tmp_path / "src.py").read_text() != "X = 2\n" and time.time() < deadline:
        time.sleep(0.05)
    assert (tmp_path / "src.py").read_text() == "X = 2\n", "mutant never applied"
    p.send_signal(signal.SIGTERM)
    p.wait(timeout=20)
    assert p.returncode != 0
    assert (tmp_path / "src.py").read_bytes() == b"X = 1\n"
    assert not (tmp_path / "src.py.orig_backup").exists()


def test_collection_error_is_not_counted_as_kill(tmp_path):
    cmd, env = _setup(tmp_path, "import nonexistent_module_xyz\ndef test_a():\n    pass\n")
    p = subprocess.run(cmd, cwd=tmp_path, env=env, capture_output=True, text=True, timeout=60)
    assert p.returncode == 1, p.stdout + p.stderr
    assert "KILLED" not in p.stdout.split("SUMMARY")[0].split("fake...")[1].split("\n")[0]
    assert (tmp_path / "src.py").read_bytes() == b"X = 1\n"


def test_real_kill_and_byte_restoration(tmp_path):
    cmd, env = _setup(tmp_path, "from src import X\ndef test_x():\n    assert X == 1\n")
    p = subprocess.run(cmd, cwd=tmp_path, env=env, capture_output=True, text=True, timeout=60)
    assert p.returncode == 0, p.stdout + p.stderr
    assert "1/1 mutants KILLED" in p.stdout
    assert (tmp_path / "src.py").read_bytes() == b"X = 1\n"


def test_harness_never_uses_foreign_checkout_pytest():
    src = HARNESS.read_text()
    assert "offloaded-mac-storage" not in src
    assert "sys.executable, \"-m\", \"pytest\"" in src
