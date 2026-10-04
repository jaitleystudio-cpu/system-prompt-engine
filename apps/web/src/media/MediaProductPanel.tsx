import { useRef, useState } from "react";
import "./MediaProductPanel.css";
import {
  initialMediaPanelState,
  reduceMediaPanel,
  type MediaMode,
  type MediaPanelState,
  type MediaResult,
} from "./mediaProductModel";

export type MediaRuntime = {
  transcribe: (
    file: File,
    hooks: {
      onProgress: (update: { percent: number | null; note: string }) => void;
      signal: AbortSignal;
    },
  ) => Promise<MediaResult>;
};

const MODE_COPY: Record<MediaMode, string> = {
  LOCAL_NEURAL: "Local neural session",
  LOCAL_FALLBACK: "Local fallback (no neural session)",
  BROWSER_SERVICE: "Browser speech service",
  UNAVAILABLE: "Unavailable",
};

/** Local file transcription panel. The shell mounts it via mount-contract.ts. */
export function MediaProductPanel({ runtime = null }: { runtime?: MediaRuntime | null }) {
  const [state, setState] = useState<MediaPanelState>(initialMediaPanelState);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<File | null>(null);

  function apply(next: MediaPanelState) {
    setState(next);
  }

  async function run(current: MediaPanelState, file: File | null) {
    const started = reduceMediaPanel(current, { type: "start" });
    apply(started);
    if (!file || started.phase === "error") return;
    if (!runtime) {
      apply(
        reduceMediaPanel(started, {
          type: "fail",
          mode: "UNAVAILABLE",
          errorCode: "NOT_MOUNTED",
          message:
            "No transcription runtime is connected to this panel. No file was submitted by this attempt.",
        }),
      );
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await runtime.transcribe(file, {
        signal: controller.signal,
        onProgress: (update) => {
          setState((prev) => reduceMediaPanel(prev, { type: "progress", percent: update.percent, note: update.note }));
        },
      });
      if (controller.signal.aborted) {
        setState((prev) => reduceMediaPanel(prev, { type: "cancel" }));
        return;
      }
      setState((prev) => reduceMediaPanel(prev, { type: "result", result }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transcription failed.";
      setState((prev) =>
        reduceMediaPanel(prev, {
          type: "fail",
          mode: "LOCAL_FALLBACK",
          errorCode: "RUNTIME_ERROR",
          message,
        }),
      );
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <section className="spe-media-product" aria-labelledby="spe-media-product-title" data-egress="0" data-status={state.status || "idle"} data-phase={state.phase} data-error-code={state.errorCode ?? ""} data-testid="media-panel">
      <h2 id="spe-media-product-title">Local media</h2>
      <p>Choose an audio or video file. Transcribe sends its bytes to the configured app host; on-device execution requires a local host.</p>
      <p data-testid="media-mode">
        Mode: <strong>{MODE_COPY[state.mode]}</strong> <span>({state.mode})</span>
      </p>
      <input
        type="file"
        accept="audio/*,video/*,.wav,.mp3,.flac,.ogg,.m4a,.mp4,.mov,.mkv,.webm,.m4v"
        data-testid="media-file"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          fileRef.current = file;
          apply(reduceMediaPanel(initialMediaPanelState(), { type: "select", fileName: file?.name ?? "" }));
        }}
      />
      <div className="spe-media-product-actions">
        <button type="button" data-testid="media-start" onClick={() => void run(state, fileRef.current)} disabled={state.phase === "working"}>
          Transcribe
        </button>
        <button
          type="button"
          data-testid="media-cancel"
          onClick={() => {
            abortRef.current?.abort();
            apply(reduceMediaPanel(state, { type: "cancel" }));
          }}
          disabled={state.phase !== "working"}
        >
          Cancel
        </button>
        <button
          type="button"
          data-testid="media-retry"
          onClick={() => {
            const reset = { ...state, phase: "selected" as const, error: "", errorCode: null, text: "", status: "" };
            void run(reset, fileRef.current);
          }}
          disabled={!state.fileName || state.phase === "working"}
        >
          Retry
        </button>
      </div>
      {state.phase === "working" ? (
        <p data-testid="media-progress" role="status">
          {state.progressNote || "Working"}
          {state.progressPercent != null ? ` ${state.progressPercent}%` : ""}
        </p>
      ) : null}
      {state.error ? (
        <p data-testid="media-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.text ? (
        <p data-testid="media-transcript" lang="te">
          {state.text}
        </p>
      ) : null}
      <p data-testid="media-timestamps">
        {state.timestampsProven ? "Segment timestamps came from the model." : "Segment timestamps are not proven."}
      </p>
      <p data-testid="media-egress">Network sends for this file: {state.egressAttempts} (unverified host counter; excludes browser-to-host upload)</p>
    </section>
  );
}
