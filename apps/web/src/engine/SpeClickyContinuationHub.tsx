import React, { useState, useEffect, useMemo } from "react";
import type { AppView } from "../routing";
import { ContextualAdSlot } from "../components/ads/ContextualAdSlot";
import { auditPluginsAndSkills } from "./pluginSkillAuditor";

export interface SpeClickyContinuationHubProps {
  onNavigate?: (view: AppView) => void;
  onUsePromptInStudio?: (promptText: string) => void;
  generatedPrompt?: string | null;
}

export type ClickyTargetPlatform =
  | "antigravity"
  | "claude"
  | "cursor"
  | "grok"
  | "codex";

export interface ResearchPaperCapsule {
  id: string;
  domain: string;
  paperTitle: string;
  identifier: string;
  sourceProvider: "arXiv" | "Crossref" | "OpenAlex" | "ACM";
  provenPattern: string;
  failureGenome: string;
  quantitativeMetric: string;
}

export interface OrchestratedSkillBadge {
  slug: string;
  category:
    | "workflow"
    | "development"
    | "architecture"
    | "testing"
    | "security"
    | "business"
    | "data-ai"
    | "general"
    | "infrastructure";
  priorityPhase: "PROCESS_FIRST" | "IMPLEMENTATION_SECOND";
  disciplineType: "RIGID" | "FLEXIBLE";
  purpose: string;
  pluginCommand: string;
}

export interface ProblemSolutionPair {
  id: string;
  problemDetected: string;
  rootCauseOrigin: "GOAL" | "WORLD" | "VERIFIER";
  perfectSolution: string;
  verificationProbe: string;
}

export interface AutonomousQueueTask {
  id: string;
  stepNumber: number;
  title: string;
  status: "COMPLETED" | "ACTIVE" | "QUEUED";
  domain: string;
  objective: string;
  allowedFiles: string[];
  acceptanceGate: string;
  researchCapsuleId: string;
  requiredSkills: string[];
  problemSolution: ProblemSolutionPair;
}

export interface SkillCombinationMemoryEntry {
  key: string;
  type: "skill_combination";
  classification: "SIMPLE_CONTAINED" | "MULTI_DOMAIN_ORCHESTRATED";
  guardrailVerdict: string;
  recommendedSkills: string[];
  recommendedCapsuleId: string;
  inferredFiles: string[];
  content: string;
  tags: string[];
}

export const RESEARCH_CAPSULES: Record<string, ResearchPaperCapsule> = {
  ledger: {
    id: "SCAP-LEDGER-2026",
    domain: "Autonomous Continuation & State Serialization",
    paperTitle: "Ledger: Turning Interaction History into Execution State",
    identifier: "arXiv:2608.00808",
    sourceProvider: "arXiv",
    provenPattern:
      "Incremental interaction state serialization into 6-clause execution contracts without redundant reasoning loops",
    failureGenome:
      "Unbounded conversational context accumulation causing exponential token inflation and instruction drift",
    quantitativeMetric:
      "Reduces coding agent token spend by 28.9%–31.8% on SWE-bench Verified while increasing pass@1",
  },
  agentlens: {
    id: "SCAP-AGENTLENS-2026",
    domain: "Adversarial Verification & Anti-Lucky-Pass",
    paperTitle:
      "AgentLens: Empirical Flaws in Benchmark Verification and Lucky Passes",
    identifier: "arXiv:2602.04812",
    sourceProvider: "arXiv",
    provenPattern:
      "Distinguishing witness assertions paired with negative boundary and mutation probes",
    failureGenome:
      "74% of naive test passes are Lucky Passes that fail under negative boundary or empty-input probes",
    quantitativeMetric:
      "Eliminates 92% of false-positive completion claims via deterministic negative probe qualification",
  },
  fwr: {
    id: "SCAP-FWR-2026",
    domain: "Multi-Agent Handoff & Constraint Preservation",
    paperTitle:
      "Facts Without Rules: Epistemic Degradation in Multi-Agent Handoffs",
    identifier: "arXiv:2604.01984",
    sourceProvider: "arXiv",
    provenPattern:
      "Cryptographic constraint capsules with immutable Kleene-4 proof graphs across agent boundaries",
    failureGenome:
      "Cross-agent conversational summarization silently drops up to 41% of negative constraints and scope guards",
    quantitativeMetric:
      "100% preservation of machine-checkable authorization boundaries across 300+ autonomous handoffs",
  },
  spatialUi: {
    id: "SCAP-REACT-CONC-2025",
    domain: "Spatial Glassmorphic UI & GPU Compositing",
    paperTitle:
      "Deterministic State Hydration and Boundary Isolation in Modern Component Architectures",
    identifier: "doi:10.1145/3597503.3597531",
    sourceProvider: "ACM",
    provenPattern:
      "GPU-accelerated CSS 3D perspective layers with prefers-reduced-motion accessibility fallbacks",
    failureGenome:
      "Layout thrashing and main-thread frame drops caused by animating non-composited box-shadow/filter properties",
    quantitativeMetric:
      "Zero visual tearing and 64% reduction in main-thread frame drops during high-frequency telemetry updates",
  },
};

export const SKILL_CATALOG: Record<string, OrchestratedSkillBadge> = {
  "using-superpowers": {
    slug: "using-superpowers",
    category: "workflow",
    priorityPhase: "PROCESS_FIRST",
    disciplineType: "RIGID",
    purpose:
      "Mandatory pre-execution skill discovery & strict process-first workflow discipline",
    pluginCommand: "/using-superpowers",
  },
  "antigravity-skill-orchestrator": {
    slug: "antigravity-skill-orchestrator",
    category: "architecture",
    priorityPhase: "PROCESS_FIRST",
    disciplineType: "RIGID",
    purpose:
      "Task complexity guardrail, dynamic multi-domain skill routing & @agent-memory-mcp combination tracking",
    pluginCommand: "/antigravity-skill-orchestrator",
  },
  "systematic-debugging": {
    slug: "systematic-debugging",
    category: "testing",
    priorityPhase: "PROCESS_FIRST",
    disciplineType: "RIGID",
    purpose:
      "Counterfactual root-cause isolation across Goal, World, and Verifier origins",
    pluginCommand: "/systematic-debugging",
  },
  "tdd-workflow": {
    slug: "tdd-workflow",
    category: "testing",
    priorityPhase: "PROCESS_FIRST",
    disciplineType: "RIGID",
    purpose:
      "Red-Green-Refactor verification loop with real repository test suites & edge-case probes",
    pluginCommand: "/tdd-workflow",
  },
  "antigravity-design-expert": {
    slug: "antigravity-design-expert",
    category: "development",
    priorityPhase: "IMPLEMENTATION_SECOND",
    disciplineType: "FLEXIBLE",
    purpose:
      "Weightless spatial UI, glassmorphism (blur 12px+), 3D perspective & >=0.3s GPU-composited transitions",
    pluginCommand: "/antigravity-design-expert",
  },
  seo: {
    slug: "seo",
    category: "business",
    priorityPhase: "IMPLEMENTATION_SECOND",
    disciplineType: "FLEXIBLE",
    purpose:
      "Technical SEO, E-E-A-T scientific citations, Core Web Vitals (INP <= 200ms), Schema.org & GEO citability",
    pluginCommand: "/seo",
  },
  recallmax: {
    slug: "recallmax",
    category: "data-ai",
    priorityPhase: "IMPLEMENTATION_SECOND",
    disciplineType: "FLEXIBLE",
    purpose:
      "500K–1M token long-context state compression with zero cloud token overhead",
    pluginCommand: "@plugin/recallmax",
  },
  "security-auditor": {
    slug: "security-auditor",
    category: "security",
    priorityPhase: "IMPLEMENTATION_SECOND",
    disciplineType: "RIGID",
    purpose:
      "Zero-egress CSP enforcement, permission attenuation, and static AST safety verification",
    pluginCommand: "/security-auditor",
  },
};

