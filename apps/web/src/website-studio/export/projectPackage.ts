import {
  hashCanonicalState,
} from "../history/sitePatch.ts";
import type { WebsiteSpecV2 } from "../model/websiteSpecV2.ts";

interface ProjectEnvelope {
  format: "spe-site/1";
  websiteSpec: WebsiteSpecV2;
  integrity: string;
}

export async function serializeProjectPackage(
  websiteSpec: WebsiteSpecV2,
): Promise<string> {
  const spec = structuredClone(websiteSpec);
  const envelope: ProjectEnvelope = {
    format: "spe-site/1",
    websiteSpec: spec,
    integrity: hashCanonicalState(spec),
  };
  return JSON.stringify(envelope);
}

export async function deserializeProjectPackage(
  raw: string,
): Promise<{
  websiteSpec: WebsiteSpecV2;
  integrityVerified: true;
}> {
  const parsed = JSON.parse(raw) as ProjectEnvelope;
  if (parsed.format !== "spe-site/1") {
    throw new Error("SPE_SITE_FORMAT_REFUSED");
  }
  const actual = hashCanonicalState(parsed.websiteSpec);
  if (actual !== parsed.integrity) {
    throw new Error("SPE_SITE_INTEGRITY_MISMATCH");
  }
  return {
    websiteSpec: parsed.websiteSpec,
    integrityVerified: true,
  };
}
