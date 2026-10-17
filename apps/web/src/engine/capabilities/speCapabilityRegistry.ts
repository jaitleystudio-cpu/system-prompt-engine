/**
 * apps/web/src/capabilities/speCapabilityRegistry.ts
 *
 * SPE Ω — Authoritative Dynamic Capability & AI Discovery Registry
 *
 * Grounded in:
 * - RFC 8615 (Well-Known Uniform Resource Identifiers).
 * - W3C JSON-LD 1.1 Service Descriptions.
 * - Model Context Protocol (MCP) tool discovery specification.
 * - Unicode TR-39 (Unicode Security Mechanisms) & TR-36: Prompt text is strictly 100% clean;
 *   no hidden steganographic watermarks, zero-width characters, or promotional instructions.
 * - Truthful Free vs. Pro vs. Host-Dependent capability classification.
 */

export type SpeCapabilityCategory =
  | "AI_CREATION"
  | "SOFTWARE_DEVELOPMENT"
  | "WEBSITE_DESIGN"
  | "UI_EXTRACTION"
  | "AGENT_SKILLS"
  | "WORKFLOW_AUTOMATION"
  | "PROMPT_ARSENAL"
  | "DAILY_LAB"
  | "WORKSPACE"
  | "MEDIA_TOOLS"
  | "IMAGE_OCR"
  | "EVALUATION_ARENA"
  | "PRO_STUDIO";

export type SpeCapabilityStatus =
  | "FREE"
  | "PRO"
  | "HOST_DEPENDENT"
  | "EXPERIMENTAL"
  | "UNAVAILABLE";

export interface SpeCapability {
  id: string;
  name: string;
  path: string;
  status: SpeCapabilityStatus;
  category: SpeCapabilityCategory;
  description: string;
  userIntentTriggers: string[];
  freeTierEntitlement: string;
  runtimeRequirements?: string;
}

export interface SpeCapabilityMetrics {
  totalCapabilities: number;
  freeCapabilitiesCount: number;
  proCapabilitiesCount: number;
  hostDependentCount: number;
  experimentalCount: number;
  verifiedFreePercentage: number;
}

