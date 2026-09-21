import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { StaticPress } from "../scene/StaticPress";
const Scene = lazy(() =>
  import("../scene/SpeIntelligence").then((m) => ({
    default: m.SpeIntelligence,
  })),
);
export function ScrollStory({
  onOpenWorkspace,
  demoPrompt,
}: {
  onOpenWorkspace: () => void;
  demoRequest: string;
  demoPrompt: string | null;
}) {
  const ref = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const mq = matchMedia(
      "(prefers-reduced-motion: reduce), (max-width: 700px)",
    );
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    let frame = 0;
    const scroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (ref.current) {
          const r = ref.current.getBoundingClientRect();
          setProgress(
            Math.max(0, Math.min(1, -r.top / (r.height - innerHeight))),
          );
        }
      });
    };
    window.addEventListener("scroll", scroll, { passive: true });
    scroll();
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("scroll", scroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <>
      <section className="process-intro" id="how-it-works">
        <p className="eyebrow">01 — FROM THOUGHT TO STRUCTURE</p>
        <h2>
          Good instructions
          <br />
          have an <em>inner architecture.</em>
        </h2>
        <p>
          A goal. The things that must hold true. The questions still open.
          <br />
          SPE gives each one a place.
        </p>
      </section>
      <section
        className="scroll-process"
        ref={ref}
        aria-label="How SPE structures a request"
      >
        <div className="process-visual">
          <div className="process-visual-inner">
            <span className="eyebrow">THE INTENT CORE / ILLUSTRATION</span>
            {reduced ? (
              <StaticPress />
            ) : (
              <Suspense fallback={<StaticPress />}>
                <Scene state="IDLE" quality="BALANCED" progress={progress} />
              </Suspense>
            )}
            <div className="process-index">
              <span>
                {progress < 0.33
                  ? "01 / ARTICULATE"
                  : progress < 0.66
                    ? "02 / ORGANIZE"
                    : "03 / CARRY FORWARD"}
              </span>
              <span>FORM FOLLOWS INTENT</span>
            </div>
          </div>
        </div>
        <div className="process-steps">
          <article>
            <span className="step-number">01</span>
            <h3>
              Start with
              <br />
              what you mean.
            </h3>
            <p>
              Your request becomes the goal. Add your role, audience and requirements in
              the brief, and keep assumptions visible.
            </p>
            <div className="specimen">
              <span>YOUR WORDS</span>
              <p>“Help me plan a thoughtful launch.”</p>
            </div>
          </article>
          <article>
            <span className="step-number">02</span>
            <h3>
              Make room
              <br />
              for the unknown.
            </h3>
            <p>
              The local engine evaluates the structured envelope. Supplied
              facts, protected constraints, and open questions stay distinct.
            </p>
            <div className="structure-legend">
              <span>
                <i /> Goal & facts
              </span>
              <span>
                <i /> Constraints
              </span>
              <span>
                <i /> Preferences
              </span>
              <span>
                <i /> Open unknowns
              </span>
            </div>
          </article>
          <article>
            <span className="step-number">03</span>
            <h3>
              Take your intent
              <br />
              anywhere.
            </h3>
            <p>
              Review the prompt. Choose your target. Copy it into your AI, or
              keep the portable .spe artifact with its structure intact.
            </p>
            <button className="text-link" onClick={onOpenWorkspace}>
              Explore your workspace <span>↗</span>
            </button>
          </article>
        </div>
      </section>
      <section className="artifact-story" id="artifact-story">
        <div>
          <p className="eyebrow">02 — A FILE THAT CARRIES YOUR THINKING</p>
          <h2>
            More than text.
            <br />
            <em>Your intent, intact.</em>
          </h2>
          <p>
            A prompt you can use. A structure you can inspect.
            <br />A portable artifact you can keep.
          </p>
          <button className="spe-build" onClick={onOpenWorkspace}>
            Make it yours <span>↗</span>
          </button>
          <div className="target-line">
            ChatGPT / Claude / Gemini / Copilot / Local AI
          </div>
        </div>
        <div className="artifact-object">
          <div className="artifact-sheet">
            <span>SPE / PROMPT ARTIFACT</span>
            <div className="sheet-rule" />
            <h3>
              {demoPrompt
                ? "Your compiled intent"
                : "A place for every detail."}
            </h3>
            {demoPrompt ? (
              <pre>{demoPrompt.slice(0, 450)}</pre>
            ) : (
              <>
                <p>01 &nbsp; The goal you set</p>
                <p>02 &nbsp; Constraints to preserve</p>
                <p>03 &nbsp; Preferences to respect</p>
                <p>04 &nbsp; Questions left open</p>
              </>
            )}
            <div className="sheet-footer">
              <strong>.spe</strong>
              <span>{demoPrompt ? "YOUR LIVE RESULT" : "FORMAT PREVIEW"}</span>
            </div>
          </div>
        </div>
      </section>
      <section className="privacy-story" id="privacy">
        <p className="eyebrow">03 — PRIVATE BY DESIGN</p>
        <h2>
          The idea is yours.
          <br />
          <em>So is the space to think.</em>
        </h2>
        <div className="privacy-principles">
          <div>
            <span>01 / LOCAL</span>
            <h3>Your device is the engine.</h3>
            <p>
              Compilation runs locally. After the app is cached, you can keep
              working offline.
            </p>
          </div>
          <div>
            <span>02 / INDEPENDENT</span>
            <h3>No provider required.</h3>
            <p>
              No account or paid model is needed to compile. Choose where your
              finished prompt goes.
            </p>
          </div>
          <div>
            <span>03 / YOUR CHOICE</span>
            <h3>History, only if you want it.</h3>
            <p>
              No analytics. Saving history is optional, on this device, with a
              clear control to delete it.
            </p>
          </div>
        </div>
      </section>
      <section className="closing">
        <p className="eyebrow">LESS GUESSWORK. MORE INTENT.</p>
        <h2>
          What’s on
          <br />
          <em>your mind?</em>
        </h2>
        <a className="spe-build" href="#prompt-studio">
          Give it structure <span>↗</span>
        </a>
        <span className="closing-wordmark" aria-hidden="true" />
      </section>
    </>
  );
}
