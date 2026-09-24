/** Curated English source voice. Selection uses explicit task choice/current-session completion only. */
export const heroLibrary = {
  first: {
    title: "There is more in the idea",
    accent: "than one sentence holds.",
    support:
      "Start with what you want to do. SPE brings the request into focus — goals, boundaries, and open questions — so you leave with a clearer prompt.",
  },
  returning: {
    title: "What’s worth making",
    accent: "clearer today?",
    support:
      "Bring your next idea. Shape the details, review the prompt, and choose where to use it.",
  },
  creator: {
    title: "Give your idea",
    accent: "room to take shape.",
    support:
      "Bring the thought, the mood, the details that matter. Shape a prompt that keeps them in view.",
  },
  builder: {
    title: "Good ideas deserve",
    accent: "a clear way forward.",
    support:
      "Turn your requirements into a detailed prompt. Keep the boundaries visible and the next steps concrete.",
  },
  researcher: {
    title: "A thoughtful question",
    accent: "is a place to begin.",
    support:
      "Set the question, evidence needs and open uncertainties. Shape a prompt you can review before taking it further.",
  },
  business: {
    title: "Give the next move",
    accent: "a clearer direction.",
    support:
      "Bring your goal, resources and limits. Shape a prompt with a practical path to the result you need.",
  },
  discovery: {
    title: "Start with curiosity.",
    accent: "Give it a direction.",
    support:
      "Explore a template, add what matters to you, and review the instructions before you use them.",
  },
} as const;
export function selectHero(category: string, completedInSession = false) {
  if (category === "Coding" || category === "Website / 3D")
    return heroLibrary.builder;
  if (category === "Research" || category === "Analysis")
    return heroLibrary.researcher;
  if (category === "Business") return heroLibrary.business;
  if (["Creative", "Writing", "Image", "Video"].includes(category))
    return heroLibrary.creator;
  return completedInSession ? heroLibrary.returning : heroLibrary.first;
}
export const ui = {
  mobileHeroSupport:
    "Bring your idea and the details that matter. Shape a prompt you can review, refine and use.",
  start: "Start with an idea",
  input: "Start with the idea exactly as it comes to you.",
  build: "Build my prompt",
  working: "Building your prompt…",
  ready: "Your idea, given structure.",
  note: "Your words set the direction. Add the details that matter, then review what SPE suggests.",
  exactNote:
    "SPE uses editable templates, not a generative AI model. Preparing a prompt happens on this device; using it with another AI is your choice.",
  diagnosticTitle: "Technical details",
  howItWorks: "How preparation works",
  inspect: "See the details",
  privacyTitle: "Your thinking is yours.",
  privacyIntro:
    "Choose what you keep, where your work goes, and which AI you use.",
  fileTitle: "Take your thinking with you.",
  fileSupport:
    "Your SPE file keeps your goal, details and prompt together, ready to reopen when you need them.",
  claim: "Research preview. Review generated prompts before using them.",
  claimDetail:
    "Production qualification and independent human-value evaluation are pending.",
  errorTitle: "Your brief is still here.",
  errorSupport:
    "Something interrupted preparation. Review the details below, then try again.",
  integrityTitle: "Preparation stopped to protect your work.",
  integritySupport:
    "The engine file could not be verified. Reload the latest version before trying again.",
  conflictTitle: "A detail needs your review.",
  conflictSupport:
    "Resolve the conflict marked in your brief, then shape your prompt again.",
  timeoutSupport:
    "Preparation took too long. Your brief remains on this page. Try again.",
  retry: "Try again",
  review: "Review brief",
  extensionAction: "Turn this into a prompt",
  pluginAction: "Improve with SPE",
  mobileAction: "Shape my idea",
  codingAction: "Shape a build-ready prompt",
  phases: {
    loading_wasm: "Preparing your workspace…",
    verifying_integrity: "Checking that preparation can begin…",
    instantiating: "Getting ready…",
    ready: "Ready for your idea",
    evaluating: "Giving your brief structure…",
    done: "Your prompt is ready",
    unavailable: "Preparation was interrupted",
    idle: "Ready for your idea",
  },
} as const;
export function errorCopy(code: string) {
  if (code === "WASM_INTEGRITY_MISMATCH")
    return { title: ui.integrityTitle, support: ui.integritySupport };
  if (code === "BRIEF_NEEDS_REVIEW")
    return { title: ui.conflictTitle, support: ui.conflictSupport };
  return {
    title: ui.errorTitle,
    support: code === "WORKER_TIMEOUT" ? ui.timeoutSupport : ui.errorSupport,
  };
}
/** Canonical meanings bound to factual copy; wording changes must retain these facts. */
export const copyMeanings: Record<
  string,
  { meaning: string; claim_refs: string[] }
> = {
  [ui.exactNote]: {
    meaning:
      "Preparation uses local deterministic templates, not a generative model or remote semantic judge.",
    claim_refs: ["localPreparation", "editableTemplates"],
  },
  [ui.fileSupport]: {
    meaning:
      "Exported SPE files retain the request, explicit details and rendered prompt for later use.",
    claim_refs: ["portableFile"],
  },
  [ui.claim]: {
    meaning: "The product is a research preview; output requires user review.",
    claim_refs: ["qualification"],
  },
  [ui.claimDetail]: {
    meaning:
      "Production qualification and independent human-value testing have not been established.",
    claim_refs: ["qualification"],
  },
  [ui.integritySupport]: {
    meaning:
      "An unverified engine file stops preparation. A fresh verified version is needed before retrying.",
    claim_refs: ["localPreparation"],
  },
};
