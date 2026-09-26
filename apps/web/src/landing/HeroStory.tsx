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
            <stop offset="0" stopColor="#8b714c" stopOpacity="0.08" />
            <stop offset="0.4" stopColor="#d8b779" stopOpacity="0.55" />
            <stop offset="1" stopColor="#f0d7a4" stopOpacity="0.18" />
          </linearGradient>
        </defs>
        <path d="M70 210 C220 198 310 240 420 236 S580 210 700 228 S860 250 950 236" />
        <path d="M90 268 C250 278 340 300 450 288 S620 250 740 268 S870 290 950 278" />
        <path d="M110 330 C270 340 360 320 470 318 S640 300 760 312 S880 330 950 320" />
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
            <div className="engine-seal" aria-hidden="true">
              <span className="engine-seal-ring" />
              <span className="engine-seal-core">
                <i className="engine-seal-glyph" />
              </span>
            </div>
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
