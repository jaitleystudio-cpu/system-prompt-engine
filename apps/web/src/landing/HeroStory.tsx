/**
 * Hero right-side illustration: founder-supplied PNG verbatim.
 * Story semantics IDEA → MEANING → SPE → STRUCTURE → PROMPT live in the art —
 * do not rebuild stations in markup.
 */
export function HeroStory() {
  return (
    <figure
      className="hero-story spe-pipeline"
      aria-label="SPE transforms messy human fragments into an idea, meaning, structure, and a perfect system prompt: IDEA, MEANING, SPE, STRUCTURE, PROMPT."
    >
      <div className="hero-story-plate">
        <img
          className="hero-story-art"
          src="/hero/founder-hero-story.png"
          width={1376}
          height={768}
          alt="SPE transformation story: messy human fragments become an idea; meaning is clarified; the SPE semantic engine structures it into role, objective, constraints, and output; a perfect system prompt emerges. Stages: IDEA, MEANING, SPE, STRUCTURE, PROMPT."
          decoding="async"
          fetchPriority="high"
        />
      </div>
      <figcaption className="visually-hidden">
        Founder illustration of the SPE journey: IDEA to MEANING to SPE to
        STRUCTURE to PROMPT.
      </figcaption>
    </figure>
  );
}
