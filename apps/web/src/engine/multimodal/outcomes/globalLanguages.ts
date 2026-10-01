/**
 * Worldwide Global Languages Registry
 *
 * Defines the top 20 major global languages worldwide covering over 5 billion speakers.
 * Provides lexical markers for oral promise extraction, medical directives,
 * form field parsing, and dispute cues across all major language families.
 */

import type { GlobalLanguageInfo } from "./types";

export const GLOBAL_LANGUAGES: Record<string, GlobalLanguageInfo> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 1500,
  },
  es: {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 550,
  },
  zh: {
    code: "zh",
    name: "Mandarin Chinese",
    nativeName: "中文",
    scriptFamily: "Han",
    direction: "ltr",
    speakersEstimateMillions: 1100,
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    scriptFamily: "Devanagari",
    direction: "ltr",
    speakersEstimateMillions: 610,
  },
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    scriptFamily: "Arabic",
    direction: "rtl",
    speakersEstimateMillions: 330,
  },
  bn: {
    code: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
    scriptFamily: "Bengali",
    direction: "ltr",
    speakersEstimateMillions: 275,
  },
  pt: {
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 260,
  },
  ru: {
    code: "ru",
    name: "Russian",
    nativeName: "Русский",
    scriptFamily: "Cyrillic",
    direction: "ltr",
    speakersEstimateMillions: 255,
  },
  ja: {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    scriptFamily: "Japanese",
    direction: "ltr",
    speakersEstimateMillions: 125,
  },
  de: {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 135,
  },
  fr: {
    code: "fr",
    name: "French",
    nativeName: "Français",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 280,
  },
  te: {
    code: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    scriptFamily: "Telugu",
    direction: "ltr",
    speakersEstimateMillions: 96,
  },
  ta: {
    code: "ta",
    name: "Tamil",
    nativeName: "தமிழ்",
    scriptFamily: "Tamil",
    direction: "ltr",
    speakersEstimateMillions: 86,
  },
  id: {
    code: "id",
    name: "Indonesian",
    nativeName: "Bahasa Indonesia",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 200,
  },
  ur: {
    code: "ur",
    name: "Urdu",
    nativeName: "اردو",
    scriptFamily: "Arabic",
    direction: "rtl",
    speakersEstimateMillions: 230,
  },
  ko: {
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
    scriptFamily: "Hangul",
    direction: "ltr",
    speakersEstimateMillions: 82,
  },
  it: {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 68,
  },
  tr: {
    code: "tr",
    name: "Turkish",
    nativeName: "Türkçe",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 85,
  },
  vi: {
    code: "vi",
    name: "Vietnamese",
    nativeName: "Tiếng Việt",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 85,
  },
  mr: {
    code: "mr",
    name: "Marathi",
    nativeName: "मराठी",
    scriptFamily: "Devanagari",
    direction: "ltr",
    speakersEstimateMillions: 95,
  },
};

/**
 * Resolves a language code (with fallback to English)
 */
export function getLanguageInfo(codeOrName: string): GlobalLanguageInfo {
  const norm = (codeOrName || "en").toLowerCase().trim();
  if (GLOBAL_LANGUAGES[norm]) {
    return GLOBAL_LANGUAGES[norm];
  }
  for (const lang of Object.values(GLOBAL_LANGUAGES)) {
    if (
      lang.name.toLowerCase() === norm ||
      lang.nativeName.toLowerCase() === norm
    ) {
      return lang;
    }
  }
  return GLOBAL_LANGUAGES.en;
}

/**
 * Checks if a language code is among the 20 qualified global languages.
 */
export function isGlobalLanguageSupported(code: string): boolean {
  const norm = (code || "").toLowerCase().trim();
  return Boolean(GLOBAL_LANGUAGES[norm]);
}