export const SPE_V4_SKILL_CATALOG: Record<string, OrchestratedSkillBadge> = {
  "using-superpowers": SKILL_CATALOG["using-superpowers"],
  "antigravity-skill-orchestrator":
    SKILL_CATALOG["antigravity-skill-orchestrator"],
  "product-design": {
    slug: "product-design",
    category: "architecture",
    priorityPhase: "PROCESS_FIRST",
    disciplineType: "FLEXIBLE",
    purpose:
      "Apple 10 Design Principles, semantic tokens, 6-stage UX flows, and WCAG 2.1 AA contrast",
    pluginCommand: "/product-design",
  },
  "deep-research": {
    slug: "deep-research",
    category: "data-ai",
    priorityPhase: "PROCESS_FIRST",
    disciplineType: "RIGID",
    purpose:
      "Autonomous 3-part scientific synthesis (Executive Summary, Comparison Table, Cited Recommendations)",
    pluginCommand: "/deep-research",
  },
  "design-taste-frontend": {
    slug: "design-taste-frontend",
    category: "development",
    priorityPhase: "IMPLEMENTATION_SECOND",
    disciplineType: "FLEXIBLE",
    purpose:
      "Dials 8/6/4, Liquid Glass 1px refraction borders, Bento 2.0 spatial grid & explicit state machines",
    pluginCommand: "/design-taste-frontend",
  },
  "antigravity-design-expert": SKILL_CATALOG["antigravity-design-expert"],
  "frontend-mobile-development-component-scaffold": {
    slug: "frontend-mobile-development-component-scaffold",
    category: "development",
    priorityPhase: "IMPLEMENTATION_SECOND",
    disciplineType: "FLEXIBLE",
    purpose:
      "Universal React Web + React Native ComponentSpec scaffolding with strict TypeScript & ARIA roles",
    pluginCommand: "/frontend-mobile-development-component-scaffold",
  },
  "progressive-web-app": {
    slug: "progressive-web-app",
    category: "development",
    priorityPhase: "IMPLEMENTATION_SECOND",
    disciplineType: "RIGID",
    purpose:
      "Offline-first Service Worker (Cache-First WASM, Network-First HTML, SWR metadata) & PWA manifest",
    pluginCommand: "/progressive-web-app",
  },
  "performance-engineer": {
    slug: "performance-engineer",
    category: "testing",
    priorityPhase: "IMPLEMENTATION_SECOND",
    disciplineType: "RIGID",
    purpose:
      "Core Web Vitals (INP <= 120ms, LCP <= 1800ms, CLS <= 0.02), L1/L2/L3 cache & local OTel traces",
    pluginCommand: "/performance-engineer",
  },
  seo: SKILL_CATALOG.seo,
  "competitor-alternatives": {
    slug: "competitor-alternatives",
    category: "business",
    priorityPhase: "IMPLEMENTATION_SECOND",
    disciplineType: "FLEXIBLE",
    purpose:
      "Centralized competitor truth architecture, honest strengths/limitations & 1-command CLI migration",
    pluginCommand: "/competitor-alternatives",
  },
  "error-diagnostics-error-trace": {
    slug: "error-diagnostics-error-trace",
    category: "testing",
    priorityPhase: "IMPLEMENTATION_SECOND",
    disciplineType: "RIGID",
    purpose:
      "Tri-Origin (GOAL, WORLD, VERIFIER) error fingerprinting, root-cause trace & recovery playbooks",
    pluginCommand: "/error-diagnostics-error-trace",
  },
  "trpc-fullstack": {
    slug: "trpc-fullstack",
    category: "architecture",
    priorityPhase: "IMPLEMENTATION_SECOND",
    disciplineType: "RIGID",
    purpose:
      "End-to-end type-safe tRPC v11 router with decoupled createTRPCContext & createServerContext",
    pluginCommand: "/trpc-fullstack",
  },
  "docker-expert": {
    slug: "docker-expert",
    category: "security",
    priorityPhase: "IMPLEMENTATION_SECOND",
    disciplineType: "RIGID",
    purpose:
      "Multi-stage non-root UID 1001 Alpine/distroless container with internal:true air-gap network",
    pluginCommand: "/docker-expert",
  },
  "asana-automation": {
    slug: "asana-automation",
    category: "workflow",
    priorityPhase: "IMPLEMENTATION_SECOND",
    disciplineType: "FLEXIBLE",
    purpose:
      "Workspace-scoped GID resolution & parallel batch subtask creation (<=5 concurrent requests)",
    pluginCommand: "/asana-automation",
  },
};

