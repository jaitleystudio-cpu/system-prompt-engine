# SPE Ω North Star R23 — Private Failure → Existing Local Prompt Studio

State: DRAFT / UNTESTED IMPROVEMENT ONLY / NO DEPLOYMENT.
Parent: R22 PR #179 @ 45570f785492f2c65e3cd42e9c55f7688045b41f.

## User outcome
The user now has a concrete path from a privately described AI problem
to the existing SPE semantic prompt preparation engine. Instead of
leaving them with a downloaded report only, the incident page offers
an explicit **Draft improvement in Prompt Studio** action alongside
the existing private JSON export.

## Existing-owner integration
- The R22 manual privacy acknowledgment, text limits and common-secret
  veto apply to both export and Prompt Studio handoff.
- Any edit resets user privacy review; without it, both actions are disabled.
- R23's `buildLocalRepairStudioBrief()` derives a bounded, deterministic
  instruction brief from R22's strict local report envelope.
- User-claimed data appears as JSON DATA clearly identified as untrusted.
  Untrusted summaries may contain adversarial text; the brief directs
  the local semantic owner not to treat descriptions as instructions.
- The brief explicitly states that the original prompt was not supplied,
  no provider model was run, no cause was established, and no repair
  performance has been measured.
- Prompt Studio remains the existing App `setUserRequest`/`defaultIntentLens`
  /`setCategory('AI Assistant')`/`setView('create')` path. No second
  prompt engine, new network authority, hidden API call or auto-validation.
- The user must manually review/compile/use the resulting prompt and
  independently compare it against a baseline before claiming improvement.

## Adversarial acceptance
- Missing privacy review or suspected secret blocks studio transfer.
- User-provided JSON metacharacters/newlines are escaped as data.
- No original prompt is invented. No internal AI causal authority promoted.
- Unit checks enforce replay, correction and repair validation FALSE.
- DOM controls require a real click and a verified local review before
  local in-memory route transfer.
- Existing TypeScript, copy gate, static noindex, Python egress,
  CLI/WASM and all R0–R22 regression checks remain mandatory.

## Release boundaries
R23 is a candidate UI and prompt-preparation workflow, not evidence
of measured user benefit, independent real-model repair or production
release. G6-H human ratings remain unavailable. No paid model calls,
shared telemetry, server-side incident upload, public publication, or
automatic SEO indexing. Exact-commit CI plus independent UX/privacy
and real-model paired tests required for further claims.