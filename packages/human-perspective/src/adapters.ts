import {
  adaptCopy,
  type AudienceContext,
  type CopyCandidate,
  type Surface,
} from "./policy";
import { ui } from "./copy";
/** Profiles are reusable contracts; they do not imply a shipped app or integration. */
const actions: Record<Surface, string> = {
  WEB_HERO: ui.start,
  WEB_WORKSPACE: ui.build,
  MOBILE_APP: ui.mobileAction,
  DESKTOP_APP: ui.build,
  BROWSER_EXTENSION: ui.extensionAction,
  AI_PLUGIN: ui.pluginAction,
  CODING_PLUGIN: ui.codingAction,
  ONBOARDING: ui.start,
  ERROR: ui.retry,
  PRIVACY: "See your privacy choices",
  PROOF: "See technical details",
  SETTINGS: "Review your preferences",
  NOTIFICATION: "Return to your idea",
};
export function actionForSurface(context: AudienceContext) {
  const candidate: CopyCandidate = {
    id: `action.${context.surface}`,
    text: actions[context.surface],
    intent: {
      purpose: "GUIDE",
      meaning:
        "Open or continue the explicitly named task; no background action or external sending is implied.",
      tone: "premium_human",
      claim_refs: [],
    },
  };
  return adaptCopy(candidate, { ...context, available_space: "action" });
}
