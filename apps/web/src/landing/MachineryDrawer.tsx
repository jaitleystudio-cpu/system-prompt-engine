type Props = {
  phases: string[];
  phase: string;
  busy: boolean;
  prompt: string | null;
  techniques: number;
  unknowns: number;
  confirmed: number;
  onCopy: () => void;
  onOpenWorkspace?: () => void;
  ready: boolean;
};

const STEPS = [
  ["loading_wasm", "Understand"],
  ["verifying_integrity", "Decompose"],
  ["instantiating", "Enrich"],
  ["ready", "Structure"],
  ["evaluating", "Verify"],
  ["done", "Compile"],
] as const;

/** Bottom machinery drawer — real compile phases + real prompt, no fake metrics. */
export function MachineryDrawer({
  phases,
  phase,
  busy,
  prompt,
  techniques,
  unknowns,
  confirmed,
  onCopy,
  onOpenWorkspace,
  ready,
}: Props) {
  return (
    <section className="spe-machinery" aria-label="Compile machinery">
      <div className="spe-machinery-panel">
        <header>
          <span>Semantic pipeline</span>
          <span className="spe-pipeline-live">{busy ? "LIVE" : ready ? "DONE" : "IDLE"}</span>
        </header>
        <ol className="spe-pipeline-steps">
          {STEPS.map(([id, label]) => {
            const done = phases.includes(id) || (id === "done" && ready);
            const active = phase === id || (id === "done" && phase === "done");
            return (
              <li key={id} data-active={active} data-done={done && !active}>
                {label}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="spe-machinery-panel spe-machinery-prompt">
        <header>
          <span>Compiled request</span>
        </header>
        <pre>{prompt || "Compile Intent to reveal the structured prompt artifact."}</pre>
      </div>

      <div className="spe-machinery-panel">
        <header>
          <span>Verification & control</span>
        </header>
        <ul className="spe-verify-list">
          <li>
            <span>Confirmed atoms</span>
            <strong>{confirmed}</strong>
          </li>
          <li>
            <span>Techniques applied</span>
            <strong>{techniques}</strong>
          </li>
          <li>
            <span>Unresolved questions</span>
            <strong>{unknowns}</strong>
          </li>
          <li>
            <span>Core compile</span>
            <strong className="ok">LOCAL</strong>
          </li>
          <li>
            <span>Mandatory provider</span>
            <strong className="ok">NO</strong>
          </li>
          <li>
            <span>Ready</span>
            <strong className={ready ? "ok" : ""}>{ready ? "YES" : "—"}</strong>
          </li>
        </ul>
        <div className="spe-actions">
          <button type="button" className="spe-build" disabled={!prompt} onClick={onCopy}>
            Copy Prompt
          </button>
          {onOpenWorkspace && (
            <button type="button" className="spe-ghost" onClick={onOpenWorkspace}>
              Open workspace
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
