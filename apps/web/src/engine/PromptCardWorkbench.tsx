import React, { useState } from "react";
import {
  deconstructImageOffline,
  PromptCardItem,
  SpeCustomerTier,
  canAccessPromptcardVlm,
} from "../engine/promptcardVlmEngine";

interface PromptCardWorkbenchProps {
  customerTier?: SpeCustomerTier;
  offlineLicenseKey?: string;
  onSelectPrompt?: (prompt: string) => void;
}

export const PromptCardWorkbench: React.FC<PromptCardWorkbenchProps> = ({
  customerTier = "PRO",
  offlineLicenseKey,
  onSelectPrompt,
}) => {
  const [activeMode, setActiveMode] = useState<"en" | "zh" | "ja" | "json">("en");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [contextHint, setContextHint] = useState<string>("gta waterfront dock");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [activeItem, setActiveItem] = useState<PromptCardItem | null>(null);
  const [history, setHistory] = useState<PromptCardItem[]>([]);
  const [copyFeedback, setCopyFeedback] = useState<string>("Copy");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEligible = canAccessPromptcardVlm(customerTier, offlineLicenseKey);

  const runAnalysis = (imageThumbnail?: string) => {
    if (!isEligible) {
      setErrorMsg("PromptCard VLM reverse-engineering requires an active PRO, TEAM, or ENTERPRISE subscription.");
      return;
    }

    setErrorMsg(null);
    setIsAnalyzing(true);
    setProgress(15);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 70) return prev + 18;
        if (prev < 85) return prev + 4;
        return prev;
      });
    }, 120);

    setTimeout(() => {
      clearInterval(interval);
      setProgress(100);

      try {
        const item = deconstructImageOffline({
          imageDataUrl: imageThumbnail,
          contextHint,
          aspectRatio,
          customerTier,
          offlineLicenseKey,
        });

        setActiveItem(item);
        setHistory((prev) => [item, ...prev.filter((h) => h.id !== item.id)].slice(0, 20));
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to analyze image");
      } finally {
        setIsAnalyzing(false);
      }
    }, 450);
  };

  const getActiveText = (): string => {
    if (!activeItem) return "";
    if (activeMode === "en") return activeItem.prompts.en;
    if (activeMode === "zh") return activeItem.prompts.zh;
    if (activeMode === "ja") return activeItem.prompts.ja;
    if (activeMode === "json") return JSON.stringify(activeItem.structured_json, null, 2);
    return activeItem.prompts.en;
  };

  const handleCopy = () => {
    const text = getActiveText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback("Copied! ✓");
      if (onSelectPrompt) onSelectPrompt(text);
      setTimeout(() => setCopyFeedback("Copy"), 1500);
    });
  };

  return (
    <div
      style={{
        background: "rgba(24, 24, 28, 0.92)",
        backdropFilter: "blur(24px)",
        borderRadius: "20px",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        padding: "24px",
        color: "#ffffff",
        maxWidth: "880px",
        margin: "0 auto",
        boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ff6a00", boxShadow: "0 0 10px #ff6a00" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", color: "#a1a1aa", textTransform: "uppercase" }}>
              PROMPTCARD · V1.4.0 WORKBENCH
            </span>
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>Image to Prompt Reverse-Engineering</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: "9999px",
              background: isEligible ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: isEligible ? "#4ade80" : "#f87171",
              border: isEligible ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
            }}
          >
            {isEligible ? `PAID TIER: ${customerTier} ($0.00 Cloud Bill)` : "FREE TIER (Upgrade Required)"}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#f87171",
            padding: "10px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Input Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: "12px", marginBottom: "20px" }}>
        <input
          type="text"
          value={contextHint}
          onChange={(e) => setContextHint(e.target.value)}
          placeholder="Image context / subject hint (e.g. GTA VI dock, runway fashion, cybernetic robot)..."
          style={{
            background: "rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "10px",
            padding: "10px 14px",
            color: "#ffffff",
            fontSize: "13.5px",
            outline: "none",
          }}
        />
        <select
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value)}
          style={{
            background: "rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "10px",
            padding: "10px 14px",
            color: "#ffffff",
            fontSize: "13px",
            outline: "none",
          }}
        >
          <option value="16:9">16:9 (Landscape)</option>
          <option value="4:5">4:5 (Portrait)</option>
          <option value="1:1">1:1 (Square)</option>
          <option value="9:16">9:16 (Vertical)</option>
        </select>
        <button
          onClick={() => runAnalysis()}
          disabled={isAnalyzing}
          style={{
            background: "linear-gradient(135deg, #ff7a18 0%, #ff4500 100%)",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            padding: "10px 20px",
            fontWeight: 600,
            fontSize: "13.5px",
            cursor: isAnalyzing ? "not-allowed" : "pointer",
            boxShadow: "0 4px 14px rgba(255, 69, 0, 0.4)",
          }}
        >
          {isAnalyzing ? "Analyzing..." : "Deconstruct Image"}
        </button>
      </div>

      {/* Progress Bar (when active) */}
      {isAnalyzing && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ width: "100%", height: "6px", background: "#27272a", borderRadius: "9999px", overflow: "hidden" }}>
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "#ffffff",
                borderRadius: "9999px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa", marginTop: "6px" }}>
            <span>Building 12-clause semicolon prompt...</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {/* Main Result & History Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: "20px" }}>
        {/* Main Result Box */}
        <div>
          <div
            style={{
              background: "rgba(0, 0, 0, 0.45)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "14px",
              padding: "16px",
              minHeight: "220px",
              maxHeight: "320px",
              overflowY: "auto",
              fontSize: "13.5px",
              lineHeight: 1.6,
              color: "#e4e4e7",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {activeItem ? (
              getActiveText()
            ) : (
              <span style={{ color: "#71717a" }}>
                Click "Deconstruct Image" to generate a dense, 12-clause semicolon-delimited reconstruction prompt with trilingual parity and structured JSON.
              </span>
            )}
          </div>

          {/* 4 Style Tag Pills */}
          {activeItem && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "14px 0" }}>
              {activeItem.tags.map((tag, idx) => (
                <span
                  key={idx}
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "9999px",
                    padding: "4px 12px",
                    fontSize: "12px",
                    color: "#e4e4e7",
                    fontWeight: 500,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Toolbar & Copy Button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" }}>
            <div style={{ display: "inline-flex", background: "rgba(0, 0, 0, 0.3)", padding: "3px", borderRadius: "10px", gap: "2px" }}>
              {(["en", "zh", "ja", "json"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveMode(m)}
                  style={{
                    background: activeMode === m ? "rgba(255, 255, 255, 0.14)" : "transparent",
                    color: activeMode === m ? "#ffffff" : "#a1a1aa",
                    border: activeMode === m ? "1px solid rgba(255, 255, 255, 0.25)" : "1px solid transparent",
                    padding: "4px 10px",
                    borderRadius: "7px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {m === "json" ? "{}" : m === "en" ? "EN" : m === "zh" ? "中文" : "日本語"}
                </button>
              ))}
            </div>

            <button
              onClick={handleCopy}
              disabled={!activeItem}
              style={{
                background: copyFeedback === "Copied! ✓" ? "#22c55e" : "#ffffff",
                color: copyFeedback === "Copied! ✓" ? "#ffffff" : "#09090b",
                fontWeight: 600,
                fontSize: "13.5px",
                border: "none",
                borderRadius: "9999px",
                padding: "8px 24px",
                cursor: activeItem ? "pointer" : "not-allowed",
                transition: "all 0.15s ease",
              }}
            >
              {copyFeedback}
            </button>
          </div>
        </div>

        {/* History Companion Drawer */}
        <div
          style={{
            background: "rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "14px",
            padding: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", color: "#e4e4e7", textTransform: "uppercase" }}>
              HISTORY
            </span>
            <span style={{ fontSize: "11px", color: "#a1a1aa", background: "rgba(255, 255, 255, 0.08)", padding: "2px 6px", borderRadius: "6px" }}>
              {history.length}/20
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
            {history.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#71717a", textAlign: "center", padding: "20px 0" }}>
                No history items yet
              </div>
            ) : (
              history.map((h) => (
                <div
                  key={h.id}
                  onClick={() => setActiveItem(h)}
                  style={{
                    borderRadius: "8px",
                    border: activeItem?.id === h.id ? "1px solid #ff7a18" : "1px solid rgba(255, 255, 255, 0.1)",
                    padding: "8px",
                    background: "rgba(0, 0, 0, 0.4)",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 600, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>
                      {h.structured_json.setting || "Artwork"}
                    </span>
                    <span style={{ color: "#4ade80", fontSize: "10px", fontWeight: 600 }}>Done</span>
                  </div>
                  <div style={{ color: "#a1a1aa", fontSize: "11px" }}>{h.aspectRatio} · {h.tags[0]}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
