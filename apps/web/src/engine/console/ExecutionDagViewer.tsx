import React, { useState } from "react";

export interface DagNode {
  id: string;
  label: string;
  type: "LOCAL_ENGINE" | "CLOUD_GATEWAY" | "CHECKPOINT_EAS" | "FALLBACK_PCSC" | "OBLIGATION_GATE";
  targetEngine?: string;
  status: "VERIFIED" | "PENDING" | "SALVAGED" | "ESCRW_COMMITTED";
  costNanos: number;
  tokens: number;
  witnessHash?: string;
  description: string;
  dependencies: string[];
}

export const SAMPLE_DAG_NODES: DagNode[] = [
  {
    id: "node_0_intent",
    label: "ProtectedIntent Boundary",
    type: "OBLIGATION_GATE",
    status: "VERIFIED",
    costNanos: 0,
    tokens: 120,
    witnessHash: "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    description: "Immutable intent envelope and boundary predicate verification",
    dependencies: [],
  },
  {
    id: "node_1_device_prof",
    label: "Physical Device Profiling",
    type: "LOCAL_ENGINE",
    targetEngine: "Apple Silicon Metal (Unified Mem: 32GB)",
    status: "VERIFIED",
    costNanos: 0,
    tokens: 0,
    witnessHash: "sha256:9a04f2bb724e83c162cf5ef91de4ff3f3a88c7f3b89ec936d6a13d762e8a1bc7",
    description: "Thermal state: NOMINAL | Headroom: 2.1x | Placement: LOCAL_ENGINE",
    dependencies: ["node_0_intent"],
  },
  {
    id: "node_2_local_exec",
    label: "Local Synthesis (v0)",
    type: "LOCAL_ENGINE",
    targetEngine: "Metal On-Device (Llama-3-8B-Q4)",
    status: "VERIFIED",
    costNanos: 0,
    tokens: 4_200,
    witnessHash: "sha256:cb2e5f32a52b115663a8e94fa88d1f7c1d76fb5a828114efcf570ddb321a6a24",
    description: "Zero-cost local draft generation at 48.2 tok/sec",
    dependencies: ["node_1_device_prof"],
  },
  {
    id: "node_3_eas_checkpoint",
    label: "EAS Register Checkpoint (v0)",
    type: "CHECKPOINT_EAS",
    status: "SALVAGED",
    costNanos: 0,
    tokens: 4_200,
    witnessHash: "sha256:b1d84f04646734563a45c361957cf2ff5f899011704e6d4c1b92d6e3c5a6d9e1",
    description: "Immutable ESSA register cached in memory for sub-step compute salvage",
    dependencies: ["node_2_local_exec"],
  },
  {
    id: "node_4_cloud_escalation",
    label: "2PC Financial Escrow & Cloud",
    type: "CLOUD_GATEWAY",
    targetEngine: "Anthropic Claude 3.5 Sonnet",
    status: "ESCRW_COMMITTED",
    costNanos: 1_875_000, // 0.001875 USD
    tokens: 125,
    witnessHash: "sha256:3e4a2d8a5c1b9f7a0e2d4c6b8a1e3f5a7c9b1d3e5f7a9b1c3d5e7f9a1b3c5d7e",
    description: "High-reasoning frontier qualification step committed with strict 2PC reserve",
    dependencies: ["node_3_eas_checkpoint"],
  },
  {
    id: "node_5_pcsc_fallback",
    label: "PCSC Minimal Continuation Cut",
    type: "FALLBACK_PCSC",
    targetEngine: "Local Engine Rescue (C* <= 500 tok)",
    status: "VERIFIED",
    costNanos: 0,
    tokens: 68,
    witnessHash: "sha256:4d6e8f0a2c4e6a8b0c2d4e6f8a0b2c4e6a8b0c2d4e6f8a0b2c4e6a8b0c2d4e6f",
    description: "Proof-Carrying Semantic Continuation cut rescues state if cloud drops or rate-limits",
    dependencies: ["node_4_cloud_escalation"],
  },
];

