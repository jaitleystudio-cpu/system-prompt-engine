/**
 * Classify one observed browser request.
 * Asset ingress is not raw user-data egress.
 * A model or WASM download is not raw egress unless the canary is in it.
 * Loopback traffic does not leave the device.
 * Missing measurement is not a privacy pass.
 * COST ₹0.
 */

export const REQUIRED_MODALITIES = [
  "prompt",
  "transcript",
  "image",
  "audio",
  "video",
  "code",
  "document",
];

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

function textOf(request) {
  const url = typeof request.url === "string" ? request.url : "";
  const body = typeof request.postData === "string" ? request.postData : "";
  return `${url}\n${body}`;
}

export function isLoopback(url) {
  try {
    return LOOPBACK.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function looksLikeAsset(url, resourceType) {
  let path = "";
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    path = "";
  }
  if (/\.(wasm|onnx|mjs|js|css|map|json|woff2?|png|svg|ico)(\?|$)/.test(path)) return true;
  return resourceType === "script" || resourceType === "stylesheet" || resourceType === "font" || resourceType === "image";
}

export function classifyRequest(request, canaries) {
  const url = typeof request?.url === "string" ? request.url : "";
  const needles = (Array.isArray(canaries) ? canaries : []).filter((item) => typeof item === "string" && item.length > 0);
  const haystack = textOf(request || {});
  const canaryHit = needles.some((needle) => haystack.includes(needle));
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("chrome-extension:")) {
    return canaryHit ? "raw_user_data_egress" : "ignored_non_network";
  }
  const loopback = isLoopback(url);
  if (canaryHit && !loopback) return "raw_user_data_egress";
  if (canaryHit && loopback) return "loopback_with_canary";
  if (!loopback && looksLikeAsset(url, request?.resourceType)) return "asset_ingress";
  if (!loopback) return "external_other";
  return "loopback_asset";
}

export function judgeEgress(input) {
  const source = input && typeof input === "object" ? input : {};
  const executed = Array.isArray(source.flowsExecuted) ? source.flowsExecuted : [];
  const requests = Array.isArray(source.requests) ? source.requests : [];
  const measured = source.measured === true;
  const engineOk = source.engineOk === true;
  const counts = {};
  for (const request of requests) {
    const kind = request.class || "external_other";
    counts[kind] = (counts[kind] || 0) + 1;
  }
  const raw = counts.raw_user_data_egress || 0;
  const missing = REQUIRED_MODALITIES.filter((name) => !executed.includes(name));
  const reasons = [];
  if (!measured) reasons.push("unmeasured");
  if (!engineOk) reasons.push("engine_not_ok");
  if (raw > 0) reasons.push("raw_user_data_egress");
  if ((counts.external_other || 0) > 0) reasons.push("unexplained_external");
  if (missing.length > 0) reasons.push(`modalities_not_executed:${missing.join(",")}`);
  return {
    privacy_qualification: reasons.length === 0 ? "EVIDENCE_COMPLETE" : "HOLD",
    pass: false,
    zero_egress: false,
    raw_user_data_egress: raw > 0,
    asset_ingress: counts.asset_ingress || 0,
    loopback_asset: counts.loopback_asset || 0,
    loopback_with_canary: counts.loopback_with_canary || 0,
    external_other: counts.external_other || 0,
    missing_modalities: missing,
    reasons,
    field_cwv: "UNKNOWN",
  };
}
