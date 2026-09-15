import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EngineClient } from "./engine/client";
import type { CompilePhase, EngineError, EngineSuccessBody } from "./engine/types";
import pos001 from "./samples/pos001.json";
import neg001 from "./samples/neg001.json";
import { Header } from "./ui/Header";
import { Composer } from "./ui/Composer";
import { EngineStatus } from "./ui/EngineStatus";
import { ResultPanel } from "./ui/ResultPanel";
import { TrustPanel } from "./ui/TrustPanel";
import { ErrorOffline } from "./ui/ErrorOffline";
import { Footer } from "./ui/Footer";

function privacyFromText(text: string): {
  sensitivity: string | null;
  trust: string | null;
  authority: string | null;
} {
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const privacy =
      (obj.privacy as Record<string, string> | undefined) ||
      (obj.privacy_before as Record<string, string> | undefined) ||
      null;
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
  const [text, setText] = useState(() => JSON.stringify(pos001, null, 2));
  const [phase, setPhase] = useState<CompilePhase>("idle");
  const [phases, setPhases] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EngineError | null>(null);
  const [result, setResult] = useState<EngineSuccessBody | null>(null);
  const [sha256, setSha256] = useState<string | null>(null);
  const [imports, setImports] = useState<number | null>(null);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
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

  const privacy = useMemo(() => privacyFromText(text), [text]);

  const ensureClient = () => {
    if (!clientRef.current) clientRef.current = new EngineClient();
    return clientRef.current;
  };

  const compile = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setPhases([]);
    setPhase("loading_wasm");
    try {
      JSON.parse(text);
    } catch {
      setError({ code: "INVALID_JSON", message: "Composer JSON is invalid." });
      setPhase("unavailable");
      setBusy(false);
      return;
    }
    try {
      const client = ensureClient();
      const out = await client.compile(text, (p) => {
        setPhase(p);
        setPhases((prev) => (prev.includes(p) ? prev : [...prev, p]));
      });
      setError(out.error);
      setResult(out.result);
      setPhases(out.phases);
      setSha256(out.sha256);
      setImports(out.imports);
      setPhase(out.error ? "unavailable" : "done");
    } catch (err) {
      setError({
        code: "ENGINE_UNAVAILABLE",
        message: String(err instanceof Error ? err.message : err),
      });
      setPhase("unavailable");
    } finally {
      setBusy(false);
    }
  }, [text]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <Header
        sensitivity={privacy.sensitivity}
        trust={privacy.trust}
        authority={privacy.authority}
        online={online}
      />
      <main id="main" className="app-main" tabIndex={-1}>
        <div>
          <Composer value={text} onChange={setText} disabled={busy} />
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="primary"
              onClick={() => void compile()}
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? "Compiling…" : "Compile"}
            </button>
            <button
              type="button"
              onClick={() => setText(JSON.stringify(pos001, null, 2))}
              disabled={busy}
            >
              Load POS-001
            </button>
            <button
              type="button"
              onClick={() => setText(JSON.stringify(neg001, null, 2))}
              disabled={busy}
            >
              Load NEG-001
            </button>
          </div>
          <EngineStatus phase={phase} phases={phases} />
          <ErrorOffline online={online} error={error} />
        </div>
        <div>
          <ResultPanel error={error} result={result} />
          <TrustPanel sha256={sha256} imports={imports} />
        </div>
      </main>
      <Footer />
    </>
  );
}
