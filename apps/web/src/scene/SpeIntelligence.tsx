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

const STATE_TINT: Record<SceneState, [string, string]> = {
  IDLE: ["#3db8ff", "#7eb8c9"],
  LISTENING: ["#5ec8ff", "#ff9a3c"],
  UNDERSTANDING: ["#3db8ff", "#e2c89a"],
  STRUCTURING: ["#7eb8c9", "#ff9a3c"],
  COMPILING: ["#ff9a3c", "#3db8ff"],
  READY: ["#6fbf9a", "#3db8ff"],
};

const SEMANTIC_LABELS = ["FACTS", "CONSTRAINTS", "POSSIBILITIES", "UNCERTAINTY"] as const;

function IntentCoreMesh({ state, quality }: { state: SceneState; quality: VisualQuality }) {
  const group = useRef<THREE.Group>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const ringC = useRef<THREE.Mesh>(null);
  const [c0, c1] = STATE_TINT[state];
  const colorA = useMemo(() => new THREE.Color(c0), [c0]);
  const colorB = useMemo(() => new THREE.Color(c1), [c1]);

  const shardCount = quality === "HIGH" ? 14 : 8;
  const shards = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    for (let i = 0; i < shardCount; i++) {
      const a = (i / shardCount) * Math.PI * 2;
      const r = 1.55 + (i % 3) * 0.22;
      arr.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a * 1.7) * 0.55, Math.sin(a) * r * 0.85));
    }
    return arr;
  }, [shardCount]);

  const lineGeom = useMemo(() => {
    const positions: number[] = [];
    for (const p of shards) positions.push(0, 0, 0, p.x, p.y, p.z);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [shards]);

  useFrame((_, dt) => {
    if (!group.current) return;
    const speed =
      state === "COMPILING" ? 1.05 : state === "READY" ? 0.22 : state === "IDLE" ? 0.14 : 0.48;
    group.current.rotation.y += dt * speed;
    if (ringA.current) ringA.current.rotation.z += dt * 0.42;
    if (ringB.current) ringB.current.rotation.x -= dt * 0.31;
    if (ringC.current) ringC.current.rotation.y += dt * 0.25;
  });

  return (
    <group ref={group} position={[0, 0.1, 0]}>
      {/* Crystal intent nucleus */}
      <mesh>
        <octahedronGeometry args={[0.48, 0]} />
        <meshStandardMaterial
          color={colorA}
          emissive={colorA}
          emissiveIntensity={0.85}
          metalness={0.75}
          roughness={0.18}
          transparent
          opacity={0.95}
        />
      </mesh>
      <mesh rotation={[0, Math.PI / 4, 0]} scale={0.72}>
        <octahedronGeometry args={[0.48, 0]} />
        <meshStandardMaterial
          color={colorB}
          emissive={colorB}
          emissiveIntensity={0.45}
          metalness={0.6}
          roughness={0.25}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* Concentric engine rings */}
      <mesh ref={ringA} rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[1.15, 0.018, 10, 128]} />
        <meshStandardMaterial color="#9eb0c4" metalness={0.9} roughness={0.25} emissive="#3db8ff" emissiveIntensity={0.25} />
      </mesh>
      <mesh ref={ringB} rotation={[0.55, 0.35, 0.2]}>
        <torusGeometry args={[1.45, 0.012, 10, 128]} />
        <meshStandardMaterial color="#c9d0da" metalness={0.85} roughness={0.3} emissive="#ff9a3c" emissiveIntensity={0.18} />
      </mesh>
      <mesh ref={ringC} rotation={[1.1, -0.2, 0.6]}>
        <torusGeometry args={[1.75, 0.008, 8, 96]} />
        <meshBasicMaterial color="#3db8ff" transparent opacity={0.35} />
      </mesh>

      <lineSegments geometry={lineGeom}>
        <lineBasicMaterial color="#9ec9e8" transparent opacity={0.28} />
      </lineSegments>

      {shards.map((p, i) => (
        <mesh key={i} position={p} rotation={[i * 0.3, i * 0.5, 0]}>
          <octahedronGeometry args={[0.055 + (i % 3) * 0.02, 0]} />
          <meshStandardMaterial
            color={i % 2 ? "#ff9a3c" : "#3db8ff"}
            emissive={i % 2 ? "#ff9a3c" : "#3db8ff"}
            emissiveIntensity={0.8}
            metalness={0.7}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Living SPE Intent Core — states map to product compile phases. */
export function SpeIntelligence({ state, quality, className = "" }: Props) {
  const labels = (
    <ul className="spe-core-labels" aria-hidden="true" data-state={state}>
      {SEMANTIC_LABELS.map((label) => (
        <li key={label} data-label={label}>
          {label}
        </li>
      ))}
    </ul>
  );

  if (quality === "LITE") {
    return (
      <div className={`spe-intel-fallback ${className}`} data-state={state} aria-hidden="true">
        <div className="spe-intel-pedestal" />
        <div className="spe-intel-core spe-intel-crystal" />
        <div className="spe-intel-ring r1" />
        <div className="spe-intel-ring r2" />
        <div className="spe-intel-ring r3" />
        <div className="spe-intel-orbit o1" />
        <div className="spe-intel-orbit o2" />
        <div className="spe-intel-orbit o3" />
        {labels}
      </div>
    );
  }

  const dpr = quality === "HIGH" ? ([1, 1.75] as [number, number]) : ([1, 1.25] as [number, number]);

  return (
    <div className={`spe-intel-canvas ${className}`} aria-hidden="true" data-state={state}>
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0.55, 4.4], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#00000000"]} />
        <ambientLight intensity={0.28} />
        <pointLight position={[3.2, 2.4, 4]} intensity={1.35} color="#3db8ff" />
        <pointLight position={[-3.2, -0.6, -2]} intensity={1.05} color="#ff9a3c" />
        <spotLight position={[0, 4, 2]} intensity={0.55} color="#dfe6ef" angle={0.5} penumbra={0.6} />
        <IntentCoreMesh state={state} quality={quality} />
      </Canvas>
      {labels}
      <p className="spe-core-caption">Intent Core · human intent → structured intelligence</p>
    </div>
  );
}
