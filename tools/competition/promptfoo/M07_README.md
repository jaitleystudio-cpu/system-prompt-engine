# Mission 07 — Profit-gated matched-model pilot (preflight only)

**STATUS: NO REAL MODEL RUNS. NO OWNER SIGNED SPEND APPROVAL. COMPETITIVE WIN NOT ESTABLISHED.**

Mission 06 ran the real Promptfoo 0.124.1 CLI with the echo provider:
3/3 public synthetic assertions passed (draft PR #178). Mission 05 fixed SPE
benchmark false-pass and provenance ambiguity (draft PR #174). Neither is a
head-to-head prompt-quality win.

This branch adds a separate **non-executing budget and fairness preflight**.
It calculates a worst-case token-based envelope for **both competitor arms**
and separately priced optimizer suggestion calls. It refuses to turn a JSON
budget value or unverified boolean into a permission to call models.

## Reproduce with no model calls

\`\`\`bash
python tools/competition/promptfoo/m07_evaluation_budget.py \
  --plan tools/competition/promptfoo/m07_plan.json
python -m pytest tests/unit/test_m07_evaluation_budget.py -q
\`\`\`

The manifest deliberately states 20 DEV, 10 VAL and 0 FRESH_HELD_OUT tasks.
The previous nominal holdout cases were exposed by the original pack and may
**not** be reused for a public claim. The report must say:
- \`run_permission: DENIED\`
- \`model_evaluation: NOT_RUN\`
- \`competitive_verdict: NOT_ADJUDICATED\`
- \`profitability: NOT_ESTABLISHED\`

### Unresolved prerequisites

A genuinely unseen and independently custodied holdout set; separately
authorized evaluator identity and verifiable signed receipts; target model
and version pinned in both systems; matched hyperparameters and known call
ceilings; both target and optimizer-suggestion token prices; founder-approved
financial cap; actual buyer-demand evidence. **None is inferred from mock or
echo-provider tests.** Keep holdout content and live provider credentials
outside repository and CI logs.

### Money law

No further feature development unless it enables positive, attributable unit
profit, acquisition, retention or essential business protection. Future live
tests should measure independent held-out success, constraint preservation,
false-pass rate, repair success, latency and total dollars per successful
task. The proposed advance target is +10 percentage points observed
held-out task success with no safety regression. Scaling should require
measured positive contribution economics (proposed >=30% margin) and
commercial buyer evidence. Targets are not achieved results.

Computed token prices **exclude** CI runner minutes, hosting, human review,
taxes, network and other external provider fees. This script is only a
preflight calculator, not a resource-enforcing API proxy. A separate signed
owner authorization, independently checked in the actual runner, is required
before any paid model work.

Protected main, frozen privacy policies, G6-H human evidence and release
authority remain unchanged. No merge, deploy, paid calls, user-data
collection or unsupported competitive claims.
