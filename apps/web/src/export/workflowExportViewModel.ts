/**
 * Display model for an already-produced spe.workflow-export.v1 document.
 * G11 (spe_runtime.workflow_export) owns extraction, stripping, projection,
 * loss_state, warnings, and target_document. This module only checks the
 * document shape and prepares it for the screen. It does not project n8n,
 * Make, or Zapier workflows.
 */

export const EXPORT_CONTRACT_VERSION = "spe.workflow-export.v1";
export const LIVE_IMPORT_STATUS = "UNVERIFIED" as const;
export const RUNTIME_BINDING = "NOT_INTEGRATED" as const;
export const PREVIEW_CHAR_LIMIT = 8000;

const TARGETS = ["n8n", "make", "zapier", "generic_json", "generic_text"] as const;
const LOSS_STATES = ["NONE", "DEGRADED", "UNSUPPORTED"] as const;
const FACETS = [
  "prompt_body",
  "variables",
  "required_inputs",
  "expected_outputs",
  "constraints",
  "provider_target",
] as const;
const FIDELITY_STATES = ["PRESERVED", "DEGRADED", "UNSUPPORTED"] as const;

export type ExportTarget = (typeof TARGETS)[number];
export type LossState = (typeof LOSS_STATES)[number];
export type FidelityState = (typeof FIDELITY_STATES)[number];

export interface FidelityEntry {
  facet: (typeof FACETS)[number];
  state: FidelityState;
  code: string;
  reason: string;
}

export interface WorkflowExportView {
  contractVersion: typeof EXPORT_CONTRACT_VERSION;
  target: ExportTarget;
  lossState: LossState;
  fidelity: FidelityEntry[];
  warnings: Array<{ code: string; message: string }>;
  strippedPaths: string[];
  strippedVariableNames: string[];
  promptDisposition: "VERBATIM" | "WITHHELD_CREDENTIAL";
  promptPreview: string;
  targetDocumentText: string;
  previewText: string;
  previewTruncated: boolean;
  filename: string;
  liveImportStatus: typeof LIVE_IMPORT_STATUS;
}

