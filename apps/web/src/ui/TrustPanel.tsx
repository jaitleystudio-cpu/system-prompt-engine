type Props = {
  sha256: string | null;
  imports: number | null;
  phase: string;
  usedTsFallback: false;
};

/** TrustPanel — engine honesty. */
export function TrustPanel({ sha256, imports, phase, usedTsFallback }: Props) {
  return (
    <section className="forge-trust-panel" aria-labelledby="trust-title">
      <h2 id="trust-title">Engine trust</h2>
      <dl>
        <div><dt>path</dt><dd>UI → Web Worker → spe_wasm.wasm → spe-core-rs</dd></div>
        <div><dt>network_mode</dt><dd>NONE</dd></div>
        <div><dt>not_a_release</dt><dd>true</dd></div>
        <div><dt>used_ts_fallback</dt><dd>{String(usedTsFallback)}</dd></div>
        <div><dt>phase</dt><dd>{phase}</dd></div>
        <div><dt>wasm imports</dt><dd>{imports === null ? "—" : imports}</dd></div>
        <div><dt>wasm sha256</dt><dd>{sha256 ? `${sha256.slice(0, 16)}…` : "—"}</dd></div>
        <div><dt>claim</dt><dd>IMPLEMENTATION_PRESENT / REVIEW_PENDING</dd></div>
      </dl>
    </section>
  );
}
