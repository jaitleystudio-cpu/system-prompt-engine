# Autonomous SPE parser improvement loop

The nightly Codex agent is the candidate generator and researcher. `tools/brain-updates/evolve.mjs` is its deterministic measurement gate. This extends the existing real SPE parser and bundle/version machinery. It does not use the mock renderer in `promptGepaOptimizer.ts`, retrain foundation-model weights, or equate a public case score with broad intelligence.

## Approved operating scope

The founder requested automatic discovery, testing and engine upgrades in this chat. Routine work is limited to the agent-owned `codex/spe-brain-updates` worktree and plain-English parser. No daily approval is required for a measured parser repair in this scope. Main, payments, signing authorities, production deployment and the dirty original checkout remain outside the loop. New engine owners or a broader release need a separate scope decision.

Codex provides the AI reasoning/search/repair step using the user's account and available usage limits. It is not a zero-compute or unlimited service. No provider API key, paid model API or private user prompt is used. The installed local Ollama service was unavailable; this loop does not depend on it.

## Real execution protocol

1. Inspect the exact feature HEAD and cleanliness; honor `.spe_emergency_stop` and the experiment lock. Do not touch another run's dirty files or steal a stale lock.
2. Discover one reproducible parser failure using public examples or wholly synthetic cases. Check source and official technical references where useful. Reject speculative changes. Countercheck existing behavior before claiming a defect.
3. If needed, append new train/validation/audit cases before `begin`. Do not change or remove existing cases/assertions. Every expected phrase must occur literally in its request. Cases are public and frozen during an experiment; they are not secret or statistically independent holdouts. Partition by task/domain, not duplicate strings. Record the data limitation.
4. Commit evaluation setup locally before proposing source changes. `node tools/brain-updates/evolve.mjs begin` records the current source commit, actual parser outputs and frozen input digests, and executes existing regression gates. Expected discovery-case failures are baseline evidence, not a production PASS.
5. Propose at most one bounded repair to `apps/web/src/engine/plainEnglishParser.ts`. Use failure feedback and source reasoning. The actual parser receives only raw input, never the oracle labels. Do not append expected answers, make fixture-only branches, or modify evaluator/policy/source files outside that target.
6. `node tools/brain-updates/evolve.mjs qualify` requires a gain in each train/validation/audit split, no previously passing case regression, no goal/constraint/output mixing, all nine committed gates passing, unchanged protected files and unchanged source bytes across checks, and bounded candidate import/execution in a separate process. Failed, unchanged, malformed, timed-out or tampered candidates are held.
7. For a qualified candidate, commit only the parser repair. `node tools/brain-updates/evolve.mjs close` binds the exact candidate bytes to the single-parent, parser-only repair commit and retains an immutable receipt. Then execute `node tools/brain-updates/run.mjs --update` to produce the next qualified bundle version. Save precise receipts and update draft PR183. Do not merge main or call this production release.
8. For a rejected candidate, preserve its diff/receipt in ignored experiment storage, restore only this run's parser edits, and abort. If an evaluation-setup commit introduced failing cases and no repair qualifies, revert that own setup commit without resetting other history. Do not push a failing corpus to the canonical feature branch. Keep useful failing examples in the ignored backlog.
9. Stop after one candidate or 20 minutes; retain the champion on no-improvement days. Notify only accepted repairs, failures, meaningful external changes or necessary owner action. A new version is never the daily success criterion.

An aborted/crashed experiment can leave `experiment.lock`. Inspect the baseline, processes and working tree before using `abort`; that operation closes the experiment and does not restore source files. Start only with a clean worktree. Existing LaunchAgent/cron jobs are separate and are not duplicate writers of this feature branch.

## Activation and evidence boundaries

The Codex heartbeat schedules this thread's agent nightly. The app/runtime, connected host and account allowance must be available; this is not an always-on cloud service or an exact wall-clock guarantee. An ACTIVE schedule proves configuration, not an observed unattended run. Check the next run time and actual receipts after execution. The first repair in this task is an agent-driven supervised invocation of the same protocol; it is not mislabeled as the first overnight run.

Local/feature acceptance upgrades the engine source used by this worktree and future experiments. The public site continues using its deployed artifact until a separate release. The scheduled agent must not recreate the automation on every run.

## Research and falsification receipt

Mission/decomposition/evidence plan and 16 hypotheses: `docs/superpowers/plans/2026-10-17-spe-brain-research.md`. This implementation addresses real execution and bounded code evolution, not every proposed research phase. Official DSPy GEPA guidance separates reflective training, selection and final tests: https://dspy.ai/current/getting-started/gepa-optimization/. GEPA identity was independently matched through Scholar Sidekick and native arXiv metadata through Sider. SciSpace discovery supplied contrary task-dependent outcomes; Acumen leads were not accepted as proof. No GEPA benchmark result is attributed to SPE. The method borrows execution feedback and independent task examples, not the GEPA algorithm or a foundation-model training claim.

Ten adversarial hypotheses: whole-request echoing could inflate scores (reject via goal/constraint separation); labels could leak to execution (raw-string-only call); average gain could hide regressions (case-level retention); tied scores could count as improvement (reject); modified evaluators could certify themselves (freeze and compare); changed source during tests could qualify old bytes (per-gate hashes); wrong-parent commits could be accepted (exact parent binding); two nightly writers could overlap (exclusive experiment lock plus clean-source check); failed initial trials could force fake releases (abort/no-op); a configured schedule could be reported as observed execution (separate statuses). Public data reuse and same-account evaluator access remain limitations; hashes are not a malicious-agent sandbox.

## Worldwide availability boundary

02:17 IST is 20:47 UTC on the previous calendar day: during US daylight time it is 16:47 Eastern / 13:47 Pacific; standard-time equivalents are one hour earlier. It is a background-work start time, never a global maintenance outage window. No time is quiet for every region.

The active engine must remain available while isolated candidate generation and tests run. This loop must never stop serving processes, build into an active serving directory, clear user caches/drafts, change a live database schema or move a production pointer. It cannot deploy, restart, or pause the public app. Existing unrelated host maintenance is not certified by this feature.

Future production rollout is a separate gate: immutable candidate build, regional synthetic checks, health/latency/error comparisons, gradual traffic cohorts with version/session consistency, backward-compatible assets/API/cache behavior, and a tested fast rollback while the prior version remains available. Do not force a service-worker upgrade or mix incompatible assets mid-session. Cloudflare's official gradual-deployment guidance explicitly warns of version skew: https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/. Database/Durable Object lifecycle migrations require their own compatibility and rollback decision; a traffic shift alone does not make them reversible.

Choose rollout cohorts by measured traffic and risk, not a promise that India night is safe globally. Commercial prioritization should use aggregated regional activation, retention, paid conversion, support cost and reliability, without private prompt content or derivatives becoming targeting data. Country revenue assumptions remain unmeasured. Initial release thresholds and regional coverage must be agreed against the real hosting/traffic evidence before automatic production promotion.
