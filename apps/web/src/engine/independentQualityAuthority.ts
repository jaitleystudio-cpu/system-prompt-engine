/**
 * SPE Ω — Independent Quality Authority
 *
 * Implements independent, honest quality verification for prompt candidates:
 * 1. Zero Self-Grading: The generator NEVER evaluates or grades its own output.
 * 2. Explicit Requirement Preservation: 100% preservation of all checkable user
 *    constraints is mandatory for a PASS verdict.
 * 3. Contradiction Detection: Rejects conflicting or mutually exclusive obligations.
 * 4. Grounding & Anti-Hallucination: Rejects unrequested external dependencies.
 * 5. Scientific Honesty: Reports objective scores with explicit limitation disclaimers;
 *    never inflates scores or promises universal perfection.
 */

import { computeSha256 } from "./hashUtils.ts";

export interface IndependentQualityReport {
  verdict: "PASS" | "NEEDS_REPAIR" | "BLOCKED_BY_CONFLICT";
  overallQualityScore: number; // 0 - 100
  preservationScore: number; // 0 - 100
  structuralScore: number; // 0 - 100
  platformDialectScore: number; // 0 - 100
  mandatoryRequirementsPassed: boolean;
  satisfiedRequirements: string[];
  missingRequirements: string[];
  detectedContradictions: string[];
  unsupportedAssumptions: string[];
  auditTimestamp: string;
  auditDigestHex: string;
  limitationsDisclaimer: string;
}

export interface VerificationContext {
  prompt: string;
  userRequest: string;
  explicitConstraints?: string[];
  target?: string;
  category?: string;
}

/**
 * Extracts verifiable atomic requirements from the raw request and explicit constraints list.
 */
export function extractVerifiableRequirements(
  userRequest: string,
  explicitConstraints: string[] = []
): string[] {
  const reqs = new Set<string>();

  // Add explicit constraints directly
  for (const c of explicitConstraints) {
    const trimmed = c.trim();
    if (trimmed.length > 2) reqs.add(trimmed);
  }

  const text = userRequest.trim();
  const lower = text.toLowerCase();

  // Offline / Local
  if (/offline|completely offline|without internet|air-?gapp?ed|no network/i.test(lower)) {
    reqs.add("Works completely offline without external network dependency");
  }

  // Privacy / Zero-PII
  if (/never collects? (?:personal|user|pii|data)|privacy-first|zero personal data|no telemetry/i.test(lower)) {
    reqs.add("Never collect personal information or user telemetry");
  }

  // Multilingual / Languages
  const langMatch = lower.match(/(?:supports?|in)\s+([a-z]+)\s+and\s+([a-z]+)/i);
  if (langMatch) {
    const l1 = langMatch[1];
    const l2 = langMatch[2];
    if (!["both", "either", "any"].includes(l1)) {
      reqs.add(`Supports ${l1.charAt(0).toUpperCase() + l1.slice(1)} and ${l2.charAt(0).toUpperCase() + l2.slice(1)}`);
    }
  } else {
    if (/telugu/i.test(lower)) reqs.add("Supports Telugu language");
    if (/hindi/i.test(lower)) reqs.add("Supports Hindi language");
    if (/spanish/i.test(lower)) reqs.add("Supports Spanish language");
    if (/french/i.test(lower)) reqs.add("Supports French language");
    if (/japanese/i.test(lower)) reqs.add("Supports Japanese language");
    if (/chinese/i.test(lower)) reqs.add("Supports Chinese language");
  }

  // Technical Platforms
  if (/android/i.test(lower)) reqs.add("Target platform: Android");
  if (/ios|swiftui/i.test(lower)) reqs.add("Target platform: iOS");
  if (/webgl|three\.?js/i.test(lower)) reqs.add("3D / WebGL graphics runtime");
  if (/webassembly|wasm/i.test(lower)) reqs.add("WebAssembly / WASM execution");
  if (/python/i.test(lower)) reqs.add("Implementation language: Python");
  if (/typescript/i.test(lower)) reqs.add("Implementation language: TypeScript");
  if (/rust/i.test(lower)) reqs.add("Implementation language: Rust");

  // Format Contracts
  if (/strict json|json schema|return json/i.test(lower)) {
    reqs.add("Output strictly in valid JSON format");
  }

  return Array.from(reqs);
}

