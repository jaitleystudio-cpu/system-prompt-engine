import { useEffect, useRef, useState } from "react";
import {
  mapSpeechError,
  mergeTranscript,
  SPEECH_VISITOR_HELP,
  speechUnsupportedMessage,
} from "./speechHelpers";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

function cleanupRecognition(active: Recognition | null) {
  if (!active) return;
  active.onresult = null;
  active.onerror = null;
  active.onend = null;
  try {
    active.abort();
  } catch {
    /* already stopped */
  }
}

/** Speech→Prompt — Rich Human English for visitors; matrix lives in proofs + speechQualification.ts. */
export function SpeechInput({ onInsert, disabled }: { onInsert: (text: string) => void; disabled: boolean }) {
  const recognition = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState("");
  const [consent, setConsent] = useState(false);
  const [language, setLanguage] = useState("en-IN");
  const speechWindow = window as SpeechWindow;
  const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

  useEffect(
    () => () => {
      cleanupRecognition(recognition.current);
      recognition.current = null;
    },
    [],
  );

  function stopMic() {
    const active = recognition.current;
    if (!active) {
      setListening(false);
      return;
    }
    try {
      active.stop();
    } catch {
      cleanupRecognition(active);
      recognition.current = null;
      setListening(false);
      setInterim("");
    }
  }

  function start() {
    if (!Constructor || !consent || recognition.current || disabled) return;
    const active = new Constructor();
    recognition.current = active;
    active.lang = language;
    active.continuous = true;
    active.interimResults = true;
    setError("");
    setErrorKind("");
    setInterim("");
    active.onresult = (event) => {
      if (recognition.current !== active) return;
      const finalParts: string[] = [];
      const pending: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        (result.isFinal ? finalParts : pending).push(result[0].transcript);
      }
      const spoken = finalParts.join(" ").trim();
      if (spoken) {
        setTranscript((prev) => mergeTranscript(prev, spoken));
      }
      setInterim(pending.join(" "));
    };
    active.onerror = (event) => {
      if (recognition.current !== active) return;
      const mapped = mapSpeechError(event.error);
      setErrorKind(mapped.kind);
      setError(mapped.message);
      // Never leave a false listening state after an error (graceful-fallback contract).
      try {
        active.abort();
      } catch {
        /* ignore */
      }
      recognition.current = null;
      setListening(false);
      setInterim("");
    };
    active.onend = () => {
      if (recognition.current !== active) return;
      recognition.current = null;
      setListening(false);
      setInterim("");
    };
    try {
      active.start();
      setListening(true);
    } catch {
      cleanupRecognition(active);
      recognition.current = null;
      setListening(false);
      setErrorKind("start-failed");
      setError("Speech could not start. Try again, or type your idea.");
    }
  }

  return (
    <>
      <p className="spe-muted" data-speech-visitor-help="true">
        {SPEECH_VISITOR_HELP}
      </p>
      <details
        className="spe-speech"
        data-testid="speech-panel"
        data-speech-supported={Constructor ? "true" : "false"}
      >
        <summary>Speak your idea</summary>
        <p>
          Dictate, review the text, then add it to your idea. You can also type into the transcript box
          (mixed speech + typing). Your browser may send audio to its speech service. SPE does not save
          audio.
        </p>
        <p className="spe-muted" data-speech-fallback-hint="true">
          Prefer typing? The transcript box below always works — speech is optional.
        </p>
        {!Constructor ? (
          <div data-speech-phase="unsupported" data-speech-fallback="graceful">
            <p role="status" data-testid="speech-unsupported">
              {speechUnsupportedMessage()}
            </p>
            <label className="spe-field">
              <span>Type your idea here (speech is unavailable in this browser)</span>
              <textarea
                rows={4}
                data-testid="speech-transcript"
                value={transcript}
                disabled={disabled}
                onChange={(event) => setTranscript(event.target.value)}
              />
            </label>
            <button
              type="button"
              data-testid="speech-insert"
              disabled={disabled || !transcript.trim()}
              onClick={() => {
                onInsert(transcript.trim());
                setTranscript("");
                setError("");
                setErrorKind("");
              }}
            >
              Add transcript to idea
            </button>
          </div>
        ) : (
          <>
            <label className="spe-field">
              <span>Spoken language</span>
              <select
                value={language}
                disabled={listening}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="en-IN">English (India)</option>
                <option value="en-US">English (US)</option>
                <option value="hi-IN">Hindi</option>
                <option value="te-IN">Telugu</option>
                <option value="ta-IN">Tamil</option>
                <option value="es-ES">Spanish</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={consent}
                disabled={listening}
                onChange={(event) => setConsent(event.target.checked)}
              />{" "}
              Allow browser speech recognition for this session
            </label>
            {!consent && (
              <p className="spe-muted" data-speech-phase="needs-consent">
                Tick the box above before starting the microphone. You can revoke by refreshing this page.
              </p>
            )}
            <div>
              <button
                type="button"
                data-testid="speech-start"
                disabled={disabled || !consent || listening}
                onClick={start}
              >
                Start microphone
              </button>
              <button
                type="button"
                data-testid="speech-stop"
                disabled={!listening}
                onClick={stopMic}
              >
                Stop microphone
              </button>
            </div>
            <p role="status" data-speech-listening={listening ? "true" : "false"}>
              {listening ? "Listening… Stop the microphone when you finish." : "Microphone stopped."}
            </p>
            {interim && <p data-speech-interim="true">{interim}</p>}
            {error && (
              <p role="alert" data-speech-error-kind={errorKind || "unknown"}>
                {error}
              </p>
            )}
            <label className="spe-field">
              <span>Review your transcript (edit freely — speech and typing mix)</span>
              <textarea
                rows={4}
                data-testid="speech-transcript"
                value={transcript}
                disabled={listening}
                onChange={(event) => setTranscript(event.target.value)}
              />
            </label>
            <button
              type="button"
              data-testid="speech-insert"
              disabled={disabled || listening || !transcript.trim()}
              onClick={() => {
                onInsert(transcript.trim());
                setTranscript("");
                setError("");
                setErrorKind("");
              }}
            >
              Add transcript to idea
            </button>
          </>
        )}
      </details>
    </>
  );
}
