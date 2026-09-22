import { ui } from "@spe/human-perspective";
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
              Your request becomes the goal. Add your role, audience and
              requirements in the brief, and keep assumptions visible.
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
              Keep the facts you know, the boundaries that matter and the
              questions still open in view. Add the details yourself, and review
              SPE’s suggestions.
            </p>
            <div className="structure-legend">
              <span>
                <i /> Goal & facts
              </span>
              <span>
                <i /> Boundaries
              </span>
              <span>
                <i /> Preferences
              </span>
              <span>
                <i /> Open questions
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
              Review your prompt, then choose where to use it. Keep an SPE file
              to bring your prompt and its details back together.
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
          <h2>{ui.fileTitle}</h2>
          <p>{ui.fileSupport}</p>
          <button className="spe-build" onClick={onOpenWorkspace}>
            Make it yours <span>↗</span>
          </button>
          <div className="target-line">
            ChatGPT / Claude / Gemini / Copilot / Local AI
          </div>
        </div>
        <div className="artifact-object">
          <div className="artifact-sheet">
            <span>SPE / YOUR PROMPT</span>
            <div className="sheet-rule" />
            <h3>{demoPrompt ? "Your prompt" : "A place for every detail."}</h3>
            {demoPrompt ? (
              <pre>{demoPrompt.slice(0, 450)}</pre>
            ) : (
              <>
                <p>01 &nbsp; The goal you set</p>
                <p>02 &nbsp; Boundaries to keep</p>
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
        <h2>{ui.privacyTitle}</h2>
        <p>{ui.privacyIntro}</p>
        <div className="privacy-principles" data-copy-depth="INSPECT">
          <div>
            <span>01 / LOCAL</span>
            <h3>Your work stays with you.</h3>
            <p>
              Your brief stays on this device while SPE prepares your prompt.
              Offline use is available after the site and engine files are
              cached.
            </p>
          </div>
          <div>
            <span>02 / INDEPENDENT</span>
            <h3>Choose the AI you use.</h3>
            <p>
              Preparing a prompt does not require a paid AI provider. This
              private preview may require sign-in; sending your finished prompt
              to another AI is your choice.
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
