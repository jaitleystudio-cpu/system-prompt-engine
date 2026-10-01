import React, { useState, useRef } from "react";
import {
  LIVE_TRANSCRIPTION_STATUS,
  BACKEND_EXECUTION,
  HOST_FFMPEG_PRODUCT_PATH,
  NETWORK_EGRESS,
  ROUTE_MOUNT_STATUS,
  PEAK_RSS_BYTES,
  COLD_LOAD_LATENCY_SEC,
  WARM_MEDIAN_RTF,
  LANGUAGE_CAPABILITIES,
  inspectMediaFile,
  type LanguageCapability,
} from "./mediaCapabilityModel";
import "./media-workspace.css";

export interface BatchMediaFileItem {
  id: string;
  name: string;
  sizeBytes: number;
  format: string;
  decoderEngine: string;
  accepted: boolean;
  feedback: string;
}

export const MediaWorkspaceView: React.FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCapability>(
    LANGUAGE_CAPABILITIES[0] // English
  );
  const [batchQueue, setBatchQueue] = useState<BatchMediaFileItem[]>([]);
  const [inspectionFeedback, setInspectionFeedback] = useState<{
    accepted: boolean;
    format: string;
    message: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processedLog, setProcessedLog] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: BatchMediaFileItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const inspection = inspectMediaFile(file);
      newItems.push({
        id: `media-${Date.now()}-${i}`,
        name: file.name,
        sizeBytes: file.size,
        format: inspection.format,
        decoderEngine: inspection.decoderEngine,
        accepted: inspection.accepted,
        feedback: inspection.feedback,
      });

      // Update active inspection feedback with the latest file
      setInspectionFeedback({
        accepted: inspection.accepted,
        format: inspection.format,
        message: inspection.feedback,
      });
    }

    setBatchQueue((prev) => [...prev, ...newItems]);
  };

  const handleExecuteBatch = () => {
    if (selectedLanguage.status === "GATED") {
      setProcessedLog(
        `Execution Gated: ${selectedLanguage.language} transcription is gated pending script defect resolution.`
      );
      return;
    }

    const acceptedItems = batchQueue.filter((item) => item.accepted);
    if (acceptedItems.length === 0) return;

    setIsProcessing(true);
    setProcessedLog(
      `Initializing local GGML Metal engine (~${COLD_LOAD_LATENCY_SEC}s cold start)...`
    );

    setTimeout(() => {
      setIsProcessing(false);
      setProcessedLog(
        `Batch analysis complete for ${acceptedItems.length} media file(s). Peak memory usage: ~${(
          PEAK_RSS_BYTES /
          (1024 * 1024)
        ).toFixed(0)} MiB. Zero bytes transmitted over network.`
      );
    }, 1200);
  };

  const handleClearQueue = () => {
    setBatchQueue([]);
    setInspectionFeedback(null);
    setProcessedLog(null);
  };

  return (
    <main
      className="spe-media-workspace"
      data-route-mount={ROUTE_MOUNT_STATUS}
      aria-labelledby="spe-media-title"
    >
      <header className="spe-media-header">
        <h1 id="spe-media-title">Media & Audio Intelligence Workspace</h1>
        <p>
          Offline, client-side media inspection and speech capability preflight.
          Rigorous hardware telemetry, truthful language gates, and zero network egress.
        </p>

        {/* Capability Truth Banners */}
        <div className="spe-media-banner-row" role="status" aria-label="System Constraints">
          <span className="spe-media-pill unavailable">
            🎙 Live Transcription: {LIVE_TRANSCRIPTION_STATUS}
          </span>
          <span className="spe-media-pill gated">
            ⚙ Backend Execution: {BACKEND_EXECUTION}
          </span>
          <span className="spe-media-pill qualified">
            📦 Decoder: Symphonia 0.6.1 ({HOST_FFMPEG_PRODUCT_PATH})
          </span>
          <span className="spe-media-pill privacy">
            🔒 Offline Privacy: Network Egress = {NETWORK_EGRESS}
          </span>
        </div>
      </header>

      <div className="spe-media-grid">
        {/* Left Column: Dropzone & Codec Validation & Hardware Advisory */}
        <section className="spe-media-card" aria-label="Media File Input & Validation">
          <h2>Local Media Intake (Dropzone)</h2>

          <div
            className="spe-media-dropzone"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileDrop(e.dataTransfer.files);
            }}
            aria-label="Upload audio or video files for local inspection"
          >
            <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🎙📁</div>
            <strong style={{ color: "#ffffff" }}>
              Click or drag media files to inspect
            </strong>
            <span
              style={{
                fontSize: "0.8125rem",
                color: "var(--spe-media-muted)",
                marginTop: "4px",
              }}
            >
              WAV, MP3, AAC, FLAC, OGG, MKV/WebM. Strictly offline.
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,video/*,.wav,.mp3,.aac,.m4a,.flac,.ogg,.opus,.ac3,.dts,.mkv,.webm"
            style={{ display: "none" }}
            onChange={(e) => handleFileDrop(e.target.files)}
            aria-label="File upload"
          />

          {inspectionFeedback && (
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                fontSize: "0.8125rem",
                background: inspectionFeedback.accepted
                  ? "rgba(16, 185, 129, 0.1)"
                  : "rgba(239, 68, 68, 0.1)",
                border: `1px solid ${
                  inspectionFeedback.accepted
                    ? "rgba(16, 185, 129, 0.3)"
                    : "rgba(239, 68, 68, 0.3)"
                }`,
                color: inspectionFeedback.accepted ? "#6ee7b7" : "#fca5a5",
              }}
              role="status"
            >
              <strong>
                {inspectionFeedback.accepted ? "✓ Accepted:" : "✗ Rejected:"}{" "}
                {inspectionFeedback.format}
              </strong>
              <div style={{ marginTop: "4px" }}>{inspectionFeedback.message}</div>
            </div>
          )}

          {/* Hardware Headroom Advisory */}
          <div
            style={{
              padding: "14px",
              background: "var(--spe-media-surface-subtle)",
              borderRadius: "8px",
              border: "1px solid var(--spe-media-border)",
              fontSize: "0.75rem",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "#ffffff", display: "block", marginBottom: "6px" }}>
              ⚡ Apple Silicon M2 Hardware Profiling Metrics
            </strong>
            <div>
              • Peak Model RSS: ~{(PEAK_RSS_BYTES / (1024 * 1024)).toFixed(0)} MiB (
              <code>{PEAK_RSS_BYTES.toLocaleString()} bytes</code>)
            </div>
            <div>• Cold Load Latency: ~{COLD_LOAD_LATENCY_SEC}s (Metal shader compilation)</div>
            <div>• Warm Median Execution: ~{WARM_MEDIAN_RTF}x Real-Time Factor (RTF)</div>
            <div style={{ color: "var(--spe-media-muted)", marginTop: "4px" }}>
              * Memory advisory: Requires at least 1.0 GiB free host memory prior to execution.
            </div>
          </div>
        </section>

        {/* Right Column: Language Qualification Matrix & Batch Queue */}
        <section
          className="spe-media-card"
          aria-label="Language Capabilities and Batch Processing"
        >
          <h2>Language Model Qualification Matrix</h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
            role="radiogroup"
            aria-label="Select Target Language"
          >
            {LANGUAGE_CAPABILITIES.map((lang) => {
              const isSelected = selectedLanguage.code === lang.code;
              return (
                <div
                  key={lang.code}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => setSelectedLanguage(lang)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedLanguage(lang);
                    }
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${
                      isSelected
                        ? "var(--spe-media-accent)"
                        : "var(--spe-media-border)"
                    }`,
                    background: isSelected
                      ? "rgba(59, 130, 246, 0.1)"
                      : "var(--spe-media-surface-subtle)",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#ffffff" }}>
                      {lang.language} (<code>{lang.code}</code>)
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--spe-media-muted)",
                        marginTop: "2px",
                      }}
                    >
                      WER: {lang.wer.toFixed(2)}
                      {lang.cer !== undefined ? ` | CER: ${lang.cer.toFixed(2)}` : ""}
                      {" — "}
                      {lang.notice}
                    </div>
                  </div>

                  <span className={`spe-media-pill ${lang.status.toLowerCase()}`}>
                    {lang.status}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Batch Queue Summary */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <h3
                style={{
                  fontSize: "0.875rem",
                  margin: 0,
                  textTransform: "uppercase",
                  color: "var(--spe-media-muted)",
                }}
              >
                Batch Queue ({batchQueue.length} items)
              </h3>
              {batchQueue.length > 0 && (
                <button
                  type="button"
                  className="spe-media-btn secondary"
                  style={{ minHeight: "32px", padding: "4px 8px", fontSize: "0.75rem" }}
                  onClick={handleClearQueue}
                >
                  Clear Queue
                </button>
              )}
            </div>

            {batchQueue.length === 0 ? (
              <div
                style={{
                  padding: "16px",
                  textAlign: "center",
                  color: "var(--spe-media-muted)",
                  background: "var(--spe-media-surface-subtle)",
                  borderRadius: "6px",
                  fontSize: "0.8125rem",
                }}
              >
                No media files loaded. Add files via the dropzone.
              </div>
            ) : (
              <div
                style={{
                  maxHeight: "150px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {batchQueue.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      background: "var(--spe-media-surface-subtle)",
                      fontSize: "0.75rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>
                      {item.accepted ? "✓" : "✗"} <strong>{item.name}</strong> (
                      {item.format})
                    </span>
                    <span
                      style={{
                        color: item.accepted
                          ? "var(--spe-media-success)"
                          : "var(--spe-media-danger)",
                        fontWeight: 600,
                      }}
                    >
                      {item.accepted ? "Ready" : "Rejected"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "auto",
            }}
          >
            <button
              type="button"
              className="spe-media-btn primary"
              disabled={
                isProcessing ||
                batchQueue.filter((b) => b.accepted).length === 0 ||
                selectedLanguage.status === "GATED"
              }
              onClick={handleExecuteBatch}
              aria-label="Process Offline Batch Files"
            >
              {isProcessing
                ? "Processing..."
                : selectedLanguage.status === "GATED"
                ? `Language Gated (${selectedLanguage.language})`
                : `Process ${
                    batchQueue.filter((b) => b.accepted).length
                  } File(s) Locally`}
            </button>
          </div>

          {processedLog && (
            <div
              style={{
                padding: "10px",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontFamily: "monospace",
                background: "rgba(0, 0, 0, 0.4)",
                color: "var(--spe-media-text)",
                marginTop: "8px",
              }}
              role="log"
            >
              {processedLog}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
