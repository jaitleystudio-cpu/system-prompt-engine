# M06 — Pinned Promptfoo CLI interface smoke

Purpose: establish that **the actual Promptfoo 0.124.1 CLI binary** can load a
small public fixture and execute its documented `echo` provider on GitHub CI.
This does **not** use SPE candidate model outputs or prove either system better.

## Reproduce on an approved Node 24 test environment

```bash
export PROMPTFOO_DISABLE_TELEMETRY=1
export PROMPTFOO_DISABLE_UPDATE=1
export PROMPTFOO_DISABLE_REMOTE_GENERATION=true
export PROMPTFOO_DISABLE_SHARING=1
export PROMPTFOO_SELF_HOSTED=1
npx --yes promptfoo@0.124.1 --version
npx --yes promptfoo@0.124.1 eval \
  -c tools/competition/promptfoo/promptfooconfig.yaml \
  --no-cache --no-write --no-share --no-progress-bar
```

Expected: three deterministic public `echo` tests pass; no provider-token
credentials supplied and no paid LLM inference. Promptfoo's echo provider
reports cost 0. **Do not claim zero total cost**: npm downloads and CI runner
minutes use third-party resources and may be billable depending on account.
A five-minute per-job timeout bounds this smoke run.

Security boundary:
- Only synthetic visible data; no user messages, secrets or previously exposed
  holdout questions.
- No `--remote`, red-team generation, hosted inference, sharing or LLM judges.
- Telemetry and updater disabled via documented Promptfoo controls.
- No guaranteed network isolation: installation downloads from npm, and
  environment variables are not a firewall.
- Do not upload artifacts automatically or use GitHub secrets.
- This workflow is in a **draft** PR and must not be merged without review.

**Stop rule:** if npm resolution, compatibility, licensing, or CI minutes
make the experiment unviable, mark the attempt blocked; do not turn on paid
providers or silently increase the run budget.

### Evidence classes

`CLI_ECHO_SMOKE_PASS`: only real Promptfoo CLI/config/provider transport.
`MODEL_COMPARISON_NOT_RUN`: no real model, no paired SPE run.
`COMPETITIVE_VERDICT_NOT_ADJUDICATED`: independent holdouts/results absent.
`PROFITABILITY_NOT_ESTABLISHED`: no commercial demand or unit-profit receipts.

Background: https://www.promptfoo.dev/docs/providers/echo/
