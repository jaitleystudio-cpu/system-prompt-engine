import { EngineClient } from "../../apps/web/src/engine/client.ts";
import {
  clearHistory,
  loadHistory,
  saveHistoryItem,
  setHistoryOptIn,
} from "@spe/web-runtime";

const params = new URLSearchParams(location.search);
const canary = params.get("canary") || "";
const repeats = Math.max(1, Number(params.get("repeats") || "1"));
const phase = params.get("phase") || "compile";

function finish(payload) {
  window.__r3g = payload;
}

async function compileSamples(jsonText) {
  const client = new EngineClient();
  const samples = [];
  let outcome = null;
  try {
    for (let i = 0; i < repeats; i += 1) {
      const t0 = performance.now();
      outcome = await client.compile(jsonText, () => {});
      samples.push({
        i,
        ms: performance.now() - t0,
        error: outcome && outcome.error ? outcome.error : null,
        sha256: outcome ? outcome.sha256 : null,
        phases: outcome ? outcome.phases : null,
      });
    }
  } finally {
    client.terminate();
  }
  return { samples, outcome };
}

async function storeLocally() {
  setHistoryOptIn(true);
  saveHistoryItem({
    id: `r3g-${canary}`,
    saved_at_utc: new Date().toISOString(),
    user_request: canary,
    category: "r3g",
    target: "local",
    prompt_preview: canary,
  });
  const stored = loadHistory().some((item) => item && item.user_request === canary);
  clearHistory();
  setHistoryOptIn(false);
  return { stored, cleared: loadHistory().length === 0 };
}

function pngFile() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#224466";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(6, 6, 28, 12);
  ctx.fillRect(6, 24, 52, 8);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("png blob missing"));
        return;
      }
      resolve(new File([blob], "r4-local.png", { type: "image/png" }));
    }, "image/png");
  });
}

function imageData224() {
  const canvas = document.createElement("canvas");
  canvas.width = 224;
  canvas.height = 224;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#88aacc";
  ctx.fillRect(0, 0, 224, 224);
  ctx.fillStyle = "#222";
  ctx.fillRect(40, 40, 80, 80);
  return ctx.getImageData(0, 0, 224, 224);
}

