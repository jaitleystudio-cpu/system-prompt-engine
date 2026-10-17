import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Studio } from "../src/website-studio/Studio.tsx";
import { BehaviorGraphEditor } from "../src/website-studio/behavior/BehaviorGraphEditor.tsx";
import { MotionBlockEditor } from "../src/website-studio/motion/MotionBlockEditor.tsx";
import { CameraDirectorPanel } from "../src/website-studio/camera/CameraDirectorPanel.tsx";
import { PerformanceDoctor } from "../src/website-studio/performance/PerformanceDoctor.tsx";
import { DataBindingInspector } from "../src/website-studio/data/DataBindingInspector.tsx";
import { createDefaultWebsiteSpecV2 } from "../src/website-studio/model/websiteSpecV2.ts";
import { createCameraPlanFromPreset } from "../src/website-studio/camera/cameraDirector.ts";

declare global {
  interface Window {
    __studioSurface?: string;
    __studioReady?: boolean;
    __studioState?: any;
  }
}

function Harness() {
  const surface = window.__studioSurface || "all";
  const [spec, setSpec] = useState(() => {
    const s = createDefaultWebsiteSpecV2();
    s.dataBindings = [
      {
        id: "bind-local",
        source: { type: "LOCAL_CONSTANT", value: 10 },
        privacyBoundary: "LOCAL",
        variable: "localCount",
        consumers: [{ targetId: "hero", property: "count" }],
      },
      {
        id: "bind-public",
        source: { type: "PUBLIC_FETCH", url: "https://example.com/data.json" },
        privacyBoundary: "PUBLIC_FETCH",
        variable: "publicFeed",
        consumers: [{ targetId: "feed", property: "items" }],
      },
      {
        id: "bind-ext",
        source: { type: "EXTERNAL_PROVIDER", provider: "weather", resource: "current" },
        privacyBoundary: "EXTERNAL_PROVIDER",
        variable: "temperature",
        consumers: [{ targetId: "badge", property: "temp" }],
      },
    ];
    return s;
  });
  const [activePlan, setActivePlan] = useState(() => createCameraPlanFromPreset("Hero Reveal"));

  window.__studioState = { spec, activePlan };

  if (surface === "studio") {
    return <Studio initialSpec={spec} />;
  }

  return (
    <div style={{ padding: 20, background: "#090a0f", minHeight: "100vh" }}>
      {(surface === "all" || surface === "behavior") && (
        <section id="harness-behavior" style={{ marginBottom: 20 }}>
          <BehaviorGraphEditor
            graph={spec.behaviorGraph}
            onChange={(bg) => setSpec((s) => ({ ...s, behaviorGraph: bg }))}
          />
        </section>
      )}

      {(surface === "all" || surface === "motion") && (
        <section id="harness-motion" style={{ marginBottom: 20 }}>
          <MotionBlockEditor
            blocks={
              spec.motionBlocks.length > 0
                ? spec.motionBlocks
                : [
                    {
                      id: "reveal-block",
                      semanticType: "product-reveal",
                      start: 0,
                      end: 1,
                      tracks: { camera: [{ targetId: "camera", property: "position.z" }] },
                    },
                  ]
            }
            onBlocksChange={(blocks) => setSpec((s) => ({ ...s, motionBlocks: blocks }))}
          />
        </section>
      )}

      {(surface === "all" || surface === "camera") && (
        <section id="harness-camera" style={{ marginBottom: 20 }}>
          <CameraDirectorPanel
            currentPlan={activePlan}
            onPlanChange={(plan) => setActivePlan(plan)}
            onSelectPreset={(preset) => setActivePlan(createCameraPlanFromPreset(preset))}
          />
        </section>
      )}

      {(surface === "all" || surface === "performance") && (
        <section id="harness-performance" style={{ marginBottom: 20 }}>
          <PerformanceDoctor scene={spec.scene} />
        </section>
      )}

      {(surface === "all" || surface === "data") && (
        <section id="harness-data" style={{ marginBottom: 20 }}>
          <DataBindingInspector
            bindings={spec.dataBindings}
            onRemoveBinding={(id) =>
              setSpec((s) => ({
                ...s,
                dataBindings: s.dataBindings.filter((b) => b.id !== id),
              }))
            }
          />
        </section>
      )}
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<Harness />);
  window.__studioReady = true;
}
