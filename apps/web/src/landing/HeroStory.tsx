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

function StoryLabel({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <div className="hero-story-label">
      <span>{number}</span>
      <strong>{label}</strong>
    </div>
  );
}

export function HeroStory({ state, paused }: Props) {
  const activeStage = ACTIVE_STAGE[state];

  return (
    <figure
      className="hero-story"
      data-active-stage={activeStage}
      data-paused={paused ? "true" : "false"}
      aria-label="SPE transforms messy human fragments into an idea, meaning, structure, and a perfect system prompt."
    >
      <svg
        className="hero-flow-lines"
        viewBox="0 0 1000 500"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="story-flow-gold" x1="0" x2="1">
            <stop offset="0" stopColor="#8b714c" stopOpacity="0.15" />
            <stop offset="0.45" stopColor="#d8b779" stopOpacity="0.92" />
            <stop offset="1" stopColor="#f0d7a4" stopOpacity="0.46" />
          </linearGradient>
          <marker
            id="story-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#d8b779" opacity="0.72" />
          </marker>
        </defs>
        <path
          d="M55 138 C210 138 210 238 360 238 S525 180 650 218 S820 220 958 188"
          markerEnd="url(#story-arrow)"
        />
        <path
          d="M38 224 C182 224 238 280 365 266 S508 226 648 246 S815 246 958 224"
          markerEnd="url(#story-arrow)"
        />
        <path
          d="M68 318 C210 318 246 295 372 292 S510 274 648 272 S820 278 958 270"
          markerEnd="url(#story-arrow)"
        />
        <path
          d="M120 384 C245 376 282 324 390 318 S526 316 650 310 S826 324 958 316"
          markerEnd="url(#story-arrow)"
        />
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
            <span />
            <span />
            <span />
          </div>
          <div className="meaning-clusters" aria-hidden="true">
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
            <div className="engine-cap">
              <strong>SPE</strong>
              <span>SEMANTIC ENGINE</span>
            </div>
            <div className="engine-compiler">
              <span>PARSE</span>
              <i />
              <span>ALIGN</span>
              <i />
              <span>COMPILE</span>
            </div>
          </div>
        </li>

        <li className="hero-story-stage hero-structure-stage" data-stage="structure">
          <StoryLabel {...STORY_STAGES[3]} />
          <div className="structure-stack" aria-hidden="true">
            <span><i>01</i>ROLE</span>
            <span><i>02</i>OBJECTIVE</span>
            <span><i>03</i>CONSTRAINTS</span>
            <span><i>04</i>OUTPUT</span>
          </div>
        </li>

        <li className="hero-story-stage hero-prompt-stage" data-stage="prompt">
          <StoryLabel {...STORY_STAGES[4]} />
          <div className="hero-prompt-artifact" aria-hidden="true">
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
        </li>
      </ol>

      <figcaption className="visually-hidden">
        Human fragments become an idea, meaning, and a structured prompt through
        the compact SPE semantic engine.
      </figcaption>
    </figure>
  );
}
