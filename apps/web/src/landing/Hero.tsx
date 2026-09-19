import { lazy, Suspense } from "react";
import type { SceneState } from "../scene/SpeIntelligence";
import type { VisualQuality } from "../scene/quality";
import { Logo } from "../brand/Logo";

const SpeIntelligence = lazy(() =>
  import("../scene/SpeIntelligence").then((m) => ({ default: m.SpeIntelligence })),
);

type Props = {
  value: string;
  onChange: (v: string) => void;
  onBuild: () => void;
  busy: boolean;
  sceneState: SceneState;
  quality: VisualQuality;
};

export function Hero({ value, onChange, onBuild, busy, sceneState, quality }: Props) {
  return (
    <section className="spe-hero" id="top" aria-labelledby="hero-title">
      <div className="spe-hero-stage" aria-hidden="true">
        <Suspense
          fallback={
            <div className="spe-intel-fallback" data-state={sceneState}>
              <div className="spe-intel-core" />
            </div>
          }
        >
          <SpeIntelligence state={sceneState} quality={quality} />
        </Suspense>
      </div>

      <div className="spe-hero-copy">
        <Logo size="hero" wordmark={false} />
        <p className="spe-kicker">SPE</p>
        <h1 id="hero-title">System Prompt Engine</h1>
        <p className="spe-hero-line">Turn thought into precision.</p>
        <p className="spe-hero-sub">One line in. A complete AI instruction out.</p>

        <div className="spe-command" role="search">
          <label htmlFor="spe-one-line" className="visually-hidden">
            What do you want to accomplish?
          </label>
          <textarea
            id="spe-one-line"
            placeholder="What do you want to accomplish?"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onBuild();
              }
            }}
            rows={2}
          />
          <div className="spe-command-meta" aria-hidden="true">
            <span>⌘/Ctrl + Enter</span>
            <span className="spe-afford">mic · image · file</span>
          </div>
          <button
            type="button"
            className="spe-build"
            disabled={busy}
            aria-busy={busy}
            onClick={onBuild}
          >
            {busy ? "Building…" : "Build with SPE"}
          </button>
        </div>

        <p className="spe-hero-trust">Local-first · Any AI · Free core</p>
      </div>
    </section>
  );
}
