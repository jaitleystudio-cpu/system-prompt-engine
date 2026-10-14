# SPE Ω North Star R22 — Private Local Failure-Report Intake

State: DRAFT; PRIVATE, UNVERIFIED AND NO PUBLIC RELEASE.
Parent: R21 PR #177 at f6c029a99d1ccef296b821eb97fb3ac9538b2783.

## Goal
Enable any user to document what an AI got wrong without requiring an
external model API, server-side user content collection, SPE account,
public status-feed observation, or fabricated independent diagnosis.

## Implemented in the existing website and Failure Genome conceptual owner
- `incidentIntake.ts` defines a deterministic report envelope limited to
  a user-claimed provider, model revision (or explicit UNKNOWN), problem
  type, expected behavior and observed behavior, plus evidence-absence flags.
- `PrivateFailureIntake.tsx` is a private local-only React form embedded
  on the existing noindex `/ai-incidents` preview. No API, cookies,
  analytics, localStorage, sessionStorage, background upload, or model run.
- The report is exported to JSON only after a real button click AND user
  confirmation that the text has been reviewed for private information.
- Any subsequent edit revokes prior review confirmation.
- Short text is capped; common secrets, email addresses, high-risk key
  formats, payment-like long digit sequences and forbidden controls are
  blocked. This is a heuristic alert, NOT guaranteed secret redaction.
- No raw full prompt or AI answer is requested. Nothing is transmitted
  to SPE; the browser may locally manage the downloaded file.
- All output proof/authority flags are explicitly FALSE. Exports cannot
  become public incident reports, independent model replay or repair proof.

## Adversarial tests and CI
1. Private export requires review, two nonempty summaries and bounded text.
2. Unrecognized provider and failure category rejected.
3. Secret/PII patterns and control characters reject.
4. Unknown version is permitted only as clearly unpinned user claim.
5. Output schema forbids fake receipt, real-model proof, network/run rights.
6. No storage, analytics, API calls, or automatic download on render.
7. Existing R20 noindex, R21 checkpoint and prior R19 official-source
   custody, copy governance, web typecheck, canonical WASM/CLI and Python
   regression/egress remain authoritative.

## Limits
A user-written summary can still contain personal or confidential data
that a heuristic cannot detect; the user must inspect it, and SPE must
not claim safety guarantees. No user report intake is publicly published,
submitted to the SPE backend or automatically incorporated into R2/R3/R10
evidence. No owner approval for deploying, indexing or model spending.
