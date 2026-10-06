import React, { useState } from "react";
import type { NarrativeMotionBlock } from "../model/motionBlock.ts";
import { expandMotionBlock } from "./expandMotionBlock.ts";

export interface MotionBlockEditorProps {
  blocks: NarrativeMotionBlock[];
  onBlocksChange?: (blocks: NarrativeMotionBlock[]) => void;
}

export const MotionBlockEditor: React.FC<MotionBlockEditorProps> = ({
  blocks,
}) => {
  const [viewMode, setViewMode] = useState<"narrative" | "tracks">("narrative");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    blocks[0]?.id || null,
  );

  const expandedTracks = blocks.flatMap((block) => expandMotionBlock(block));

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
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            className={`studio-btn ${viewMode === "narrative" ? "studio-btn-primary" : ""}`}
            onClick={() => setViewMode("narrative")}
            style={{ padding: "4px 10px", fontSize: "12px", minHeight: "36px" }}
          >
            Narrative Blocks
          </button>
          <button
            type="button"
            className={`studio-btn ${viewMode === "tracks" ? "studio-btn-primary" : ""}`}
            onClick={() => setViewMode("tracks")}
            style={{ padding: "4px 10px", fontSize: "12px", minHeight: "36px" }}
          >
            Detailed Tracks
          </button>
        </div>
      </div>

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
