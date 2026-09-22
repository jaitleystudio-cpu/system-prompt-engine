type Props = {
  sha256: string | null;
  imports: number | null;
  phase: string;
  usedTsFallback: false;
};

/** TrustPanel — engine honesty. */
export function TrustPanel({ sha256, imports, phase, usedTsFallback }: Props) {
  return (
    <section className="panel" aria-labelledby="trust-title">
      <h2 id="trust-title">Engine trust</h2>
      <div className="trust-grid">
        <div>path: UI → Web Worker → spe_wasm.wasm → spe-core-rs</div>
        <div>network_mode: NONE</div>
        <div>not_a_release: true</div>
        <div>used_ts_fallback: {String(usedTsFallback)}</div>
        <div>phase: {phase}</div>
        <div>wasm imports: {imports === null ? "—" : imports}</div>
        <div>wasm sha256: {sha256 ? `${sha256.slice(0, 16)}…` : "—"}</div>
        <div>claim: IMPLEMENTATION_PRESENT / REVIEW_PENDING · World #1 NOT PROVEN</div>
      </div>
    </section>
  );
}
