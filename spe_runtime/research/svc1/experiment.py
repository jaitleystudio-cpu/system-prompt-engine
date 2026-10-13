"""SVC-1 R0 experiment runner."""
from __future__ import annotations

import json
from pathlib import Path
from .verifiers import make_claims
from .policies import always_v2, always_v0, fixed_cascade, random_defer, spe_svc, RunResult
from . import stats

CONDITIONS = ["always_v2", "always_v0", "fixed_cascade", "random_defer", "spe_svc"]
BUDGET = 160 * 8  # 1280
N_SEEDS = 20
DELTA = 0.05


def run_experiment(out_dir: Path | None = None) -> dict:
    claims = make_claims(200)
    calib = [c for c in claims if c.item_id < 40]
    holdout = [c for c in claims if c.item_id >= 40]
    assert len(holdout) == 160

    rows: list[dict] = []
    taus: list[float] = []
    for seed in range(N_SEEDS):
        results: dict[str, RunResult] = {
            "always_v2": always_v2(holdout, seed, BUDGET),
            "always_v0": always_v0(holdout, seed, BUDGET),
            "fixed_cascade": fixed_cascade(holdout, seed, BUDGET),
            "random_defer": random_defer(holdout, seed, BUDGET),
        }
        svc, tau = spe_svc(calib, holdout, seed, BUDGET)
        results["spe_svc"] = svc
        taus.append(tau)
        for name, r in results.items():
            assert r.cost_used <= BUDGET
            rows.append({
                "seed": seed,
                "condition": name,
                "accuracy": r.accuracy,
                "answered": r.answered,
                "cost_used": r.cost_used,
                "n_correct": r.n_correct,
                "n_answered": r.n_answered,
                "tau": tau if name == "spe_svc" else None,
            })

    by_cond: dict[str, list[float]] = {c: [] for c in CONDITIONS}
    for row in rows:
        by_cond[row["condition"]].append(row["accuracy"])

    contrasts = [
        ("spe_svc-always_v2", "always_v2"),
        ("spe_svc-fixed_cascade", "fixed_cascade"),
        ("spe_svc-random_defer", "random_defer"),
        ("spe_svc-always_v0", "always_v0"),
    ]
    contrast_stats = {}
    p_list = []
    for cname, baseline in contrasts:
        diffs = [by_cond["spe_svc"][i] - by_cond[baseline][i] for i in range(N_SEEDS)]
        p = stats.signflip_p(diffs, seed=hash(cname) % 10_000)
        lo, hi = stats.ci_t(diffs)
        contrast_stats[cname] = {
            "mean_delta": stats.mean(diffs),
            "ci95": [lo, hi],
            "p_raw": p,
        }
        p_list.append((cname, p))
    holm = stats.holm(p_list)
    for k, v in contrast_stats.items():
        v["p_holm"] = holm[k]

    def decide(cname: str) -> str:
        st = contrast_stats[cname]
        if st["mean_delta"] < -0.02 and cname == "spe_svc-always_v2":
            return "REJECTED"
        if st["p_holm"] < 0.05 and st["mean_delta"] >= DELTA:
            return "SUPPORTED"
        return "NOT_PROVEN"

    verdicts = {
        "H1_spe_vs_always_v2": decide("spe_svc-always_v2"),
        "H2_spe_vs_fixed_cascade": decide("spe_svc-fixed_cascade"),
        "H3_spe_vs_random_defer": decide("spe_svc-random_defer"),
        "exploratory_spe_vs_always_v0": decide("spe_svc-always_v0"),
    }

    summary = {
        "contract": "docs/svc1/CONTRACT_R0.md",
        "budget": BUDGET,
        "n_seeds": N_SEEDS,
        "n_holdout": 160,
        "n_calib": 40,
        "means": {c: stats.mean(by_cond[c]) for c in CONDITIONS},
        "ci95_accuracy": {c: list(stats.ci_t(by_cond[c])) for c in CONDITIONS},
        "mean_tau": stats.mean(taus),
        "contrasts": contrast_stats,
        "verdicts": verdicts,
        "overall": (
            "SVC_ADVANTAGE_PARTIAL"
            if any(v == "SUPPORTED" for v in verdicts.values())
            and not all(v == "SUPPORTED" for k, v in verdicts.items() if k.startswith("H"))
            else (
                "SVC_ADVANTAGE_SUPPORTED"
                if all(verdicts[k] == "SUPPORTED" for k in ("H1_spe_vs_always_v2", "H2_spe_vs_fixed_cascade", "H3_spe_vs_random_defer"))
                else (
                    "REJECTED"
                    if verdicts["H1_spe_vs_always_v2"] == "REJECTED"
                    else "NOT_PROVEN"
                )
            )
        ),
        "cost_inr": 0,
        "notes": "Synthetic matched-noise tiers; not live LLM. Builder self-run; Bro replay required.",
    }

    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "rows.json").write_text(json.dumps(rows, indent=2))
        (out_dir / "summary.json").write_text(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    out = Path("evidence/svc1/r0")
    s = run_experiment(out)
    print(json.dumps(s, indent=2))
