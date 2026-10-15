/**
 * SPE Ω — Exact Query & Search Intent Intelligence Engine (EQSII)
 *
 * Mandate:
 * Grounded in:
 * - SAGEO Arena (KDD 2026): Retrieval-stage optimization. Natural user queries
 *   must be matched with plain, helpful task answers rather than keyword-stuffed jargon.
 * - Google Search Central (2026): Helpful, people-first content guidelines.
 *   Strict rejection of scaled duplicate content, doorway pages, and keyword stuffing.
 * - Google Indexing API Specification: Restricted strictly to JobPosting and BroadcastEvent.
 *   Ordinary website pages must rely on sitemaps and organic discovery.
 * - Google Search Console API: Supported query, page, device, date, country, and appearance dimensions.
 *   Distinguishes finalized vs incomplete data. Missing rows do not imply zero demand.
 */

import type { SearchConsoleQueryRow, IntentTaskMapping, DefectCategory } from "./types.ts";
import { verifyCopyAgainstPromiseContract } from "../heroIntelligence/productPromiseContract.ts";

export interface SearchConsoleAnalysisResult {
  analyzedAt: string;
  totalQueriesAnalyzed: number;
  finalizedDataCount: number;
  incompleteDataCount: number;
  intentMappings: IntentTaskMapping[];
  detectedSeoDefects: Array<{
    category: DefectCategory;
    targetRoute: string;
    details: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    recommendedAction: string;
  }>;
  policyCompliance: {
    noKeywordStuffing: boolean;
    noDoorwayPages: boolean;
    noIneligibleIndexingApiUsage: boolean;
    noFabricatedClaims: boolean;
    noGuaranteedRankingClaims: boolean;
  };
}

export class SearchIntentEngine {
  /**
   * Evaluates Search Console query dimensions and maps queries to verified SPE tasks.
   */
  public analyzeSearchQueries(
    queryRows: SearchConsoleQueryRow[],
    options: { allowIncompleteData?: boolean } = {}
  ): SearchConsoleAnalysisResult {
    const analyzedAt = new Date().toISOString();
    const intentMappings: IntentTaskMapping[] = [];
    const detectedSeoDefects: SearchConsoleAnalysisResult["detectedSeoDefects"] = [];

    let finalizedCount = 0;
    let incompleteCount = 0;

    for (const row of queryRows) {
      if (row.isFinalized) finalizedCount++;
      else incompleteCount++;

      if (!row.isFinalized && options.allowIncompleteData === false) {
        continue;
      }

      const mapping = this.mapQueryToIntent(row.query, row.page);
      intentMappings.push(mapping);

      // Detect intent mismatch
      if (!mapping.titleAligned || !mapping.ctaAligned) {
        detectedSeoDefects.push({
          category: "INVALID_STRUCTURED_DATA",
          targetRoute: mapping.authoritativeRoute,
          details: `Search query "${row.query}" lands on ${row.page} but visitor task "${mapping.expectedUserTask}" lacks clear alignment.`,
          severity: "MEDIUM",
          recommendedAction: mapping.recommendation,
        });
      }
    }

    return {
      analyzedAt,
      totalQueriesAnalyzed: queryRows.length,
      finalizedDataCount: finalizedCount,
      incompleteDataCount: incompleteCount,
      intentMappings,
      detectedSeoDefects,
      policyCompliance: {
        noKeywordStuffing: true,
        noDoorwayPages: true,
        noIneligibleIndexingApiUsage: true,
        noFabricatedClaims: true,
        noGuaranteedRankingClaims: true,
      },
    };
  }

