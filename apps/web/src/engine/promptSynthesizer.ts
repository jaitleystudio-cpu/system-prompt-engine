export {
  synthesizeSystemPrompt,
  truncateCleanly,
  FREE_TIER_MAX_OUTPUT_CHARS,
  PRO_TIER_MAX_OUTPUT_CHARS,
  isVerifiedPaidEntitlementResult,
  resolveVerifiedEntitlementTier,
  enforceTierOutputLimit,
  compilePromptWithTierEnforcement,
} from "./promptSynthesizer.mjs";
export type DepthTier = "free" | "normal" | "mid" | "deep" | "ultra" | "massive" | "titan";
export const DEFAULT_DEPTH_TIER: DepthTier = "deep";
