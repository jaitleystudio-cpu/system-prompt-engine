/** Device qualification matrix for Speech→Prompt. Honest NOT_TESTED where unproven. */

export type SpeechQualRow = {
  platform: string;
  browser: string;
  apiPresent: "YES" | "NO" | "UNKNOWN";
  micPermission: "YES" | "NO" | "UNKNOWN" | "NOT_TESTED";
  dictationSmoke: "PASS" | "FAIL" | "NOT_TESTED";
  privacyNote: string;
  status: "QUALIFIED" | "IMPLEMENTATION_PRESENT" | "NOT_TESTED" | "UNSUPPORTED";
};

/**
 * Box/CI cannot exercise real microphones. Rows below are documented honestly.
 * Do not claim on-device speech unless a device row is QUALIFIED with evidence.
 */
export const SPEECH_QUALIFICATION_MATRIX: SpeechQualRow[] = [
  {
    platform: "Linux box (CI / agent)",
    browser: "Chromium headless",
    apiPresent: "UNKNOWN",
    micPermission: "NOT_TESTED",
    dictationSmoke: "NOT_TESTED",
    privacyNote: "No mic hardware in this environment; Web Speech may proxy to a browser service.",
    status: "NOT_TESTED",
  },
  {
    platform: "macOS (founder device)",
    browser: "Safari / Chrome",
    apiPresent: "UNKNOWN",
    micPermission: "NOT_TESTED",
    dictationSmoke: "NOT_TESTED",
    privacyNote: "Browser speech services may leave the device — SPE does not claim on-device ASR.",
    status: "NOT_TESTED",
  },
  {
    platform: "Windows",
    browser: "Edge / Chrome",
    apiPresent: "UNKNOWN",
    micPermission: "NOT_TESTED",
    dictationSmoke: "NOT_TESTED",
    privacyNote: "Not qualified in this rebuild session.",
    status: "NOT_TESTED",
  },
  {
    platform: "Android",
    browser: "Chrome",
    apiPresent: "UNKNOWN",
    micPermission: "NOT_TESTED",
    dictationSmoke: "NOT_TESTED",
    privacyNote: "Not qualified in this rebuild session.",
    status: "NOT_TESTED",
  },
  {
    platform: "iOS",
    browser: "Safari",
    apiPresent: "UNKNOWN",
    micPermission: "NOT_TESTED",
    dictationSmoke: "NOT_TESTED",
    privacyNote: "Not qualified in this rebuild session.",
    status: "NOT_TESTED",
  },
];

export const SPEECH_CAPABILITY_STATUS =
  "IMPLEMENTATION_PRESENT / DEVICE_QUALIFICATION_PENDING" as const;
