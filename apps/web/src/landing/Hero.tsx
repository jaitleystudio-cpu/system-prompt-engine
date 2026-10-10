import { ui } from "@spe/human-perspective";
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
import type { AppView } from "../routing";
import { InAppLink } from "../shell/inAppLink";
import { useDailyHero } from "./useDailyHero";
import { HeroStory } from "./HeroStory";
import { ConversionKernel } from "./ConversionKernel";
import { MarkdownExportButton } from "../engine/markdownExport";
import {
  HOME_QUICK_START_MAX_CHARS,
  applyTextBound,
  formatCharCount,
  nearLimit,
} from "../input/boundedText";
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
  onNavigate: (view: AppView) => void;
};
const EXAMPLES = [
  {
    label: "Review code without hallucinations",
    category: "Coding",
    text: "Review the code I provide for correctness, security and maintainability. Rank findings by severity and include the affected code and a concrete fix. Do not invent files, imports, or unverified tests.",
  },
  {
    label: "Plan a full-stack feature",
    category: "Coding",
    text: "Design a complete end-to-end implementation plan for this full-stack feature. Include database schemas, API contracts, frontend state transitions, and step-by-step verification gates.",
  },
  {
    label: "Executive weekly progress report",
    category: "Business",
    text: "Synthesize team achievements, key metrics, active blockers, and high-priority milestones into a concise executive summary formatted for leadership review.",
  },
  {
    label: "Customer ticket triage & response",
    category: "Business",
    text: "Analyze customer support inquiries, identify root causes, classify severity, and draft empathetic, accurate response drafts with concrete resolution steps.",
  },
] as const;
export function Hero(p: Props) {
  const hero = useDailyHero();
  const [reduced, setReduced] = useState(() =>
      matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [resultTab, setResultTab] = useState<"prompt" | "structure" | "review">(
      "prompt",
    ),
    [boundNotice, setBoundNotice] = useState<string | null>(null);
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
            <i /> YOUR IDEAS. YOUR WORDS.
          </span>
          <span className="edition">✦ 100% In-Browser · ✦ Zero Data Leaves Your Machine · ✦ No Login Required</span>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">A CLEAR START FOR ANY AI</p>
          <h1 id="hero-title" data-daily-title={hero.index}>
            <span className="visually-hidden">
              Free System Prompt Generator & AI Prompt Builder —{" "}
            </span>
            {hero.title}
            <br />
            <em>{hero.accent}</em>
          </h1>
          <p className="hero-description">
            Turn your ideas into clear prompts for any AI.
            Start with a few words. Add what matters.
          </p>
          <a
            className="hero-start"
            href="#prompt-studio"
            aria-label="Open System Prompt Studio to build your prompt"
          >
            Make my prompt <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="hero-stage">
          <HeroStory />
        </div>
        <div className="theater-bottom">
          <span>YOUR IDEA → YOUR PROMPT</span>
          <a href="#prompt-studio">TRY IT BELOW ↓</a>
        </div>
      </div>
      <ConversionKernel onNavigate={p.onNavigate} />
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
              aria-describedby="spe-one-line-meter spe-one-line-limit-help"
              placeholder="Describe the task. Include what matters, what to avoid, and what a good result looks like…"
              value={p.value}
              onChange={(e) => {
                const next = applyTextBound(e.target.value, HOME_QUICK_START_MAX_CHARS, {
                  createHint: true,
                  fieldLabel: "Home quick-start",
                });
                p.onChange(next.value);
                setBoundNotice(next.notice);
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  if (!p.busy) p.onBuild();
                }
              }}
            />
            <div className="spe-bound-row" id="spe-one-line-meter">
              <p
                className={`spe-bound-meter${nearLimit(p.value.length, HOME_QUICK_START_MAX_CHARS) ? " is-near" : ""}`}
                aria-live="polite"
              >
                {formatCharCount(p.value.length)} /{" "}
                {formatCharCount(HOME_QUICK_START_MAX_CHARS)} characters
              </p>
              <p id="spe-one-line-limit-help" className="spe-bound-hint">
                Quick-start limit {formatCharCount(HOME_QUICK_START_MAX_CHARS)}.
                For longer material, use{" "}
                <InAppLink view="create" onNavigate={p.onNavigate}>
                  Create
                </InAppLink>
                .
              </p>
            </div>
            {boundNotice && (
              <p className="spe-bound-notice" role="status" aria-live="assertive">
                {boundNotice}
              </p>
            )}
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
                  <MarkdownExportButton
                    promptText={p.prompt || ""}
                    category={p.category}
                    disabled={!p.prompt}
                  />
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
