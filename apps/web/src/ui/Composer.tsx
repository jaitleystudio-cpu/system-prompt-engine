
type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

export function Composer({ value, onChange, disabled }: Props) {
  return (
    <section className="panel" aria-labelledby="composer-heading">
      <h2 id="composer-heading">Composer</h2>
      <label htmlFor="spe-envelope" className="meta">
        SPE envelope JSON (session memory only — never stored)
      </label>
      <textarea
        id="spe-envelope"
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="composer-help"
      />
      <p id="composer-help" className="meta">
        Workbench compile path: UI → Web Worker → spe_wasm.wasm → spe-core-rs. No Python in the
        browser path. No TypeScript semantic fallback.
      </p>
    </section>
  );
}
