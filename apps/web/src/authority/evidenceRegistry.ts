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
    claim: "Local compiler latency and network behavior require candidate-bound measurements.",
    dataset: "UNKNOWN",
    baseline: "UNKNOWN",
    metric: "Compilation latency and outgoing request count",
    sampleSize: "UNKNOWN",
    providerVersion: "UNKNOWN",
    date: "UNKNOWN",
    methodology: "Required: bind the exact candidate, workload, environment, raw logs and independent check before promotion.",
    evidenceLinks: [],
    rawResults: "UNKNOWN",
    reproSteps: ["Freeze the candidate and workload.", "Record the environment and raw results.", "Independently reproduce the same workload before promotion."],
    limitations: "The donor record lacked attributable receipts. Historical measurements are archived for custody, not accepted as verified results.",
    status: "provisional",
    lastVerified: "UNKNOWN"
  },
  {
    id: "EV-2026-PRIVACY-02",
    claim: "Workspace privacy and network behavior require candidate-bound traces.",
    dataset: "UNKNOWN",
    baseline: "UNKNOWN",
    metric: "External requests and transmitted bytes for the tested workflow",
    sampleSize: "UNKNOWN",
    providerVersion: "UNKNOWN",
    date: "UNKNOWN",
    methodology: "Required: bind the exact candidate, workload, environment, raw logs and independent check before promotion.",
    evidenceLinks: [],
    rawResults: "UNKNOWN",
    reproSteps: ["Freeze the candidate and workload.", "Record the environment and raw results.", "Independently reproduce the same workload before promotion."],
    limitations: "The donor record lacked attributable receipts. Historical measurements are archived for custody, not accepted as verified results.",
    status: "provisional",
    lastVerified: "UNKNOWN"
  },
  {
    id: "EV-2026-ADAPT-03",
    claim: "Provider format compatibility requires versioned validation receipts.",
    dataset: "UNKNOWN",
    baseline: "UNKNOWN",
    metric: "Schema validation results for the tested provider versions",
    sampleSize: "UNKNOWN",
    providerVersion: "UNKNOWN",
    date: "UNKNOWN",
    methodology: "Required: bind the exact candidate, workload, environment, raw logs and independent check before promotion.",
    evidenceLinks: [],
    rawResults: "UNKNOWN",
    reproSteps: ["Freeze the candidate and workload.", "Record the environment and raw results.", "Independently reproduce the same workload before promotion."],
    limitations: "The donor record lacked attributable receipts. Historical measurements are archived for custody, not accepted as verified results.",
    status: "provisional",
    lastVerified: "UNKNOWN"
  },
];

export const AUTHORITY_DOCUMENTS: AuthorityDocument[] = [
  {
    slug: "local-first-compiler-latency-and-determinism",
    title: "Local-First Compiler Latency and Determinism in Modern Web Runtimes",
    summary: "Qualification plan for local compiler execution, memory bounds and latency. Results remain unknown.",
    docType: "technical_spec",
    schemaType: "TechArticle",
    category: "compiler",
    author: {
      name: "SPE Architecture Group",
      role: "Systems Research",
      url: "https://systempromptengine.com"
    },
    publishedDate: "2026-09-15T00:00:00Z",
    modifiedDate: "2026-09-30T12:00:00Z",
    evidenceRecords: [EVIDENCE_LEDGER[0]],
    sections: [
      {
        heading: "Architecture Overview",
        content: [
          "Local prompt preparation is intended to run on the device. Offline use depends on intact cached assets.",
          "Our WebAssembly pipeline compiles the core parser into a deterministic binary that runs entirely inside the browser's sandbox."
        ]
      },
      {
        heading: "Evaluation Pending",
        content: [
          "Candidate-bound latency measurements have not been supplied for this record.",
          "Memory results remain unknown until the workload, environment and raw logs are bound to the candidate."
        ]
      }
    ]
  },
  {
    slug: "zero-egress-privacy-guarantee-and-verification",
    title: "Workspace Privacy: Verification Plan and Pending Evidence",
    summary: "Qualification plan for workspace privacy and network behavior. Full workflow evidence remains pending.",
    docType: "research_guide",
    schemaType: "Article",
    category: "privacy",
    author: {
      name: "Security & Privacy Working Group",
      role: "Security Audit",
      url: "https://systempromptengine.com"
    },
    publishedDate: "2026-09-20T00:00:00Z",
    modifiedDate: "2026-09-30T12:00:00Z",
    evidenceRecords: [EVIDENCE_LEDGER[1]],
    sections: [
      {
        heading: "The Threat Model",
        content: [
          "Prompt contents frequently contain proprietary code, confidential business requirements, and private communications.",
          "Network and privacy conclusions must identify the tested workflow and its data boundaries."
        ]
      },
      {
        heading: "Audit Protocol",
        content: [
          "The proposed audit combines content policy checks, browser traffic observation and independent network measurement.",
          "Full lifecycle network results remain unknown for this record."
        ]
      }
    ]
  },
  {
    slug: "cross-provider-prompt-adaptation-fidelity",
    title: "Cross-Provider Prompt Adaptation: Syntactic Fidelity and Schema Compliance",
    summary: "Qualification plan for versioned provider formats. Compatibility results remain unknown.",
    docType: "research_guide",
    schemaType: "Article",
    category: "prompt_adaptation",
    author: {
      name: "Prompt Engineering Research Team",
      role: "Format Engineering",
      url: "https://systempromptengine.com"
    },
    publishedDate: "2026-09-25T00:00:00Z",
    modifiedDate: "2026-09-30T12:00:00Z",
    evidenceRecords: [EVIDENCE_LEDGER[2]],
    sections: [
      {
        heading: "The Multi-Model Challenge",
        content: [
          "Provider formats can differ. Format compatibility must be checked against identified provider versions.",
          "Syntax validation alone does not establish model quality or instruction adherence."
        ]
      },
      {
        heading: "Verification Pending",
        content: [
          "Provider validation results remain unknown until attributable test receipts are supplied.",
          "The ledger below records the pending evidence requirements and provisional status."
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
      "url": doc.author.url || "https://systempromptengine.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "System Prompt Engine",
      "url": "https://systempromptengine.com"
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://systempromptengine.com/authority/${doc.slug}`
    }
  };

  if (isTech) {
    baseSchema["proficiencyLevel"] = "Advanced";
    baseSchema["dependencies"] = "WebAssembly, ECMAScript 2022+";
  }

  return baseSchema;
}
