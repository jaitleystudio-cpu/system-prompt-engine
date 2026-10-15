/**
 * SPE Ω — Promise-Preserving Headline Generator
 *
 * Mandate:
 * Generate diverse, plain-English hero headlines, supporting sentences, and
 * primary call-to-actions across 12 distinct communication strategies.
 * All generated copy strictly grounds in verified capabilities from the Product-Promise Contract.
 */

import type { ShippedCapabilityKey } from "./productPromiseContract.ts";
import type { CandidateCopyPayload } from "./semanticPromiseVerifier.ts";

export const COMMUNICATION_STRATEGIES = {
  ACTION_ORIENTED: {
    key: "ACTION_ORIENTED",
    name: "Action-Oriented Direction",
    description: "Focuses on immediate developer momentum and task clarity.",
  },
  PROBLEM_SOLUTION: {
    key: "PROBLEM_SOLUTION",
    name: "Problem / Solution (Agent Drift)",
    description: "Directly addresses agent drift, hallucinations, and broken loops.",
  },
  BEFORE_AFTER: {
    key: "BEFORE_AFTER",
    name: "Before vs After Contrast",
    description: "Contrasts vague rough notes with structured, production-ready prompts.",
  },
  SIMPLICITY_FOCUS: {
    key: "SIMPLICITY_FOCUS",
    name: "Simplicity & Cleanliness",
    description: "Emphasizes zero guesswork, cognitive calm, and clear direction.",
  },
  AIR_GAP_PRIVACY: {
    key: "AIR_GAP_PRIVACY",
    name: "Air-Gapped Privacy & Security",
    description: "Highlights 100% on-device WebAssembly execution and zero data leakage.",
  },
  PORTABILITY: {
    key: "PORTABILITY",
    name: "Multi-Agent Portability",
    description: "Promotes 1-click export to Claude Code, Cursor, Windsurf, and ChatGPT.",
  },
  BUILDER_ENGINEER: {
    key: "BUILDER_ENGINEER",
    name: "Builder & Invariant Precision",
    description: "Speaks to senior engineers who require immutable scope boundaries.",
  },
  SPEED_EFFICIENCY: {
    key: "SPEED_EFFICIENCY",
    name: "Frictionless Speed",
    description: "Fast start with zero account creation, credentials, or configuration.",
  },
  TRANSPARENCY: {
    key: "TRANSPARENCY",
    name: "Auditable Transparency",
    description: "Complete visibility into rules, boundary checks, and output text.",
  },
  COST_AWARENESS: {
    key: "COST_AWARENESS",
    name: "Cost & Waste Reduction ($0)",
    description: "Eliminates runaway API token waste and extra $20/month subscriptions.",
  },
  CREATIVE_EXPLORATION: {
    key: "CREATIVE_EXPLORATION",
    name: "Creative Idea Nurturing",
    description: "Gives thoughts and creative goals room to take structured shape.",
  },
  INVARIANT_RELIABILITY: {
    key: "INVARIANT_RELIABILITY",
    name: "Contradiction-Free Invariants",
    description: "Detects and eliminates conflicting prompt rules before sending to AI.",
  },
} as const;

export type CommunicationStrategyKey = keyof typeof COMMUNICATION_STRATEGIES;

export interface GeneratedHeroVariant extends CandidateCopyPayload {
  strategy: CommunicationStrategyKey;
  supportedCapabilityKeys: ShippedCapabilityKey[];
  tags: string[];
}

/**
 * Deterministic generator producing candidates across all 12 communication strategies.
 */
