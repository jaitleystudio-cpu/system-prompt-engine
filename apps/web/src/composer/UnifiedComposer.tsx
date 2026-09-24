import { useCallback, useEffect, useRef, useState } from "react";
import { SpeechInput } from "../input/SpeechInput";
import {
  observeImageFile,
  observationToPromptBlock,
} from "../media/imageObserve";
import {
  observeVideoFile,
  videoObservationToPromptBlock,
} from "../media/videoSample";
import {
  CODE_TARGETS,
  buildScaffolds,
  buildUiSpec,
  type CodeTarget,
} from "../media/screenshotToCode";
import {
  ingestHtmlFile,
  ingestUrl,
  urlResultToPromptBlock,
} from "../media/urlIngest";
import type { CodeScaffold, UrlIngestResult } from "../media/types";

export type ComposerMode =
  | "text"
  | "speech"
  | "image"
  | "screenshot"
  | "video"
  | "url";

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  onScaffoldPrompt?: (prompt: string, target: CodeTarget) => void;
};

const MODES: { id: ComposerMode; label: string; hint: string }[] = [
  { id: "text", label: "Text", hint: "Type or paste your idea" },
  { id: "speech", label: "Speech", hint: "Dictate, then review" },
  { id: "image", label: "Image", hint: "Local observations → prompt" },
  { id: "screenshot", label: "Screenshot → code", hint: "UI scaffold + prompt" },
  { id: "video", label: "Video", hint: "Bounded frame sampling" },
  { id: "url", label: "URL", hint: "CORS-honest fetch + fallbacks" },
];

