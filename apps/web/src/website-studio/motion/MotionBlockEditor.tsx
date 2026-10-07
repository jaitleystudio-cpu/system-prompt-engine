import React, { useState } from "react";
import type { NarrativeMotionBlock } from "../model/motionBlock.ts";
import { expandMotionBlock } from "./expandMotionBlock.ts";
import { validateMotionBlock } from "../model/motionBlock.ts";

export interface MotionBlockEditorProps {
  blocks: NarrativeMotionBlock[];
  onBlocksChange?: (blocks: NarrativeMotionBlock[]) => void;
}

export const MotionBlockEditor: React.FC<MotionBlockEditorProps> = ({
  blocks,
  onBlocksChange,
}) => {
  const [viewMode, setViewMode] = useState<"narrative" | "tracks">("narrative");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    blocks[0]?.id || null,
  );
  const [error, setError] = useState<string | null>(null);

  const expandedTracks = blocks.flatMap((block) => expandMotionBlock(block));

  const handleAddBlock = () => {
    if (!onBlocksChange) return;
    const start = blocks.length === 0 ? 0 : Math.min(0.85, blocks[blocks.length - 1].end);
    const end = Math.min(1, start + 0.2);
    const block: NarrativeMotionBlock = {
      id: `block-${Date.now().toString(36)}`,
      semanticType: "product-reveal",
      start,
      end,
      tracks: {
        camera: [{ targetId: "camera", property: "position.z" }],
      },
      reducedMotionTransform: { mode: "static" },
      mobileTransform: { mode: "simplify" },
    };
    try {
      validateMotionBlock(block);
      const next = [...blocks, block];
      setError(null);
      setSelectedBlockId(block.id);
      onBlocksChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRemoveBlock = (id: string) => {
    if (!onBlocksChange) return;
    const next = blocks.filter((b) => b.id !== id);
    setSelectedBlockId(next[0]?.id ?? null);
    onBlocksChange(next);
  };

  return (
    <div
      className="motion-block-editor"
      style={{
        backgroundColor: "#12151e",
        borderTop: "1px solid #242938",
        padding: "16px",
        color: "#f4f5f8",
        fontSize: "13px",
      }}
      data-testid="motion-block-editor"
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
          <h4 style={{ margin: 0, fontSize: "14px" }}>Timeline & Narrative Motion Blocks</h4>
          <span style={{ fontSize: "11px", color: "#8e95a5" }}>
            {blocks.length} block{blocks.length === 1 ? "" : "s"} • {expandedTracks.length} active track
            {expandedTracks.length === 1 ? "" : "s"}
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button
            type="button"
            className={`studio-btn studio-btn-compact ${viewMode === "narrative" ? "studio-btn-primary" : ""}`}
            onClick={() => setViewMode("narrative")}
            style={{ fontSize: "12px" }}
          >
            Narrative Blocks
          </button>
          <button
            type="button"
            className={`studio-btn studio-btn-compact ${viewMode === "tracks" ? "studio-btn-primary" : ""}`}
            onClick={() => setViewMode("tracks")}
            style={{ fontSize: "12px" }}
          >
            Detailed Tracks
          </button>
          {onBlocksChange && (
            <button
              type="button"
              className="studio-btn studio-btn-compact studio-btn-primary"
              onClick={handleAddBlock}
              style={{ fontSize: "12px" }}
              aria-label="Add narrative motion block"
            >
              + Add Block
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: "#7f1d1d",
            color: "#fca5a5",
            padding: "8px 12px",
            borderRadius: "4px",
            marginBottom: "12px",
            fontSize: "12px",
          }}
        >
          {error}
        </div>
      )}

      {viewMode === "narrative" ? (
        <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "8px" }}>
          {blocks.length === 0 ? (
            <div style={{ color: "#71798e", padding: "16px 0" }}>
              No narrative motion blocks created yet.
            </div>
          ) : (
            blocks.map((block) => (
              <div
                key={block.id}
                onClick={() => setSelectedBlockId(block.id)}
                style={{
                  flex: "0 0 180px",
                  padding: "12px",
                  borderRadius: "6px",
                  backgroundColor: selectedBlockId === block.id ? "#1e3a8a" : "#1a1e2b",
                  border: selectedBlockId === block.id ? "1px solid #3b82f6" : "1px solid #282e3f",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: selectedBlockId === block.id ? "#93c5fd" : "#8e95a5",
                    letterSpacing: "0.04em",
                  }}
                >
                  {block.semanticType}
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, marginTop: "4px" }}>
                  {block.id}
                </div>
                <div style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "6px" }}>
                  {(block.start * 100).toFixed(0)}% → {(block.end * 100).toFixed(0)}%
                </div>
                {onBlocksChange && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveBlock(block.id);
                    }}
                    style={{
                      marginTop: "8px",
                      background: "none",
                      border: "none",
                      color: "#fca5a5",
                      fontSize: "11px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label={`Remove motion block ${block.id}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: "#0d0f15",
            borderRadius: "6px",
            border: "1px solid #232736",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {expandedTracks.length === 0 ? (
            <div style={{ color: "#71798e", fontSize: "12px" }}>No expanded keyframe tracks found.</div>
          ) : (
            expandedTracks.map((track, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  color: "#e2e8f0",
                  padding: "4px 8px",
                  backgroundColor: "#161922",
                  borderRadius: "4px",
                }}
              >
                <span>
                  <strong style={{ color: "#60a5fa" }}>{track.targetId}</strong>: {track.property}
                </span>
                <span style={{ color: "#8e95a5" }}>
                  {track.keyframes.length} keyframes (
                  {track.keyframes.map((k) => `${(k.at * 100).toFixed(0)}%`).join(" → ")})
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
