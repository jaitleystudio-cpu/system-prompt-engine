# Nightly Brain Bundles Implementation Plan

**Goal:** Automatically version and package changed SPE brain components after real regression checks, without turning packaging into a claim of model training or production deployment.

**Architecture:** Extend the existing nightly operations with a separate data-only distribution channel. A Node runner fingerprints an explicit source allowlist, runs fixed regression commands, writes immutable bundles and atomically advances a validated local pointer. A default-branch workflow stores the current pointer and run receipt on a dedicated Git state branch using non-forced updates; repository source, payments and production are not rewritten.

**Tech Stack:** Node built-ins, node:test, GitHub Actions and Git Data API. No paid model calls, new packages or provider secrets.

**Spec:** `docs/superpowers/plans/2026-10-17-spe-brain-research.md` (approved research proposal; this plan implements its first concrete artifact/version/recovery deliverable).

## Constraints
- Preserve the active checkout's unrelated billing work; use isolated branch codex/spe-brain-updates.
- Only meaningful component changes advance the bundle version. A calendar date, registry generation timestamp or successful repeat must not.
- Gates execute, not caller-supplied PASS flags. Failed/timed-out checks or changed inputs hold the previous pointer.
- Reject corrupt state, symlinks, traversal, unbounded files and concurrent local writers. Git distribution updates never force-push over a competing writer.
- Report source-bundle regression qualification only; intelligence gain, provider currency, production deployment and training remain separate.

## Tasks (native execution)
1. [x] Add failing tests for deterministic fingerprints, registry validation, version/no-op behavior, corruption, failed gates, input mutation and atomic pointer recovery.
2. [x] Implement packaging/state runner with atomic writes, fixed source policy, bounded actual child-process gates and receipts.
3. [x] Add end-to-end CLI tests and real SPE compile/parser/Unicode regression checks. Run Node 22 and 24.
4. [x] Implement authenticated GitHub state transport with mocked HTTP negative cases: missing ref vs denied access, CAS conflict, malformed state and no token logging.
5. [x] Wire a nightly/default-branch workflow plus PR tests. Document scope, activation, local use, state branch and recovery.
6. [x] Run the real updater twice to demonstrate update then unchanged; run focused regression and inspect diff. Commit only this feature and prepare a reviewable handoff.

## Review focus
- A gate that exits zero after modifying an input must not qualify the old snapshot.
- A missing/invalid persisted state must not silently become a new trusted baseline.
- A timeout or failed upload must not be reported as a remotely published release.
- A UTC-day boundary must retain the correct Asia/Kolkata business date.
- A repeated run or volatile registry timestamp must not increase the version.

## Evidence policy
Record real exits and output digests, tested commands, source commit and snapshot hashes. Preserve failed receipts without modifying existing tests to manufacture PASS. All automation remains inactive remotely until the workflow reaches the default branch. Model optimization/training is not implemented by this slice.

## Fresh review and repair

The independent review of `a74e0f52` found five Important defects and no Critical defects: cross-gate mutation, missing remote immutable verification, surviving-receipt history reset, Contents API size incompatibility, and unbound helper inputs. All five were accepted for the single fix pass. New negative tests reproduced the mutation/history/remote restore defects before their fixes; helper inputs and workflow path filters were expanded. Runtime rollout, learning gains, live providers, malicious trusted-main code and external GitHub activation remain outside the measured scope.
