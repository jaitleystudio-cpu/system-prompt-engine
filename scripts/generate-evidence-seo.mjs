#!/usr/bin/env node
/**
 * SPE Ω — Programmatic Evidence SEO & Static Crawl-Tree Generator
 * 
 * Generates pre-rendered, crawl-safe semantic HTML pages, sitemap.xml,
 * and robots.txt for public search engines (Googlebot, Bingbot, etc.),
 * keeping the private WebAssembly SPA completely distinct and non-indexed.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../apps/web/public');

const CANONICAL_DOMAIN = 'https://systempromptengine.com';

const ROUTES = [
  // Root and Primary Surfaces
  { path: '/', title: 'System Prompt Engine (SPE Ω) — AI Instruction Assurance Control Plane', desc: 'The open, portable, evidence-backed control plane for AI instructions. Formally specify, compile, test, version, and govern AI prompts.' },
  { path: '/capabilities', title: 'Full System Capabilities & Evaluation Atlas | SPE Ω', desc: 'Comprehensive catalog of formal prompt compiler capabilities, execution contracts, and provider profiles. Output correctness is not proven; bounded rule consistency is verified.' },
  { path: '/privacy', title: 'Zero-Egress Privacy & Cryptographic Integrity | SPE Ω', desc: '100% air-gapped execution verification with local WASM compilation and zero network telemetry.' },

  // Tier A: Category Ownership
  { path: '/ai-instruction-assurance', title: 'AI Instruction Assurance Control Plane | SPE Ω', desc: 'Formally verify, compile, and govern AI system prompts and agent instructions before deployment.' },
  { path: '/ai-instruction-compiler', title: 'AI Instruction Compiler & Prompt IR | SPE Ω', desc: 'Zero-latency PagedAttention KV-cache alignment and multi-model transcompilation.' },
  { path: '/prompt-compiler', title: 'Formal AI Prompt Compiler & ABI | SPE Ω', desc: 'Lower abstract prompt requirements into hardened, provider-specific instructions.' },
  { path: '/prompt-security', title: 'AI Prompt Security & Adversarial Red-Teaming | SPE Ω', desc: '1,024 combinatorial hostile attacks and automated invariant protection.' },
  { path: '/ai-agent-security', title: 'AI Agent Security & Capability Firewall | SPE Ω', desc: 'Out-of-band authority control preventing unauthorized real-world AI actions.' },
  { path: '/mcp-security', title: 'Model Context Protocol (MCP) Security Gateway | SPE Ω', desc: 'Zero-trust capability proxy for MCP servers, tools, and autonomous agent delegations.' },
  { path: '/model-drift-monitoring', title: 'Empirical Model Drift Sentinel & Passports | SPE Ω', desc: 'Continuous observed behavioral testing separating empirical reality from marketing claims.' },
  { path: '/ai-governance-evidence', title: 'AI Governance Evidence Pack (EU AI Act & ISO 42001) | SPE Ω', desc: 'Automated SBOM, human oversight evidence, and regulatory audit mapping.' },

  // Tier B: Free Acquisition Tools
  { path: '/tools/system-prompt-generator', title: 'Free Air-Gapped System Prompt Generator | SPE', desc: 'Generate production-ready system prompts with built-in boundary protection.' },
  { path: '/tools/free-3d-website-builder', title: 'Free AI 3D Website Studio | SPE', desc: 'Zero-dependency WebGL Three.js interactive 3D website builder.' },
  { path: '/tools/audio-to-text', title: 'Private Local Audio to Text Transcriber | SPE', desc: '100% offline, in-browser speech recognition with zero network egress.' },
  { path: '/tools/video-to-text', title: 'Local Video Keyframe & Audio Transcriber | SPE', desc: 'Transcribe video files locally without cloud uploads.' },
  { path: '/tools/screenshot-to-code', title: 'Neural Screenshot to Code Compiler | SPE', desc: 'Inverse-compile UI screenshots into clean TypeScript and Tailwind components.' },

  // Tier C: Evidence Pages (Model Passports & Failure Genome)
  { path: '/models/openai/gpt-4o', title: 'OpenAI GPT-4o Empirical Model Passport | SPE Atlas', desc: 'Verified structured output conformance, latency percentiles, and constraint retention.' },
  { path: '/models/anthropic/claude-3-7-sonnet', title: 'Anthropic Claude 3.7 Sonnet Model Passport | SPE Atlas', desc: 'Empirically measured prompt caching behavior, reasoning token drift, and jailbreak resilience.' },
  { path: '/failure-genome/SPE-FG-2026-000001', title: 'SPE-FG-2026-000001: Indirect Prompt Injection Case Study | SPE Genome', desc: 'Sanitized failure case, delta-debugged minimal reproducer, and verified candidate repair.' },

  // Tier D: Integrations
  { path: '/integrations/openai', title: 'OpenAI SDK Prompt Assurance Integration | SPE', desc: 'Embed formal instruction guarantees into standard OpenAI API workflows.' },
  { path: '/integrations/anthropic', title: 'Anthropic Claude Prompt Caching Integration | SPE', desc: 'Align prefix boundaries for maximum prompt cache efficiency.' },
  { path: '/integrations/mcp', title: 'Model Context Protocol (MCP) Tool Integration | SPE', desc: 'Enforce capability grants across MCP servers and tools.' },
  { path: '/integrations/github-actions', title: 'SPE GitHub Action CI Evidence Gate | SPE', desc: 'Block prompt regressions in pull requests with Ed25519-signed evidence receipts.' },

  // Tier E: Migration & Comparison
  { path: '/compare/spe-vs-promptfoo', title: 'SPE vs Promptfoo: Architecture Comparison | SPE', desc: 'Compare compile-time formal assurance against runtime test scanning.' },
  { path: '/migrate/from-raw-prompts', title: 'Migrate from Raw Prompts to .spe Packages | SPE', desc: 'Adopt existing prompt strings into versioned, testable, portable .spe artifacts.' }
];

function generateHtmlPage(route) {
  const jsonLd = route.path === '/capabilities' ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Does SPE send prompts or data to external servers?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. SPE executes 100% locally with WebAssembly and zero network egress."
        }
      },
      {
        "@type": "Question",
        "name": "Is AI correctness mathematically proven?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. Output correctness is not proven; bounded rule consistency and constraint satisfaction are verified deterministically."
        }
      }
    ]
  } : {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "System Prompt Engine (SPE Ω)",
    "operatingSystem": "All",
    "applicationCategory": "DeveloperApplication",
    "offers": {
      "@type": "Offer",
      "price": "0.00",
      "priceCurrency": "USD"
    },
    "description": route.desc,
    "url": `${CANONICAL_DOMAIN}${route.path}`
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${route.title}</title>
  <meta name="description" content="${route.desc}">
  <link rel="canonical" href="${CANONICAL_DOMAIN}${route.path}">
  <meta property="og:title" content="${route.title}">
  <meta property="og:description" content="${route.desc}">
  <meta property="og:url" content="${CANONICAL_DOMAIN}${route.path}">
  <meta property="og:type" content="website">
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #07090e; color: #e2e8f0; margin: 0; padding: 40px 20px; line-height: 1.6; }
    .container { max-width: 840px; margin: 0 auto; }
    header { border-bottom: 1px solid #1e293b; padding-bottom: 24px; margin-bottom: 32px; }
    h1 { font-size: 28px; color: #f8fafc; margin: 0 0 12px 0; }
    p.lead { font-size: 16px; color: #94a3b8; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; background: #0f172a; border: 1px solid #334155; color: #38bdf8; margin-bottom: 16px; }
    .box { background: #0d121d; border: 1px solid #1e293b; border-radius: 8px; padding: 24px; margin: 24px 0; }
    pre { background: #04060a; padding: 16px; border-radius: 6px; overflow-x: auto; color: #38bdf8; font-size: 13px; }
    a { color: #38bdf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    nav.breadcrumbs { font-size: 12px; color: #64748b; margin-bottom: 16px; }
    footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <nav class="breadcrumbs">
      <a href="/">Home</a> &gt; <span>${route.path === '/' ? 'Home' : route.path.slice(1)}</span>
    </nav>
    <header>
      <span class="badge">EVIDENCE-BACKED CONTROL PLANE</span>
      <h1>${route.title.split('|')[0].trim()}</h1>
      <p class="lead">${route.desc}</p>
    </header>

    <main>
      <div class="box">
        <h2>Architecture & Evidence</h2>
        <p>SPE Ω compiles, tests, and verifies AI instructions under 100% air-gapped execution (<code>connect-src 'self'</code>) with zero external network egress.</p>
        <ul>
          <li><strong>Cryptographic Receipt:</strong> RFC 8785 JSON Canonicalization + SHA-256 + Ed25519 signature.</li>
          <li><strong>Formal Verification:</strong> Bounded rule consistency analysis detecting paradoxical directives.</li>
          <li><strong>Inference Economics:</strong> Speculative KV-cache page boundary alignment for vLLM, SGLang, and Anthropic prompt caching.</li>
        </ul>
      </div>

      <div class="box">
        <h2>Developer CLI Adoption</h2>
        <pre>$ npx spe adopt .
$ npx spe check system_prompt.md --strict</pre>
      </div>
    </main>

    <footer>
      <p>&copy; 2026 System Prompt Engine (SPE Ω). 100% Local-First & Air-Gapped AI Instruction Assurance.</p>
      <p><a href="/sitemap.xml">XML Sitemap</a> | <a href="/robots.txt">robots.txt</a></p>
    </footer>
  </div>
</body>
</html>
`;
}

// 1. Write HTML pages
const pagesDir = resolve(publicDir, 'evidence-pages');
mkdirSync(pagesDir, { recursive: true });

for (const r of ROUTES) {
  const safeName = (r.path === '/' ? 'index' : r.path.slice(1).replace(/\//g, '_')) + '.html';
  const outPath = resolve(pagesDir, safeName);
  writeFileSync(outPath, generateHtmlPage(r), 'utf8');
}

// 2. Write sitemap.xml
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ROUTES.map(r => `  <url>
    <loc>${CANONICAL_DOMAIN}${r.path}</loc>
    <lastmod>2026-10-08</lastmod>
    <changefreq>daily</changefreq>
    <priority>${r.path === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(resolve(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');

// 3. Write robots.txt
const robotsTxt = `# robots.txt for SPE Ω Public Evidence Engine
User-agent: *
Allow: /
Allow: /capabilities
Allow: /privacy
Allow: /evidence-pages/
Allow: /models/
Allow: /failure-genome/
Allow: /tools/
Allow: /integrations/
Allow: /compare/
Allow: /migrate/
Disallow: /workspace
Disallow: /studio
Disallow: /private/
Disallow: /api/

Sitemap: ${CANONICAL_DOMAIN}/sitemap.xml
`;
writeFileSync(resolve(publicDir, 'robots.txt'), robotsTxt, 'utf8');

// 4. Update _redirects with explicit evidence page mappings
const redirectRules = [
  '# Evidence SEO Static Pre-Rendered Pages (200 rewrite for crawlers)',
  ...ROUTES.filter(r => r.path !== '/').map(r => {
    const safeName = r.path.slice(1).replace(/\//g, '_') + '.html';
    return `${r.path}  /evidence-pages/${safeName}  200`;
  }),
  '',
  '# Static binary model and asset preserves',
  '/models/*  /models/:splat  200',
  '/ort/*     /ort/:splat     200',
  '/assets/*  /assets/:splat  200',
  '/*         /index.html     200',
  ''
].join('\n');
writeFileSync(resolve(publicDir, '_redirects'), redirectRules, 'utf8');

console.log(`✅ Generated ${ROUTES.length} static SEO evidence pages, sitemap.xml, robots.txt, and _redirects in ${publicDir}`);
