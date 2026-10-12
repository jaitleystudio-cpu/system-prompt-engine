"""Build the frozen R2 start networks (pruned merge-exchange) once; identical for all conditions."""
import json, sys, time
from multiprocessing import Pool
from .netsearch import batcher_net, Meter
from .netsearch_r2 import Checker2, prune, parse

FAMS_R2 = ["sort13", "sort14", "sort15", "sort16", "select12k4", "select14k7", "select16k4", "select16k8",
           "median13", "median15"]


def _one(f):
    return f, prune(batcher_net(parse(f)[1]), Checker2(f, Meter()), time.process_time() + 1e9)


if __name__ == "__main__":
    with Pool(5) as p: out = dict(p.map(_one, FAMS_R2))
    json.dump(out, open(sys.argv[1], "w"))
    print({k: len(v) for k, v in out.items()})
