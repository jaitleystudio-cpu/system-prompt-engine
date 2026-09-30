import {
  epistemicLabel,
  truthAxisTitle,
  truthVerdictLabel,
  type CandidateRegion,
  type CandidateUiView,
} from "./candidateFoundation";

type Props = {
  view: CandidateUiView;
};

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function confidenceWord(confidence: CandidateRegion["confidence"]): string {
  switch (confidence) {
    case "high":
      return "stronger guess";
    case "medium":
      return "unsure";
    case "low":
      return "weak guess";
    default: {
      const exhausted: never = confidence;
      return exhausted;
    }
  }
}

export function CandidateUiPanel({ view }: Props) {
  const heading = view.source === "image" ? "Visual" : "Candidate UI";
  const headingId = `candidate-${view.source}-heading`;
  const frame =
    view.sourceWidth > 0 && view.sourceHeight > 0
      ? `${view.sourceWidth} / ${view.sourceHeight}`
      : "16 / 10";
  const preview = view.candidatePreview;

  return (
    <section
      className="spe-candidate"
      aria-labelledby={headingId}
      data-candidate-foundation="a12"
      data-candidate-source={view.source}
      data-fidelity="structure-only"
    >
      <p className="spe-panel-label" id={headingId}>
        {heading}
      </p>
      <ol className="spe-code-pipeline" aria-label="Reading path">
        {view.flow.map((step, index) => (
          <li
            key={step}
            data-step-active={index === view.flow.length - 1 ? "true" : "false"}
          >
            {step}
          </li>
        ))}
      </ol>
      <p className="spe-candidate-summary">{view.visualSummary}</p>
      <ul className="spe-truth-list" aria-label="Truth labels">
        {view.truth.map((label) => (
          <li
            key={label.axis}
            data-axis={label.axis}
            data-verdict={label.verdict}
            data-epistemic={label.epistemic}
          >
            <div className="spe-truth-head">
              <span className="spe-truth-axis">{truthAxisTitle(label.axis)}</span>
              <span className="spe-truth-verdict">{truthVerdictLabel(label.verdict)}</span>
              <span className="spe-truth-epistemic">{epistemicLabel(label.epistemic)}</span>
            </div>
            <p className="spe-truth-statement">{label.statement}</p>
            <p className="spe-truth-refuses">{label.refuses}</p>
          </li>
        ))}
      </ul>
      {preview && (
        <div className="spe-candidate-sketch">
          <p className="spe-panel-label">Structure sketch</p>
          <p className="spe-candidate-note">{preview.note}</p>
          <p className="spe-candidate-note">{preview.layoutGuess}</p>
          <div
            className="spe-candidate-frame"
            role="img"
            aria-label="Structural candidate sketch, not a pixel recreation"
            style={{ aspectRatio: frame }}
          >
            {preview.regions.filter((region) => region.bounds.w > 0 && region.bounds.h > 0).map((region) => (
              <div
                key={region.id}
                className="spe-candidate-region"
                data-confidence={region.confidence}
                style={{
                  left: percent(region.bounds.x),
                  top: percent(region.bounds.y),
                  width: percent(region.bounds.w),
                  height: percent(region.bounds.h),
                }}
              >
                <span>{region.roleGuess}</span>
                <span>{confidenceWord(region.confidence)}</span>
              </div>
            ))}
          </div>
          {preview.unplacedCount > 0 && (
            <p className="spe-candidate-note">
              {preview.unplacedCount} region guess(es) had no drawable area and were left off the sketch.
            </p>
          )}
        </div>
      )}
      {view.openQuestions.length > 0 && (
        <div>
          <p className="spe-panel-label">Open questions</p>
          <ul className="spe-candidate-questions">
            {view.openQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      )}
      <ul className="spe-candidate-limits">
        {view.limits.map((limit) => (
          <li key={limit}>{limit}</li>
        ))}
      </ul>
    </section>
  );
}
