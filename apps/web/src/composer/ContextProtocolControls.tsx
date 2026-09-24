import type { ContextProtocolCompileOutput, SourceMode } from "../engine/types";

/** Public source control shown to visitors (mapped to WASM AUTO/ON/OFF). */
export type PublicSourceControl = "AUTO" | "ADD_SOURCES" | "NO_SOURCES";

/** Public depth control — values match WASM requested_depth. */
export type PublicDepthControl = "AUTO" | "FAST" | "SMART" | "DEEP";

export type ContextProtocolUiMode = "simple" | "inspect" | "pro";

const DEFAULT_SOURCE: PublicSourceControl = "AUTO";
const DEFAULT_DEPTH: PublicDepthControl = "AUTO";

const SOURCE_OPTIONS: {
  id: PublicSourceControl;
  label: string;
  hint: string;
}[] = [
  {
    id: "AUTO",
    label: "Use current sources when they help.",
    hint: "Add context only when it improves the answer.",
  },
  {
    id: "ADD_SOURCES",
    label: "Add sources",
    hint: "Prefer grounded context for this request.",
  },
  {
    id: "NO_SOURCES",
    label: "No sources",
    hint: "Stay with what you already provided.",
  },
];

const DEPTH_OPTIONS: {
  id: PublicDepthControl;
  label: string;
  hint: string;
}[] = [
  {
    id: "AUTO",
    label: "Automatic",
    hint: "Match depth to the job.",
  },
  {
    id: "FAST",
    label: "Fast",
    hint: "Keep the path short.",
  },
  {
    id: "SMART",
    label: "Smart",
    hint: "Balanced care and speed.",
  },
  {
    id: "DEEP",
    label: "Deep",
    hint: "Take more care with evidence.",
  },
];

/** Map visitor source control to WASM source_mode (ON/OFF/AUTO). */
export function mapPublicSourceToWasm(
  source: PublicSourceControl,
): SourceMode {
  if (source === "ADD_SOURCES") return "ON";
  if (source === "NO_SOURCES") return "OFF";
  return "AUTO";
}

export type StaleContextSnapshot = {
  freshness_state?: string | null;
  user_request?: string | null;
  /** Optional intent snapshot — must remain unchanged by refresh suggestion. */
  protected_intent?: unknown;
};

export type StaleRefreshSuggestion = {
  message: string;
  /** Echo of the original request — refresh must not rewrite intent. */
  preserved_user_request: string | null;
  preserved_intent: unknown;
  action: "SUGGEST_CONTEXT_REFRESH";
};

/**
 * Suggest refreshing stale saved context without mutating ProtectedIntent.
 * Pure helper for import/.spe reopen flows (Task 13 UX; lineage fields in Task 14).
 */
export function suggestStaleContextRefresh(
  snapshot: StaleContextSnapshot,
): StaleRefreshSuggestion | null {
  const state = String(snapshot.freshness_state ?? "").toUpperCase();
  if (state !== "STALE" && state !== "VERSION_BOUND") return null;
  return {
    action: "SUGGEST_CONTEXT_REFRESH",
    message:
      "Some saved context may be out of date. Refresh sources when you are ready — your request stays the same.",
    preserved_user_request: snapshot.user_request ?? null,
    preserved_intent: snapshot.protected_intent ?? null,
  };
}

