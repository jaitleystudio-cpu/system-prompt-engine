export {
  synthesizeSystemPrompt,
  FREE_TIER_MAX_OUTPUT_CHARS,
  PRO_TIER_MAX_OUTPUT_CHARS,
  isVerifiedPaidEntitlementResult,
  enforceTierOutputLimit,
  compilePromptWithTierEnforcement,
} from "./promptSynthesizer.mjs";
export type DepthTier = "free" | "normal" | "mid" | "deep";
export const DEFAULT_DEPTH_TIER: DepthTier = "normal";
