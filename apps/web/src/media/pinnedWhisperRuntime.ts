import type { MediaRuntime } from "./MediaProductPanel";
import type { MediaResult } from "./mediaProductModel";

/**
 * /media runtime. The app server starts LocalMediaSession and exposes it at
 * /api/media. This file does not spawn an engine and does not read a page global.
 * LOCAL_NEURAL is accepted only when that session reports neuralSessionRan.
 */

function unavailable(errorCode: string): MediaResult {
  return {
    status: "ERROR",
    text: "",
    mode: "UNAVAILABLE",
    errorCode,
    neuralSessionRan: false,
    timestampsProven: false,
    segments: [],
    progressPercent: null,
    egressAttempts: 0,
  };
}

function cancelled(): MediaResult {
  return {
    status: "CANCELLED",
    text: "",
    mode: "UNAVAILABLE",
    errorCode: "CANCELLED",
    neuralSessionRan: false,
    timestampsProven: false,
    segments: [],
    progressPercent: null,
    egressAttempts: 0,
  };
}

function readResult(value: unknown): MediaResult {
  if (!value || typeof value !== "object") return unavailable("HOST_ERROR");
  const row = value as Record<string, unknown>;
  const status = row.status;
  const mode = row.mode;
  const neural = row.neuralSessionRan === true;
  const egress = typeof row.egressAttempts === "number" ? row.egressAttempts : 0;
  if (status === "CANCELLED") return { ...cancelled(), egressAttempts: egress };
  if (status === "NO_SPEECH") {
    return {
      status: "NO_SPEECH",
      text: "",
      mode: "LOCAL_FALLBACK",
      errorCode: null,
      neuralSessionRan: false,
      timestampsProven: false,
      segments: [],
      progressPercent: null,
      egressAttempts: egress,
    };
  }
  if (status === "SPEECH") {
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (mode !== "LOCAL_NEURAL" || !neural || !text) return unavailable("FALSE_NEURAL");
    const progress = typeof row.progressPercent === "number" ? row.progressPercent : null;
    return {
      status: "SPEECH",
      text,
      mode: "LOCAL_NEURAL",
      errorCode: null,
      neuralSessionRan: true,
      timestampsProven: false,
      segments: [],
      progressPercent: progress != null && progress >= 0 && progress <= 100 ? progress : null,
      egressAttempts: egress,
    };
  }
  if (status !== "ERROR") return unavailable("HOST_ERROR");
  const errorCode = typeof row.errorCode === "string" ? row.errorCode : "ERROR";
  const errorMode = mode === "LOCAL_FALLBACK" || mode === "BROWSER_SERVICE" || mode === "UNAVAILABLE" ? mode : "UNAVAILABLE";
  return {
    status: "ERROR",
    text: "",
    mode: errorMode,
    errorCode,
    neuralSessionRan: false,
    timestampsProven: false,
    segments: [],
    progressPercent: null,
    egressAttempts: egress,
  };
}

export const pinnedWhisperRuntime: MediaRuntime = {
  transcribe: async (file, hooks) => {
    const jobId = crypto.randomUUID();
    const cancelHost = () => {
      void fetch("/api/media/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId }),
      }).catch(() => undefined);
    };
    const onAbort = () => cancelHost();
    hooks.signal.addEventListener("abort", onAbort, { once: true });
    if (hooks.signal.aborted) return cancelled();
    hooks.onProgress({ percent: null, note: "Starting the local media session on this machine." });
    try {
      const bytes = await file.arrayBuffer();
      if (hooks.signal.aborted) return cancelled();
      const response = await fetch("/api/media/transcribe", {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "x-spe-job-id": jobId,
          "x-spe-file-name": encodeURIComponent(file.name),
        },
        body: bytes,
        signal: hooks.signal,
      });
      if (hooks.signal.aborted) return cancelled();
      if (!response.ok) return unavailable("NOT_MOUNTED");
      return readResult(await response.json());
    } catch {
      if (hooks.signal.aborted) return cancelled();
      return unavailable("NOT_MOUNTED");
    } finally {
      hooks.signal.removeEventListener("abort", onAbort);
    }
  },
};
