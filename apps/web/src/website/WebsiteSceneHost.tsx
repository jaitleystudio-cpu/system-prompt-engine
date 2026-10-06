import { useEffect, useRef, useState } from "react";
import {
  mountBundledScene,
  WEBSITE_SCENE_IR,
  type SceneExecutionReport,
  type SceneMountHandle,
} from "../engine/multimodal/sceneRuntime.ts";

declare global {
  interface Window {
    __SPE_SCENE_HANDLE?: SceneMountHandle;
  }
}

export function WebsiteSceneHost() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<SceneExecutionReport | null>(null);
  const [mounted, setMounted] = useState(true);
  const [disposeLabel, setDisposeLabel] = useState("pending");

  useEffect(() => {
    if (!mounted) return;
    const node = hostRef.current;
    if (!node) return;
    const activeIr = (window as any).__SPE_TEST_SCENE_IR || WEBSITE_SCENE_IR;
    const handle = mountBundledScene(node, activeIr);
    window.__SPE_SCENE_HANDLE = handle;
    (window as any).__SPE_REMOUNT_SCENE = () => {
      setMounted(false);
      setTimeout(() => setMounted(true), 50);
    };
    setReport({ ...handle.report });
    return () => {
      try {
        handle.dispose();
      } catch {
        /* cleanup must not surface */
      }
    };
  }, [mounted]);

  function unmountScene() {
    const handle = window.__SPE_SCENE_HANDLE;
    try {
      handle?.dispose();
      setDisposeLabel(handle?.report.disposeThrew ? `threw:${handle.report.disposeThrew}` : "ok");
      if (handle) setReport({ ...handle.report });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDisposeLabel(`threw:${message}`);
    }
    setMounted(false);
  }

  const execution = report?.webglExecution ?? "NOT_RUN";
  const fallback = report?.fallbackShown === true;
  return (
    <div
      className="website-scene"
      data-scene-settled={report ? "1" : "0"}
      data-webgl-execution={execution}
      data-three-version={report?.threeVersion ?? ""}
      data-three-revision={report?.threeRevision ?? ""}
      data-context-created={report?.contextCreated ? "1" : "0"}
      data-scene-created={report?.sceneCreated ? "1" : "0"}
      data-non-clear-pixels={String(report?.nonClearPixels ?? 0)}
      data-sampled-pixels={String(report?.sampledPixels ?? 0)}
      data-reduced-motion={report?.reducedMotion ? "1" : "0"}
      data-fallback-shown={fallback ? "1" : "0"}
      data-unavailable-honest={report?.unavailableHonest ? "1" : "0"}
      data-dispose={disposeLabel}
      data-bundling={report?.bundling ?? ""}
      data-frame-note={report?.note ?? ""}
    >
      <h2>Scene</h2>
      {mounted ? <div ref={hostRef} className="website-scene-canvas" /> : null}
      {fallback ? (
        <div className="website-scene-fallback">
          <p>{WEBSITE_SCENE_IR.accessibilityFallback.textDescription}</p>
        </div>
      ) : null}
      <p className="website-scene-status">
        WebGL {execution}. Three {report?.threeVersion || "not executed"} bundled as{" "}
        {report?.bundling || "not executed"}. Non-clear pixels {report?.nonClearPixels ?? 0}.
      </p>
      <button type="button" onClick={unmountScene}>
        Unmount scene
      </button>
    </div>
  );
}
