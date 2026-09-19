import { lazy, Suspense } from "react";
import type { SceneState } from "../scene/SpeIntelligence";
import type { VisualQuality } from "../scene/quality";
import { LogoLockup } from "../brand/Logo";

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
    <section className="forge-act forge-act-receive" id="top" aria-labelledby="hero-title">
      <div className="forge-world" aria-hidden="true">
        <Suspense
          fallback={
            <div className="forge-lite-plate" data-state={sceneState}>
              <div className="forge-lite-raw" />
              <div className="forge-lite-gates" />
              <div className="forge-lite-artifact" />
            </div>
          }
        >
          <SpeIntelligence state={sceneState} quality={quality} />
        </Suspense>
      </div>

      <div className="forge-act-frame">
        <div className="forge-act-copy">
          <div className="forge-mobile-lockup">
            <LogoLockup size={34} compact />
          </div>
          <p className="forge-stage-label">
            <span>ACT I</span>
            <span>RECEIVE / READ</span>
          </p>
          <p className="forge-eyebrow">Semantic Forge</p>
          <h1 id="hero-title">Give thought a structure it can travel in.</h1>
          <p className="forge-hero-lede">
            Raw language enters as one graphite workpiece. Meaning stays visible
            while structure, strategy, and a portable prompt artifact take form.
          </p>
          <dl className="forge-runtime-line" aria-label="Runtime profile">
            <div>
              <dt>Engine</dt>
              <dd>Local WASM</dd>
            </div>
            <div>
              <dt>Visual tier</dt>
              <dd>{quality}</dd>
            </div>
            <div>
              <dt>Provider spend</dt>
              <dd>₹0</dd>
            </div>
          </dl>
        </div>

        <form
          className="forge-intake"
          role="search"
          aria-label="Raw thought composer"
          onSubmit={(event) => {
            event.preventDefault();
            onBuild();
          }}
        >
          <header>
            <label htmlFor="spe-one-line">Raw thought</label>
            <span>INTAKE / 01</span>
          </header>
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
          <div className="forge-intake-actions">
            <span>⌘ / CTRL + ENTER</span>
            <button
              id="hero-compile-button"
              type="button"
              className="forge-primary"
              disabled={busy}
              aria-busy={busy}
              onClick={onBuild}
            >
              {busy ? "Compiling intent…" : "Compile intent"}
            </button>
          </div>
          <p className="forge-state-live" role="status" aria-live="polite">
            Forge state: {sceneState.toLowerCase()}
          </p>
        </form>
      </div>

      <a className="forge-scroll-cue" href="#act-extract">
        <span>Continue through the forge</span>
        <i aria-hidden="true" />
      </a>
    </section>
  );
}
