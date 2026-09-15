# Sprint 6 Plan — Web + PWA Foundation

Branch: `feat/web-pwa-foundation-s6` from qualified `main` after PR #5 merge.

1. RED pytest contracts under `tests/web/` (this plan).
2. Scaffold `apps/web` Vite+React+TS if no frontend exists.
3. Copy actual `spe-wasm` release artifact into `apps/web/public/`.
4. Implement wasm-host + worker: integrity, zero imports, `spe_evaluate`.
5. UI: tokens, composer, phases, result panels, privacy, trust, copy.
6. PWA manifest + SW.
7. Scripts: copy-wasm, eval-fixture, dep audit, asset budget, egress proof.
8. GREEN proofs. Open PR. Do not merge. Do not start Sprint 7 / 3D / native / extensions.
