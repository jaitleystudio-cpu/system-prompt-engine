# Test drift forensics

Frozen product SHA: `e0497f79898689a00a30abeab67652d5f6a9193c`

Files inspected:

- `apps/web/src/lab/DailyLab.tsx`
- `apps/web/src/layout/Nav.tsx`
- `tests/web/test_v1_media_and_lab.py`

## When the copy changed

Commit `1a8ec2e3a9082ea4c211961dd79c1de74e02b02c`

- Date: 2026-09-28 03:54:30 +0000
- Subject: Recover SPE full-site design and plain-English review
- Trailer: `Co-authored-by: Prawin jaitley <jaitleystudio@gmail.com>`

That commit is an ancestor of the frozen SHA. `git log e0497f7 --` those three paths shows `1a8ec2e` as the newest touch. No later commit on the frozen line restored the old strings.

Hunks in `1a8ec2e`:

- `DailyLab.tsx`: kicker `Daily 3D Lab` became `Daily Lab`
- `Nav.tsx`: `{ id: "privacy", label: "Privacy / Proof" }` became `{ id: "privacy", label: "Privacy" }`
- Lab nav label was already `Daily Lab` in that file

The frozen product line after the light-theme closure keeps this wording. The tests at `e0497f7` still asserted the pre-recovery strings. This is test drift, not a product defect.

## RED / GREEN

On the frozen tree, before the test edit:

```
FAILED test_daily_lab_is_premium_3d_with_finite_queue
  tests/web/test_v1_media_and_lab.py:54
  assert 'Daily 3D Lab' in DailyLab.tsx
FAILED test_unified_composer_and_nav_surfaces
  tests/web/test_v1_media_and_lab.py:70
  assert 'Privacy / Proof' in Nav.tsx
2 failed in 0.04s
RED_EXIT:1
```

After editing only `tests/web/test_v1_media_and_lab.py`:

```
2 passed in 0.04s
GREEN_EXIT:0
```

No UI file was modified.

## New contract

Daily Lab still asserts:

- route `lab: "/daily-lab"` and `view === "lab"` rendering `<DailyLab`
- `DAILY_3D_QUEUE` length 14 (`id: "d3d-"` count)
- `DAILY_QUEUE_DAYS`, `publishDate`, `buildPrompt`, `speArtifact`, `interaction`
- local-date determinism (`local-date deterministic`, `diff % DAILY_3D_QUEUE.length`)
- `specimensForDate(new Date(), 3)`, `queueHonestyLine()`, `LabStage`, `spe-lab-3d`, `FINITE_QUEUE`
- visible kicker `className="spe-kicker">Daily Lab<`
- obsolete kicker `Daily 3D Lab` is absent from `DailyLab.tsx`
- gallery file exists and has at least 30 `gal-` entries

Privacy still asserts:

- nav labels Home, Create, Code, Daily Lab, My Work, Capabilities, Privacy
- `{ id: "privacy", label: "Privacy" }` and `pathForView(link.id)`
- obsolete nav string `Privacy / Proof` is absent
- route `privacy: "/privacy"`
- `PrivacyProof` renders, with `Your thinking stays with you`, `spe-privacy-proof`, and `data-copy-depth="PROOF"`
- CTA `Build my prompt` remains

Gallery copy that still says “Daily 3D Lab” was not rewritten. The old failing assertion targeted `DailyLab.tsx` only.
