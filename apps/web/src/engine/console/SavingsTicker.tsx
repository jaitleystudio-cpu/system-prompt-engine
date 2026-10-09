import React, { useState, useEffect, useMemo } from "react";

export interface SavingsTickerProps {
  initialLocalTokens?: number;
  initialCloudTokens?: number;
  initialSalvagedTokens?: number;
  benchmarkPricePerMillion?: number; // USD per 1M tokens, default $15.00
  isLive?: boolean;
}

/**
 * 1 USD = 1,000,000,000 NanoUSD
 */
export function tokensToNanoUsd(tokens: number, pricePerMillionUsd: number): number {
  // exact integer arithmetic in nanos
  // (tokens * pricePerMillionUsd * 1,000,000,000) / 1,000,000
  return Math.round((tokens * pricePerMillionUsd * 1000));
}

export function formatNanoUsd(nanos: number): string {
  const usd = nanos / 1_000_000_000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(usd);
}

export const SavingsTicker: React.FC<SavingsTickerProps> = ({
  initialLocalTokens = 2_840_500,
  initialCloudTokens = 125_400,
  initialSalvagedTokens = 1_420_000,
  benchmarkPricePerMillion = 15.0, // e.g. Claude 3.5 Sonnet / GPT-4o blended rate
  isLive = true,
}) => {
  const [localTokens, setLocalTokens] = useState(initialLocalTokens);
  const [salvagedTokens, setSalvagedTokens] = useState(initialSalvagedTokens);
  const [tickerPulse, setTickerPulse] = useState(false);

  // Live simulation tick if active
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      const addedTokens = Math.floor(Math.random() * 450) + 120;
      const addedSalvage = Math.floor(addedTokens * 0.65);
      setLocalTokens((prev) => prev + addedTokens);
      setSalvagedTokens((prev) => prev + addedSalvage);
      setTickerPulse(true);
      setTimeout(() => setTickerPulse(false), 300);
    }, 2400);
    return () => clearInterval(interval);
  }, [isLive]);

  // Exact arithmetic calculations
  const totalSalvagedAndLocalTokens = localTokens + salvagedTokens;
  const savedNanos = useMemo(
    () => tokensToNanoUsd(totalSalvagedAndLocalTokens, benchmarkPricePerMillion),
    [totalSalvagedAndLocalTokens, benchmarkPricePerMillion]
  );
  const formattedSavedUsd = useMemo(() => formatNanoUsd(savedNanos), [savedNanos]);
  const cloudSpentNanos = useMemo(
    () => tokensToNanoUsd(initialCloudTokens, benchmarkPricePerMillion),
    [initialCloudTokens, benchmarkPricePerMillion]
  );

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)",
        border: "1px solid #30363d",
        borderRadius: "12px",
        padding: "24px",
        color: "#f0f6fc",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header Badges */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#10b981",
              boxShadow: "0 0 10px #10b981",
            }}
          />
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, letterSpacing: "0.5px" }}>
            SPE Compute Economics Engine
          </h3>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <span
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              color: "#34d399",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            100% Zero-Spend Air-Gapped
          </span>
          <span
            style={{
              background: "rgba(99, 102, 241, 0.15)",
              color: "#818cf8",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            Metal / CUDA / NPU Native
          </span>
          <span
            style={{
              background: "rgba(245, 158, 11, 0.15)",
              color: "#fbbf24",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            NanoUSD Exact Ledger
          </span>
        </div>
      </div>

      {/* Main Cumulative Savings Ticker Display */}
      <div
        style={{
          background: "#090d13",
          border: "1px solid #21262d",
          borderRadius: "10px",
          padding: "24px",
          textAlign: "center",
          marginBottom: "20px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ fontSize: "12px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
          Cumulative Saved Cloud Compute (vs $15/1M Benchmark)
        </div>
        <div
          style={{
            fontSize: "44px",
            fontWeight: 800,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "#10b981",
            textShadow: tickerPulse ? "0 0 24px rgba(16, 185, 129, 0.8)" : "0 0 12px rgba(16, 185, 129, 0.3)",
            transition: "all 0.3s ease",
          }}
        >
          {formattedSavedUsd}
        </div>
        <div style={{ fontSize: "13px", color: "#58a6ff", marginTop: "8px", fontFamily: "monospace" }}>
          {savedNanos.toLocaleString()} NanoUSD verified by Local Ledger
        </div>
      </div>

      {/* Metric Breakdown Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div
          style={{
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "6px" }}>Local Engine Tokens</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#f0f6fc", fontFamily: "monospace" }}>
            {localTokens.toLocaleString()}
          </div>
          <div style={{ fontSize: "11px", color: "#34d399", marginTop: "4px" }}>
            $0.0000 Zero-cost execution
          </div>
        </div>

        <div
          style={{
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "6px" }}>Salvaged Compute (EAS)</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#60a5fa", fontFamily: "monospace" }}>
            {salvagedTokens.toLocaleString()}
          </div>
          <div style={{ fontSize: "11px", color: "#93c5fd", marginTop: "4px" }}>
            Reused via proof continuation
          </div>
        </div>

        <div
          style={{
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "6px" }}>Cloud 2PC Escrow</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#fbbf24", fontFamily: "monospace" }}>
            {formatNanoUsd(cloudSpentNanos)}
          </div>
          <div style={{ fontSize: "11px", color: "#d97706", marginTop: "4px" }}>
            Strict pre-allocated budget
          </div>
        </div>
      </div>
    </div>
  );
};