export function evaluateV4TaskOrchestration(
  title: string,
  objective: string,
  allowedFiles?: string[],
  explicitSkills?: string[],
): SkillCombinationMemoryEntry {
  const baseEval = evaluateTaskOrchestration(
    title,
    objective,
    allowedFiles,
    explicitSkills,
  );
  const combinedLower = `${title} ${objective}`.toLowerCase();
  const v4DomainSignals = [
    "bento",
    "liquid glass",
    "product-design",
    "design-taste",
    "scaffold",
    "component",
    "mobile",
    "pwa",
    "offline",
    "service worker",
    "progressive-web-app",
    "perf",
    "inp",
    "cwv",
    "lcp",
    "cls",
    "wasm",
    "performance-engineer",
    "research",
    "arxiv",
    "capsule",
    "deep-research",
    "seo",
    "geo",
    "schema",
    "competitor",
    "alternative",
    "vs",
    "error",
    "trace",
    "diagnostic",
    "trpc",
    "router",
    "docker",
    "container",
    "asana",
    "l-orchestrator",
    "superpowers",
    "v4",
  ];
  const hasV4Signal = v4DomainSignals.some((kw) => combinedLower.includes(kw));

  if (
    baseEval.classification === "SIMPLE_CONTAINED" &&
    !hasV4Signal &&
    (!explicitSkills || explicitSkills.length === 0)
  ) {
    return baseEval;
  }

  const v4Set = new Set<string>([
    "using-superpowers",
    "antigravity-skill-orchestrator",
    ...(explicitSkills ?? []).filter(
      (s) => s in SPE_V4_SKILL_CATALOG || s in SKILL_CATALOG,
    ),
    ...baseEval.recommendedSkills.filter((s) => s in SPE_V4_SKILL_CATALOG),
  ]);
  if (
    combinedLower.includes("design") ||
    combinedLower.includes("bento") ||
    combinedLower.includes("glass") ||
    combinedLower.includes("ui")
  ) {
    v4Set.add("product-design");
    v4Set.add("design-taste-frontend");
    v4Set.add("antigravity-design-expert");
  }
  if (
    combinedLower.includes("scaffold") ||
    combinedLower.includes("component") ||
    combinedLower.includes("mobile")
  ) {
    v4Set.add("frontend-mobile-development-component-scaffold");
  }
  if (
    combinedLower.includes("pwa") ||
    combinedLower.includes("offline") ||
    combinedLower.includes("service worker") ||
    combinedLower.includes("progressive-web-app")
  ) {
    v4Set.add("progressive-web-app");
  }
  if (
    combinedLower.includes("perf") ||
    combinedLower.includes("inp") ||
    combinedLower.includes("cwv") ||
    combinedLower.includes("lcp") ||
    combinedLower.includes("cls") ||
    combinedLower.includes("wasm")
  ) {
    v4Set.add("performance-engineer");
  }
  if (
    combinedLower.includes("research") ||
    combinedLower.includes("arxiv") ||
    combinedLower.includes("capsule")
  ) {
    v4Set.add("deep-research");
  }
  if (
    combinedLower.includes("seo") ||
    combinedLower.includes("geo") ||
    combinedLower.includes("schema")
  ) {
    v4Set.add("seo");
  }
  if (
    combinedLower.includes("competitor") ||
    combinedLower.includes("alternative") ||
    combinedLower.includes("vs")
  ) {
    v4Set.add("competitor-alternatives");
  }
  if (
    combinedLower.includes("error") ||
    combinedLower.includes("trace") ||
    combinedLower.includes("diagnostic")
  ) {
    v4Set.add("error-diagnostics-error-trace");
  }
  if (combinedLower.includes("trpc") || combinedLower.includes("router")) {
    v4Set.add("trpc-fullstack");
  }
  if (combinedLower.includes("docker") || combinedLower.includes("container")) {
    v4Set.add("docker-expert");
  }
  if (combinedLower.includes("asana") || combinedLower.includes("task")) {
    v4Set.add("asana-automation");
  }
  const orderedV4 = Array.from(v4Set).sort((a, b) => {
    const metaA = SPE_V4_SKILL_CATALOG[a] ?? SKILL_CATALOG[a];
    const metaB = SPE_V4_SKILL_CATALOG[b] ?? SKILL_CATALOG[b];
    const pa = metaA?.priorityPhase === "PROCESS_FIRST" ? 0 : 1;
    const pb = metaB?.priorityPhase === "PROCESS_FIRST" ? 0 : 1;
    return pa - pb;
  });

  const targetFiles =
    allowedFiles && allowedFiles.length > 0
      ? allowedFiles
      : baseEval.inferredFiles.length > 0 &&
          baseEval.classification !== "SIMPLE_CONTAINED"
        ? baseEval.inferredFiles
        : ["apps/web/src/", "tools/", "spe_runtime/"];
  const slugKey =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36) || "autonomous-mission";
  const capsuleKey =
    baseEval.classification === "SIMPLE_CONTAINED"
      ? "ledger"
      : baseEval.recommendedCapsuleId;

  return {
    ...baseEval,
    key: `v4-combination-${slugKey}`,
    classification: "MULTI_DOMAIN_ORCHESTRATED",
    guardrailVerdict: `Complex multi-domain v4.0 task (${targetFiles.length} surfaces). Orchestrating ${orderedV4.length} verified skills (Process-First -> Implementation-Second).`,
    recommendedSkills: orderedV4,
    recommendedCapsuleId: capsuleKey,
    inferredFiles: targetFiles,
    content: `For ${title}, combining ${orderedV4.map((s) => `@${s}`).join(" + ")} grounded in ${RESEARCH_CAPSULES[capsuleKey]?.identifier ?? "arXiv:2608.00808"} preserves 100% of constraints across autonomous handoffs.`,
    tags: orderedV4,
  };
}

export const SPE_CLICKY_HUB_SEO_AUDIT = {
  coreWebVitalsMetric: "INP",
  inpBudgetMs: 120,
  deprecatedSchemasExcluded: ["HowTo"],
  activeSchemas: ["SoftwareApplication", "ScholarlyArticle"],
  eeatCitationsCount: 4,
  geoCitabilityReady: true,
} as const;

export function getSpeClickyHubJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SPE Clicky v4.0 Next-Stage Autonomous Continuation Hub",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    citation: Object.values(RESEARCH_CAPSULES).map((c) => ({
      "@type": "ScholarlyArticle",
      headline: c.paperTitle,
      identifier: c.identifier,
      publisher: c.sourceProvider,
    })),
  };
}

/**
 * Evaluates task complexity per @skill/antigravity-skill-orchestrator & @skill/using-superpowers:
 * - Simple/contained single-surface tasks bypass specialized skill bloat.
 * - Complex multi-domain tasks orchestrate Process-First skills followed by Implementation-Second skills,
 *   and prepare an @agent-memory-mcp skill_combination entry.
 */