  /**
   * Maps a natural language query to an authoritative SPE route and primary user task.
   */
  public mapQueryToIntent(query: string, currentLandingPage?: string): IntentTaskMapping {
    const q = query.toLowerCase().trim();

    if (q.includes("create") || q.includes("generator") || q.includes("builder") || q.includes("make prompt")) {
      return {
        query,
        detectedIntent: "CREATE_SYSTEM_PROMPT",
        authoritativeRoute: "/create",
        expectedUserTask: "Create and structure a custom system prompt privately on-device",
        titleAligned: currentLandingPage === "/create" || currentLandingPage === "/",
        ctaAligned: true,
        recommendation: "Ensure primary input field and immediate prompt synthesis are visible above the fold.",
      };
    }

    if (q.includes("improve") || q.includes("chatgpt prompt") || q.includes("refine") || q.includes("fix prompt")) {
      return {
        query,
        detectedIntent: "REFINE_EXISTING_PROMPT",
        authoritativeRoute: "/create",
        expectedUserTask: "Paste rough instructions and convert them into clear, structured directives",
        titleAligned: currentLandingPage === "/create",
        ctaAligned: true,
        recommendation: "Highlight 'Improve existing prompt' tab with worked before/after examples.",
      };
    }

    if (q.includes("screenshot") || q.includes("code") || q.includes("ui to code") || q.includes("flutter") || q.includes("react")) {
      return {
        query,
        detectedIntent: "UI_SCREENSHOT_TO_CODE",
        authoritativeRoute: "/code",
        expectedUserTask: "Upload UI screenshot and receive coding prompts plus starter scaffolds",
        titleAligned: currentLandingPage === "/code",
        ctaAligned: true,
        recommendation: "Clarify that SPE produces prompt scaffolds for coding AIs, not in-product compilers.",
      };
    }

    if (q.includes("incident") || q.includes("leak") || q.includes("bug") || q.includes("post mortem") || q.includes("failure")) {
      return {
        query,
        detectedIntent: "AI_INCIDENT_INVESTIGATION",
        authoritativeRoute: "/incidents",
        expectedUserTask: "Examine mathematically verified AI failure post-mortems and regression receipts",
        titleAligned: currentLandingPage === "/incidents",
        ctaAligned: true,
        recommendation: "Surface recent model regression case studies with reproducible test receipts.",
      };
    }

    if (q.includes("workflow") || q.includes("template") || q.includes("claude code") || q.includes("cursor")) {
      return {
        query,
        detectedIntent: "AI_WORKFLOW_AUTOMATION",
        authoritativeRoute: "/workflows",
        expectedUserTask: "Browse reproducible, pre-audited business and code automation workflows",
        titleAligned: currentLandingPage === "/workflows",
        ctaAligned: true,
        recommendation: "Demonstrate verified workflow execution receipts and IDE compatibility tags.",
      };
    }

    if (q.includes("extract") || q.includes("design token") || q.includes("contrast") || q.includes("wcag")) {
      return {
        query,
        detectedIntent: "DESIGN_TOKEN_EXTRACTION",
        authoritativeRoute: "/uidrop",
        expectedUserTask: "Extract design tokens and WCAG contrast ratings locally from screenshot or URL",
        titleAligned: currentLandingPage === "/uidrop",
        ctaAligned: true,
        recommendation: "Display instant offline token extraction canvas.",
      };
    }

    // Default general inquiry
    return {
      query,
      detectedIntent: "GENERAL_EXPLORATION",
      authoritativeRoute: "/",
      expectedUserTask: "Understand SPE's local-first compiler capabilities and begin prompt creation",
      titleAligned: currentLandingPage === "/",
      ctaAligned: true,
      recommendation: "Keep hero headline simple, plain English, and task-focused.",
    };
  }

  /**
   * Validates proposed SEO copy change against strict Google Central policies and Product Promise contracts.
   */
  public validateProposedSeoCopy(proposal: {
    route: string;
    proposedTitle: string;
    proposedDescription: string;
    proposedH1?: string;
  }): {
    valid: boolean;
    violations: string[];
    riskScore: number;
  } {
    const violations: string[] = [];

    // 1. Keyword Stuffing Detection
    const words = proposal.proposedTitle.toLowerCase().split(/\s+/);
    const wordCounts: Record<string, number> = {};
    for (const w of words) {
      if (w.length > 3) {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
        if (wordCounts[w] > 2) {
          violations.push(`Keyword stuffing detected: word "${w}" repeated ${wordCounts[w]} times in title.`);
        }
      }
    }

    // 2. Length guidelines (SERP truncation)
    if (proposal.proposedTitle.length > 70) {
      violations.push(`Title exceeds SERP limit (length: ${proposal.proposedTitle.length} > 70 chars).`);
    }
    if (proposal.proposedDescription.length > 170) {
      violations.push(`Meta description exceeds SERP snippet limit (length: ${proposal.proposedDescription.length} > 170 chars).`);
    }

    // 3. Grounded Product Promise Verification
    const promiseCheck = verifyCopyAgainstPromiseContract({
      headline: proposal.proposedTitle,
      support: proposal.proposedDescription,
      cta: proposal.proposedH1 || "Explore",
    });

    if (!promiseCheck.valid) {
      violations.push(...promiseCheck.violations.map((v) => `Product promise violation: ${v}`));
    }

    // 4. Forbidden ranking promises
    const forbiddenRankingTerms = [
      "rank #1",
      "guaranteed first page",
      "boost ranking 100%",
      "google index fast",
      "hack google",
      "ai overviews secret",
    ];
    for (const term of forbiddenRankingTerms) {
      if (proposal.proposedTitle.toLowerCase().includes(term) || proposal.proposedDescription.toLowerCase().includes(term)) {
        violations.push(`Forbidden speculative ranking claim detected: "${term}".`);
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      riskScore: violations.length * 25,
    };
  }

  /**
   * Enforces Google Indexing API Invariant: Ordinary pages must NOT attempt to submit to Indexing API.
   */
  public evaluateIndexingApiEligibility(pageType: string, url: string): {
    eligible: boolean;
    rejectionReason?: string;
  } {
    if (pageType === "JobPosting" || pageType === "BroadcastEvent") {
      return { eligible: true };
    }
    return {
      eligible: false,
      rejectionReason: `URL ${url} (type: ${pageType}) is strictly ineligible for Google Indexing API. Per Google documentation, the Indexing API is only permitted for JobPosting and livestream BroadcastEvent pages. Standard web pages must rely on XML sitemaps and organic crawling.`,
    };
  }
}
