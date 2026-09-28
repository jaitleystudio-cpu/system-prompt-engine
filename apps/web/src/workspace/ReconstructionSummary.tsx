import type { ReconstructionReport } from "@spe/web-runtime";

type Props = {
  report: ReconstructionReport;
  onDismiss: () => void;
};

export function ReconstructionSummary({ report, onDismiss }: Props) {
  return (
    <section
      className="spe-reconstruction"
      data-status={report.status}
      aria-labelledby="reconstruction-title"
      role={report.status === "error" ? "alert" : "status"}
    >
      <header>
        <div>
          <p className="spe-kicker">Restore summary</p>
          <h2 id="reconstruction-title">{report.title}</h2>
        </div>
        <button type="button" className="spe-ghost" onClick={onDismiss}>
          Dismiss
        </button>
      </header>
      <p>{report.message}</p>
      {report.restored.length > 0 && (
        <div>
          <h3>Restored</h3>
          <ul>
            {report.restored.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {report.notRestored.length > 0 && (
        <div>
          <h3>Not restored</h3>
          <ul>
            {report.notRestored.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {report.warnings.length > 0 && (
        <div>
          <h3>Review</h3>
          <ul>
            {report.warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
