/**
 * SPE Ω — Dual-Core Intelligence Router
 *
 * Enforces the strict Dual-Core Authority Order:
 * 1. CORE A IS PRIMARY: Genuine Generative Prompt Engine with Intent Reconstruction,
 *    Contextual Reasoning, and Bounded Candidate Repair.
 * 2. CORE B IS PLAN B: Deterministic Fallback Compiler that operates when Core A is
 *    unavailable, unsupported, or fails qualification.
 * 3. TRANSPARENCY: Fallback never masquerades as successful generative AI.
 * 4. CONFLICT DISCLOSURE: Unresolvable contradictions are flagged; never silently resolved.
 * 5. AIR-GAP INVARIANT: 100% offline, $0 cost, zero network egress.
 */

import { generateCoreAPrompt } from "./core-a.ts";
import type { CoreAGenerationRequest } from "./core-a.ts";
import { createRawRequestCustody, renderSafeFallbackPrompt } from "./core-b.mjs";
import { computeSha256 } from "./hashUtils.ts";
import type { IndependentQualityReport } from "./independentQualityAuthority.ts";

export type DualCoreStatus =
  | "QUALIFIED_GENERATIVE_SUCCESS"
  | "REPAIRED_GENERATIVE_SUCCESS"
  | "DEGRADED_FALLBACK_DELIVERY"
  | "CONTRADICTION_BLOCKED";

export const CORE_A_ENGINE_TAG = "CORE_A_GENERATIVE" as const;
export const CORE_B_ENGINE_TAG = "CORE_B_FALLBACK" as const;
export const CONTRADICTION_BLOCKED_STATUS = "CONTRADICTION_BLOCKED" as const;

export const CORE_A_PROMPT_LABEL = "Core A Primary Generative Intelligence";
export const CORE_B_PROMPT_LABEL = "Core B Deterministic Fallback Compiler";

export function formatDualCoreTechniques(
  isCoreA: boolean,
  baseTechniques: string[]
): string[] {
  return [isCoreA ? CORE_A_PROMPT_LABEL : CORE_B_PROMPT_LABEL, ...baseTechniques];
}

export function formatContradictionError(fallbackReason?: string): string {
  return `Conflict detected: ${fallbackReason || "Mutually exclusive constraints cannot be satisfied simultaneously."}`;
}

export interface DualCoreGenerationRequest extends CoreAGenerationRequest {
  forceFallbackCoreB?: boolean;
}

export interface DualCoreGenerationResult {
  engineCoreUsed: "CORE_A_GENERATIVE" | "CORE_B_FALLBACK";
  status: DualCoreStatus;
  prompt: string;
  rawRequest: string;
  target?: string;
  qualityReport?: IndependentQualityReport;
  coreARuntime?: string;
  repairPasses: number;
  isFallback: boolean;
  fallbackReason?: string;
  latencyMs: number;
  zeroEgressGuaranteed: true;
  costUsd: 0;
  auditDigestHex: string;
}

/**
 * Routes prompt generation through the dual-core pipeline.
 */
