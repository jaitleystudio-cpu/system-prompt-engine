/**
 * SPE Global Localization, Unicode, RTL, and Locale Registry Architecture.
 * Law: Language is NOT Country (BCP 47 language/script decoupled from ISO country/currency).
 * Direction: Native LTR and RTL (Arabic/Hebrew) bidirectional isolation.
 * COST ₹0. network_mode=NONE. not_a_release=true.
 */

export type Direction = "ltr" | "rtl";

export interface LocaleDefinition {
  readonly id: string; // BCP 47 identifier
  readonly language: string; // ISO 639-1 / 639-2
  readonly script: string; // ISO 15924
  readonly region?: string; // ISO 3166-1 optional region (NOT identity)
  readonly direction: Direction;
  readonly labelNative: string;
  readonly labelEnglish: string;
  readonly numberLocale: string;
  readonly dateLocale: string;
}

/**
 * Universal Core Law: Language != Country.
 * A language must never be conflated with a nation-state or geography.
 * Locales must support multi-country speakers and regional variants cleanly.
 */
export const LANGUAGE_IS_NOT_COUNTRY = true as const;

export const SUPPORTED_LOCALES: readonly LocaleDefinition[] = [
  {
    id: "en",
    language: "en",
    script: "Latn",
    direction: "ltr",
    labelNative: "English",
    labelEnglish: "English (Default)",
    numberLocale: "en-US",
    dateLocale: "en-US",
  },
  {
    id: "es",
    language: "es",
    script: "Latn",
    direction: "ltr",
    labelNative: "Español",
    labelEnglish: "Spanish",
    numberLocale: "es-ES",
    dateLocale: "es-ES",
  },
  {
    id: "ar",
    language: "ar",
    script: "Arab",
    direction: "rtl",
    labelNative: "العربية",
    labelEnglish: "Arabic",
    numberLocale: "ar-EG",
    dateLocale: "ar-EG",
  },
  {
    id: "ja",
    language: "ja",
    script: "Jpan",
    direction: "ltr",
    labelNative: "日本語",
    labelEnglish: "Japanese",
    numberLocale: "ja-JP",
    dateLocale: "ja-JP",
  },
  {
    id: "zh-Hans",
    language: "zh",
    script: "Hans",
    direction: "ltr",
    labelNative: "简体中文",
    labelEnglish: "Simplified Chinese",
    numberLocale: "zh-CN",
    dateLocale: "zh-CN",
  },
  {
    id: "hi",
    language: "hi",
    script: "Deva",
    direction: "ltr",
    labelNative: "हिन्दी",
    labelEnglish: "Hindi",
    numberLocale: "hi-IN",
    dateLocale: "hi-IN",
  },
  {
    id: "pt-BR",
    language: "pt",
    script: "Latn",
    region: "BR",
    direction: "ltr",
    labelNative: "Português",
    labelEnglish: "Portuguese (Brazil)",
    numberLocale: "pt-BR",
    dateLocale: "pt-BR",
  },
  {
    id: "de",
    language: "de",
    script: "Latn",
    direction: "ltr",
    labelNative: "Deutsch",
    labelEnglish: "German",
    numberLocale: "de-DE",
    dateLocale: "de-DE",
  },
  {
    id: "fr",
    language: "fr",
    script: "Latn",
    direction: "ltr",
    labelNative: "Français",
    labelEnglish: "French",
    numberLocale: "fr-FR",
    dateLocale: "fr-FR",
  },
] as const;

export const DEFAULT_LOCALE: LocaleDefinition = SUPPORTED_LOCALES[0];

const LOCALE_BY_ID = new Map<string, LocaleDefinition>(
  SUPPORTED_LOCALES.map((loc) => [loc.id.toLowerCase(), loc]),
);

const LOCALE_BY_LANG = new Map<string, LocaleDefinition>(
  SUPPORTED_LOCALES.map((loc) => [loc.language.toLowerCase(), loc]),
);

/**
 * Deterministic BCP 47 locale resolution with fallback chain:
 * 1. Exact match (e.g. "pt-BR")
 * 2. Primary language subtag match (e.g. "es-MX" -> "es")
 * 3. Default locale ("en")
 */
