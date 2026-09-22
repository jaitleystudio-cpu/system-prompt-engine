import { errorCopy, ui } from "@spe/human-perspective";
import type { EngineError } from "../engine/types";
export function HumanError({ error }: { error: EngineError }) {
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
