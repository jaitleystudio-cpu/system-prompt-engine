import { renderToStaticMarkup } from "react-dom/server";
import { ExecutionContractPanel } from "../../apps/web/src/workspace/ExecutionContractPanel";

type AnyRecord = Record<string, unknown>;

export function renderContract(
  record: AnyRecord,
  presentation: "simple" | "inspect",
): string {
  return renderToStaticMarkup(
    <ExecutionContractPanel
      protocolOutput={null}
      artifact={null}
      record={record as never}
      onRunDry={() => {}}
      initialPresentation={presentation}
    />,
  );
}
