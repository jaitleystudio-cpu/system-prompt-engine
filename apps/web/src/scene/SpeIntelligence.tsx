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
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <mesh key={i} position={[0, 0, (i - 3) * 0.22]}>
          <torusGeometry
            args={[Math.sqrt(1.28 - (i - 3) * (i - 3) * 0.065), 0.018, 8, 96]}
          />
          <meshStandardMaterial
            metalness={0.8}
            roughness={0.16}
            color="#a9cbea"
            emissive="#3d608a"
            emissiveIntensity={0.22}
          />
        </mesh>
      ))}
      <group ref={rotor}>
        {[
          [-0.38, 0.75, 0.2],
          [0.9, -0.5, -0.55],
          [0.35, 0.35, 1.15],
        ].map((r, i) => (
          <group key={i} rotation={r as [number, number, number]}>
            <mesh scale={[1, 1, 0.34]}>
              <torusGeometry args={[1.43 + i * 0.17, 0.08, 12, 144]} />
              <meshPhysicalMaterial
                color={i === 1 ? "#647392" : "#818da5"}
                metalness={1}
                roughness={0.17}
                clearcoat={0.4}
                envMapIntensity={0.65}
              />
            </mesh>
            <mesh
              position={[1.43 + i * 0.17, 0, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.15, 0.15, 0.13, 32]} />
              <meshStandardMaterial
                color="#aebed5"
                metalness={1}
                roughness={0.2}
              />
            </mesh>
            <mesh scale={[1, 1, 0.4]}>
              <torusGeometry args={[1.44 + i * 0.17, 0.012, 8, 144]} />
              <meshBasicMaterial color={i === 1 ? "#afa1ff" : "#a4e1ff"} />
            </mesh>
          </group>
        ))}
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