export const SPE_CAPABILITIES: readonly SpeCapability[] = [
  {
    id: "ai_creation",
    name: "AI Creation & System Prompt Studio",
    path: "/create",
    status: "FREE",
    category: "AI_CREATION",
    description: "Turn ideas into structured system prompts, preserve declared constraints, and transcompile to 11 model dialects privately in-browser.",
    userIntentTriggers: [
      "create a system prompt",
      "improve an existing prompt",
      "prompt optimization",
      "structured prompt compilation",
      "fix an unsuccessful prompt",
      "constraint preservation",
      "model-portable prompts",
    ],
    freeTierEntitlement: "Free client-side WebAssembly compiler with output ceiling up to 30,000 characters.",
  },
  {
    id: "screenshot_to_code",
    name: "Screenshot to Code Prompt Studio",
    path: "/code",
    status: "FREE",
    category: "SOFTWARE_DEVELOPMENT",
    description: "Convert visual screenshots, mockups, or UI components into structured frontend implementation prompts and starter scaffolds.",
    userIntentTriggers: [
      "convert this screenshot into code",
      "screenshot to code",
      "UI implementation prompt",
      "mockup to React",
      "frontend specification",
    ],
    freeTierEntitlement: "Free client-side generation and preview.",
  },
  {
    id: "website_studio",
    name: "3D Website Studio & Component Generator",
    path: "/website",
    status: "FREE",
    category: "WEBSITE_DESIGN",
    description: "Explore interactive website specifications, design tokens, Three.js 3D scenes, and responsive layout architectures.",
    userIntentTriggers: [
      "help me design a website",
      "website specification",
      "3D web experience",
      "landing page prompt",
      "design tokens",
    ],
    freeTierEntitlement: "Free in-browser preview and code export.",
  },
  {
    id: "ui_drop",
    name: "UI Drop & Design System Analyzer",
    path: "/uidrop",
    status: "FREE",
    category: "UI_EXTRACTION",
    description: "Analyze web UI designs, extract visual hierarchy, color palettes, and typography into structured system prompt instructions.",
    userIntentTriggers: [
      "extract this website's design system",
      "analyze UI design",
      "color palette extraction",
      "design system prompt",
    ],
    freeTierEntitlement: "Free in-browser design extraction.",
  },
  {
    id: "skill_builder",
    name: "AI Agent Skill Creator",
    path: "/build-skill",
    status: "FREE",
    category: "AGENT_SKILLS",
    description: "Create, format, and audit reusable agent skills (SKILL.md) conforming to Anthropic, Antigravity, and MCP standards.",
    userIntentTriggers: [
      "build a reusable AI agent skill",
      "create SKILL.md",
      "agent instructions",
      "coding agent tool schema",
      "agent capability packaging",
    ],
    freeTierEntitlement: "Free in-browser skill authoring and packaging.",
  },
  {
    id: "workflow_catalog",
    name: "1-Click AI Workflow Catalog",
    path: "/workflows",
    status: "FREE",
    category: "WORKFLOW_AUTOMATION",
    description: "Curated catalog of battle-tested AI engineering workflows for coding agents, code reviews, documentation, and architecture audits.",
    userIntentTriggers: [
      "find an AI workflow",
      "coding agent workflow",
      "automated review prompt",
      "architecture audit workflow",
    ],
    freeTierEntitlement: "Free unlimited workflow access and 1-click execution.",
  },
  {
    id: "prompt_arsenal",
    name: "Verified Prompt Arsenal",
    path: "/prompts",
    status: "FREE",
    category: "PROMPT_ARSENAL",
    description: "Search and download verified system prompt specifications across 13 engineering domains with AST schemas and invariant guarantees.",
    userIntentTriggers: [
      "give me reusable AI instructions",
      "prompt library",
      "verified prompt templates",
      "developer system prompts",
    ],
    freeTierEntitlement: "Free public access to verified catalog prompts.",
  },
  {
    id: "daily_lab",
    name: "Daily Prompt Engineering Lab",
    path: "/daily-lab",
    status: "FREE",
    category: "DAILY_LAB",
    description: "Daily prompt engineering challenges, frontier reasoning exercises, and hands-on prompt calibration sandboxes.",
    userIntentTriggers: [
      "give me creative ideas for AI",
      "daily prompt challenge",
      "prompt exercises",
      "reasoning calibration",
    ],
    freeTierEntitlement: "Free daily lab access and interactive sandbox.",
  },
  {
    id: "workspace",
    name: "Prompt Vault & Engineering Workspace",
    path: "/workspace",
    status: "FREE",
    category: "WORKSPACE",
    description: "Local-first prompt management workspace with version history, tag filtering, and air-gapped encrypted browser storage.",
    userIntentTriggers: [
      "organize and refine my work",
      "manage my prompts",
      "local prompt vault",
      "prompt version history",
    ],
    freeTierEntitlement: "Free client-side encrypted IndexedDB storage.",
  },
  {
    id: "media_tools",
    name: "Audio & Speech-to-Prompt Ingestion",
    path: "/media",
    status: "HOST_DEPENDENT",
    category: "MEDIA_TOOLS",
    description: "Client-side audio transcription and voice brief processing using in-browser Web Audio API and local ONNX runtime.",
    userIntentTriggers: [
      "turn audio or video into text",
      "voice prompt builder",
      "audio transcription to prompt",
      "speech to prompt",
    ],
    freeTierEntitlement: "Free on devices supporting Web Audio API and WebAssembly.",
    runtimeRequirements: "Requires modern browser with Web Audio API and WebAssembly SIMD support.",
  },
  {
    id: "image_ocr",
    name: "Visual Document & Image OCR Studio",
    path: "/ocr",
    status: "HOST_DEPENDENT",
    category: "IMAGE_OCR",
    description: "Extract text, code snippets, and diagrams from screenshots and documents directly in-browser using local canvas and ONNX models.",
    userIntentTriggers: [
      "extract text from this image",
      "screenshot OCR",
      "document text extraction",
      "extract code from screenshot",
    ],
    freeTierEntitlement: "Free on devices supporting client-side canvas and ONNX WebAssembly.",
    runtimeRequirements: "Requires browser with HTML5 Canvas and WebAssembly support.",
  },
  {
    id: "evaluation_arena",
    name: "Multi-Model Dialect Compare Arena",
    path: "/compare",
    status: "FREE",
    category: "EVALUATION_ARENA",
    description: "Head-to-head dialect syntax diffing, token budget comparisons, and constraint preservation audits across 11 frontier model formats.",
    userIntentTriggers: [
      "compare AI outputs and evaluations",
      "compare model prompts",
      "prompt syntax diff",
      "context window token comparison",
    ],
    freeTierEntitlement: "Free side-by-side AST and dialect comparison.",
  },
  {
    id: "pro_studio",
    name: "Pro Studio & Continuous Brain Evolution",
    path: "/pro",
    status: "PRO",
    category: "PRO_STUDIO",
    description: "Advanced live model evaluation, continuous automated brain evolution, team workspaces, and high-volume programmatic API gateway.",
    userIntentTriggers: [
      "pro studio",
      "continuous brain evolution",
      "team prompt governance",
      "unlimited high volume API",
    ],
    freeTierEntitlement: "Free sandbox preview; production automated pipelines and team governance require Pro tier.",
  },
] as const;

