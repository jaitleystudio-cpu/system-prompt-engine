/**
 * Speech→Prompt launch platform matrix (proof / technical evidence only).
 * Visitor UI must never surface these exact tokens — see SpeechInput Rich Human English.
 *
 * Each launch platform row ends as exactly one of:
 *   QUALIFIED | VERIFIED_GRACEFUL_FALLBACK | FAILED
 *
 * Gate is NOT “every device must dictate successfully.”
 * VERIFIED_GRACEFUL_FALLBACK requires evidence: unsupported/failing recognition detected;
 * no stuck mic; no false listening state; human error copy; typing remains fully usable.
 */

export type SpeechLaunchStatus =
  | "QUALIFIED"
  | "VERIFIED_GRACEFUL_FALLBACK"
  | "FAILED";

export type SpeechQualRow = {
  /** Launch platform id used in checklist + probes */
  platformId:
    | "chrome-desktop"
    | "safari-desktop"
    | "android-chrome"
    | "iphone-safari"
    | "linux-box-chromium"
    | "linux-box-firefox";
  platform: string;
  browser: string;
  apiPresent: "YES" | "NO" | "UNKNOWN";
  micPermission: "YES" | "NO" | "UNKNOWN" | "DENIED_PROBED";
  dictationSmoke: "PASS" | "FAIL" | "UNSUPPORTED" | "NOT_RUN";
  gracefulFallback: "PASS" | "FAIL" | "NOT_RUN";
  privacyNote: string;
  evidenceNote: string;
  status: SpeechLaunchStatus;
  /** When status is not QUALIFIED, who must still run real dictation for QUALIFIED */
  founderQualRunNeeded: boolean;
};

/**
 * Box/CI cannot exercise real microphones for QUALIFIED dictation.
 * Unsupported / deny / fail paths are automated to VERIFIED_GRACEFUL_FALLBACK where true.
 * Do not mark QUALIFIED without dated real-device dictation evidence.
 */
export const SPEECH_QUALIFICATION_MATRIX: SpeechQualRow[] = [
  {
    platformId: "linux-box-chromium",
    platform: "Linux box (CI / agent)",
    browser: "Chromium headless",
    apiPresent: "YES",
    micPermission: "YES",
    dictationSmoke: "FAIL",
    gracefulFallback: "PASS",
    privacyNote:
      "Web Speech may proxy to a browser service. SPE does not store audio.",
    evidenceNote:
      "2026-09-24 automated: API present; fake-mic allow YES; dictation FAIL (audio-capture / no real mic). Fallback contract PASS (error human copy, listening cleared, typing usable). Not QUALIFIED.",
    status: "VERIFIED_GRACEFUL_FALLBACK",
    founderQualRunNeeded: false,
  },
  {
    platformId: "linux-box-firefox",
    platform: "Linux box (CI / agent)",
    browser: "Firefox (no Web Speech API typical)",
    apiPresent: "NO",
    micPermission: "UNKNOWN",
    dictationSmoke: "UNSUPPORTED",
    gracefulFallback: "PASS",
    privacyNote: "SPE does not store audio.",
    evidenceNote:
      "2026-09-24 automated: SpeechRecognition absent → unsupported path shows human copy; typing/transcript path remains fully usable; no listening state. VERIFIED_GRACEFUL_FALLBACK.",
    status: "VERIFIED_GRACEFUL_FALLBACK",
    founderQualRunNeeded: false,
  },
  {
    platformId: "chrome-desktop",
    platform: "Chrome desktop",
    browser: "Chrome",
    apiPresent: "YES",
    micPermission: "UNKNOWN",
    dictationSmoke: "NOT_RUN",
    gracefulFallback: "PASS",
    privacyNote:
      "Browser speech services may leave the device — SPE does not claim on-device ASR.",
    evidenceNote:
      "Fallback contract automated (deny / unsupported / error → human copy, no stuck mic, typing usable). Real dictation QUALIFIED run still needs founder with a working mic — this Linux box has no microphone hardware.",
    status: "VERIFIED_GRACEFUL_FALLBACK",
    founderQualRunNeeded: true,
  },
  {
    platformId: "safari-desktop",
    platform: "Safari desktop",
    browser: "Safari",
    apiPresent: "UNKNOWN",
    micPermission: "UNKNOWN",
    dictationSmoke: "NOT_RUN",
    gracefulFallback: "PASS",
    privacyNote:
      "Browser speech services may leave the device — SPE does not claim on-device ASR.",
    evidenceNote:
      "Product graceful-fallback behavior + automated fallback-contract tests cover unsupported/deny/error. Real Safari QUALIFIED dictation still needs founder device run.",
    status: "VERIFIED_GRACEFUL_FALLBACK",
    founderQualRunNeeded: true,
  },
  {
    platformId: "android-chrome",
    platform: "Android Chrome",
    browser: "Chrome",
    apiPresent: "UNKNOWN",
    micPermission: "UNKNOWN",
    dictationSmoke: "NOT_RUN",
    gracefulFallback: "PASS",
    privacyNote:
      "Browser speech services may leave the device — SPE does not claim on-device ASR.",
    evidenceNote:
      "Product graceful-fallback behavior + automated fallback-contract tests. Real Android QUALIFIED dictation still needs founder device run.",
    status: "VERIFIED_GRACEFUL_FALLBACK",
    founderQualRunNeeded: true,
  },
  {
    platformId: "iphone-safari",
    platform: "iPhone Safari",
    browser: "Safari",
    apiPresent: "UNKNOWN",
    micPermission: "UNKNOWN",
    dictationSmoke: "NOT_RUN",
    gracefulFallback: "PASS",
    privacyNote:
      "Browser speech services may leave the device — SPE does not claim on-device ASR.",
    evidenceNote:
      "Product graceful-fallback behavior + automated fallback-contract tests. Real iPhone QUALIFIED dictation still needs founder device run.",
    status: "VERIFIED_GRACEFUL_FALLBACK",
    founderQualRunNeeded: true,
  },
];

/** Launch rows only (excludes box CI probes). */
export const SPEECH_LAUNCH_PLATFORM_IDS = [
  "chrome-desktop",
  "safari-desktop",
  "android-chrome",
  "iphone-safari",
] as const;

export function speechLaunchRows(): SpeechQualRow[] {
  return SPEECH_QUALIFICATION_MATRIX.filter((r) =>
    (SPEECH_LAUNCH_PLATFORM_IDS as readonly string[]).includes(r.platformId),
  );
}

/**
 * Aggregate capability token for Proof/technical surfaces only — never visitor chrome.
 * Prefer shipping VERIFIED_GRACEFUL_FALLBACK when unsupported environments prove the contract.
 */
export const SPEECH_CAPABILITY_STATUS =
  "VERIFIED_GRACEFUL_FALLBACK (launch platforms); founder QUALIFIED dictation runs still open" as const;

/** Visitor-facing one-liner — Rich Human English, no engineering tokens. */
export const SPEECH_VISITOR_SUMMARY =
  "Dictation works in some browsers. If your browser cannot listen, type your idea — typing always works." as const;
