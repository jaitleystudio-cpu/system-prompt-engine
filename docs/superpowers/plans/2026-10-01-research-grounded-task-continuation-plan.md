# SPE — Research-Grounded Task Continuation Implementation Plan

## Waves & Deliverables
1. **Wave RT-A (Contracts & Report Verification)**:
   - Versioned JSON Schema (`schemas/task_continuation.schema.json`).
   - TypeScript contract types (`apps/web/src/engine/continuation/types.ts`).
   - Report verifier (`apps/web/src/engine/continuation/reportVerifier.ts`) with exact candidate binding, proof receipt verification, fake pass detection, and material coverage tracking.
2. **Wave RT-B (Real Research Acquisition & Verification)**:
   - Research fabric (`apps/web/src/engine/continuation/researchFabric.ts`) with ContextNeed evaluation, ResearchConsent enforcement, OpenAlex/Crossref/arXiv/PMC/RFC spec adapters, retraction checks, and prompt injection defense.
3. **Wave RT-C (Claim / Evidence Intelligence)**:
   - Evidence graph (`apps/web/src/engine/continuation/evidenceGraph.ts`) with DAG claim-evidence edges, Contradiction Map, and Gap Map.
4. **Wave RT-D (Continuation Contract & Model Compilation)**:
   - Continuation compiler (`apps/web/src/engine/continuation/continuationCompiler.ts`) producing canonical ContinuationIR and calibrated exports for Claude Code, Codex, Cursor, Grok, Local Coder, and Generic agents.
5. **Wave RT-E (Gilden Boundary & Governance)**:
   - Gilden boundary controller (`apps/web/src/engine/continuation/gildenBoundary.ts`) enforcing ADVISORY_ONLY authority, zero privilege escalation, and bounded repair loop termination (cycles <= 3).
6. **Verification & Adversarial Matrix**:
   - Comprehensive test suite in `tests/test_task_continuation_engine.mjs` killing all safety mutants.
