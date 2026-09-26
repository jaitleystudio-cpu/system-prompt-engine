import type { SceneState } from "../scene/SpeIntelligence";

type StoryStage =
  | "idea"
  | "meaning"
  | "engine"
  | "structure"
  | "prompt";

type Props = {
  state: SceneState;
  paused: boolean;
};

const STORY_STAGES = [
  { id: "idea", number: "01", label: "IDEA" },
  { id: "meaning", number: "02", label: "MEANING" },
  { id: "engine", number: "03", label: "SPE" },
  { id: "structure", number: "04", label: "STRUCTURE" },
  { id: "prompt", number: "05", label: "PROMPT" },
] as const satisfies ReadonlyArray<{
  id: StoryStage;
  number: string;
  label: string;
}>;

const ACTIVE_STAGE: Record<SceneState, StoryStage> = {
  IDLE: "idea",
  LISTENING: "idea",
  UNDERSTANDING: "meaning",
  STRUCTURING: "structure",
  COMPILING: "engine",
  READY: "prompt",
};

const FRAGMENTS = [
  <span className="fragment fragment-note" key="note">NOTE</span>,
  <span className="fragment fragment-question" key="question">QUESTION</span>,
  <span className="fragment fragment-image" key="image">IMAGE</span>,
  <span className="fragment fragment-code" key="code">CODE</span>,
  <span className="fragment fragment-document" key="document">DOCUMENT</span>,
  <span className="fragment fragment-waveform" key="waveform">WAVEFORM</span>,
  <span className="fragment fragment-url" key="url">URL</span>,
] as const;

/** Quiet whisper only — form carries story; numbers not required to read. */
function StoryLabel({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <div className="hero-story-label">
      <span aria-hidden="true">{number}</span>
      <strong>{label}</strong>
    </div>
  );
}

/**
 * Award-craft continuous editorial transformation (not flowchart stations).
 * Form carries IDEA → MEANING → SPE → STRUCTURE → PROMPT.
 * FX adapted from fx.statico.io (Unlicense): electron-lines, resend-conic-border,
 * meshy-grid motes — restrained to SPE ink/ivory/blue/champagne.
 */
