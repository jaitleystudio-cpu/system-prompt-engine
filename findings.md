# Findings: SPE Free 3D Websites Spec v1.1

## Key Discoveries & Invariants

1. **Baseline & Boundary Integrity**:
   - The current branch is `cursor/spe-quality-delta-planb-validate-only-20260929`.
   - Separate R8 defect-repair program is active and must not be disturbed.
   - Cloudflare deployment, main merge, DNS changes, paid spend, and production promotion are strictly disallowed.
   - All tests run locally via Node.js scripts using strict assertions (`node:assert/strict`).

2. **Frontend & Three.js Architecture**:
   - `apps/web/package.json` already contains `@react-three/fiber` (^8.17.10) and `three` (^0.170.0).
   - Single canonical state tree (`WebsiteSpecV2`) must govern both DOM and 3D WebGL scenes.
   - No `eval()` or unvalidated runtime JS is permitted for behaviors, animations, or data transforms.

3. **SEO & AEO Architecture**:
   - Hybrid architecture ensures complete semantic DOM crawlability. Search engines and AI crawlers index `<main>`, `<h1>`-`<h6>`, `<p>`, and schema JSON-LD before or alongside 3D WebGL mount.
   - Core Web Vitals (LCP, CLS, INP) are protected by decoupled canvas initialization and explicit aspect-ratio reservation.

4. **Agent Protocol & Governance**:
   - External agents must never mutate canonical state directly via raw filesystem writes.
   - All operations must flow through typed commands -> schema validation -> capability check -> `SitePatch` proposal -> diff -> apply with `beforeHash` conflict checking.
