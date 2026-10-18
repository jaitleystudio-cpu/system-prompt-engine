/**
 * SPE Ω — Root-Cause Repair Selection & Isolated Patch Engine (RCRS-IPE)
 *
 * Mandate:
 * Grounded in:
 * - SWE-bench Goes Live! (NeurIPS 2025): Mandatory failing test before fix.
 *   Defect reproduction -> Isolated worktree -> Targeted patch -> Regression suite.
 * - Agentic Program Repair from Test Failures at Scale (2025): Bounded search,
 *   minimal patch diff, oscillation braking.
 * - Invariant: NEVER write or merge directly to main.
 */

import type { DefectCategory } from "./types.ts";

export interface RepairCandidate {
  defectCategory: DefectCategory;
  symptom: string;
  rootCause: string;
  isolatedBranch: string;
  targetFile: string;
  failingTestName: string;
  failingTestCode: string;
  failingTestBeforeFix: {
    testName: string;
    failingOutput: string;
    reproduced: boolean;
  };
  minimalPatch: {
    targetFile: string;
    originalChunk: string;
    replacementChunk: string;
    lineCountDiff: number;
  };
  iterationCount: number;
  maxIterations: number;
  oscillationBrakeTriggered: boolean;
}

export class RootCauseRepairEngine {
  private maxIterationsAllowed = 3;

  /**
   * Prepares a proposed reproduction test and repair. This method does NOT execute tests.
   * Reproduction may only be promoted after a separate, evidence-backed execution.
   */
  public diagnoseAndPrepareRepair(defect: {
    category: DefectCategory;
    reportedSymptom: string;
    context: Record<string, unknown>;
  }): RepairCandidate {
    let rootCause = "Unknown configuration or logic defect.";
    let targetFile = "apps/web/src/routing.ts";
    let failingTestName = `test_reproduce_${defect.category.toLowerCase()}`;
    let failingTestCode = "";
    let originalChunk = "";
    let replacementChunk = "";

    switch (defect.category) {
      case "BROKEN_INTERNAL_LINK": {
        const brokenHref = String(defect.context.brokenHref || "/skills");
        const authoritativeDestination = String(defect.context.authoritativeDestination || "/build-skill");
        rootCause = `Link points to legacy unmapped route "${brokenHref}". Authoritative active view is "${authoritativeDestination}".`;
        targetFile = "apps/web/src/routing.ts";
        failingTestName = "test_reproduce_broken_internal_link";
        failingTestCode = `
// REPRODUCTION TEST BEFORE FIX
const resolved = resolveRoute("${brokenHref}");
assert.equal(resolved.kind, "view", "Route ${brokenHref} must resolve to authoritative view");
assert.equal(resolved.canonicalPath, "${authoritativeDestination}");
`;
        originalChunk = `// Broken link placeholder: ${brokenHref}`;
        replacementChunk = `ROUTE_ALIASES["${brokenHref}"] = "${authoritativeDestination}";`;
        break;
      }

      case "MOBILE_CLIPPING": {
        const headlineSelector = String(defect.context.selector || ".hero-headline");
        rootCause = `Hero headline container has rigid 'white-space: nowrap' causing horizontal clipping on viewports < 400px.`;
        targetFile = "apps/web/src/landing/Hero.tsx";
        failingTestName = "test_reproduce_mobile_headline_clipping";
        failingTestCode = `
// REPRODUCTION TEST BEFORE FIX: Viewport 375px
const box = await getBoundingBox("${headlineSelector}");
assert.ok(box.scrollWidth <= box.width, "Headline must not clip on 375px mobile viewport");
`;
        originalChunk = `className="hero-headline whitespace-nowrap"`;
        replacementChunk = `className="hero-headline text-balance break-words"`;
        break;
      }

      case "CANONICAL_CONFLICT": {
        const wrongCanonical = String(defect.context.canonical || "http://systempromptengine.com/");
        rootCause = `Canonical tag uses insecure 'http' (${wrongCanonical}) instead of authoritative HTTPS origin.`;
        targetFile = "apps/web/src/routing.ts";
        failingTestName = "test_reproduce_canonical_https_enforcement";
        failingTestCode = `
assert.ok(absoluteUrl("/").startsWith("https://systempromptengine.com"), "Canonical URL must enforce HTTPS scheme");
`;
        originalChunk = `const SITE = "http://systempromptengine.com";`;
        replacementChunk = `const SITE = "https://systempromptengine.com";`;
        break;
      }

      case "SITEMAP_INCONSISTENCY": {
        const missingRoute = String(defect.context.missingRoute || "/workflows");
        rootCause = `Public indexable route "${missingRoute}" was omitted from sitemap generator configuration.`;
        targetFile = "apps/web/public/sitemap.xml";
        failingTestName = "test_reproduce_sitemap_completeness";
        failingTestCode = `
assert.ok(sitemapXmlContent.includes("<loc>https://systempromptengine.com${missingRoute}</loc>"), "Sitemap must include indexable route ${missingRoute}");
`;
        originalChunk = `<!-- SITEMAP_END -->`;
        replacementChunk = `<url><loc>https://systempromptengine.com${missingRoute}</loc></url>\n<!-- SITEMAP_END -->`;
        break;
      }

      default: {
        rootCause = `General defect in category ${defect.category}: ${defect.reportedSymptom}`;
        failingTestCode = `// Generic reproduction test\nassert.fail("${defect.reportedSymptom}");`;
        originalChunk = `// defect reproduction marker`;
        replacementChunk = `// verified repair applied`;
      }
    }

    const isolatedBranch = `evolution/repair-${defect.category.toLowerCase().replace(/_/g, "-")}-${Date.now()}`;

    return {
      defectCategory: defect.category,
      symptom: defect.reportedSymptom,
      rootCause,
      isolatedBranch,
      targetFile,
      failingTestName,
      failingTestCode,
      failingTestBeforeFix: {
        testName: failingTestName,
        failingOutput: "NOT_EXECUTED: reproduction test template generated; no execution result observed.",
        reproduced: false,
      },
      minimalPatch: {
        targetFile,
        originalChunk,
        replacementChunk,
        lineCountDiff: replacementChunk.split("\n").length - originalChunk.split("\n").length,
      },
      iterationCount: 1,
      maxIterations: this.maxIterationsAllowed,
      oscillationBrakeTriggered: false,
    };
  }

  /**
   * Evaluates iteration and oscillation guards.
   */
  public evaluateIterationBrake(candidate: RepairCandidate, consecutiveFailures: number): boolean {
    if (consecutiveFailures >= this.maxIterationsAllowed) {
      candidate.oscillationBrakeTriggered = true;
      return true; // STOP brake triggered
    }
    return false;
  }
}
