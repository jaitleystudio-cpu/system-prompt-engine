# SPE Ω — Programmatic Evidence SEO Strategy

**Document Version:** `1.0.0`  
**Compliance Standard:** Google Search Essentials (Anti-Scaled Content Abuse)  
**Distribution Engine:** Original Product Data ➔ Public Evidence Pages ➔ Citations & Backlinks ➔ Acquisition

---

## 1. Executive Strategy & Philosophy
SEO for SPE Ω is not a generic content farm or blog-spinning engine. Scaled-content abuse guidelines explicitly penalize low-quality, programmatic text created solely for search engine rankings without primary utility.

SPE's SEO architecture is **purely evidence-driven**:
1. The SPE engine generates original, empirical benchmark data, model passports, and failure taxonomy analyses.
2. This verified data is rendered as rich, crawlable, static HTML evidence pages.
3. Developers, researchers, and enterprise architects cite and link to these pages as technical references.
4. Traffic converts into local CLI adoption (`spe adopt .`) and enterprise assurance subscriptions.

---

## 2. Six-Tier Architecture

| Tier | Surface Category | Target Path Examples | Primary User Value |
| :--- | :--- | :--- | :--- |
| **Tier A** | **Category Ownership Pages** | `/ai-instruction-assurance`<br>`/prompt-compiler`<br>`/mcp-security`<br>`/model-drift-monitoring` | In-depth technical guides with interactive client-side WASM demos and formal specifications. |
| **Tier B** | **Free Acquisition Tools** | `/tools/system-prompt-generator`<br>`/tools/audio-to-text`<br>`/tools/video-to-text`<br>`/tools/free-3d-website-builder`<br>`/tools/screenshot-to-code` | High-utility, zero-signup web applications with 100% client-side privacy. |
| **Tier C** | **Empirical Evidence Pages** | `/models/openai/gpt-4o`<br>`/models/anthropic/claude-3-7-sonnet`<br>`/failure-genome/SPE-FG-2026-000001`<br>`/benchmarks/json-conformance` | Observed model behavior data, latency/cost measurements, and public sanitized failure analyses. |
| **Tier D** | **Integration Documentation** | `/integrations/openai`<br>`/integrations/anthropic`<br>`/integrations/ollama`<br>`/integrations/vllm`<br>`/integrations/github-actions` | Copy-paste production code samples, installation guides, and CI configuration templates. |
| **Tier E** | **Migration & Comparison Hubs** | `/compare/spe-vs-promptfoo`<br>`/compare/spe-vs-langfuse`<br>`/migrate/from-raw-prompts`<br>`/migrate/from-promptfoo` | Objective, evidence-backed feature matrices and automated migration scripts (`spe adopt`). |
| **Tier F** | **.spe Package Registry Pages** | `/packages/@spe/finance-fraud-analyst`<br>`/packages/@spe/customer-support-guard` | Reusable instruction packages with cryptographic verification badges and model passports. |

---

## 3. Technical SEO Invariants
- **Crawlable Static HTML:** Public pages pre-render semantic markup, OpenGraph tags, and JSON-LD schema before hydration.
- **Strict Canonical Tagging:** One unique canonical URL per page; prevent parameter collisions.
- **Sitemap & Robots Separation:** Public acquisition surfaces indexed in `/sitemap.xml`; private user workspace routes explicitly excluded via `robots.txt` (`Disallow: /app/`, `Disallow: /workspace/`).
- **Core Web Vitals Performance Targets:**
  - Largest Contentful Paint (LCP): `≤ 2.5s` at p75
  - Interaction to Next Paint (INP): `≤ 200ms` at p75
  - Cumulative Layout Shift (CLS): `≤ 0.1` at p75
