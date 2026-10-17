/** Pure media-product state. No network. No second transcription engine. */

export const MEDIA_MODES = [
  "LOCAL_NEURAL",
  "LOCAL_FALLBACK",
  "BROWSER_SERVICE",
  "UNAVAILABLE",
] as const;

export type MediaMode = (typeof MEDIA_MODES)[number];

export type MediaPanelPhase =
  | "idle"
  | "selected"
  | "working"
  | "review"
  | "error"
  | "cancelled";

export type MediaFileKind = "audio" | "video" | "unknown";

const AUDIO_EXT = new Set(["wav", "mp3", "flac", "ogg", "oga", "m4a", "aac"]);
const VIDEO_EXT = new Set(["mp4", "mov", "mkv", "webm", "m4v"]);

export function fileKindFromName(name: string): MediaFileKind {
  const ext = name.trim().toLowerCase().split(".").pop() ?? "";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (VIDEO_EXT.has(ext)) return "video";
  return "unknown";
}

/**
 * LOCAL_NEURAL only when a real neural session ran on the pinned local engine.
 * Browser speech is never neural. Missing assets stay unavailable.
 */
export function resolveMediaMode(input: {
  provider: string;
  assetsReady: boolean;
  neuralSessionRan: boolean;
}): MediaMode {
  const name = input.provider.trim().toLowerCase().replaceAll("_", "-");
  if (
    name.includes("web-speech") ||
    name.includes("webspeech") ||
    name.includes("browser")
  ) {
    return "BROWSER_SERVICE";
  }
  if (
    name.includes("cloud") ||
    name.includes("remote") ||
    name.includes("openai") ||
    name.includes("azure") ||
    name.includes("google") ||
    name.includes("aws") ||
    name.includes("http://") ||
    name.includes("https://")
  ) {
    return "UNAVAILABLE";
  }
  if (!input.assetsReady) return "UNAVAILABLE";
  if (
    input.neuralSessionRan &&
    (name === "whisper-cli" || name === "local-cpu" || name === "pinned-whisper-cpp")
  ) {
    return "LOCAL_NEURAL";
  }
  return "LOCAL_FALLBACK";
}

export type MediaResult = {
  status: "SPEECH" | "NO_SPEECH" | "CANCELLED" | "ERROR";
  text: string;
  mode: MediaMode;
  errorCode: string | null;
  neuralSessionRan: boolean;
  timestampsProven: boolean;
  segments: Array<{ startMs: number; endMs: number; text: string }>;
  progressPercent: number | null;
  egressAttempts: number;
};

export type MediaPanelState = {
  phase: MediaPanelPhase;
  fileName: string;
  fileKind: MediaFileKind;
  mode: MediaMode;
  status: string;
  text: string;
  error: string;
  errorCode: string | null;
  progressPercent: number | null;
  progressNote: string;
  attempts: number;
  egressAttempts: number;
  timestampsProven: boolean;
  neuralSessionRan: boolean;
  fileLeavesDevice: false;
};

export function initialMediaPanelState(): MediaPanelState {
  return {
    phase: "idle",
    fileName: "",
    fileKind: "unknown",
    mode: "UNAVAILABLE",
    status: "",
    text: "",
    error: "",
    errorCode: null,
    progressPercent: null,
    progressNote: "",
    attempts: 0,
    egressAttempts: 0,
    timestampsProven: false,
    neuralSessionRan: false,
    fileLeavesDevice: false,
  };
}

export type MediaPanelEvent =
  | { type: "select"; fileName: string }
  | { type: "start" }
  | { type: "progress"; percent: number | null; note: string }
  | { type: "result"; result: MediaResult }
  | { type: "fail"; errorCode: string; message: string; mode: MediaMode }
  | { type: "cancel" }
  | { type: "retry" };

export function reduceMediaPanel(state: MediaPanelState, event: MediaPanelEvent): MediaPanelState {
  switch (event.type) {
    case "select": {
      const kind = fileKindFromName(event.fileName);
      return {
        ...initialMediaPanelState(),
        phase: kind === "unknown" ? "error" : "selected",
        fileName: event.fileName,
        fileKind: kind,
        error: kind === "unknown" ? "Choose an audio or video file on this device." : "",
        errorCode: kind === "unknown" ? "UNSUPPORTED_TYPE" : null,
        mode: "UNAVAILABLE",
      };
    }
    case "start":
      if (!state.fileName || state.fileKind === "unknown") {
        return {
          ...state,
          phase: "error",
          error: "Select a local audio or video file first.",
          errorCode: "NO_FILE",
          mode: "UNAVAILABLE",
        };
      }
      return {
        ...state,
        phase: "working",
        status: "WORKING",
        error: "",
        errorCode: null,
        text: "",
        progressPercent: null,
        progressNote: "Reading the file on this device.",
        attempts: state.attempts + 1,
        egressAttempts: 0,
        neuralSessionRan: false,
        timestampsProven: false,
        mode: "UNAVAILABLE",
      };
    case "progress": {
      const percent =
        event.percent != null && event.percent >= 0 && event.percent <= 100
          ? event.percent
          : null;
      return {
        ...state,
        phase: "working",
        progressPercent: percent,
        progressNote: event.note,
      };
    }
    case "result": {
      const result = event.result;
      if (result.mode === "LOCAL_NEURAL" && !result.neuralSessionRan) {
        return {
          ...state,
          phase: "error",
          mode: "UNAVAILABLE",
          error: "Refusing LOCAL_NEURAL without a real neural session.",
          errorCode: "FALSE_NEURAL",
          neuralSessionRan: false,
          text: "",
          egressAttempts: result.egressAttempts,
        };
      }
      const phase: MediaPanelPhase =
        result.status === "CANCELLED"
          ? "cancelled"
          : result.status === "ERROR"
            ? "error"
            : "review";
      return {
        ...state,
        phase,
        mode: result.mode,
        status: result.status,
        text: result.text,
        error: result.status === "ERROR" ? result.errorCode ?? "ERROR" : "",
        errorCode: result.errorCode,
        progressPercent: result.progressPercent,
        timestampsProven: result.timestampsProven && result.segments.length > 0,
        neuralSessionRan: result.neuralSessionRan,
        egressAttempts: result.egressAttempts,
      };
    }
    case "fail":
      return {
        ...state,
        phase: "error",
        mode: event.mode,
        status: "ERROR",
        error: event.message,
        errorCode: event.errorCode,
        text: "",
        neuralSessionRan: false,
      };
    case "cancel":
      return {
        ...state,
        phase: "cancelled",
        status: "CANCELLED",
        error: "",
        errorCode: "CANCELLED",
        text: "",
        progressNote: "Cancelled.",
      };
    case "retry":
      if (!state.fileName) return state;
      return reduceMediaPanel(
        { ...state, phase: "selected", error: "", errorCode: null, text: "", status: "" },
        { type: "start" },
      );
    default:
      return state;
  }
}

/** Accept only in-range model progress. Whisper's 1421% callback is not progress. */
export function acceptModelProgress(rawValues: number[]): number | null {
  const usable = rawValues.filter((value) => Number.isInteger(value) && value >= 0 && value <= 100);
  return usable.length ? usable[usable.length - 1] : null;
}
