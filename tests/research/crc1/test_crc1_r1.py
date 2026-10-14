"""CRC-1 R1 tests on hand-built count vectors with known answers. Run: python3 -m tests.research.crc1.test_crc1_r1
Every test takes the module under test as `m` so the mutation gate can rerun them on planted mutants."""
import json

from spe_runtime.research.crc1 import core
from spe_runtime.research.crc1 import r1 as R1


def _ltt_vec():
    # n_i = 400 - 2i; N_MIN=150 -> start index 125. Indices >=126 fail hard (noisy top bins that killed R0).
    c = []
    for i in range(200):
        n = 400 - 2 * i
        if i >= 126:
            e = n            # fail
        elif i >= 60:
            e = 0            # pass
        elif i == 59:
            e = 25           # borderline: fails at alpha=0.10, would pass at alpha=0.20
        elif i == 40:
            e = 0            # passes again AFTER a failure: must not be reached
        else:
            e = n
        c.append((n, e))
    return c


def test_pval(m=R1):
    assert m.pval(0, 0) == 1.0
    assert abs(m.pval(10, 0) - 0.9 ** 10) < 1e-12
    assert m.pval(282, 25) > 0.10 and m.pval(150, 0) < 1e-6


def test_ltt_mc(m=R1):
    c = _ltt_vec()
    assert m.ltt_start(c, 150) == 125
    assert m.policy_ltt_mc(c, 150) == 60
    assert m.policy_ltt_r0(c) is None           # R0 search collapses on this vector
    assert m.policy_ltt_mc([(0, 0)] * 200, 150) is None
    assert m.policy_ltt_mc([(100, 0)] * 200, 150) is None   # no index reaches N_MIN -> abstain


def _sgr_vec():
    c = []
    for i in range(200):
        e = 0 if i >= 50 else (22 if i >= 45 else 300)
        c.append((300, e))
    return c


def test_sgr(m=R1):
    assert m.SGR_K == 8
    c = _sgr_vec()
    assert m.pval(300, 22) > m.DELTA / m.SGR_K and m.pval(300, 22) <= m.DELTA
    assert m.policy_sgr(c) == 50
    assert m.policy_sgr([(300, 300)] * 200) is None
    assert m.policy_sgr([(300, 0)] * 200) == 0


def test_bonf10(m=R1):
    assert m.BONF_IDX == list(range(0, 200, 22)) and len(m.BONF_IDX) == 10
    c = [(300, 0 if i >= 44 else 300) for i in range(200)]
    assert m.policy_bonf10(c) == 44
    assert m.policy_bonf10([(300, 300)] * 200) is None


def test_deterministic_summary(m=R1):
    pop = core.grid_counts(core.sample(20_000, __import__("random").Random(999)))
    a, _ = m.run_arm(pop, 200, seeds=range(5))
    b, _ = m.run_arm(pop, 200, seeds=range(5))
    sa, sb = json.dumps(a, sort_keys=True), json.dumps(b, sort_keys=True)
    assert sa == sb and "runtime" not in sa
    v = m.verdicts(a)
    assert set(v) >= {"H1_validity", "H2_utility", "H3_beats_sgr", "overall"}


ALL = [test_pval, test_ltt_mc, test_sgr, test_bonf10, test_deterministic_summary]

if __name__ == "__main__":
    for t in ALL:
        t()
    print("crc1 r1 tests OK")