export function HeroStory({ state, paused }: Props) {
  const activeStage = ACTIVE_STAGE[state];

  return (
    <figure
      className="hero-story"
      data-active-stage={activeStage}
      data-paused={paused ? "true" : "false"}
      aria-label="SPE transforms messy human fragments into an idea, meaning, structure, and a perfect system prompt."
    >
      {/* Subtle dust/mote atmosphere — meshy-grid technique, SPE palette (not lime) */}
      <div className="hero-story-motes" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} className={`hero-mote hero-mote-${i + 1}`} />
        ))}
      </div>

      <svg
        className="hero-flow-lines"
        viewBox="0 0 1000 520"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="story-flow-gold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8b714c" stopOpacity="0.05" />
            <stop offset="0.35" stopColor="#d8b779" stopOpacity="0.55" />
            <stop offset="0.62" stopColor="#f0d7a4" stopOpacity="0.38" />
            <stop offset="1" stopColor="#92aad6" stopOpacity="0.14" />
          </linearGradient>
          <linearGradient id="story-flow-blue" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#92aad6" stopOpacity="0.1" />
            <stop offset="0.5" stopColor="#d8b779" stopOpacity="0.34" />
            <stop offset="1" stopColor="#f0ecdf" stopOpacity="0.22" />
          </linearGradient>
          {/* Electron-lines glow (fx.statico.io / Schematic) — champagne bloom, not cyan */}
          <filter id="story-pulse-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Organic filaments — continuous tissue, not booth arrows */}
        <path
          id="story-path-a"
          d="M70 170 C190 130 280 210 360 235 S470 255 520 248"
        />
        <path
          id="story-path-b"
          d="M85 265 C200 290 290 255 370 245 S470 240 520 248"
        />
        <path
          id="story-path-c"
          d="M95 355 C210 340 300 295 385 265 S480 245 520 248"
        />
        <path
          id="story-path-d"
          d="M580 248 C660 235 740 200 820 175 S910 150 960 145"
        />
        <path
          id="story-path-e"
          d="M580 255 C670 275 750 310 840 340 S920 370 965 380"
        />
        {/* Electron pulses along Bézier paths (Meaning ↔ SPE ↔ Structure) */}
        <g className="hero-electron-pulses" filter="url(#story-pulse-glow)">
          <circle className="hero-electron" r="3.2" fill="#f0ecdf" opacity="0.92">
            <animateMotion dur="5.2s" repeatCount="indefinite" begin="0s">
              <mpath href="#story-path-a" />
            </animateMotion>
          </circle>
          <circle className="hero-electron" r="2.4" fill="#d8b779" opacity="0.75">
            <animateMotion dur="6.1s" repeatCount="indefinite" begin="-1.4s">
              <mpath href="#story-path-b" />
            </animateMotion>
          </circle>
          <circle className="hero-electron" r="2.1" fill="#92aad6" opacity="0.7">
            <animateMotion dur="5.8s" repeatCount="indefinite" begin="-2.6s">
              <mpath href="#story-path-c" />
            </animateMotion>
          </circle>
          <circle className="hero-electron" r="2.8" fill="#f0d7a4" opacity="0.85">
            <animateMotion dur="4.8s" repeatCount="indefinite" begin="-0.8s">
              <mpath href="#story-path-d" />
            </animateMotion>
          </circle>
          <circle className="hero-electron" r="2.2" fill="#92aad6" opacity="0.68">
            <animateMotion dur="5.5s" repeatCount="indefinite" begin="-3.2s">
              <mpath href="#story-path-e" />
            </animateMotion>
          </circle>
          <circle className="hero-electron hero-electron-trail" r="1.6" fill="#c7ae7a" opacity="0.45">
            <animateMotion dur="5.2s" repeatCount="indefinite" begin="-0.35s">
              <mpath href="#story-path-a" />
            </animateMotion>
          </circle>
          <circle className="hero-electron hero-electron-trail" r="1.5" fill="#92aad6" opacity="0.4">
            <animateMotion dur="4.8s" repeatCount="indefinite" begin="-1.15s">
              <mpath href="#story-path-d" />
            </animateMotion>
          </circle>
        </g>
      </svg>

      <ol
        className="hero-story-flow spe-pipeline"
        aria-label="SPE transformation: messy human fragments to idea, meaning, semantic engine, structure, and perfect system prompt"
      >
        <li className="hero-story-stage hero-idea-stage" data-stage="idea">
          <StoryLabel {...STORY_STAGES[0]} />
          <div className="chaos-to-idea">
            <span className="fragments-kicker">MESSY HUMAN FRAGMENTS</span>
            <div className="human-fragments" aria-hidden="true">
              {FRAGMENTS}
              <span className="thought-scribble">Need this to feel clear…</span>
            </div>
            <div className="idea-brief">
              <p>Launch with clarity</p>
              <span aria-hidden="true" />
            </div>
          </div>
        </li>

        <li className="hero-story-stage hero-meaning-stage" data-stage="meaning">
          <StoryLabel {...STORY_STAGES[1]} />
          <div className="glass-filter-stack" aria-hidden="true">
            <div className="meaning-family" data-family="goal">
              <span className="meaning-form meaning-form-goal" />
              <strong>GOAL</strong>
            </div>
            <div className="meaning-family" data-family="context">
              <span className="meaning-form meaning-form-context">
                <i />
                <i />
                <i />
              </span>
              <strong>CONTEXT</strong>
            </div>
            <div className="meaning-family" data-family="boundary">
              <span className="meaning-form meaning-form-boundary" />
              <strong>BOUNDARY</strong>
            </div>
          </div>
          <div className="meaning-clusters visually-hidden" aria-hidden="true">
            <span>GOAL</span>
            <span>CONTEXT</span>
            <span>BOUNDARY</span>
          </div>
        </li>

        <li
          className="hero-story-stage hero-story-engine-stage"
          data-stage="engine"
        >
          <StoryLabel {...STORY_STAGES[2]} />
          <div className="hero-engine" aria-hidden="true">
            {/* Soft conic border-sweep — resend technique, SPE palette only */}
            <span className="engine-conic-sweep" aria-hidden="true" />
            <div className="engine-seal" aria-hidden="true">
              <span className="engine-seal-ring engine-seal-ring-outer" />
              <span className="engine-seal-ring" />
              <span className="engine-seal-core">
                <i className="engine-seal-glyph" />
              </span>
            </div>
            <div className="engine-cap">
              <strong>SPE</strong>
              <span>SEMANTIC ENGINE</span>
            </div>
          </div>
        </li>

        <li className="hero-story-stage hero-structure-stage" data-stage="structure">
          <StoryLabel {...STORY_STAGES[3]} />
          <div className="structure-stack structure-assemble" aria-hidden="true">
            <span data-row="role"><i>01</i>ROLE</span>
            <span data-row="objective"><i>02</i>OBJECTIVE</span>
            <span data-row="constraints"><i>03</i>CONSTRAINTS</span>
            <span data-row="output"><i>04</i>OUTPUT</span>
          </div>
        </li>

        <li className="hero-story-stage hero-prompt-stage" data-stage="prompt">
          <StoryLabel {...STORY_STAGES[4]} />
          <div className="hero-prompt-artifact" aria-hidden="true">
            <span className="prompt-conic-sweep" aria-hidden="true" />
            <div className="prompt-artifact-inner">
              <div className="prompt-artifact-head">
                <strong>PERFECT SYSTEM PROMPT</strong>
                <span>READY</span>
              </div>
              <h2>Launch strategist</h2>
              <p>OBJECTIVE</p>
              <i />
              <i />
              <p>CONSTRAINTS</p>
              <i />
              <i />
              <div className="prompt-artifact-seal">SPE / 01</div>
            </div>
          </div>
        </li>
      </ol>

      <figcaption className="visually-hidden">
        Human fragments become an idea, meaning, and a structured prompt through
        the compact SPE semantic engine.
      </figcaption>
    </figure>
  );
}
