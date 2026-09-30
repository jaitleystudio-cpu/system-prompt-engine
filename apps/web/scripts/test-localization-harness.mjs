#!/usr/bin/env node
/**
 * SPE Global Localization and Multilingual Architecture Test Harness.
 * Validates BCP 47 locale registry, Language != Country law, RTL foundations,
 * bidi isolation, hreflang discovery alternates, and message fallbacks.
 * COST ₹0. network_mode=NONE. not_a_release=true.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LANGUAGE_IS_NOT_COUNTRY,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  resolveLocale,
  isolateBidi,
  BIDI_FSI,
  BIDI_PDI,
  buildHreflangAlternates,
  formatMessage,
} from "../../../packages/web-runtime/src/locales.ts";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");

console.log("Running Global Localization and Multilingual Architecture Harness...");

// 1. Language != Country Principle Enforcement
assert.equal(LANGUAGE_IS_NOT_COUNTRY, true, "Core Law: LANGUAGE_IS_NOT_COUNTRY must be true");
console.log("✓ Core Law verified: Language is decoupled from Country/geography.");

// 2. Supported Locales Coverage
assert(SUPPORTED_LOCALES.length >= 8, `Expected at least 8 locales, found ${SUPPORTED_LOCALES.length}`);
const localeIds = SUPPORTED_LOCALES.map((l) => l.id);
assert(localeIds.includes("en"), "en missing");
assert(localeIds.includes("es"), "es missing");
assert(localeIds.includes("ar"), "ar missing");
assert(localeIds.includes("ja"), "ja missing");
assert(localeIds.includes("zh-Hans"), "zh-Hans missing");
assert(localeIds.includes("hi"), "hi missing");
console.log(`✓ Supported locales verified (${localeIds.join(", ")}).`);

// 3. Direction and Script Integrity
const arLocale = SUPPORTED_LOCALES.find((l) => l.id === "ar");
assert(arLocale, "Arabic locale definition missing");
assert.equal(arLocale.direction, "rtl", "Arabic must have direction='rtl'");
assert.equal(arLocale.script, "Arab", "Arabic script must be Arab");

const enLocale = SUPPORTED_LOCALES.find((l) => l.id === "en");
assert.equal(enLocale.direction, "ltr", "English must have direction='ltr'");
console.log("✓ Reading direction contracts verified (RTL for Arabic, LTR for English/others).");

// 4. Fallback Chain Resolution
const fallbackTests = [
  { input: "es-MX", expectedId: "en" },
  { input: "es-ES", expectedId: "es" },
  { input: "ar-EG", expectedId: "ar" },
  { input: "ar-SA", expectedId: "en" },
  { input: "pt-BR", expectedId: "pt-BR" },
  { input: "pt-PT", expectedId: "en" },
  { input: "zh-Hans", expectedId: "zh-Hans" },
  { input: "zh-Hant", expectedId: "en" },
  { input: "unknown-XYZ", expectedId: "en" },
  { input: "", expectedId: "en" },
  { input: null, expectedId: "en" },
  { input: undefined, expectedId: "en" },
];

for (const t of fallbackTests) {
  const res = resolveLocale(t.input);
  assert.equal(res.id, t.expectedId, `resolveLocale("${t.input}") expected ${t.expectedId}, got ${res.id}`);
}
const traditional = resolveLocale("zh-Hant");
assert.notEqual(traditional.id, "zh-Hans");
assert.notEqual(traditional.script, "Hans");
const portugal = resolveLocale("pt-PT");
assert.notEqual(portugal.id, "pt-BR");
assert.notEqual(portugal.region, "BR");
const mexico = resolveLocale("es-MX");
assert.ok(!(mexico.id !== "es-MX" && mexico.numberLocale === "es-ES"));
console.log(`✓ Deterministic fallback resolution chain verified across ${fallbackTests.length} boundary cases.`);

// 5. Bidi First Strong Isolation
const bidiSample = "مرحبا بالعالم";
const isolated = isolateBidi(bidiSample);
assert.equal(isolated.startsWith(BIDI_FSI), true, "Must start with BIDI_FSI (U+2068)");
assert.equal(isolated.endsWith(BIDI_PDI), true, "Must end with BIDI_PDI (U+2069)");
assert.equal(isolateBidi(""), "");
assert.equal(isolateBidi("مرحبا").includes("مرحبا"), true);
for (const mark of ["\u202A", "\u202B", "\u202C", "\u202D", "\u202E"]) {
  const isolatedOverride = isolateBidi(`safe${mark}text`);
  assert.equal(isolatedOverride.includes(mark), false, "bidi override must not be accepted as content");
  assert.equal(isolatedOverride.startsWith(BIDI_FSI), true);
  assert.equal(isolatedOverride.endsWith(BIDI_PDI), true);
}
console.log("✓ Bidirectional First Strong Isolation (FSI/PDI) contracts verified.");

// 6. Strict Publication Truth Hreflang Alternates Generator
const testUrl = "https://systempromptengine.com/create";
const defaultAlternates = buildHreflangAlternates(testUrl);

// Assert only genuinely published routes are emitted (currently x-default and en)
assert.equal(defaultAlternates.length, 2, `Expected 2 alternates (x-default + en), got ${defaultAlternates.length}`);
assert(defaultAlternates.some((a) => a.hreflang === "x-default" && a.href === testUrl), "Missing x-default");
assert(defaultAlternates.some((a) => a.hreflang === "en" && a.href === testUrl), "Missing en alternate");

// Strict Negative Assertions: Unpublished registered locales MUST NEVER emit phantom hreflang
for (const unpublished of ["ar", "ja", "es", "zh-Hans", "hi", "pt-BR", "de", "fr"]) {
  assert(
    !defaultAlternates.some((a) => a.hreflang === unpublished),
    `Violation: Unpublished locale '${unpublished}' must NOT be emitted in hreflang`,
  );
}
console.log("✓ Strict publication truth verified: only published locales (x-default, en) emitted; 0 false hreflangs.");

// Fixture Test: When a localized route is genuinely published, verify hreflang emission
const fixtureAlternates = buildHreflangAlternates(testUrl, {
  publishedLocales: ["en", "es", "ja"],
  resolveLocalizedUrl: (locId, base) => `https://systempromptengine.com/${locId}/create`,
});
assert.equal(fixtureAlternates.length, 4, `Expected 4 alternates for fixture (x-default, en, es, ja), got ${fixtureAlternates.length}`);
assert(fixtureAlternates.some((a) => a.hreflang === "es" && a.href === "https://systempromptengine.com/es/create"));
assert(fixtureAlternates.some((a) => a.hreflang === "ja" && a.href === "https://systempromptengine.com/ja/create"));
assert(!fixtureAlternates.some((a) => a.hreflang === "ar"), "Unpublished ar must still be excluded in fixture");
assert.equal(buildHreflangAlternates(testUrl, { publishedLocales: [] }).length, 0);
const onlySpanish = buildHreflangAlternates(testUrl, {
  publishedLocales: ["es"],
  resolveLocalizedUrl: () => "https://systempromptengine.com/es/create",
});
assert.equal(
  onlySpanish.find((item) => item.hreflang === "x-default")?.href,
  "https://systempromptengine.com/es/create",
);
const nullResolver = buildHreflangAlternates(testUrl, {
  publishedLocales: ["es"],
  resolveLocalizedUrl: () => null,
});
assert.equal(nullResolver.some((item) => item.hreflang === "es"), false);
assert.equal(nullResolver.some((item) => item.hreflang === "x-default"), false);
console.log("✓ Fixture test verified: published localized routes successfully emit hreflang alternates.");

// 7. Message Formatting and Missing Key Fallback
assert.equal(formatMessage("en", "nav.home"), "Home");
assert.equal(formatMessage("es", "nav.home"), "Inicio");
assert.equal(formatMessage("ar", "nav.home"), "الرئيسية");
assert.equal(formatMessage("ja", "nav.home"), "ホーム");
const untranslated = { status: "untranslated", translated: false };
assert.deepEqual(formatMessage("unknown-lang", "nav.home"), untranslated);
assert.deepEqual(formatMessage("de", "nav.home"), untranslated);
assert.deepEqual(formatMessage("fr", "nav.home"), untranslated);
assert.deepEqual(formatMessage("pt-BR", "nav.home"), untranslated);
assert.deepEqual(formatMessage("BR", "nav.home"), untranslated);
assert.equal(formatMessage("en", "nonexistent.key"), "nonexistent.key", "Missing key returns raw key string");
console.log("✓ Translation catalog and key fallback resolution verified.");

// 8. CSS RTL Foundations
const indexCss = readFileSync(join(webRoot, "src/index.css"), "utf8");
assert(indexCss.includes('html[dir="rtl"]'), "Missing html[dir='rtl'] in index.css");
assert(indexCss.includes("direction: rtl"), "Missing direction: rtl in index.css");
assert(indexCss.includes("bdi"), "Missing bdi isolation rule in index.css");
console.log("✓ CSS RTL direction and layout mirroring foundations verified.");

console.log("\nALL GLOBAL LOCALIZATION ARCHITECTURE CHECKS PASSED (100%).");