export function generateCandidateVariants(): GeneratedHeroVariant[] {
  return [
    {
      strategy: "ACTION_ORIENTED",
      title: "Give your next idea",
      accent: "a clear direction.",
      support: "Turn rough thoughts into structured prompts for any AI. 100% on-device WebAssembly.",
      cta: "Make my prompt",
      supportedCapabilityKeys: ["BROWSER_WASM_COMPILATION", "MULTI_AGENT_PORTABILITY"],
      tags: ["momentum", "clarity", "any-ai"],
    },
    {
      strategy: "PROBLEM_SOLUTION",
      title: "Stop AI coding agents",
      accent: "from guessing.",
      support: "Lock your boundaries before your coding agent hallucinates. Free and local.",
      cta: "Protect my prompt",
      supportedCapabilityKeys: ["INVARIANT_GUARDRAILS", "AIR_GAP_ZERO_EGRESS"],
      tags: ["hallucination-prevention", "coding-agents"],
    },
    {
      strategy: "BEFORE_AFTER",
      title: "From rough notes",
      accent: "to exact prompts.",
      support: "Shape scattered requirements into clean system instructions you can review and trust.",
      cta: "Start with an idea",
      supportedCapabilityKeys: ["CONFLICT_DETECTION", "MULTI_AGENT_PORTABILITY"],
      tags: ["transformation", "trust"],
    },
    {
      strategy: "SIMPLICITY_FOCUS",
      title: "Clear prompts.",
      accent: "No guesswork.",
      support: "Turn rough notes into structured prompts for any AI. 100% on-device.",
      cta: "Build my prompt",
      supportedCapabilityKeys: ["BROWSER_WASM_COMPILATION", "CONFLICT_DETECTION"],
      tags: ["minimal", "zero-guesswork"],
    },
    {
      strategy: "AIR_GAP_PRIVACY",
      title: "Your prompts",
      accent: "never leave your browser.",
      support: "100% on-device WebAssembly compiler. Zero prompt bytes or secrets leave your machine.",
      cta: "Open private studio",
      supportedCapabilityKeys: ["AIR_GAP_ZERO_EGRESS", "BROWSER_WASM_COMPILATION"],
      tags: ["air-gap", "privacy", "zero-leak"],
    },
    {
      strategy: "PORTABILITY",
      title: "One prompt.",
      accent: "Ready for Claude, Cursor, and ChatGPT.",
      support: "Export clean system prompts directly to CLAUDE.md, .cursorrules, and Custom GPTs in one click.",
      cta: "Format for my AI",
      supportedCapabilityKeys: ["MULTI_AGENT_PORTABILITY"],
      tags: ["export", "claude", "cursor"],
    },
    {
      strategy: "BUILDER_ENGINEER",
      title: "Locked boundaries",
      accent: "for your AI agent.",
      support: "Enforce strict invariants so your coding assistant never touches forbidden files or hallucinates.",
      cta: "Lock agent rules",
      supportedCapabilityKeys: ["INVARIANT_GUARDRAILS"],
      tags: ["engineering", "scope-control"],
    },
    {
      strategy: "SPEED_EFFICIENCY",
      title: "Start immediately.",
      accent: "No account required.",
      support: "Open the prompt studio and compile production-ready instructions in seconds on your device.",
      cta: "Create prompt now",
      supportedCapabilityKeys: ["ZERO_COMPUTE_COST", "BROWSER_WASM_COMPILATION"],
      tags: ["instant", "frictionless"],
    },
    {
      strategy: "TRANSPARENCY",
      title: "Know exactly what",
      accent: "your prompt does.",
      support: "Review every rule, boundary, and instruction before you copy it to your model.",
      cta: "Inspect prompt rules",
      supportedCapabilityKeys: ["CONFLICT_DETECTION"],
      tags: ["auditable", "visibility"],
    },
    {
      strategy: "COST_AWARENESS",
      title: "Zero server costs.",
      accent: "100% on-device.",
      support: "Stop wasting tokens on broken retry loops. Compile deterministic prompts locally for $0.",
      cta: "Save API credits",
      supportedCapabilityKeys: ["ZERO_COMPUTE_COST", "BROWSER_WASM_COMPILATION"],
      tags: ["economic", "zero-dollar"],
    },
    {
      strategy: "CREATIVE_EXPLORATION",
      title: "Give your idea",
      accent: "room to take shape.",
      support: "Bring your goal and the details that matter. Shape a prompt that keeps them in focus.",
      cta: "Shape my idea",
      supportedCapabilityKeys: ["VERIFIED_WORKFLOWS"],
      tags: ["creative", "focus"],
    },
    {
      strategy: "INVARIANT_RELIABILITY",
      title: "Eliminate conflicting rules",
      accent: "before you prompt.",
      support: "Catch contradictory instructions before they confuse the model. Clear, verified results.",
      cta: "Verify my rules",
      supportedCapabilityKeys: ["CONFLICT_DETECTION", "INVARIANT_GUARDRAILS"],
      tags: ["contradiction-free", "reliability"],
    },
  ];
}
