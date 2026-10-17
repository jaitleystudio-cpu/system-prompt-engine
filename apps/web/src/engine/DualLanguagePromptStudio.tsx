import React, { useState, useMemo } from "react";
import {
  synthesizeDualPrompts,
  MODEL_PRICING_CATALOG,
  type DualPromptBundle,
} from "./multilingualDualPrompt";

export interface DualLanguagePromptStudioProps {
  initialInput?: string;
  category?: string;
  onApplyPrompt?: (promptText: string) => void;
  onClose?: () => void;
}

const PRESET_MULTILINGUAL_EXAMPLES = [
  {
    label: "🇮🇳 Telugu: మహిళల దుస్తుల వ్యాపారం (Clothing Boutique)",
    text: "నాకు మహిళల దుస్తుల వ్యాపారం ప్రారంభించాలని ఉంది. నాకు మంచి బిజినెస్ ప్లాన్ కావాలి.",
    category: "Business",
  },
  {
    label: "🇮🇳 Hindi: टेक स्टार्टअप बिज़नेस प्लान (Tech Startup)",
    text: "मुझे एक नया टेक स्टार्टअप शुरू करना है। मुझे एक विस्तृत योजना और वित्तीय मॉडल चाहिए।",
    category: "Business",
  },
  {
    label: "🇪🇸 Spanish: Tienda de Moda Sostenible (Sustainable Fashion)",
    text: "Quiero crear una tienda online de moda sostenible para mujeres con un plan de negocio completo.",
    category: "Business",
  },
  {
    label: "🇫🇷 French: Restaurant Bio & Éco-responsable (Organic Bistro)",
    text: "Je veux lancer un restaurant bio éco-responsable avec un plan d'affaires et stratégie marketing.",
    category: "Business",
  },
];

