import { useCallback, useEffect, useRef, useState } from "react";
import { SpeechInput } from "../input/SpeechInput";
import {
  observeImageFileSemantic,
  semanticToPromptBlock,
} from "../media/semanticPipeline";
import {
  observeVideoFileSemantic,
  videoObservationToPromptBlock,
} from "../media/videoSample";
import {
  CODE_TARGETS,
  CODE_TARGET_LABELS,
  screenshotIRToCodePackage,
  type CodeTarget,
} from "../media/screenshotToCode";
import { observeScreenshotIR } from "../media/uiObservation";
import { MAX_ANALYSIS_SIDE, assertImageFileBounds, assertMegapixelCap } from "../media/limits";
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
  /** Code nav opens Screenshot→code; Create keeps last/text. */
  initialMode?: ComposerMode;
};

const MODES: { id: ComposerMode; label: string; hint: string }[] = [
  { id: "text", label: "Text", hint: "Type or paste your idea" },
  { id: "speech", label: "Speech", hint: "Dictate, then review" },
  { id: "image", label: "Image", hint: "Preview the picture, then review separate notes" },
  {
    id: "screenshot",
    label: "Screenshot → code",
    hint: "Source, layout, target, scaffold, compare",
  },
  { id: "video", label: "Video", hint: "Preview, timeline, and scenes — no invented audio" },
  { id: "url", label: "URL", hint: "Read a page here, or upload if blocked" },
];

