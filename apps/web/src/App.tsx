import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EngineClient } from "./engine/client";
import type { CompilePhase, EngineError, EngineSuccessBody } from "./engine/types";
import {
  CATEGORIES,
  TARGETS,
  buildAbiFixture,
  buildSpeArtifact,
  clearHistory,
  defaultIntentLens,
  downloadJson,
  exportHistory,
  importHistory,
  isHistoryOptIn,
  loadHistory,
  renderPromptArtifact,
  saveHistoryItem,
  setHistoryOptIn,
  type CategoryId,
  type HistoryItem,
  type IntentAtom,
  type SpeArtifactV1,
  type TargetId,
} from "@spe/web-runtime";
import { PrivacyIndicator } from "./ui/PrivacyIndicator";
import { TrustPanel } from "./ui/TrustPanel";
import { registerServiceWorker } from "./pwa";

type View = "home" | "workspace" | "history" | "artifact";

const DEMO_BEFORE = `write a leave email`;
const DEMO_AFTER = `You are a capable assistant.

## User request
write a leave email

## Protected constraints
- Preserve the user's stated goal without inventing obligations

## Open unknowns (ask if needed)
- Who is the primary audience?
- What does a good result look like?`;

function privacyFromEnvelope(env: unknown): {
  sensitivity: string | null;
  trust: string | null;
  authority: string | null;
} {
  try {
    const obj = env as Record<string, unknown>;
    const privacy = obj.privacy as Record<string, string> | undefined;
    if (!privacy) return { sensitivity: null, trust: null, authority: null };
    return {
      sensitivity: privacy.sensitivity ?? null,
      trust: privacy.trust ?? null,
      authority: privacy.authority ?? null,
    };
  } catch {
    return { sensitivity: null, trust: null, authority: null };
  }
}