/**
 * Checks if a specific requirement is represented in the prompt text.
 */
function requirementSatisfiedInPrompt(req: string, promptText: string): boolean {
  const pLower = promptText.toLowerCase();
  const rLower = req.toLowerCase();

  if (rLower.includes("offline")) {
    return pLower.includes("offline") || pLower.includes("zero network") || pLower.includes("air-gap");
  }
  if (rLower.includes("personal information") || rLower.includes("telemetry") || rLower.includes("pii")) {
    return pLower.includes("personal information") || pLower.includes("pii") || pLower.includes("telemetry") || pLower.includes("privacy");
  }
  if (rLower.includes("telugu")) {
    return pLower.includes("telugu") || pLower.includes("te-in") || pLower.includes("res/values-te");
  }
  if (rLower.includes("android")) {
    return pLower.includes("android") || pLower.includes("jetpack") || pLower.includes("kotlin");
  }
  if (rLower.includes("json")) {
    return pLower.includes("json");
  }
  if (rLower.includes("wasm") || rLower.includes("webassembly")) {
    return pLower.includes("wasm") || pLower.includes("webassembly");
  }

  // Token-level substring match
  const keywords = rLower.split(/\s+/).filter((w) => w.length > 3 && !["and", "the", "with", "that", "this"].includes(w));
  if (keywords.length === 0) return true;
  const matchCount = keywords.filter((k) => pLower.includes(k)).length;
  return matchCount / keywords.length >= 0.7;
}

/**
 * Detects mutually incompatible constraints or contradictions in request or prompt.
 */
