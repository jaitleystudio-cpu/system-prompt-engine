import { useMemo, useState } from "react";
import { websiteMountContract } from "./mount-contract";
import { runWebsiteProduct, type WebsiteInput } from "./productFlow";
import "./website-product.css";

type Mode = WebsiteInput["kind"];

const STARTER = `{
  "spec_version": "website-spec/1",
  "title": "Local notes",
  "language": "en",
  "summary": "A private static page.",
  "theme": "light",
  "pages": [
    {
      "path": "index.html",
      "title": "Home",
      "sections": [
        {
          "kind": "prose",
          "heading": "Notes",
          "body": "This page is a local file."
        }
      ]
    }
  ]
}`;

export function WebsiteProduct() {
  const [mode, setMode] = useState<Mode>("website_spec");
  const [text, setText] = useState(STARTER);
  const [filename, setFilename] = useState("page.html");
  const [ran, setRan] = useState(false);

  const result = useMemo(() => {
    if (!ran) return null;
    if (mode === "website_spec") return runWebsiteProduct({ kind: mode, spec: text });
    if (mode === "local_saved_html") {
      return runWebsiteProduct({ kind: mode, filename, html: text });
    }
    return runWebsiteProduct({ kind: "live_url", url: text });
  }, [ran, mode, text, filename]);

  function saveLocal() {
    if (!result?.exportHtml) return;
    const blob = new Blob([result.exportHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "index.html";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      className="website-product"
      data-copy-depth="PROOF"
      data-route-mount={websiteMountContract.routeMountStatus}
      data-scene-ir-wired="true"
      aria-label="Website product"
    >
      <h1>Website</h1>
      <p className="website-product-note">
        A local spec can become a preview and a saved file. A saved file is not a web address. A web address is not opened.
      </p>
      <div className="website-product-modes" role="group" aria-label="Input kind">
        <button type="button" aria-pressed={mode === "website_spec"} onClick={() => { setMode("website_spec"); setRan(false); }}>
          Spec
        </button>
        <button type="button" aria-pressed={mode === "local_saved_html"} onClick={() => { setMode("local_saved_html"); setRan(false); }}>
          Saved file
        </button>
        <button type="button" aria-pressed={mode === "live_url"} onClick={() => { setMode("live_url"); setRan(false); }}>
          Web address
        </button>
      </div>
      {mode === "local_saved_html" ? (
        <label>
          File name
          <input
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
            aria-label="File name"
          />
        </label>
      ) : null}
      <label>
        Input
        <textarea
          value={text}
          onChange={(event) => { setText(event.target.value); setRan(false); }}
          aria-label="Website input"
        />
      </label>
      <div className="website-product-actions">
        <button type="button" onClick={() => setRan(true)}>
          Build preview
        </button>
        <button type="button" onClick={saveLocal} disabled={!result?.exportHtml}>
          Save HTML
        </button>
      </div>
      {result ? (
        <div role="status" aria-label="Website result">
          <p>{result.status}</p>
          <p>{result.reasons.join(", ")}</p>
          <p>Fetched: no. Live site: no. SceneIR owner: wired. Live URL: unavailable. Shell mount: not done.</p>
        </div>
      ) : null}
      {result?.previewHtml ? (
        <iframe
          className="website-product-preview"
          title="Local website preview"
          sandbox=""
          srcDoc={result.previewHtml}
        />
      ) : null}
    </section>
  );
}
