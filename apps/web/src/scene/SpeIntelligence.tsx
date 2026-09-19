import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VisualQuality } from "./quality";

export type SceneState =
  | "IDLE"
  | "LISTENING"
  | "UNDERSTANDING"
  | "STRUCTURING"
  | "COMPILING"
  | "READY";

type Props = {
  state: SceneState;
  quality: VisualQuality;
  className?: string;
};

const STATE_COLOR: Record<SceneState, string> = {
  IDLE: "#7eb8c9",
  LISTENING: "#c4a574",
  UNDERSTANDING: "#e2c89a",
  STRUCTURING: "#7eb8c9",
  COMPILING: "#d9896a",
  READY: "#6fbf9a",
};

function SemanticCore({ state, quality }: { state: SceneState; quality: VisualQuality }) {
  const group = useRef<THREE.Group>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color(STATE_COLOR[state]), [state]);
  const nodeCount = quality === "HIGH" ? 16 : 10;
  const nodes = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const a = (i / nodeCount) * Math.PI * 2;
      const r = 1.35 + (i % 3) * 0.18;
      arr.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a * 1.3) * 0.45, Math.sin(a) * r));
    }
    return arr;
  }, [nodeCount]);

  const lineGeom = useMemo(() => {
    const positions: number[] = [];
    for (const p of nodes) {
      positions.push(0, 0, 0, p.x, p.y, p.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [nodes]);

  useFrame((_, dt) => {
    if (!group.current) return;
    const speed =
      state === "COMPILING" ? 0.9 : state === "READY" ? 0.25 : state === "IDLE" ? 0.12 : 0.45;
    group.current.rotation.y += dt * speed;
    if (ringA.current) ringA.current.rotation.z += dt * 0.35;
    if (ringB.current) ringB.current.rotation.x -= dt * 0.28;
  });

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          metalness={0.55}
          roughness={0.25}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh ref={ringA} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.45, 0.012, 8, 96]} />
        <meshBasicMaterial color="#e2c89a" transparent opacity={0.55} />
      </mesh>
      <mesh ref={ringB} rotation={[0.4, 0.2, 0.5]}>
        <torusGeometry args={[1.75, 0.008, 8, 96]} />
        <meshBasicMaterial color="#7eb8c9" transparent opacity={0.35} />
      </mesh>
      <lineSegments geometry={lineGeom}>
        <lineBasicMaterial color="#c8c2b4" transparent opacity={0.2} />
      </lineSegments>
      {nodes.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.045 + (i % 3) * 0.012, 12, 12]} />
          <meshStandardMaterial
            color={i % 2 ? "#e2c89a" : "#7eb8c9"}
            emissive={i % 2 ? "#c4a574" : "#3d6f7d"}
            emissiveIntensity={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Living SPE intelligence object — states map to product phases. */
export function SpeIntelligence({ state, quality, className = "" }: Props) {
  if (quality === "LITE") {
    return (
      <div className={`spe-intel-fallback ${className}`} data-state={state} aria-hidden="true">
        <div className="spe-intel-core" />
        <div className="spe-intel-ring r1" />
        <div className="spe-intel-ring r2" />
        <div className="spe-intel-orbit o1" />
        <div className="spe-intel-orbit o2" />
        <div className="spe-intel-orbit o3" />
      </div>
    );
  }

  const dpr = quality === "HIGH" ? ([1, 1.75] as [number, number]) : ([1, 1.25] as [number, number]);

  return (
    <div className={`spe-intel-canvas ${className}`} aria-hidden="true">
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0.35, 4.2], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.35} />
        <pointLight position={[3, 2, 4]} intensity={1.2} color="#e2c89a" />
        <pointLight position={[-3, -1, -2]} intensity={0.8} color="#7eb8c9" />
        <SemanticCore state={state} quality={quality} />
      </Canvas>
    </div>
  );
}
