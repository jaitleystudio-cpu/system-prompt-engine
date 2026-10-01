/**
 * Worldwide Global Languages Registry
 *
 * Defines the top 30 major global languages worldwide covering over 6 billion speakers.
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
  gu: {
    code: "gu",
    name: "Gujarati",
    nativeName: "ગુજરાતી",
    scriptFamily: "Gujarati",
    direction: "ltr",
    speakersEstimateMillions: 62,
  },
  kn: {
    code: "kn",
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    scriptFamily: "Kannada",
    direction: "ltr",
    speakersEstimateMillions: 50,
  },
  ml: {
    code: "ml",
    name: "Malayalam",
    nativeName: "മലയാളം",
    scriptFamily: "Malayalam",
    direction: "ltr",
    speakersEstimateMillions: 38,
  },
  pa: {
    code: "pa",
    name: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    scriptFamily: "Gurmukhi",
    direction: "ltr",
    speakersEstimateMillions: 125,
  },
  fa: {
    code: "fa",
    name: "Persian",
    nativeName: "فارسی",
    scriptFamily: "Arabic",
    direction: "rtl",
    speakersEstimateMillions: 80,
  },
  sw: {
    code: "sw",
    name: "Swahili",
    nativeName: "Kiswahili",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 80,
  },
  th: {
    code: "th",
    name: "Thai",
    nativeName: "ไทย",
    scriptFamily: "Thai",
    direction: "ltr",
    speakersEstimateMillions: 70,
  },
  pl: {
    code: "pl",
    name: "Polish",
    nativeName: "Polski",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 45,
  },
  uk: {
    code: "uk",
    name: "Ukrainian",
    nativeName: "Українська",
    scriptFamily: "Cyrillic",
    direction: "ltr",
    speakersEstimateMillions: 40,
  },
  nl: {
    code: "nl",
    name: "Dutch",
    nativeName: "Nederlands",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 25,
  },
  fil: {
    code: "fil",
    name: "Filipino",
    nativeName: "Wikang Filipino",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 85,
  },
  ha: {
    code: "ha",
    name: "Hausa",
    nativeName: "Harshen Hausa",
    scriptFamily: "Latin",
    direction: "ltr",
    speakersEstimateMillions: 85,
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
 * Checks if a language code is among the 30 qualified global languages.
 */
export function isGlobalLanguageSupported(code: string): boolean {
  const norm = (code || "").toLowerCase().trim();
  return Boolean(GLOBAL_LANGUAGES[norm]);
}

/**
 * 30 Global Currencies & Regional Dialect Keywords
 */
export const GLOBAL_CURRENCIES: Record<string, { code: string; symbol: string; terms: string[] }> = {
  INR: { code: "INR", symbol: "₹", terms: ["₹", "inr", "rs", "rupee", "rupees", "रुपये", "రూపాయలు", "రూపాయి", "ரூபாய்", "টাকা", "lakh", "crore", "हजार"] },
  USD: { code: "USD", symbol: "$", terms: ["$", "usd", "dollar", "dollars", "bucks"] },
  EUR: { code: "EUR", symbol: "€", terms: ["€", "eur", "euro", "euros"] },
  GBP: { code: "GBP", symbol: "£", terms: ["£", "gbp", "pound", "pounds", "quid"] },
  JPY: { code: "JPY", symbol: "¥", terms: ["¥", "jpy", "yen", "円"] },
  CNY: { code: "CNY", symbol: "¥", terms: ["cny", "rmb", "yuan", "元", "块"] },
  BRL: { code: "BRL", symbol: "R$", terms: ["r$", "brl", "real", "reais"] },
  RUB: { code: "RUB", symbol: "₽", terms: ["₽", "rub", "ruble", "рубль", "рублей"] },
  KRW: { code: "KRW", symbol: "₩", terms: ["₩", "krw", "won", "원"] },
  TRY: { code: "TRY", symbol: "₺", terms: ["₺", "try", "lira", "türk lirası"] },
  VND: { code: "VND", symbol: "₫", terms: ["₫", "vnd", "dong", "đồng"] },
  IDR: { code: "IDR", symbol: "Rp", terms: ["rp", "idr", "rupiah"] },
  NGN: { code: "NGN", symbol: "₦", terms: ["₦", "ngn", "naira"] },
  THB: { code: "THB", symbol: "฿", terms: ["฿", "thb", "baht", "บาท"] },
  PLN: { code: "PLN", symbol: "zł", terms: ["zł", "pln", "zloty", "złoty"] },
  UAH: { code: "UAH", symbol: "₴", terms: ["₴", "uah", "hryvnia", "гривня"] },
  SAR: { code: "SAR", symbol: "﷼", terms: ["sar", "riyal", "ريال"] },
  AED: { code: "AED", symbol: "د.إ", terms: ["aed", "dirham", "درهم"] },
  MXN: { code: "MXN", symbol: "Mex$", terms: ["peso", "pesos"] },
  PHP: { code: "PHP", symbol: "₱", terms: ["₱", "php", "piso", "peso"] },
};

