import {
  hashCanonicalState,
} from "../history/sitePatch.ts";
import {
  validateWebsiteSpecV2,
  type WebsiteSpecV2,
} from "../model/websiteSpecV2.ts";
import {
  assertStudioPackageBounds,
  assertStudioSceneObjectBounds,
  safeStudioJsonParse,
  sanitizeStudioSvg,
} from "../security/studioSecurity.ts";

interface ProjectEnvelope {
  format: "spe-site/1";
  websiteSpec: WebsiteSpecV2;
  integrity: string;
}

function gateExportableSpec(websiteSpec: WebsiteSpecV2): WebsiteSpecV2 {
  const spec = validateWebsiteSpecV2(structuredClone(websiteSpec));
  const objectCount = Array.isArray(spec.scene?.objects) ? spec.scene.objects.length : 0;
  assertStudioSceneObjectBounds(objectCount);
  const heroSvg = spec.scene?.accessibilityFallback?.hero2dSvg;
  if (heroSvg) {
    sanitizeStudioSvg(heroSvg);
  }
  return spec;
}

export async function serializeProjectPackage(
  websiteSpec: WebsiteSpecV2,
): Promise<string> {
  const spec = gateExportableSpec(websiteSpec);
  const envelope: ProjectEnvelope = {
    format: "spe-site/1",
    websiteSpec: spec,
    integrity: hashCanonicalState(spec),
  };
  const raw = JSON.stringify(envelope);
  assertStudioPackageBounds(raw);
  return raw;
}

export async function deserializeProjectPackage(
  raw: string,
): Promise<{
  websiteSpec: WebsiteSpecV2;
  integrityVerified: true;
}> {
  assertStudioPackageBounds(raw);
  const parsed = safeStudioJsonParse(raw) as ProjectEnvelope;
  if (!parsed || typeof parsed !== "object" || parsed.format !== "spe-site/1") {
    throw new Error("SPE_SITE_FORMAT_REFUSED");
  }
  if (!parsed.websiteSpec || typeof parsed.websiteSpec !== "object") {
    throw new Error("SPE_SITE_SPEC_REFUSED");
  }
  const spec = gateExportableSpec(parsed.websiteSpec);
  const actual = hashCanonicalState(spec);
  if (actual !== parsed.integrity) {
    throw new Error("SPE_SITE_INTEGRITY_MISMATCH");
  }
  return {
    websiteSpec: spec,
    integrityVerified: true,
  };
}
