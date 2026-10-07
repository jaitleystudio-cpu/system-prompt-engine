import type { WebsiteIntentIR } from "../model/websiteIntentIR.ts";

export class WebsiteIntentCompileError extends Error {
  readonly code: "INTENT_CONFLICT";
  constructor(message: string) {
    super(message);
    this.name = "WebsiteIntentCompileError";
    this.code = "INTENT_CONFLICT";
  }
}

function normalize(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function detectConflict(lower: string): void {
  const forbidsMotion =
    /\b(no|without|disable|avoid)\s+(animation|motion|animations)\b/.test(lower);
  const demandsMotion =
    /\b(cinematic|camera flight|animated|animation|motion)\b/.test(lower) &&
    /\b(camera|3d|animate|animation|motion)\b/.test(lower);
  if (forbidsMotion && demandsMotion) {
    throw new WebsiteIntentCompileError(
      "Conflicting motion requirements require user resolution.",
    );
  }
}

function siteTypeFor(lower: string): WebsiteIntentIR["siteType"] {
  if (/portfolio/.test(lower)) return "portfolio";
  if (/editorial|magazine|publication/.test(lower)) return "editorial";
  if (/story|storytelling|narrative/.test(lower)) return "storytelling";
  if (/product|motorcycle|car|shoe|sneaker|device|launch/.test(lower)) return "product";
  if (/business|company|clinic|restaurant|agency/.test(lower)) return "business";
  return "landing";
}

function primaryActionFor(lower: string): string {
  if (/book|booking|reserve|reservation/.test(lower)) return "booking";
  if (/buy|purchase|checkout/.test(lower)) return "purchase";
  if (/contact|inquir/.test(lower)) return "contact";
  if (/sign\s?up|register/.test(lower)) return "join";
  if (/download/.test(lower)) return "download";
  return "explore";
}

export function compileWebsiteIntent(raw: string): WebsiteIntentIR {
  const clean = normalize(raw);
  if (!clean) throw new WebsiteIntentCompileError("Website intent is empty.");
  const lower = clean.toLowerCase();
  detectConflict(lower);

  const sections: WebsiteIntentIR["sections"] = [
    { id: "hero", intent: "hero introduction" },
  ];
  if (/product|motorcycle|car|shoe|sneaker|reveal/.test(lower)) {
    sections.push({ id: "product", intent: "product reveal" });
  }
  if (/story|storytelling|narrative/.test(lower)) {
    sections.push({ id: "story", intent: "storytelling sequence" });
  }
  const action = primaryActionFor(lower);
  sections.push({ id: "cta", intent: action + " CTA" });

  return {
    purpose: clean,
    audience: /customer|buyer|visitor|shopper/.test(lower)
      ? "prospective customers"
      : "site visitors",
    primaryAction: action,
    siteType: siteTypeFor(lower),
    sections,
    constraints: [
      ...(lower.includes("3d") ? ["real 3D requested"] : []),
      ...(lower.includes("cinematic") ? ["cinematic motion requested"] : []),
    ],
  };
}
