import os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools", "replay"))
from lvt3r2_cluster_robust import analyse, op_pair_clusters  # noqa: E402


def test_op_pair_clustering_toy():
    cl = op_pair_clusters(["H0-a+b+c", "H1-b+c+d", "H2-x+y+z", "H3-c+b+a"])
    assert sorted(map(sorted, cl)) == [["H0-a+b+c", "H1-b+c+d"], ["H2-x+y+z"], ["H3-c+b+a"]]  # ordered adjacent pairs


def test_reproduces_bro_cluster_robust_numbers():
    r = analyse(os.path.join(ROOT, "evidence", "lvt3r2", "holdout"))
    assert r["n_families"] == 80 and r["n_clusters"] == 21 and r["largest_cluster"] == 22
    assert round(r["mean_of_cluster_means"], 3) == -0.030
    lo, hi = r["ci95_normal"]
    assert abs(lo - (-0.097)) < 0.0015 and abs(hi - 0.036) < 0.0015
    assert hi > 0  # "significantly worse" does not survive clustering; REJECTED (no improvement >= delta) holds
