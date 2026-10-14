"""CWC-1 pilot harness per docs/cwc1/CONTRACT_R0.md. Requires BoxingGym (pinned b43e38cb) importable.
Usage: python -m spe_runtime.research.cwc1.harness --backend {ollama,stub} --tasks dev|holdout --arms A,B,C --out DIR [--dry-run]"""
from __future__ import annotations

import argparse
import importlib
import json
import os
import random
import re
import urllib.request

import numpy as np

HERE = os.path.dirname(__file__)
BG_ROOT = os.environ.get("BOXING_GYM_ROOT", "/tmp/boxing-gym")
N_EXP, N_EVAL, MAX_TOKENS, MAX_RETRIES = 10, 10, 512, 3
NUM_CTX = 8192

ENVS = {"location_finding": ("location_finding", "Signal"), "hyperbolic_temporal_discount": ("hyperbolic_temporal_discount", "TemporalDiscount"),
        "death_process": ("death_process", "DeathProcess"), "irt": ("irt", "IRT"), "survival": ("survival_analysis", "SurvivalAnalysis"),
        "dugongs": ("dugongs", "Dugongs"), "peregrines": ("peregrines", "Peregrines"), "lotka_volterra": ("lotka_volterra", "LotkaVolterra")}
GOALS = {("hyperbolic_temporal_discount", "direct"): "DirectGoal", ("hyperbolic_temporal_discount", "discount"): "DiscountGoal",
         ("location_finding", "direct"): "DirectGoal", ("location_finding", "source"): "SourceGoal",
         ("death_process", "direct"): "DirectDeath", ("death_process", "infection"): "InfectionRate",
         ("irt", "direct"): "DirectCorrectness", ("irt", "discriminate_question"): "DiscriminatingQuestion",
         ("irt", "best_student"): "BestStudent", ("irt", "difficult_question"): "DifficultQuestion",
         ("survival", "direct"): "DirectGoal", ("dugongs", "direct"): "DirectGoal", ("peregrines", "direct"): "DirectGoal",
         ("lotka_volterra", "direct"): "DirectGoal"}
CONF = {("hyperbolic_temporal_discount", "direct"): "hyperbolic_direct", ("hyperbolic_temporal_discount", "discount"): "hyperbolic_discount",
        ("location_finding", "direct"): "location_finding_direct", ("location_finding", "source"): "location_finding_source",
        ("death_process", "direct"): "death_process_direct", ("death_process", "infection"): "death_process_infection",
        ("irt", "direct"): "irt_direct", ("irt", "discriminate_question"): "irt_direct", ("irt", "best_student"): "irt_direct",
        ("irt", "difficult_question"): "irt_direct", ("survival", "direct"): "survival_direct", ("dugongs", "direct"): "dugongs_direct",
        ("peregrines", "direct"): "peregrines_direct", ("lotka_volterra", "direct"): "lotka_volterra_direct"}
HOLDOUT = [("dugongs", "direct"), ("peregrines", "direct"), ("hyperbolic_temporal_discount", "direct"),
           ("hyperbolic_temporal_discount", "discount"), ("location_finding", "direct"), ("location_finding", "source"),
           ("death_process", "direct"), ("death_process", "infection"), ("irt", "direct"),
           ("survival", "direct"), ("lotka_volterra", "direct")]
HOLDOUT_SEEDS = (101, 202, 303)
DEV = [("dugongs", "direct"), ("peregrines", "direct")]
DEV_SEEDS = (900,)


# ------------------------------------------------------------------ backends
class Ollama:
    def __init__(self, model="qwen2.5:7b-instruct", url="http://localhost:11434"):
        self.model, self.url = model, url
        tags = json.load(urllib.request.urlopen(url + "/api/tags", timeout=5))
        self.digest = next((m["digest"] for m in tags["models"] if m["name"] == model), None)
        if self.digest is None:
            raise RuntimeError(f"model {model} not present in Ollama")

    def chat(self, messages):
        body = json.dumps({"model": self.model, "messages": messages, "stream": False,
                           "keep_alive": -1,
                           "options": {"temperature": 0, "seed": 0, "num_predict": MAX_TOKENS, "num_ctx": NUM_CTX}}).encode()
        r = json.load(urllib.request.urlopen(urllib.request.Request(self.url + "/api/chat", body, {"Content-Type": "application/json"}), timeout=600))
        return r["message"]["content"]


