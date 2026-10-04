# R4 task 5 research journey — NOT_RUN

privacy_qualification: HOLD
FIELD_CWV: UNKNOWN
This note is not a privacy qualification, not a field CWV result, and not a product pass.

Recorded: 2026-10-04 11:29 IST
RESEARCH: NOT_RUN
Requests: none
External hosts: none
Raw egress: none

No browser was opened. No server was started. No literature query was sent. No research client was created. OpenAlex, Crossref, and NCBI were not called.

## Search

Shell tree, read only: `/Volumes/4TB-WD/spe-worktrees/spe-lane-r3-e-shell`
Shell branch: `grok/r3-e-shell-20261003`
Shell HEAD: `ca0abf6d9a71d464369976da35cbabd5de9e7150`
The shell worktree was not edited.

Privacy tree start: `6addc5846db57060b90ae8d7c98d0a999d574d26`
Privacy branch: `grok/r4-t5-privacy-journeys-20261004`

There is no canonical research path a normal user can open.

- Shell public routes are `/`, `/create`, `/code`, `/daily-lab`, `/my-work`, `/privacy`, `/capabilities`, `/workspace`, `/website`, and `/media`. There is no `/research` route. This privacy branch public routes stop at `/workspace`. It has no `/research`, `/media`, or `/website` route.
- `apps/web/src/landing/UniversalInputShell.tsx` lists a Research action (`id: "research"`, "Conduct empirical investigation & citation search"). Its own constant is `ROUTE_MOUNT_STATUS = "NOT_INTEGRATED"`. `apps/web/scripts/test-universal-shell.mjs` requires `App.tsx` and `routing.ts` not to mount or reference `UniversalInputShell`. An unmounted action button is not a page a user can open.
- The shell tree has no call to `openalex.org`, `api.crossref.org`, `eutils.ncbi`, or `ncbi.nlm.nih.gov`. Protocol and category code named "research" compiles a local prompt contract. It is not a literature lookup a user can run.
- No research client was added on this branch. Inventing one would not be an existing route.

The previous media log and the OCR NOT_RUN note stay frozen and are not relabeled: `evidence/r4t5/MEDIA_ROUTE_NOTE.md`, `evidence/r4t5/media-route-journey.json`, `evidence/r4t5/OCR_NOT_RUN.md`. PR #114 was not rewritten.

judgeEgress was not run. Product privacy verdict remains HOLD. FIELD_CWV remains UNKNOWN.
