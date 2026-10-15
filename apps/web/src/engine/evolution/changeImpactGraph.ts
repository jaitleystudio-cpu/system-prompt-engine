/**
 * SPE Ω — Website Change-Impact Graph & Cross-Page Promise Consistency Engine
 *
 * Mandate:
 * Grounded in:
 * - LOLA (Marketing Science 2024): Controlled content experimentation.
 * - LLMorph (2026): Metamorphic testing across semantic boundaries.
 * - Cross-Page Promise Consistency: Detects discrepancies between homepage,
 *   pricing, capabilities, and privacy contracts.
 * - Versioned Product-Truth Graph: Prevents unreleased features from being advertised as shipped.
 */

import { SHIPPED_CAPABILITIES, FORBIDDEN_PROMISES, BANNED_BUZZWORDS } from "../heroIntelligence/productPromiseContract.ts";

export interface ChangeImpactResult {
  directRoutesAffected: string[];
  downstreamRoutesAffected: string[];
  affectedComponents: string[];
  requiredTestSuites: string[];
  crossPageContradictions: Array<{
    sourceRoute: string;
    conflictingRoute: string;
    claim: string;
    reason: string;
  }>;
  productTruthViolations: string[];
  riskEscalationReason?: string;
  recommendedRiskLevel: "LOW" | "MEDIUM" | "HIGH";
}

export class WebsiteChangeImpactGraph {
  /**
   * Traverses change dependencies and checks cross-page contracts.
   */
  public analyzeImpact(change: {
    modifiedFile: string;
    targetRoute: string;
    proposedCopySnippet?: string;
    modifiedProps?: string[];
  }): ChangeImpactResult {
    const directRoutes: string[] = [change.targetRoute];
    const downstreamRoutes: string[] = [];
    const affectedComponents: string[] = [];
    const requiredTests: string[] = [];
    const crossPageContradictions: ChangeImpactResult["crossPageContradictions"] = [];
    const productTruthViolations: string[] = [];

    // 1. Traverse Route Graph
    if (change.targetRoute === "/" || change.modifiedFile.includes("Hero.tsx")) {
      affectedComponents.push("Hero", "SurfaceInventory", "AppShell");
      downstreamRoutes.push("/create", "/code", "/pricing", "/capabilities");
      requiredTests.push(
        "test-global-hero-intelligence.mjs",
        "test-plain-english-showcase.mjs",
        "test-autonomous-evolution.mjs"
      );
    } else if (change.targetRoute === "/code") {
      affectedComponents.push("CodeStudio", "VisionScaffold");
      requiredTests.push("test-screenshot-real-fidelity.mjs");
    } else if (change.targetRoute === "/pricing") {
      affectedComponents.push("PricingPlans", "EntitlementMatrix");
      downstreamRoutes.push("/");
      requiredTests.push("test-pro-features.mjs");
    } else if (change.targetRoute === "/create") {
      affectedComponents.push("PromptEditor", "PromptSynthesizer");
      requiredTests.push("test-spe-omega-proof-engine.mjs");
    } else {
      affectedComponents.push("GenericPageShell");
      requiredTests.push("test-universal-shell.mjs");
    }

    // 2. Cross-Page Promise Consistency & Product-Truth Verification
    if (change.proposedCopySnippet) {
      const lower = change.proposedCopySnippet.toLowerCase();

      // Check against forbidden / unreleased promises
      for (const forbidden of FORBIDDEN_PROMISES) {
        if (forbidden.pattern.test(change.proposedCopySnippet)) {
          productTruthViolations.push(
            `Proposed copy claims unreleased/unsupported capability: ${forbidden.reason}`
          );
        }
      }

      // Check against banned marketing buzzwords
      for (const buzz of BANNED_BUZZWORDS) {
        if (lower.includes(buzz)) {
          productTruthViolations.push(
            `Hyperbolic marketing buzzword detected: "${buzz}". Violates engineer-to-engineer contract.`
          );
        }
      }

      // Check Pricing contradictions
      if (change.targetRoute === "/" && (lower.includes("unlimited cloud team collaboration for free") || lower.includes("cloud api free"))) {
        crossPageContradictions.push({
          sourceRoute: "/",
          conflictingRoute: "/pricing",
          claim: "Free cloud team features",
          reason: "Contradicts /pricing contract: Team cloud features require paid subscription, while on-device core is free.",
        });
      }

      // Check Privacy contradictions
      if (lower.includes("uploaded to cloud") || lower.includes("server-side ai generation")) {
        crossPageContradictions.push({
          sourceRoute: change.targetRoute,
          conflictingRoute: "/privacy",
          claim: "Server upload of prompt bytes",
          reason: "Strictly violates /privacy guarantee: SPE compiles prompts 100% locally on-device with zero egress.",
        });
      }

      // Reference Shipped Capabilities
      const hasCapabilityAlignment = Object.values(SHIPPED_CAPABILITIES).some((cap) =>
        cap.keywords.some((kw) => lower.includes(kw))
      );
      if (!hasCapabilityAlignment && productTruthViolations.length === 0) {
        // Just informative check
      }
    }

    // 3. Determine Risk Classification
    let recommendedRisk: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    let riskEscalationReason: string | undefined;

    const lowerCopy = (change.proposedCopySnippet || "").toLowerCase();
    const isCompilerOrSpe =
      change.modifiedFile.includes("promptSynthesizer") ||
      change.modifiedFile.includes("spe-wasm") ||
      lowerCopy.includes(".spe") ||
      lowerCopy.includes("compiler");

    const isHighRiskSurface =
      change.modifiedFile.includes("robots.txt") ||
      change.modifiedFile.includes("modelAtlas") ||
      change.modifiedFile.includes("modelCurrencyGovernor") ||
      change.targetRoute === "/privacy" ||
      change.targetRoute === "/pricing";

    if (productTruthViolations.length > 0 || crossPageContradictions.length > 0) {
      recommendedRisk = "HIGH";
      riskEscalationReason = "Cross-page promise inconsistency or unreleased capability claim detected.";
    } else if (isCompilerOrSpe) {
      recommendedRisk = "HIGH";
      riskEscalationReason = ".spe format compatibility or compiler behavior change detected.";
    } else if (isHighRiskSurface) {
      recommendedRisk = "HIGH";
      riskEscalationReason = "High-risk surface, model registry, or indexing change detected.";
    } else if (change.targetRoute === "/" || change.modifiedFile.includes("routing.ts")) {
      recommendedRisk = "MEDIUM";
      riskEscalationReason = "High-impact surface modification affecting multiple landing pages.";
    }

    return {
      directRoutesAffected: directRoutes,
      downstreamRoutesAffected: downstreamRoutes,
      affectedComponents,
      requiredTestSuites: requiredTests,
      crossPageContradictions,
      productTruthViolations,
      riskEscalationReason,
      recommendedRiskLevel: recommendedRisk,
    };
  }
}
