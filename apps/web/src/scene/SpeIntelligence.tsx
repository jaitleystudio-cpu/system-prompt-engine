import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type MutableRefObject,
} from "react";
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

const FILAMENTS = [
  { name: "GOAL", color: "#c59a5c", y: 1.35, radius: 0.055 },
  { name: "CONSTRAINT", color: "#b85d43", y: 0.82, radius: 0.08 },
  { name: "CONTEXT", color: "#63806a", y: 0.3, radius: 0.05 },
  { name: "UNKNOWN", color: "#8c9691", y: -0.28, radius: 0.038 },
  { name: "PREFERENCE", color: "#a7786b", y: -0.86, radius: 0.052 },
  { name: "OUTPUT", color: "#d7d0be", y: -1.38, radius: 0.06 },
] as const;

const STATE_ENERGY: Record<SceneState, number> = {
  IDLE: 0.16,
  LISTENING: 0.28,
  UNDERSTANDING: 0.52,
  STRUCTURING: 0.68,
  COMPILING: 1,
  READY: 0.38,
};

function Gate({ x, height, depth = 0 }: { x: number; height: number; depth?: number }) {
  const material = (
    <meshStandardMaterial color="#373a36" metalness={0.86} roughness={0.3} />
  );
  return (
    <group position={[x, 0, depth]}>
      <mesh position={[0, height / 2 + 0.18, 0]}>
        <boxGeometry args={[0.18, height, 0.42]} />
        {material}
      </mesh>
      <mesh position={[0, -height / 2 - 0.18, 0]}>
        <boxGeometry args={[0.18, height, 0.42]} />
        {material}
      </mesh>
      <mesh>
        <boxGeometry args={[0.2, 0.26, 3.9]} />
        {material}
      </mesh>
    </group>
  );
}

function SemanticFilament({
  index,
  quality,
}: {
  index: number;
  quality: VisualQuality;
}) {
  const spec = FILAMENTS[index];
  const curve = useMemo(() => {
    const unknownGap = spec.name === "UNKNOWN" ? 0.4 : 0;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.1, 0, (index - 2.5) * 0.12),
      new THREE.Vector3(-1.8, spec.y, index % 2 ? 0.32 : -0.24),
      new THREE.Vector3(-0.2 - unknownGap, spec.y * 0.86, 0),
      new THREE.Vector3(1.7 + unknownGap, spec.y * 0.58, index % 2 ? -0.2 : 0.18),
      new THREE.Vector3(3.7, spec.y * 0.22, 0),
      new THREE.Vector3(5.1, 0, 0),
    ]);
  }, [index, spec.name, spec.y]);

  return (
    <mesh>
      <tubeGeometry
        args={[curve, quality === "CINEMATIC" ? 96 : 48, spec.radius, 6, false]}
      />
      <meshStandardMaterial
        color={spec.color}
        emissive={spec.color}
        emissiveIntensity={0.32}
        metalness={spec.name === "OUTPUT" ? 0.38 : 0.14}
        roughness={0.46}
      />
    </mesh>
  );
}

