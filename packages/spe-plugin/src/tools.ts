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
import {
  truncateCleanly,
  cleanSurrogateBoundaries,
} from "../../../apps/web/src/engine/promptSynthesizer.ts";

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
  const goal = cleanSurrogateBoundaries((req.goal || "").trim());
  const category = cleanSurrogateBoundaries(req.category || "Assistant");
  const targetModel = cleanSurrogateBoundaries(req.target_model || "chatgpt");
  const constraints = (req.constraints || []).map((c) => cleanSurrogateBoundaries(c));
  const warnings: string[] = [];

  if (!goal) {
    warnings.push("Empty goal supplied; generated generic baseline instruction set.");
  }

  const detected = detectLanguage(goal);
  const role = cleanSurrogateBoundaries(
    req.role?.trim() || `You are an expert ${category} specialist operating with deterministic boundary discipline and zero hallucinations.`
  );

  // Extract any inline or sentence-level mandatory instructions from goal (Finding F05)
  const goalDirectives: string[] = [];
  const rawSentences = goal.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  const directiveKeywords = /\b(MUST NOT|MUST|NEVER|FORBIDDEN|DO NOT|DON'T|CANNOT|SHALL NOT|SHALL|PROHIBITED|STRICTLY|MANDATORY|REQUIRED|ALWAYS|ENSURE|RETURN ONLY|OUTPUT ONLY|ONLY JSON|JSON ONLY|FORMAT AS|NO\s+[a-zA-Z0-9_-]+\s+(?:MAY|SHALL|CAN|MUST)|NO\s+CUSTOMER\s+DATA|MAY LEAVE THIS DEVICE|DISCLOSE|EXFILTRATE|LEAK)\b/i;
  for (const s of rawSentences) {
    const cleanM = s.trim().replace(/^[-*]\s*/, "");
    if (cleanM.length > 5 && directiveKeywords.test(cleanM)) {
      if (!goalDirectives.includes(cleanM)) {
        goalDirectives.push(cleanM);
      }
    }
  }

  // Protected Section 1: Role & Persona
  const secRole = `# System Role & Persona\n${role}`;

  // Protected Section 2: Hard Operational Invariants
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
  // Promote all mandatory directives from goal into invariantLines so they are NEVER trimmed
  for (const dir of goalDirectives) {
    const formatted = `- User Invariant: ${dir}`;
    if (!invariantLines.includes(formatted)) {
      invariantLines.push(formatted);
    }
  }
  const secInvariants = `# Operational & Security Invariants\n${invariantLines.join("\n")}`;

  // Protected Section 3: Acceptance Verification Battery
  const secAcceptance = `# Acceptance Verification Battery\n- Does the output satisfy all explicit user constraints?\n- Are all stated invariants maintained without contradiction?\n- Has hallucination of outside tools or unverifiable dependencies been eliminated?`;

  // Protected Section 4: Desired Output Contract (if specified)
  const secOutputContract = req.output_format?.trim()
    ? `# Desired Output Contract\n${cleanSurrogateBoundaries(req.output_format.trim())}`
    : null;

  // Fail-closed verification: Protected constraints alone must NOT exceed Free tier capacity ceiling
  const protectedSections = [secRole, secInvariants, secAcceptance];
  if (secOutputContract) protectedSections.push(secOutputContract);
  const minProtectedLength = protectedSections.join("\n\n").length;

  if (minProtectedLength > FREE_TIER_MAX_OUTPUT_CHARS) {
    throw new Error(
      `CAPACITY_ERROR_PROTECTED_CONSTRAINTS_EXCEED_CEILING: User hard constraints and acceptance invariants (${minProtectedLength} chars) exceed Free tier capacity ceiling of ${FREE_TIER_MAX_OUTPUT_CHARS} characters. Protected constraints cannot be silently dropped.`
    );
  }

  // Flexible Sections
  const secMethodology = `# Execution Methodology\n1. Analyze input requirements and isolate known constraints from unstated assumptions.\n2. Formulate step-by-step deliverables adhering strictly to verified facts.\n3. Validate output against acceptance criteria prior to final completion.`;
  const secMissingInfo = `# Handling Missing Information\nUse only confirmed user facts. If essential parameters are missing, state assumptions explicitly rather than fabricating dependencies.`;

  const objHeader = "# Core Mission & Objective\n";
  const objMeta = `\nCategory: ${category}\nTarget Model: ${targetModel}`;
  const currentGoal = goal || "Execute assigned directives accurately.";
  let secObjective = `${objHeader}Goal: ${currentGoal}${objMeta}`;

  const assemble = (objective: string, meth: string | null, missing: string | null): string => {
    const list: string[] = [secRole, objective, secInvariants];
    if (meth) list.push(meth);
    if (missing) list.push(missing);
    list.push(secAcceptance);
    if (secOutputContract) list.push(secOutputContract);
    return list.join("\n\n");
  };

  let finalPrompt = assemble(secObjective, secMethodology, secMissingInfo);

  // If total assembled prompt exceeds capacity ceiling, trim flexible narrative sections
  // while strictly protecting role, invariants, acceptance criteria, and output contract
  if (finalPrompt.length > FREE_TIER_MAX_OUTPUT_CHARS) {
    const fixedObjLen = objHeader.length + "Goal: ".length + objMeta.length;

    // Strategy 1: Trim goal within secObjective, keeping methodology and missing info intact
    const otherSections1 = [secRole, secInvariants, secMethodology, secMissingInfo, secAcceptance];
    if (secOutputContract) otherSections1.push(secOutputContract);
    const otherLen1 = otherSections1.reduce((sum, s) => sum + s.length, 0) + otherSections1.length * 2;
    const maxObjBudget1 = FREE_TIER_MAX_OUTPUT_CHARS - otherLen1;

    if (maxObjBudget1 >= fixedObjLen + 40) {
      const goalBudget = maxObjBudget1 - fixedObjLen;
      const trimmedGoal = truncateCleanly(currentGoal, goalBudget);
      secObjective = `${objHeader}Goal: ${trimmedGoal}${objMeta}`;
      finalPrompt = assemble(secObjective, secMethodology, secMissingInfo);
    } else {
      // Strategy 2: If invariants are very large, compress methodology and omit missing info
      const compactMethodology = `# Execution Methodology\nAnalyze requirements, strictly adhere to verified invariants, and validate output against acceptance criteria.`;
      const otherSections2 = [secRole, secInvariants, compactMethodology, secAcceptance];
      if (secOutputContract) otherSections2.push(secOutputContract);
      const otherLen2 = otherSections2.reduce((sum, s) => sum + s.length, 0) + otherSections2.length * 2;
      const maxObjBudget2 = FREE_TIER_MAX_OUTPUT_CHARS - otherLen2;

      if (maxObjBudget2 >= fixedObjLen + 20) {
        const goalBudget = maxObjBudget2 - fixedObjLen;
        const trimmedGoal = truncateCleanly(currentGoal, goalBudget);
        secObjective = `${objHeader}Goal: ${trimmedGoal}${objMeta}`;
        finalPrompt = assemble(secObjective, compactMethodology, null);
      } else {
        // Strategy 3: Minimal objective with remaining budget, omitting methodology and missing info
        const otherSectionsMin = [secRole, secInvariants, secAcceptance];
        if (secOutputContract) otherSectionsMin.push(secOutputContract);
        const otherLenMin = otherSectionsMin.reduce((sum, s) => sum + s.length, 0) + otherSectionsMin.length * 2;
        const maxObjBudgetMin = FREE_TIER_MAX_OUTPUT_CHARS - otherLenMin;
        const goalBudget = Math.max(10, maxObjBudgetMin - fixedObjLen);
        const trimmedGoal = truncateCleanly(currentGoal, goalBudget);
        secObjective = `${objHeader}Goal: ${trimmedGoal}${objMeta}`;
        finalPrompt = assemble(secObjective, null, null);
      }
    }

    warnings.push(
      `Output trimmed to Free tier capacity ceiling of ${FREE_TIER_MAX_OUTPUT_CHARS} characters while strictly preserving all operational invariants and acceptance verification criteria.`
    );
  }

  // Guarantee Unicode surrogate boundary safety at final tail
  finalPrompt = cleanSurrogateBoundaries(finalPrompt);

  // Verification Gate: Verify invariants and acceptance battery remain 100% intact
  if (finalPrompt.length > FREE_TIER_MAX_OUTPUT_CHARS) {
    throw new Error(
      `CAPACITY_ERROR_CEILING_EXCEEDED: Assembled prompt (${finalPrompt.length} chars) exceeds capacity ceiling of ${FREE_TIER_MAX_OUTPUT_CHARS} characters.`
    );
  }

  for (const c of constraints) {
    if (!finalPrompt.includes(c)) {
      throw new Error(
        `CAPACITY_ERROR_PROTECTED_CONSTRAINTS_EXCEED_CEILING: User hard constraint '${c}' was truncated at capacity ceiling of ${FREE_TIER_MAX_OUTPUT_CHARS} characters. Constraints must never be silently dropped.`
      );
    }
  }

  for (const dir of goalDirectives) {
    if (!finalPrompt.includes(dir)) {
      throw new Error(
        `CAPACITY_ERROR_PROTECTED_CONSTRAINTS_EXCEED_CEILING: User mandatory instruction '${dir}' from goal was truncated at capacity ceiling of ${FREE_TIER_MAX_OUTPUT_CHARS} characters. Mandatory obligations cannot be silently dropped.`
      );
    }
  }

  if (!finalPrompt.includes("# Operational & Security Invariants")) {
    throw new Error("CAPACITY_ERROR_INVARIANTS_MISSING: # Operational & Security Invariants section was dropped.");
  }

  if (!finalPrompt.includes("# Acceptance Verification Battery")) {
    throw new Error("CAPACITY_ERROR_ACCEPTANCE_MISSING: # Acceptance Verification Battery section was dropped.");
  }

  const cleanedOutputFormat = req.output_format?.trim()
    ? cleanSurrogateBoundaries(req.output_format.trim())
    : null;
  if (cleanedOutputFormat && !finalPrompt.includes(cleanedOutputFormat)) {
    throw new Error("CAPACITY_ERROR_OUTPUT_CONTRACT_MISSING: # Desired Output Contract was dropped.");
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
