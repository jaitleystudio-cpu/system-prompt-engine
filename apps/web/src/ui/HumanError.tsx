import { errorCopy, ui } from "@spe/human-perspective";
import type { EngineError } from "../engine/types";
export function HumanError({ error }: { error: EngineError }) {
  if (error.code === "EMPTY_BRIEF") {
    return (
      <div className="spe-alert" role="alert">
        <h3>Add an idea first.</h3>
        <p>{error.message}</p>
      </div>
    );
  }
  const copy = errorCopy(error.code);
  return (
    <div className="spe-alert" role="alert">
      <h3>{copy.title}</h3>
      <p>{copy.support}</p>
      <details data-copy-depth="PROOF">
        <summary>{ui.diagnosticTitle}</summary>
        <code>{error.code}</code>
        <p>{error.message}</p>
      </details>
    </div>
  );
}
