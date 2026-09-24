import { LAB_SPECIMENS, specimensForDate, todaysLabDateLabel, type LabSpecimen } from "./specimens";

type Props = {
  onOpenInSpe: (specimen: LabSpecimen) => void;
  onCopyIdea: (specimen: LabSpecimen) => void;
};

export function DailyLab({ onOpenInSpe, onCopyIdea }: Props) {
  const today = specimensForDate(new Date(), 6);
  return (
    <section className="spe-lab" aria-labelledby="lab-title">
      <header className="spe-lab-head">
        <p className="spe-kicker">Daily Lab</p>
        <h1 id="lab-title">Today&apos;s specimens</h1>
        <p>
          Six ideas for {todaysLabDateLabel()}. Same date, same set — chosen on
          your device from a fixed library of {LAB_SPECIMENS.length}. No network
          fetch.
        </p>
      </header>
      <div className="spe-lab-grid">
        {today.map((s) => (
          <article key={s.id} className="spe-lab-card" style={{ ["--lab-accent" as string]: s.accent }}>
            <header>
              <span className="spe-lab-cat">{s.category}</span>
              <h2>{s.title}</h2>
              <p>{s.blurb}</p>
            </header>
            <pre className="spe-lab-seed">{s.seedIdea}</pre>
            <div className="spe-lab-actions">
              <button type="button" className="spe-build" onClick={() => onOpenInSpe(s)}>
                Open in SPE <span>↗</span>
              </button>
              <button type="button" className="spe-ghost" onClick={() => onCopyIdea(s)}>
                Copy idea
              </button>
            </div>
          </article>
        ))}
      </div>
      <details className="spe-lab-library">
        <summary>Full library ({LAB_SPECIMENS.length})</summary>
        <ul>
          {LAB_SPECIMENS.map((s) => (
            <li key={s.id}>
              <strong>{s.title}</strong> — {s.blurb}{" "}
              <button type="button" className="spe-linkish" onClick={() => onOpenInSpe(s)}>
                Open
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
