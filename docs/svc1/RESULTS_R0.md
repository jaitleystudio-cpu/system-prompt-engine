# SVC-1 R0 RESULTS — Selective Verification Cascade

- Contract commit: `ba5d48f366e5b193aaa1952028588aab27235fb9` (file sha256 `e6342391…8080ee29`)
- Code commit (pre-outcome): `b6619ace510049b511bff6b1d52001b27f68016e`
- Overall verdict: **REJECTED** (builder self-run; Bro replay required)
- Cost: ₹0 (local CPU only; synthetic matched-noise tiers, not live LLM)
- Budget B=1280 over 160 holdout items; 20 seeds; calib n=40

## Mean holdout accuracy (95% t-CI)
- `always_v2`: 0.3859 [0.3811, 0.3908]
- `always_v0`: 0.6388 [0.6248, 0.6527]
- `fixed_cascade`: 0.2941 [0.2900, 0.2981]
- `random_defer`: 0.6734 [0.6558, 0.6911]
- `spe_svc`: 0.3019 [0.2599, 0.3438]
- mean calibrated τ: 0.657

## Contrasts (spe_svc − baseline)
- `spe_svc-always_v2`: Δ=-0.0841 CI95=[-0.1272, -0.0409] raw p=0.001709 Holm p=0.003417
- `spe_svc-fixed_cascade`: Δ=+0.0078 CI95=[-0.0356, +0.0512] raw p=0.7408 Holm p=0.7408
- `spe_svc-random_defer`: Δ=-0.3716 CI95=[-0.4168, -0.3264] raw p=0.0002441 Holm p=0.0009763
- `spe_svc-always_v0`: Δ=-0.3369 CI95=[-0.3784, -0.2953] raw p=0.0002441 Holm p=0.0009763

## Verdicts (preregistered rules)
- H1_spe_vs_always_v2: **REJECTED**
- H2_spe_vs_fixed_cascade: **NOT_PROVEN**
- H3_spe_vs_random_defer: **NOT_PROVEN**
- exploratory_spe_vs_always_v0: **NOT_PROVEN**

## Interpretation (honest)
Under B=1280, coverage-heavy cheap policies (`always_v0`, `random_defer`) beat expensive cascades on accuracy because unanswered items count as wrong. `spe_svc` spent cascade cost on hard-first items and under-covered the batch, finishing below `always_v2` (H1 **REJECTED**, Δ≈−0.084). Early-exit selective verification did **not** beat always-expensive or fixed cascade on this synthetic schedule. This is a negative result for this design—not a product claim, not AGI.

## Prior art cited
- AVA: https://github.com/llmsresearch/AVA
- PiFlow: https://arxiv.org/abs/2505.15047
- OpenAlex: Adaptive Computation survey / selective deferral (2025–26 OA hits in cycle research)

## Replication
```bash
cd /Volumes/4TB-WD/spe-worktrees/spe-svc1-r0
PYTHONPATH=. python3 -m spe_runtime.research.svc1.experiment
```
