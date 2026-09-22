export type Depth = "EXPERIENCE" | "PRODUCT" | "INSPECT" | "PROOF";
export type Surface =
  | "WEB_HERO"
  | "WEB_WORKSPACE"
  | "MOBILE_APP"
  | "DESKTOP_APP"
  | "BROWSER_EXTENSION"
  | "AI_PLUGIN"
  | "CODING_PLUGIN"
  | "ONBOARDING"
  | "ERROR"
  | "PRIVACY"
  | "PROOF"
  | "SETTINGS"
  | "NOTIFICATION";
export type Risk =
  | "TECHNICAL_JARGON"
  | "NEGATIVE_FRAMING"
  | "LIMITATION_SIGNAL"
  | "CHEAPNESS_SIGNAL"
  | "MANIPULATIVE_PRAISE"
  | "UNFOUNDED_SUPERLATIVE"
  | "AMBIGUOUS_PROMISE"
  | "LOSS_OF_AGENCY"
  | "CULTURAL_RISK"
  | "BRAND_GENERICITY"
  | "CLAIM_OVERREACH"
  | "ACTION_CONFUSION";
export type AudienceContext = {
  surface: Surface;
  audience_state: "new" | "working" | "completed";
  task: string;
  user_goal: string;
  emotional_moment: "exploring" | "working" | "recovering";
  urgency: "normal" | "urgent";
  expertise: "general" | "technical";
  locale: string;
  available_space: "heading" | "support" | "action" | "body";
  disclosure_depth: Depth;
};
export type CopyIntent = {
  purpose:
    | "ATTRACT"
    | "EXPLAIN"
    | "GUIDE"
    | "CONFIRM"
    | "WARN"
    | "RECOVER"
    | "INVITE"
    | "RETURN";
  meaning: string;
  tone: "premium_human";
  claim_refs: string[];
};
export type CopyCandidate = { id: string; text: string; intent: CopyIntent };
export type InterpretationReview = {
  literal_meaning: string;
  likely_impression: string;
  emotional_effect: string;
  risks: Risk[];
  verdict: "PASS" | "REVIEW_REQUIRED";
  limits: string;
};
export type SurfaceCopy = {
  text: string;
  locale: "en";
  fallback: boolean;
  context: AudienceContext;
  review: InterpretationReview;
};
export const CLAIMS = {
  localPreparation:
    "Prompt preparation runs in a browser worker through WASM; user input is not sent to an AI provider.",
  offlineAfterCache:
    "Offline use requires a successful initial load and intact cached assets.",
  editableTemplates:
    "Editorial templates add task guidance. They do not infer missing facts or call a generative model.",
  portableFile:
    "An exported .spe file carries the request, explicit details and generated prompt with integrity metadata.",
  optionalHistory:
    "History is opt-in on this device. No prompt analytics are installed.",
  qualification:
    "Research preview; independent human-value and production qualification remain pending.",
} as const;
const rules: [Risk, RegExp][] = [
  [
    "UNFOUNDED_SUPERLATIVE",
    /world[’']?s (?:best|number (?:one|1))|award[- ]winning|\b10\/10\b|\b#1\b/i,
  ],
  [
    "MANIPULATIVE_PRAISE",
    /(?:you (?:are|have)|your mind).{0,35}(?:brilliant|rare|exceptional|beautiful mind)/i,
  ],
  [
    "CLAIM_OVERREACH",
    /\b\d+x\b|nothing important lost|everything you meant|perfect prompt|filling the gaps|understanding what you mean|we found what matters/i,
  ],
  [
    "LOSS_OF_AGENCY",
    /you must upgrade|you have no choice|don[’']t fall behind|you haven[’']t been here/i,
  ],
  [
    "AMBIGUOUS_PROMISE",
    /anything is possible|unlimited possibilities|guaranteed results/i,
  ],
  ["CHEAPNESS_SIGNAL", /cheap and simple|just a prompt generator/i],
  [
    "BRAND_GENERICITY",
    /unlock your potential|revolutionize your workflow|unleash the power|game[- ]changing/i,
  ],
  ["CULTURAL_RISK", /no[- ]brainer|insanely good|crazy simple/i],
];
export function reviewCopy(
  candidate: CopyCandidate,
  context: AudienceContext,
): InterpretationReview {
  const risks: Risk[] = rules
    .filter(([, rule]) => rule.test(candidate.text))
    .map(([risk]) => risk);
  if (
    ["EXPERIENCE", "PRODUCT"].includes(context.disclosure_depth) &&
    /\bWASM\b|\bABI\b|\bSHA-?256\b|semantic (?:pipeline|artifact|envelope)|raw thought|compile (?:your )?(?:semantic )?intent|prompt artifact|internal IR|typescript semantic fallback/i.test(
      candidate.text,
    )
  )
    risks.push("TECHNICAL_JARGON");
  if (
    context.disclosure_depth === "EXPERIENCE" &&
    /local only|no internet needed|requires no internet|runs on your system|no backend/i.test(
      candidate.text,
    )
  )
    risks.push("NEGATIVE_FRAMING", "LIMITATION_SIGNAL");
  const budget =
    context.available_space === "action"
      ? 6
      : context.available_space === "heading"
        ? context.surface === "MOBILE_APP"
          ? 9
          : 12
        : context.available_space === "support"
          ? context.surface === "MOBILE_APP"
            ? 22
            : 30
          : Infinity;
  if (
    !candidate.text.trim() ||
    candidate.text.trim().split(/\s+/).length > budget
  )
    risks.push("ACTION_CONFUSION");
  if (candidate.intent.claim_refs.some((key) => !(key in CLAIMS)))
    risks.push("CLAIM_OVERREACH");
  return {
    literal_meaning: candidate.intent.meaning,
    likely_impression:
      "Requires contextual editorial review; rules do not predict an individual's interpretation.",
    emotional_effect: "Not empirically measured.",
    risks: [...new Set(risks)],
    verdict: risks.length ? "REVIEW_REQUIRED" : "PASS",
    limits:
      "Heuristic screening, not human research or cultural certification.",
  };
}
export function adaptCopy(
  candidate: CopyCandidate,
  context: AudienceContext,
): SurfaceCopy {
  const review = reviewCopy(candidate, context);
  if (review.verdict !== "PASS")
    throw new Error(
      `Copy review required: ${candidate.id}: ${review.risks.join(", ")}`,
    );
  return {
    text: candidate.text,
    locale: "en",
    fallback: !/^en(?:-|$)/i.test(context.locale),
    context,
    review,
  };
}