/**
 * Relative or ambiguous deadline expressions that require clarification
 */
export const GLOBAL_RELATIVE_DEADLINES = [
  "friday", "next friday", "this friday", "tomorrow", "next monday", "this weekend", "by evening", "soon",
  "शुक्रवार", "अगले शुक्रवार", "कल", "शाम तक",
  "శుక్రవారం", "వచ్చే శుక్రవారం", "రేపు", "సాయంత్రానికి",
  "வெள்ளிக்கிழமை", "நாளை",
  "الجمعة", "الجمعة القادمة", "غدا", "مساء",
  "周五", "下周五", "明天", "晚上",
  "vendredi", "demain", "ce soir",
  "viernes", "mañana", "por la tarde",
  "freitag", "morgen", "heute abend",
  "sexta-feira", "amanhã",
  "пятница", "завтра", "к вечеру",
];

/**
 * Dialect agreement confirmation markers across global languages
 */
export const GLOBAL_AGREEMENT_MARKERS = [
  "deal", "agreed", "done", "fine", "ok", "pakka", "chalega", "theek hai", "manzoor", "kabool",
  "సరే", "ఒప్పుకున్నాను", "ఖరారు",
  "சரி", "ஒப்புக்கொண்டேன்",
  "d'accord", "marché conclu", "entendu",
  "de acuerdo", "trato hecho", "vale",
  "abgemacht", "einverstanden", "passt",
  "fechado", "concordo", "trato feito",
  "согласен", "договорились", "по рукам",
  "اتفقنا", "موافق", "تم الاتفاق",
  "成交", "好的", "一言为定",
  "좋아요", "합의", "동의합니다",
  "tamam", "anlaştık", "olur",
  "setuju", "sepakat", "oke",
];

export interface DialogueTurn {
  speaker: string;
  text: string;
  turnIndex: number;
}

/**
 * Parses conversational dialogue into structured turns
 */
export function parseDialogueTurns(transcript: string): DialogueTurn[] {
  const turns: DialogueTurn[] = [];
  const lines = transcript.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let turnIndex = 1;
  for (const line of lines) {
    let processLine = line;
    const turnPrefix = line.match(/^Turn\s*(\d+)[:\-]\s*(.*)$/i);
    let explicitTurnNumber: number | null = null;
    if (turnPrefix) {
      explicitTurnNumber = parseInt(turnPrefix[1], 10);
      processLine = turnPrefix[2].trim();
    }

    const speakerMatch = processLine.match(/^([^:\n]{2,30}):\s*(.*)$/);
    if (speakerMatch) {
      turns.push({
        speaker: speakerMatch[1].trim(),
        text: speakerMatch[2].trim(),
        turnIndex: explicitTurnNumber ?? turnIndex++,
      });
    } else if (turnPrefix) {
      turns.push({
        speaker: `Speaker ${explicitTurnNumber ? (explicitTurnNumber % 2 === 1 ? 1 : 2) : (turnIndex % 2 === 1 ? 1 : 2)}`,
        text: processLine,
        turnIndex: explicitTurnNumber ?? turnIndex++,
      });
    } else {
      turns.push({
        speaker: `Speaker ${turnIndex % 2 === 1 ? 1 : 2}`,
        text: line,
        turnIndex: turnIndex++,
      });
    }
  }

  return turns.length > 0 ? turns : [{ speaker: "Speaker 1", text: transcript, turnIndex: 1 }];
}
