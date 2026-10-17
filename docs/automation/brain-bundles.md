# Nightly brain source bundles

This adds an automatically versioned **source-bundle distribution channel**, extending the existing model/prompt/evaluation owners. It is not a foundation-model trainer, provider-discovery connector, remote-code loader or production deployment system. A qualified bundle means only that the listed source components passed the listed regression checks. Intelligence gain, live model availability and complete semantic safety are not inferred.

## What runs

`node tools/brain-updates/run.mjs --check` fingerprints the committed allowlist and executes six actual regression commands. `--update` also writes a bundle and atomically advances the local pointer after successful checks. Default state is the git-ignored `.spe/brain-updates` directory. Use `--state /absolute/directory` for an isolated rehearsal.

The workflow runs tests on Node 22/24. On default-branch changes, manual dispatch or the desired 02:17/06:17 IST schedules, it restores data state, executes checks and publishes to `spe-brain-state`. GitHub cron is best-effort, not a precise timing/availability guarantee. The 06:17 run supplies another recovery opportunity. It does not declare the previous run successful.

`spe-brain-state` is a data-only branch: current bundle, run receipt and immutable bundles. Non-forced Git updates reject concurrent publication. It never commits to main, edits prompts, adjusts pricing, calls a paid model, merges a PR, changes cloud deployment or trains weights. Existing LaunchAgent/crontab definitions are not modified. Do not run native and cloud writers against an unrelated local pointer and call that distributed coordination.

## Version semantics

Initial version is `0.1.0`. A changed component/evaluation fingerprint increments the patch counter. Repeated success, registry generation timestamps and registry array ordering do not. A return to an earlier content snapshot is a **new** version/lineage event, preserving history.

The manifest records exact source commit, normalized component content/digests, prior fingerprint, qualification time, command exits/output digests and scope. `productionDeployed`, `providerAvailabilityVerified` and `intelligenceGainMeasured` remain false. This is integrity/provenance data; SHA-256 is not a publisher signature or independent external outcome.

## Failure/recovery behavior

- Nonzero/timeout gates, duplicate model IDs, malformed registries and gate/source mutation hold the candidate.
- Traversal, source symlinks, excessive files/bytes, corrupt pointers and missing immutable bundles fail closed.
- Write the immutable bundle before replacing the pointer; a partial candidate must not replace the last known good pointer.
- Local state uses an exclusive directory lock. It is single-host coordination, not a transactional distributed lease. A crashed local process can leave a lock; inspect the process/state before removing it. Cloud jobs restore state onto a fresh runner, so stale local locks are not distributed.
- GitHub repository access failure is distinct from an absent state branch. Corrupt/missing remote state on an existing branch never becomes an empty baseline.
- Upload failures/conflicts fail the workflow. No blind forced retry. A later run reads current remote state before retrying.
- The execution receipt records attempts. A failed remote publish is not production success. Git history and the final state-publish result must be consulted separately from a local UPDATED receipt.

## Security and limitations

PR checks have read-only permissions. Only trusted main jobs receive repository write permission, and the token is supplied only to state transport steps. Child regression processes receive a reduced environment without inherited payment/provider credentials. This is not an OS sandbox against malicious trusted-main code. Restrict the write-capable workflow/branch through normal repository controls; GitHub's contents permission is repository-scoped, not a cryptographic single-branch capability.

Source package inputs are fixed in `tools/brain-updates/policy.mjs`; no downloaded instructions/custom CLI command is executed. Registry packaging does not correct false upstream claims or prove internal IDs are valid provider API names. Qualify real model calls, hidden holdouts and matched-budget learning separately before a future runtime rollout. No remote source bundle is automatically executed by the browser.

## Activation and verification

The workflow must first be reviewed and reach main; a branch-local workflow is not a running nightly service. Perform one initial manual dispatch with `initialize=true` to create the data-state branch. Later scheduled/event runs require that state to exist: a deleted branch must not silently reset version history. Do not use initialization to conceal lost state; recover Git history first. Repository Actions write restrictions or branch rules may block publication, which should remain a visible failure. No personal access token or live Stripe key is needed.

Check the exact workflow run, `last-run.json` and the `spe-brain-state` Git commit. Distinguish UPDATED, UNCHANGED and HELD. Do not label a `workflow_dispatch` run as an observed scheduled run. Check that a second identical run preserves the version. To stop publication, set repository variable `SPE_EMERGENCY_STOP=1` or commit the existing stop sentinel.

Tests: `node --test tests/brain-updates/*.test.mjs`. End-to-end local rehearsal: choose an empty external state directory; run `--update` twice; expect UPDATED then UNCHANGED with the same version. Only committed allowlisted sources/gates qualify. No model optimization experiment or production release is certified by this rehearsal.