export function resolveLocale(rawTag?: string | null): LocaleDefinition {
  if (!rawTag || typeof rawTag !== "string") {
    return DEFAULT_LOCALE;
  }
  const clean = rawTag.trim().toLowerCase();
  if (LOCALE_BY_ID.has(clean)) {
    return LOCALE_BY_ID.get(clean)!;
  }
  const primary = clean.split("-")[0];
  if (LOCALE_BY_LANG.has(primary)) {
    return LOCALE_BY_LANG.get(primary)!;
  }
  return DEFAULT_LOCALE;
}

/**
 * Bidi First Strong Isolate (FSI U+2068) and Pop Directional Isolate (PDI U+2069).
 * Prevents untrusted or multilingual user text from leaking RTL/LTR context into surrounding UI.
 */
export const BIDI_FSI = "\u2068";
export const BIDI_PDI = "\u2069";

export function isolateBidi(text: string): string {
  if (!text) return "";
  return `${BIDI_FSI}${text}${BIDI_PDI}`;
}

export interface HreflangAlternate {
  hreflang: string;
  href: string;
}

/**
 * Genuine Publication Truth.
 * Registered locales in the taxonomy/system != published localized web pages.
 * A locale is only eligible for hreflang emission if:
 * 1. The localized route genuinely exists on the host.
 * 2. Full content translation is present (not fallback).
 * 3. The canonical localized URL resolves to real published content.
 *
 * Current genuinely published web locales: ["en"] only.
 */
export const PUBLISHED_LOCALES: readonly string[] = ["en"] as const;

export interface HreflangOptions {
  /** Explicit list of published locales for this specific route/page. Defaults to PUBLISHED_LOCALES. */
  publishedLocales?: readonly string[];
  /** Optional route mapper to verify/resolve localized route URL. */
  resolveLocalizedUrl?: (localeId: string, cleanBase: string) => string | null;
}

/**
 * Generates discovery hreflang alternates adhering to W3C / Search standards.
 * STRICT LAW: Only emits hreflang for genuinely published, existing localized pages.
 * Unearned / phantom hreflang claims are strictly rejected.
 */
export function buildHreflangAlternates(
  canonicalBaseUrl: string,
  options: HreflangOptions = {},
): HreflangAlternate[] {
  const published = new Set(options.publishedLocales ?? PUBLISHED_LOCALES);
  const url = new URL(canonicalBaseUrl);
  url.searchParams.delete("lang");
  const cleanBase = url.toString();

  const alternates: HreflangAlternate[] = [
    { hreflang: "x-default", href: cleanBase },
  ];

  if (published.has(DEFAULT_LOCALE.id)) {
    alternates.push({ hreflang: DEFAULT_LOCALE.id, href: cleanBase });
  }

  for (const loc of SUPPORTED_LOCALES) {
    if (loc.id === DEFAULT_LOCALE.id) continue;
    // Strict Gate: Registered locale without published route must NEVER emit hreflang
    if (!published.has(loc.id)) continue;

    const locHref = options.resolveLocalizedUrl
      ? options.resolveLocalizedUrl(loc.id, cleanBase)
      : null;

    if (locHref) {
      alternates.push({ hreflang: loc.id, href: locHref });
    }
  }

  return alternates;
}

/**
 * Injects or updates alternate hreflang tags into the document head.
 * Enforces removal of any false/unearned hreflang tags.
 */
export function applyHreflangTags(
  head: HTMLHeadElement,
  canonicalBaseUrl: string,
  options: HreflangOptions = {},
): void {
  const existing = head.querySelectorAll('link[rel="alternate"][hreflang]');
  const alternates = buildHreflangAlternates(canonicalBaseUrl, options);
  const targetHreflangs = new Set(alternates.map((a) => a.hreflang));

  existing.forEach((el) => {
    const hl = el.getAttribute("hreflang");
    if (hl && !targetHreflangs.has(hl)) {
      el.remove();
    }
  });

  for (const alt of alternates) {
    let el = head.querySelector(`link[rel="alternate"][hreflang="${alt.hreflang}"]`) as HTMLLinkElement | null;
    if (!el) {
      el = head.ownerDocument.createElement("link");
      el.rel = "alternate";
      el.hreflang = alt.hreflang;
      head.appendChild(el);
    }
    el.href = alt.href;
  }
}

/**
 * Core UI Message Catalog with key-based fallback resolution.
 */
