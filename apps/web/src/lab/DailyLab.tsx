import { lazy, Suspense, useMemo, useState } from "react";
import { PromptGallery } from "./PromptGallery";
import {
  DAILY_3D_QUEUE,
  queueHonestyLine,
  specimensForDate,
  todaysLabDateLabel,
  type LabSpecimen,
} from "./specimens";
import type { GalleryCard } from "./gallery/promptGallery";

const LabStage = lazy(() =>
  import("./LabStage").then((m) => ({ default: m.LabStage })),
);

type Props = {
  onOpenInSpe: (specimen: LabSpecimen | GalleryCard) => void;
  onCopyIdea: (specimen: LabSpecimen | GalleryCard) => void;
};

export function DailyLab({ onOpenInSpe, onCopyIdea }: Props) {
  const todaySet = useMemo(() => specimensForDate(new Date(), 3), []);
  const [activeId, setActiveId] = useState(todaySet[0]?.id);
  const active = DAILY_3D_QUEUE.find((s) => s.id === activeId) ?? todaySet[0];

  return (
    <section className="spe-lab spe-lab-3d" aria-labelledby="lab-title">
      <header className="spe-lab-head">
        <p className="spe-kicker">Daily 3D Lab</p>
        <h1 id="lab-title">Today&apos;s staged experience</h1>
        <p>
          A large interactive stage for {todaysLabDateLabel()} — materials,
          lighting, camera, and a build prompt you can open cleanly in Create.
        </p>
        <p className="spe-muted" data-product-status="FINITE_QUEUE">
          {queueHonestyLine()}
        </p>
      </header>

      {active && (
        <div className="spe-lab-feature">
          <Suspense
            fallback={
              <div className="spe-lab-stage spe-lab-stage-fallback">Loading stage…</div>
            }
          >
            <LabStage specimen={active} />
          </Suspense>
          <article className="spe-lab-editorial" style={{ ["--lab-accent" as string]: active.accent }}>
            <span className="spe-lab-cat">{active.category}</span>
            <h2>{active.title}</h2>
            <p className="spe-lab-blurb">{active.blurb}</p>
            <p className="spe-lab-story">{active.editorialStory}</p>
            <dl className="spe-lab-meta">
              <div>
                <dt>Publish date</dt>
                <dd>{active.publishDate}</dd>
              </div>
              <div>
                <dt>Interaction</dt>
                <dd>{active.interaction}</dd>
              </div>
              <div>
                <dt>Materials</dt>
                <dd>
                  {active.materials.primary} / {active.materials.finish}
                </dd>
              </div>
              <div>
                <dt>Lighting</dt>
                <dd>{active.lighting.key}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{active.status}</dd>
              </div>
            </dl>
            <pre className="spe-lab-seed">{active.buildPrompt}</pre>
            <div className="spe-lab-actions">
              <button
                type="button"
                className="spe-build"
                onClick={() => onOpenInSpe(active)}
              >
                Open in SPE <span>↗</span>
              </button>
              <button
                type="button"
                className="spe-ghost"
                onClick={() => onCopyIdea(active)}
              >
                Copy build prompt
              </button>
            </div>
          </article>
        </div>
      )}

      <div className="spe-lab-previews" aria-label="Today's queue previews">
        {todaySet.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`spe-lab-preview ${s.id === active?.id ? "is-active" : ""}`}
            style={{ ["--lab-accent" as string]: s.accent }}
            onClick={() => setActiveId(s.id)}
            aria-pressed={s.id === active?.id}
          >
            <strong>{s.title}</strong>
            <span>{s.blurb}</span>
            <em>{s.publishDate}</em>
          </button>
        ))}
      </div>

      <details className="spe-lab-library">
        <summary>Full {DAILY_3D_QUEUE.length}-day curated queue</summary>
        <ul>
          {DAILY_3D_QUEUE.map((s) => (
            <li key={s.id}>
              <strong>{s.title}</strong> — {s.blurb} ({s.publishDate}){" "}
              <button
                type="button"
                className="spe-linkish"
                onClick={() => {
                  setActiveId(s.id);
                  onOpenInSpe(s);
                }}
              >
                Open in SPE
              </button>
            </li>
          ))}
        </ul>
      </details>

      <PromptGallery onOpenInSpe={onOpenInSpe} />
    </section>
  );
}
