/**
 * Classify one observed browser request.
 * Asset ingress is not raw user-data egress.
 * A user-authorized model download is not raw user-data egress and is not a media upload.
 * Loopback, including localhost, does not leave the device and is not an external host.
 * A fixture fetch, a missing WASM engine, and a network error are not a privacy pass.
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

export const JOURNEY_IDS = [
  "prompt_compile",
  "history",
  "spe_import",
  "spe_export",
  "media",
  "asr",
  "video",
  "ocr",
  "screenshot",
  "website",
  "three_d",
  "research",
  "model_pack",
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

export function requestHost(request) {
  if (request && typeof request.host === "string" && request.host.length > 0) return request.host;
  if (request && typeof request.url === "string") {
    try {
      return new URL(request.url).hostname || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function isLoopbackHost(host) {
  return typeof host === "string" && LOOPBACK.has(host);
}

function pathOf(url) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function looksLikeAsset(url, resourceType) {
  const path = pathOf(url);
  if (/\.(wasm|onnx|mjs|js|css|map|json|woff2?|png|svg|ico)(\?|$)/.test(path)) return true;
  return resourceType === "script" || resourceType === "stylesheet" || resourceType === "font" || resourceType === "image";
}

function looksLikeModel(url) {
  const path = pathOf(url);
  if (/\.(onnx|gguf|ggml|safetensors)(\?|$)/.test(path)) return true;
  if (/\/models\//.test(path) && /\.(onnx|bin|txt|json|wasm)(\?|$)/.test(path)) return true;
  return false;
}

function looksLikeFixture(url) {
  const path = pathOf(url);
  return path.includes("/samples/") || path.includes("/__r3g/fixtures/") || path.endsWith("pos001.json");
}

/**
 * Observed request record. Does not store the body.
 * class distinguishes USER-AUTHORIZED MODEL DOWNLOAD from RAW USER DATA EGRESS.
 */
export function describeRequest(request, canaries) {
  const source = request && typeof request === "object" ? request : {};
  const url = typeof source.url === "string" ? source.url : "";
  const method = typeof source.method === "string" && source.method ? source.method.toUpperCase() : "GET";
  const initiator = typeof source.initiator === "string" && source.initiator ? source.initiator : "unknown";
  const resourceType = typeof source.resourceType === "string" ? source.resourceType : "";
  const postData = typeof source.postData === "string" ? source.postData : "";
  const needles = (Array.isArray(canaries) ? canaries : []).filter((item) => typeof item === "string" && item.length > 0);
  const haystack = textOf({ url, postData });
  const canaryHit = needles.some((needle) => haystack.includes(needle) || haystack.includes(encodeURIComponent(needle)));
  let host = null;
  try {
    host = new URL(url).hostname || null;
  } catch {
    host = null;
  }
  const loopback = isLoopback(url);
  const model = looksLikeModel(url);
  const downloadMethod = method === "GET" || method === "HEAD";
  const uploadMethod = method === "POST" || method === "PUT" || method === "PATCH";
  let kind = "external_other";
  let payloadClass = postData.length > 0 ? "unknown" : "empty";
  let allowedReason = "none";

  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("chrome-extension:")) {
    kind = canaryHit ? "raw_user_data_egress" : "ignored_non_network";
    payloadClass = canaryHit ? "canary_user_bytes" : "empty";
    allowedReason = canaryHit ? "none" : "ignored_non_network";
  } else if (canaryHit && !loopback) {
    kind = "raw_user_data_egress";
    payloadClass = "canary_user_bytes";
    allowedReason = "none";
  } else if (!loopback && uploadMethod && (postData.length > 0 || canaryHit)) {
    // A model URL does not turn a media/body upload into a model download.
    kind = "raw_user_data_egress";
    payloadClass = "media_upload";
    allowedReason = "none";
  } else if (canaryHit && loopback) {
    kind = "loopback_with_canary";
    payloadClass = "canary_user_bytes";
    allowedReason = "loopback_same_device";
  } else if (!loopback && model && downloadMethod) {
    kind = "user_authorized_model_download";
    payloadClass = "model_bytes";
    allowedReason = "user_authorized_model_download";
  } else if (!loopback && looksLikeAsset(url, resourceType)) {
    kind = "asset_ingress";
    payloadClass = "asset";
    allowedReason = "asset_ingress_no_user_payload";
  } else if (!loopback) {
    kind = "external_other";
    payloadClass = postData.length > 0 ? "unknown" : "empty";
    allowedReason = "none";
  } else {
    kind = "loopback_asset";
    payloadClass = model ? "model_bytes" : looksLikeFixture(url) ? "fixture" : (postData.length > 0 ? "unknown" : "empty");
    allowedReason = "loopback_same_device";
  }

  if (source.failed === true && !loopback && kind !== "raw_user_data_egress") {
    kind = "network_error";
    allowedReason = "none";
    payloadClass = payloadClass === "empty" ? "empty" : payloadClass;
  }

  return {
    url,
    host,
    method,
    initiator,
    payload_class: payloadClass,
    allowed_reason: allowedReason,
    class: kind,
    resourceType,
  };
}