async function runJourneys() {
  const journeys = [];
  const push = (id, status, extra) => {
    journeys.push({ id, status, ...(extra || {}) });
  };

  try {
    const {
      buildSpeArtifact,
      parseSpeArtifactText,
      downloadJson,
    } = await import("@spe/web-runtime");
    const artifact = await buildSpeArtifact({
      user_request: canary,
      category: "r4",
      target: "local",
      envelope: { local: true },
      wasm: {
        status: "observed",
        disposition: "local",
        reason_code: null,
        sha256: null,
        imports: null,
        network_mode: "NONE",
        used_ts_fallback: false,
      },
      rendered_prompt: canary,
      intent: { confirmed: [], assumed: [], unknowns: [], conflicts: [] },
    });
    const text = JSON.stringify(artifact);
    downloadJson("r4-local.spe.json", artifact);
    push("spe_export", "RUN", {
      reason: "blob download of a local .spe JSON; no upload endpoint",
      bytes: text.length,
    });
    const parsed = await parseSpeArtifactText(text);
    push("spe_import", parsed && parsed.artifact ? "RUN" : "NOT_RUN", {
      reason: parsed && parsed.artifact ? "local parseSpeArtifactText" : "parse returned empty",
      integrity: parsed && parsed.artifact ? parsed.artifact.integrity.state : null,
      report: parsed && parsed.report ? parsed.report.status : null,
    });
  } catch (err) {
    const reason = String(err && err.message ? err.message : err);
    push("spe_export", "NOT_RUN", { reason });
    push("spe_import", "NOT_RUN", { reason });
  }

  try {
    const {
      clearHistory: clear2,
      loadHistory: load2,
      saveHistoryItem: save2,
      setHistoryOptIn: opt2,
    } = await import("@spe/web-runtime");
    opt2(true);
    save2({
      id: `r4-${canary}`,
      saved_at_utc: new Date().toISOString(),
      user_request: canary,
      category: "r4",
      target: "local",
      prompt_preview: canary,
    });
    const stored = load2().some((item) => item && item.user_request === canary);
    clear2();
    opt2(false);
    push("history", stored && load2().length === 0 ? "RUN" : "NOT_RUN", {
      reason: stored ? "localStorage round-trip cleared" : "history item was not readable",
    });
  } catch (err) {
    push("history", "NOT_RUN", { reason: String(err && err.message ? err.message : err) });
  }

  let observation = null;
  try {
    const { observeImageFile } = await import("../../apps/web/src/media/imageObserve.ts");
    const file = await pngFile();
    observation = await observeImageFile(file);
    push("media", observation && observation.kind === "image" ? "RUN" : "NOT_RUN", {
      reason: "local canvas image via observeImageFile; product /media route is not on this branch",
      width: observation ? observation.width : null,
    });
  } catch (err) {
    push("media", "NOT_RUN", { reason: String(err && err.message ? err.message : err) });
  }
  push("media_product_route", "LOCAL_PENDING", {
    reason: "App route /media exists only on spe-lane-r3-e-shell. No shell dist to instrument. Shell source was not copied.",
  });

  try {
    const { tryTesseractOcr } = await import("../../apps/web/src/media/ocrLite.ts");
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const ocr = await tryTesseractOcr(canvas);
    push("ocr", "NOT_RUN", {
      reason: "Product tryTesseractOcr returns null and does not ship a WASM OCR pack (HOLD). System tesseract was not invoked. A null hook is not an OCR pass.",
      product_hook: ocr === null ? "null" : "unexpected_value",
    });
  } catch (err) {
    push("ocr", "NOT_RUN", { reason: String(err && err.message ? err.message : err) });
  }

  try {
    if (!observation) throw new Error("image observation absent");
    const { screenshotToCodePackage } = await import("../../apps/web/src/media/screenshotToCode.ts");
    const pack = screenshotToCodePackage(observation);
    const n = pack && Array.isArray(pack.scaffolds) ? pack.scaffolds.length : 0;
    push("screenshot", n > 0 ? "RUN" : "NOT_RUN", {
      reason: n > 0 ? "local screenshotToCodePackage; scaffolds stayed in the page" : "no scaffolds",
      scaffolds: n,
    });
  } catch (err) {
    push("screenshot", "NOT_RUN", { reason: String(err && err.message ? err.message : err) });
  }

  try {
    const resp = await fetch("/__r3g/fixtures/local.mp4", { cache: "no-store" });
    if (!resp.ok) throw new Error(`local mp4 fixture HTTP ${resp.status}`);
    const blob = await resp.blob();
    const file = new File([blob], "r4-local.mp4", { type: "video/mp4" });
    const { observeVideoFile } = await import("../../apps/web/src/media/videoSample.ts");
    const video = await observeVideoFile(file);
    const frames = video && Array.isArray(video.frames) ? video.frames.length : 0;
    push("video", frames > 0 ? "RUN" : "NOT_RUN", {
      reason: frames > 0 ? "ffmpeg color mp4 fetched from 127.0.0.1 and sampled locally; bytes were not uploaded" : "decoder returned no frames",
      frames,
      bytes: file.size,
    });
  } catch (err) {
    push("video", "NOT_RUN", { reason: String(err && err.message ? err.message : err) });
  }

  push("asr", "NOT_RUN", {
    reason: "Speech qualification dictationSmoke is NOT_RUN. Chrome Web Speech was not started because it would send audio to Google. whisper-cli is absent. A cloud dictation skip is not an ASR privacy pass.",
  });

  try {
    const { ingestUrl, ingestHtmlFile } = await import("../../apps/web/src/media/urlIngest.ts");
    const blocked = await ingestUrl("https://example.com/", {
      timeoutMs: 2000,
      networkPolicy: { pageOrigin: location.origin, connectSrc: "'self'" },
    });
    const html = new File(
      [`<!doctype html><title>local</title><p>${canary}</p>`],
      "private.html",
      { type: "text/html" },
    );
    const localDoc = await ingestHtmlFile(html);
    const blockedOk = blocked && blocked.status === "url_reference_only" && blocked.reason === "csp_connect_src_self";
    push("website", blockedOk && localDoc && localDoc.status === "ok" ? "RUN" : "NOT_RUN", {
      reason: blockedOk
        ? "connect-src 'self' kept https://example.com as a reference; local HTML file was read in-page. Product route /website was not mounted."
        : `ingest status ${blocked && blocked.status} reason ${blocked && blocked.reason}`,
      ingest_status: blocked ? blocked.status : null,
      ingest_reason: blocked ? blocked.reason || null : null,
      local_html: localDoc ? localDoc.status : null,
    });
  } catch (err) {
    push("website", "NOT_RUN", { reason: String(err && err.message ? err.message : err) });
  }
  push("website_product_route", "LOCAL_PENDING", {
    reason: "App route /website exists only on spe-lane-r3-e-shell. No built shell app was found. Shell source was not copied.",
  });

  try {
    const React = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { SpeIntelligence } = await import("../../apps/web/src/scene/SpeIntelligence.tsx");
    const host = document.createElement("div");
    host.style.cssText = "width:320px;height:180px;position:fixed;left:0;top:0";
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(React.createElement(SpeIntelligence, { state: "IDLE", quality: "BALANCED", paused: true }));
    await new Promise((r) => setTimeout(r, 2500));
    const canvas = host.querySelector("canvas");
    push("three_d", canvas ? "RUN" : "NOT_RUN", {
      reason: canvas
        ? "local three.js SpeIntelligence canvas; no remote glTF"
        : "WebGL canvas was not created",
    });
    root.unmount();
    host.remove();
  } catch (err) {
    push("three_d", "NOT_RUN", { reason: String(err && err.message ? err.message : err) });
  }

  push("research", "NOT_RUN", {
    reason: "This worktree has no live scholarly network adapter. Local query minimization was not treated as a lookup. No external research request was made.",
  });

  try {
    const { classifySubjectsMobileNet, getOnnxLastError } = await import("../../apps/web/src/engine/onnxSemantic.ts");
    const subjects = await classifySubjectsMobileNet(imageData224());
    const err = getOnnxLastError();
    if (subjects && subjects.length > 0) {
      push("model_pack", "RUN", {
        reason: "Vendored loopback fetch of /models/mobilenetv2-12-int8.onnx and /ort/. Not an external download and not a raw media upload.",
        subjects: subjects.length,
        external_download: false,
      });
    } else {
      push("model_pack", "NOT_RUN", {
        reason: err || "local MobileNet returned no subjects; a failed local model load is not privacy proof and is not an external download",
      });
    }
  } catch (err) {
    push("model_pack", "NOT_RUN", { reason: String(err && err.message ? err.message : err) });
  }

  return journeys;
}