export type PresentExportResult =
  | { ok: true; view: WorkflowExportView }
  | { ok: false; status: "REFUSE" | "UNKNOWN"; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function ledgerLoss(fidelity: FidelityEntry[]): LossState {
  if (fidelity.some((item) => item.state === "UNSUPPORTED")) return "UNSUPPORTED";
  if (fidelity.some((item) => item.state === "DEGRADED")) return "DEGRADED";
  return "NONE";
}

function refuse(reason: string): PresentExportResult {
  return { ok: false, status: "REFUSE", reason };
}

function unknown(reason: string): PresentExportResult {
  return { ok: false, status: "UNKNOWN", reason };
}

function readFidelity(value: unknown): FidelityEntry[] | PresentExportResult {
  if (!Array.isArray(value) || value.length !== FACETS.length) {
    return refuse("fidelity must list the six canonical facets");
  }
  const seen = new Set<string>();
  const entries: FidelityEntry[] = [];
  for (const item of value) {
    if (!isRecord(item)) return refuse("fidelity entry must be an object");
    if (!isOneOf(item.facet, FACETS)) return refuse("fidelity facet is not canonical");
    if (!isOneOf(item.state, FIDELITY_STATES)) return refuse("fidelity state is not canonical");
    if (typeof item.code !== "string" || item.code.length === 0) return refuse("fidelity code is missing");
    if (typeof item.reason !== "string" || item.reason.length === 0) {
      return refuse("fidelity reason is missing");
    }
    if (seen.has(item.facet)) return refuse("fidelity facet is repeated");
    seen.add(item.facet);
    entries.push({
      facet: item.facet,
      state: item.state,
      code: item.code,
      reason: item.reason,
    });
  }
  return entries;
}

function documentText(targetDocument: unknown): string {
  if (typeof targetDocument === "string") return targetDocument;
  return JSON.stringify(targetDocument, null, 2);
}

export function presentExportDocument(input: unknown): PresentExportResult {
  if (!isRecord(input)) return refuse("export document must be an object");

  const version = input.export_contract_version;
  if (typeof version !== "string" || version.length === 0) {
    return unknown("export contract version is missing");
  }
  if (version !== EXPORT_CONTRACT_VERSION) {
    return unknown("export contract version is not spe.workflow-export.v1");
  }
  if (!isOneOf(input.target, TARGETS)) return refuse("export target is not a known G11 target");
  if (!isOneOf(input.loss_state, LOSS_STATES)) return refuse("loss_state is not canonical");

  const fidelity = readFidelity(input.fidelity);
  if (!Array.isArray(fidelity)) return fidelity;
  if (input.loss_state !== ledgerLoss(fidelity)) {
    return refuse("loss_state does not match the fidelity ledger");
  }

  if (!isRecord(input.guarantees)) return refuse("guarantees are missing");
  if (
    input.guarantees.network !== false ||
    input.guarantees.credentials_stored !== false ||
    input.guarantees.executed !== false ||
    input.guarantees.authority !== "NONE"
  ) {
    return refuse("export guarantees claim network, credentials, execution, or authority");
  }

  if (!Array.isArray(input.warnings)) return refuse("warnings must be a list");
  const warnings: Array<{ code: string; message: string }> = [];
  for (const warning of input.warnings) {
    if (!isRecord(warning)) return refuse("warning must be an object");
    if (typeof warning.code !== "string" || warning.code.length === 0) {
      return refuse("warning code is missing");
    }
    if (typeof warning.message !== "string" || warning.message.length === 0) {
      return refuse("warning message is missing");
    }
    warnings.push({ code: warning.code, message: warning.message });
  }

  if (!Array.isArray(input.stripped_paths)) return refuse("stripped_paths must be a list");
  const strippedPaths: string[] = [];
  for (const path of input.stripped_paths) {
    if (typeof path !== "string" || path.length === 0) return refuse("stripped path is empty");
    strippedPaths.push(path);
  }

  if (!isRecord(input.canonical)) return refuse("canonical contract is missing");
  const disposition = input.canonical.prompt_body_disposition;
  if (disposition !== "VERBATIM" && disposition !== "WITHHELD_CREDENTIAL") {
    return refuse("prompt disposition is not canonical");
  }
  if (typeof input.canonical.prompt_body !== "string") return refuse("prompt body is missing");
  if (disposition === "WITHHELD_CREDENTIAL" && input.canonical.prompt_body !== "") {
    return refuse("withheld prompt still carries a body");
  }

  if (!Array.isArray(input.canonical.variables)) return refuse("variables must be a list");
  const strippedVariableNames: string[] = [];
  for (const variable of input.canonical.variables) {
    if (!isRecord(variable)) return refuse("variable must be an object");
    if (typeof variable.name !== "string" || variable.name.length === 0) {
      return refuse("variable name is missing");
    }
    if (variable.disposition === "STRIPPED") {
      if (variable.value !== "") return refuse("stripped variable still carries a value");
      strippedVariableNames.push(variable.name);
    } else if (variable.disposition !== "KEPT") {
      return refuse("variable disposition is not canonical");
    }
  }

  if (!("target_document" in input)) return refuse("target_document is missing");
  const targetDocumentText = documentText(input.target_document);
  const previewTruncated = targetDocumentText.length > PREVIEW_CHAR_LIMIT;
  const previewText = previewTruncated
    ? `${targetDocumentText.slice(0, PREVIEW_CHAR_LIMIT)}\n… preview truncated`
    : targetDocumentText;

  return {
    ok: true,
    view: {
      contractVersion: EXPORT_CONTRACT_VERSION,
      target: input.target,
      lossState: input.loss_state,
      fidelity,
      warnings,
      strippedPaths,
      strippedVariableNames,
      promptDisposition: disposition,
      promptPreview: disposition === "VERBATIM" ? input.canonical.prompt_body : "",
      targetDocumentText,
      previewText,
      previewTruncated,
      filename: `spe-workflow-${input.target}.json`,
      liveImportStatus: LIVE_IMPORT_STATUS,
    },
  };
}
