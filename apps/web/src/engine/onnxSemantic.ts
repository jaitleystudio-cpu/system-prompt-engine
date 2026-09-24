/**
 * Lazy STANDARD classifier: MobileNet V2 INT8 via onnxruntime-web.
 * Loads only when Image/Screenshot/Video requests STANDARD.
 * Homepage VISION_MODEL_BYTES stays 0 until then.
 * Output = MODEL_JUDGMENT subjects — never VERIFIED_FACT / K3.
 */
import {
  getVisionModelBytes,
  recordVisionAssetLoad,
  VISION_PACK_DOCS,
} from "./visionBudget";
import type { SemanticSubject } from "../media/semanticTypes";

type OrtModule = typeof import("onnxruntime-web");

let ortPromise: Promise<OrtModule> | null = null;
let sessionPromise: Promise<import("onnxruntime-web").InferenceSession> | null =
  null;
let labelsPromise: Promise<string[]> | null = null;
let lastError: string | null = null;

export function getOnnxLastError(): string | null {
  return lastError;
}

export function isOnnxWarm(): boolean {
  return sessionPromise != null;
}

async function loadOrt(): Promise<OrtModule> {
  if (!ortPromise) {
    ortPromise = (async () => {
      const ort = await import("onnxruntime-web");
      // Same-origin WASM (CSP connect-src 'self')
      ort.env.wasm.wasmPaths = "/ort/";
      ort.env.wasm.numThreads = 1;
      try {
        // Prefer WebGPU when present; fall back silently to WASM.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nav = navigator as any;
        if (!nav?.gpu) {
          /* wasm only */
        }
      } catch {
        /* ignore */
      }
      recordVisionAssetLoad(
        "ort-wasm-simd-threaded.wasm",
        VISION_PACK_DOCS.ortWasmApproxBytes,
      );
      return ort;
    })().catch((err) => {
      ortPromise = null;
      throw err;
    });
  }
  return ortPromise;
}

async function loadLabels(): Promise<string[]> {
  if (!labelsPromise) {
    labelsPromise = (async () => {
      const res = await fetch("/models/imagenet_classes.txt", {
        credentials: "omit",
      });
      if (!res.ok) throw new Error(`labels HTTP ${res.status}`);
      const text = await res.text();
      recordVisionAssetLoad("imagenet_classes.txt", text.length);
      return text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    })().catch((err) => {
      labelsPromise = null;
      throw err;
    });
  }
  return labelsPromise;
}

async function loadSession(): Promise<
  import("onnxruntime-web").InferenceSession
> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await loadOrt();
      const modelUrl = "/models/mobilenetv2-12-int8.onnx";
      const res = await fetch(modelUrl, { credentials: "omit" });
      if (!res.ok) throw new Error(`model HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      recordVisionAssetLoad(
        "mobilenetv2-12-int8.onnx",
        buf.byteLength || VISION_PACK_DOCS.classifierApproxBytes,
      );
      const providers: string[] = [];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((navigator as any).gpu) providers.push("webgpu");
      } catch {
        /* ignore */
      }
      providers.push("wasm");
      return ort.InferenceSession.create(buf, {
        executionProviders: providers,
      });
    })().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

/** Preprocess ImageData → NCHW float32 1×3×224×224 ImageNet norm. */
export function preprocessImageNet(
  data: ImageData,
  size = 224,
): { tensor: Float32Array; layout: "NCHW" } {
  const { width, height, data: px } = data;
  const out = new Float32Array(1 * 3 * size * size);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.min(width - 1, Math.floor((x * width) / size));
      const sy = Math.min(height - 1, Math.floor((y * height) / size));
      const i = (sy * width + sx) * 4;
      const a = px[i + 3] / 255;
      const r = ((px[i] / 255) * a + (1 - a)) ;
      const g = ((px[i + 1] / 255) * a + (1 - a));
      const b = ((px[i + 2] / 255) * a + (1 - a));
      const idx = y * size + x;
      out[0 * size * size + idx] = (r - mean[0]) / std[0];
      out[1 * size * size + idx] = (g - mean[1]) / std[1];
      out[2 * size * size + idx] = (b - mean[2]) / std[2];
    }
  }
  return { tensor: out, layout: "NCHW" };
}

function softmaxTopK(
  logits: Float32Array | number[],
  labels: string[],
  k = 5,
): SemanticSubject[] {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) max = Math.max(max, logits[i] as number);
  const exps = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    const v = Math.exp((logits[i] as number) - max);
    exps[i] = v;
    sum += v;
  }
  const scored: { i: number; p: number }[] = [];
  for (let i = 0; i < exps.length; i++) scored.push({ i, p: exps[i] / sum });
  scored.sort((a, b) => b.p - a.p);
  return scored.slice(0, k).map((s) => ({
    label: labels[s.i] ?? `class_${s.i}`,
    score: Math.round(s.p * 1000) / 1000,
    method: "mobilenet-v2-int8" as const,
  }));
}

/**
 * Classify subjects with MobileNet. Returns null on any failure (caller keeps LITE).
 */
export async function classifySubjectsMobileNet(
  data: ImageData,
  signal?: AbortSignal,
): Promise<SemanticSubject[] | null> {
  if (typeof window === "undefined") return null;
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  try {
    lastError = null;
    const [session, labels, ort] = await Promise.all([
      loadSession(),
      loadLabels(),
      loadOrt(),
    ]);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const { tensor } = preprocessImageNet(data);
    const inputName = session.inputNames[0];
    const feeds: Record<string, import("onnxruntime-web").Tensor> = {
      [inputName]: new ort.Tensor("float32", tensor, [1, 3, 224, 224]),
    };
    const out = await session.run(feeds);
    const outName = session.outputNames[0];
    const logits = out[outName].data as Float32Array;
    return softmaxTopK(logits, labels, 5);
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return null;
  }
}

export function currentVisionBytes(): number {
  return getVisionModelBytes();
}