class Stub:
    """Deterministic plumbing stub. NEVER a result."""
    digest = "STUB"

    def __init__(self, seed=0):
        self.rng = random.Random(seed)

    def chat(self, messages):
        last = messages[-1]["content"]
        if "JSON" in last and "hypotheses" in last:
            c = [round(self.rng.uniform(0, 4), 2) for _ in range(4)]
            return json.dumps({"hypotheses": [{"id": "H1", "form": "linear", "params": {"a": 1}}, {"id": "H2", "form": "constant", "params": {"c": 1}}],
                               "candidates": c, "predictions": {"H1": c, "H2": [1, 1, 1, 1]}})
        if "<observe>" in last or "observe" in last.lower():
            return f"<thought>stub</thought><observe>{self.rng.randint(0, 5)}</observe>"
        return "<thought>stub</thought><answer>1</answer>"


# ------------------------------------------------------------------ retrieval
def load_corpus():
    with open(os.path.join(HERE, "corpus_r0.jsonl")) as f:
        return [json.loads(x) for x in f if x.strip()]


def retrieve(query, k=2):
    q = set(re.findall(r"[a-z]{4,}", query.lower()))
    scored = []
    for i, d in enumerate(load_corpus()):
        w = set(re.findall(r"[a-z]{4,}", (d["title"] + " " + d["text"]).lower()))
        scored.append((-len(q & w), i, d))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [d for _, _, d in scored[:k]]


# ------------------------------------------------------------------ env
_PM = {"rng": np.random.default_rng(0), "patched": False}


def seed_all(seed):
    """BoxingGym calls pm.draw / pm.sample_prior_predictive without random_seed (OS entropy). Route them through
    a harness-seeded generator so true parameters and eval sets are reproducible and identical across arms."""
    import pymc as pm
    random.seed(seed)
    np.random.seed(seed)
    _PM["rng"] = np.random.default_rng(seed)
    if not _PM["patched"]:
        od, osp = pm.draw, pm.sample_prior_predictive

        def draw(*a, **k):
            k.setdefault("random_seed", int(_PM["rng"].integers(2**31)))
            return od(*a, **k)

        def spp(*a, **k):
            k.setdefault("random_seed", int(_PM["rng"].integers(2**31)))
            return osp(*a, **k)
        pm.draw, pm.sample_prior_predictive = draw, spp
        _PM["patched"] = True


def make_goal(env_name, goal_name, seed):
    import yaml
    seed_all(seed)
    mod_name, cls = ENVS[env_name]
    mod = importlib.import_module("boxing_gym.envs." + mod_name)
    with open(os.path.join(BG_ROOT, "conf", "envs", CONF[(env_name, goal_name)] + ".yaml")) as f:
        params = yaml.safe_load(f).get("env_params", {}) or {}
    env = getattr(mod, cls)(**params)
    env.include_prior = True
    return getattr(mod, GOALS[(env_name, goal_name)])(env)


def tag(text, name):
    m = re.findall(rf"<{name}>(.*?)</{name}>", text, re.S)
    return m[-1].strip() if m else None


def _loads_lenient(blob):
    """Amendment 3: small models emit Python-style mappings keyed by bare numbers ({1.0: 1.5}). Quote bare numeric
    keys, then json.loads. No other repair (no comment stripping, no truncation repair)."""
    try:
        return json.loads(blob)
    except Exception:
        fixed = re.sub(r'([{,]\s*)([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)(\s*:)', r'\1"\2"\3', blob)
        return json.loads(fixed)


def _as_list(pred, cands):
    """Amendment 3: accept predictions as a list aligned with candidates OR as a mapping keyed by candidate
    (matched by float value). Anything else is malformed."""
    if isinstance(pred, list):
        return pred
    if isinstance(pred, dict):
        try:
            m = {float(k): v for k, v in pred.items()}
            return [m[float(c)] for c in cands]
        except Exception:
            return None
    return None


