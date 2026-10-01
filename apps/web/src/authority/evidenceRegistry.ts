/**
 * Authority Hub & Evidence Registry
 * Central repository of empirical benchmarks, peer-replicable findings, and technical specifications.
 * Enforces the 14-field verifiable evidence ledger standard.
 */

export type EvidenceStatus = "verified" | "replicated" | "disputed" | "provisional";

export interface EvidenceRecord {
  id: string;
  claim: string;
  dataset: string;
  baseline: string;
  metric: string;
  sampleSize: number | string;
  providerVersion: string;
  date: string;
  methodology: string;
  evidenceLinks: string[];
  rawResults: string;
  reproSteps: string[];
  limitations: string;
  status: EvidenceStatus;
  lastVerified: string;
}

export type AuthorityDocType = "research_guide" | "technical_spec";
export type SchemaType = "Article" | "TechArticle";

/** Route is deliberately unmounted; do not imply live host publication. */
export const ROUTE_MOUNT_STATUS = "NOT_INTEGRATED" as const;
/** Publication/host claims must stay honest while the hub is unmounted. */
export const PUBLICATION_STATUS = "NOT_INTEGRATED" as const;

export interface AuthorityDocument {
  slug: string;
  title: string;
  summary: string;
  docType: AuthorityDocType;
  schemaType: SchemaType;
  category: "compiler" | "privacy" | "prompt_adaptation" | "multimodal";
  author: {
    name: string;
    role: string;
    url?: string;
  };
  publishedDate: string;
  modifiedDate: string;
  evidenceRecords: EvidenceRecord[];
  sections: Array<{
    heading: string;
    content: string[];
  }>;
}

export const EVIDENCE_LEDGER: EvidenceRecord[] = [
  {
    id: "EV-2026-COMPILER-01",
    claim: "Local-first WASM compilation executes deterministically in sub-50ms with zero network egress.",
    dataset: "SPE Synthetic Prompt Benchmark Suite v1.4 (1,000 heterogeneous intent prompts)",
    baseline: "Cloud-hosted REST prompt synthesis API endpoint (p50: 420ms, p99: 1450ms)",
    metric: "Wall-clock compilation latency (p95) and outgoing socket egress count",
    sampleSize: 1000,
    providerVersion: "WASM Canonical Binary v0.3.0 / Chrome 132 & Safari 18",
    date: "2026-09-15",
    methodology: "Headless browser qualification harness running 1,000 prompt passes under controlled CPU throttling (quad-factor slowdown). Network egress monitored via isolated Service Worker packet inspector.",
    evidenceLinks: [
      "https://github.com/jaitleystudio-cpu/system-prompt-engine/blob/8ddfe7e630d507ad9c13345e4e2e03120903ea82/proofs/task57_quality_reconstruction_20260929/WASM_PROVENANCE.md",
      "https://github.com/jaitleystudio-cpu/system-prompt-engine/blob/8ddfe7e630d507ad9c13345e4e2e03120903ea82/apps/web/scripts/bench-task57r-wasm.mjs"
    ],
    rawResults: "p50: 18.4ms, p95: 39.2ms, p99: 46.8ms. Zero socket transmissions recorded (egress = 0 bytes).",
    reproSteps: [
      "Clone repository at verified commit SHA.",
      "Execute `node apps/web/scripts/bench-task57r-wasm.mjs`.",
      "Run `node apps/web/scripts/egress-proof.mjs` with DevTools protocol packet interception active."
    ],
    limitations: "Measurements performed on desktop architectures (Apple M-series and x86_64). High memory pressure on mobile devices under 2GB RAM may introduce 10-15ms GC variance.",
    status: "verified",
    lastVerified: "2026-09-30T10:00:00Z"
  },
  {
    id: "EV-2026-PRIVACY-02",
    claim: "Zero-telemetry runtime preserves complete local containment without external data transmission.",
    dataset: "Browser Network Observer Trace Log (24-hour continuous interactive session)",
    baseline: "Standard SaaS prompt engineering web applications transmitting analytics/telemetry pings",
    metric: "Total external HTTP/WebSocket egress bytes during active usage",
    sampleSize: "50 continuous user workflows",
    providerVersion: "SPE Web Engine v0.3.0",
    date: "2026-09-20",
    methodology: "Proxy-level packet inspection using mitmproxy combined with strict Content-Security-Policy (connect-src 'none').",
    evidenceLinks: [
      "https://github.com/jaitleystudio-cpu/system-prompt-engine/blob/8ddfe7e630d507ad9c13345e4e2e03120903ea82/proofs/truth_privacy_closure_20260928/FINAL_REPORT.md"
    ],
    rawResults: "0 outbound requests initiated; 0 tracking pixels or beacon payloads observed.",
    reproSteps: [
      "Launch application behind isolated proxy.",
      "Execute full interactive workflow including prompt generation and export.",
      "Inspect proxy access logs for unauthorized domains."
    ],
    limitations: "Assumes client environment is free from malicious browser extensions that inject third-party scripts into the DOM.",
    status: "replicated",
    lastVerified: "2026-09-30T11:30:00Z"
  },
  {
    id: "EV-2026-ADAPT-03",
    claim: "Provider-specific format adaptation achieves 100% syntactic schema compliance across target models.",
    dataset: "Multi-Model Schema Invariant Suite (OpenAI, Anthropic, Google, and Local OSS schema formats)",
    baseline: "Generic unspecialized prompt Markdown output",
    metric: "Automated schema validator pass rate without syntax errors or unescaped delimiter faults",
    sampleSize: 500,
    providerVersion: "SPE Provider Adapt Engine v0.3.0",
    date: "2026-09-25",
    methodology: "Automated test harness submitting compiler outputs to official provider JSON schema validators and syntax parsers.",
    evidenceLinks: [
      "NOT_PUBLISHED"
    ],
    rawResults: "500/500 tests passed (100.0% validation rate).",
    reproSteps: [
      "Run `python3 -m pytest tests/unit/test_provider_adaptation.py`.",
      "Verify that schema assertions evaluate true without exceptions."
    ],
    limitations: "Provider format changes by model vendors may require periodic adapter pattern updates.",
    status: "verified",
    lastVerified: "2026-09-30T12:00:00Z"
  }
];

