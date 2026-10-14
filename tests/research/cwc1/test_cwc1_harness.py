"""Pure-python tests for the CWC step (no BoxingGym needed). Run: python3 -m tests.research.cwc1.test_cwc1_harness"""
import json

from spe_runtime.research.cwc1 import harness as H


def test_choose_discriminating():
    d = {"hypotheses": [{"id": "H1"}, {"id": "H2"}], "candidates": [0, 1, 2, 3],
         "predictions": {"H1": [0, 1, 5, 3], "H2": [0, 1, 1, 3]}}
    j, s = H.choose_discriminating(d)
    assert j == 2 and s == [0, 0, 4, 0]
    d["predictions"] = {"H1": [1, 2, 0, 0], "H2": [0, 0, 0, 0]}
    assert H.choose_discriminating(d)[0] == 1   # spread 2 beats 1
    d["predictions"] = {"H1": [2, 2, 0, 0], "H2": [0, 0, 0, 0]}
    assert H.choose_discriminating(d)[0] == 0   # tie -> first


def test_parse_cwc():
    good = {"hypotheses": [{"id": "A"}, {"id": "B"}], "candidates": [1, 2], "predictions": {"A": [1, 2], "B": [2, 1]}}
    assert H.parse_cwc("noise " + json.dumps(good) + " tail")
    bad = dict(good, hypotheses=[{"id": "A"}])
    assert H.parse_cwc(json.dumps(bad)) is None
    assert H.parse_cwc(json.dumps(dict(good, predictions={"A": [1], "B": [2, 1]}))) is None
    assert H.parse_cwc("no json") is None


def test_partition_and_retrieval():
    assert len(H.HOLDOUT) == 11 and ("irt", "discriminate_question") not in H.HOLDOUT
    assert not set(H.HOLDOUT_SEEDS) & set(H.DEV_SEEDS)
    r = H.retrieve("predict the length of a sea cow (dugong) given its age")
    assert len(r) == 2 and r[0]["title"] == "Dugong"


ALL = [test_choose_discriminating, test_parse_cwc, test_partition_and_retrieval]
if __name__ == "__main__":
    for t in ALL:
        t()
        print("PASS", t.__name__)
