import type { MediaRuntime } from "./MediaProductPanel";
import type { MediaResult } from "./mediaProductModel";

type WhisperPayload = {
  status: MediaResult["status"];
  text: string;
  mode: MediaResult["mode"];
  errorCode: string | null;
  neuralSessionRan: boolean;
  timestampsProven: boolean;
  segments: MediaResult["segments"];
  progressPercent: number | null;
  egressAttempts: number;
};

declare global {
  interface Window {
    __speWhisper?: (payload: { name: string; b64: string }) => Promise<WhisperPayload>;
    __speWhisperCancel?: () => Promise<void>;
  }
}

function bytesToB64(bytes: Uint8Array): string {
  let raw = "";
  const chunk = 0x4000;
  for (let i = 0; i < bytes.length; i += chunk) {
    raw += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(raw);
}

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

/**
 * Route runtime for /media. Same pinned LocalMediaSession bridge as the
 * shell proof. LOCAL_NEURAL is returned only when that session says
 * neuralSessionRan. No second engine and no browser speech API.
 */
export const pinnedWhisperRuntime: MediaRuntime = {
  transcribe: async (file, hooks) => {
    const bridge = window.__speWhisper;
    if (typeof bridge !== "function") {
      return unavailable("NOT_MOUNTED");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    hooks.onProgress({ percent: null, note: "Local neural session running." });
    const finished = bridge({ name: file.name, b64: bytesToB64(bytes) });
    const aborted = new Promise<{ cancelled: true }>((resolve) => {
      if (hooks.signal.aborted) resolve({ cancelled: true });
      hooks.signal.addEventListener(
        "abort",
        () => {
          void window.__speWhisperCancel?.();
          resolve({ cancelled: true });
        },
        { once: true },
      );
    });
    const raced = await Promise.race([
      finished.then((result) => ({ cancelled: false as const, result })),
      aborted,
    ]);
    if (raced.cancelled || hooks.signal.aborted) {
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
    const result = raced.result;
    if (result.mode === "LOCAL_NEURAL" && result.neuralSessionRan !== true) {
      return unavailable("FALSE_NEURAL");
    }
    return result;
  },
};
