"""CRC-1 unit tests (runnable with plain python3)."""
import random

from spe_runtime.research.crc1 import core


def test_binom_cdf():
    assert abs(core.binom_cdf(0, 10, 0.1) - 0.9 ** 10) < 1e-12
    assert core.binom_cdf(10, 10, 0.3) == 1.0


def test_grid_and_policies():
    assert len(core.GRID) == 200 and abs(core.GRID[-1] - 0.995) < 1e-12
    counts = core.grid_counts(core.sample(500, random.Random(1)))
    assert all(counts[i][0] >= counts[i + 1][0] for i in range(199))
    i = core.policy_ltt(counts)
    assert i is None or core.binom_cdf(counts[i][1], counts[i][0], core.ALPHA) <= core.DELTA
    assert core.policy_ltt([(0, 0)] * 200) is None


def test_cp():
    lo, hi = core.clopper_pearson(50, 500)
    assert lo < 0.1 < hi


if __name__ == "__main__":
    test_binom_cdf(); test_grid_and_policies(); test_cp(); print("crc1 tests OK")