export function UnifiedComposer({
  value,
  onChange,
  disabled = false,
  onScaffoldPrompt,
  initialMode = "text",
}: Props) {
  const [mode, setMode] = useState<ComposerMode>(initialMode);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [urlResult, setUrlResult] = useState<UrlIngestResult | null>(null);
  const [scaffolds, setScaffolds] = useState<CodeScaffold[]>([]);
  const [codeTarget, setCodeTarget] = useState<CodeTarget>("react");
  const [compareTarget, setCompareTarget] = useState<CodeTarget | null>(null);
  const [mediaNotes, setMediaNotes] = useState<string>("");
  const [structureLines, setStructureLines] = useState<string[]>([]);
  const [videoScenes, setVideoScenes] = useState<{
    durationSec: number;
    times: number[];
    summary: string;
  } | null>(null);
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
    setMediaNotes("");
    setStructureLines([]);
    setVideoScenes(null);
    setCompareTarget(null);
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
    setStatus(asScreenshot ? "Reading screenshot (UI IR)…" : "Reading image (semantic)…");
    setScaffolds([]);
    try {
      replacePreview(URL.createObjectURL(file));
      if (asScreenshot) {
        assertImageFileBounds(file);
        const url = URL.createObjectURL(file);
        try {
          const img = new Image();
          img.decoding = "async";
          await new Promise<void>((resolve, reject) => {
            const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
            if (ac.signal.aborted) return onAbort();
            ac.signal.addEventListener("abort", onAbort, { once: true });
            img.onload = () => {
              ac.signal.removeEventListener("abort", onAbort);
              resolve();
            };
            img.onerror = () => {
              ac.signal.removeEventListener("abort", onAbort);
              reject(new Error("Could not decode this screenshot."));
            };
            img.src = url;
          });
          assertMegapixelCap(img.naturalWidth, img.naturalHeight);
          const scale = Math.min(
            1,
            MAX_ANALYSIS_SIDE / Math.max(img.naturalWidth, img.naturalHeight),
          );
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) throw new Error("Canvas is unavailable in this browser.");
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h);
          const ir = await observeScreenshotIR(
            data,
            {
              fileName: file.name,
              fileBytes: file.size,
              mimeType: file.type || null,
              sourceWidth: img.naturalWidth,
              sourceHeight: img.naturalHeight,
            },
            {
              signal: ac.signal,
              onProgress: (p, label) => {
                if (isCurrent()) setStatus(`${label} (${Math.round(p * 100)}%)`);
              },
            },
          );
          if (!isCurrent()) return;
          const { scaffolds: built } = screenshotIRToCodePackage(ir);
          setScaffolds(built);
          setCompareTarget(
            (built.find((s) => s.target !== codeTarget) ?? built[0])
              ?.target as CodeTarget,
          );
          const regionLines = ir.regions.slice(0, 8).map(
            (r) =>
              `${r.roleGuess} · ${r.confidence}${r.evidence ? ` — ${r.evidence.slice(0, 72)}` : ""}`,
          );
          setStructureLines([
            `Source ${ir.viewport.sourceWidth}×${ir.viewport.sourceHeight}`,
            `Layout guess ${ir.columns} columns × ${ir.rows} rows`,
            ...regionLines,
          ]);
          setMediaNotes(
            [
              "Layout notes from this screenshot (uncertain — verify against the image):",
              ...regionLines,
            ].join("\n"),
          );
          const chosen =
            built.find((s) => s.target === codeTarget) ?? built[0];
          const request = [
            "Screenshot → code request:",
            `Rebuild the UI shown in this screenshot for ${CODE_TARGET_LABELS[chosen.target as CodeTarget]}.`,
            "Observed layout regions include evidence and confidence — verify them against the image.",
            "",
            chosen?.prompt ?? "",
          ].join("\n");
          onChange(request);
          valueRef.current = request;
          onScaffoldPrompt?.(chosen.prompt, chosen.target as CodeTarget);
          setStatus(
            `Screenshot ready — source, layout, and ${built.length} scaffolds to compare.`,
          );
        } finally {
          URL.revokeObjectURL(url);
        }
      } else {
        const sem = await observeImageFileSemantic(file, {
          tier: "STANDARD",
          signal: ac.signal,
          onProgress: (p, label) => {
            if (isCurrent()) setStatus(`${label} (${Math.round(p * 100)}%)`);
          },
        });
        if (!isCurrent()) return;
        const block = semanticToPromptBlock(sem);
        setMediaNotes(sem.humanSummary || "Picture notes are ready below.");
        setStructureLines([]);
        setVideoScenes(null);
        appendBlock(
          [
            "Image → prompt request:",
            "Using only the grounded observations / model judgments below (not verified facts), help me write a strong prompt about this image.",
            "",
            block,
          ].join("\n"),
        );
        setStatus("Picture notes ready — review them beside your idea.");
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
      const obs = await observeVideoFileSemantic(file, {
        signal: ac.signal,
        tier: "LITE",
      });
      if (!isCurrent()) return;
      setVideoScenes({
        durationSec: obs.durationSec,
        times: obs.sampleTimesSec,
        summary: obs.sequenceSummary,
      });
      setMediaNotes(
        [
          obs.sequenceSummary,
          "No audio is transcribed or invented — scenes come from sampled frames only.",
        ].join("\n"),
      );
      setStructureLines([]);
      appendBlock(
        [
          "Video → prompt request:",
          "Using the bounded frame observations below, help me write a strong prompt about this video.",
          "",
          videoObservationToPromptBlock(obs),
        ].join("\n"),
      );
      setStatus(
        `Sampled ${obs.frames.length} scenes across ${obs.durationSec}s. Timeline updated.`,
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
      {mode === "screenshot" && (
        <ol className="spe-code-pipeline" aria-label="Code path">
          {(
            [
              { id: "source" as const, label: "Source", active: !previewUrl },
              {
                id: "understand" as const,
                label: "Understand",
                active: Boolean(previewUrl) && structureLines.length === 0,
              },
              {
                id: "structure" as const,
                label: "Structure",
                active: structureLines.length > 0 && scaffolds.length === 0,
              },
              { id: "target" as const, label: "Target", active: scaffolds.length > 0 },
              { id: "build" as const, label: "Build", active: scaffolds.length > 0 },
            ]
          ).map((step) => (
            <li key={step.id} data-step-active={step.active ? "true" : "false"}>
              {step.label}
            </li>
          ))}
        </ol>
      )}

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
            className="spe-upload-premium"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            <strong>
              {mode === "video"
                ? "Choose video"
                : mode === "screenshot"
                  ? "Choose screenshot"
                  : "Choose image"}
            </strong>
            <span>
              {mode === "screenshot"
                ? "A clear capture of the screen you want to start from"
                : mode === "video"
                  ? "Short clips work best — we sample scenes, not sound"
                  : "We note what we can see — you keep the meaning"}
            </span>
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
            <div className="spe-composer-preview" data-panel="source">
              <p className="spe-panel-label">Source</p>
              {mode === "video" ? (
                <video src={previewUrl} controls preload="metadata" />
              ) : (
                <img src={previewUrl} alt="Selected media preview" />
              )}
            </div>
          )}
          {mode === "video" && videoScenes && (
            <div className="spe-video-timeline" aria-label="Scene timeline">
              <p className="spe-panel-label">Timeline · scenes</p>
              <div
                className="spe-timeline-track"
                role="img"
                aria-label={`${videoScenes.times.length} scenes across ${videoScenes.durationSec} seconds`}
              >
                {videoScenes.times.map((t, i) => {
                  const pct =
                    videoScenes.durationSec > 0
                      ? Math.min(100, Math.max(0, (t / videoScenes.durationSec) * 100))
                      : 0;
                  return (
                    <span
                      key={`${t}-${i}`}
                      className="spe-timeline-mark"
                      style={{ left: `${pct}%` }}
                      title={`Scene ${i + 1} @ ${t.toFixed(1)}s`}
                    />
                  );
                })}
              </div>
              <ul className="spe-scene-list">
                {videoScenes.times.map((t, i) => (
                  <li key={`${t}-li-${i}`}>
                    Scene {i + 1} · {t.toFixed(1)}s
                  </li>
                ))}
              </ul>
              <p className="spe-muted">No audio is transcribed or invented.</p>
            </div>
          )}
          {structureLines.length > 0 && mode === "screenshot" && (
            <div className="spe-structure-panel" data-panel="structure">
              <p className="spe-panel-label">Structure</p>
              <ul>
                {structureLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          {mediaNotes && mode !== "screenshot" && (
            <aside className="spe-obs-panel" aria-label="Notes from media">
              <p className="spe-panel-label">
                {mode === "image" ? "Notes from this picture" : "Notes from this video"}
              </p>
              <p className="spe-obs-body">{mediaNotes}</p>
            </aside>
          )}
          {scaffolds.length > 0 && (
            <div className="spe-scaffolds">
              <h3>Scaffolds (honest starters — not pixel-perfect)</h3>
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
              <div className="spe-scaffold-compare">
                <div>
                  <p className="spe-panel-label">
                    Target · {CODE_TARGET_LABELS[codeTarget]}
                  </p>
                  <pre className="spe-scaffold-code" tabIndex={0}>
                    {
                      (scaffolds.find((s) => s.target === codeTarget) ??
                        scaffolds[0]).code
                    }
                  </pre>
                </div>
                <div>
                  <label className="spe-field inline">
                    <span>Compare</span>
                    <select
                      value={compareTarget ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        setCompareTarget(
                          (e.target.value || null) as CodeTarget | null,
                        )
                      }
                    >
                      <option value="">Choose…</option>
                      {scaffolds
                        .filter((s) => s.target !== codeTarget)
                        .map((s) => (
                          <option key={s.target} value={s.target}>
                            {s.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  {compareTarget && (
                    <pre className="spe-scaffold-code" tabIndex={0}>
                      {
                        (
                          scaffolds.find((s) => s.target === compareTarget) ??
                          scaffolds[0]
                        ).code
                      }
                    </pre>
                  )}
                </div>
              </div>
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
            <span>
              {mode === "image" || mode === "video"
                ? "Your idea"
                : "Your idea (with layout notes)"}
            </span>
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
              data-ready={Boolean(urlInput.trim()) && !disabled ? "true" : "false"}
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
          <p className="spe-composer-url-note spe-xray-note">
            Some websites don&apos;t allow direct reading from another site. If
            that happens, upload the page HTML or a screenshot instead.
            Failures stay in this panel — they are not added to your idea.
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
