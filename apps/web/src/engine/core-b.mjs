/**
 * Core B — deterministic degraded delivery.
 * No semantic authority. No network. No canonical prompt. No quality verdict.
 * This module imports none of the SPE semantic transports.
 */

const TEMPLATE_VERSION = "spe.safe-fallback.v1";

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

/**
 * @param {{ rawRequest: string, target?: string | null, explicitConstraints?: string[] }} input
 */
export async function createRawRequestCustody(input) {
  const rawRequest = typeof input.rawRequest === "string" ? input.rawRequest : "";
  const target = typeof input.target === "string" && input.target.length > 0 ? input.target : null;
  const explicitConstraints = Array.isArray(input.explicitConstraints)
    ? input.explicitConstraints.filter((item) => typeof item === "string")
    : [];
  const custody_id = await sha256Hex(
    JSON.stringify({ explicitConstraints, rawRequest, target, version: TEMPLATE_VERSION }),
  );
  return { custody_id, explicit_constraints: explicitConstraints, raw_request: rawRequest, target };
}

/**
 * @param {{ custody_id: string, raw_request: string, target: string | null, explicit_constraints: string[] }} custody
 * @param {string} reasonCode
 */
export function renderSafeFallbackPrompt(custody, reasonCode) {
  const lines = [
    `SPE SAFE FALLBACK ${TEMPLATE_VERSION}`,
    "status: DEGRADED_DELIVERY",
    "This prompt preserves the original request.",
    "SPE's full engine was unavailable.",
    "It has not received SPE's normal semantic check.",
    "",
    "Original request:",
    custody.raw_request,
  ];
  if (custody.target) {
    lines.push("", "Target:", custody.target);
  }
  if (custody.explicit_constraints.length > 0) {
    lines.push("", "Explicit constraints:");
    for (const constraint of custody.explicit_constraints) lines.push(`- ${constraint}`);
  }
  lines.push("", `reason: ${typeof reasonCode === "string" ? reasonCode : "ENGINE_UNAVAILABLE"}`);
  return {
    artifact_type: "SAFE_FALLBACK_PROMPT",
    canonical: false,
    custody_id: custody.custody_id,
    execution_authorized: false,
    explicit_constraints: custody.explicit_constraints.slice(),
    external_effect: false,
    prompt: lines.join("\n"),
    quality_verified: false,
    raw_request: custody.raw_request,
    reason_code: typeof reasonCode === "string" ? reasonCode : "ENGINE_UNAVAILABLE",
    semantic_engine_used: false,
    status: "DEGRADED_DELIVERY",
    template_version: TEMPLATE_VERSION,
    verified: false,
  };
}
