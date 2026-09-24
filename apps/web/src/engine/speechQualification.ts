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
    browser: "Chromium headless (Chrome)",
    apiPresent: "YES",
    micPermission: "YES",
    dictationSmoke: "FAIL",
    privacyNote:
      "2026-09-24 probe: SpeechRecognition API present; fake mic permission YES; dictation error=audio-capture (no real mic). Web Speech may proxy to a browser service. NOT QUALIFIED for production speech claims.",
    status: "IMPLEMENTATION_PRESENT",
  },
  {
    platform: "Chrome desktop (real device)",
    browser: "Chrome",
    apiPresent: "UNKNOWN",
    micPermission: "NOT_TESTED",
    dictationSmoke: "NOT_TESTED",
    privacyNote: "Requires founder/device run — box probe is not a substitute for real Chrome desktop qualification.",
    status: "NOT_TESTED",
  },
  {
    platform: "Safari desktop",
    browser: "Safari",
    apiPresent: "UNKNOWN",
    micPermission: "NOT_TESTED",
    dictationSmoke: "NOT_TESTED",
    privacyNote: "NOT_TESTED in this session.",
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