export const DualLanguagePromptStudio: React.FC<DualLanguagePromptStudioProps> = ({
  initialInput = "నాకు మహిళల దుస్తుల వ్యాపారం ప్రారంభించాలని ఉంది. నాకు మంచి బిజినెస్ ప్లాన్ కావాలి.",
  category = "Business",
  onApplyPrompt,
  onClose,
}) => {
  const [inputText, setInputText] = useState(initialInput);
  const [selectedModel, setSelectedModel] = useState<string>("claude-5-5-sonnet");
  const [activeTab, setActiveTab] = useState<"native" | "english" | "compare" | "hybrid">("compare");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const bundle: DualPromptBundle = useMemo(() => {
    return synthesizeDualPrompts(inputText, category, selectedModel);
  }, [inputText, category, selectedModel]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2400);
      }
    } catch {
      // Fallback
    }
  };

  const handleUsePrompt = (prompt: string) => {
    if (onApplyPrompt) {
      onApplyPrompt(prompt);
    }
  };

  return (
    <div
      className="spe-dual-prompt-studio"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        background: "#090d16",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: "16px",
        padding: "1.5rem",
        color: "#f8fafc",
        boxShadow: "0 20px 40px -15px rgba(0,0,0,0.7)",
      }}
    >
      {/* Top Header & Mission Statement */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "1.3rem" }}>🌍</span>
            <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>
              SPE Multilingual Dual-Prompt Intelligence
            </h3>
            <span
              style={{
                fontSize: "0.68rem",
                padding: "2px 8px",
                borderRadius: "999px",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                fontWeight: 700,
                border: "1px solid rgba(16, 185, 129, 0.3)",
              }}
            >
              {bundle.detectedLanguage.flag} {bundle.detectedLanguage.name} ({bundle.detectedLanguage.nativeName})
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.45 }}>
            One human intention. Two language versions. Measured token efficiency. Complete user choice.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Model Pricing Selector */}
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", color: "#cbd5e1" }}>
            <span>Target AI:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "6px",
                color: "#fff",
                padding: "4px 8px",
                fontSize: "0.75rem",
                outline: "none",
              }}
            >
              {Object.values(MODEL_PRICING_CATALOG).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (${m.inputCostPer1M.toFixed(2)}/1M)
                </option>
              ))}
            </select>
          </label>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "8px",
                color: "#94a3b8",
                padding: "4px 10px",
                fontSize: "0.78rem",
                cursor: "pointer",
              }}
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* Preset Multi-Language Quick Starters */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
          Quick Multilingual Prompts (Try Native Input):
        </span>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {PRESET_MULTILINGUAL_EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setInputText(ex.text)}
              style={{
                background: inputText === ex.text ? "rgba(99, 102, 241, 0.25)" : "rgba(255,255,255,0.04)",
                border: inputText === ex.text ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: "999px",
                padding: "4px 12px",
                color: inputText === ex.text ? "#fff" : "#cbd5e1",
                fontSize: "0.74rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* User Input Text Area */}
      <div>
        <textarea
          rows={2}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Speak or type in your native language (Telugu, Hindi, Tamil, Spanish, French, Arabic, etc.)..."
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "10px",
            color: "#fff",
            padding: "8px 12px",
            fontSize: "0.85rem",
            fontFamily: "inherit",
            resize: "vertical",
            outline: "none",
          }}
        />
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("compare")}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: activeTab === "compare" ? "1px solid #10b981" : "1px solid transparent",
              background: activeTab === "compare" ? "rgba(16, 185, 129, 0.15)" : "transparent",
              color: activeTab === "compare" ? "#10b981" : "#94a3b8",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ⚖️ Compare Costs &amp; Tokens
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("native")}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: activeTab === "native" ? "1px solid #f59e0b" : "1px solid transparent",
              background: activeTab === "native" ? "rgba(245, 158, 11, 0.15)" : "transparent",
              color: activeTab === "native" ? "#f59e0b" : "#94a3b8",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {bundle.detectedLanguage.flag} Native {bundle.detectedLanguage.name} Prompt
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("english")}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: activeTab === "english" ? "1px solid #38bdf8" : "1px solid transparent",
              background: activeTab === "english" ? "rgba(56, 189, 248, 0.15)" : "transparent",
              color: activeTab === "english" ? "#38bdf8" : "#94a3b8",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🌍 Optimized English Prompt
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hybrid")}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: activeTab === "hybrid" ? "1px solid #c084fc" : "1px solid transparent",
              background: activeTab === "hybrid" ? "rgba(192, 132, 252, 0.15)" : "transparent",
              color: activeTab === "hybrid" ? "#c084fc" : "#94a3b8",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🌐 Bilingual Hybrid
          </button>
        </div>

        {/* Dynamic Recommendation Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>SPE Decision:</span>
          <span
            style={{
              fontSize: "0.72rem",
              padding: "3px 10px",
              borderRadius: "999px",
              background: bundle.recommendedVersion === "english" ? "rgba(56, 189, 248, 0.15)" : "rgba(245, 158, 11, 0.15)",
              color: bundle.recommendedVersion === "english" ? "#38bdf8" : "#f59e0b",
              fontWeight: 700,
              border: `1px solid ${bundle.recommendedVersion === "english" ? "rgba(56, 189, 248, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
            }}
          >
            Recommended: {bundle.recommendedVersion === "english" ? "Optimized English" : `Native ${bundle.detectedLanguage.name}`}
          </span>
        </div>
      </div>

      {/* TAB 1: COMPARE COSTS & TOKENS MATRIX */}
      {activeTab === "compare" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Recommendation Banner */}
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "10px",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.1rem" }}>💡</span>
              <span style={{ fontSize: "0.82rem", color: "#e2e8f0" }}>
                <strong>Objective Analysis:</strong> {bundle.recommendationReason}
              </span>
            </div>
            {bundle.tokenSavingsPercent > 0 && (
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#10b981", background: "rgba(16, 185, 129, 0.15)", padding: "2px 8px", borderRadius: "999px" }}>
                Save {bundle.tokenSavingsPercent}% Tokens in English
              </span>
            )}
          </div>

          {/* Side-by-Side Comparison Matrix Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <th style={{ padding: "10px 12px", color: "#94a3b8" }}>Dimension</th>
                  <th style={{ padding: "10px 12px", color: "#f59e0b" }}>
                    {bundle.detectedLanguage.flag} Native {bundle.detectedLanguage.name} Prompt
                  </th>
                  <th style={{ padding: "10px 12px", color: "#38bdf8" }}>🌍 Optimized English Prompt</th>
                  <th style={{ padding: "10px 12px", color: "#c084fc" }}>🌐 Bilingual Hybrid</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "#cbd5e1" }}>Characters</td>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>{bundle.nativeMetrics.charCount.toLocaleString()} chars</td>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>{bundle.englishMetrics.charCount.toLocaleString()} chars</td>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>{bundle.hybridMetrics.charCount.toLocaleString()} chars</td>
                </tr>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "#cbd5e1" }}>
                    Estimated Tokens
                    <span style={{ display: "block", fontSize: "0.68rem", color: "#64748b" }}>
                      ({MODEL_PRICING_CATALOG[selectedModel]?.name})
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#f59e0b", fontWeight: 700 }}>
                    ~{bundle.nativeMetrics.estimatedTokens.toLocaleString()} tokens
                  </td>
                  <td style={{ padding: "10px 12px", color: "#38bdf8", fontWeight: 700 }}>
                    ~{bundle.englishMetrics.estimatedTokens.toLocaleString()} tokens
                    {bundle.tokenSavingsPercent > 0 && (
                      <span style={{ display: "block", fontSize: "0.68rem", color: "#10b981" }}>
                        (-{bundle.tokenSavingsPercent}% fewer tokens)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#c084fc", fontWeight: 700 }}>
                    ~{bundle.hybridMetrics.estimatedTokens.toLocaleString()} tokens
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "#cbd5e1" }}>
                    Estimated API Cost
                    <span style={{ display: "block", fontSize: "0.68rem", color: "#64748b" }}>Per 1,000 requests</span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>${bundle.nativeMetrics.costPer1kRuns.toFixed(4)}</td>
                  <td style={{ padding: "10px 12px", color: "#10b981", fontWeight: 700 }}>
                    ${bundle.englishMetrics.costPer1kRuns.toFixed(4)}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#fff" }}>${bundle.hybridMetrics.costPer1kRuns.toFixed(4)}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "#cbd5e1" }}>Intent Preservation</td>
                  <td style={{ padding: "10px 12px", color: "#10b981" }}>✓ 100% Native Authenticity</td>
                  <td style={{ padding: "10px 12px", color: "#10b981" }}>✓ 100% Semantic Equivalence</td>
                  <td style={{ padding: "10px 12px", color: "#10b981" }}>✓ Dual-Language Preserved</td>
                </tr>
                <tr>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "#cbd5e1" }}>Best Use Case</td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: "0.75rem" }}>
                    Customer-facing bots, local regional queries, and cultural nuance preservation.
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: "0.75rem" }}>
                    High-volume API pipelines, complex coding, and maximum token cost savings.
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: "0.75rem" }}>
                    Bilingual applications requiring English logic with vernacular terms.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Quick Copy Buttons Row */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={() => copyToClipboard(bundle.nativePrompt, "native")}
              style={{
                padding: "8px 16px",
                borderRadius: "999px",
                background: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                color: "#f59e0b",
                fontWeight: 700,
                fontSize: "0.78rem",
                cursor: "pointer",
              }}
            >
              {copiedKey === "native" ? "✓ Copied Native Prompt!" : `Copy Native ${bundle.detectedLanguage.name}`}
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(bundle.englishPrompt, "english")}
              style={{
                padding: "8px 16px",
                borderRadius: "999px",
                background: "rgba(56, 189, 248, 0.18)",
                border: "1px solid rgba(56, 189, 248, 0.45)",
                color: "#38bdf8",
                fontWeight: 700,
                fontSize: "0.78rem",
                cursor: "pointer",
              }}
            >
              {copiedKey === "english" ? "✓ Copied English Prompt!" : "Copy Optimized English"}
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(bundle.hybridPrompt, "hybrid")}
              style={{
                padding: "8px 16px",
                borderRadius: "999px",
                background: "rgba(192, 132, 252, 0.15)",
                border: "1px solid rgba(192, 132, 252, 0.4)",
                color: "#c084fc",
                fontWeight: 700,
                fontSize: "0.78rem",
                cursor: "pointer",
              }}
            >
              {copiedKey === "hybrid" ? "✓ Copied Hybrid!" : "Copy Bilingual Hybrid"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: NATIVE LANGUAGE PROMPT */}
      {activeTab === "native" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#f59e0b", fontWeight: 700 }}>
              {bundle.detectedLanguage.flag} Native {bundle.detectedLanguage.name} ({bundle.detectedLanguage.nativeName}) System Prompt:
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => copyToClipboard(bundle.nativePrompt, "native-tab")}
                style={{
                  padding: "4px 12px",
                  borderRadius: "6px",
                  background: "rgba(245, 158, 11, 0.2)",
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  color: "#f59e0b",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {copiedKey === "native-tab" ? "✓ Copied!" : "Copy"}
              </button>
              {onApplyPrompt && (
                <button
                  type="button"
                  onClick={() => handleUsePrompt(bundle.nativePrompt)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    background: "#f59e0b",
                    border: "none",
                    color: "#000",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Use in SPE Studio ↗
                </button>
              )}
            </div>
          </div>
          <pre
            tabIndex={0}
            style={{
              margin: 0,
              padding: "1rem",
              borderRadius: "10px",
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2e8f0",
              fontSize: "0.82rem",
              fontFamily: "var(--spe-font-mono, monospace)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "340px",
              overflowY: "auto",
              lineHeight: 1.5,
            }}
          >
            {bundle.nativePrompt}
          </pre>
        </div>
      )}

      {/* TAB 3: OPTIMIZED ENGLISH PROMPT */}
      {activeTab === "english" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#38bdf8", fontWeight: 700 }}>
              🌍 Optimized English System Prompt:
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => copyToClipboard(bundle.englishPrompt, "english-tab")}
                style={{
                  padding: "4px 12px",
                  borderRadius: "6px",
                  background: "rgba(56, 189, 248, 0.2)",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  color: "#38bdf8",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {copiedKey === "english-tab" ? "✓ Copied!" : "Copy"}
              </button>
              {onApplyPrompt && (
                <button
                  type="button"
                  onClick={() => handleUsePrompt(bundle.englishPrompt)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    background: "#38bdf8",
                    border: "none",
                    color: "#000",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Use in SPE Studio ↗
                </button>
              )}
            </div>
          </div>
          <pre
            tabIndex={0}
            style={{
              margin: 0,
              padding: "1rem",
              borderRadius: "10px",
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2e8f0",
              fontSize: "0.82rem",
              fontFamily: "var(--spe-font-mono, monospace)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "340px",
              overflowY: "auto",
              lineHeight: 1.5,
            }}
          >
            {bundle.englishPrompt}
          </pre>
        </div>
      )}

      {/* TAB 4: BILINGUAL HYBRID */}
      {activeTab === "hybrid" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#c084fc", fontWeight: 700 }}>
              🌐 Bilingual Hybrid Prompt ({bundle.detectedLanguage.name} + English Directives):
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => copyToClipboard(bundle.hybridPrompt, "hybrid-tab")}
                style={{
                  padding: "4px 12px",
                  borderRadius: "6px",
                  background: "rgba(192, 132, 252, 0.2)",
                  border: "1px solid rgba(192, 132, 252, 0.4)",
                  color: "#c084fc",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {copiedKey === "hybrid-tab" ? "✓ Copied!" : "Copy"}
              </button>
              {onApplyPrompt && (
                <button
                  type="button"
                  onClick={() => handleUsePrompt(bundle.hybridPrompt)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    background: "#c084fc",
                    border: "none",
                    color: "#000",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Use in SPE Studio ↗
                </button>
              )}
            </div>
          </div>
          <pre
            tabIndex={0}
            style={{
              margin: 0,
              padding: "1rem",
              borderRadius: "10px",
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2e8f0",
              fontSize: "0.82rem",
              fontFamily: "var(--spe-font-mono, monospace)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "340px",
              overflowY: "auto",
              lineHeight: 1.5,
            }}
          >
            {bundle.hybridPrompt}
          </pre>
        </div>
      )}
    </div>
  );
};