export default function App() {
  const clientRef = useRef<EngineClient | null>(null);
  const [view, setView] = useState<View>("home");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [userRequest, setUserRequest] = useState("");
  const [category, setCategory] = useState<CategoryId>("Writing");
  const [target, setTarget] = useState<TargetId>("any");
  const [intent, setIntent] = useState(() => defaultIntentLens(""));
  const [phase, setPhase] = useState<CompilePhase>("idle");
  const [phases, setPhases] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError | null>(null);
  const [result, setResult] = useState<EngineSuccessBody | null>(null);
  const [sha256, setSha256] = useState<string | null>(null);
  const [imports, setImports] = useState<number | null>(null);
  const [envelope, setEnvelope] = useState<unknown>(null);
  const [rendered, setRendered] = useState<ReturnType<typeof renderPromptArtifact> | null>(null);
  const [artifact, setArtifact] = useState<SpeArtifactV1 | null>(null);
  const [historyOptIn, setHistoryOptInState] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    registerServiceWorker();
    setHistoryOptInState(isHistoryOptIn());
    setHistory(loadHistory());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clientRef.current?.terminate();
      clientRef.current = null;
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const privacy = useMemo(() => privacyFromEnvelope(envelope), [envelope]);

  const ensureClient = () => {
    if (!clientRef.current) clientRef.current = new EngineClient();
    return clientRef.current;
  };

  const updateIntentField = (
    bucket: keyof typeof intent,
    id: string,
    text: string,
  ) => {
    setIntent((prev) => ({
      ...prev,
      [bucket]: prev[bucket].map((a: IntentAtom) =>
        a.id === id ? { ...a, text } : a,
      ),
    }));
  };

  const compile = useCallback(async (requestText?: string) => {
    const goal = (requestText ?? userRequest).trim();
    if (!goal) {
      setError({ code: "INVALID_JSON", message: "Enter what you want SPE to build." });
      return;
    }
    const lens = requestText ? defaultIntentLens(goal) : intent;
    if (requestText) {
      setUserRequest(goal);
      setIntent(lens);
    }

    setBusy(true);
    setError(null);
    setResult(null);
    setRendered(null);
    setArtifact(null);
    setPhases([]);
    setPhase("loading_wasm");
    setView("workspace");

    let fixture: Record<string, unknown>;
    try {
      fixture = buildAbiFixture({
        userRequest: goal,
        category,
        target,
        confirmed: lens.confirmed,
        assumed: lens.assumed,
        unknowns: lens.unknowns,
        conflicts: lens.conflicts,
      });
      setEnvelope(fixture);
    } catch (err) {
      setError({
        code: "INVALID_JSON",
        message: String(err instanceof Error ? err.message : err),
      });
      setBusy(false);
      setPhase("unavailable");
      return;
    }

    try {
      const client = ensureClient();
      const out = await client.compile(JSON.stringify(fixture), (p) => {
        setPhase(p);
        setPhases((prev) => (prev.includes(p) ? prev : [...prev, p]));
      });
      setError(out.error);
      setResult(out.result);
      setPhases(out.phases);
      setSha256(out.sha256);
      setImports(out.imports);
      setPhase(out.error ? "unavailable" : "done");

      if (!out.error && out.result) {
        const prompt = renderPromptArtifact({
          userRequest: goal,
          target,
          envelopeOutput: out.result.output,
        });
        setRendered(prompt);
        const spe = await buildSpeArtifact({
          user_request: goal,
          category,
          target,
          envelope: fixture,
          wasm: {
            status: out.result.status,
            disposition: out.result.disposition,
            reason_code: out.result.reason_code,
            sha256: out.sha256,
            imports: out.imports,
            network_mode: "NONE",
            used_ts_fallback: false,
          },
          rendered_prompt: prompt.finalPrompt,
          intent: {
            confirmed: lens.confirmed,
            assumed: lens.assumed,
            unknowns: lens.unknowns,
            conflicts: lens.conflicts,
          },
        });
        setArtifact(spe);
        if (isHistoryOptIn()) {
          saveHistoryItem({
            id: spe.integrity.content_sha256.slice(0, 16),
            saved_at_utc: spe.created_at_utc,
            user_request: goal,
            category,
            target,
            prompt_preview: prompt.finalPrompt.slice(0, 240),
          });
          setHistory(loadHistory());
        }
      }
    } catch (err) {
      setError({
        code: "ENGINE_UNAVAILABLE",
        message: String(err instanceof Error ? err.message : err),
      });
      setPhase("unavailable");
    } finally {
      setBusy(false);
    }
  }, [userRequest, intent, category, target]);

  const onCopy = async () => {
    if (!rendered?.finalPrompt) return;
    await navigator.clipboard.writeText(rendered.finalPrompt);
  };

  const onExportSpe = () => {
    if (!artifact) return;
    downloadJson(`artifact-${Date.now()}.spe.json`, artifact);
  };

  const onExportJson = () => {
    if (!artifact) return;
    downloadJson(`spe-export-${Date.now()}.json`, artifact);
  };

  const onImportSpe = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as SpeArtifactV1;
    setArtifact(parsed);
    setUserRequest(parsed.user_request);
    setCategory((parsed.category as CategoryId) || "Writing");
    setTarget((parsed.target as TargetId) || "any");
    setRendered({
      userRequest: parsed.user_request,
      speAdded: [],
      finalPrompt: parsed.rendered_prompt,
      techniques: [],
    });
    setEnvelope(parsed.envelope);
    setView("artifact");
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="site-header">
        <a className="brand" href="#home" onClick={(e) => { e.preventDefault(); setView("home"); }}>
          <span className="brand-mark">System Prompt Engine</span>
          <span className="brand-sub">SPE · local-first</span>
        </a>
        <nav className="nav" aria-label="Primary">
          <button type="button" aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}>Home</button>
          <button type="button" aria-current={view === "workspace" ? "page" : undefined} onClick={() => setView("workspace")}>Workspace</button>
          <button type="button" aria-current={view === "history" ? "page" : undefined} onClick={() => setView("history")}>History</button>
          <button type="button" aria-current={view === "artifact" ? "page" : undefined} onClick={() => setView("artifact")}>.spe</button>
        </nav>
        <div className="header-meta">
          <PrivacyIndicator
            sensitivity={privacy.sensitivity}
            trust={privacy.trust}
            authority={privacy.authority}
            online={online}
          />
          <button
            type="button"
            className="ghost"
            aria-label="Toggle color theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {view === "home" && (
          <section className="hero" aria-labelledby="hero-title">
            <h1 id="hero-title">System Prompt Engine</h1>
            <p className="lede">
              Tell SPE what you want. SPE builds the instruction — requirements, unknowns, strategy —
              then you review and use it anywhere. Local compile. No mandatory provider.
            </p>
            <div className="hero-composer">
              <label htmlFor="one-line">One line</label>
              <textarea
                id="one-line"
                placeholder="e.g. Draft a leave email for next Friday"
                value={userRequest}
                onChange={(e) => {
                  setUserRequest(e.target.value);
                  setIntent(defaultIntentLens(e.target.value));
                }}
              />
              <div className="hero-actions">
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  aria-busy={busy}
                  onClick={() => void compile()}
                >
                  {busy ? "Building…" : "Build with SPE"}
                </button>
                <span className="privacy-line">
                  Privacy: core compile stays on this device · ₹0 mandatory provider · no analytics by default
                </span>
              </div>
            </div>
            <div className="before-after" aria-label="Before and after demo">
              <article className="ba-card">
                <h3>Before</h3>
                <pre>{DEMO_BEFORE}</pre>
              </article>
              <article className="ba-card">
                <h3>After SPE</h3>
                <pre>{DEMO_AFTER}</pre>
              </article>
            </div>
          </section>
        )}

        {view === "workspace" && (
          <section className="workspace" aria-labelledby="ws-title">
            <h1 id="ws-title" className="brand-mark">Prompt workspace</h1>
            <div className="toolbar">
              <div className="field">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CategoryId)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="target">Target AI</label>
                <select
                  id="target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value as TargetId)}
                >
                  {TARGETS.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <button type="button" className="primary" disabled={busy} onClick={() => void compile()}>
                {busy ? "Compiling…" : "Compile"}
              </button>
              <button type="button" className="secondary" disabled={!rendered} onClick={() => void onCopy()}>
                Copy prompt
              </button>
              <button type="button" className="secondary" disabled={!artifact} onClick={onExportSpe}>
                Download .spe
              </button>
              <button type="button" className="secondary" disabled={!artifact} onClick={onExportJson}>
                JSON export
              </button>
            </div>

            <div className="categories" role="group" aria-label="Categories">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            {error && (
              <div className="status-banner" role="alert">
                {error.code}: {error.message}
                {error.code === "WASM_INTEGRITY_MISMATCH"
                  ? " — fail closed. No TypeScript semantic fallback."
                  : ""}
              </div>
            )}

            <div className="workspace-grid">
              <div>
                <section className="panel" aria-labelledby="raw-title">
                  <h2 id="raw-title">Raw request</h2>
                  <textarea
                    aria-label="Raw request"
                    value={userRequest}
                    onChange={(e) => setUserRequest(e.target.value)}
                    rows={4}
                    style={{ width: "100%" }}
                  />
                </section>

                <section className="panel" aria-labelledby="intent-title" style={{ marginTop: "1rem" }}>
                  <h2 id="intent-title">Intent lens</h2>
                  <p className="privacy-line">Edit semantic meaning directly. Internal IR JSON stays hidden.</p>
                  <div className="lens-grid">
                    {(["confirmed", "assumed", "unknowns", "conflicts"] as const).map((bucket) => (
                      <div key={bucket} className="lens-card" data-kind={bucket === "unknowns" ? "unknown" : bucket === "conflicts" ? "conflict" : bucket}>
                        <header>
                          <span>{bucket}</span>
                          <span>{intent[bucket].length}</span>
                        </header>
                        {intent[bucket].map((atom) => (
                          <label key={atom.id} className="field">
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
                </section>
              </div>

              <div>
                <section className="panel" aria-labelledby="compiled-title">
                  <h2 id="compiled-title">Compiled prompt</h2>
                  <pre className="prompt-block">{rendered?.finalPrompt || "Compile to render a PromptArtifact."}</pre>
                </section>

                <section className="panel prompt-lens" aria-labelledby="pl-title" style={{ marginTop: "1rem" }}>
                  <h2 id="pl-title">Prompt lens</h2>
                  <div>
                    <div className="step">User request</div>
                    <pre className="prompt-block">{rendered?.userRequest || userRequest || "—"}</pre>
                  </div>
                  <div>
                    <div className="step">SPE added</div>
                    <pre className="prompt-block">{(rendered?.speAdded || []).join("\n") || "—"}</pre>
                  </div>
                  <div>
                    <div className="step">Final prompt</div>
                    <pre className="prompt-block">{rendered?.finalPrompt || "—"}</pre>
                  </div>
                </section>

                <section className="panel" aria-labelledby="tech-title" style={{ marginTop: "1rem" }}>
                  <h2 id="tech-title">What SPE understood · added · unknowns · techniques</h2>
                  <ul>
                    <li>Understood: {intent.confirmed[0]?.text || "—"}</li>
                    <li>Added: {(rendered?.speAdded || []).slice(0, 4).join("; ") || "—"}</li>
                    <li>Unknowns: {intent.unknowns.map((u) => u.label).join(", ") || "—"}</li>
                    <li>Conflicts: {intent.conflicts.length ? intent.conflicts.map((c) => c.text).join("; ") : "none"}</li>
                    <li>Techniques: {(rendered?.techniques || []).join(", ") || "—"}</li>
                    <li>WASM: {result ? `${result.status} / ${result.disposition}` : phase}</li>
                  </ul>
                </section>

                <div style={{ marginTop: "1rem" }}>
                  <TrustPanel
                    sha256={sha256}
                    imports={imports}
                    phase={phase}
                    usedTsFallback={false}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {view === "history" && (
          <section className="workspace" aria-labelledby="hist-title">
            <h1 id="hist-title" className="brand-mark">Local history</h1>
            <p className="privacy-line">
              Opt-in only. No accounts required. History never leaves this browser unless you export it.
            </p>
            <label className="field" style={{ maxWidth: "24rem" }}>
              <span>
                <input
                  type="checkbox"
                  checked={historyOptIn}
                  onChange={(e) => {
                    setHistoryOptIn(e.target.checked);
                    setHistoryOptInState(e.target.checked);
                    setHistory(e.target.checked ? loadHistory() : []);
                  }}
                />{" "}
                Enable local history on this device
              </span>
            </label>
            <div className="hero-actions" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="secondary"
                disabled={!historyOptIn}
                onClick={() => downloadJson("spe-history.json", exportHistory())}
              >
                Export history
              </button>
              <label className="secondary" style={{ padding: "0.65rem 1.1rem", borderRadius: "0.55rem", border: "1px solid #333", cursor: "pointer" }}>
                Import history
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  disabled={!historyOptIn}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const items = JSON.parse(await f.text()) as HistoryItem[];
                    importHistory(items);
                    setHistory(loadHistory());
                  }}
                />
              </label>
              <button
                type="button"
                className="ghost"
                disabled={!historyOptIn}
                onClick={() => {
                  clearHistory();
                  setHistory([]);
                }}
              >
                Clear history
              </button>
            </div>
            <div className="history-list" style={{ marginTop: "1.25rem" }}>
              {history.length === 0 && <p className="privacy-line">No saved items.</p>}
              {history.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className="history-item"
                  onClick={() => {
                    setUserRequest(h.user_request);
                    setCategory((h.category as CategoryId) || "Writing");
                    setTarget((h.target as TargetId) || "any");
                    setIntent(defaultIntentLens(h.user_request));
                    setView("workspace");
                  }}
                >
                  <strong>{h.user_request}</strong>
                  <span className="privacy-line">{h.category} · {h.target} · {h.saved_at_utc}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === "artifact" && (
          <section className="workspace" aria-labelledby="spe-title">
            <h1 id="spe-title" className="brand-mark">.spe artifact</h1>
            <div className="hero-actions">
              <button type="button" className="secondary" disabled={!artifact} onClick={onExportSpe}>
                Export .spe
              </button>
              <label className="secondary" style={{ padding: "0.65rem 1.1rem", borderRadius: "0.55rem", border: "1px solid #333", cursor: "pointer" }}>
                Import .spe
                <input
                  type="file"
                  accept="application/json,.json,.spe.json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onImportSpe(f);
                  }}
                />
              </label>
            </div>
            {!artifact && <p className="privacy-line">Compile a prompt to create a .spe artifact, or import one.</p>}
            {artifact && (
              <div className="workspace-grid" style={{ marginTop: "1rem" }}>
                <section className="panel">
                  <h2>Inspect</h2>
                  <div className="trust-grid">
                    <div>format: {artifact.spe_format}</div>
                    <div>integrity: {artifact.integrity.state}</div>
                    <div>content_sha256: {artifact.integrity.content_sha256}</div>
                    <div>wasm sha256: {artifact.wasm.sha256}</div>
                    <div>target: {artifact.target}</div>
                    <div>category: {artifact.category}</div>
                  </div>
                </section>
                <section className="panel">
                  <h2>Lineage summary</h2>
                  <div className="trust-grid">
                    <div>engine: {artifact.lineage.engine}</div>
                    <div>abi: {artifact.lineage.abi}</div>
                    <div>ui: {artifact.lineage.ui}</div>
                    <div>not_a_release: {String(artifact.lineage.not_a_release)}</div>
                    <div>created: {artifact.created_at_utc}</div>
                  </div>
                </section>
                <section className="panel" style={{ gridColumn: "1 / -1" }}>
                  <h2>Rendered prompt</h2>
                  <pre className="prompt-block">{artifact.rendered_prompt}</pre>
                </section>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="site-footer">
        <div>System Prompt Engine — free core · portable .spe · offline deterministic compile</div>
        <div className="claim-strip">
          allowed: local-first · no mandatory provider · portable .spe · tested local deterministic core
          {" · "}
          forbidden here: World #1 · independently replicated · production proven
        </div>
        <div className="claim-strip">phases: {phases.join(" → ") || "idle"}</div>
      </footer>
    </>
  );
}
