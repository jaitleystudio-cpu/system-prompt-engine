import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";

export interface CognitiveEnergyShaderProps {
  promptText?: string;
  force2DFallback?: boolean;
  width?: number | string;
  height?: number | string;
  onToggle2D?: (is2D: boolean) => void;
}

export interface CognitiveShaderMetrics {
  entropy: number; // 0.0 (ordered lattice) to 1.0 (turbulent plasma)
  rigor: number; // 0.0 (weak) to 1.0 (crystalline invariant lattice)
  tokenDensity: number; // 0.0 to 1.0
  healthScore: number; // 0 to 100
}

export const VERTEX_SHADER_SOURCE = `
uniform float u_time;
uniform float u_entropy;
uniform float u_rigor;
uniform float u_token_density;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vNormal = normal;
  vPosition = position;
  
  // Dynamic sinusoidal waves
  float wave = sin(position.x * 2.5 + u_time * 1.8) * cos(position.y * 2.5 + u_time * 1.4);
  // High entropy introduces turbulent chaotic noise
  float turbulence = sin(position.x * 10.0 + position.y * 8.0 + u_time * 3.0) * (u_entropy * 0.22);
  // High rigor introduces structured geometric lattice displacement
  float lattice = (sin(position.x * 6.0) * sin(position.y * 6.0) * sin(position.z * 6.0)) * (u_rigor * 0.16);
  
  vec3 newPosition = position + normal * (wave * 0.12 + turbulence + lattice);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

export const FRAGMENT_SHADER_SOURCE = `
uniform float u_time;
uniform float u_entropy;
uniform float u_rigor;
uniform vec2 u_resolution;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float dist = length(p);
  float pulse = sin(dist * 8.0 - u_time * 2.5) * 0.5 + 0.5;
  
  // Color palette:
  // Turbulent plasma = magenta/violet
  // Coherent quantum field = electric cyan
  // Hardened invariants = radiant emerald
  vec3 chaoticColor = vec3(0.92, 0.28, 0.60);
  vec3 coherentColor = vec3(0.22, 0.74, 0.97);
  vec3 emeraldColor = vec3(0.06, 0.72, 0.51);
  
  vec3 baseColor = mix(chaoticColor, coherentColor, u_rigor);
  baseColor = mix(baseColor, emeraldColor, pulse * 0.4 * u_rigor);
  
  // Rim / Fresnel lighting
  float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.2);
  vec3 finalColor = baseColor + vec3(fresnel * 0.75);
  
  gl_FragColor = vec4(finalColor, 0.88);
}
`;

export function calculateShaderMetrics(prompt = ""): CognitiveShaderMetrics {
  const text = prompt.trim();
  if (!text) {
    return { entropy: 0.8, rigor: 0.2, tokenDensity: 0.3, healthScore: 30 };
  }

  const hasRole = /#{1,4}[^\n]*(?:Role|Persona)|<role>/i.test(text);
  const hasObjective = /#{1,4}[^\n]*(?:Objective|Task)|<objective>/i.test(text);
  const hasInvariants = /#{1,4}[^\n]*(?:Invariant|Defense)|<invariants>/i.test(text);
  const hasChecks = /#{1,4}[^\n]*(?:Acceptance|Verification)|<acceptance_checks>/i.test(text);
  const hasGrounding = /Handling Missing Information|Grounding/i.test(text);

  let detectedRigor = 0.2;
  if (hasRole) detectedRigor += 0.16;
  if (hasObjective) detectedRigor += 0.16;
  if (hasInvariants) detectedRigor += 0.16;
  if (hasChecks) detectedRigor += 0.16;
  if (hasGrounding) detectedRigor += 0.16;

  const rigor = Math.min(1.0, detectedRigor);
  const entropy = Math.max(0.05, 1.0 - rigor);

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const tokenDensity = Math.min(1.0, Math.max(0.1, wordCount / 500));
  const healthScore = Math.round(rigor * 100);

  return { entropy, rigor, tokenDensity, healthScore };
}

export const CognitiveEnergyShader: React.FC<CognitiveEnergyShaderProps> = ({
  promptText = "",
  force2DFallback = false,
  width = "100%",
  height = 360,
  onToggle2D,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [is2DMode, setIs2DMode] = useState<boolean>(force2DFallback);
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);

  const metrics = useMemo(() => calculateShaderMetrics(promptText), [promptText]);

  // Check WebGL support on mount
  useEffect(() => {
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
      if (!gl) {
        setWebGlSupported(false);
        setIs2DMode(true);
      }
    } catch {
      setWebGlSupported(false);
      setIs2DMode(true);
    }
  }, []);

  // 3D WebGL Three.js Animation Loop
  useEffect(() => {
    if (is2DMode || !webGlSupported || !canvasRef.current) return;

    let animId: number;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 600;
    const h = rect.height || 360;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } catch {
      setWebGlSupported(false);
      setIs2DMode(true);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.z = 4.5;

    // Custom Shader Material
    const uniforms = {
      u_time: { value: 0.0 },
      u_entropy: { value: metrics.entropy },
      u_rigor: { value: metrics.rigor },
      u_token_density: { value: metrics.tokenDensity },
      u_resolution: { value: new THREE.Vector2(w, h) },
    };

    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER_SOURCE,
      fragmentShader: FRAGMENT_SHADER_SOURCE,
      uniforms,
      wireframe: metrics.rigor > 0.7,
      transparent: true,
      side: THREE.DoubleSide,
    });

    // Central Volumetric Icosahedron Core
    const geometry = new THREE.IcosahedronGeometry(1.4, 4);
    const coreMesh = new THREE.Mesh(geometry, shaderMaterial);
    scene.add(coreMesh);

    // Surrounding Particle Constellation
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const radius = 1.8 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: metrics.rigor > 0.6 ? 0x38bdf8 : 0xec4899,
      size: 0.04,
      transparent: true,
      opacity: 0.75,
    });
    const particlePoints = new THREE.Points(particleGeo, particleMat);
    scene.add(particlePoints);

    // Mouse Parallax Interaction
    let targetRotX = 0;
    let targetRotY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const bounds = canvas.getBoundingClientRect();
      const x = (e.clientX - bounds.left) / bounds.width - 0.5;
      const y = (e.clientY - bounds.top) / bounds.height - 0.5;
      targetRotY = x * 1.5;
      targetRotX = y * 1.5;
    };
    canvas.addEventListener("mousemove", handleMouseMove);

    const clock = new THREE.Clock();
    const render = () => {
      const delta = clock.getElapsedTime();
      uniforms.u_time.value = delta;
      uniforms.u_entropy.value = metrics.entropy;
      uniforms.u_rigor.value = metrics.rigor;

      coreMesh.rotation.y += 0.005;
      coreMesh.rotation.x += (targetRotX - coreMesh.rotation.x) * 0.05;
      coreMesh.rotation.y += (targetRotY - coreMesh.rotation.y) * 0.05;

      particlePoints.rotation.y -= 0.003;
      particlePoints.rotation.x += 0.001;

      renderer?.render(scene, camera);
      animId = requestAnimationFrame(render);
    };

    const handleResize = () => {
      if (!containerRef.current || !renderer) return;
      const r = containerRef.current.getBoundingClientRect();
      const currentW = r.width || 600;
      const currentH = r.height || 360;
      camera.aspect = currentW / currentH;
      camera.updateProjectionMatrix();
      renderer.setSize(currentW, currentH, false);
      uniforms.u_resolution.value.set(currentW, currentH);
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(containerRef.current);
    }

    render();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver?.disconnect();
      canvas.removeEventListener("mousemove", handleMouseMove);
      geometry.dispose();
      shaderMaterial.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer?.dispose();
    };
  }, [is2DMode, webGlSupported, metrics]);

  // 2D Accessible Canvas Fallback
  useEffect(() => {
    if (!is2DMode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const handle2DResize = () => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const cssW = r.width || 600;
      const cssH = r.height || 360;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    };
    handle2DResize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeObserver = new ResizeObserver(() => handle2DResize());
      resizeObserver.observe(containerRef.current);
    }

    const render2D = () => {
      time += 0.03;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const maxRadius = Math.min(w, h) * 0.38;

      // Draw harmonic energy contours
      const ringCount = 8;
      for (let r = 1; r <= ringCount; r++) {
        const radius = (r / ringCount) * maxRadius;
        ctx.beginPath();
        const segments = 60;
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const noise =
            Math.sin(angle * 4 + time * 1.5) * (metrics.entropy * 18) +
            Math.cos(angle * 8 + time * 2.0) * (metrics.rigor * 8);
          const currentR = radius + noise;
          const x = cx + Math.cos(angle) * currentR;
          const y = cy + Math.sin(angle) * currentR;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle =
          metrics.rigor > 0.6
            ? `rgba(56, 189, 248, ${0.15 + (r / ringCount) * 0.3})`
            : `rgba(236, 72, 153, ${0.15 + (r / ringCount) * 0.3})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw central energy nucleus
      ctx.beginPath();
      ctx.arc(cx, cy, 14 + Math.sin(time * 3) * 3, 0, Math.PI * 2);
      ctx.fillStyle = metrics.rigor > 0.6 ? "#10b981" : "#ec4899";
      ctx.shadowColor = metrics.rigor > 0.6 ? "#10b981" : "#ec4899";
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render2D);
    };

    render2D();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver?.disconnect();
    };
  }, [is2DMode, metrics]);

  return (
    <div
      ref={containerRef}
      className="cognitive-energy-shader-container"
      style={{
        position: "relative",
        width,
        height,
        borderRadius: "12px",
        overflow: "hidden",
        background: "radial-gradient(circle at center, #111827 0%, #030712 100%)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top telemetry bar */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "16px",
          right: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              padding: "0.2rem 0.5rem",
              borderRadius: "4px",
              background: "rgba(0, 0, 0, 0.6)",
              color: "#38bdf8",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              backdropFilter: "blur(6px)",
            }}
          >
            🌌 3D GLSL Quantum Energy Field
          </span>
          <span
            style={{
              fontSize: "0.65rem",
              padding: "0.2rem 0.45rem",
              borderRadius: "4px",
              background: metrics.rigor > 0.7 ? "rgba(16, 185, 129, 0.2)" : "rgba(236, 72, 153, 0.2)",
              color: metrics.rigor > 0.7 ? "#34d399" : "#f472b6",
              fontWeight: 600,
            }}
          >
            {metrics.rigor > 0.7 ? "Crystalline Lattice State" : "Turbulent Plasma State"}
          </span>
        </div>

        <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => {
              const next = !is2DMode;
              setIs2DMode(next);
              if (onToggle2D) onToggle2D(next);
            }}
            style={{
              fontSize: "0.65rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "6px",
              background: "rgba(0, 0, 0, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#e2e8f0",
              cursor: "pointer",
              backdropFilter: "blur(6px)",
            }}
          >
            {is2DMode ? "Switch to 3D WebGL" : "Switch to 2D Fallback"}
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        width={600}
        height={360}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: "grab",
        }}
      />

      {/* Bottom Metrics HUD */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "16px",
          right: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", gap: "0.8rem", fontSize: "0.65rem", color: "#94a3b8" }}>
          <span>
            Entropy: <strong style={{ color: "#ec4899" }}>{(metrics.entropy * 100).toFixed(0)}%</strong>
          </span>
          <span>
            Rigor: <strong style={{ color: "#10b981" }}>{(metrics.rigor * 100).toFixed(0)}%</strong>
          </span>
          <span>
            Attention Density: <strong style={{ color: "#38bdf8" }}>{(metrics.tokenDensity * 100).toFixed(0)}%</strong>
          </span>
        </div>
        <div style={{ fontSize: "0.65rem", color: "#64748b" }}>
          Interactive Parallax • 60 FPS GLSL
        </div>
      </div>
    </div>
  );
};
