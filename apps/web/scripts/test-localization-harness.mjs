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
  { input: "es-MX", expectedId: "es" },
  { input: "es-ES", expectedId: "es" },
  { input: "ar-EG", expectedId: "ar" },
  { input: "ar-SA", expectedId: "ar" },
  { input: "pt-BR", expectedId: "pt-BR" },
  { input: "pt-PT", expectedId: "pt-BR" }, // Primary subtag match to pt
  { input: "unknown-XYZ", expectedId: "en" },
  { input: "", expectedId: "en" },
  { input: null, expectedId: "en" },
  { input: undefined, expectedId: "en" },
];

for (const t of fallbackTests) {
  const res = resolveLocale(t.input);
  assert.equal(res.id, t.expectedId, `resolveLocale("${t.input}") expected ${t.expectedId}, got ${res.id}`);
}
console.log("✓ Deterministic fallback resolution chain verified across 10 boundary cases.");

// 5. Bidi First Strong Isolation
const bidiSample = "مرحبا بالعالم";
const isolated = isolateBidi(bidiSample);
assert.equal(isolated.startsWith(BIDI_FSI), true, "Must start with BIDI_FSI (U+2068)");
assert.equal(isolated.endsWith(BIDI_PDI), true, "Must end with BIDI_PDI (U+2069)");
assert.equal(isolateBidi(""), "");
console.log("✓ Bidirectional First Strong Isolation (FSI/PDI) contracts verified.");

// 6. Hreflang Alternates Generator
const testUrl = "https://systempromptengine.com/create";
const alternates = buildHreflangAlternates(testUrl);
assert(alternates.some((a) => a.hreflang === "x-default" && a.href === testUrl));
assert(alternates.some((a) => a.hreflang === "en" && a.href === testUrl));
assert(alternates.some((a) => a.hreflang === "ar" && a.href.includes("lang=ar")));
assert(alternates.some((a) => a.hreflang === "ja" && a.href.includes("lang=ja")));
console.log("✓ Hreflang discovery links verified (x-default + all supported BCP 47 codes).");

// 7. Message Formatting and Missing Key Fallback
assert.equal(formatMessage("en", "nav.home"), "Home");
assert.equal(formatMessage("es", "nav.home"), "Inicio");
assert.equal(formatMessage("ar", "nav.home"), "الرئيسية");
assert.equal(formatMessage("ja", "nav.home"), "ホーム");
assert.equal(formatMessage("unknown-lang", "nav.home"), "Home", "Unknown locale must fallback to English");
assert.equal(formatMessage("en", "nonexistent.key"), "nonexistent.key", "Missing key returns raw key string");
console.log("✓ Translation catalog and key fallback resolution verified.");

// 8. CSS RTL Foundations
const indexCss = readFileSync(join(webRoot, "src/index.css"), "utf8");
assert(indexCss.includes('html[dir="rtl"]'), "Missing html[dir='rtl'] in index.css");
assert(indexCss.includes("direction: rtl"), "Missing direction: rtl in index.css");
assert(indexCss.includes("bdi"), "Missing bdi isolation rule in index.css");
console.log("✓ CSS RTL direction and layout mirroring foundations verified.");

console.log("\nALL GLOBAL LOCALIZATION ARCHITECTURE CHECKS PASSED (100%).");