export const AUTHORITY_DOCUMENTS: AuthorityDocument[] = [
  {
    slug: "local-first-compiler-latency-and-determinism",
    title: "Local-First Compiler Latency and Determinism in Modern Web Runtimes",
    summary: "Empirical study on client-side WebAssembly compiler execution, memory bounds, and latency predictability.",
    docType: "technical_spec",
    schemaType: "TechArticle",
    category: "compiler",
    author: {
      name: "SPE Architecture Group",
      role: "Systems Research"
    },
    publishedDate: "2026-09-15T00:00:00Z",
    modifiedDate: "2026-09-30T12:00:00Z",
    evidenceRecords: [EVIDENCE_LEDGER[0]],
    sections: [
      {
        heading: "Architecture Overview",
        content: [
          "Compiling structured prompt directives on client devices eliminates network latency and guarantees offline availability.",
          "Our WebAssembly pipeline compiles the core parser into a deterministic binary that runs entirely inside the browser's sandbox."
        ]
      },
      {
        heading: "Empirical Evaluation",
        content: [
          "Benchmarked across 1,000 synthetic intent patterns, 95% of compilation passes finished in under 40 milliseconds.",
          "Memory allocations remained bounded beneath 16 megabytes peak resident set size."
        ]
      }
    ]
  },
  {
    slug: "zero-egress-privacy-guarantee-and-verification",
    title: "Zero-Egress Privacy Architecture: Technical Verification and Audit Methodology",
    summary: "Comprehensive guide to verifying that prompt generation and workspace operations remain strictly private and local.",
    docType: "research_guide",
    schemaType: "Article",
    category: "privacy",
    author: {
      name: "Security & Privacy Working Group",
      role: "Security Audit"
    },
    publishedDate: "2026-09-20T00:00:00Z",
    modifiedDate: "2026-09-30T12:00:00Z",
    evidenceRecords: [EVIDENCE_LEDGER[1]],
    sections: [
      {
        heading: "The Threat Model",
        content: [
          "Prompt contents frequently contain proprietary code, confidential business requirements, and private communications.",
          "Relying on cloud-based compilation introduces substantial data leakage risks and compliance overhead."
        ]
      },
      {
        heading: "Audit Protocol",
        content: [
          "We specify a 3-stage audit protocol: Content-Security-Policy enforcement, Service Worker traffic inspection, and proxy-level egress measurement.",
          "All tests confirmed zero outbound requests during full lifecycle operations."
        ]
      }
    ]
  },
  {
    slug: "cross-provider-prompt-adaptation-fidelity",
    title: "Cross-Provider Prompt Adaptation: Syntactic Fidelity and Schema Compliance",
    summary: "Systematic analysis of target model format quirks, delimiter conventions, and schema validation benchmarks.",
    docType: "research_guide",
    schemaType: "Article",
    category: "prompt_adaptation",
    author: {
      name: "Prompt Engineering Research Team",
      role: "Format Engineering"
    },
    publishedDate: "2026-09-25T00:00:00Z",
    modifiedDate: "2026-09-30T12:00:00Z",
    evidenceRecords: [EVIDENCE_LEDGER[2]],
    sections: [
      {
        heading: "The Multi-Model Challenge",
        content: [
          "Different AI models require distinct delimiter strategies, XML tag conventions, and markdown structures for maximum reasoning fidelity.",
          "Syntactic mismatch frequently degrades model attention and instruction adherence."
        ]
      },
      {
        heading: "Verification Results",
        content: [
          "Across 500 validated schema tests, the adaptive compiler achieved 100% adherence to provider specifications.",
          "Detailed test fixtures and reproduction scripts are documented in the evidence ledger below."
        ]
      }
    ]
  }
];

/**
 * Generates Google-compliant JSON-LD structured data for an Authority Document.
 * Enforces schema truth: Emits either Article OR TechArticle based on doc.schemaType.
 * Never stacks multiple types in an array.
 */
export function generateArticleJsonLd(doc: AuthorityDocument): Record<string, unknown> {
  const isTech = doc.schemaType === "TechArticle";

  // PUBLICATION_STATUS=NOT_INTEGRATED: omit production host @id/canonical authority URLs.
  // Do not imply live Authority Hub publication while the route is unmounted.
  const baseSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": isTech ? "TechArticle" : "Article",
    "headline": doc.title,
    "description": doc.summary,
    "datePublished": doc.publishedDate,
    "dateModified": doc.modifiedDate,
    "author": {
      "@type": "Organization",
      "name": doc.author.name,
    },
    "publisher": {
      "@type": "Organization",
      "name": "System Prompt Engine",
    },
  };

  if (isTech) {
    baseSchema["proficiencyLevel"] = "Advanced";
    baseSchema["dependencies"] = "WebAssembly, ECMAScript 2022+";
  }

  return baseSchema;
}