export async function executeDualCoreGeneration(
  req: DualCoreGenerationRequest
): Promise<DualCoreGenerationResult> {
  const startTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  const rawRequest = (req.userRequest || "").trim();
  const target = req.target || "any";

  // Check 1: If caller explicitly forced Core B fallback (e.g. device unable to run generative runtime)
  if (req.forceFallbackCoreB) {
    const custody = await createRawRequestCustody({
      rawRequest,
      target: target === "any" ? null : target,
      explicitConstraints: req.explicitConstraints,
    });
    const fallbackArtifact = renderSafeFallbackPrompt(custody, "FORCED_DEVICE_FALLBACK");
    const endTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const latencyMs = Math.max(0.001, Number((endTime - startTime).toFixed(3)));

    return {
      engineCoreUsed: "CORE_B_FALLBACK",
      status: "DEGRADED_FALLBACK_DELIVERY",
      prompt: fallbackArtifact.prompt,
      rawRequest,
      target,
      repairPasses: 0,
      isFallback: true,
      fallbackReason: "FORCED_DEVICE_FALLBACK",
      latencyMs,
      zeroEgressGuaranteed: true,
      costUsd: 0,
      auditDigestHex: computeSha256(`core_b:${fallbackArtifact.custody_id}:${Date.now()}`),
    };
  }

  // Check 2: Execute Primary Core A (Generative Engine)
  try {
    const coreAResult = await generateCoreAPrompt(req);

    // If Core A detected unresolvable contradictions, block with transparent reason
    if (coreAResult.status === "CONTRADICTION_BLOCKED") {
      const endTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      const latencyMs = Math.max(0.001, Number((endTime - startTime).toFixed(3)));
      return {
        engineCoreUsed: "CORE_A_GENERATIVE",
        status: "CONTRADICTION_BLOCKED",
        prompt: "",
        rawRequest,
        target,
        qualityReport: coreAResult.qualityReport,
        coreARuntime: coreAResult.runtimeUsed,
        repairPasses: coreAResult.repairPasses,
        isFallback: false,
        fallbackReason: coreAResult.blockingReason || "MUTUALLY_EXCLUSIVE_CONSTRAINTS",
        latencyMs,
        zeroEgressGuaranteed: true,
        costUsd: 0,
        auditDigestHex: coreAResult.executionDigestHex,
      };
    }

    // If Core A succeeded directly or via bounded repair
    if (
      coreAResult.status === "QUALIFIED_GENERATIVE_SUCCESS" ||
      coreAResult.status === "REPAIRED_GENERATIVE_SUCCESS"
    ) {
      const endTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      const latencyMs = Math.max(0.001, Number((endTime - startTime).toFixed(3)));
      return {
        engineCoreUsed: "CORE_A_GENERATIVE",
        status: coreAResult.status,
        prompt: coreAResult.prompt,
        rawRequest,
        target,
        qualityReport: coreAResult.qualityReport,
        coreARuntime: coreAResult.runtimeUsed,
        repairPasses: coreAResult.repairPasses,
        isFallback: false,
        latencyMs,
        zeroEgressGuaranteed: true,
        costUsd: 0,
        auditDigestHex: coreAResult.executionDigestHex,
      };
    }

    // If Core A exhausted repair budget without passing mandatory requirements -> Invoke Core B
    const custody = await createRawRequestCustody({
      rawRequest,
      target: target === "any" ? null : target,
      explicitConstraints: req.explicitConstraints,
    });
    const fallbackArtifact = renderSafeFallbackPrompt(custody, "CORE_A_REPAIR_EXHAUSTED");
    const endTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const latencyMs = Math.max(0.001, Number((endTime - startTime).toFixed(3)));

    return {
      engineCoreUsed: "CORE_B_FALLBACK",
      status: "DEGRADED_FALLBACK_DELIVERY",
      prompt: fallbackArtifact.prompt,
      rawRequest,
      target,
      qualityReport: coreAResult.qualityReport,
      repairPasses: coreAResult.repairPasses,
      isFallback: true,
      fallbackReason: "CORE_A_REPAIR_EXHAUSTED",
      latencyMs,
      zeroEgressGuaranteed: true,
      costUsd: 0,
      auditDigestHex: computeSha256(`core_b:${fallbackArtifact.custody_id}:${Date.now()}`),
    };
  } catch (err) {
    // If Core A encountered runtime exception (e.g. WASM/worker crash), smoothly recover with Core B
    const custody = await createRawRequestCustody({
      rawRequest,
      target: target === "any" ? null : target,
      explicitConstraints: req.explicitConstraints,
    });
    const reasonCode = err instanceof Error ? err.message : "CORE_A_EXCEPTION";
    const fallbackArtifact = renderSafeFallbackPrompt(custody, reasonCode);
    const endTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const latencyMs = Math.max(0.001, Number((endTime - startTime).toFixed(3)));

    return {
      engineCoreUsed: "CORE_B_FALLBACK",
      status: "DEGRADED_FALLBACK_DELIVERY",
      prompt: fallbackArtifact.prompt,
      rawRequest,
      target,
      repairPasses: 0,
      isFallback: true,
      fallbackReason: reasonCode,
      latencyMs,
      zeroEgressGuaranteed: true,
      costUsd: 0,
      auditDigestHex: computeSha256(`core_b:${fallbackArtifact.custody_id}:${Date.now()}`),
    };
  }
}
