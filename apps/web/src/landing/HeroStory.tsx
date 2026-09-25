import type { SceneState } from "../scene/SpeIntelligence";

type StoryStage =
  | "thought"
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
  { id: "thought", number: "00", label: "MESSY HUMAN THOUGHT" },
  { id: "idea", number: "01", label: "IDEA" },
  { id: "meaning", number: "02", label: "MEANING" },
  { id: "engine", number: "03", label: "SPE" },
  { id: "structure", number: "04", label: "STRUCTURE" },
  { id: "prompt", number: "05", label: "SYSTEM PROMPT" },
] as const satisfies ReadonlyArray<{
  id: StoryStage;
  number: string;
  label: string;
}>;

const ACTIVE_STAGE: Record<SceneState, StoryStage> = {
  IDLE: "thought",
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
      aria-label="SPE transforms messy human thought into an idea, meaning, structure, and a finished system prompt."
    >
      <div className="hero-story-heading" aria-hidden="true">
        <span>SEMANTIC COMPILE / LIVE MODEL</span>
        <span>FORM FOLLOWS INTENT</span>
      </div>

      <ol
        className="hero-story-flow spe-pipeline"
        aria-label="SPE transformation: messy thought to idea, meaning, semantic engine, structure, and system prompt"
      >
        <li className="hero-story-stage hero-thought-stage" data-stage="thought">
          <StoryLabel {...STORY_STAGES[0]} />
          <div className="human-fragments" aria-hidden="true">
            {FRAGMENTS}
            <span className="thought-scribble">Need this to feel clear…</span>
          </div>
        </li>

        <li className="hero-story-stage hero-idea-stage" data-stage="idea">
          <StoryLabel {...STORY_STAGES[1]} />
          <div className="idea-specimen" aria-hidden="true">
            <span className="idea-pulse" />
            <p>Launch with clarity</p>
          </div>
        </li>

        <li className="hero-story-stage hero-meaning-stage" data-stage="meaning">
          <StoryLabel {...STORY_STAGES[2]} />
          <div className="meaning-clusters" aria-hidden="true">
            <span>GOAL</span>
            <span>CONTEXT</span>
            <span>BOUNDARY</span>
            <span>QUESTION</span>
          </div>
        </li>

        <li
          className="hero-story-stage hero-story-engine-stage"
          data-stage="engine"
        >
          <StoryLabel {...STORY_STAGES[3]} />
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
          <StoryLabel {...STORY_STAGES[4]} />
          <div className="structure-stack" aria-hidden="true">
            <span><i>01</i>ROLE</span>
            <span><i>02</i>OBJECTIVE</span>
            <span><i>03</i>CONSTRAINTS</span>
            <span><i>04</i>OUTPUT</span>
          </div>
        </li>

        <li className="hero-story-stage hero-prompt-stage" data-stage="prompt">
          <StoryLabel {...STORY_STAGES[5]} />
          <div className="hero-prompt-artifact" aria-hidden="true">
            <div className="prompt-artifact-head">
              <strong>SYSTEM PROMPT</strong>
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

      <figcaption>
        Human fragments become an idea, meaning, and a structured prompt through
        the compact SPE semantic engine.
      </figcaption>
    </figure>
  );
}
