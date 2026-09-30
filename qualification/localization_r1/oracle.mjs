/**
 * Localization R1 oracles.
 * They execute the donor locale module. They do not rewrite it.
 * An empty failure list is a pass. A failure is preserved evidence.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = process.env.L10N_REPO_ROOT
  ? resolve(process.env.L10N_REPO_ROOT)
  : resolve(here, "../..");
const CANONICAL = "https://systempromptengine.com/create";
const ES_URL = "https://systempromptengine.com/es/create";
const UNPUBLISHED = ["es", "ar", "ja", "zh-Hans", "hi", "pt-BR", "de", "fr"];
const RTL = "مرحبا";
const OVERRIDES = [
  ["\u202A", "U+202A LRE"],
  ["\u202B", "U+202B RLE"],
  ["\u202C", "U+202C PDF"],
  ["\u202D", "U+202D LRO"],
  ["\u202E", "U+202E RLO"],
];

function markedUntranslated(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.status === "untranslated" &&
      value.translated === false,
  );
}

function codes(alternates) {
  return alternates.map((item) => item.hreflang);
}

export async function loadModule(modulePath) {
  const href = pathToFileURL(modulePath).href;
  return import(`${href}?l10n=${Date.now()}-${Math.random()}`);
}

export function runOracles(mod) {
  const failures = {
    unpublished_registered_locales_omitted: unpublishedRegisteredLocalesOmitted(mod),
    published_localized_route_can_emit: publishedLocalizedRouteCanEmit(mod),
    published_without_resolver_does_not_invent: publishedWithoutResolverDoesNotInvent(mod),
    resolver_null_does_not_invent: resolverNullDoesNotInvent(mod),
    default_alternates_point_at_published_canonical: defaultAlternatesPointAtPublishedCanonical(mod),
    canonical_en_emitted_when_published: canonicalEnEmittedWhenPublished(mod),
    hreflang_tags_are_registered_or_xdefault: hreflangTagsAreRegisteredOrXdefault(mod),
    hreflang_codes_are_unique: hreflangCodesAreUnique(mod),
    publication_registry_is_published_en_only: publicationRegistryIsPublishedEnOnly(mod),
    rtl_text_preserved_inside_isolate: rtlTextPreservedInsideIsolate(mod),
    isolation_wraps_fsi_pdi: isolationWrapsFsiPdi(mod),
    isolation_uses_fsi_not_override: isolationUsesFsiNotOverride(mod),
    ltr_neighbors_stay_outside_isolate: ltrNeighborsStayOutsideIsolate(mod),
    exact_locale_identity_kept: exactLocaleIdentityKept(mod),
    translated_catalog_kept: translatedCatalogKept(mod),
    missing_key_is_not_empty_string: missingKeyIsNotEmptyString(mod),
    missing_key_is_not_english_gloss: missingKeyIsNotEnglishGloss(mod),
    semantic_authority_not_elevated: semanticAuthorityNotElevated(mod),
    fallback_locale_id_is_registered: fallbackLocaleIdIsRegistered(mod),
    language_is_not_country: languageIsNotCountry(mod),
    seo_head_uses_default_publication: seoHeadUsesDefaultPublication(),
    app_routes_have_no_localized_prefix: appRoutesHaveNoLocalizedPrefix(),
    bdi_isolate_does_not_set_page_ltr_to_rtl: bdiIsolateDoesNotSetPageLtrToRtl(),
    untranslated_locale_stays_marked: untranslatedLocaleStaysMarked(mod),
    empty_catalog_value_is_not_success: emptyCatalogValueIsNotSuccess(mod),
    locale_fallback_does_not_change_script_or_region: localeFallbackDoesNotChangeScriptOrRegion(mod),
    bidi_override_not_accepted_as_content: bidiOverrideNotAcceptedAsContent(mod),
    region_is_not_a_translation: regionIsNotATranslation(mod),
    x_default_withheld_when_nothing_is_published: xDefaultWithheldWhenNothingIsPublished(mod),
    x_default_target_is_a_published_locale_url: xDefaultTargetIsAPublishedLocaleUrl(mod),
  };
  const report = {};
  for (const [name, rows] of Object.entries(failures)) {
    report[name] = { pass: rows.length === 0, failures: rows };
  }
  return report;
}

function unpublishedRegisteredLocalesOmitted(mod) {
  const emitted = codes(mod.buildHreflangAlternates(CANONICAL));
  const failures = [];
  for (const locale of UNPUBLISHED) {
    if (emitted.includes(locale)) {
      failures.push(`default hreflang emitted registered unpublished locale ${locale}`);
    }
  }
  const explicit = codes(mod.buildHreflangAlternates(CANONICAL, { publishedLocales: ["en"] }));
  for (const locale of UNPUBLISHED) {
    if (explicit.includes(locale)) {
      failures.push(`publishedLocales ['en'] still emitted ${locale}`);
    }
  }
  return failures;
}

function publishedLocalizedRouteCanEmit(mod) {
  const alternates = mod.buildHreflangAlternates(CANONICAL, {
    publishedLocales: ["en", "es"],
    resolveLocalizedUrl: (localeId) => (localeId === "es" ? ES_URL : null),
  });
  const spanish = alternates.find((item) => item.hreflang === "es");
  const failures = [];
  if (!spanish) {
    failures.push("published es route was not emitted");
  } else if (spanish.href !== ES_URL) {
    failures.push(`published es href ${spanish.href} != ${ES_URL}`);
  }
  if (alternates.some((item) => item.hreflang === "ar")) {
    failures.push("unpublished ar was emitted beside a real es route");
  }
  return failures;
}

function publishedWithoutResolverDoesNotInvent(mod) {
  const alternates = mod.buildHreflangAlternates(CANONICAL, {
    publishedLocales: ["en", "es", "ar"],
  });
  const failures = [];
  for (const locale of ["es", "ar"]) {
    if (alternates.some((item) => item.hreflang === locale)) {
      failures.push(`invented hreflang for ${locale} without a resolved route`);
    }
  }
  for (const item of alternates) {
    if (String(item.href).includes("invented") || String(item.href).includes("unpublished.example")) {
      failures.push(`invented href ${item.href}`);
    }
  }
  return failures;
}

function resolverNullDoesNotInvent(mod) {
  const alternates = mod.buildHreflangAlternates(CANONICAL, {
    publishedLocales: ["en", "es"],
    resolveLocalizedUrl: () => null,
  });
  if (alternates.some((item) => item.hreflang === "es")) {
    return ["resolver returned null and es was still emitted"];
  }
  return [];
}

function defaultAlternatesPointAtPublishedCanonical(mod) {
  const alternates = mod.buildHreflangAlternates(`${CANONICAL}?lang=es`);
  const failures = [];
  if (alternates.length === 0) {
    failures.push("default publication emitted no alternates");
  }
  for (const item of alternates) {
    if (item.href !== CANONICAL) {
      failures.push(`${item.hreflang} href ${item.href} != published canonical ${CANONICAL}`);
    }
  }
  return failures;
}

function canonicalEnEmittedWhenPublished(mod) {
  const english = mod.buildHreflangAlternates(CANONICAL).find((item) => item.hreflang === "en");
  if (!english) return ["canonical en alternate was dropped"];
  if (english.href !== CANONICAL) return [`canonical en href ${english.href} != ${CANONICAL}`];
  return [];
}

function hreflangTagsAreRegisteredOrXdefault(mod) {
  const allowed = new Set(["x-default", ...mod.SUPPORTED_LOCALES.map((locale) => locale.id)]);
  const groups = [
    mod.buildHreflangAlternates(CANONICAL),
    mod.buildHreflangAlternates(CANONICAL, {
      publishedLocales: ["en", "es"],
      resolveLocalizedUrl: (localeId) => (localeId === "es" ? ES_URL : null),
    }),
  ];
  const failures = [];
  for (const alternates of groups) {
    for (const item of alternates) {
      if (!allowed.has(item.hreflang)) {
        failures.push(`fabricated hreflang tag ${item.hreflang}`);
      }
      if (/^[A-Z]{2}$/.test(item.hreflang) || item.hreflang === "BR" || item.hreflang === "eng") {
        failures.push(`invalid hreflang tag ${item.hreflang}`);
      }
    }
  }
  return failures;
}

function hreflangCodesAreUnique(mod) {
  const emitted = codes(mod.buildHreflangAlternates(CANONICAL));
  if (new Set(emitted).size !== emitted.length) {
    return [`duplicate hreflang codes ${emitted.join(",")}`];
  }
  return [];
}

function publicationRegistryIsPublishedEnOnly(mod) {
  const published = [...mod.PUBLISHED_LOCALES];
  if (published.length !== 1 || published[0] !== "en") {
    return [`publication registry is ${JSON.stringify(published)}, not ["en"]`];
  }
  return [];
}

function rtlTextPreservedInsideIsolate(mod) {
  const isolated = mod.isolateBidi(RTL);
  if (!isolated.includes(RTL)) {
    return [`RTL text was stripped from isolate output ${JSON.stringify(isolated)}`];
  }
  return [];
}

function isolationWrapsFsiPdi(mod) {
  const isolated = mod.isolateBidi(RTL);
  const failures = [];
  if (!isolated.startsWith(mod.BIDI_FSI)) failures.push("isolate does not start with FSI U+2068");
  if (!isolated.endsWith(mod.BIDI_PDI)) failures.push("isolate does not end with PDI U+2069");
  return failures;
}

function isolationUsesFsiNotOverride(mod) {
  const isolated = mod.isolateBidi(RTL);
  const first = isolated.codePointAt(0);
  if (first !== 0x2068) {
    return [`isolate opened with U+${(first || 0).toString(16)} instead of FSI U+2068`];
  }
  return [];
}

function ltrNeighborsStayOutsideIsolate(mod) {
  const head = "Alpha";
  const tail = "Omega";
  const isolated = mod.isolateBidi(RTL);
  const joined = `${head}${isolated}${tail}`;
  const failures = [];
  if (!joined.startsWith(head)) failures.push("LTR head was rewritten");
  if (!joined.endsWith(tail)) failures.push("LTR tail was rewritten");
  const open = joined.indexOf(mod.BIDI_FSI);
  const close = joined.lastIndexOf(mod.BIDI_PDI);
  if (open !== head.length) failures.push(`FSI opened at ${open}, expected ${head.length}`);
  if (close < 0 || joined.slice(close + mod.BIDI_PDI.length) !== tail) {
    failures.push("LTR tail is not outside the isolate");
  }
  return failures;
}

function exactLocaleIdentityKept(mod) {
  const expected = ["en", "es", "ar", "ja", "zh-Hans", "hi", "pt-BR", "de", "fr"];
  const failures = [];
  for (const localeId of expected) {
    const resolved = mod.resolveLocale(localeId);
    if (resolved.id !== localeId) {
      failures.push(`resolveLocale(${localeId}) returned ${resolved.id}`);
    }
  }
  return failures;
}

function translatedCatalogKept(mod) {
  const expected = [
    ["en", "nav.home", "Home"],
    ["es", "nav.home", "Inicio"],
    ["ar", "nav.home", "الرئيسية"],
    ["ja", "nav.home", "ホーム"],
    ["zh-Hans", "nav.home", "首页"],
    ["hi", "nav.home", "होम"],
  ];
  const failures = [];
  for (const [localeId, key, text] of expected) {
    const value = mod.formatMessage(localeId, key);
    if (value !== text) {
      failures.push(`formatMessage(${localeId}, ${key}) returned ${JSON.stringify(value)} != ${JSON.stringify(text)}`);
    }
  }
  return failures;
}

function missingKeyIsNotEmptyString(mod) {
  const failures = [];
  for (const localeId of ["en", "es", "de"]) {
    const value = mod.formatMessage(localeId, "missing.key");
    if (value === "") {
      failures.push(`formatMessage(${localeId}, missing.key) returned an empty string`);
    }
  }
  return failures;
}

function missingKeyIsNotEnglishGloss(mod) {
  const english = mod.formatMessage("en", "nav.home");
  const failures = [];
  for (const localeId of ["en", "es", "de"]) {
    const value = mod.formatMessage(localeId, "missing.key");
    if (value === english || value === "Home" || value === "Inicio") {
      failures.push(`missing.key for ${localeId} was passed as translation ${JSON.stringify(value)}`);
    }
  }
  return failures;
}

function semanticAuthorityNotElevated(mod) {
  const failures = [];
  if (mod.SEMANTIC_AUTHORITY !== undefined && mod.SEMANTIC_AUTHORITY !== "NONE") {
    failures.push(`SEMANTIC_AUTHORITY is ${JSON.stringify(mod.SEMANTIC_AUTHORITY)}`);
  }
  const alternates = mod.buildHreflangAlternates(CANONICAL);
  for (const item of alternates) {
    for (const key of Object.keys(item)) {
      if (key !== "hreflang" && key !== "href") {
        failures.push(`hreflang alternate elevated field ${key}=${JSON.stringify(item[key])}`);
      }
    }
  }
  return failures;
}

function fallbackLocaleIdIsRegistered(mod) {
  const allowed = new Set(mod.SUPPORTED_LOCALES.map((locale) => locale.id));
  const failures = [];
  for (const raw of ["unknown-lang", "", null, undefined, "zz-ZZ"]) {
    const resolved = mod.resolveLocale(raw);
    if (!allowed.has(resolved.id)) {
      failures.push(`resolveLocale(${JSON.stringify(raw)}) fabricated id ${resolved.id}`);
    }
  }
  return failures;
}

function languageIsNotCountry(mod) {
  if (mod.LANGUAGE_IS_NOT_COUNTRY !== true) {
    return [`LANGUAGE_IS_NOT_COUNTRY is ${JSON.stringify(mod.LANGUAGE_IS_NOT_COUNTRY)}`];
  }
  return [];
}

function seoHeadUsesDefaultPublication() {
  const text = readFileSync(join(REPO, "apps/web/src/ui/SeoHead.tsx"), "utf8");
  const failures = [];
  if (!text.includes("applyHreflangTags(document.head, url)")) {
    failures.push("SeoHead does not apply hreflang from the canonical URL");
  }
  if (text.includes("publishedLocales")) {
    failures.push("SeoHead passes an explicit publication list");
  }
  return failures;
}

function appRoutesHaveNoLocalizedPrefix() {
  const text = readFileSync(join(REPO, "apps/web/src/routing.ts"), "utf8");
  const paths = [...text.matchAll(/path:\s*"([^"]+)"/g)].map((match) => match[1]);
  const failures = [];
  if (!paths.includes("/create") || !paths.includes("/")) {
    failures.push(`route table missing canonical paths: ${paths.join(",")}`);
  }
  for (const path of paths) {
    if (/^\/(es|ar|ja|hi|de|fr|pt-BR|zh-Hans)(\/|$)/.test(path)) {
      failures.push(`localized route is published at ${path}`);
    }
  }
  return failures;
}

function bdiIsolateDoesNotSetPageLtrToRtl() {
  const css = readFileSync(join(REPO, "apps/web/src/index.css"), "utf8");
  const failures = [];
  if (!css.includes('html[dir="rtl"]') || !css.includes("unicode-bidi: isolate")) {
    failures.push("RTL document selector or bdi isolate rule is missing");
  }
  const outside = css.replace(/html\[dir="rtl"\]\s*\{[^}]*\}/g, "");
  if (outside.includes("direction: rtl")) {
    failures.push("direction:rtl is set outside html[dir=rtl]");
  }
  return failures;
}

function untranslatedLocaleStaysMarked(mod) {
  const english = mod.MESSAGES.en["nav.home"];
  const failures = [];
  for (const localeId of ["de", "fr", "pt-BR", "unknown-lang"]) {
    const value = mod.formatMessage(localeId, "nav.home");
    if (markedUntranslated(value)) continue;
    failures.push(
      `${localeId}/nav.home returned ${JSON.stringify(value)} without {status:"untranslated", translated:false}; English gloss is ${JSON.stringify(english)}`,
    );
  }
  return failures;
}

function emptyCatalogValueIsNotSuccess(mod) {
  const probe = "probe.empty.l10n1";
  const table = mod.MESSAGES.en;
  const had = Object.prototype.hasOwnProperty.call(table, probe);
  const previous = table[probe];
  table[probe] = "";
  try {
    const value = mod.formatMessage("en", probe);
    if (value === "") {
      return [`empty catalog value for en/${probe} returned "" and was treated as a translation`];
    }
    if (!markedUntranslated(value)) {
      return [`empty catalog value returned ${JSON.stringify(value)} without an untranslated mark`];
    }
    return [];
  } finally {
    if (had) table[probe] = previous;
    else delete table[probe];
  }
}

function localeFallbackDoesNotChangeScriptOrRegion(mod) {
  const failures = [];
  const traditional = mod.resolveLocale("zh-Hant");
  if (traditional.id === "zh-Hans" || traditional.script === "Hans") {
    failures.push(`zh-Hant resolved to id=${traditional.id} script=${traditional.script}`);
  }
  const portugal = mod.resolveLocale("pt-PT");
  if (portugal.id === "pt-BR" || portugal.region === "BR") {
    failures.push(`pt-PT resolved to id=${portugal.id} region=${portugal.region ?? ""}`);
  }
  const mexico = mod.resolveLocale("es-MX");
  if (mexico.id !== "es-MX" && mexico.numberLocale === "es-ES") {
    failures.push(`es-MX resolved to id=${mexico.id} numberLocale=${mexico.numberLocale}`);
  }
  return failures;
}

function bidiOverrideNotAcceptedAsContent(mod) {
  const failures = [];
  for (const [mark, label] of OVERRIDES) {
    const isolated = mod.isolateBidi(`safe${mark}text`);
    if (isolated.includes(mark)) {
      failures.push(`${label} was accepted inside isolate output`);
    }
  }
  return failures;
}

function regionIsNotATranslation(mod) {
  const failures = [];
  const region = mod.formatMessage("BR", "nav.home");
  const english = mod.formatMessage("en", "nav.home");
  if (!markedUntranslated(region) && region === english) {
    failures.push(`region tag BR returned ${JSON.stringify(region)}, the same translation as en`);
  }
  const portugal = mod.resolveLocale("pt-PT");
  if (portugal.id === "pt-BR") {
    failures.push("pt-PT was treated as the pt-BR translation locale");
  }
  return failures;
}

function xDefaultWithheldWhenNothingIsPublished(mod) {
  const alternates = mod.buildHreflangAlternates(CANONICAL, { publishedLocales: [] });
  if (alternates.length !== 0) {
    return [`empty publication set still emitted ${JSON.stringify(alternates)}`];
  }
  return [];
}

function xDefaultTargetIsAPublishedLocaleUrl(mod) {
  const alternates = mod.buildHreflangAlternates(CANONICAL, {
    publishedLocales: ["es"],
    resolveLocalizedUrl: () => ES_URL,
  });
  const fallback = alternates.find((item) => item.hreflang === "x-default");
  if (!fallback) return [];
  if (fallback.href !== ES_URL) {
    return [`x-default href ${fallback.href} is not the only published route ${ES_URL}`];
  }
  return [];
}

async function main() {
  const modulePath = process.env.L10N_LOCALES_MODULE
    ? resolve(process.env.L10N_LOCALES_MODULE)
    : join(REPO, "packages/web-runtime/src/locales.ts");
  try {
    const mod = await loadModule(modulePath);
    process.stdout.write(`${JSON.stringify(runOracles(mod))}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stdout.write(`${JSON.stringify({ __error: message })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