def parse_cwc(text):
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        d = _loads_lenient(m.group(0))
        hs, cs, pr = d["hypotheses"], d["candidates"], d["predictions"]
        if len(hs) < 2 or not cs:
            return None
        ids = [h["id"] for h in hs]
        pr = {i: _as_list(pr.get(i), cs) for i in ids}
        if any(pr[i] is None or len(pr[i]) != len(cs) for i in ids):
            return None
        [float(v) for i in ids for v in pr[i]]
        d["predictions"] = pr
        return d
    except Exception:
        return None


def choose_discriminating(d):
    ids = [h["id"] for h in d["hypotheses"]]
    spreads = []
    for j in range(len(d["candidates"])):
        ys = [float(d["predictions"][i][j]) for i in ids]
        spreads.append(max(ys) - min(ys))
    best = max(range(len(spreads)), key=lambda j: (spreads[j], -j))
    return best, spreads


CWC_PROMPT = ("Before choosing the next measurement, return ONLY JSON: {\"hypotheses\": [{\"id\": \"H1\", \"form\": "
              "\"<functional form>\", \"params\": {...}}, ...at least 2 competing explanations consistent with the data so far], "
              "\"candidates\": [up to 4 valid inputs], \"predictions\": {\"H1\": [predicted output per candidate], ...}}. "
              "The harness will measure the candidate where your hypotheses disagree most.")