export function classifyRequest(request, canaries) {
  return describeRequest(request, canaries).class;
}

export function effectiveClass(request) {
  const host = requestHost(request);
  const declared = request && typeof request.class === "string" ? request.class : "external_other";
  if (isLoopbackHost(host)) {
    if (declared === "raw_user_data_egress" || declared === "loopback_with_canary") return "loopback_with_canary";
    if (declared === "ignored_non_network") return "ignored_non_network";
    if (declared === "network_error") return "loopback_asset";
    return "loopback_asset";
  }
  return declared;
}

export function externalHosts(requests) {
  const hosts = [];
  for (const request of Array.isArray(requests) ? requests : []) {
    const host = requestHost(request);
    if (!host || isLoopbackHost(host)) continue;
    const kind = effectiveClass(request);
    if (kind === "ignored_non_network") continue;
    const path = typeof request.path === "string" ? request.path : "";
    hosts.push(`${kind} ${host}${path}`);
  }
  return [...new Set(hosts)];
}

export function summarizeJourneys(list) {
  const run = [];
  const notRun = [];
  const localPending = [];
  for (const item of Array.isArray(list) ? list : []) {
    const id = item && item.id ? String(item.id) : "unknown";
    if (item && item.status === "RUN") run.push(id);
    else if (item && item.status === "LOCAL_PENDING") localPending.push({ id, reason: item.reason || "shell route only; no built app" });
    else notRun.push({ id, reason: item && item.reason ? String(item.reason) : "unspecified" });
  }
  return { run, notRun, localPending };
}

export function judgeEgress(input) {
  const source = input && typeof input === "object" ? input : {};
  const executed = Array.isArray(source.flowsExecuted) ? source.flowsExecuted : [];
  const requests = Array.isArray(source.requests) ? source.requests : [];
  const measured = source.measured === true;
  const engineOk = source.engineOk === true;
  const counts = {};
  for (const request of requests) {
    const kind = effectiveClass(request);
    counts[kind] = (counts[kind] || 0) + 1;
  }
  const raw = counts.raw_user_data_egress || 0;
  const missing = REQUIRED_MODALITIES.filter((name) => !executed.includes(name));
  const reasons = [];
  if (!measured) reasons.push("unmeasured");
  if (!engineOk) reasons.push("engine_not_ok");
  if (source.missingWasm === true) reasons.push("missing_wasm_not_privacy_pass");
  if (source.fixtureOnly === true) reasons.push("fixture_fetch_not_privacy_pass");
  if (source.networkError === true || (counts.network_error || 0) > 0) reasons.push("network_error_not_privacy_proof");
  if (raw > 0) reasons.push("raw_user_data_egress");
  if ((counts.external_other || 0) > 0) reasons.push("unexplained_external");
  if (missing.length > 0) reasons.push(`modalities_not_executed:${missing.join(",")}`);
  const uniqueReasons = [...new Set(reasons)];
  return {
    privacy_qualification: uniqueReasons.length === 0 ? "EVIDENCE_COMPLETE" : "HOLD",
    pass: false,
    zero_egress: false,
    raw_user_data_egress: raw > 0,
    asset_ingress: counts.asset_ingress || 0,
    user_authorized_model_download: counts.user_authorized_model_download || 0,
    loopback_asset: counts.loopback_asset || 0,
    loopback_with_canary: counts.loopback_with_canary || 0,
    external_other: counts.external_other || 0,
    network_error: counts.network_error || 0,
    missing_modalities: missing,
    reasons: uniqueReasons,
    external_hosts: externalHosts(requests),
    field_cwv: "UNKNOWN",
  };
}