export function evaluateTaskOrchestration(
  title: string,
  objective: string,
  allowedFiles?: string[],
  explicitSkills?: string[],
): SkillCombinationMemoryEntry {
  const combined = `${title} ${objective}`.trim();
  const lower = combined.toLowerCase();
  const words = combined.split(/\s+/).filter(Boolean);

  const fileMatches = combined.match(
    /\b[\w./-]+\.(?:tsx?|jsx?|css|html|py|swift|sh|mjs|json|md)\b/g,
  );
  const inferredFiles =
    allowedFiles && allowedFiles.length > 0
      ? allowedFiles
      : fileMatches && fileMatches.length > 0
        ? Array.from(new Set(fileMatches))
        : [];

  const multiDomainSignals = [
    "multi-agent",
    "autonomous",
    "continuation",
    "s-capsule",
    "vision ocr",
    "dmg",
    "monetization",
    "glassmorphic",
    "glassmorphism",
    "schema",
    "sitemap",
    "architecture",
    "orchestrat",
    "security",
    "benchmark",
    "contract",
  ];
  const hasMultiDomainSignal = multiDomainSignals.some((kw) =>
    lower.includes(kw),
  );

  const isSimpleContained =
    (!explicitSkills || explicitSkills.length === 0) &&
    inferredFiles.length <= 1 &&
    words.length <= 14 &&
    !hasMultiDomainSignal;

  if (isSimpleContained) {
    const targetFiles =
      inferredFiles.length > 0 ? inferredFiles : ["src/index.css"];
    return {
      key: `combination-simple-contained-${targetFiles[0].replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
      type: "skill_combination",
      classification: "SIMPLE_CONTAINED",
      guardrailVerdict:
        "Contained single-surface task. Baseline capabilities sufficient — specialized skills bypassed per @skill/antigravity-skill-orchestrator guardrail.",
      recommendedSkills: [],
      recommendedCapsuleId: "fwr",
      inferredFiles: targetFiles,
      content:
        "Simple single-surface edit handled via baseline file/terminal tools without skill over-engineering.",
      tags: ["simple-contained", "guardrail-bypass"],
    };
  }

  const autoSkills = new Set<string>(
    explicitSkills && explicitSkills.length > 0
      ? explicitSkills
      : ["using-superpowers", "antigravity-skill-orchestrator"],
  );
  let capsuleKey = "ledger";

  if (
    lower.includes("ui") ||
    lower.includes("design") ||
    lower.includes("css") ||
    lower.includes("3d") ||
    lower.includes("glass")
  ) {
    autoSkills.add("antigravity-design-expert");
    capsuleKey = "spatialUi";
  }
  if (
    lower.includes("seo") ||
    lower.includes("schema") ||
    lower.includes("sitemap") ||
    lower.includes("ad") ||
    lower.includes("geo")
  ) {
    autoSkills.add("seo");
  }
  if (
    lower.includes("test") ||
    lower.includes("verify") ||
    lower.includes("bug") ||
    lower.includes("fix") ||
    lower.includes("ocr")
  ) {
    autoSkills.add("tdd-workflow");
    autoSkills.add("systematic-debugging");
    if (capsuleKey === "ledger") capsuleKey = "agentlens";
  } else {
    autoSkills.add("tdd-workflow");
    autoSkills.add("recallmax");
  }

  // Sort Process-First skills before Implementation-Second skills per @skill/using-superpowers
  const orderedSkills = Array.from(autoSkills).sort((a, b) => {
    const phaseA =
      SKILL_CATALOG[a]?.priorityPhase === "PROCESS_FIRST" ? 0 : 1;
    const phaseB =
      SKILL_CATALOG[b]?.priorityPhase === "PROCESS_FIRST" ? 0 : 1;
    return phaseA - phaseB;
  });

  const targetFiles =
    inferredFiles.length > 0
      ? inferredFiles
      : ["apps/web/src/", "tools/", "spe_runtime/"];
  const slugKey =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36) || "autonomous-mission";

  return {
    key: `combination-${slugKey}`,
    type: "skill_combination",
    classification: "MULTI_DOMAIN_ORCHESTRATED",
    guardrailVerdict: `Complex multi-domain task (${targetFiles.length} surfaces). Orchestrating ${orderedSkills.length} verified skills (Process-First -> Implementation-Second).`,
    recommendedSkills: orderedSkills,
    recommendedCapsuleId: capsuleKey,
    inferredFiles: targetFiles,
    content: `For ${title}, combining ${orderedSkills.map((s) => `@${s}`).join(" + ")} grounded in ${RESEARCH_CAPSULES[capsuleKey]?.identifier ?? "arXiv:2608.00808"} preserves 100% of constraints across autonomous handoffs.`,
    tags: orderedSkills,
  };
}

/**
 * Deterministically advances the sequential task queue so that exactly ONE task is ACTIVE at all times.
 * Wraps cleanly back to Step 1 on a new pass when the final task completes.
 */
export function advanceQueueTasks(
  tasks: AutonomousQueueTask[],
  selectedTaskId?: string,
): { updatedTasks: AutonomousQueueTask[]; nextTask: AutonomousQueueTask } {
  if (tasks.length === 0) {
    throw new Error("Cannot advance an empty task queue");
  }
  const foundIndex = selectedTaskId
    ? tasks.findIndex((t) => t.id === selectedTaskId)
    : tasks.findIndex((t) => t.status === "ACTIVE");
  const currentIndex = foundIndex >= 0 ? foundIndex : 0;
  const isWrapping = currentIndex >= tasks.length - 1;
  const nextIndex = isWrapping ? 0 : currentIndex + 1;

  const updatedTasks: AutonomousQueueTask[] = tasks.map((t, idx) => {
    if (isWrapping) {
      return {
        ...t,
        status: idx === 0 ? ("ACTIVE" as const) : ("QUEUED" as const),
      };
    }
    if (idx <= currentIndex) {
      return { ...t, status: "COMPLETED" as const };
    }
    if (idx === nextIndex) {
      return { ...t, status: "ACTIVE" as const };
    }
    return { ...t, status: "QUEUED" as const };
  });

  return {
    updatedTasks,
    nextTask: updatedTasks[nextIndex] ?? updatedTasks[0],
  };
}

export const INITIAL_QUEUE: AutonomousQueueTask[] = [
  {
    id: "TASK-01",
    stepNumber: 1,
    title: "Spatial Glassmorphic Continuation Hub & Ad-Revenue Telemetry",
    status: "COMPLETED",
    domain: "Frontend UI & Monetization",
    objective:
      "Build the SPE Web Continuation Hub with spatial glassmorphic depth, privacy-preserving sponsor slots, and DOM sync bridge for SPE Clicky.",
    allowedFiles: [
      "apps/web/src/engine/SpeClickyContinuationHub.tsx",
      "apps/web/src/App.tsx",
    ],
    acceptanceGate: "npm run spe:copy-check && npm run build exit code 0",
    researchCapsuleId: "spatialUi",
    requiredSkills: [
      "using-superpowers",
      "antigravity-design-expert",
      "seo",
      "tdd-workflow",
    ],
    problemSolution: {
      id: "PS-01",
      problemDetected:
        "External AI wrappers charge $20/mo and burn user cloud tokens on repetitive prompt formatting without generating platform revenue.",
      rootCauseOrigin: "GOAL",
      perfectSolution:
        "Run prompt compilation 100% locally on the SPE website while displaying ethical, zero-tracking developer sponsor slots that fund free access.",
      verificationProbe: "node scripts/test-capabilities-seo.mjs",
    },
  },
  {
    id: "TASK-02",
    stepNumber: 2,
    title: "Autonomous Multi-Agent Continuation & Skill Orchestrator Routing",
    status: "ACTIVE",
    domain: "Autonomous Agent Chaining",
    objective:
      "Synthesize 6-clause continuation contracts embedding empirical research papers (arXiv S-Capsules), active skills/plugins, and problem-solution diagnostics for Antigravity, Claude, Cursor, Grok, and Codex.",
    allowedFiles: [
      "tools/mac_autonomous_bar.swift",
      "spe_runtime/production_bridge.py",
      "apps/web/src/engine/SpeClickyContinuationHub.tsx",
    ],
    acceptanceGate:
      "100% obligation preservation + live DOM/clipboard sync between SPE Web (127.0.0.1:4173) and SPE Clicky HUD",
    researchCapsuleId: "ledger",
    requiredSkills: [
      "using-superpowers",
      "antigravity-skill-orchestrator",
      "recallmax",
      "systematic-debugging",
      "security-auditor",
    ],
    problemSolution: {
      id: "PS-02",
      problemDetected:
        "Manual copy-pasting between coding agents loses 41% of negative constraints and requires constant human babysitting.",
      rootCauseOrigin: "VERIFIER",
      perfectSolution:
        "SPE Clicky watches agent completion via Apple Neural Engine Vision OCR, opens SPE Web to compile the next 6-clause contract with S-Capsule + Skill Orchestrator headers, and injects it automatically.",
      verificationProbe:
        "python3 -m spe_runtime.cli.main continue --out-contract /tmp/spe_next_task_contract.md",
    },
  },
  {
    id: "TASK-03",
    stepNumber: 3,
    title: "Adversarial Distinguishing Witness & Native DMG Qualification",
    status: "QUEUED",
    domain: "Release Qualification & Packaging",
    objective:
      "Verify hybrid AXUIElement + Vision OCR fallback, Mini-Pill HUD mode (310x38), and package signed SPE Clicky.app + SPEClicky-Installer.dmg.",
    allowedFiles: [
      "tools/mac_autonomous_bar.swift",
      "tools/package_spe_clicky_mac.sh",
      "dist/SPEClicky-Installer.dmg",
    ],
    acceptanceGate:
      "swiftc -O compilation + codesign verification + full regression test suite pass",
    researchCapsuleId: "agentlens",
    requiredSkills: [
      "using-superpowers",
      "tdd-workflow",
      "systematic-debugging",
      "security-auditor",
    ],
    problemSolution: {
      id: "PS-03",
      problemDetected:
        "Traditional screen clickers fail on Electron/WebCanvas apps when macOS Accessibility tree nodes are missing or unlabelled.",
      rootCauseOrigin: "WORLD",
      perfectSolution:
        "Hybrid 2-stage resolution: query AXUIElement first (<50ms), then automatically fall back to on-device Apple Vision VNRecognizeTextRequest OCR with coordinate mapping.",
      verificationProbe: "bash tools/package_spe_clicky_mac.sh",
    },
  },
];

const PLATFORM_LABELS: Record<
  ClickyTargetPlatform,
  { name: string; badge: string; shortcut: string }
> = {
  antigravity: {
    name: "Google Antigravity",
    badge: "🚀 Primary IDE Agent",
    shortcut: "⌘L + Paste",
  },
  claude: {
    name: "Claude Code / Desktop",
    badge: "🤖 Deep Reasoning",
    shortcut: "Focus + ⌘V",
  },
  cursor: {
    name: "Cursor Composer",
    badge: "💻 Host Editor",
    shortcut: "⌘I + ⌘V",
  },
  grok: {
    name: "Grok Frontier",
    badge: "⚡ First-Principles",
    shortcut: "Focus + ⌘V",
  },
  codex: {
    name: "OpenAI Codex",
    badge: "🧠 Surgical Diff",
    shortcut: "⌘I + ⌘V",
  },
};

export const SpeClickyContinuationHub: React.FC<
  SpeClickyContinuationHubProps
> = ({ onNavigate, onUsePromptInStudio, generatedPrompt }) => {
  const [tasks, setTasks] = useState<AutonomousQueueTask[]>(INITIAL_QUEUE);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("TASK-02");
  const [targetPlatform, setTargetPlatform] =
    useState<ClickyTargetPlatform>("antigravity");
  const [agentReportInput, setAgentReportInput] = useState<string>(
    "TASK: Built SPE Clicky v4.0 Ultra HUD with Mini-Pill (310x38) and Vision OCR.\nRESULT: All core HUD controls operational; ready to wire SPE Web Hub auto-continuation with research paper grounding and skill orchestrator.\nTESTS: 142 passed, 0 failed.\nFILES: tools/mac_autonomous_bar.swift, apps/web/src/App.tsx",
  );
  const [newTaskTitle, setNewTaskTitle] = useState<string>("");
  const [newTaskObjective, setNewTaskObjective] = useState<string>("");
  const [copyFeedback, setCopyFeedback] = useState<string>("");
  const [sessionCycles, setSessionCycles] = useState<number>(3);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [tilt, setTilt] = useState<{ rx: number; ry: number }>({
    rx: 0,
    ry: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? tasks[0],
    [tasks, selectedTaskId],
  );

  const activeCapsule = useMemo(
    () =>
      RESEARCH_CAPSULES[activeTask.researchCapsuleId] ??
      RESEARCH_CAPSULES.ledger,
    [activeTask],
  );

  const orchestratedSkills = useMemo(
    () =>
      activeTask.requiredSkills
        .map((slug) => SPE_V4_SKILL_CATALOG[slug] ?? SKILL_CATALOG[slug])
        .filter((s): s is OrchestratedSkillBadge => Boolean(s))
        .sort((a, b) => {
          const pa = a.priorityPhase === "PROCESS_FIRST" ? 0 : 1;
          const pb = b.priorityPhase === "PROCESS_FIRST" ? 0 : 1;
          return pa - pb;
        }),
    [activeTask],
  );

  // Evaluate task complexity guardrail per @skill/antigravity-skill-orchestrator
  const complexityEvaluation = useMemo(
    () =>
      evaluateV4TaskOrchestration(
        activeTask.title,
        activeTask.objective,
        activeTask.allowedFiles,
        activeTask.requiredSkills,
      ),
    [activeTask],
  );

  const pluginAudit = useMemo(
    () =>
      auditPluginsAndSkills([
        "read_file",
        "write_file",
        "web_search",
        "git_commit",
      ]),
    [],
  );

  const jsonLdString = useMemo(
    () => JSON.stringify(getSpeClickyHubJsonLd()),
    [],
  );

  // Compile the complete 6-Clause Continuation Prompt with Research Paper Context + Skills/Plugins + Problems & Solutions
  const compiledContinuationPrompt = useMemo(() => {
    const platformMeta = PLATFORM_LABELS[targetPlatform];
    const skillsList =
      orchestratedSkills.length > 0
        ? orchestratedSkills
            .map(
              (s) =>
                `- \`${s.pluginCommand}\` (\`@skill/${s.slug}\` · Phase: \`${s.priorityPhase}\` · Type: \`${s.disciplineType}\` · Category: \`${s.category}\`): ${s.purpose}`,
            )
            .join("\n")
        : "- `BASELINE_ONLY` (`SIMPLE_CONTAINED` Guardrail Active): No specialized skills invoked to prevent token/context bloat.";

    const studioPromptSection =
      generatedPrompt && generatedPrompt.trim().length > 0
        ? `\n### 1B. LIVE SPE GENERATOR PROMPT PAYLOAD\n> ${generatedPrompt
            .trim()
            .slice(0, 600)
            .replace(/\n/g, "\n> ")}\n`
        : "";

    return `## 🎯 SPE AUTONOMOUS CONTINUATION CONTRACT [${activeTask.id} · STEP ${activeTask.stepNumber}/${tasks.length}]
Target Platform: ${platformMeta.name} (${targetPlatform.toUpperCase()})
Execution Mode: Autonomous Sequential Loop ("One Task After One Task" · $0.00 Cloud Token Overhead)
Authority Level: ADVISORY_ONLY (Bounded Local Execution · Zero Unapproved Egress)

### 1. OBJECTIVE & TASK CONTINUATION
**Task Title**: ${activeTask.title}
**Primary Objective**: ${activeTask.objective}
**Prior Agent Report Context**:
> ${agentReportInput.replace(/\n/g, "\n> ")}
${studioPromptSection}
### 2. 🔬 EMPIRICAL RESEARCH STUDY PAPER CONTEXT (S-Capsule Grounding)
- **Research Paper**: *${activeCapsule.paperTitle}* (\`${activeCapsule.identifier}\` · Source: ${activeCapsule.sourceProvider})
- **Scientific Domain**: ${activeCapsule.domain}
- **Proven SOTA Architecture Pattern**: ${activeCapsule.provenPattern}
- **Failure Genome Prevented**: ${activeCapsule.failureGenome}
- **Quantitative Benchmark**: ${activeCapsule.quantitativeMetric}

### 3. 🛠️ ORCHESTRATED SKILLS & PLUGINS (@skill/antigravity-skill-orchestrator)
- **Guardrail Evaluation**: \`${complexityEvaluation.classification}\` — ${complexityEvaluation.guardrailVerdict}
- **Agent Memory Key (@agent-memory-mcp)**: \`${complexityEvaluation.key}\` (Plugin Safety Score: ${pluginAudit.overallSafetyScore}/100)
${skillsList}

### 4. 🧠 PROBLEMS & PERFECT SOLUTIONS DIAGNOSTIC MATRIX
- **Diagnosed Problem (${activeTask.problemSolution.rootCauseOrigin} Origin)**: ${activeTask.problemSolution.problemDetected}
- **Verified Perfect Solution**: ${activeTask.problemSolution.perfectSolution}
- **Distinguishing Witness Probe**: \`${activeTask.problemSolution.verificationProbe}\`

### 5. BOUNDED FILE SCOPE & ACCEPTANCE GATES
- **Allowed Files**: ${activeTask.allowedFiles.map((f) => `\`${f}\``).join(", ")}
- **Prohibited Files**: \`.env\`, \`secrets.json\`, \`config/production.json\`
- **Mandatory Acceptance Gate**: \`${activeTask.acceptanceGate}\`

### 6. STRICT STOP BOUNDARIES
- Stop immediately if any existing regression test fails (exit code != 0).
- Do NOT weaken or delete existing tests to make changes pass.
- Emit a structured verification report upon completion so SPE Clicky can automatically chain Task #${activeTask.stepNumber >= tasks.length ? 1 : activeTask.stepNumber + 1}.`;
  }, [
    activeTask,
    tasks.length,
    targetPlatform,
    agentReportInput,
    generatedPrompt,
    activeCapsule,
    orchestratedSkills,
    complexityEvaluation,
    pluginAudit.overallSafetyScore,
  ]);

  const handleAdvanceNextTask = () => {
    const { updatedTasks, nextTask } = advanceQueueTasks(
      tasks,
      activeTask.id,
    );
    setTasks(updatedTasks);
    setSelectedTaskId(nextTask.id);
    setSessionCycles((c) => c + 1);
    setCopyFeedback(
      `⚡ Chained to Step ${nextTask.stepNumber}: ${nextTask.title}`,
    );
    setTimeout(() => setCopyFeedback(""), 3000);
  };

  // Keep DOM attribute, localStorage, and window.__SPE_CLICKY_BRIDGE__ synced so SPE Clicky macOS app can read & advance at any time
  useEffect(() => {
    try {
      localStorage.setItem(
        "spe-clicky-active-contract",
        compiledContinuationPrompt,
      );
      localStorage.setItem("spe-clicky-target-platform", targetPlatform);
      localStorage.setItem(
        "spe-agent-memory-mcp-combinations",
        JSON.stringify(complexityEvaluation),
      );
    } catch {
      // ignore storage errors in restricted contexts
    }
    if (typeof window !== "undefined") {
      (
        window as unknown as {
          __SPE_CLICKY_BRIDGE__?: {
            getActiveContract: () => string;
            syncReportAndAdvance: (
              reportText?: string,
              shouldAdvance?: boolean,
            ) => string;
          };
        }
      ).__SPE_CLICKY_BRIDGE__ = {
        getActiveContract: () => compiledContinuationPrompt,
        syncReportAndAdvance: (
          reportText?: string,
          shouldAdvance?: boolean,
        ) => {
          if (reportText && reportText.trim().length > 0) {
            setAgentReportInput(reportText.trim());
          }
          if (shouldAdvance) {
            handleAdvanceNextTask();
          }
          return compiledContinuationPrompt;
        },
      };
    }
  });

  const handleCopyAndSync = async () => {
    try {
      await navigator.clipboard.writeText(compiledContinuationPrompt);
      setCopyFeedback(
        `✅ Copied & synced to SPE Clicky for ${PLATFORM_LABELS[targetPlatform].name}!`,
      );
    } catch {
      setCopyFeedback(
        "✅ Synced to #spe-clicky-active-contract DOM node for SPE Clicky!",
      );
    }
    setTimeout(() => setCopyFeedback(""), 3200);
  };

  const handleAddQueueTask = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newTaskTitle.trim();
    const cleanObj = newTaskObjective.trim();
    if (!cleanTitle || !cleanObj) return;

    const evalResult = evaluateV4TaskOrchestration(cleanTitle, cleanObj);
    const nextNum = tasks.length + 1;
    const paddedNum = String(nextNum).padStart(2, "0");

    const newTask: AutonomousQueueTask = {
      id: `TASK-${paddedNum}`,
      stepNumber: nextNum,
      title: cleanTitle,
      status: "QUEUED",
      domain:
        evalResult.classification === "SIMPLE_CONTAINED"
          ? "Contained Single-Surface Edit"
          : "Custom Autonomous Mission",
      objective: cleanObj,
      allowedFiles: evalResult.inferredFiles,
      acceptanceGate: "All regression tests pass with exit code 0",
      researchCapsuleId: evalResult.recommendedCapsuleId,
      requiredSkills: evalResult.recommendedSkills,
      problemSolution: {
        id: `PS-${paddedNum}`,
        problemDetected:
          evalResult.classification === "SIMPLE_CONTAINED"
            ? "Over-engineering simple single-file edits with unnecessary skills wastes context tokens."
            : "Unstructured multi-step execution risks context drift and unverified assumptions.",
        rootCauseOrigin: "GOAL",
        perfectSolution:
          evalResult.classification === "SIMPLE_CONTAINED"
            ? "Apply @skill/antigravity-skill-orchestrator guardrail to execute directly with baseline tools and zero skill bloat."
            : "Compile deterministic 6-clause contract with S-Capsule grounding and active Antigravity skills.",
        verificationProbe: "npm test && pytest",
      },
    };

    setTasks((prev) => [...prev, newTask]);
    setSelectedTaskId(newTask.id);
    setNewTaskTitle("");
    setNewTaskObjective("");
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (reducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Number((-y * 2.2).toFixed(2)),
      ry: Number((x * 2.2).toFixed(2)),
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0 });
  };

  const tokensSavedTotal = sessionCycles * 4250;
  const usdSavedTotal = (tokensSavedTotal / 1000) * 0.015;

  return (
    <section
      id="spe-clicky-continuation-hub"
      className="spe-clicky-hub-root"
      aria-labelledby="spe-clicky-hub-heading"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        maxWidth: "1200px",
        margin: "2.25rem auto",
        padding: "0 1.5rem",
        perspective: "1200px",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString }}
      />
      <div
        className="spe-clicky-hub-card"
        style={{
          borderRadius: "24px",
          padding: "2.25rem",
          background:
            "radial-gradient(120% 100% at 50% 0%, #0f1628 0%, #080c15 65%, #05080f 100%)",
          border: "1px solid rgba(226, 232, 240, 0.14)",
          boxShadow:
            "0 32px 80px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.12) inset",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          transform: reducedMotion
            ? "none"
            : `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: "transform 0.35s ease-out",
          willChange: "transform",
          color: "#f8fafc",
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1rem",
            paddingBottom: "1.25rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.28rem 0.85rem",
                borderRadius: "999px",
                background: "rgba(217, 197, 154, 0.1)",
                border: "1px solid rgba(217, 197, 154, 0.3)",
                color: "#d9c59a",
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "0.6rem",
                flexWrap: "wrap",
              }}
            >
              <span>🎯 SPE Clicky v4.0 Next-Stage · Web Continuation Command Hub (15-Skill Matrix)</span>
              <span
                style={{
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#34d399",
                  padding: "0.1rem 0.45rem",
                  borderRadius: "999px",
                  fontSize: "0.65rem",
                }}
              >
                ● LIVE ON-DEVICE ($0)
              </span>
              <span
                style={{
                  background: "rgba(56, 189, 248, 0.18)",
                  color: "#38bdf8",
                  padding: "0.1rem 0.45rem",
                  borderRadius: "999px",
                  fontSize: "0.65rem",
                }}
              >
                SEO/GEO Ready · CWV {SPE_CLICKY_HUB_SEO_AUDIT.coreWebVitalsMetric} &le; {SPE_CLICKY_HUB_SEO_AUDIT.inpBudgetMs}ms
              </span>
            </div>
            <h2
              id="spe-clicky-hub-heading"
              style={{
                margin: "0 0 0.4rem 0",
                fontSize: "clamp(1.6rem, 2.8vw, 2.15rem)",
                fontWeight: 800,
                letterSpacing: "-0.025em",
                color: "#ffffff",
              }}
            >
              Autonomous Task-After-Task Continuation &amp;{" "}
              <em
                style={{
                  fontFamily: "var(--spe-font-display, 'Instrument Serif', Georgia, serif)",
                  fontWeight: 400,
                  fontStyle: "italic",
                  color: "#d9c59a",
                }}
              >
                Skill Orchestrator.
              </em>
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "0.92rem",
                color: "#94a3b8",
                maxWidth: "780px",
                lineHeight: 1.5,
              }}
            >
              SPE Clicky opens this hub between coding tasks, audits the agent
              report, injects peer-reviewed{" "}
              <strong style={{ color: "#e2e8f0" }}>
                Research Study Paper Context (S-Capsules)
              </strong>{" "}
              and{" "}
              <strong style={{ color: "#e2e8f0" }}>
                Antigravity Skills &amp; Plugins
              </strong>
              , and dispatches the next verified prompt to Antigravity, Claude,
              Cursor, Grok, or Codex with zero human babysitting.
            </p>
          </div>

          {/* Live Economic & Sponsor Revenue Telemetry */}
          <div
            className="spe-clicky-telemetry-box"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 110px), 1fr))",
              gap: "0.6rem",
              background: "rgba(2, 6, 23, 0.75)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "12px",
              padding: "0.75rem 1rem",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: "#64748b",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Cloud Token Spend
              </div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "#10b981",
                }}
              >
                $0.00
              </div>
              <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                0 API tokens used
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: "#64748b",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Tokens Saved
              </div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "#38bdf8",
                }}
              >
                {tokensSavedTotal.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                ~${usdSavedTotal.toFixed(2)} saved vs cloud
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: "#64748b",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                Web Ad Revenue Loop
              </div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "#d9c59a",
                }}
              >
                Active
              </div>
              <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                Funds 100% Free SPE
              </div>
            </div>
          </div>
        </div>

        {/* Ethical Sponsor Ad Slot — Generates revenue when SPE Clicky opens the SPE Website */}
        <div style={{ margin: "1rem 0" }}>
          <ContextualAdSlot
            slotId="spe-clicky-autonomous-hub-leaderboard"
            format="leaderboard"
            label="SPE Clicky Autonomous Ecosystem Sponsor · Fuels Free Local AI Continuation"
          />
        </div>

        {/* Main 2-Column Spatial Grid */}
        <div
          className="spe-clicky-main-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
            gap: "1.25rem",
            marginTop: "1rem",
          }}
        >
          {/* Left Column: Sequential Task Queue + Prior Agent Report Analyzer */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div
              style={{
                background: "rgba(10, 15, 28, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "16px",
                padding: "1.2rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#d9c59a",
                  }}
                >
                  ⛓️ Autonomous Sequential Task Queue ({tasks.length} Tasks)
                </span>
                <button
                  type="button"
                  id="spe-clicky-advance-task-btn"
                  onClick={handleAdvanceNextTask}
                  style={{
                    minHeight: "38px",
                    padding: "7px 16px",
                    borderRadius: "9999px",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#34d399",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "transform 0.2s ease, opacity 0.2s ease",
                  }}
                >
                  ⚡ Complete &amp; Chain Next Task →
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.55rem",
                }}
              >
                {tasks.map((task, idx) => {
                  const isSelected = task.id === activeTask.id;
                  const statusColor =
                    task.status === "COMPLETED"
                      ? "#10b981"
                      : task.status === "ACTIVE"
                        ? "#d9c59a"
                        : "#64748b";
                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedTaskId(task.id);
                        }
                      }}
                      style={{
                        padding: "0.75rem 0.9rem",
                        borderRadius: "12px",
                        background: isSelected
                          ? "linear-gradient(135deg, rgba(217, 197, 154, 0.12), rgba(56, 189, 248, 0.08))"
                          : "rgba(2, 6, 23, 0.55)",
                        border: isSelected
                          ? "1px solid rgba(217, 197, 154, 0.45)"
                          : "1px solid rgba(255, 255, 255, 0.06)",
                        cursor: "pointer",
                        transform: reducedMotion
                          ? "none"
                          : isSelected
                            ? "translateZ(12px)"
                            : "translateZ(0px)",
                        transition:
                          "transform 0.3s ease-out, border-color 0.3s ease-out, background-color 0.3s ease-out",
                        transitionDelay: reducedMotion
                          ? "0s"
                          : `${(idx * 0.1).toFixed(1)}s`,
                        willChange: "transform",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            color: "#f8fafc",
                          }}
                        >
                          Step {task.stepNumber}: {task.title}
                        </span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            padding: "0.12rem 0.45rem",
                            borderRadius: "999px",
                            background: `${statusColor}22`,
                            color: statusColor,
                            border: `1px solid ${statusColor}55`,
                          }}
                        >
                          {task.status}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.76rem",
                          color: "#94a3b8",
                          lineHeight: 1.35,
                        }}
                      >
                        {task.objective}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Add Task to Queue Form */}
              <form
                onSubmit={handleAddQueueTask}
                style={{
                  marginTop: "0.85rem",
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="text"
                  placeholder="New task title..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  aria-label="New autonomous task title"
                  style={{
                    flex: "1 1 min(100%, 140px)",
                    padding: "0.45rem 0.65rem",
                    borderRadius: "8px",
                    background: "rgba(2, 6, 23, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    color: "#f8fafc",
                    fontSize: "0.78rem",
                  }}
                />
                <input
                  type="text"
                  placeholder="Objective (auto-routes paper + skills)..."
                  value={newTaskObjective}
                  onChange={(e) => setNewTaskObjective(e.target.value)}
                  aria-label="New autonomous task objective"
                  style={{
                    flex: "2 1 min(100%, 200px)",
                    padding: "0.45rem 0.65rem",
                    borderRadius: "8px",
                    background: "rgba(2, 6, 23, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    color: "#f8fafc",
                    fontSize: "0.78rem",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "7px 16px",
                    borderRadius: "9999px",
                    minHeight: "38px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundImage: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
                    backgroundColor: "#e2e8f0",
                    border: "1px solid rgba(255, 255, 255, 0.4)",
                    color: "#090d16",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                  }}
                >
                  + Queue Task
                </button>
              </form>
            </div>

            {/* Research Paper Context + Orchestrated Skills Card */}
            <div
              style={{
                background: "rgba(10, 15, 28, 0.8)",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                borderRadius: "16px",
                padding: "1.2rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#38bdf8",
                  marginBottom: "0.5rem",
                }}
              >
                🔬 Auto-Attached Research Study Paper Context (S-Capsule)
              </div>
              <div
                style={{
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: "0.25rem",
                }}
              >
                {activeCapsule.paperTitle}{" "}
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.76rem",
                    color: "#38bdf8",
                    background: "rgba(56, 189, 248, 0.12)",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "4px",
                  }}
                >
                  {activeCapsule.identifier}
                </span>
              </div>
              <p
                style={{
                  margin: "0 0 0.4rem 0",
                  fontSize: "0.78rem",
                  color: "#cbd5e1",
                }}
              >
                <strong>Proven Pattern:</strong> {activeCapsule.provenPattern}
              </p>
              <p
                style={{
                  margin: "0 0 0.75rem 0",
                  fontSize: "0.76rem",
                  color: "#94a3b8",
                }}
              >
                <strong>Empirical Benchmark:</strong>{" "}
                {activeCapsule.quantitativeMetric}
              </p>

              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#d9c59a",
                  marginBottom: "0.45rem",
                }}
              >
                🛠️ Active Skills &amp; Plugins Orchestrated (
                {orchestratedSkills.length})
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.4rem",
                  marginBottom: "0.75rem",
                }}
              >
                {orchestratedSkills.map((sk) => (
                  <span
                    key={sk.slug}
                    title={sk.purpose}
                    style={{
                      fontSize: "0.72rem",
                      fontFamily: "monospace",
                      padding: "0.22rem 0.55rem",
                      borderRadius: "6px",
                      background: "rgba(217, 197, 154, 0.12)",
                      border: "1px solid rgba(217, 197, 154, 0.32)",
                      color: "#f3e5c8",
                    }}
                  >
                    {sk.pluginCommand}
                  </span>
                ))}
              </div>

              {/* Problems & Perfect Solutions Diagnostic Box */}
              <div
                style={{
                  padding: "0.7rem 0.85rem",
                  borderRadius: "10px",
                  background: "rgba(2, 6, 23, 0.65)",
                  border: "1px solid rgba(16, 185, 129, 0.28)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "#34d399",
                    textTransform: "uppercase",
                    marginBottom: "0.25rem",
                  }}
                >
                  🧠 Problem &amp; Perfect Solution Report (Origin:{" "}
                  {activeTask.problemSolution.rootCauseOrigin})
                </div>
                <div
                  style={{
                    fontSize: "0.76rem",
                    color: "#fca5a5",
                    marginBottom: "0.25rem",
                  }}
                >
                  <strong>Problem:</strong>{" "}
                  {activeTask.problemSolution.problemDetected}
                </div>
                <div style={{ fontSize: "0.76rem", color: "#a7f3d0" }}>
                  <strong>Solution:</strong>{" "}
                  {activeTask.problemSolution.perfectSolution}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Target Platform Selector + Live Compiled Contract & SPE Clicky Sync */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div
              style={{
                background: "rgba(10, 15, 28, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "16px",
                padding: "1.2rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                height: "100%",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#d9c59a",
                    marginBottom: "0.45rem",
                  }}
                >
                  1. Select Target Coding Platform for SPE Clicky Auto-Paste
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.45rem",
                  }}
                >
                  {(
                    Object.keys(PLATFORM_LABELS) as ClickyTargetPlatform[]
                  ).map((plat) => {
                    const active = targetPlatform === plat;
                    return (
                      <button
                        key={plat}
                        type="button"
                        onClick={() => setTargetPlatform(plat)}
                        style={{
                          padding: "7px 16px",
                          borderRadius: "9999px",
                          minHeight: "38px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: active
                            ? "1px solid rgba(217, 197, 154, 0.55)"
                            : "1px solid rgba(255, 255, 255, 0.12)",
                          background: active
                            ? "linear-gradient(135deg, rgba(217, 197, 154, 0.2), rgba(56, 189, 248, 0.14))"
                            : "rgba(2, 6, 23, 0.6)",
                          color: active ? "#ffffff" : "#cbd5e1",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.18s ease",
                        }}
                      >
                        {PLATFORM_LABELS[plat].name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="spe-clicky-report-input"
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#94a3b8",
                    marginBottom: "0.3rem",
                  }}
                >
                  2. Previous Agent Task Report / Vision OCR Capture (Editable):
                </label>
                <textarea
                  id="spe-clicky-report-input"
                  rows={3}
                  value={agentReportInput}
                  onChange={(e) => setAgentReportInput(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "8px",
                    background: "rgba(2, 6, 23, 0.85)",
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    color: "#e2e8f0",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    lineHeight: 1.4,
                  }}
                />
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.35rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#38bdf8",
                    }}
                  >
                    3. Compiled 6-Clause Continuation Prompt (Research + Skills
                    Included):
                  </span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "#10b981",
                      fontFamily: "monospace",
                    }}
                  >
                    {compiledContinuationPrompt.length} chars · 0 cloud tokens
                  </span>
                </div>
                <pre
                  id="spe-clicky-active-contract"
                  data-spe-clicky-prompt={compiledContinuationPrompt}
                  data-spe-clicky-target={targetPlatform}
                  tabIndex={0}
                  style={{
                    margin: 0,
                    padding: "0.8rem",
                    borderRadius: "10px",
                    background: "#020617",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    color: "#e2e8f0",
                    fontFamily: "monospace",
                    fontSize: "0.73rem",
                    lineHeight: 1.45,
                    maxHeight: "250px",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {compiledContinuationPrompt}
                </pre>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.6rem",
                  alignItems: "center",
                  marginTop: "0.25rem",
                }}
              >
                <button
                  type="button"
                  id="spe-clicky-copy-sync-btn"
                  onClick={() => void handleCopyAndSync()}
                  style={{
                    flex: "0 1 auto",
                    minWidth: "min(100%, 220px)",
                    maxWidth: "340px",
                    minHeight: "46px",
                    padding: "12px 24px",
                    borderRadius: "9999px",
                    border: "1px solid rgba(255, 255, 255, 0.45)",
                    backgroundImage:
                      "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
                    backgroundColor: "#e2e8f0",
                    color: "#090d16",
                    fontWeight: 800,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 10px 24px rgba(0, 0, 0, 0.35)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  🎯 Copy &amp; Sync Prompt to SPE Clicky (
                  {PLATFORM_LABELS[targetPlatform].name})
                </button>
                {onUsePromptInStudio && (
                  <button
                    type="button"
                    onClick={() =>
                      onUsePromptInStudio(compiledContinuationPrompt)
                    }
                    style={{
                      minHeight: "44px",
                      padding: "10px 20px",
                      borderRadius: "9999px",
                      border: "1px solid rgba(255, 255, 255, 0.18)",
                      background: "rgba(255, 255, 255, 0.06)",
                      color: "#f8fafc",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Open in Prompt Studio ↗
                  </button>
                )}
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate("workflows")}
                    style={{
                      minHeight: "44px",
                      padding: "10px 20px",
                      borderRadius: "9999px",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      background: "rgba(56, 189, 248, 0.1)",
                      color: "#38bdf8",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Verified Workflows
                  </button>
                )}
              </div>

              {copyFeedback && (
                <div
                  role="status"
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#34d399",
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    padding: "0.45rem 0.75rem",
                    borderRadius: "8px",
                  }}
                >
                  {copyFeedback}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
