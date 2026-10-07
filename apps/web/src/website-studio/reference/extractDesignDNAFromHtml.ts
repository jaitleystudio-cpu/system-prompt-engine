import type { DesignDNA } from "../model/designDNA.ts";
import {
  assertStudioHtmlBounds,
  assertNoActiveStudioMarkup,
  assertSafeStudioContent,
} from "../security/studioSecurity.ts";

function firstHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const match = value.match(/#[0-9a-fA-F]{6}\b/);
  return match ? match[0] : fallback;
}

export function extractDesignDNAFromHtml(html: string): DesignDNA {
  assertStudioHtmlBounds(html);
  // Reference HTML is untrusted observation input — refuse active document
  // payloads before regex extraction (content-injection / XSS class).
  // Remote URL mentions in observed markup are allowed here because this
  // path never executes HTML; DNA tokens themselves are still scrubbed.
  assertNoActiveStudioMarkup(html, "reference-html");
  const themeMeta =
    html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i)?.[1];
  const background =
    firstHex(themeMeta, "") ||
    firstHex(html.match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{6})/i)?.[1], "#ffffff");
  const text =
    firstHex(html.match(/(?:^|[;{\s])color\s*:\s*(#[0-9a-fA-F]{6})/i)?.[1], "#111111");
  const font =
    html.match(/font-family\s*:\s*([^;}"']+)/i)?.[1]?.trim().replace(/^["']|["']$/g, "") ||
    "system-ui";
  // Font tokens must not smuggle markup/URLs into DesignDNA.
  assertSafeStudioContent(font, "typography.font");
  return {
    colors: { background, text, accents: [] },
    typography: { headingFamily: font, bodyFamily: font },
    spacingScale: [4, 8, 12, 16, 24, 32, 48, 64],
    radiusScale: [0, 6, 12, 24],
    provenanceState: "OBSERVED",
  };
}
