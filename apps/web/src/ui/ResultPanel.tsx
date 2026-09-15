import { useState } from "react";
import type { EngineError, EngineSuccessBody } from "../engine/types";

type Props = {
  error: EngineError | null;
  result: EngineSuccessBody | null;
};

export function ResultPanel({ error, result }: Props) {
  const [copied, setCopied] = useState(false);
  const payload = error
    ? JSON.stringify(error, null, 2)
    : result
      ? JSON.stringify(result, null, 2)
      : "";

  const onCopy = async () => {
    if (!payload) return;
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="panel" aria-labelledby="result-heading">
      <h2 id="result-heading">Result</h2>
      {error ? (
        <p className="pill danger" role="alert">
          {error.code}: {error.message}
        </p>
      ) : null}
      {result ? (
        <dl className="kv">
          <dt>status</dt>
          <dd>{result.status}</dd>
          <dt>disposition</dt>
          <dd>{result.disposition}</dd>
          <dt>reason_code</dt>
          <dd>{result.reason_code ?? "—"}</dd>
        </dl>
      ) : null}
      {!error && !result ? <p className="meta">No compile yet.</p> : null}
      <pre className="result" tabIndex={0} aria-label="Raw engine JSON">
        {payload || "// compile to see ABI result"}
      </pre>
      <div className="row">
        <button type="button" onClick={onCopy} disabled={!payload} aria-label="Copy result JSON">
          {copied ? "Copied" : "Copy result"}
        </button>
      </div>
    </section>
  );
}
