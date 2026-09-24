import { SpeechInput } from "../input/SpeechInput";
import { ui } from "@spe/human-perspective";
import { HumanError } from "../ui/HumanError";
import type { IntentAtom } from "@spe/web-runtime";
import {
  CATEGORIES,
  TARGETS,
  type CategoryId,
  type TargetId,
} from "@spe/web-runtime";
import type {
  CompilePhase,
  EngineError,
  EngineSuccessBody,
} from "../engine/types";
import { PrivacyIndicator } from "../ui/PrivacyIndicator";
import { TrustPanel } from "../ui/TrustPanel";
import type { SpeArtifactV1 } from "@spe/web-runtime";

type Mode = "simple" | "inspect" | "pro";
type Lens = "prompt" | "intent" | "changes" | "techniques" | "artifact";

type Props = {
  userRequest: string;
  setUserRequest: (v: string) => void;
  category: CategoryId;
  setCategory: (v: CategoryId) => void;
  target: TargetId;
  setTarget: (v: TargetId) => void;
  intent: {
    confirmed: IntentAtom[];
    assumed: IntentAtom[];
    unknowns: IntentAtom[];
    conflicts: IntentAtom[];
  };
  updateIntentField: (
    bucket: "confirmed" | "assumed" | "unknowns" | "conflicts",
    id: string,
    text: string,
  ) => void;
  rendered: {
    userRequest: string;
    speAdded: string[];
    finalPrompt: string;
    techniques: string[];
  } | null;
  artifact: SpeArtifactV1 | null;
  error: EngineError | null;
  result: EngineSuccessBody | null;
  phase: CompilePhase;
  phases: string[];
  sha256: string | null;
  imports: number | null;
  busy: boolean;
  onCompile: () => void;
  onCopy: () => void;
  onExportSpe: () => void;
  onExportJson: () => void;
  onImportSpe: (file: File) => void;
  privacy: {
    sensitivity: string | null;
    trust: string | null;
    authority: string | null;
  };
  online: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  lens: Lens;
  setLens: (l: Lens) => void;
};

