# SPE V1 Gap Closure — Defect Repair (PR #43)

**Branch:** `grok/spe-v1-gap-closure-20260925`  
**When:** 2026-09-25 16:20 IST  
**Scope:** Visual / theme defect repair only. Frozen SPE architecture and product plan unchanged.  
**HOSTING:** **FORBIDDEN**  
**Deployment safety gate:** FAIL CLOSED (exit **2**)

No PR #6 merge. No deploy/DNS/host. No `.github/workflows/**`. No `spe_runtime/omega/` edits.

---

## Defects

| # | Defect | Status | Repair |
|---|---|---|---|
| 1 | Hero object must communicate IDEA→MEANING→STRUCTURE→PROMPT process | **DONE** | Kept existing orb. Added `ProcessStream` carriers + stage-tinted radial/rotor rings + input spark / output fragment cluster in `SpeIntelligence.tsx`. HTML pipeline + caption + connector ticks remain; reduced-motion uses static pipeline (no motion). |
| 2 | Light-mode hero headline excessive dark blur | **DONE** | Base `h1` text-shadow removed; dark theme keeps subtle glow only. Light: `text-shadow: none`, solid accent (no soft gradient fill). |
| 3 | Light Daily Lab dark-on-dark info panels | **DONE** | Lab editorial / cards / previews / seed / meta moved onto light theme tokens (`--surface-elevated`, `--paper`, `--muted`, `--seo-border`). 3D stage canvas may stay dark. |
| 4 | Light nav “Build my prompt” CTA contrast | **DONE** | Higher-specificity light rules force inverse fg (`#f4f1ea`) on dark CTA (`#141820`), beating `.spe-nav-links a` specificity. Computed: `rgb(244,241,234)` on `rgb(20,24,32)`. |
| — | Create light token leakage (inspect) | **DONE** | Create rail, composer modes, fields, Context Protocol panel, obs/structure panels on light tokens. No Create redesign. |

---

## Files changed

- `apps/web/src/scene/SpeIntelligence.tsx` — process stream, stage emphasis, I/O markers
- `apps/web/src/index.css` — light contrast tokens, headline shadow, CTA, Lab, Create, pipeline ticks
- `proofs/spe_v1_gap_closure/capture_screens.mjs` — longer WebGL wait; force light on Create/Lab shots
- `proofs/spe_v1_gap_closure/screenshots/*` (+ `screenshots/repair/` copies)
- `proofs/spe_v1_gap_closure/logs/*_repair.txt`
- `proofs/spe_v1_gap_closure/deployment_safety_gate.json` — rerun timestamp
- `proofs/spe_v1_gap_closure/DEFECT_REPAIR_REPORT.md` (this file)

Preserved: Context Protocol behavior, routing, SEO, a11y harness, security headers, WASM, evidence pack, fail-closed deploy gate.

---

## Tests

| Check | Exit | Log |
|---|---|---|
| `apps/web` `npm run build` | 0 | `logs/build_repair.txt` |
| `node scripts/test-theme-routes.mjs` | 0 | `logs/theme_routes_repair.txt` |
| `a11y_verify.mjs` | 0 | `logs/a11y_verify_repair.txt` |
| `npm run test:predeploy-qa` | 0 | `logs/predeploy_qa_repair.txt` |
| `npm run test:engine` | 0 | `logs/test_engine_repair.txt` |
| `tools/copy-check.mjs` | 0 | `logs/copy_check_repair.txt` |
| `tools/deployment-safety-gate.mjs` | **2** | `logs/deployment_gate_repair.txt` (`HOSTING=FORBIDDEN`) |
| `capture_screens.mjs` | 0 | `logs/screenshots_repair.txt` |

---

## Screenshots

- `proofs/spe_v1_gap_closure/screenshots/home-dark.png`
- `proofs/spe_v1_gap_closure/screenshots/home-light.png`
- `proofs/spe_v1_gap_closure/screenshots/theme-control.png`
- `proofs/spe_v1_gap_closure/screenshots/route-create.png`
- `proofs/spe_v1_gap_closure/screenshots/route-daily-lab.png`
- `proofs/spe_v1_gap_closure/screenshots/mobile-home.png`
- Copies under `screenshots/repair/`

---

## Residuals (outside the four defects)

- Still frames understate live WebGL particle motion; process is clearer in motion / after stage changes.
- Lab 3D viewport remains intentionally dark (specimen stage), not an info-panel contrast bug.
- Full axe-core + human SR pass still recommended (unchanged from gap-closure).
