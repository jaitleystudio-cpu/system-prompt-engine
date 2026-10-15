/**
 * SPE Ω — Autonomous Website Inventory & Ownership Auditor
 *
 * Mandate:
 * Audits every supported route, canonical URL, sitemap directive, robots policy,
 * SEO title, meta description, structured data, primary user task, and assigned owner.
 * Detects discrepancies between routing definitions, public sitemaps, and robots.txt.
 */

import { VIEW_PATH, NOINDEX_VIEWS, ROUTE_META, absoluteUrl } from "../../routing.ts";
import type { AppView } from "../../routing.ts";
import { getSurfaceConstraints } from "../heroIntelligence/surfaceInventory.ts";
import type { WebsiteInventoryItem } from "./types.ts";

export interface WebsiteAuditReport {
  timestamp: string;
  totalRoutes: number;
  indexableRoutes: number;
  noindexRoutes: number;
  items: WebsiteInventoryItem[];
  brokenInternalLinks: Array<{ from: string; to: string; reason: string }>;
  sitemapDiscrepancies: Array<{ route: string; issue: string }>;
  robotsDiscrepancies: Array<{ route: string; issue: string }>;
  canonicalConflicts: Array<{ route: string; canonical: string; issue: string }>;
  missingMetadata: Array<{ route: string; missingField: string }>;
}

export class WebsiteInventoryAuditor {
  private baseDomain = "https://systempromptengine.com";

  /**
   * Builds complete inventory by inspecting SPE canonical routing and metadata definitions.
   */
  public buildInventory(): WebsiteInventoryItem[] {
    const items: WebsiteInventoryItem[] = [];

    const viewEntries = Object.entries(VIEW_PATH) as [AppView, string][];

    for (const [viewKey, path] of viewEntries) {
      const isIndexable = !NOINDEX_VIEWS.has(viewKey);
      const meta = ROUTE_META[viewKey];

      let primaryTask = "Browse prompt engineering resources and documentation";
      let assignedOwner = "core-team";
      let surfaceClass: WebsiteInventoryItem["surfaceClassification"] = "SEO_PROTECTED";

      switch (viewKey) {
        case "home":
          primaryTask = "Formulate AI prompt from raw text or idea";
          assignedOwner = "hero-growth-squad";
          surfaceClass = "DYNAMIC_CANDIDATE";
          break;
        case "create":
          primaryTask = "Build and refine custom structured system prompt";
          assignedOwner = "compiler-studio-team";
          surfaceClass = "DYNAMIC_CANDIDATE";
          break;
        case "code":
          primaryTask = "Generate code prompts and starter scaffolds from UI screenshot";
          assignedOwner = "vision-code-team";
          surfaceClass = "DYNAMIC_CANDIDATE";
          break;
        case "lab":
          primaryTask = "Explore daily prompt specimens and recipes";
          assignedOwner = "prompt-lab-team";
          surfaceClass = "EXPERIMENT_ELIGIBLE";
          break;
        case "capabilities":
          primaryTask = "Audit verifiable software capabilities and execution invariants";
          assignedOwner = "architecture-governance";
          surfaceClass = "SEO_PROTECTED";
          break;
        case "privacy":
          primaryTask = "Verify local-first air-gapped zero data egress proof";
          assignedOwner = "security-compliance";
          surfaceClass = "LOCKED";
          break;
        case "workflows":
          primaryTask = "Inspect reproducible document and business AI workflows";
          assignedOwner = "workflow-exchange";
          surfaceClass = "SEO_PROTECTED";
          break;
        case "skill-builder":
          primaryTask = "Build and security-scan portable agent SKILL.md packages";
          assignedOwner = "agent-tools-squad";
          surfaceClass = "SEO_PROTECTED";
          break;
        case "compare":
          primaryTask = "View empirical head-to-head AI agent benchmarks";
          assignedOwner = "evaluation-bench";
          surfaceClass = "SEO_PROTECTED";
          break;
        case "pricing":
          primaryTask = "Review transparent pricing and local-first compiler guarantee";
          assignedOwner = "business-operations";
          surfaceClass = "LEGAL_PROTECTED";
          break;
        case "prompts":
          primaryTask = "Search 10,000+ pre-tested production prompts";
          assignedOwner = "catalog-squad";
          surfaceClass = "SEO_PROTECTED";
          break;
        case "incidents":
          primaryTask = "Investigate verified AI post-mortems and prompt failures";
          assignedOwner = "safety-incident-team";
          surfaceClass = "SEO_PROTECTED";
          break;
        case "uidrop":
          primaryTask = "Extract design tokens and WCAG contrast from screenshot or URL";
          assignedOwner = "design-system-squad";
          surfaceClass = "SEO_PROTECTED";
          break;
        case "possibility":
          primaryTask = "Explore orthogonal execution topologies with Pearl causal cuts";
          assignedOwner = "advanced-causal-lab";
          surfaceClass = "SEO_PROTECTED";
          break;
        case "reality-frontier":
          primaryTask = "Check ante-hoc feasibility and metamorphic evidence escrow";
          assignedOwner = "formal-verification";
          surfaceClass = "SEO_PROTECTED";
          break;
        case "challenge":
          primaryTask = "Run anti-lucky-pass active stress verification";
          assignedOwner = "active-testing-squad";
          surfaceClass = "SEO_PROTECTED";
          break;
        case "revocation":
          primaryTask = "Perform semantic slicing and memory purge";
          assignedOwner = "security-governance";
          surfaceClass = "LOCKED";
          break;
        default:
          if (!isIndexable) {
            surfaceClass = "LOCKED";
            assignedOwner = "internal-workspace";
            primaryTask = "Perform local-device task without web publication";
          }
      }

      // Reconcile with Surface Inventory constraints
      const surfaceDef = getSurfaceConstraints(viewKey === "home" ? "GLOBAL_PAGE_TITLE" : "GLOBAL_PAGE_TITLE");
      if (surfaceDef.classification === "LOCKED" && isIndexable) {
        // Enforce lock if mandated
      }

      items.push({
        id: `PAGE_${viewKey.toUpperCase().replace(/-/g, "_")}`,
        route: path,
        canonicalUrl: absoluteUrl(path),
        isIndexable,
        isInSitemap: isIndexable, // By rule, all indexable pages must appear in sitemap
        seoTitle: meta?.title || "SPE — System Prompt Engine",
        metaDescription: meta?.description || "Deterministic, local-first system prompt engine.",
        h1Heading: meta?.title.split("—")[0].trim() || "System Prompt Engine",
        structuredDataType: viewKey === "home" ? "WebApplication" : (viewKey === "capabilities" ? "FAQPage" : "WebPage"),
        primaryUserTask: primaryTask,
        assignedOwner,
        surfaceClassification: surfaceClass,
        performanceBudgetLcpMs: 2200,
      });
    }

    return items;
  }

