# Memory

## Map

- `apps/web/src/export/workflowExportViewModel.ts` — updated 2026-09-30. Displays a finished `spe.workflow-export.v1` document. Does not project n8n, Make, or Zapier.
- `apps/web/src/export/WorkflowExportModal.tsx` — updated 2026-09-30. Receipt, copy, and local download for a document G11 already produced.
- `apps/web/src/export/workflowExportFixtures.ts` — created 2026-09-30. Test fixtures captured from G11 `4c916d77`. Not a runtime binding.
- `apps/web/src/export/fixtures/` — created 2026-09-30. The captured G11 documents.
- `apps/web/scripts/test-workflow-export-view.ts` — created 2026-09-30. Refuses unknown, malformed, and secret-bearing documents.

## Log

### 2026-09-30 — A8 displays G11 exports instead of building them
- Why: A8 had a second TypeScript exporter. G11 owns workflow-export semantics.
- Files: `apps/web/src/export/workflowExportViewModel.ts` (created), `apps/web/src/export/WorkflowExportModal.tsx` (updated), `apps/web/src/export/workflowExporters.ts` (removed)
- Left: browser runtime binding to G11 is still not integrated
