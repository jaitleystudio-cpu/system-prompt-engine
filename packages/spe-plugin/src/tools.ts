/**
 * Core SPE Tool Handlers for OpenAI Plugin & Model Context Protocol (MCP)
 * 
 * Free-tier capacity ceiling: 30,000 characters (free to all: AI bots, AI models, and humans).
 * Honest disclosure: token counts labeled as calibrated estimates.
 * User sovereignty: multilingual versions offered independently, never merged forcefully.
 */

import {
  detectLanguage,
  synthesizeDualPrompts,
  computePromptMetrics,
  SUPPORTED_LANGUAGES,
  type DualPromptBundle,
} from "../../../apps/web/src/engine/multilingualDualPrompt.ts";

export const FREE_TIER_MAX_OUTPUT_CHARS = 30000;

export interface CompilePromptRequest {
  goal: string;
  category?: string;
  role?: string;
  constraints?: string[];
  target_model?: string;
  output_format?: string;
}

export interface CompilePromptResult {
  prompt: string;
  character_count: number;
  language: string;
  is_token_count_exact: boolean;
  estimated_tokens: number;
  capacity_limit: number;
  warnings: string[];
  entitlement_status: "FREE" | "PRO";
}

export interface InspectPromptResult {
  quality_score: number;
  character_count: number;
  has_role: boolean;
  has_objective: boolean;
  has_invariants: boolean;
  has_grounding: boolean;
  has_verification: boolean;
  missing_requirements: string[];
  recommendations: string[];
}

/**
 * Tool 1: compile_system_prompt
 */
export function compileSystemPrompt(req: CompilePromptRequest): CompilePromptResult {
  const goal = (req.goal || "").trim();
  const category = req.category || "Assistant";
  const targetModel = req.target_model || "chatgpt";
  const constraints = req.constraints || [];
  const warnings: string[] = [];

  if (!goal) {
    warnings.push("Empty goal supplied; generated generic baseline instruction set.");
  }

  const detected = detectLanguage(goal);
  const role = req.role?.trim() || `You are an expert ${category} specialist operating with deterministic boundary discipline and zero hallucinations.`;

  const sections: string[] = [];

  // Section 1: Role & Persona
  sections.push(`# System Role & Persona\n${role}`);

  // Section 2: Core Mission & Objective
  sections.push(`# Core Mission & Objective\nGoal: ${goal || "Execute assigned directives accurately."}\nCategory: ${category}\nTarget Model: ${targetModel}`);

  // Section 3: Hard Operational Invariants
  const invariantLines = [
    "- Strictly preserve all user-supplied requirements and operational boundaries.",
    "- Never assume outside network tools, credentials, or uncited documents without verification.",
    "- Maintain 100% boundary discipline: do not hallucinate APIs or unverified claims.",
  ];
  if (constraints.length > 0) {
    for (const c of constraints) {
      invariantLines.push(`- User Invariant: ${c}`);
    }
  }
  sections.push(`# Operational & Security Invariants\n${invariantLines.join("\n")}`);

  // Section 4: Execution Methodology
  sections.push(
    `# Execution Methodology\n1. Analyze input requirements and isolate known constraints from unstated assumptions.\n2. Formulate step-by-step deliverables adhering strictly to verified facts.\n3. Validate output against acceptance criteria prior to final completion.`
  );

  // Section 5: Handling Missing Information
  sections.push(
    `# Handling Missing Information\nUse only confirmed user facts. If essential parameters are missing, state assumptions explicitly rather than fabricating dependencies.`
  );

  // Section 6: Acceptance Verification Battery
  sections.push(
    `# Acceptance Verification Battery\n- Does the output satisfy all explicit user constraints?\n- Are all stated invariants maintained without contradiction?\n- Has hallucination of outside tools or unverifiable dependencies been eliminated?`
  );

  // Section 7: Output Schema / Format
  if (req.output_format?.trim()) {
    sections.push(`# Desired Output Contract\n${req.output_format.trim()}`);
  }

  let finalPrompt = sections.join("\n\n");

  // Enforce Free tier ceiling (30,000 characters)
  if (finalPrompt.length > FREE_TIER_MAX_OUTPUT_CHARS) {
    finalPrompt = finalPrompt.slice(0, FREE_TIER_MAX_OUTPUT_CHARS);
    warnings.push(`Output trimmed to Free tier capacity ceiling of ${FREE_TIER_MAX_OUTPUT_CHARS} characters.`);
  }

  const metrics = computePromptMetrics(finalPrompt, detected, targetModel);

  return {
    prompt: finalPrompt,
    character_count: finalPrompt.length,
    language: detected.code,
    is_token_count_exact: false, // Honestly labeled as estimated
    estimated_tokens: metrics.estimatedTokens,
    capacity_limit: FREE_TIER_MAX_OUTPUT_CHARS,
    warnings,
    entitlement_status: "FREE",
  };
}

/**
 * Tool 2: inspect_system_prompt
 */
export function inspectSystemPrompt(promptText: string): InspectPromptResult {
  const text = (promptText || "").trim();
  const charCount = text.length;

  const hasRole = /#{1,4}[^\n]*(?:Role|Persona|Identity)|<role>/i.test(text);
  const hasObjective = /#{1,4}[^\n]*(?:Objective|Goal|Mission|Task)|<objective>/i.test(text);
  const hasInvariants = /#{1,4}[^\n]*(?:Invariant|Constraint|Rule|Security|Prohibition)|<invariants?>/i.test(text);
  const hasGrounding = /#{1,4}[^\n]*(?:Missing Information|Grounding|Evidence|Assumptions)|<grounding>/i.test(text);
  const hasVerification = /#{1,4}[^\n]*(?:Acceptance|Verification|Checks|Audit|Battery)|<acceptance>/i.test(text);

  let qualityScore = 30;
  if (hasRole) qualityScore += 15;
  if (hasObjective) qualityScore += 20;
  if (hasInvariants) qualityScore += 15;
  if (hasGrounding) qualityScore += 10;
  if (hasVerification) qualityScore += 10;

  const missing: string[] = [];
  const recommendations: string[] = [];

  if (!hasRole) {
    missing.push("Missing dedicated Persona or System Role definition.");
    recommendations.push("Add a '# System Role & Persona' section defining the assistant's boundaries.");
  }
  if (!hasObjective) {
    missing.push("Missing explicit Objective section.");
    recommendations.push("Add a '# Core Mission & Objective' section defining what success looks like.");
  }
  if (!hasInvariants) {
    missing.push("Missing Operational & Security Invariants.");
    recommendations.push("Enforce '# Operational Invariants' to prevent prompt injection and hallucinated tools.");
  }
  if (!hasGrounding) {
    missing.push("Missing policy for handling unverified assumptions or missing facts.");
    recommendations.push("Add '# Handling Missing Information' to prevent guessing missing requirements.");
  }
  if (!hasVerification) {
    missing.push("Missing self-audit or acceptance verification battery.");
    recommendations.push("Include '# Acceptance Verification Battery' so the model verifies its work before emitting.");
  }

  return {
    quality_score: Math.min(100, qualityScore),
    character_count: charCount,
    has_role: hasRole,
    has_objective: hasObjective,
    has_invariants: hasInvariants,
    has_grounding: hasGrounding,
    has_verification: hasVerification,
    missing_requirements: missing,
    recommendations,
  };
}

/**
 * Tool 3: compare_prompt_languages
 */
export function comparePromptLanguages(
  promptText: string,
  category = "Business",
  targetModel = "claude-sonnet"
): DualPromptBundle {
  return synthesizeDualPrompts(promptText, category, targetModel);
}
