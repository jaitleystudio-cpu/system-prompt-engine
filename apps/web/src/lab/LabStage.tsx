import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import type { LabSpecimen } from "./specimens";

function SpecimenMesh({ specimen, reduced }: { specimen: LabSpecimen; reduced: boolean }) {
  const ref = useRef<Group>(null);
  const matColor = specimen.accent;
  useFrame((_, dt) => {
    if (reduced || !ref.current) return;
    if (specimen.interaction === "orbit" || specimen.interaction === "hover-explode") {
      ref.current.rotation.y += dt * 0.35;
      ref.current.rotation.x = Math.sin(performance.now() / 2200) * 0.15;
    } else if (specimen.interaction === "scroll-story") {
      ref.current.rotation.y += dt * 0.12;
    } else {
      ref.current.position.y = Math.sin(performance.now() / 1600) * 0.08;
    }
  });

  const geom = useMemo(() => specimen.shape, [specimen.shape]);

  return (
    <group ref={ref}>
      {geom === "torus" && (
        <mesh castShadow>
          <torusGeometry args={[1.1, 0.32, 32, 96]} />
          <meshStandardMaterial color={matColor} metalness={0.7} roughness={0.35} />
        </mesh>
      )}
      {geom === "icosa" && (
        <mesh castShadow>
          <icosahedronGeometry args={[1.25, 0]} />
          <meshStandardMaterial color={matColor} metalness={0.2} roughness={0.25} />
        </mesh>
      )}
      {geom === "ribbon" && (
        <mesh rotation={[0.4, 0.2, 0.1]} castShadow>
          <boxGeometry args={[2.4, 0.12, 0.8]} />
          <meshStandardMaterial color={matColor} metalness={0.1} roughness={0.5} />
        </mesh>
      )}
      {geom === "pillars" &&
        [-1.2, -0.4, 0.4, 1.2].map((x, i) => (
          <mesh key={i} position={[x, 0.6 + i * 0.08, 0]} castShadow>
            <boxGeometry args={[0.35, 1.4 + i * 0.15, 0.35]} />
            <meshStandardMaterial color={matColor} metalness={0.05} roughness={0.7} />
          </mesh>
        ))}
      {geom === "orb-field" &&
        [
          [0, 0, 0],
          [1.1, 0.4, -0.3],
          [-1.0, -0.2, 0.4],
          [0.3, 0.9, 0.6],
          [-0.5, 0.6, -0.7],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]} castShadow>
            <sphereGeometry args={[0.28 + (i % 3) * 0.06, 24, 24]} />
            <meshStandardMaterial
              color={matColor}
              emissive={matColor}
              emissiveIntensity={0.15}
              metalness={0.2}
              roughness={0.3}
            />
          </mesh>
        ))}
      {geom === "modules" &&
        [
          [-0.9, 0.2, 0],
          [0, 0.35, 0.2],
          [0.9, 0.15, -0.15],
          [-0.3, -0.4, 0.25],
          [0.45, -0.35, -0.2],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]} castShadow>
            <boxGeometry args={[0.55, 0.35, 0.55]} />
            <meshStandardMaterial color={matColor} metalness={0.05} roughness={0.55} />
          </mesh>
        ))}
      {geom === "slabs" &&
        [-0.85, 0, 0.85].map((x, i) => (
          <mesh key={i} position={[x, 0.35 + i * 0.12, 0]} castShadow>
            <boxGeometry args={[0.7, 1.1 + i * 0.1, 0.12]} />
            <meshStandardMaterial color={matColor} metalness={0.15} roughness={0.65} />
          </mesh>
        ))}
      {geom === "folds" &&
        [-0.7, 0, 0.7].map((x, i) => (
          <mesh key={i} position={[x, 0.1, i * 0.15]} rotation={[0.2, 0.4 * i, 0.15]} castShadow>
            <boxGeometry args={[1.1, 0.04, 1.4]} />
            <meshStandardMaterial color={matColor} metalness={0.02} roughness={0.85} />
          </mesh>
        ))}
      {geom === "table" && (
        <group>
          <mesh position={[0, -0.2, 0]} castShadow>
            <boxGeometry args={[2.2, 0.08, 1.2]} />
            <meshStandardMaterial color={matColor} metalness={0.05} roughness={0.75} />
          </mesh>
          {[
            [-0.9, -0.7, -0.45],
            [0.9, -0.7, -0.45],
            [-0.9, -0.7, 0.45],
            [0.9, -0.7, 0.45],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 0.9, 12]} />
              <meshStandardMaterial color={matColor} metalness={0.1} roughness={0.7} />
            </mesh>
          ))}
          <mesh position={[-0.5, 0.05, 0.1]} castShadow>
            <boxGeometry args={[0.35, 0.12, 0.5]} />
            <meshStandardMaterial color={matColor} metalness={0.2} roughness={0.4} />
          </mesh>
          <mesh position={[0.45, 0.08, -0.15]} castShadow>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial color={matColor} metalness={0.3} roughness={0.35} />
          </mesh>
        </group>
      )}
      {geom === "helix" &&
        Array.from({ length: 12 }, (_, i) => {
          const t = i / 12;
          const a = t * Math.PI * 4;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.9, t * 2 - 1, Math.sin(a) * 0.9]}
              castShadow
            >
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshStandardMaterial color={matColor} metalness={0.55} roughness={0.3} />
            </mesh>
          );
        })}
    </group>
  );
}

export function LabStage({ specimen }: { specimen: LabSpecimen }) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div className="spe-lab-stage" aria-label={`3D preview: ${specimen.title}`}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{
          fov: specimen.camera.fov,
          position: specimen.camera.position,
        }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#07090d"]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[4, 6, 2]} intensity={1.1} castShadow />
        <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#9ecbff" />
        <SpecimenMesh specimen={specimen} reduced={reduced} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.45, 0]} receiveShadow>
          <circleGeometry args={[3.2, 64]} />
          <meshStandardMaterial color="#10141c" metalness={0.1} roughness={0.9} />
        </mesh>
      </Canvas>
      <p className="spe-lab-stage-caption">
        {specimen.interaction} · {specimen.materials.primary} · {specimen.lighting.key}
        {reduced ? " · motion reduced" : ""}
      </p>
    </div>
  );
}

// silence unused Mesh import lint in some configs
void (0 as unknown as Mesh);
