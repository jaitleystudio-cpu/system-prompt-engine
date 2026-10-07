import React from "react";
import type { SceneIR } from "../model/sceneIR.ts";
import {
  measureSceneStatic,
  type ScenePerformanceReceipt,
} from "./measureScene.ts";

export interface PerformanceDoctorProps {
  receipt?: ScenePerformanceReceipt;
  scene?: SceneIR;
  onOptimize?: () => void;
}

export const PerformanceDoctor: React.FC<PerformanceDoctorProps> = ({
  receipt: providedReceipt,
  scene,
  onOptimize,
}) => {
  const receipt: ScenePerformanceReceipt =
    providedReceipt ||
    (scene
      ? measureSceneStatic(scene)
      : {
          triangles: 0,
          drawCalls: 0,
          textureBytes: 0,
          geometryBytes: 0,
          materials: 0,
          lights: 0,
          particles: 0,
          webglContexts: 0,
          frameMeasurementState: "UNKNOWN",
          findings: [],
        });

  const getTier = (triangles: number, drawCalls: number) => {
    if (triangles <= 10000 && drawCalls <= 30) return { label: "TIER A", color: "#10b981" };
    if (triangles <= 35000 && drawCalls <= 60) return { label: "TIER B", color: "#f59e0b" };
    return { label: "TIER C", color: "#ef4444" };
  };

  const tier = getTier(receipt.triangles, receipt.drawCalls);

  return (
    <div
      className="performance-doctor"
      style={{
        backgroundColor: "#12151e",
        border: "1px solid #242938",
        borderRadius: "8px",
        padding: "16px",
        color: "#f4f5f8",
        fontSize: "13px",
      }}
      data-testid="performance-doctor"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: "14px" }}>Scene Performance Doctor</h4>
          <span style={{ fontSize: "11px", color: "#8e95a5" }}>
            State: {receipt.frameMeasurementState}
            {receipt.frameMeasurementState !== "MEASURED"
              ? " (lab or estimate only — field vitals unknown)"
              : " (browser harness verified)"}
          </span>
        </div>
        <span
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            color: tier.color,
            border: `1px solid ${tier.color}`,
            borderRadius: "4px",
            padding: "2px 8px",
            fontSize: "11px",
            fontWeight: 700,
          }}
        >
          {tier.label}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div style={{ backgroundColor: "#1a1e2b", padding: "10px", borderRadius: "6px" }}>
          <div style={{ fontSize: "11px", color: "#8e95a5" }}>Triangles</div>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>
            {receipt.triangles.toLocaleString()}
          </div>
        </div>
        <div style={{ backgroundColor: "#1a1e2b", padding: "10px", borderRadius: "6px" }}>
          <div style={{ fontSize: "11px", color: "#8e95a5" }}>Draw Calls</div>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>{receipt.drawCalls}</div>
        </div>
        <div style={{ backgroundColor: "#1a1e2b", padding: "10px", borderRadius: "6px" }}>
          <div style={{ fontSize: "11px", color: "#8e95a5" }}>Geometry Memory</div>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>
            {(receipt.geometryBytes / 1024).toFixed(1)} KB
          </div>
        </div>
        <div style={{ backgroundColor: "#1a1e2b", padding: "10px", borderRadius: "6px" }}>
          <div style={{ fontSize: "11px", color: "#8e95a5" }}>Active Lights</div>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>{receipt.lights}</div>
        </div>
        <div style={{ backgroundColor: "#1a1e2b", padding: "10px", borderRadius: "6px" }}>
          <div style={{ fontSize: "11px", color: "#8e95a5" }}>Desktop frame p95</div>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>
            {receipt.desktopFrameP95 != null
              ? `${receipt.desktopFrameP95.toFixed(1)} ms`
              : "UNKNOWN"}
          </div>
        </div>
        <div style={{ backgroundColor: "#1a1e2b", padding: "10px", borderRadius: "6px" }}>
          <div style={{ fontSize: "11px", color: "#8e95a5" }}>Mobile frame p95</div>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>
            {receipt.mobileFrameP95 != null
              ? `${receipt.mobileFrameP95.toFixed(1)} ms`
              : "UNKNOWN"}
          </div>
        </div>
      </div>

      {receipt.findings.length > 0 && (
        <div
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "6px",
            padding: "10px",
            marginBottom: "12px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#f87171", marginBottom: "4px" }}>
            DETECTED ISSUES ({receipt.findings.length}):
          </div>
          {receipt.findings.map((f, i) => (
            <div key={i} style={{ fontSize: "11px", color: "#fca5a5" }}>
              • {f}
            </div>
          ))}
        </div>
      )}

      {onOptimize && (
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={onOptimize}
          style={{ width: "100%" }}
        >
          Apply Non-Destructive Optimizations
        </button>
      )}
    </div>
  );
};