def episode(backend, env_name, goal_name, seed, arm):
    goal = make_goal(env_name, goal_name, seed)
    sysmsg = goal.get_system_message(True)
    if arm in ("B", "C"):
        docs = retrieve(sysmsg)
        sysmsg = "Background sources (frozen corpus):\n" + "\n".join(f"[{d['title']}] {d['text']}" for d in docs) + "\n\n" + sysmsg
    msgs = [{"role": "system", "content": sysmsg}]
    log = {"env": env_name, "goal": goal_name, "seed": seed, "arm": arm, "model_digest": backend.digest,
           "steps": [], "retries": 0, "calls": 0, "cwc_fallbacks": 0}
    obs = None
    for i in range(N_EXP):
        step = {"i": i}
        if arm == "C":
            prompt = (f"Result: {obs}\n" if obs is not None else "") + CWC_PROMPT
            msgs.append({"role": "user", "content": prompt})
            d, out = None, ""
            for t in range(1 + 1):
                out = backend.chat(msgs)
                log["calls"] += 1
                d = parse_cwc(out)
                if d:
                    break
                log["retries"] += 1
            msgs.append({"role": "assistant", "content": out})
            if d:
                j, spreads = choose_discriminating(d)
                x = str(d["candidates"][j])
                step["witness"] = {"hypotheses": d["hypotheses"], "candidates": d["candidates"], "predictions": d["predictions"],
                                   "spreads": spreads, "chosen_index": j}
            else:
                log["cwc_fallbacks"] += 1
                x = None
            if x is None:
                msgs.append({"role": "user", "content": "Give one valid input as <observe>x</observe>."})
                out = backend.chat(msgs)
                log["calls"] += 1
                msgs.append({"role": "assistant", "content": out})
                x = tag(out, "observe") or "0"
        else:
            prompt = (f"Result: {obs}\n" if obs is not None else "") + \
                "Think about where to observe next in <thought>, then give <observe>your input</observe>."
            msgs.append({"role": "user", "content": prompt})
            x = None
            for t in range(1 + MAX_RETRIES):
                out = backend.chat(msgs)
                log["calls"] += 1
                x = tag(out, "observe")
                if x is not None:
                    break
                log["retries"] += 1
            msgs.append({"role": "assistant", "content": out})
            x = x or "0"
        obs, ok = goal.env.run_experiment(x)
        tries = 0
        while not ok and tries < MAX_RETRIES:
            msgs.append({"role": "user", "content": f"{obs}\nInvalid input. Give <observe>valid input</observe>."})
            out = backend.chat(msgs)
            log["calls"] += 1
            log["retries"] += 1
            msgs.append({"role": "assistant", "content": out})
            x = tag(out, "observe") or "0"
            obs, ok = goal.env.run_experiment(x)
            tries += 1
        step.update({"input": x, "observation": str(obs), "valid": bool(ok)})
        if arm == "C" and "witness" in step and ok:
            try:
                y = float(re.findall(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", str(obs))[-1])
                j = step["witness"]["chosen_index"]
                err = {h["id"]: abs(float(step["witness"]["predictions"][h["id"]][j]) - y) for h in step["witness"]["hypotheses"]}
                step["witness"]["observed_y"] = y
                step["witness"]["contradiction_rank"] = sorted(err, key=lambda k: -err[k])
            except Exception:
                step["witness"]["observed_y"] = None
        log["steps"].append(step)
    preds, gts = [], []
    goal.eval_pointer = 0
    seed_all(seed + 10_000)      # identical eval set across arms regardless of RNG use during experiments
    for _ in range(N_EVAL):
        q, gt = goal.get_goal_eval_question(True)
        msgs_eval = msgs + [{"role": "user", "content": f"The final result is {obs}.\n" + q}]
        out = backend.chat(msgs_eval)
        log["calls"] += 1
        preds.append(tag(out, "answer") or out.strip()[-20:] or "0")
        gts.append(gt)
    log["predictions"] = preds
    log["ground_truth"] = [g.tolist() if hasattr(g, "tolist") else g for g in gts]
    try:
        err = goal.evaluate_predictions(preds, gts)
        log["raw_error"] = [float(e) for e in (err if isinstance(err, (tuple, list)) else [err])]
    except Exception as e:  # parse failures are recorded, not hidden
        log["raw_error"] = None
        log["score_error"] = repr(e)[:300]
    nm = getattr(goal, "norm_mu", None)
    ns = getattr(goal, "norm_sigma", None)
    log["std_error"] = ((log["raw_error"][0] - nm) / ns) if (log["raw_error"] and nm is not None and ns) else None
    return log


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", default="ollama")
    ap.add_argument("--tasks", default="dev")
    ap.add_argument("--arms", default="A,B,C")
    ap.add_argument("--out", required=True)
    ap.add_argument("--dry-run", action="store_true")
    # amendment 3: model/url/seed/shard selection (defaults reproduce R0 behaviour)
    ap.add_argument("--model", default=os.environ.get("CWC1_MODEL", "qwen2.5:7b-instruct"))
    ap.add_argument("--url", default=os.environ.get("CWC1_OLLAMA_URL", "http://localhost:11434"))
    ap.add_argument("--seeds", default=None, help="comma list, subset of the frozen seeds")
    ap.add_argument("--shard", default="0/1", help="i/n: run tasks whose holdout index %% n == i")
    a = ap.parse_args()
    if a.tasks == "holdout" and (a.backend == "stub" or a.dry_run):
        raise SystemExit("holdout cannot be run with stub/dry-run")
    backend = Stub() if a.backend == "stub" else Ollama(model=a.model, url=a.url)
    tasks, seeds = (DEV, DEV_SEEDS) if a.tasks == "dev" else (HOLDOUT, HOLDOUT_SEEDS)
    if a.seeds:
        sel = tuple(int(x) for x in a.seeds.split(","))
        assert set(sel) <= set(seeds), "seeds must be a subset of the frozen seeds"
        seeds = sel
    si, sn = (int(x) for x in a.shard.split("/"))
    tasks = [t for k, t in enumerate(tasks) if k % sn == si]
    os.makedirs(a.out, exist_ok=True)
    label = "DRY_RUN" if a.dry_run else "SCORED"
    for env_name, goal_name in tasks:
        for seed in seeds:
            for arm in a.arms.split(","):
                log = episode(backend, env_name, goal_name, seed, arm)
                log["label"] = label
                log["model_tag"] = getattr(backend, "model", "STUB")
                fn = f"{a.out}/{label}_{env_name}_{goal_name}_{seed}_{arm}.json"
                with open(fn, "w") as f:
                    json.dump(log, f, indent=1, sort_keys=True, default=str)
                print(label, env_name, goal_name, seed, arm, "calls", log["calls"], "raw_error", log["raw_error"], "std", log["std_error"])


if __name__ == "__main__":
    main()
