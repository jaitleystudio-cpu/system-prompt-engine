import { useEffect, useRef, useState } from "react";

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

/** Status: IMPLEMENTATION_PRESENT / DEVICE_QUALIFICATION_PENDING — browser speech varies by device. */
export function SpeechInput({ onInsert, disabled }: { onInsert: (text: string) => void; disabled: boolean }) {
  const recognition = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [language, setLanguage] = useState("en-IN");
  const speechWindow = window as SpeechWindow;
  const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

  useEffect(() => () => {
    const active = recognition.current;
    if (active) {
      active.onresult = null;
      active.onerror = null;
      active.onend = null;
      active.abort();
    }
  }, []);

  function start() {
    if (!Constructor || !consent || recognition.current || disabled) return;
    const active = new Constructor();
    recognition.current = active;
    active.lang = language;
    active.continuous = true;
    active.interimResults = true;
    setTranscript("");
    setInterim("");
    setError("");
    active.onresult = (event) => {
      if (recognition.current !== active) return;
      const final: string[] = [], pending: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        (result.isFinal ? final : pending).push(result[0].transcript);
      }
      setTranscript(final.join(" "));
      setInterim(pending.join(" "));
    };
    active.onerror = (event) => {
      if (recognition.current !== active) return;
      setError(event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone or speech access was denied. Allow access in your browser, or type your idea."
        : event.error === "no-speech"
          ? "No speech was detected. Try again, or type your idea."
          : "Speech recognition stopped. Check your microphone and connection, or type your idea.");
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
      recognition.current = null;
      setListening(false);
      setError("Speech could not start. Try again, or type your idea.");
    }
  }

  return <details className="spe-speech">
    <summary>Speak your idea</summary>
    <p>Dictate, review the text, then add it to your idea. Your browser may send audio to its speech service. SPE does not save audio and does not claim on-device speech recognition unless a device row is qualified.</p>
    <p className="spe-muted" data-capability-status="IMPLEMENTATION_PRESENT / DEVICE_QUALIFICATION_PENDING">
      Speech support varies by device and browser. Implementation is present; device qualification remains NOT_TESTED on this box — type if dictation misbehaves.
    </p>
    {!Constructor ? <p role="status">Speech recognition is unavailable in this browser. You can still type or paste a transcript into your idea.</p> : <>
      <label className="spe-field"><span>Spoken language</span>
        <select value={language} disabled={listening} onChange={event => setLanguage(event.target.value)}>
          <option value="en-IN">English (India)</option><option value="en-US">English (US)</option>
          <option value="hi-IN">Hindi</option><option value="te-IN">Telugu</option>
          <option value="ta-IN">Tamil</option><option value="es-ES">Spanish</option>
        </select>
      </label>
      <label><input type="checkbox" checked={consent} disabled={listening} onChange={event => setConsent(event.target.checked)} /> Allow browser speech recognition for this session</label>
      <div>
        <button type="button" disabled={disabled || !consent || listening} onClick={start}>Start microphone</button>
        <button type="button" disabled={!listening} onClick={() => recognition.current?.stop()}>Stop microphone</button>
      </div>
      <p role="status">{listening ? "Listening… Stop the microphone when you finish." : "Microphone stopped."}</p>
      {interim && <p>{interim}</p>}
      {error && <p role="alert">{error}</p>}
      <label className="spe-field"><span>Review your transcript</span><textarea rows={4} value={transcript} disabled={listening} onChange={event => setTranscript(event.target.value)} /></label>
      <button type="button" disabled={disabled || listening || !transcript.trim()} onClick={() => { onInsert(transcript.trim()); setTranscript(""); }}>Add transcript to idea</button>
    </>}
  </details>;
}