export const MESSAGES: Record<string, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.create": "Create",
    "nav.code": "Code",
    "nav.lab": "Daily Lab",
    "nav.myWork": "My Work",
    "nav.capabilities": "Capabilities",
    "nav.privacy": "Privacy",
    "nav.buildPrompt": "Build my prompt",
    "action.shape": "Shape my prompt",
    "action.reset": "Reset",
    "privacy.tagline": "Your brief stays on this device.",
    "workspace.kicker": "Workspace",
    "workspace.title": "A space for your next idea",
  },
  es: {
    "nav.home": "Inicio",
    "nav.create": "Crear",
    "nav.code": "Código",
    "nav.lab": "Laboratorio Diario",
    "nav.myWork": "Mis Trabajos",
    "nav.capabilities": "Capacidades",
    "nav.privacy": "Privacidad",
    "nav.buildPrompt": "Construir mi prompt",
    "action.shape": "Dar forma a mi prompt",
    "action.reset": "Restablecer",
    "privacy.tagline": "Tu informe permanece en este dispositivo.",
    "workspace.kicker": "Espacio de trabajo",
    "workspace.title": "Un espacio para tu próxima idea",
  },
  ar: {
    "nav.home": "الرئيسية",
    "nav.create": "إنشاء",
    "nav.code": "الشيفرة",
    "nav.lab": "المختبر اليومي",
    "nav.myWork": "أعمالي",
    "nav.capabilities": "القدرات",
    "nav.privacy": "الخصوصية",
    "nav.buildPrompt": "بناء الموجه",
    "action.shape": "صياغة الموجه",
    "action.reset": "إعادة تعيين",
    "privacy.tagline": "بياناتك تبقى على هذا الجهاز دون مغادرة.",
    "workspace.kicker": "مساحة العمل",
    "workspace.title": "مساحة لفكرتك القادمة",
  },
  ja: {
    "nav.home": "ホーム",
    "nav.create": "作成",
    "nav.code": "コード",
    "nav.lab": "デイリーラボ",
    "nav.myWork": "マイワーク",
    "nav.capabilities": "機能",
    "nav.privacy": "プライバシー",
    "nav.buildPrompt": "プロンプトを作成",
    "action.shape": "プロンプトを成形",
    "action.reset": "リセット",
    "privacy.tagline": "入力データはこの端末内に保持されます。",
    "workspace.kicker": "ワークスペース",
    "workspace.title": "次のアイデアのための空間",
  },
  "zh-Hans": {
    "nav.home": "首页",
    "nav.create": "创建",
    "nav.code": "代码",
    "nav.lab": "每日实验室",
    "nav.myWork": "我的作品",
    "nav.capabilities": "能力",
    "nav.privacy": "隐私",
    "nav.buildPrompt": "构建提示词",
    "action.shape": "塑造提示词",
    "action.reset": "重置",
    "privacy.tagline": "您的指令仅保留在当前设备上。",
    "workspace.kicker": "工作区",
    "workspace.title": "容纳下一个创意的空间",
  },
  hi: {
    "nav.home": "होम",
    "nav.create": "बनाएं",
    "nav.code": "कोड",
    "nav.lab": "दैनिक लैब",
    "nav.myWork": "मेरा कार्य",
    "nav.capabilities": "क्षमताएं",
    "nav.privacy": "गोपनीयता",
    "nav.buildPrompt": "मेरा प्रॉम्प्ट बनाएं",
    "action.shape": "प्रॉम्प्ट को आकार दें",
    "action.reset": "रीसेट",
    "privacy.tagline": "आपका विवरण केवल इसी डिवाइस पर रहता है।",
    "workspace.kicker": "कार्यक्षेत्र",
    "workspace.title": "आपके अगले विचार के लिए स्थान",
  },
};

/**
 * Format message with fallback to default locale ("en") and raw key if missing.
 */
export function formatMessage(localeId: string, key: string): string {
  const resolved = resolveLocale(localeId);
  const table = MESSAGES[resolved.id] || MESSAGES[resolved.language] || MESSAGES[DEFAULT_LOCALE.id];
  if (table && key in table) {
    return table[key];
  }
  const defaultTable = MESSAGES[DEFAULT_LOCALE.id];
  if (defaultTable && key in defaultTable) {
    return defaultTable[key];
  }
  return key;
}
