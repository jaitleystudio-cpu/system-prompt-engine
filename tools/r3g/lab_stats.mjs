/**
 * Lab timing summary. Not a field Core Web Vitals score.
 * median: even-count arithmetic mean of the two central values.
 * p95: nearest-rank, index = ceil(0.95 * n) - 1 on an ascending copy.
 * COST ₹0.
 */

export function summarize(samples) {
  const values = (Array.isArray(samples) ? samples : [])
    .map((sample) => Number(sample))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const n = values.length;
  if (n === 0) {
    return { n: 0, median: null, p95: null };
  }
  const mid = Math.floor(n / 2);
  const median = n % 2 === 1 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  const rank = Math.min(n - 1, Math.max(0, Math.ceil(0.95 * n) - 1));
  return { n, median, p95: values[rank] };
}

export function labReport(coldMs, warmMs) {
  return {
    field_cwv: "UNKNOWN",
    pass: false,
    pixel_pass: false,
    cold: summarize(coldMs),
    warm: summarize(warmMs),
  };
}
