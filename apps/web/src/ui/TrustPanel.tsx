
type Props = {
  sha256: string | null;
  imports: number | null;
};

export function TrustPanel({ sha256, imports }: Props) {
  return (
    <section className="panel" aria-labelledby="trust-heading">
      <h2 id="trust-heading">Trust / proof</h2>
      <dl className="kv">
        <dt>WASM SHA-256</dt>
        <dd>{sha256 ?? "—"}</dd>
        <dt>host imports</dt>
        <dd>{imports === null ? "—" : String(imports)}</dd>
        <dt>network_mode</dt>
        <dd>NONE</dd>
        <dt>not_a_release</dt>
        <dd>true</dd>
        <dt>NEW_IMPLEMENTATION</dt>
        <dd>true</dd>
        <dt>fallback</dt>
        <dd>none (ENGINE_UNAVAILABLE on WASM failure)</dd>
      </dl>
    </section>
  );
}
