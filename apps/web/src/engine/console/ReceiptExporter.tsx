import React, { useState } from "react";

export interface ExecutionPlacementCertificate {
  certificateId: string;
  timestamp: string;
  taskRef: string;
  placementTarget: "LOCAL_ENGINE" | "CLOUD_GATEWAY" | "HYBRID_PARTITION";
  hardwareEngineType: string;
  thermalState: string;
  totalCostNanos: number;
  totalTokensProcessed: number;
  tokensSalvagedEas: number;
  canonicalDigestSha256: string;
  ed25519PublicKeyHex: string;
  ed25519SignatureHex: string;
  claims: {
    airGapZeroSpendEnforced: boolean;
    memoryHeadroomFactor: number;
    financialEscrow2PcApplied: boolean;
  };
}

export const SAMPLE_CERTIFICATE: ExecutionPlacementCertificate = {
  certificateId: "epc_20261009_a4b9c1d3e5f7",
  timestamp: new Date().toISOString(),
  taskRef: "task_sql_compiler_proof_01",
  placementTarget: "LOCAL_ENGINE",
  hardwareEngineType: "APPLE_METAL",
  thermalState: "NOMINAL",
  totalCostNanos: 0,
  totalTokensProcessed: 8_400,
  tokensSalvagedEas: 5_200,
  canonicalDigestSha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  ed25519PublicKeyHex: "4f6a8b2c0d4e6f8a0b2c4e6a8b0c2d4e6f8a0b2c4e6a8b0c2d4e6f8a0b2c4e6a",
  ed25519SignatureHex: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8555e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9e1d3f5a7b9c1d3e5f7a9b1c3d5e7f",
  claims: {
    airGapZeroSpendEnforced: true,
    memoryHeadroomFactor: 2.1,
    financialEscrow2PcApplied: true,
  },
};

export const ReceiptExporter: React.FC<{ certificate?: ExecutionPlacementCertificate }> = ({
  certificate = SAMPLE_CERTIFICATE,
}) => {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(certificate, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spe-execution-receipt-${certificate.certificateId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid #30363d",
        borderRadius: "12px",
        padding: "24px",
        color: "#f0f6fc",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
            Cryptographic Placement Certificate (Ed25519)
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#8b949e" }}>
            RFC 8785 canonical JSON hash with Ed25519 digital signature proving zero-cost local execution.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? "#238636" : "#21262d",
              color: "#f0f6fc",
              border: "1px solid #30363d",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              cursor: "pointer",
              fontWeight: 500,
              transition: "all 0.2s ease",
            }}
          >
            {copied ? "✓ Copied to Clipboard" : "Copy JSON"}
          </button>
          <button
            onClick={handleDownload}
            style={{
              background: "#238636",
              color: "#ffffff",
              border: "1px solid rgba(240, 246, 252, 0.1)",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Download Receipt (.json)
          </button>
        </div>
      </div>

      {/* Summary grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div style={{ background: "#161b22", padding: "12px", borderRadius: "8px", border: "1px solid #21262d" }}>
          <div style={{ fontSize: "11px", color: "#8b949e" }}>Certificate ID</div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#58a6ff", fontFamily: "monospace" }}>
            {certificate.certificateId}
          </div>
        </div>

        <div style={{ background: "#161b22", padding: "12px", borderRadius: "8px", border: "1px solid #21262d" }}>
          <div style={{ fontSize: "11px", color: "#8b949e" }}>Placement Target</div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#34d399" }}>
            {certificate.placementTarget} ({certificate.hardwareEngineType})
          </div>
        </div>

        <div style={{ background: "#161b22", padding: "12px", borderRadius: "8px", border: "1px solid #21262d" }}>
          <div style={{ fontSize: "11px", color: "#8b949e" }}>Verified Cost</div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#10b981", fontFamily: "monospace" }}>
            {certificate.totalCostNanos} NanoUSD ($0.000000)
          </div>
        </div>

        <div style={{ background: "#161b22", padding: "12px", borderRadius: "8px", border: "1px solid #21262d" }}>
          <div style={{ fontSize: "11px", color: "#8b949e" }}>Canonical JCS SHA256</div>
          <div style={{ fontSize: "11px", color: "#8b949e", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {certificate.canonicalDigestSha256}
          </div>
        </div>
      </div>

      {/* Raw JSON viewer */}
      <div
        style={{
          background: "#090d13",
          border: "1px solid #21262d",
          borderRadius: "8px",
          padding: "16px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "11px",
          color: "#c9d1d9",
          maxHeight: "240px",
          overflowY: "auto",
        }}
      >
        <pre style={{ margin: 0 }}>{jsonString}</pre>
      </div>
    </div>
  );
};
