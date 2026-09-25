import { ui, selectHero } from "@spe/human-perspective";
import { HumanError } from "../ui/HumanError";
import { useEffect, useRef, useState } from "react";
import {
  CATEGORIES,
  TARGETS,
  type CategoryId,
  type TargetId,
  type IntentAtom,
  type PromptReview,
} from "@spe/web-runtime";
import type { SceneState } from "../scene/SpeIntelligence";
import type { VisualQuality } from "../scene/quality";
import type {
  EngineError,
  EngineSuccessBody,
  CompilePhase,
} from "../engine/types";
import { semanticGroups } from "../scene/semantic";
import { DotPattern } from "../ui/DotPattern";
import { HeroStory } from "./HeroStory";
type Intent = {
  confirmed: IntentAtom[];
  assumed: IntentAtom[];
  unknowns: IntentAtom[];
  conflicts: IntentAtom[];
};
type Props = {
  onReset: () => void;
  value: string;
  onChange: (v: string) => void;
  onBuild: () => void;
  busy: boolean;
  sceneState: SceneState;
  quality: VisualQuality;
  result: EngineSuccessBody | null;
  error: EngineError | null;
  phase: CompilePhase;
  prompt: string | null;
  review: PromptReview | null;
  onOpen: () => void;
  onCopy: () => void;
  onExport: () => void;
  category: CategoryId;
  onCategory: (v: CategoryId) => void;
  target: TargetId;
  onTarget: (v: TargetId) => void;
  intent: Intent;
  onIntent: (bucket: keyof Intent, id: string, text: string) => void;
};
const EXAMPLES = [
  {
    label: "Launch a product",
    category: "Business",
    text: "Plan a four-week launch for an offline writing app. Our team has two people and a $2,000 budget. Prioritize practical steps and avoid paid influencer campaigns.",
  },
  {
    label: "Review code",
    category: "Coding",
    text: "Review the code I provide for correctness, security and maintainability. Rank findings by severity and include the affected code and a concrete fix. Do not invent files or executed tests.",
  },
  {
    label: "Teach an idea",
    category: "Education",
    text: "Explain how a neural network learns to a curious 14-year-old. Use one everyday analogy, a worked example and three questions to check understanding.",
  },
] as const;
export function Hero(p: Props) {
  const hero = selectHero(p.category, Boolean(p.result));
  const [paused, setPaused] = useState(false),
    [reduced, setReduced] = useState(() =>
      matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [resultTab, setResultTab] = useState<"prompt" | "structure" | "review">(
      "prompt",
    );
  const resultRef = useRef<HTMLElement>(null);
  const groups = semanticGroups(p.result?.output);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (p.prompt) {
      setResultTab("prompt");
      resultRef.current?.scrollIntoView({
        behavior: reduced ? "instant" : "smooth",
        block: "start",
      });
      resultRef.current?.focus({ preventScroll: true });
    }
  }, [p.prompt, reduced]);
  const field = (
    id: string,
    label: string,
    placeholder: string,
    bucket: keyof Intent = "assumed",
  ) => {
    const atom = p.intent[bucket].find((a) => a.id === id);
    return atom ? (
      <label className="brief-field" key={id}>
        <span>{label}</span>
        <textarea
          rows={2}
          value={atom.text}
          placeholder={placeholder}
          onChange={(e) => p.onIntent(bucket, id, e.target.value)}
        />
      </label>
    ) : null;
  };
  return (
    <section className="spe-hero" id="top" aria-labelledby="hero-title">
      <div className="hero-theater">
        <DotPattern surface="hero" />
        <div className="hero-topline">
          <span className="eyebrow">
            <i /> PRIVATE BY DESIGN. OPEN BY NATURE.
          </span>
          <span className="edition">Research preview</span>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">FROM A THOUGHT TO A PRECISE BRIEF</p>
          <h1 id="hero-title">
            {hero.title}
            <br />
            <em>{hero.accent}</em>
          </h1>
          <p className="hero-description">
            {p.quality === "LITE" ? ui.mobileHeroSupport : hero.support}
          </p>
          <a className="hero-start" href="#prompt-studio">
            {ui.start} <span>↗</span>
          </a>
        </div>
        <div className="hero-stage">
          <HeroStory state={p.sceneState} paused={paused || reduced} />
        </div>
        <div className="theater-bottom">
          <span>ONE BRIEF. ANY AI.</span>
          <button
            className="motion-button"
            type="button"
            disabled={reduced}
            aria-pressed={paused}
            onClick={() => {
              setPaused(!paused);
            }}
          >
            {reduced
              ? "Reduced motion"
              : paused
                ? "Resume story"
                : "Pause story"}
          </button>
          <a href="#prompt-studio">SCROLL TO CREATE ↓</a>
        </div>
      </div>
      <section
        className="prompt-studio"
        id="prompt-studio"
        aria-labelledby="studio-title"
      >
        <div className="studio-heading">
          <div>
            <p className="eyebrow">THE SPACE TO SHAPE YOUR IDEA</p>
            <h2 id="studio-title">
              Give the thought <em>direction.</em>
            </h2>
          </div>
          <p>
            Your words. A considered structure.
            <br />A prompt you can take anywhere.
          </p>
        </div>
        <div className="studio-shell">
          <form
            className="spe-command"
            onSubmit={(e) => {
              e.preventDefault();
              if (!p.busy) p.onBuild();
            }}
          >
            <div className="studio-panel-head">
              <span>01 / YOUR BRIEF</span>
              <button className="new-brief" type="button" onClick={p.onReset}>
                New brief
              </button>
              <span className="local-note">
                <i /> Stays on this device
              </span>
            </div>
            <label className="request-label" htmlFor="spe-one-line">
              {ui.input}
            </label>
            <textarea
              id="spe-one-line"
              className="request-input"
              rows={5}
              maxLength={20000}
              placeholder="Describe the task. Include what matters, what to avoid, and what a good result looks like…"
              value={p.value}
              onChange={(e) => p.onChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  if (!p.busy) p.onBuild();
                }
              }}
            />
            <div className="examples">
              {EXAMPLES.map((e) => (
                <button
                  type="button"
                  key={e.label}
                  onClick={() => {
                    p.onReset();
                    p.onChange(e.text);
                    p.onCategory(e.category);
                  }}
                >
                  {e.label}
                  <span>↗</span>
                </button>
              ))}
            </div>
            <div className="brief-selects">
              <label className="brief-field">
                <span>Working template</span>
                <select
                  value={p.category}
                  onChange={(e) => p.onCategory(e.target.value as CategoryId)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="brief-field">
                <span>Use with</span>
                <select
                  value={p.target}
                  onChange={(e) => p.onTarget(e.target.value as TargetId)}
                >
                  {TARGETS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <details className="brief-details">
              <summary>
                Refine the brief <span>Role · audience · requirements</span>
              </summary>
              <div className="brief-fields">
                {field(
                  "brief-role",
                  "Role",
                  "e.g. a customer support assistant for our clothing store",
                )}
                {field(
                  "brief-audience",
                  "Audience",
                  "e.g. customers checking returns and delivery",
                )}
                {field(
                  "brief-format",
                  "Desired output",
                  "e.g. concise replies with one next step",
                )}
                {field(
                  "confirmed-boundaries",
                  "Must follow",
                  "e.g. Never invent refund policies. Ask for the order number first.",
                  "confirmed",
                )}
                {field(
                  "assumed-context",
                  "Context and preferences",
                  "e.g. Warm, direct tone. Use the supplied policy document.",
                )}
                {field(
                  "unknown-questions",
                  "Questions to resolve",
                  "Optional: questions the AI should clarify",
                  "unknowns",
                )}
              </div>
            </details>
            <div className="compile-row">
              <button
                className="spe-build"
                disabled={p.busy || !p.value.trim()}
                aria-busy={p.busy}
              >
                {p.busy ? ui.working : ui.build}
                <span>↗</span>
              </button>
              <span>⌘ / Ctrl + Enter</span>
            </div>
            <p className="compiler-note">{ui.note}</p>
            <details className="compiler-note" data-copy-depth="INSPECT">
              <summary>{ui.howItWorks}</summary>
              <p>{ui.exactNote}</p>
            </details>
          </form>
          <section
            ref={resultRef}
            tabIndex={-1}
            className={`studio-output ${p.prompt ? "live-result" : ""}`}
            aria-labelledby="result-title"
          >
            <div className="studio-panel-head">
              <span>02 / YOUR PROMPT</span>
              <span className="compile-status" role="status">
                {p.busy
                  ? ui.phases[p.phase]
                  : p.prompt
                    ? "Ready to use"
                    : "Awaiting your brief"}
              </span>
            </div>
            {p.error ? (
              <div>
                <HumanError error={p.error} />
                <button
                  type="button"
                  className="spe-ghost"
                  onClick={
                    p.error.code === "BRIEF_NEEDS_REVIEW" ? p.onOpen : p.onBuild
                  }
                >
                  {p.error.code === "BRIEF_NEEDS_REVIEW"
                    ? "Review brief"
                    : "Try again"}
                </button>
              </div>
            ) : p.prompt && p.result ? (
              <>
                <div className="output-heading">
                  <h3 id="result-title">{ui.ready}</h3>
                  <div
                    className="output-tabs"
                    role="group"
                    aria-label="Result view"
                  >
                    <button
                      aria-pressed={resultTab === "prompt"}
                      onClick={() => setResultTab("prompt")}
                    >
                      Prompt
                    </button>
                    {p.review && (
                      <button
                        aria-pressed={resultTab === "review"}
                        onClick={() => setResultTab("review")}
                      >
                        Why this prompt
                      </button>
                    )}
                    <button
                      aria-pressed={resultTab === "structure"}
                      onClick={() => setResultTab("structure")}
                    >
                      Structure
                    </button>
                  </div>
                </div>
                {resultTab === "prompt" ? (
                  <pre
                    className="prompt-document"
                    tabIndex={0}
                    aria-label="Your prompt"
                  >
                    {p.prompt}
                  </pre>
                ) : resultTab === "review" && p.review ? (
                  <div className="prompt-review">
                    <div className="review-intent">
                      <span className="eyebrow">YOUR ORIGINAL GOAL</span>
                      <p>{p.review.goal}</p>
                    </div>
                    <p className="review-intro">
                      Your brief sets the direction. The additions below make
                      the instructions explicit and reviewable.
                    </p>
                    <ol className="review-decisions">
                      {p.review.decisions.map((decision, index) => (
                        <li key={decision.title}>
                          <span className="review-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <div className="review-title">
                              <h4>{decision.title}</h4>
                              <span>{decision.source}</span>
                            </div>
                            <p>{decision.detail}</p>
                            <p className="review-reason">{decision.why}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <div className="review-questions">
                      <h4>Questions you flagged</h4>
                      {p.review.questions.length ? (
                        <ul>
                          {p.review.questions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          No open questions supplied. This does not mean the
                          brief contains everything needed for the task.
                        </p>
                      )}
                    </div>
                    <p className="review-intro">
                      Want a different direction? Refine your role, boundaries
                      or deliverable, then rebuild. SPE uses your explicit
                      choices before template defaults.
                    </p>
                  </div>
                ) : (
                  <div className="semantic-readout">
                    {groups.map((g) => (
                      <details key={g.key} open>
                        <summary>
                          {g.label}
                          <span>{g.items.length}</span>
                        </summary>
                        {g.items.length ? (
                          g.items.map((s, i) => <p key={i}>{s}</p>)
                        ) : (
                          <p>None supplied.</p>
                        )}
                      </details>
                    ))}
                  </div>
                )}
                <div className="spe-actions">
                  <button className="spe-build" onClick={p.onCopy}>
                    Copy prompt <span>↗</span>
                  </button>
                  <button className="spe-ghost" onClick={p.onExport}>
                    Download .spe
                  </button>
                  <button className="spe-ghost" onClick={p.onOpen}>
                    {ui.inspect}
                  </button>
                </div>
                <p className="output-footnote">{ui.claim}</p>
              </>
            ) : (
              <div className="output-empty">
                <span className="document-mark">
                  SPE<span> / YOUR PROMPT</span>
                </span>
                <h3 id="result-title">
                  A clear starting point.
                  <br />
                  <em>A stronger direction.</em>
                </h3>
                <p>
                  Your prompt will appear here—with a role, a focused objective,
                  a working approach and a defined deliverable.
                </p>
                <ol>
                  <li>
                    <span>01</span> Describe the task
                  </li>
                  <li>
                    <span>02</span> Choose a template and refine
                  </li>
                  <li>
                    <span>03</span> Shape, review, take it with you
                  </li>
                </ol>
                <div className="empty-footer">
                  YOURS TO REFINE. YOURS TO KEEP.
                </div>
              </div>
            )}
          </section>
        </div>
        <div className="studio-trust">
          <span>Runs locally</span>
          <span>No analytics</span>
          <span>Works offline once cached</span>
          <span>Portable .spe files</span>
        </div>
      </section>
    </section>
  );
}
