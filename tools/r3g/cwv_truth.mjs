/**
 * Publish rule for field Core Web Vitals.
 * Ported from PR #107 tools/perf/cwv_truth.mjs (ideas only).
 * Missing or unpublished metrics stay UNKNOWN. This module never returns PASS.
 * A local Chrome lab number is not a field score.
 * COST ₹0.
 */

function missing(raw) {
  return raw === null || raw === undefined || raw === "";
}

function published(sample) {
  const command = typeof sample.command === "string" ? sample.command.trim() : "";
  const sha = typeof sample.sha === "string" ? sample.sha.trim() : "";
  const field = sample.field === true;
  return field && command.length > 0 && /^[0-9a-f]{40}$/.test(sha);
}

function metric(raw, isPublished) {
  if (!isPublished || missing(raw)) return "UNKNOWN";
  const value = Number(raw);
  if (!Number.isFinite(value)) return "UNKNOWN";
  return value;
}

export function assessPublishedCwv(sample) {
  const source = sample && typeof sample === "object" ? sample : {};
  const isPublished = published(source);
  const lcp = metric(source.lcpMs, isPublished);
  const cls = metric(source.cls, isPublished);
  const inp = metric(source.inpMs, isPublished);
  const status = !isPublished || lcp === "UNKNOWN" || cls === "UNKNOWN" || inp === "UNKNOWN"
    ? "UNKNOWN"
    : "MEASURED";
  return {
    lcp,
    cls,
    inp,
    status,
    field_cwv: "UNKNOWN",
    pass: false,
  };
}