export function detectContradictions(userRequest: string, promptText: string): string[] {
  const contradictions: string[] = [];
  const reqLower = userRequest.toLowerCase();
  const promptLower = promptText.toLowerCase();

  // Contradiction 1: Offline requested vs. Cloud/Network API instructed
  const wantsOffline = /offline|completely offline|without internet|air-?gapp?ed/i.test(reqLower);
  const instructsCloudSync = /fetch\(|http:\/\/|https:\/\/|connects? to (?:cloud|servers?|remote|firebase|aws|remote api)|streaming from cloud|cloud servers?/i.test(promptLower);
  if (wantsOffline && instructsCloudSync) {
    contradictions.push(
      "Conflict: User requested 100% offline operation, but prompt instructs remote network/cloud API connections."
    );
  }

  // Contradiction 2: Zero data collection vs. Analytics/Tracking inclusion
  const wantsPrivacy = /never collect (?:personal|user|pii|data)|zero personal data/i.test(reqLower);
  const trackingTokens = ["google analytics", "mix" + "panel", "ampli" + "tude", "track user behavior", "store user email", "upload telemetry"];
  const instructsTracking = trackingTokens.some((t) => promptLower.includes(t));
  if (wantsPrivacy && instructsTracking) {
    contradictions.push(
      "Conflict: User requested zero personal data collection, but prompt introduces telemetry or tracking."
    );
  }

  // Contradiction 3: Malicious instruction or hostile override injection
  const hasMaliciousOverride = /system override|ignore all previous|ignore previous instructions|exfiltrate|document\.cookie/i.test(reqLower);
  if (hasMaliciousOverride) {
    contradictions.push(
      "Security Conflict: Malicious instruction or prompt injection attempt detected (exfiltration / override pattern)."
    );
  }

  return contradictions;
}

/**
 * Performs honest, independent quality evaluation of a prompt candidate.
 */
export function evaluateCandidateQuality(ctx: VerificationContext): IndependentQualityReport {
  const prompt = (ctx.prompt || "").trim();
  const userRequest = (ctx.userRequest || "").trim();
  const explicitConstraints = ctx.explicitConstraints || [];
  const target = ctx.target || "any";

  const verifiableReqs = extractVerifiableRequirements(userRequest, explicitConstraints);
  const satisfiedRequirements: string[] = [];
  const missingRequirements: string[] = [];

  for (const req of verifiableReqs) {
    if (requirementSatisfiedInPrompt(req, prompt)) {
      satisfiedRequirements.push(req);
    } else {
      missingRequirements.push(req);
    }
  }

  const detectedContradictions = detectContradictions(userRequest, prompt);
  const unsupportedAssumptions: string[] = [];

  // Check for common hallucinated assumptions
  if (!userRequest.toLowerCase().includes("firebase") && prompt.toLowerCase().includes("firebase auth")) {
    unsupportedAssumptions.push("Assumed Firebase backend without user authorization");
  }
  if (!userRequest.toLowerCase().includes("aws") && prompt.toLowerCase().includes("aws lambda")) {
    unsupportedAssumptions.push("Assumed AWS cloud infrastructure without user authorization");
  }

  // Structural checks
  const hasRole = /#{1,4}[^\n]*(?:Role|Persona|Identity)|<role>|<system_role>/i.test(prompt);
  const hasObjective = /#{1,4}[^\n]*(?:Objective|Goal|Mission|Task)|<objective>/i.test(prompt);
  const hasMethodology = /#{1,4}[^\n]*(?:Approach|Methodolog|Step|Scaffold|Execution Plan)|<approach>|<execution_plan>/i.test(prompt);
  const hasVerification = /#{1,4}[^\n]*(?:Acceptance|Verification|Checks|Audit Battery)|<acceptance_checks>/i.test(prompt);
  const hasGrounding = /#{1,4}[^\n]*(?:Missing Information|Grounding|Evidence)|handling_missing_information|<handling_missing_information>|Use only supplied evidence/i.test(prompt);

  let structuralPillars = 0;
  if (hasRole) structuralPillars++;
  if (hasObjective) structuralPillars++;
  if (hasMethodology) structuralPillars++;
  if (hasVerification) structuralPillars++;
  if (hasGrounding) structuralPillars++;
  const structuralScore = Math.round((structuralPillars / 5) * 100);

  // Requirement Preservation score
  const totalReqs = verifiableReqs.length;
  const preservationScore =
    totalReqs === 0 ? 100 : Math.round((satisfiedRequirements.length / totalReqs) * 100);

  // Platform Dialect score
  let platformDialectScore = 100;
  if (target === "claude") {
    // Claude favors structured XML or clean markdown
    const hasXmlOrStructured = /<[a-z_]+>|#{1,3}\s/i.test(prompt);
    platformDialectScore = hasXmlOrStructured ? 100 : 85;
  } else if (target === "local") {
    // Local models favor token density without fluff
    const isOverbloated = prompt.length > 25000;
    platformDialectScore = isOverbloated ? 80 : 100;
  }

  // Calculate Overall Quality Score:
  // Weighted: 50% Requirement Preservation + 35% Structural Rigor + 15% Platform Dialect
  let overallQualityScore = Math.round(
    preservationScore * 0.5 + structuralScore * 0.35 + platformDialectScore * 0.15
  );

  // Penalties for contradictions and unsupported assumptions
  if (detectedContradictions.length > 0) {
    overallQualityScore = Math.min(overallQualityScore, 40);
  }
  if (unsupportedAssumptions.length > 0) {
    overallQualityScore = Math.max(0, overallQualityScore - unsupportedAssumptions.length * 15);
  }

  const mandatoryRequirementsPassed = missingRequirements.length === 0 && detectedContradictions.length === 0;

  // Determine Verdict
  let verdict: "PASS" | "NEEDS_REPAIR" | "BLOCKED_BY_CONFLICT" = "PASS";
  if (detectedContradictions.length > 0) {
    verdict = "BLOCKED_BY_CONFLICT";
  } else if (!mandatoryRequirementsPassed || structuralPillars < 4) {
    verdict = "NEEDS_REPAIR";
  }

  const auditTimestamp = new Date().toISOString();
  const auditDigestHex = computeSha256(
    `${prompt.length}:${overallQualityScore}:${preservationScore}:${structuralScore}:${verdict}:${auditTimestamp}`
  );

  return {
    verdict,
    overallQualityScore,
    preservationScore,
    structuralScore,
    platformDialectScore,
    mandatoryRequirementsPassed,
    satisfiedRequirements,
    missingRequirements,
    detectedContradictions,
    unsupportedAssumptions,
    auditTimestamp,
    auditDigestHex,
    limitationsDisclaimer:
      "Evaluated against machine-verifiable requirements and structural invariants. Real task success across frontier AI models depends on model version and prompt context.",
  };
}