async function main() {
  if (phase === "journeys") {
    let journeys = [];
    let fatal = null;
    try {
      journeys = await runJourneys();
    } catch (err) {
      fatal = String(err && err.stack ? err.stack : err);
    }
    finish({ done: true, phase, journeys, fatal });
    return;
  }

  const fixtureResp = await fetch("/src/samples/pos001.json", { cache: "no-store" });
  if (!fixtureResp.ok) throw new Error(`fixture fetch ${fixtureResp.status}`);
  const fixture = await fixtureResp.json();
  fixture.payload.facts[0].statement = canary;
  fixture.payload.user_preferences[0].statement = canary;
  const jsonText = JSON.stringify(fixture);
  if (!jsonText.includes(canary)) throw new Error("canary missing from compile payload");
  let compile = { samples: [], outcome: null, error: null };
  try {
    compile = await compileSamples(jsonText);
  } catch (err) {
    compile.error = String(err && err.message ? err.message : err);
  }
  let storage = { stored: false, cleared: false, error: null };
  try {
    storage = await storeLocally();
  } catch (err) {
    storage.error = String(err && err.message ? err.message : err);
  }
  finish({
    done: true,
    canaryPresentInPayload: true,
    compile,
    storage,
  });
}

main().catch((err) => {
  finish({ done: true, fatal: String(err && err.stack ? err.stack : err) });
});
