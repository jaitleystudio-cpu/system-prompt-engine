import { useEffect, useState } from "react";
import "./MediaProductPanel.css";
import { recognizeImageFile, type OcrExecution, type OcrExecutionMode } from "./ocrLite";

const IDLE: OcrExecution = {
  mode: "UNAVAILABLE",
  text: "",
  regions: [],
  errorCode: null,
  egressAttempts: 0,
};

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * /ocr. Drop or choose an image. The pinned local engine returns text and regions.
 * Text-band detection is not shown as OCR.
 */
export function OcrRoute() {
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [execution, setExecution] = useState<OcrExecution>(IDLE);
  const [product, setProduct] = useState("HOLD");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dead = false;
    async function pull() {
      try {
        const res = await fetch("/api/ocr/health");
        if (!res.ok) return;
        const body = (await res.json()) as { OCR_PRODUCT?: unknown };
        if (dead) return;
        if (body.OCR_PRODUCT === "HOLD") setProduct("HOLD");
      } catch {
        /* no host in a file-only harness */
      }
    }
    void pull();
    return () => {
      dead = true;
    };
  }, [execution]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function take(next: File | null) {
    setFile(next);
    setFileName(next?.name ?? "");
    setExecution(IDLE);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return next ? URL.createObjectURL(next) : "";
    });
  }

  async function run() {
    if (!file) return;
    setBusy(true);
    try {
      setExecution(await recognizeImageFile(file));
    } finally {
      setBusy(false);
    }
  }

  const mode: OcrExecutionMode = execution.mode;

  return (
    <section
      className="spe-media-product"
      data-testid="ocr-panel"
      data-ocr-mode={mode}
      data-ocr-product={product}
      data-egress={execution.egressAttempts}
    >
      <h2>Local OCR</h2>
      <p>Choose or drop an image. The pinned engine reads it on this machine.</p>
      <p data-testid="ocr-mode">
        Mode: <strong>{mode}</strong>
      </p>
      <p data-testid="ocr-product">OCR product: {product}</p>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          take(event.dataTransfer.files?.[0] ?? null);
        }}
      >
        <input
          type="file"
          accept="image/*"
          data-testid="ocr-file"
          onChange={(event) => take(event.target.files?.[0] ?? null)}
        />
      </div>
      {preview ? <img src={preview} alt="" data-testid="ocr-preview" /> : null}
      <p data-testid="ocr-file-name">{fileName}</p>
      <div className="spe-media-product-actions">
        <button type="button" data-testid="ocr-run" onClick={() => void run()} disabled={!file || busy}>
          Read image
        </button>
        <button
          type="button"
          data-testid="ocr-copy"
          disabled={!execution.text}
          onClick={() => void navigator.clipboard.writeText(execution.text)}
        >
          Copy text
        </button>
        <button
          type="button"
          data-testid="ocr-export-text"
          disabled={!execution.text}
          onClick={() => download("ocr.txt", execution.text, "text/plain")}
        >
          Export text
        </button>
        <button
          type="button"
          data-testid="ocr-export-json"
          disabled={mode !== "LOCAL_OCR"}
          onClick={() => download("ocr.json", JSON.stringify(execution, null, 2), "application/json")}
        >
          Export JSON
        </button>
      </div>
      {execution.errorCode ? (
        <p data-testid="ocr-error" role="alert">
          {execution.errorCode}
        </p>
      ) : null}
      {execution.text ? <pre data-testid="ocr-text">{execution.text}</pre> : null}
      {execution.regions.length > 0 ? (
        <ul data-testid="ocr-regions">
          {execution.regions.map((region, index) => (
            <li key={`${region.text}-${index}`}>
              {region.text} {Math.round(region.bounds.x * 100)} {Math.round(region.bounds.y * 100)}
            </li>
          ))}
        </ul>
      ) : null}
      <p data-testid="ocr-egress">Network sends for this image: {execution.egressAttempts}</p>
    </section>
  );
}
