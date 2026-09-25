import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { StaticPress } from "./StaticPress";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { VisualQuality } from "./quality";
import { semanticGroups } from "./semantic";
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
  output?: unknown;
  paused?: boolean;
  progress?: number;
};
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <StaticPress /> : this.props.children;
  }
}
function Studio() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
      room.dispose();
    };
  }, [gl, scene]);
  return null;
}
/** Map compile scene → pipeline stage index (0 IDEA … 3 PROMPT). */
function stageIndex(state: SceneState): number {
  if (state === "READY" || state === "COMPILING") return 3;
  if (state === "STRUCTURING") return 2;
  if (state === "UNDERSTANDING") return 1;
  return 0;
}

const STAGE_COLORS = ["#d8edff", "#9eacff", "#86dbc9", "#e4b981"] as const;

/** Tiny carriers that travel ring→ring so the orb reads as IDEA→…→PROMPT process. */
function ProcessStream({ active }: { active: number }) {
  const group = useRef<THREE.Group>(null);
  const COUNT = 28;
  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        phase: (i / COUNT) * Math.PI * 2,
        speed: 0.35 + (i % 5) * 0.08,
        band: i % 4,
        size: 0.04 + (i % 3) * 0.014,
      })),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    for (let i = 0; i < COUNT; i++) {
      const child = g.children[i] as THREE.Mesh | undefined;
      if (!child) continue;
      const s = seeds[i];
      const lane = Math.min(s.band, Math.max(active, 0));
      const travel = ((t * s.speed + s.phase) % (Math.PI * 2)) / (Math.PI * 2);
      const stageT = (lane + travel) / 4;
      const radius = 0.62 + stageT * 1.65;
      const angle = s.phase + t * (0.12 + lane * 0.04);
      const z = Math.sin(t * 0.7 + s.phase) * 0.18 * (1 - stageT * 0.35);
      child.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
      const mat = child.material as THREE.MeshBasicMaterial;
      const nearActive = lane <= active;
      mat.opacity = nearActive ? 0.95 : 0.28;
      mat.color.set(STAGE_COLORS[Math.min(lane, 3)]);
      child.scale.setScalar(lane >= 3 ? 1.55 : nearActive ? 1.15 : 1);
    }
  });
  return (
    <group ref={group}>
      {seeds.map((s, i) => (
        <mesh key={i}>
          <sphereGeometry args={[s.size, 8, 8]} />
          <meshBasicMaterial
            color={STAGE_COLORS[s.band]}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function OpticalCore({
  state,
  output,
  progress = 0,
}: {
  state: SceneState;
  output?: unknown;
  progress?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const rotor = useRef<THREE.Group>(null);
  const { pointer } = useThree();
  const groups = useMemo(() => semanticGroups(output), [output]);
  const active = stageIndex(state);
  const nodes = useMemo(
    () =>
      groups
        .flatMap((g, type) => g.items.map((_, i) => ({ type, i })))
        .slice(0, 24),
    [groups],
  );
  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 3);
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        pointer.x * 0.16 + progress * 0.65,
        k,
      );
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        -0.12 - pointer.y * 0.1,
        k,
      );
    }
    if (rotor.current)
      rotor.current.rotation.z =
        clock.elapsedTime * (state === "COMPILING" ? 0.16 : 0.025);
  });
  return (
    <group ref={group} rotation={[-0.12, 0, 0]}>
      <mesh>
        <sphereGeometry args={[1.18, 64, 48]} />
        <meshPhysicalMaterial
          color="#2b4267"
          metalness={0}
          roughness={0.025}
          transmission={1}
          thickness={1.3}
          ior={1.45}
          clearcoat={0.3}
          envMapIntensity={0.45}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshBasicMaterial color="#d8f7ff" />
      </mesh>
      <pointLight color={STAGE_COLORS[active]} intensity={3 + active * 0.35} distance={4} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        // Map radial slices toward active process stage (inner=idea … outer=prompt).
        const sliceStage = Math.min(3, Math.floor((i / 6) * 4));
        const lit = sliceStage <= active;
        return (
          <mesh key={i} position={[0, 0, (i - 3) * 0.22]}>
            <torusGeometry
              args={[Math.sqrt(1.28 - (i - 3) * (i - 3) * 0.065), 0.018, 8, 96]}
            />
            <meshStandardMaterial
              metalness={0.8}
              roughness={0.16}
              color={lit ? STAGE_COLORS[sliceStage] : "#a9cbea"}
              emissive={lit ? STAGE_COLORS[sliceStage] : "#3d608a"}
              emissiveIntensity={
                sliceStage === active ? 0.85 : lit ? 0.4 : 0.18
              }
            />
          </mesh>
        );
      })}
      <group ref={rotor}>
        {[
          [-0.38, 0.75, 0.2],
          [0.9, -0.5, -0.55],
          [0.35, 0.35, 1.15],
        ].map((r, i) => {
          // Rings map MEANING → STRUCTURE → PROMPT (idea lives in the core).
          const ringStage = i + 1;
          const lit = ringStage <= active;
          const hot = ringStage === active;
          return (
            <group key={i} rotation={r as [number, number, number]}>
              <mesh scale={[1, 1, 0.34]}>
                <torusGeometry args={[1.43 + i * 0.17, 0.08, 12, 144]} />
                <meshPhysicalMaterial
                  color={lit ? STAGE_COLORS[ringStage] : i === 1 ? "#647392" : "#818da5"}
                  metalness={1}
                  roughness={hot ? 0.1 : 0.17}
                  clearcoat={0.4}
                  envMapIntensity={hot ? 1.1 : 0.65}
                  emissive={lit ? STAGE_COLORS[ringStage] : "#000000"}
                  emissiveIntensity={hot ? 0.55 : lit ? 0.22 : 0}
                />
              </mesh>
              <mesh
                position={[1.43 + i * 0.17, 0, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.15, 0.15, 0.13, 32]} />
                <meshStandardMaterial
                  color={hot ? STAGE_COLORS[ringStage] : "#aebed5"}
                  metalness={1}
                  roughness={0.2}
                  emissive={hot ? STAGE_COLORS[ringStage] : "#000000"}
                  emissiveIntensity={hot ? 0.7 : 0}
                />
              </mesh>
              <mesh scale={[1, 1, 0.4]}>
                <torusGeometry args={[1.44 + i * 0.17, 0.012, 8, 144]} />
                <meshBasicMaterial
                  color={hot ? STAGE_COLORS[ringStage] : i === 1 ? "#afa1ff" : "#a4e1ff"}
                />
              </mesh>
            </group>
          );
        })}
      </group>
      {nodes.map((n, i) => {
        const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
        const radius = n.type === 3 ? 2.13 : 1.93;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0.3]}
          >
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshBasicMaterial
              color={STAGE_COLORS[n.type]}
              transparent
              opacity={n.type === active ? 1 : 0.45}
            />
          </mesh>
        );
      })}
      <ProcessStream active={active} />
      {/* Input spark (idea enters) → output cluster (prompt exits) */}
      <mesh position={[-2.35, 0.15, 0.2]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial
          color={STAGE_COLORS[0]}
          transparent
          opacity={active === 0 ? 1 : 0.55}
        />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={`out-${i}`}
          position={[
            2.15 + (i % 2) * 0.18,
            -0.25 + Math.floor(i / 2) * 0.22,
            0.25,
          ]}
        >
          <boxGeometry args={[0.09, 0.05, 0.04]} />
          <meshBasicMaterial
            color={STAGE_COLORS[3]}
            transparent
            opacity={active >= 3 ? 0.95 : 0.3}
          />
        </mesh>
      ))}
    </group>
  );
}
export function SpeIntelligence({
  state,
  quality,
  className = "",
  output,
  paused = false,
  progress = 0,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const e = host.current;
    if (!e) return;
    let intersect = true;
    const update = () => setVisible(intersect && !document.hidden);
    const io = new IntersectionObserver(
      ([v]) => {
        intersect = v.isIntersecting;
        update();
      },
      { rootMargin: "80px" },
    );
    io.observe(e);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <div
      ref={host}
      className={`press-canvas ${className}`}
      aria-hidden="true"
      data-pipeline-stage={["idea", "meaning", "structure", "prompt"][stageIndex(state)]}
      data-renderer={quality === "LITE" || lost ? "static" : "webgl"}
    >
      {quality === "LITE" || lost ? (
        <StaticPress />
      ) : (
        <SceneBoundary>
          <Canvas
            frameloop={visible && !paused ? "always" : "demand"}
            dpr={quality === "HIGH" ? [1, 2] : 1}
            camera={{ position: [0, 0.15, 7.6], fov: 37 }}
            gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
            onCreated={({ gl, camera }) => {
              camera.lookAt(0, 0, 0);
              gl.domElement.addEventListener(
                "webglcontextlost",
                (e) => {
                  e.preventDefault();
                  setLost(true);
                },
                { once: true },
              );
            }}
          >
            <Studio />
            <ambientLight intensity={0.4} />
            <directionalLight
              position={[-4, 7, 5]}
              intensity={1.7}
              color="#dfeaff"
            />
            <pointLight position={[3, 2, -2]} intensity={25} color="#818dff" />
            <OpticalCore state={state} output={output} progress={progress} />
          </Canvas>
        </SceneBoundary>
      )}
    </div>
  );
}