export function UnifiedComposer({
  value,
  onChange,
  disabled = false,
  onScaffoldPrompt,
}: Props) {
  const [mode, setMode] = useState<ComposerMode>("text");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [urlResult, setUrlResult] = useState<UrlIngestResult | null>(null);
  const [scaffolds, setScaffolds] = useState<CodeScaffold[]>([]);
  const [codeTarget, setCodeTarget] = useState<CodeTarget>("react");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const replacePreview = useCallback((next: string | null) => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next;
    });
  }, []);

  const appendBlock = (block: string) => {
    onChange([value.trim(), block].filter(Boolean).join("\n\n"));
  };

  const onImageOrScreenshot = async (file: File, asScreenshot: boolean) => {
    setError("");
    setStatus(asScreenshot ? "Reading screenshot…" : "Reading image…");
    setScaffolds([]);
    try {
      replacePreview(URL.createObjectURL(file));
      const obs = await observeImageFile(file);
      const block = observationToPromptBlock(obs);
      if (asScreenshot) {
        const spec = buildUiSpec(obs);
        const built = buildScaffolds(spec);
        setScaffolds(built);
        const chosen = built.find((s) => s.target === codeTarget) ?? built[0];
        appendBlock(
          [
            "Screenshot → code request:",
            "Rebuild the UI shown in this screenshot. Treat region roles as uncertain.",
            "",
            chosen?.prompt ?? block,
          ].join("\n"),
        );
        setStatus(
          `Screenshot observed (${obs.width}×${obs.height}). Scaffolds ready — uncertainty labeled.`,
        );
      } else {
        appendBlock(
          [
            "Image → prompt request:",
            "Using only the grounded observations below, help me write a strong prompt about this image.",
            "",
            block,
          ].join("\n"),
        );
        setStatus(
          `Image observed (${obs.width}×${obs.height}). Added to your idea.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
      setStatus("");
    }
  };

  const onVideo = async (file: File) => {
    setError("");
    setStatus("Sampling video frames…");
    try {
      replacePreview(URL.createObjectURL(file));
      const obs = await observeVideoFile(file);
      appendBlock(
        [
          "Video → prompt request:",
          "Using the bounded frame observations below, help me write a strong prompt about this video.",
          "",
          videoObservationToPromptBlock(obs),
        ].join("\n"),
      );
      setStatus(
        `Sampled ${obs.frames.length} frames across ${obs.durationSec}s. Added to your idea.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this video.");
      setStatus("");
    }
  };

  const onUrlFetch = async () => {
    setError("");
    setStatus("Fetching URL in this browser…");
    const result = await ingestUrl(urlInput);
    setUrlResult(result);
    appendBlock(urlResultToPromptBlock(result));
    setStatus(
      result.status === "ok"
        ? "URL content added (direct fetch)."
        : "URL could not be read — fallbacks listed in your idea.",
    );
  };

  const onHtmlUpload = async (file: File) => {
    setError("");
    const result = await ingestHtmlFile(file);
    setUrlResult(result);
    appendBlock(urlResultToPromptBlock(result));
    setStatus("Local HTML file added. No network request.");
  };

  const accept =
    mode === "video"
      ? "video/*"
      : mode === "url"
        ? ".html,text/html"
        : "image/*";

  return (
    <div className="spe-composer" data-mode={mode}>
      <div className="spe-composer-modes" role="tablist" aria-label="Input mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={mode === m.id ? "is-active" : ""}
            disabled={disabled}
            onClick={() => {
              setMode(m.id);
              setError("");
              setStatus("");
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="spe-composer-hint">{MODES.find((m) => m.id === mode)?.hint}</p>

      {(mode === "text" || mode === "speech") && (
        <label className="spe-field grow">
          <span>Your idea</span>
          <textarea
            rows={6}
            value={value}
            disabled={disabled}
            placeholder="Describe the task. Include what matters, what to avoid, and what good looks like…"
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      )}

      {mode === "speech" && (
        <SpeechInput
          disabled={disabled}
          onInsert={(text) =>
            onChange([value.trim(), text].filter(Boolean).join("\n\n"))
          }
        />
      )}

      {(mode === "image" || mode === "screenshot" || mode === "video") && (
        <div className="spe-composer-media">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (mode === "video") void onVideo(file);
              else void onImageOrScreenshot(file, mode === "screenshot");
            }}
          />
          <button
            type="button"
            className="spe-ghost"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            {mode === "video"
              ? "Choose video"
              : mode === "screenshot"
                ? "Choose screenshot"
                : "Choose image"}
          </button>
          {mode === "screenshot" && (
            <label className="spe-field inline">
              <span>Code target</span>
              <select
                value={codeTarget}
                disabled={disabled}
                onChange={(e) => setCodeTarget(e.target.value as CodeTarget)}
              >
                {CODE_TARGETS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          )}
          {previewUrl && (
            <div className="spe-composer-preview">
              {mode === "video" ? (
                <video src={previewUrl} controls preload="metadata" />
              ) : (
                <img src={previewUrl} alt="Selected media preview" />
              )}
            </div>
          )}
          {scaffolds.length > 0 && (
            <div className="spe-scaffolds">
              <h3>Scaffolds (uncertain layout)</h3>
              <div className="spe-scaffold-tabs">
                {scaffolds.map((s) => (
                  <button
                    key={s.target}
                    type="button"
                    className={s.target === codeTarget ? "is-active" : ""}
                    onClick={() => {
                      setCodeTarget(s.target as CodeTarget);
                      onScaffoldPrompt?.(s.prompt, s.target as CodeTarget);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <pre className="spe-scaffold-code" tabIndex={0}>
                {
                  (scaffolds.find((s) => s.target === codeTarget) ?? scaffolds[0])
                    .code
                }
              </pre>
              <button
                type="button"
                className="spe-ghost"
                onClick={() => {
                  const s =
                    scaffolds.find((x) => x.target === codeTarget) ??
                    scaffolds[0];
                  void navigator.clipboard.writeText(s.code);
                  setStatus(`Copied ${s.label} scaffold.`);
                }}
              >
                Copy scaffold
              </button>
            </div>
          )}
          <label className="spe-field grow">
            <span>Your idea (with observations)</span>
            <textarea
              rows={8}
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
            />
          </label>
        </div>
      )}

      {mode === "url" && (
        <div className="spe-composer-url">
          <label className="spe-field">
            <span>Website URL</span>
            <input
              type="url"
              inputMode="url"
              placeholder="https://example.com"
              value={urlInput}
              disabled={disabled}
              onChange={(e) => setUrlInput(e.target.value)}
            />
          </label>
          <div className="spe-composer-url-actions">
            <button
              type="button"
              className="spe-build"
              disabled={disabled || !urlInput.trim()}
              onClick={() => void onUrlFetch()}
            >
              Fetch in browser
            </button>
            <label className="spe-ghost file-btn">
              Upload HTML
              <input
                type="file"
                accept=".html,text/html"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void onHtmlUpload(f);
                }}
              />
            </label>
          </div>
          <p className="spe-composer-url-note">
            SPE never uses a paid CORS proxy. If the site blocks the browser, use
            HTML upload, a screenshot, or a short description.
          </p>
          {urlResult && urlResult.status !== "ok" && (
            <ul className="spe-fallbacks">
              {urlResult.fallbacks.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <label className="spe-field grow">
            <span>Your idea (with URL notes)</span>
            <textarea
              rows={6}
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
            />
          </label>
        </div>
      )}

      {status && (
        <p className="spe-composer-status" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="spe-composer-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