type Props = {
  source: PublicSourceControl;
  depth: PublicDepthControl;
  onSourceChange: (v: PublicSourceControl) => void;
  onDepthChange: (v: PublicDepthControl) => void;
  /** Create / Inspect / Proof workspace depth. */
  uiMode?: ContextProtocolUiMode;
  disabled?: boolean;
  /** WASM compile output for Inspect surfaces only (render-only). */
  inspectOutput?: ContextProtocolCompileOutput | null;
  /** Optional stale-.spe refresh notice (Simple-safe wording). */
  refreshNotice?: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function InspectPanel({
  output,
}: {
  output: ContextProtocolCompileOutput;
}) {
  const summary = asRecord(output.context_summary);
  const quality = asRecord(output.quality_record);
  const contract = asRecord(output.execution_contract);
  const domains = Array.isArray(summary?.domain_tags)
    ? (summary!.domain_tags as unknown[]).map(String)
    : [];
  const reasons = Array.isArray(summary?.reason_codes)
    ? (summary!.reason_codes as unknown[]).map(String)
    : [];
  const limitations = Array.isArray(quality?.known_limitations)
    ? (quality!.known_limitations as unknown[]).map(String)
    : [];
  const contradictions = Array.isArray(quality?.unverified_claims)
    ? (quality!.unverified_claims as unknown[]).map(String)
    : [];
  const completed = Array.isArray(quality?.completed_nodes)
    ? (quality!.completed_nodes as unknown[]).length
    : 0;
  const unknown = Array.isArray(quality?.unknown_nodes)
    ? (quality!.unknown_nodes as unknown[]).length
    : 0;
  const protocolId =
    typeof quality?.protocol_id === "string"
      ? quality.protocol_id
      : typeof contract?.protocol_id === "string"
        ? String(contract.protocol_id)
        : "—";

  return (
    <div
      className="spe-ctx-inspect"
      data-copy-depth="INSPECT"
      aria-label="Context and protocol details"
    >
      <h3>Context details</h3>
      <ul className="spe-ctx-inspect-list">
        <li>
          <span>Sources</span>
          <strong>
            mode {output.source_mode}
            {summary?.max_sources != null
              ? ` · up to ${String(summary.max_sources)}`
              : ""}
            {domains.length ? ` · ${domains.join(", ")}` : ""}
          </strong>
        </li>
        <li>
          <span>Freshness</span>
          <strong>
            {String(quality?.freshness_state ?? summary?.freshness_required ?? "—")}
          </strong>
        </li>
        <li>
          <span>Contradictions / unverified</span>
          <strong>
            {contradictions.length
              ? contradictions.slice(0, 4).join("; ")
              : "None listed"}
          </strong>
        </li>
        <li>
          <span>Selected protocol</span>
          <strong>
            {protocolId} · resolved {output.resolved_depth}
            {contract?.depth != null ? ` · contract ${String(contract.depth)}` : ""}
          </strong>
        </li>
        <li>
          <span>Quality checks</span>
          <strong>
            completed {completed} · still open {unknown}
            {reasons.length ? ` · ${reasons.join(", ")}` : ""}
          </strong>
        </li>
        <li>
          <span>Limitations</span>
          <strong>
            {limitations.length
              ? limitations.join(" ")
              : "No extra limitations recorded."}
          </strong>
        </li>
        <li>
          <span>Capability profile</span>
          <strong>{output.capability_profile_mode}</strong>
        </li>
      </ul>
    </div>
  );
}

export function ContextProtocolControls({
  source = DEFAULT_SOURCE,
  depth = DEFAULT_DEPTH,
  onSourceChange,
  onDepthChange,
  uiMode = "simple",
  disabled = false,
  inspectOutput = null,
  refreshNotice = null,
}: Props) {
  const showInspect = uiMode === "inspect" || uiMode === "pro";

  return (
    <section
      className="spe-ctx-protocol"
      aria-label="Sources and depth"
      data-testid="context-protocol-controls"
    >
      <p className="spe-ctx-protocol-lead">
        Use the best available tools when they help.
      </p>

      <div
        className="spe-ctx-protocol-group"
        role="radiogroup"
        aria-label="Sources"
      >
        <p className="spe-ctx-protocol-label" id="spe-ctx-source-label">
          Sources
        </p>
        <div className="spe-ctx-protocol-options" aria-labelledby="spe-ctx-source-label">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="spe-ctx-protocol-option"
              role="radio"
              aria-checked={source === opt.id}
              aria-label={opt.label}
              title={opt.hint}
              disabled={disabled}
              data-source={opt.id}
              onClick={() => onSourceChange(opt.id)}
            >
              <span className="spe-ctx-protocol-option-title">{opt.label}</span>
              <span className="spe-ctx-protocol-option-hint">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        className="spe-ctx-protocol-group"
        role="radiogroup"
        aria-label="Depth"
      >
        <p className="spe-ctx-protocol-label" id="spe-ctx-depth-label">
          Depth
        </p>
        <div className="spe-ctx-protocol-options spe-ctx-protocol-options--compact" aria-labelledby="spe-ctx-depth-label">
          {DEPTH_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="spe-ctx-protocol-option"
              role="radio"
              aria-checked={depth === opt.id}
              aria-label={opt.label}
              title={opt.hint}
              disabled={disabled}
              data-depth={opt.id}
              onClick={() => onDepthChange(opt.id)}
            >
              <span className="spe-ctx-protocol-option-title">{opt.label}</span>
              <span className="spe-ctx-protocol-option-hint">{opt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {refreshNotice ? (
        <p className="spe-ctx-refresh" role="status">
          {refreshNotice}
        </p>
      ) : null}

      {showInspect && inspectOutput ? (
        <InspectPanel output={inspectOutput} />
      ) : null}
    </section>
  );
}

export { DEFAULT_SOURCE, DEFAULT_DEPTH, SOURCE_OPTIONS, DEPTH_OPTIONS };
