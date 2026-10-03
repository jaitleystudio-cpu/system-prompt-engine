# R3-G privacy and performance HOLD

git_head_at_run: `10bc4a77491fa1b3af0da90df67c1f6c23b38b71`
device: Apple M2, 8 GiB, macOS 27.2
browser: Google Chrome 154.0.8037.97; playwright channel=chrome 154.0.8037.97
flows_executed: prompt, local_storage
flows_not_executed: transcript, image, audio, video, ocr, website, code, document
raw_user_data_egress: false
privacy_qualification: HOLD
FIELD_CWV: UNKNOWN

Executed flows are prompt compile and local history only. QUALIFICATION stays HOLD because transcript, image, audio, video, OCR, website, code, and document were not executed. A missing WASM result is not a pass. Lab medians are not field CWV.

PR #107 crawl-document measurer was not ported: `apps/web/src/search/foundation.mjs` is absent on this ancestry. Perf ideas that were ported: unpublished CWV stays UNKNOWN, and lab cold/warm median/p95 are recorded separately from field CWV.

WASM file sha256 remains `a2a2041b0c2b485b5e61347d6e2f13ce613f3a25c1e2dcccc0e178a7aad347bf`. Release pin `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` is not a file in this tree and was not written.

No product shell, Nav, media engine, scholarly adapter, or .spe file was edited.