function ForgeWorld({
  state,
  quality,
  pointer,
}: {
  state: SceneState;
  quality: VisualQuality;
  pointer: MutableRefObject<{ x: number; y: number }>;
}) {
  const world = useRef<THREE.Group>(null);
  const strategy = useRef<THREE.Mesh>(null);
  const artifact = useRef<THREE.Group>(null);

  useFrame(({ camera, clock }, delta) => {
    const page = document.documentElement;
    const scrollRange = Math.max(1, page.scrollHeight - window.innerHeight);
    const progress = THREE.MathUtils.clamp(window.scrollY / scrollRange, 0, 1);
    const targetX = THREE.MathUtils.lerp(-6.6, 8.8, progress);
    const pointerScale = window.matchMedia("(pointer: coarse)").matches ? 0 : 1;
    const targetY =
      0.34 + Math.sin(progress * Math.PI * 3) * 0.28 + pointer.current.y * 0.24 * pointerScale;
    const targetZ = 6.4 + Math.sin(progress * Math.PI) * 0.8;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX + pointer.current.x * 0.3, 3.4, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 3.4, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.4, delta);
    camera.lookAt(targetX + 1.15, 0, 0);

    const energy = STATE_ENERGY[state];
    if (strategy.current) {
      const pulse = state === "COMPILING" ? Math.sin(clock.elapsedTime * 5.2) * 0.12 : 0;
      strategy.current.scale.y = 1 + energy * 0.18 + pulse;
    }
    if (artifact.current) {
      artifact.current.rotation.x = Math.sin(clock.elapsedTime * 0.22) * 0.035;
      artifact.current.position.y = Math.sin(clock.elapsedTime * 0.33) * 0.035;
    }
    if (world.current) {
      world.current.rotation.z = THREE.MathUtils.damp(
        world.current.rotation.z,
        pointer.current.x * 0.012 * pointerScale,
        2.6,
        delta,
      );
    }
  });

  return (
    <group ref={world} rotation={[-0.08, -0.12, -0.04]}>
      <mesh position={[-5.2, 0, 0]} scale={[3.5, 0.68, 0.62]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#151713" metalness={0.24} roughness={0.84} />
      </mesh>
      <mesh position={[-4.7, 0.24, 0.37]} rotation={[0.1, 0, -0.035]} scale={[2.4, 0.055, 0.08]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#777b74" metalness={0.6} roughness={0.44} />
      </mesh>

      {FILAMENTS.map((_, index) => (
        <SemanticFilament key={index} index={index} quality={quality} />
      ))}

      <Gate x={-1.2} height={2.75} />
      <Gate x={0.75} height={2.4} depth={0.08} />
      <Gate x={2.65} height={2.08} depth={-0.08} />

      <mesh ref={strategy} position={[3.2, 0, -0.28]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.13, 5.2, 0.13]} />
        <meshStandardMaterial
          color="#b98a4e"
          emissive="#8d6337"
          emissiveIntensity={STATE_ENERGY[state]}
          metalness={0.84}
          roughness={0.2}
        />
      </mesh>

      <group ref={artifact} position={[5.8, 0, 0]}>
        {[-0.42, 0, 0.42].map((z, index) => (
          <mesh key={z} position={[index * 0.16, 0, z]} rotation={[0, index * 0.04 - 0.04, 0]}>
            <boxGeometry args={[1.7, 3.65 - index * 0.18, 0.12]} />
            <meshStandardMaterial
              color={index === 1 ? "#e9e6de" : "#c8c4ba"}
              metalness={0.06}
              roughness={0.42}
            />
          </mesh>
        ))}
      </group>

      <group position={[8.45, 0, 0]} rotation={[0.05, -0.2, -0.08]}>
        {[0, 1, 2, 3, 4].map((index) => (
          <mesh key={index} position={[index * 0.13, index * 0.09, -index * 0.16]}>
            <boxGeometry args={[1.5, 2.7, 0.045]} />
            <meshStandardMaterial
              color={index === 4 ? "#e9e6de" : index % 2 ? "#777b74" : "#373a36"}
              metalness={index === 4 ? 0.06 : 0.42}
              roughness={0.5}
            />
          </mesh>
        ))}
      </group>

      <group position={[11.4, 0, 0]}>
        {[-1.9, -1.25, -0.6, 0, 0.6, 1.25, 1.9].map((y, index) => (
          <mesh key={y} position={[index % 2 ? 0.26 : -0.12, y, 0]}>
            <boxGeometry args={[1.08, 0.28, 0.65]} />
            <meshStandardMaterial
              color={index === 0 ? "#b98a4e" : "#373a36"}
              metalness={0.66}
              roughness={0.36}
            />
          </mesh>
        ))}
      </group>

      <mesh position={[0, -2.25, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.04, 20, 0.04]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#777b74" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

/** Persistent Semantic Forge world. Scroll controls camera acts; runtime state controls energy. */
export function SpeIntelligence({ state, quality, className = "" }: Props) {
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      pointer.current.y = -((event.clientY / Math.max(1, window.innerHeight)) * 2 - 1);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => window.removeEventListener("pointermove", onPointer);
  }, []);

  if (quality === "LITE") {
    return (
      <div
        className={`forge-lite-plate ${className}`}
        data-state={state}
        data-quality={quality}
        aria-hidden="true"
      >
        <div className="forge-lite-raw" />
        <div className="forge-lite-gates" />
        <div className="forge-lite-filaments">
          {FILAMENTS.map((filament) => (
            <i key={filament.name} style={{ "--filament": filament.color } as CSSProperties} />
          ))}
        </div>
        <div className="forge-lite-artifact" />
      </div>
    );
  }

  const dpr =
    quality === "CINEMATIC"
      ? ([1, 1.6] as [number, number])
      : ([0.8, 1.15] as [number, number]);

  return (
    <div
      className={`spe-intel-canvas ${className}`}
      aria-hidden="true"
      data-state={state}
      data-quality={quality}
    >
      <Canvas
        dpr={dpr}
        camera={{ position: [-6.6, 0.34, 6.4], fov: 39, near: 0.1, far: 80 }}
        gl={{
          antialias: quality === "CINEMATIC",
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#080908"]} />
        <ambientLight intensity={0.42} color="#c8c4ba" />
        <directionalLight position={[-5, 4, 5]} intensity={2.1} color="#e9e6de" />
        <pointLight position={[3, 2.5, 3]} intensity={2.4} color="#e1b978" distance={12} />
        <pointLight position={[-4, -1.5, 2]} intensity={1.2} color="#63806a" distance={10} />
        <spotLight
          position={[8, 5, 4]}
          intensity={2.1}
          color="#e9e6de"
          angle={0.38}
          penumbra={0.86}
        />
        <fog attach="fog" args={["#080908", 8, 26]} />
        <ForgeWorld state={state} quality={quality} pointer={pointer} />
      </Canvas>
    </div>
  );
}

export const ForgeScene = SpeIntelligence;