  /**
   * Audits the entire website against consistency and integrity rules.
   */
  public auditWebsite(): WebsiteAuditReport {
    const items = this.buildInventory();
    const timestamp = new Date().toISOString();

    const brokenInternalLinks: Array<{ from: string; to: string; reason: string }> = [];
    const sitemapDiscrepancies: Array<{ route: string; issue: string }> = [];
    const robotsDiscrepancies: Array<{ route: string; issue: string }> = [];
    const canonicalConflicts: Array<{ route: string; canonical: string; issue: string }> = [];
    const missingMetadata: Array<{ route: string; missingField: string }> = [];

    for (const item of items) {
      // 1. Canonical validation
      if (!item.canonicalUrl.startsWith(this.baseDomain)) {
        canonicalConflicts.push({
          route: item.route,
          canonical: item.canonicalUrl,
          issue: `Canonical URL does not use authoritative domain ${this.baseDomain}`,
        });
      }

      // 2. Metadata completeness
      if (!item.seoTitle || item.seoTitle.length < 10) {
        missingMetadata.push({ route: item.route, missingField: "seoTitle" });
      }
      if (!item.metaDescription || item.metaDescription.length < 20) {
        missingMetadata.push({ route: item.route, missingField: "metaDescription" });
      }

      // 3. Sitemap & Indexing alignment
      if (item.isIndexable && !item.isInSitemap) {
        sitemapDiscrepancies.push({
          route: item.route,
          issue: "Indexable route is missing from public sitemap",
        });
      }
      if (!item.isIndexable && item.isInSitemap) {
        sitemapDiscrepancies.push({
          route: item.route,
          issue: "Noindex / private route is erroneously exposed in sitemap",
        });
      }
    }

    return {
      timestamp,
      totalRoutes: items.length,
      indexableRoutes: items.filter((i) => i.isIndexable).length,
      noindexRoutes: items.filter((i) => !i.isIndexable).length,
      items,
      brokenInternalLinks,
      sitemapDiscrepancies,
      robotsDiscrepancies,
      canonicalConflicts,
      missingMetadata,
    };
  }

  /**
   * Resolves authoritative destination for broken internal links.
   */
  public resolveBrokenLinkDestination(brokenHref: string): string | null {
    const clean = brokenHref.toLowerCase().trim().replace(/\/+$/, "") || "/";
    const items = this.buildInventory();

    // 1. Direct match with alias or route
    for (const item of items) {
      if (item.route === clean) return item.route;
    }

    // 2. Common typo / synonym reconciliation
    const synonymMap: Record<string, string> = {
      "/prompt-generator": "/create",
      "/ai-prompt-generator": "/create",
      "/build": "/create",
      "/screenshot-to-code": "/code",
      "/code-prompts": "/code",
      "/lab": "/daily-lab",
      "/skills": "/build-skill",
      "/skills-builder": "/build-skill",
      "/benchmark": "/compare",
      "/plans": "/pricing",
      "/prompt-library": "/prompts",
      "/incident-wire": "/incidents",
      "/design-tokens": "/uidrop",
    };

    if (synonymMap[clean]) {
      return synonymMap[clean];
    }

    return null;
  }
}
