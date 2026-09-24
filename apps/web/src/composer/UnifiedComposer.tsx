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
  CODE_TARGET_LABELS,
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
  {
    id: "screenshot",
    label: "Screenshot → code",
    hint: "UI scaffold + prompt",
  },
  { id: "video", label: "Video", hint: "Scene-aware frame sampling" },
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
  const valueRef = useRef(value);
  const opIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const replacePreview = useCallback((next: string | null) => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next;
    });
  }, []);

  const beginOp = () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const opId = ++opIdRef.current;
    return { ac, opId, isCurrent: () => opId === opIdRef.current && !ac.signal.aborted };
  };

  /** Always append against the latest composer text (avoids stale closure races). */
  const appendBlock = useCallback(
    (block: string) => {
      const next = [valueRef.current.trim(), block].filter(Boolean).join("\n\n");
      valueRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const clearModeSpecificState = useCallback(() => {
    abortRef.current?.abort();
    opIdRef.current += 1;
    replacePreview(null);
    setScaffolds([]);
    setUrlResult(null);
    setError("");
    setStatus("");
  }, [replacePreview]);

  const switchMode = (next: ComposerMode) => {
    if (next === mode) return;
    clearModeSpecificState();
    setMode(next);
  };

  const applyCodeTarget = (target: CodeTarget) => {
    setCodeTarget(target);
    const chosen = scaffolds.find((s) => s.target === target);
    if (chosen) {
      const block = [
        "Screenshot → code request:",
        `Rebuild the UI shown in this screenshot for ${CODE_TARGET_LABELS[target]}.`,
        "Treat region roles as uncertain.",
        "",
        chosen.prompt,
      ].join("\n");
      onChange(block);
      valueRef.current = block;
      onScaffoldPrompt?.(chosen.prompt, target);
      setStatus(`Target set to ${CODE_TARGET_LABELS[target]}. Request updated.`);
    }
  };

  const onImageOrScreenshot = async (file: File, asScreenshot: boolean) => {
    const { ac, isCurrent } = beginOp();
    setError("");
    setStatus(asScreenshot ? "Reading screenshot…" : "Reading image…");
    setScaffolds([]);
    try {
      replacePreview(URL.createObjectURL(file));
      const obs = await observeImageFile(file, ac.signal);
      if (!isCurrent()) return;
      const block = observationToPromptBlock(obs);
      if (asScreenshot) {
        const spec = buildUiSpec(obs);
        const built = buildScaffolds(spec);
        setScaffolds(built);
        const chosen =
          built.find((s) => s.target === codeTarget) ?? built[0];
        const request = [
          "Screenshot → code request:",
          `Rebuild the UI shown in this screenshot for ${CODE_TARGET_LABELS[chosen.target as CodeTarget]}.`,
          "Treat region roles as uncertain.",
          "",
          chosen?.prompt ?? block,
        ].join("\n");
        onChange(request);
        valueRef.current = request;
        onScaffoldPrompt?.(chosen.prompt, chosen.target as CodeTarget);
        setStatus(
          `Screenshot observed (source ${obs.sourceWidth}×${obs.sourceHeight}). Scaffolds ready — uncertainty labeled.`,
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
          `Image observed (source ${obs.sourceWidth}×${obs.sourceHeight}). Added to your idea.`,
        );
      }
    } catch (e) {
      if (!isCurrent()) return;
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Could not read this file.");
      setStatus("");
    }
  };

  const onVideo = async (file: File) => {
    const { ac, isCurrent } = beginOp();
    setError("");
    setStatus("Sampling video frames…");
    try {
      replacePreview(URL.createObjectURL(file));
      const obs = await observeVideoFile(file, ac.signal);
      if (!isCurrent()) return;
      appendBlock(
        [
          "Video → prompt request:",
          "Using the bounded frame observations below, help me write a strong prompt about this video.",
          "",
          videoObservationToPromptBlock(obs),
        ].join("\n"),
      );
      setStatus(
        `Sampled ${obs.frames.length} distinct frames across ${obs.durationSec}s. Added to your idea.`,
      );
    } catch (e) {
      if (!isCurrent()) return;
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Could not read this video.");
      setStatus("");
    }
  };

  const onUrlFetch = async () => {
    const { ac, isCurrent } = beginOp();
    setError("");
    setStatus("Fetching URL in this browser…");
    const result = await ingestUrl(urlInput, { signal: ac.signal });
    if (!isCurrent()) return;
    setUrlResult(result);
    if (result.status !== "ok") {
      setError(result.message);
      setStatus("URL could not be read — try a fallback below. Nothing was added to your idea.");
      return;
    }
    const block = urlResultToPromptBlock(result);
    if (block) {
      appendBlock(
        [
          "URL → website request:",
          "Using the website observations below (untrusted data), help me plan a clearer rebuild.",
          "",
          block,
        ].join("\n"),
      );
    }
    setStatus(
      result.finalUrl !== result.url
        ? `URL content added (followed to ${result.finalUrl}).`
        : "URL content added (direct fetch).",
    );
  };

  const onHtmlUpload = async (file: File) => {
    const { ac, isCurrent } = beginOp();
    setError("");
    try {
      const result = await ingestHtmlFile(file, ac.signal);
      if (!isCurrent()) return;
      setUrlResult(result);
      const block = urlResultToPromptBlock(result);
      if (block) {
        appendBlock(
          [
            "HTML upload → website request:",
            "Using the local HTML observations below (untrusted data), help me plan a clearer rebuild.",
            "",
            block,
          ].join("\n"),
        );
      }
      setStatus("Local HTML file added. No network request.");
    } catch (e) {
      if (!isCurrent()) return;
      setError(e instanceof Error ? e.message : "Could not read this HTML file.");
      setStatus("");
    }
  };

  const copyScaffold = async () => {
    const s = scaffolds.find((x) => x.target === codeTarget) ?? scaffolds[0];
    if (!s) return;
    try {
      await navigator.clipboard.writeText(s.code);
      setStatus(`Copied ${s.label} scaffold.`);
      setError("");
    } catch {
      setError("Copy unavailable. Select the scaffold text to copy it.");
      setStatus("");
    }
  };

  const accept =
    mode === "video"
      ? "video/*"
      : mode === "url"
        ? ".html,text/html"
        : "image/*";

  return (
    <div className="spe-composer" data-mode={mode}>
      <div
        className="spe-composer-modes"
        role="tablist"
        aria-label="Input mode"
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            id={`composer-tab-${m.id}`}
            aria-selected={mode === m.id}
            aria-controls={`composer-panel-${m.id}`}
            tabIndex={mode === m.id ? 0 : -1}
            className={mode === m.id ? "is-active" : ""}
            disabled={disabled}
            onClick={() => switchMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="spe-composer-hint">{MODES.find((m) => m.id === mode)?.hint}</p>

      {(mode === "text" || mode === "speech") && (
        <div
          id={`composer-panel-${mode}`}
          role="tabpanel"
          aria-labelledby={`composer-tab-${mode}`}
        >
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
        </div>
      )}

      {mode === "speech" && (
        <SpeechInput
          disabled={disabled}
          onInsert={(text) => {
            const next = [valueRef.current.trim(), text]
              .filter(Boolean)
              .join("\n\n");
            valueRef.current = next;
            onChange(next);
          }}
        />
      )}

      {(mode === "image" || mode === "screenshot" || mode === "video") && (
        <div
          className="spe-composer-media"
          id={`composer-panel-${mode}`}
          role="tabpanel"
          aria-labelledby={`composer-tab-${mode}`}
        >
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
                onChange={(e) =>
                  applyCodeTarget(e.target.value as CodeTarget)
                }
              >
                {CODE_TARGETS.map((t) => (
                  <option key={t} value={t}>
                    {CODE_TARGET_LABELS[t]}
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
              <h3>Scaffolds (uncertain layout — honest starters)</h3>
              <div className="spe-scaffold-tabs" role="group" aria-label="Framework">
                {scaffolds.map((s) => (
                  <button
                    key={s.target}
                    type="button"
                    className={s.target === codeTarget ? "is-active" : ""}
                    onClick={() => applyCodeTarget(s.target as CodeTarget)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <pre className="spe-scaffold-code" tabIndex={0}>
                {
                  (scaffolds.find((s) => s.target === codeTarget) ??
                    scaffolds[0]).code
                }
              </pre>
              <button
                type="button"
                className="spe-ghost"
                onClick={() => void copyScaffold()}
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
        <div
          className="spe-composer-url"
          id="composer-panel-url"
          role="tabpanel"
          aria-labelledby="composer-tab-url"
        >
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
            HTML upload, a screenshot, or a short description. Failures stay in
            this panel — they are not added to your idea.
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