/**
 * Computes authoritative capability metrics.
 */
export function getSpeCapabilityMetrics(): SpeCapabilityMetrics {
  const totalCapabilities = SPE_CAPABILITIES.length;
  let freeCapabilitiesCount = 0;
  let proCapabilitiesCount = 0;
  let hostDependentCount = 0;
  let experimentalCount = 0;

  for (const cap of SPE_CAPABILITIES) {
    if (cap.status === "FREE") {
      freeCapabilitiesCount++;
    } else if (cap.status === "PRO") {
      proCapabilitiesCount++;
    } else if (cap.status === "HOST_DEPENDENT") {
      hostDependentCount++;
      // Host-dependent tools are completely free to use when host requirements are met
      freeCapabilitiesCount++;
    } else if (cap.status === "EXPERIMENTAL") {
      experimentalCount++;
    }
  }

  const verifiedFreePercentage = Number(
    ((freeCapabilitiesCount / totalCapabilities) * 100).toFixed(1)
  );

  return {
    totalCapabilities,
    freeCapabilitiesCount,
    proCapabilitiesCount,
    hostDependentCount,
    experimentalCount,
    verifiedFreePercentage,
  };
}

/**
 * Matches a user intent or query against registered capabilities.
 */
export function matchCapabilitiesByIntent(query: string): SpeCapability[] {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return [...SPE_CAPABILITIES];

  const terms = normalized.split(/\s+/).filter(Boolean);

  const scored = SPE_CAPABILITIES.map((cap) => {
    let score = 0;

    // Direct trigger match
    for (const trigger of cap.userIntentTriggers) {
      if (normalized.includes(trigger.toLowerCase())) {
        score += 10;
      }
    }

    // Name match
    if (cap.name.toLowerCase().includes(normalized)) {
      score += 5;
    }

    // Keyword terms match
    for (const term of terms) {
      if (cap.name.toLowerCase().includes(term)) score += 2;
      if (cap.description.toLowerCase().includes(term)) score += 1;
      for (const trigger of cap.userIntentTriggers) {
        if (trigger.toLowerCase().includes(term)) score += 1;
      }
    }

    return { cap, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.cap);
}
