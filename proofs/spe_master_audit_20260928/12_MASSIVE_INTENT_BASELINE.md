# Massive Intent baseline

MASSIVE_INTENT_STATUS: PARTIAL_FOUNDATION
The product was not changed. The probe script lived in `/tmp` and is not committed.

## Caps in source

- Home idea: `maxLength={20000}` in `apps/web/src/landing/Hero.tsx`.
- Desired Output and Example: `maxLength={12000}` in `UnifiedComposer.tsx`.
- Create idea textarea: no `maxLength`.
- `evaluate_json_str` rejects malformed JSON. No length cap was found there.
- URL bytes 200000. HTML file path slices to that budget. Prompt excerpt slices to about 2500 characters and is labeled Excerpt.
- History preview slices to 240 characters.
- Compile worker timeout is 20s in `engine/client.ts`.

## Chromium lab at http://127.0.0.1:4194

| Surface | Requested characters | Stored | Accepted |
| --- | --- | --- | --- |
| Home | 20000 | 20000 | yes |
| Home | 20001, 100000, 250000, 500000, 1000000 | 20000 | no (attribute cap) |
| Create idea | 20000, 100000, 250000, 500000, 1000000 | full requested length | yes |

Home 20000 compile: Ready to use, 883 ms, output 23458 characters, tail present, value still 20000.
Create compile: not measured. Selector `.compile-status, [role=status]` is not on `/create`.

## Architecture absent

No streamed ingestion, source chunking, incremental counter, OPFS, IndexedDB, virtualized preview, provider-context packing, or preservation of non-selected source.

SILENT TRUNCATION: YES for Home overflow (dropped with no in-product notice) and for URL/HTML excerpt slices. NO on the Create idea field through 1,000,000 characters.
SOURCE PRESERVATION: React textarea state only.

RECOMMENDED TIMING: LAUNCH_PLUS_1
Do not block a local-core launch on a million-word architecture. Do not claim these sizes on the site.
