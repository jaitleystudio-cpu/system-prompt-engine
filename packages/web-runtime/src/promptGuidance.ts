/** Category-specific editorial guidance, not inferred facts or engine decisions. */
export const PROMPT_GUIDANCE: Record<
  string,
  { execution: string[]; checks: string[] }
> = {
  "AI Assistant": {
    execution: [
      "Turn the brief into a practical response plan: identify the requested action, the information available, the boundaries to respect and the form of a useful result. Carry out that plan instead of only describing what could be done.",
      "For a continuing conversation, retain established requirements and incorporate corrections. Resolve the current request without silently changing the role, inventing a policy or assuming access to an account, document or tool.",
      "Give concrete steps, examples or decision criteria when they help the user act. If several options matter, explain their tradeoffs and recommend one using the supplied priorities; avoid an unranked list of generic possibilities.",
    ],
    checks: [
      "Does the response actually fulfill the current request and preserve the user's boundaries?",
      "Are examples clearly distinguished from facts, and are next steps specific enough to use?",
    ],
  },
  Coding: {
    execution: [
      "Trace the relevant entry point, state changes, data flow and error handling. For a reported defect, reproduce it with a representative input and record expected versus actual behavior before choosing a fix.",
      "Preserve public interfaces and unrelated behavior. Explain necessary architecture changes, consider empty or malformed inputs, concurrent operations and cleanup, and use existing project conventions rather than adding unnecessary dependencies.",
      "Deliver executable code or a complete patch when implementation is requested. Include the configuration and integration steps needed to run it; do not replace essential logic with placeholders or omit the failing path.",
      "Choose regression checks that would fail before the fix and pass after it. Separate tests actually run from proposed commands, include their outcomes, and identify remaining environment or coverage limitations.",
    ],
    checks: [
      "Does the review, explanation or implementation address the actual requested task and relevant failure cases?",
      "Are setup, behavior changes and verification reproducible without guessing missing steps?",
    ],
  },
  Writing: {
    execution: [
      "Determine the central message, audience and desired reader action. Choose an outline appropriate to the requested medium, then produce the complete draft rather than an outline unless an outline was requested.",
      "Develop each important point with relevant specifics. Match the stated voice and length, remove redundant passages, and use placeholders only for essential missing details that cannot responsibly be supplied.",
    ],
    checks: [
      "Does the finished text serve the intended reader and preserve the requested tone and length?",
      "Are names, numbers, quotations and claims supported by supplied or verified information?",
    ],
  },
  Research: {
    execution: [
      "Define the scope, timeframe and comparison criteria from the question. Establish what each available source can support, check publication dates where relevant, and distinguish primary evidence from commentary.",
      "Organize findings around the actual research question. Explain agreements, conflicting evidence, methodological limitations and gaps; link claims to accessible sources and make recommendations proportional to the strength of evidence.",
    ],
    checks: [
      "Can the reader trace substantive claims to the cited evidence?",
      "Are unverified claims, unavailable sources and uncertainty clearly identified?",
    ],
  },
  Business: {
    execution: [
      "Use the stated budget, team capacity, timeline and objective to prioritize feasible actions. Separate required work from optional experiments and show dependencies before assigning a sequence.",
      "For each recommended action, explain its purpose, suggested owner, resource needs and observable outcome. Treat unknown costs and targets as estimates, and give a way to validate them before committing resources.",
    ],
    checks: [
      "Is the plan feasible within the actual stated constraints?",
      "Are priorities, dependencies, tradeoffs and success measures clear without fabricated market evidence?",
    ],
  },
  Education: {
    execution: [
      "Start from the learner's stated knowledge and explain any prerequisite needed for this lesson. Introduce the idea in plain language, work through an example and connect it to a practical application.",
      "Increase difficulty gradually and include an exercise aligned with the learning objective. Provide an answer or feedback approach when appropriate, and explain the misconception behind likely errors rather than merely marking them wrong.",
    ],
    checks: [
      "Are explanations and examples accurate and suitable for the learner?",
      "Does the practice activity test the intended skill without introducing unexplained prerequisites?",
    ],
  },
  Analysis: {
    execution: [
      "Inspect the input's units, definitions, missing values and coverage before calculating. Select a method suited to the question and state assumptions that materially affect the result.",
      "Show the relevant calculations or a reproducible method summary. Compare results against a useful baseline where one exists, distinguish correlation from causal evidence, and test sensitivity to important assumptions when applicable.",
    ],
    checks: [
      "Do calculations, units and denominators agree with the actual inputs?",
      "Are conclusions supported, with missing data and alternative interpretations acknowledged?",
    ],
  },
  "Structured Data": {
    execution: [
      "Map each required output field to its source, preserving types, identifiers and exact values where required. Follow the supplied rules for ordering, duplicates, nulls and missing records; do not invent a schema or a default value when that choice would change meaning.",
      "Validate the complete output against the requested schema or format before returning it. Keep explanatory prose, Markdown fences and extra keys out of machine-readable output unless the user explicitly requests them.",
    ],
    checks: [
      "Does the result parse and conform to the requested schema, field names and types?",
      "Can each output value be traced to supplied data or an explicitly authorized transformation?",
    ],
  },
  Creative: {
    execution: [
      "Choose a coherent concept that serves the brief's theme, medium and audience. Develop specific imagery, character, setting or structure as appropriate, keeping creative invention distinct from real-world factual claims.",
      "Deliver the complete requested work and revise for pacing, continuity, tone and a satisfying resolution. Avoid substituting a synopsis, generic advice or unrelated embellishment for the actual artifact.",
    ],
    checks: [
      "Does the work maintain its intended voice and internal consistency?",
      "Are required elements present and explicit restrictions respected?",
    ],
  },
  Multilingual: {
    execution: [
      "Identify the supplied source and target languages, register and locale requirements. Preserve names, quantities, formatting and specialized terminology; choose culturally natural phrasing without silently altering the original meaning.",
      "Review for omissions, false friends, tense and tone changes. Where ambiguity affects meaning, retain it or flag it in the permitted format; do not add commentary if translation-only output was requested.",
    ],
    checks: [
      "Is all source meaning retained without unsupported additions?",
      "Does terminology and register remain consistent throughout the translation?",
    ],
  },
  "Website / 3D": {
    execution: [
      "Define the main user journey and content hierarchy before adding visual effects. Connect layout, typography, lighting and motion to that journey; implement working controls and truthful empty, loading, error and success states.",
      "Validate responsive layouts, keyboard operation, focus visibility, touch targets and reduced motion. Bound rendering cost, dispose of graphics resources and provide a usable fallback when graphics capabilities or performance are limited.",
      "Review the rendered result at representative sizes and test the primary action end to end. Report measured performance and observed limitations rather than aesthetic ratings presented as facts.",
    ],
    checks: [
      "Can users complete the core task on mobile, keyboard and fallback paths?",
      "Do visual transitions reflect real application state and stay within measured performance limits?",
    ],
  },
  Image: {
    execution: [
      "Organize the image brief around the focal subject and its relationship to the setting. Specify framing, viewpoint, lighting direction, material behavior and visual hierarchy where they serve the stated intent.",
      "Keep requested text exact and clearly separate mandatory visual elements from optional stylistic suggestions. Describe a consistent scene that the target tool can render; avoid conflicting camera directions or unsupported claims about exact output fidelity.",
    ],
    checks: [
      "Are subject, composition and lighting mutually consistent?",
      "Are exact text, required elements and exclusions preserved without unrelated additions?",
    ],
  },
  Video: {
    execution: [
      "Build a coherent sequence with a clear beginning, development and ending. For each shot, describe subject action, framing, camera behavior and its transition to the next shot; use only durations supported by the brief.",
      "Maintain subject identity, setting and lighting continuity unless a change is intended. Separate visual direction from dialogue, sound and music requirements, and keep requested timing or aspect ratio consistent across the sequence.",
    ],
    checks: [
      "Can the sequence be followed without contradictory movement or continuity gaps?",
      "Do shot timing, transitions and audio requirements agree with the supplied brief?",
    ],
  },
};
