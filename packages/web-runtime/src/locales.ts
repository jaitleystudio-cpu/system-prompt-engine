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

interface ParsedLocaleTag {
  readonly language: string;
  readonly script?: string;
  readonly region?: string;
}

function parseLocaleTag(clean: string): ParsedLocaleTag {
  const parts = clean.split("-").filter((part) => part.length > 0);
  const language = parts[0] ?? "";
  let script: string | undefined;
  let region: string | undefined;
  for (const part of parts.slice(1)) {
    if (!script && part.length === 4 && /^[a-z]{4}$/.test(part)) {
      script = part;
      continue;
    }
    if (!region && (part.length === 2 || /^\d{3}$/.test(part))) {
      region = part;
    }
  }
  return { language, script, region };
}

function impliedRegion(locale: LocaleDefinition): string | undefined {
  if (locale.region) return locale.region.toLowerCase();
  const parts = locale.numberLocale.toLowerCase().split("-");
  for (const part of parts.slice(1)) {
    if (part.length === 2 || /^\d{3}$/.test(part)) return part;
  }
  return undefined;
}

/**
 * Primary-language fallback is allowed only when it keeps the requested
 * script and region. zh-Hant must not become zh-Hans, pt-PT must not become
 * pt-BR, and es-MX must not inherit es-ES numbering.
 */
function compatibleLocale(clean: string): LocaleDefinition | undefined {
  const requested = parseLocaleTag(clean);
  if (!requested.language || (!requested.script && !requested.region)) return undefined;
  for (const locale of SUPPORTED_LOCALES) {
    if (locale.language.toLowerCase() !== requested.language) continue;
    if (requested.script && locale.script.toLowerCase() !== requested.script) continue;
    if (requested.region && impliedRegion(locale) !== requested.region) continue;
    return locale;
  }
  return undefined;
}

/**
 * Deterministic BCP 47 locale resolution:
 * 1. Exact registered id (e.g. "pt-BR", "zh-Hans")
 * 2. Primary language only when script and region stay compatible (e.g. "es-ES" -> "es")
 * 3. Default locale ("en") when a match would change script or region
 */
export function resolveLocale(rawTag?: string | null): LocaleDefinition {
  if (!rawTag || typeof rawTag !== "string") {
    return DEFAULT_LOCALE;
  }
  const clean = rawTag.trim().toLowerCase();
  if (LOCALE_BY_ID.has(clean)) {
    return LOCALE_BY_ID.get(clean)!;
  }
  const compatible = compatibleLocale(clean);
  if (compatible) return compatible;
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
  let isolated = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x202a && code <= 0x202e) continue;
    isolated += char;
  }
  return `${BIDI_FSI}${isolated}${BIDI_PDI}`;
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

function firstPublishedLocalizedHref(
  published: ReadonlySet<string>,
  canonicalBase: string,
  resolveLocalizedUrl: HreflangOptions["resolveLocalizedUrl"],
): string | null {
  if (!resolveLocalizedUrl) return null;
  for (const loc of SUPPORTED_LOCALES) {
    if (loc.id === DEFAULT_LOCALE.id || !published.has(loc.id)) continue;
    const href = resolveLocalizedUrl(loc.id, canonicalBase);
    if (href) return href;
  }
  return null;
}

/**
 * Generates discovery hreflang alternates adhering to W3C / Search standards.
 * STRICT LAW: Only emits hreflang for genuinely published, existing localized pages.
 * Unearned / phantom hreflang claims are strictly rejected.
 * x-default follows a published locale URL and is withheld when nothing is published.
 */
