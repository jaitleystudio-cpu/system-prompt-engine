import React from "react";
import type { CameraPlan } from "../model/cameraPlan.ts";
import {
  createCameraPlanFromPreset,
  validateCameraSafety,
  type CameraPreset,
  type CameraSafetyFinding,
} from "./cameraDirector.ts";

export interface CameraDirectorPanelProps {
  currentPlan?: CameraPlan;
  onPlanChange?: (plan: CameraPlan) => void;
  onSelectPreset?: (preset: CameraPreset) => void;
  scene?: any;
}

const PRESETS: CameraPreset[] = [
  "Hero Reveal",
  "Luxury Orbit",
  "Product Inspection",
  "Dramatic Push-In",
  "Architectural Flythrough",
  "Macro Detail",
  "Exploded Assembly",
  "Story Journey",
];

export const CameraDirectorPanel: React.FC<CameraDirectorPanelProps> = ({
  currentPlan,
  onPlanChange,
  onSelectPreset,
  scene,
}) => {
  const handlePresetClick = (preset: CameraPreset) => {
    onSelectPreset?.(preset);
    if (onPlanChange) {
      const newPlan = createCameraPlanFromPreset(preset);
      onPlanChange(newPlan);
    }
  };

  const report = React.useMemo(() => {
    if (!currentPlan) return null;
    try {
      return validateCameraSafety(currentPlan, scene);
    } catch {
      return null;
    }
  }, [currentPlan, scene]);

  return (
    <div
      className="camera-director-panel"
      style={{
        backgroundColor: "#12151e",
        border: "1px solid #242938",
        borderRadius: "8px",
        padding: "16px",
        color: "#f4f5f8",
        fontSize: "13px",
      }}
      data-testid="camera-director-panel"
    >
      <div style={{ marginBottom: "12px" }}>
        <h4 style={{ margin: 0, fontSize: "14px" }}>Camera Director</h4>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#8e95a5" }}>
          Director-tested camera choreography with bounded velocity and reduced-motion variants.
        </p>
      </div>

      <div style={{ marginBottom: "14px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "#a1a1aa", marginBottom: "8px" }}>
          CINEMATIC PRESETS
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: "8px",
          }}
        >
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="studio-btn"
              onClick={() => handlePresetClick(preset)}
              style={{
                fontSize: "12px",
                padding: "8px 10px",
                justifyContent: "flex-start",
                textAlign: "left",
                minHeight: "44px",
              }}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {currentPlan && currentPlan.shots && (
        <div
          style={{
            backgroundColor: "#0d0f15",
            borderRadius: "6px",
            border: "1px solid #232736",
            padding: "12px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#60a5fa", marginBottom: "6px" }}>
            ACTIVE SHOTS ({currentPlan.shots.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {currentPlan.shots.map((shot) => {
              const shotFindings =
                report?.findings.filter((f: CameraSafetyFinding) => f.shotId === shot.id) || [];
              const hasCollision = shotFindings.some(
                (f: CameraSafetyFinding) => f.code === "CAMERA_INSIDE_MESH",
              );
              const hasClipping = shotFindings.some(
                (f: CameraSafetyFinding) =>
                  f.code === "CAMERA_CLIPPING_NEAR" || f.code === "CAMERA_CLIPPING_FAR",
              );
              return (
                <div
                  key={shot.id}
                  style={{
                    fontSize: "11px",
                    color: "#cbd5e1",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>
                      <strong>{shot.id}</strong> ({shot.intent})
                    </span>
                    {hasCollision && (
                      <span
                        data-testid="collision-indicator"
                        style={{
                          fontSize: "9px",
                          color: "#fca5a5",
                          backgroundColor: "#7f1d1d",
                          padding: "1px 4px",
                          borderRadius: "3px",
                          fontWeight: 600,
                        }}
                      >
                        Collision
                      </span>
                    )}
                    {hasClipping && (
                      <span
                        data-testid="clipping-indicator"
                        style={{
                          fontSize: "9px",
                          color: "#fcd34d",
                          backgroundColor: "#78350f",
                          padding: "1px 4px",
                          borderRadius: "3px",
                          fontWeight: 600,
                        }}
                      >
                        Clipping
                      </span>
                    )}
                    {!hasCollision && !hasClipping && (
                      <span
                        data-testid="clear-indicator"
                        style={{
                          fontSize: "9px",
                          color: "#6ee7b7",
                          backgroundColor: "#064e3b",
                          padding: "1px 4px",
                          borderRadius: "3px",
                          fontWeight: 600,
                        }}
                      >
                        Clear
                      </span>
                    )}
                  </div>
                  <span style={{ color: "#8e95a5" }}>
                    {(shot.start * 100).toFixed(0)}%–{(shot.end * 100).toFixed(0)}% • FOV {shot.fov}°
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
