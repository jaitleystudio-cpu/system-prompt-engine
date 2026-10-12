// Paired statistics: bootstrap CI (seeded) and exact McNemar.
export function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
export function pairedDiff(a, b, B = 10000, seed = 20261012) { // mean(b - a)
  const n = a.length, d = a.map((v, i) => b[i] - v), m = d.reduce((s, v) => s + v, 0) / n, r = rng(seed), bs = [];
  for (let k = 0; k < B; k++) { let s = 0; for (let i = 0; i < n; i++) s += d[Math.floor(r() * n)]; bs.push(s / n); }
  bs.sort((x, y) => x - y);
  return { n, mean: m, lo: bs[Math.floor(0.025 * B)], hi: bs[Math.floor(0.975 * B) - 1] };
}
function binomTail(k, n) { let p = 0, c = 1; for (let i = 0; i <= n; i++) { if (i > 0) c = c * (n - i + 1) / i; if (i <= k) p += c; } return p / 2 ** n; }
export function mcnemar(a, b) { // exact two-sided
  let b10 = 0, b01 = 0; a.forEach((v, i) => { if (v && !b[i]) b10++; if (!v && b[i]) b01++; });
  const n = b10 + b01; const p = n === 0 ? 1 : Math.min(1, 2 * binomTail(Math.min(b10, b01), n));
  return { baseline_only: b10, candidate_only: b01, p };
}
