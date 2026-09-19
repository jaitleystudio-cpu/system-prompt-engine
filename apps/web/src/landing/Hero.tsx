import { lazy, Suspense } from "react";
import type { SceneState } from "../scene/SpeIntelligence";
import type { VisualQuality } from "../scene/quality";

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

const CAPABILITIES = [
  ["Research", "Expand perspectives"],
  ["Analyze", "Find what matters"],
  ["Decide", "Weigh and choose"],
  ["Write", "Shape with precision"],
  ["Code", "Turn ideas into systems"],
  ["Communicate", "Adapt for any audience"],
  ["Proof", "Verify and ground"],
  ["Privacy", "Your intent stays yours"],
] as const;

export function Hero({ value, onChange, onBuild, busy, sceneState, quality }: Props) {
  return (
    <section className="spe-hero spe-hero-theater" id="top" aria-labelledby="hero-title">
      <div className="spe-hero-plate" aria-hidden="true">
        <img
          src="/atmosphere/intent-theater.jpg"
          alt=""
          decoding="async"
          className="spe-hero-plate-img"
        />
        <div className="spe-hero-plate-veil" />
      </div>

      <div className="spe-hero-atmosphere" aria-hidden="true" />

      <div className="spe-hero-stage" aria-hidden="true">
        <Suspense
          fallback={
            <div className="spe-intel-fallback" data-state={sceneState}>
              <div className="spe-intel-pedestal" />
              <div className="spe-intel-core spe-intel-crystal" />
            </div>
          }
        >
          <SpeIntelligence state={sceneState} quality={quality} />
        </Suspense>
      </div>

      <ul className="spe-capability-orbit" aria-label="What SPE is for">
        {CAPABILITIES.map(([title, blurb], i) => (
          <li key={title} style={{ ["--i" as string]: i }}>
            <strong>{title}</strong>
            <span>{blurb}</span>
          </li>
        ))}
      </ul>

      <div className="spe-hero-copy">
        <h1 id="hero-title" className="visually-hidden">
          System Prompt Engine
        </h1>
        <p className="spe-hero-line">Turn thought into precision.</p>
        <p className="spe-hero-sub">One line in. A complete AI instruction out.</p>

        <div className="spe-command spe-command-pill" role="search">
          <label htmlFor="spe-one-line" className="visually-hidden">
            What do you want to accomplish?
          </label>
          <div className="spe-command-inline">
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
            <button
              type="button"
              className="spe-build spe-build-intent"
              disabled={busy}
              aria-busy={busy}
              onClick={onBuild}
            >
              {busy ? "Compiling…" : "Compile Intent →"}
            </button>
          </div>
          <div className="spe-command-meta" aria-hidden="true">
            <span>⌘/Ctrl + Enter</span>
            <span className="spe-afford">mic · image · file · local</span>
          </div>
        </div>

        <p className="spe-hero-trust">Local-first · Any AI · Free core</p>
      </div>
    </section>
  );
}
