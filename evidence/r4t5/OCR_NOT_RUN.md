# R4 task 5 OCR journey — NOT_RUN

privacy_qualification: HOLD
FIELD_CWV: UNKNOWN
This note is not a privacy qualification, not a field CWV result, and not a product pass.

Recorded: 2026-10-04 11:26 IST
OCR: NOT_RUN
Requests: none
External hosts: none
Raw egress: none

No browser was opened. No server was started. No image was submitted. No OCR engine was created. System tesseract was not invoked.

## Search

Shell tree, read only: `/Volumes/4TB-WD/spe-worktrees/spe-lane-r3-e-shell`
Shell branch: `grok/r3-e-shell-20261003`
Shell HEAD: `ca0abf6d9a71d464369976da35cbabd5de9e7150`
The shell worktree was not edited.

Privacy tree start: `5cbc39026e28679df977b9a8c4ff93f8a9575393`
Privacy branch: `grok/r4-t5-privacy-journeys-20261004`

There is no canonical OCR path a normal user can open.

- Shell public routes are `/`, `/create`, `/code`, `/daily-lab`, `/my-work`, `/privacy`, `/capabilities`, `/workspace`, `/website`, and `/media`. There is no `/ocr` route. This privacy branch has no `/media`, `/website`, or `/ocr` route, and no `MediaRoute.tsx`.
- `apps/web/src/media/ocrLite.ts` `tryTesseractOcr` returns null on both trees. It is not called from any product UI. The function ignores its canvas argument and does not load a WASM OCR pack. A null hook is not an OCR path.
- `detectTextLikeRegions` is horizontal-projection text-likeness (`method: "ocr-textlikeness"`). `imageObserve.ts` says text OCR is not detected in V1. UI observation labels those bands "not OCR-verified". That helper is not OCR and was not run.
- `VisualScreenshotWorkspace` exists only in the shell. Its own test requires it to stay unmounted (`ROUTE_MOUNT_STATUS=NOT_INTEGRATED`). It is not a page a user can open.
- `/media` on the shell mounts `MediaProductPanel` with `pinnedWhisperRuntime` (speech). It does not expose an OCR control.

The previous media log stays frozen evidence and is not relabeled: `evidence/r4t5/MEDIA_ROUTE_NOTE.md`, `evidence/r4t5/media-route-journey.json`. PR #114 was not rewritten.

judgeEgress was not run. Product privacy verdict remains HOLD. FIELD_CWV remains UNKNOWN.
