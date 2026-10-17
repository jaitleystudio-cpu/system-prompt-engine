# SOURCE TRUNCATION

## Budget

`MAX_URL_BYTES = 200_000` (`apps/web/src/media/limits.ts`)

## Provenance (`SourceBounds`)

On successful HTML/URL ingest:

- `original_size`
- `used_size`
- `truncated`
- `limit`
- `reason` (`url_byte_budget` when truncated)

## Classification

| Slice | Kind | Disclosure |
|---|---|---|
| Response/file byte budget 200k | B — processing bound affecting reconstruction | Notes + UI “Only the first X of Y bytes…” |
| Text excerpts 4000 / 2500 in brief | A — internal preview excerpt after bounded source | Bound already recorded; excerpt is derived |

## Owners

- `urlIngest.readResponseBounded` returns used/hitLimit/reportedLength
- `ingestHtmlFile` / `ingestUrl` attach `sourceBounds`
- `UnifiedComposer` surfaces truncated ok results

## Tests

`url_ingest_reference_only_and_bounds`, `url_source_truncation_disclosed_in_ui` in `test:truth-privacy`.
