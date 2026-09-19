import type { IntentAtom } from "@spe/web-runtime";
import { CATEGORIES, TARGETS, type CategoryId, type TargetId } from "@spe/web-runtime";
import type { CompilePhase, EngineError, EngineSuccessBody } from "../engine/types";
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
  updateIntentField: (bucket: "confirmed" | "assumed" | "unknowns" | "conflicts", id: string, text: string) => void;
  rendered: { userRequest: string; speAdded: string[]; finalPrompt: string; techniques: string[] } | null;
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
  privacy: { sensitivity: string | null; trust: string | null; authority: string | null };
  online: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  lens: Lens;
  setLens: (l: Lens) => void;
};

export function Workspace(props: Props) {
  const {
    userRequest, setUserRequest, category, setCategory, target, setTarget,
    intent, updateIntentField, rendered, artifact, error, result, phase, phases,
    sha256, imports, busy, onCompile, onCopy, onExportSpe, onExportJson, onImportSpe,
    privacy, online, mode, setMode, lens, setLens,
  } = props;
  const targetLabel = TARGETS.find((item) => item.id === target)?.label ?? "Any AI";

  return (
    <section className="forge-workspace" id="workspace" aria-labelledby="ws-title">
      <header className="forge-workspace-head">
        <div>
          <p className="forge-eyebrow">Creative instrument</p>
          <h1 id="ws-title">Prompt workbench</h1>
        </div>
        <dl className="forge-workspace-state">
          <div><dt>Phase</dt><dd>{phase}</dd></div>
          <div><dt>Target</dt><dd>{targetLabel}</dd></div>
          <div><dt>Shell</dt><dd>{online ? "Online" : "Offline"}</dd></div>
        </dl>
        <div className="forge-mode-switch" role="tablist" aria-label="Inspection depth">
          {(["simple", "inspect", "pro"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      <div className="forge-workspace-toolbar">
        <label className="forge-field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="forge-field">
          <span>Target AI</span>
          <select value={target} onChange={(e) => setTarget(e.target.value as TargetId)}>
            {TARGETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <button type="button" className="forge-primary" disabled={busy} onClick={onCompile}>
          {busy ? "Compiling intent…" : "Compile Intent"}
        </button>
      </div>

      {(mode === "inspect" || mode === "pro" || busy || phases.length > 0) && (
        <div className="forge-pipeline" aria-label="Real compile pipeline">
          <div className="forge-pipeline-head">
            <span>Local compile path</span>
            <span>{busy ? "ACTIVE" : result ? "COMPLETE" : "IDLE"}</span>
          </div>
          <ol className="forge-pipeline-steps">
            {(["loading_wasm", "verifying_integrity", "instantiating", "ready", "evaluating", "done"] as const).map((step) => {
              const done = phases.includes(step) || (step === "done" && Boolean(result && !error));
              const active = phase === step || (step === "done" && phase === "done");
              const label =
                step === "loading_wasm" ? "Understand" :
                step === "verifying_integrity" ? "Decompose" :
                step === "instantiating" ? "Enrich" :
                step === "ready" ? "Structure" :
                step === "evaluating" ? "Verify" : "Compile";
              return (
                <li key={step} data-active={active} data-done={done && !active}>{label}</li>
              );
            })}
          </ol>
        </div>
      )}

      {error && (
        <div className="forge-alert" role="alert">
          {error.code}: {error.message}
          {error.code === "WASM_INTEGRITY_MISMATCH" ? " — fail closed. No TypeScript semantic fallback." : ""}
        </div>
      )}

      <div className="forge-workbench" data-mode={mode}>
        <aside className="forge-input-rail">
          <div className="forge-rail-heading">
            <h2>Raw thought</h2>
            <span>SOURCE</span>
          </div>
          <label className="forge-field grow">
            <span>Raw request</span>
            <textarea value={userRequest} onChange={(e) => setUserRequest(e.target.value)} rows={5} />
          </label>

          {(mode !== "simple" || lens === "intent") && (
            <div className="forge-intent-lens" aria-label="Intent lens">
              <h2>Intent lens</h2>
              {(["confirmed", "assumed", "unknowns", "conflicts"] as const).map((bucket) => (
                <div key={bucket} className="forge-intent-group" data-kind={bucket === "unknowns" ? "unknown" : bucket === "conflicts" ? "conflict" : bucket}>
                  <header>
                    <strong>{bucket}</strong>
                    <span>{intent[bucket].length || "—"}</span>
                  </header>
                  {intent[bucket].map((atom) => (
                    <label key={atom.id} className="forge-field">
                      <span>{atom.label}</span>
                      <textarea
                        value={atom.text}
                        aria-label={`${bucket} ${atom.label}`}
                        onChange={(e) => updateIntentField(bucket, atom.id, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </aside>

        <div className="forge-artifact-bench">
          <div className="forge-bench-toolbar">
            <div>
              <p>Prompt Artifact</p>
              <span>{result ? `${result.status} / ${result.disposition}` : "Compile to render"}</span>
            </div>
            <div className="forge-mode-switch compact" role="tablist" aria-label="Inspection depth duplicate">
              {(["simple", "inspect", "pro"] as Mode[]).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {lens === "prompt" && (
            <article className="forge-prompt-artifact">
              <header>
                <div>
                  <p>Rendered prompt</p>
                  <h2>Prompt Artifact</h2>
                </div>
                <span>{rendered ? targetLabel : "Unavailable"}</span>
              </header>
              <pre>{rendered?.finalPrompt || "No artifact rendered.\n\nEnter a raw thought, review its intent, then compile."}</pre>
              <div className="forge-artifact-seam" aria-hidden="true" />
              <div className="forge-actions">
                <button type="button" className="forge-primary" disabled={!rendered} onClick={onCopy}>Copy prompt</button>
                <button type="button" className="forge-secondary" disabled={!artifact} onClick={onExportSpe}>Download .spe</button>
                <button type="button" className="forge-secondary" disabled={!artifact} onClick={onExportJson}>JSON</button>
                <label className="forge-secondary file">
                  Import .spe
                  <input type="file" accept="application/json,.json,.spe.json" hidden onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImportSpe(f);
                  }} />
                </label>
              </div>
            </article>
          )}

          {lens === "changes" && (
            <div className="forge-prompt-lens">
              <div><p className="spe-label">User request</p><pre>{rendered?.userRequest || userRequest || "—"}</pre></div>
              <div><p className="spe-label">SPE added</p><pre>{(rendered?.speAdded || []).join("\n") || "—"}</pre></div>
              <div><p className="spe-label">Final prompt</p><pre>{rendered?.finalPrompt || "—"}</pre></div>
            </div>
          )}

          {lens === "techniques" && (
            <ol className="forge-technique-list">
              {(rendered?.techniques || ["Compile to list techniques"]).map((t) => <li key={t}>{t}</li>)}
            </ol>
          )}

          {lens === "intent" && (
            <div className="forge-lens-message">
              <p>Intent remains editable at the source rail.</p>
              <span>Internal IR JSON stays hidden in Simple mode.</span>
            </div>
          )}

          {lens === "artifact" && (
            <div className="forge-artifact-inspect">
              {artifact ? (
                <>
                  <p><span>format</span>{artifact.spe_format}</p>
                  <p><span>integrity</span>{artifact.integrity.state}</p>
                  <p><span>sha256</span>{artifact.integrity.content_sha256}</p>
                  <p><span>lineage</span>{artifact.lineage.engine}</p>
                </>
              ) : <p><span>artifact</span>Unavailable</p>}
            </div>
          )}
        </div>

        <aside className="forge-lens-rail">
          <h2>Lens rail</h2>
          <div className="forge-lens-tabs" role="tablist" aria-label="Lenses">
            {(["prompt", "intent", "changes", "techniques", "artifact"] as Lens[]).map((l) => (
              <button key={l} type="button" role="tab" aria-selected={lens === l} onClick={() => setLens(l)}>
                <span>{l}</span>
                <i aria-hidden="true" />
              </button>
            ))}
          </div>

          {mode !== "simple" && (
            <div className="forge-instrument-rail">
            {(mode === "inspect" || mode === "pro") && (
              <PrivacyIndicator
                sensitivity={privacy.sensitivity}
                trust={privacy.trust}
                authority={privacy.authority}
                online={online}
              />
            )}
            {mode === "pro" && (
              <TrustPanel sha256={sha256} imports={imports} phase={phase} usedTsFallback={false} />
            )}
            {mode === "pro" && (
              <div className="forge-pro-meta">
                <p>WASM: {result ? `${result.status}/${result.disposition}` : phase}</p>
                <p>phases: {phases.join(" → ") || "idle"}</p>
                <p>not_a_release: true</p>
              </div>
            )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
