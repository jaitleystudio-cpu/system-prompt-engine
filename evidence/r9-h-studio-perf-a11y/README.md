# SPE-R9-H Studio perf + a11y evidence

## Withdrawn in-tree receipt

`measure.json` previously committed here was withdrawn by the R9-H proof repair.
Its `frames.mobileFrameP95` (21.71 ms) was the desktop p95 multiplied by 1.3,
yet the block was labelled `MEASURED`. That is a derived estimate, not a
mobile measurement. Its `sha` field also named an earlier commit than the
code it sat in (an in-tree receipt cannot name its own commit).

## How lab receipts are produced now

Receipts are never committed into the candidate tree. Run from a clean
checkout of the frozen candidate:

```sh
cd apps/web
SPE_VERIFIER_RECEIPT_DIR=/path/outside/the/repo npm run measure:studio-perf-a11y
# or: node --experimental-strip-types scripts/measure-studio-perf-a11y.mjs \
#       --receipt-dir /path/outside/the/repo [--candidate <dir>/<sha>/candidate.json]
```

The harness freezes the candidate first (`tools/candidate-custody.mjs`:
commit SHA, git tree SHA, SHA-256 tree digest, lockfile digests, harness
digest), samples desktop 1280×800 @1x and mobile 390×844 @3x separately (own
warmup, own samples, own p50/p95/p99, viewport, DPR, user agent) for an empty
Studio scene and a non-empty representative scene, re-checks the candidate is
unchanged, and writes `<dir>/<sha>/candidate.json` plus
`<dir>/<sha>/receipts/*.json` outside the worktree.

Check a receipt against a frozen candidate:

```sh
node tools/candidate-custody.mjs verify --candidate <dir>/<sha>/candidate.json --receipt <receipt.json>
```

`BOUND` is a custody result only. Receipts carry
`qualification_verdict: NOT_ADJUDICATED`; independent qualification decides.

- Mobile is a viewport emulated on the host machine, not a physical phone.
- Field Core Web Vitals (LCP/CLS/INP): **UNKNOWN**, `pass: false`. Lab frames
  are not field evidence.
- Lab workload only; no production performance claim.