export const ExecutionDagViewer: React.FC = () => {
  const [nodes] = useState<DagNode[]>(SAMPLE_DAG_NODES);
  const [selectedNode, setSelectedNode] = useState<DagNode | null>(SAMPLE_DAG_NODES[2]);

  const getNodeColor = (type: DagNode["type"]) => {
    switch (type) {
      case "LOCAL_ENGINE":
        return "#10b981"; // emerald
      case "CLOUD_GATEWAY":
        return "#f59e0b"; // amber
      case "CHECKPOINT_EAS":
        return "#3b82f6"; // blue
      case "FALLBACK_PCSC":
        return "#8b5cf6"; // purple
      case "OBLIGATION_GATE":
        return "#06b6d4"; // cyan
    }
  };

  const getNodeBadge = (type: DagNode["type"]) => {
    switch (type) {
      case "LOCAL_ENGINE":
        return "LOCAL (ZERO-COST)";
      case "CLOUD_GATEWAY":
        return "CLOUD (2PC ESCROW)";
      case "CHECKPOINT_EAS":
        return "EAS REGISTER";
      case "FALLBACK_PCSC":
        return "PCSC CUT";
      case "OBLIGATION_GATE":
        return "GOVERNANCE GATE";
    }
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
            Execution Placement & Witness Hypergraph DAG
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#8b949e" }}>
            Visualizes real-time execution placement across Local On-Device, EAS Checkpoints, and Cloud Escrow.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", fontSize: "12px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
            Local Engine ($0)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
            Cloud Escrow
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#8b5cf6" }} />
            PCSC Fallback
          </span>
        </div>
      </div>

      {/* DAG Flow Pipeline */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          overflowX: "auto",
          padding: "16px 8px",
          background: "#161b22",
          borderRadius: "8px",
          border: "1px solid #21262d",
          marginBottom: "20px",
          alignItems: "center",
        }}
      >
        {nodes.map((node, index) => {
          const isSelected = selectedNode?.id === node.id;
          const color = getNodeColor(node.type);

          return (
            <React.Fragment key={node.id}>
              <div
                onClick={() => setSelectedNode(node)}
                style={{
                  minWidth: "170px",
                  padding: "12px",
                  borderRadius: "8px",
                  background: isSelected ? "rgba(56, 139, 253, 0.15)" : "#0d1117",
                  border: isSelected ? `2px solid ${color}` : `1px solid #30363d`,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: isSelected ? `0 0 12px ${color}33` : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 700,
                      color,
                      letterSpacing: "0.5px",
                    }}
                  >
                    {getNodeBadge(node.type)}
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      background: node.status === "VERIFIED" ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)",
                      color: node.status === "VERIFIED" ? "#34d399" : "#fbbf24",
                      padding: "2px 4px",
                      borderRadius: "4px",
                    }}
                  >
                    {node.status}
                  </span>
                </div>

                <div style={{ fontSize: "13px", fontWeight: 600, color: "#f0f6fc", marginBottom: "4px" }}>
                  {node.label}
                </div>

                <div style={{ fontSize: "11px", color: "#8b949e", fontFamily: "monospace" }}>
                  {node.tokens > 0 ? `${node.tokens.toLocaleString()} tokens` : "0 tok"}
                  {node.costNanos === 0 ? " • $0.00" : ` • $${(node.costNanos / 1e9).toFixed(4)}`}
                </div>
              </div>

              {index < nodes.length - 1 && (
                <div style={{ color: "#484f58", fontSize: "16px", userSelect: "none" }}>
                  →
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Selected Node Detail Inspector */}
      {selectedNode && (
        <div
          style={{
            background: "#161b22",
            border: `1px solid ${getNodeColor(selectedNode.type)}44`,
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: getNodeColor(selectedNode.type),
                }}
              />
              <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>{selectedNode.label}</h4>
              <span style={{ fontSize: "11px", color: "#8b949e", fontFamily: "monospace" }}>({selectedNode.id})</span>
            </div>
            <span
              style={{
                fontSize: "12px",
                padding: "3px 8px",
                borderRadius: "6px",
                background: "rgba(16, 185, 129, 0.1)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.3)",
              }}
            >
              Cost: {selectedNode.costNanos === 0 ? "$0.0000 (Local Zero-Spend)" : `${selectedNode.costNanos} NanoUSD`}
            </span>
          </div>

          <p style={{ fontSize: "13px", color: "#c9d1d9", margin: "0 0 12px" }}>
            {selectedNode.description}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
            <div>
              <span style={{ color: "#8b949e" }}>Execution Engine: </span>
              <strong style={{ color: "#f0f6fc" }}>{selectedNode.targetEngine || "SPE Core Local Kernel"}</strong>
            </div>
            <div>
              <span style={{ color: "#8b949e" }}>Processed Tokens: </span>
              <strong style={{ color: "#f0f6fc", fontFamily: "monospace" }}>{selectedNode.tokens.toLocaleString()}</strong>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <span style={{ color: "#8b949e" }}>Cryptographic Witness: </span>
              <code style={{ fontSize: "11px", background: "#0d1117", padding: "2px 6px", borderRadius: "4px", color: "#58a6ff" }}>
                {selectedNode.witnessHash || "N/A"}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