export function buildHreflangAlternates(
  canonicalBaseUrl: string,
  options: HreflangOptions = {},
): HreflangAlternate[] {
  const published = new Set(options.publishedLocales ?? PUBLISHED_LOCALES);
  const url = new URL(canonicalBaseUrl);
  url.searchParams.delete("lang");
  const canonicalBase = url.toString();
  let cleanBase = canonicalBase;

  if (published.size === 0) {
    return [];
  }

  if (!published.has(DEFAULT_LOCALE.id)) {
    const resolvedHref = firstPublishedLocalizedHref(
      published,
      canonicalBase,
      options.resolveLocalizedUrl,
    );
    if (!resolvedHref) return [];
    cleanBase = resolvedHref;
  }

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
      ? options.resolveLocalizedUrl(loc.id, canonicalBase)
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

export interface UntranslatedMessage {
  readonly status: "untranslated";
  readonly translated: false;
}

const UNTRANSLATED_MESSAGE: UntranslatedMessage = {
  status: "untranslated",
  translated: false,
};

function ownCatalog(resolved: LocaleDefinition): Record<string, string> | undefined {
  return MESSAGES[resolved.id] ?? MESSAGES[resolved.language];
}

/**
 * A missing key may return the key. An empty catalog value, a region tag,
 * or a locale without its own translation is not an English success.
 */
export function formatMessage(
  localeId: string,
  key: string,
): string | UntranslatedMessage {
  const resolved = resolveLocale(localeId);
  if (localeId.trim().toLowerCase() !== resolved.id.toLowerCase()) {
    return UNTRANSLATED_MESSAGE;
  }
  const table = ownCatalog(resolved);
  if (table && key in table) {
    const value = table[key];
    if (value.length > 0) return value;
    return UNTRANSLATED_MESSAGE;
  }
  if (!table && MESSAGES[DEFAULT_LOCALE.id]?.[key]) {
    return UNTRANSLATED_MESSAGE;
  }
  return key;
}

export type LocaleShipState =
  | "PUBLISHED"
  | "CATALOG_PRESENT_UNPUBLISHED"
  | "REGISTERED_NO_CATALOG";

export interface LocalePublicationRecord {
  readonly id: string;
  readonly state: LocaleShipState;
  readonly catalogKeyCount: number;
  readonly englishCopyKeyCount: number;
  readonly advertisedAsShipped: boolean;
}

/**
 * Registered catalogs are not shipped locales.
 * A locale is PUBLISHED only when it is in PUBLISHED_LOCALES, its catalog
 * covers every English key with a non-empty value, and a non-English catalog
 * is not a copy of the English strings. English remains the only published
 * locale until a route is actually shipped.
 */
export function localePublicationCensus(): {
  readonly published: readonly string[];
  readonly unpublished: readonly string[];
  readonly worldwideLocalizationPass: boolean;
  readonly records: readonly LocalePublicationRecord[];
} {
  const english = MESSAGES[DEFAULT_LOCALE.id] ?? {};
  const englishKeys = Object.keys(english);
  const advertised = new Set(
    buildHreflangAlternates("https://example.invalid/").map((row) => row.hreflang),
  );
  const records: LocalePublicationRecord[] = SUPPORTED_LOCALES.map((locale) => {
    const table = MESSAGES[locale.id];
    const catalogKeyCount = table ? Object.keys(table).length : 0;
    const englishCopyKeyCount = table
      ? englishKeys.filter((key) => table[key] === english[key] && table[key].length > 0).length
      : 0;
    const complete = Boolean(
      table &&
        englishKeys.every((key) => typeof table[key] === "string" && table[key].length > 0),
    );
    const flagged = PUBLISHED_LOCALES.includes(locale.id);
    const copyBlocksPublication = locale.id !== DEFAULT_LOCALE.id && englishCopyKeyCount > 0;
    const published = flagged && complete && !copyBlocksPublication;
    let state: LocaleShipState;
    if (published) state = "PUBLISHED";
    else if (catalogKeyCount > 0) state = "CATALOG_PRESENT_UNPUBLISHED";
    else state = "REGISTERED_NO_CATALOG";
    return {
      id: locale.id,
      state,
      catalogKeyCount,
      englishCopyKeyCount,
      advertisedAsShipped: advertised.has(locale.id),
    };
  });
  const published = records.filter((row) => row.state === "PUBLISHED").map((row) => row.id);
  const unpublished = records.filter((row) => row.state !== "PUBLISHED").map((row) => row.id);
  return {
    published,
    unpublished,
    worldwideLocalizationPass: published.length === SUPPORTED_LOCALES.length,
    records,
  };
}
