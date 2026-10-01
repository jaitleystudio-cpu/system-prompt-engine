import { useEffect, useRef } from "react";
import type { SceneState } from "./SpeIntelligence";

interface Props {
  state: SceneState;
  progress?: number;
  className?: string;
  paused?: boolean;
}

const STAGE_COLORS = ["#d8edff", "#9eacff", "#86dbc9", "#e4b981"] as const;

function getStageIndex(state: SceneState): number {
  switch (state) {
    case "READY":
    case "COMPILING":
      return 3;
    case "STRUCTURING":
      return 2;
    case "UNDERSTANDING":
      return 1;
    default:
      return 0;
  }
}

/**
 * Tier 2 Fallback: Canvas 2D Isometric Renderer
 * Executes when WebGL context creation fails or WebGL is disabled.
 * Zero external GPU shaders; uses standard HTML5 Canvas 2D API.
 */
export function IsometricCanvasFallback({
  state,
  progress = 0,
  className = "",
  paused = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;
    const stageIdx = getStageIndex(state);
    const activeColor = STAGE_COLORS[stageIdx];

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = () => {
      if (!ctx || !canvas) return;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Isometric projection origin (centered)
      const cx = width / 2;
      const cy = height / 2;

      // Draw isometric grid rings
      const rings = 4;
      for (let r = 1; r <= rings; r++) {
        const radiusX = r * 35;
        const radiusY = r * 18;

        ctx.beginPath();
        ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.strokeStyle = r - 1 <= stageIdx ? activeColor : "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = r - 1 === stageIdx ? 2 : 1;
        ctx.stroke();
      }

      // Draw animated node carriers unless paused or reduced motion
      const carriers = 12;
      for (let i = 0; i < carriers; i++) {
        const phase = (i / carriers) * Math.PI * 2;
        const currentAngle = prefersReducedMotion || paused ? phase : phase + t * 0.02;
        const ring = (i % (stageIdx + 1)) + 1;
        const rx = ring * 35;
        const ry = ring * 18;

        const x = cx + Math.cos(currentAngle) * rx;
        const y = cy + Math.sin(currentAngle) * ry;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = activeColor;
        ctx.shadowColor = activeColor;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Center core orb
      ctx.beginPath();
      ctx.arc(cx, cy, 14 + (progress * 4), 0, Math.PI * 2);
      ctx.fillStyle = activeColor;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1.0;

      if (!prefersReducedMotion && !paused) {
        t += 1;
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [state, progress, paused]);

  return (
    <div className={`spe-scene-isometric-fallback ${className}`} aria-hidden="true">
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        data-renderer="canvas2d"
        data-stage={state}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