export function Workspace(props: Props) {
  const {
    userRequest,
    setUserRequest,
    category,
    setCategory,
    target,
    setTarget,
    intent,
    updateIntentField,
    rendered,
    artifact,
    error,
    result,
    phase,
    phases,
    sha256,
    imports,
    busy,
    onCompile,
    onCopy,
    onExportSpe,
    onExportJson,
    onImportSpe,
    privacy,
    online,
    mode,
    setMode,
    lens,
    setLens,
  } = props;

  return (
    <section className="spe-workspace" aria-labelledby="ws-title">
      <header className="spe-ws-head">
        <div>
          <p className="spe-kicker">Workspace</p>
          <h1 id="ws-title">A space for your next idea</h1>
        </div>
        <div className="spe-mode-switch" role="group" aria-label="Depth">
          {(["simple", "inspect", "pro"] as Mode[]).map((m) => (
            <button
              key={{ simple: "Create", inspect: "Inspect", pro: "Proof" }[m]}
              type="button"

              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                if (
                  m === "simple" &&
                  (lens === "artifact" || lens === "techniques")
                )
                  setLens("prompt");
              }}
            >
              {{ simple: "Create", inspect: "Inspect", pro: "Proof" }[m]}
            </button>
          ))}
        </div>
      </header>

      <div className="spe-ws-toolbar">
        <label className="spe-field">
          <span>Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryId)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="spe-field">
          <span>Target AI</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as TargetId)}
          >
            {TARGETS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="spe-build"
          disabled={busy}
          onClick={onCompile}
        >
          {busy ? ui.working : ui.build}
        </button>
      </div>

      {(mode === "inspect" || mode === "pro") && (
        <div
          className="spe-pipeline"
          data-copy-depth="INSPECT"
          aria-label="Preparation stages"
        >
          <div className="spe-pipeline-head">
            <span>Preparation stages</span>
            <span className="spe-pipeline-live">
              {busy ? "LIVE" : result ? "DONE" : "IDLE"}
            </span>
          </div>
          <ol className="spe-pipeline-steps">
            {(
              [
                "loading_wasm",
                "verifying_integrity",
                "instantiating",
                "ready",
                "evaluating",
                "done",
              ] as const
            ).map((step) => {
              const done =
                phases.includes(step) ||
                (step === "done" && Boolean(result && !error));
              const active =
                phase === step || (step === "done" && phase === "done");
              const label =
                step === "loading_wasm"
                  ? "Load engine"
                  : step === "verifying_integrity"
                    ? "Check integrity"
                    : step === "instantiating"
                      ? "Initialize"
                      : step === "ready"
                        ? "Ready"
                        : step === "evaluating"
                          ? "Evaluate"
                          : "Complete";
              return (
                <li key={step} data-active={active} data-done={done && !active}>
                  {label}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {error && <HumanError error={error} />}

      <div className="spe-ws-lenses" role="group" aria-label="Lenses">
        {(
          (mode === "simple"
            ? ["prompt", "intent", "changes"]
            : [
                "prompt",
                "intent",
                "changes",
                "techniques",
                "artifact",
              ]) as Lens[]
        ).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lens === l}
            onClick={() => setLens(l)}
          >
            {
              {
                prompt: "Your prompt",
                intent: "Your details",
                changes: "What changed",
                techniques: "Approach",
                artifact: "File details",
              }[l]
            }
          </button>
        ))}
      </div>

      <div className="spe-ws-grid" data-mode={mode}>
        <aside className="spe-ws-side">
          <label className="spe-field grow">
            <span>Your idea</span>
            <textarea
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              rows={5}
            />
          </label>

          <SpeechInput disabled={busy} onInsert={text => setUserRequest([userRequest.trim(), text].filter(Boolean).join("\n\n"))} />

          {(mode !== "simple" || lens === "intent") && (
            <div className="spe-intent" aria-label="Your details">
              <h2>Your details</h2>
              {(["confirmed", "assumed", "unknowns", "conflicts"] as const).map(
                (bucket) => (
                  <div
                    key={bucket}
                    className="spe-intent-card"
                    data-kind={
                      bucket === "unknowns"
                        ? "unknown"
                        : bucket === "conflicts"
                          ? "conflict"
                          : bucket
                    }
                  >
                    <header>
                      <span className="spe-node-icon" aria-hidden="true" />
                      <strong>
                        {
                          {
                            confirmed: "What must stay true",
                            assumed: "Context and preferences",
                            unknowns: "Questions still open",
                            conflicts: "Details to resolve",
                          }[bucket]
                        }
                      </strong>
                    </header>
                    {intent[bucket].map((atom) => (
                      <label key={atom.id} className="spe-field">
                        <span>{atom.label}</span>
                        <textarea
                          value={atom.text}
                          aria-label={`${bucket} ${atom.label}`}
                          onChange={(e) =>
                            updateIntentField(bucket, atom.id, e.target.value)
                          }
                        />
                      </label>
                    ))}
                  </div>
                ),
              )}
            </div>
          )}
        </aside>

        <div className="spe-ws-main">
          {lens === "prompt" && (
            <div className="spe-reveal-card">
              <div className="spe-reveal-meta">
                <p className="spe-kicker">
                  {rendered ? "Prompt ready" : "Your prompt starts here"}
                </p>
                <p>Target: {TARGETS.find((t) => t.id === target)?.label}</p>
                <ul className="spe-chip-row">
                  <li>Portable</li>
                  <li>Prepared on this device</li>
                  <li>{rendered?.techniques.length ?? 0} techniques</li>
                  <li>
                    {intent.unknowns.filter((item) => item.text.trim()).length}{" "}
                    open questions
                  </li>
                </ul>
              </div>
              <pre
                className="spe-prompt-body"
                tabIndex={0}
                aria-label="Your prompt"
              >
                {rendered?.finalPrompt || "Shape your prompt to see it here."}
              </pre>
              <div className="spe-actions">
                <button
                  type="button"
                  className="spe-build"
                  disabled={!rendered}
                  onClick={onCopy}
                >
                  Copy Prompt
                </button>
                <button
                  type="button"
                  className="spe-ghost"
                  disabled={!artifact}
                  onClick={onExportSpe}
                >
                  Download .spe
                </button>
                {mode !== "simple" && (
                  <button
                    type="button"
                    className="spe-ghost"
                    disabled={!artifact}
                    onClick={onExportJson}
                  >
                    JSON
                  </button>
                )}
                <label className="spe-ghost file">
                  Import .spe
                  <input
                    type="file"
                    accept=".spe,application/json,.json,.spe.json"
                    className="import-file"
                    aria-label="Import .spe file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onImportSpe(f);
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {lens === "changes" && (
            <div className="spe-prompt-lens">
              <div>
                <p className="spe-label">User request</p>
                <pre>{rendered?.userRequest || userRequest || "—"}</pre>
              </div>
              <div>
                <p className="spe-label">SPE added</p>
                <pre>{(rendered?.speAdded || []).join("\n") || "—"}</pre>
              </div>
              <div>
                <p className="spe-label">Final prompt</p>
                <pre>{rendered?.finalPrompt || "—"}</pre>
              </div>
            </div>
          )}

          {lens === "techniques" && (
            <ul className="spe-tech-list">
              {(
                rendered?.techniques || [
                  "Shape your prompt to see the approach",
                ]
              ).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}

          {lens === "intent" && (
            <p className="spe-muted">
              Add what matters to your idea. Keep your requirements, preferences
              and open questions distinct.
            </p>
          )}

          {lens === "artifact" && artifact && (
            <div className="spe-artifact-inspect" data-copy-depth="PROOF">
              <p>format: {artifact.spe_format}</p>
              <p>Checksum: {artifact.integrity.state === "VERIFIED" ? "matches" : artifact.integrity.state.toLowerCase()}. This checks file consistency, not authorship or trust.</p>
              <p>sha256: {artifact.integrity.content_sha256}</p>
              <p>lineage: {artifact.lineage.engine}</p>
            </div>
          )}
        </div>

        {mode !== "simple" && (
          <aside className="spe-ws-rail" data-copy-depth="PROOF">
            {(mode === "inspect" || mode === "pro") && (
              <PrivacyIndicator
                sensitivity={privacy.sensitivity}
                trust={privacy.trust}
                authority={privacy.authority}
                online={online}
              />
            )}
            {mode === "pro" && (
              <TrustPanel
                sha256={sha256}
                imports={imports}
                phase={phase}
                usedTsFallback={false}
              />
            )}
            {mode === "pro" && (
              <div className="spe-pro-meta">
                <p>
                  WASM:{" "}
                  {result ? `${result.status}/${result.disposition}` : phase}
                </p>
                <p>phases: {phases.join(" → ") || "idle"}</p>
                <p>not_a_release: true</p>
              </div>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
