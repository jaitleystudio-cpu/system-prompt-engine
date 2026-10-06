export interface SiteInspectionInput {
  hasSemanticDom: boolean;
  hasReducedMotion: boolean;
  webglContexts: number;
  activeAnimationLoops: number;
}

export interface SiteFinding {
  code:
    | "SEMANTIC_DOM_MISSING"
    | "REDUCED_MOTION_MISSING"
    | "WEBGL_CONTEXT_LEAK_RISK"
    | "ANIMATION_LOOP_LEAK_RISK";
  severity: "ERROR" | "WARNING";
}

export function inspectSite(input: SiteInspectionInput): SiteFinding[] {
  const findings: SiteFinding[] = [];
  if (!input.hasSemanticDom) {
    findings.push({ code: "SEMANTIC_DOM_MISSING", severity: "ERROR" });
  }
  if (!input.hasReducedMotion) {
    findings.push({ code: "REDUCED_MOTION_MISSING", severity: "ERROR" });
  }
  if (input.webglContexts > 1) {
    findings.push({ code: "WEBGL_CONTEXT_LEAK_RISK", severity: "WARNING" });
  }
  if (input.activeAnimationLoops > 1) {
    findings.push({ code: "ANIMATION_LOOP_LEAK_RISK", severity: "WARNING" });
  }
  return findings;
}
