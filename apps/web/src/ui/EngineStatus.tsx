import type { CompilePhase } from "../engine/types";

type Props = {
  phase: CompilePhase;
  phases: string[];
};

export function EngineStatus({ phase, phases }: Props) {
  return (
    <section className="panel" aria-labelledby="engine-heading">
      <h2 id="engine-heading">Engine status</h2>
      <p className="phase" role="status" aria-live="polite">
        Phase: <strong>{phase}</strong>
      </p>
      <div className="pills" aria-label="Compile phases observed">
        {phases.length === 0 ? (
          <span className="pill">idle</span>
        ) : (
          phases.map((p) => (
            <span key={p} className="pill">
              {p}
            </span>
          ))
        )}
      </div>
    </section>
  );
}
