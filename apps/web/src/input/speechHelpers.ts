/** Pure helpers for Speech→Prompt UX — unit-tested without a mic. */

export type SpeechErrorKind =
  | "permission-denied"
  | "no-speech"
  | "audio-capture"
  | "network"
  | "aborted"
  | "unsupported"
  | "start-failed"
  | "unknown";

export function mapSpeechError(code: string): { kind: SpeechErrorKind; message: string } {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return {
        kind: "permission-denied",
        message:
          "Microphone or speech access was denied. Allow access in your browser settings, or type your idea.",
      };
    case "no-speech":
      return {
        kind: "no-speech",
        message: "No speech was detected. Try again, or type your idea.",
      };
    case "audio-capture":
      return {
        kind: "audio-capture",
        message:
          "No usable microphone was found. Plug in a mic, check OS privacy settings, or type your idea.",
      };
    case "network":
      return {
        kind: "network",
        message:
          "Speech recognition needs a network connection in this browser. Check connectivity, or type your idea.",
      };
    case "aborted":
      return {
        kind: "aborted",
        message: "Listening stopped.",
      };
    default:
      return {
        kind: "unknown",
        message:
          "Speech recognition stopped. Check your microphone and connection, or type your idea.",
      };
  }
}

/** Merge final transcript with optional typed addition (mixed speech + typing). */
export function mergeTranscript(spoken: string, typedExtra: string): string {
  const a = spoken.replace(/\s+/g, " ").trim();
  const b = typedExtra.replace(/\s+/g, " ").trim();
  if (!a) return b;
  if (!b) return a;
  if (b.startsWith(a)) return b;
  return `${a} ${b}`.replace(/\s+/g, " ").trim();
}

export type SpeechUiPhase = "idle" | "needs-consent" | "listening" | "review" | "error";

export function nextSpeechPhase(input: {
  hasApi: boolean;
  consent: boolean;
  listening: boolean;
  transcript: string;
  error: string;
}): SpeechUiPhase {
  if (!input.hasApi) return "error";
  if (input.listening) return "listening";
  if (input.error) return "error";
  if (!input.consent) return "needs-consent";
  if (input.transcript.trim()) return "review";
  return "idle";
}

/** Visitor-facing help — Rich Human English only (no engineering tokens). */
export const SPEECH_VISITOR_HELP =
  "Dictation works in some browsers. If listening is unavailable or permission is denied, type your idea — typing always works." as const;

export function speechUnsupportedMessage(): string {
  return "Speech recognition is not available in this browser. Type your idea in the box below — typing always works.";
}

/** Contract helper: after any error or unsupported path, listening must be false. */
export function listeningAfterSpeechFailure(listening: boolean, hadErrorOrUnsupported: boolean): boolean {
  if (hadErrorOrUnsupported) return false;
  return listening;
}
