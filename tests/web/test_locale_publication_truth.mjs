/**
 * Publication truth: a catalog file is not a shipped locale.
 * English stays the only published locale. No worldwide PASS.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PUBLISHED_LOCALES,
  SUPPORTED_LOCALES,
  buildHreflangAlternates,
  formatMessage,
  localePublicationCensus,
} from "../../packages/web-runtime/src/locales.ts";

const repo = fileURLToPath(new URL("../..", import.meta.url));
const census = localePublicationCensus();
const byId = Object.fromEntries(census.records.map((row) => [row.id, row]));

assert.deepEqual([...PUBLISHED_LOCALES], ["en"]);
assert.deepEqual(census.published, ["en"]);
assert.equal(census.worldwideLocalizationPass, false);
assert.equal(byId.en.state, "PUBLISHED");
assert.equal(byId.en.advertisedAsShipped, true);

const catalogPresent = ["es", "ar", "ja", "zh-Hans", "hi"];
const noCatalog = ["pt-BR", "de", "fr"];
for (const id of catalogPresent) {
  assert.equal(byId[id].state, "CATALOG_PRESENT_UNPUBLISHED", id);
  assert.equal(byId[id].englishCopyKeyCount, 0, id);
  assert.ok(byId[id].catalogKeyCount >= 13, id);
  assert.equal(byId[id].advertisedAsShipped, false, id);
  assert.equal(typeof formatMessage(id, "nav.home"), "string", id);
  assert.notEqual(formatMessage(id, "nav.home"), "Home", id);
}
for (const id of noCatalog) {
  assert.equal(byId[id].state, "REGISTERED_NO_CATALOG", id);
  assert.equal(byId[id].catalogKeyCount, 0, id);
  assert.equal(byId[id].advertisedAsShipped, false, id);
  const message = formatMessage(id, "nav.home");
  assert.equal(message.translated, false, id);
}

const unpublished = new Set(census.unpublished);
for (const id of [...catalogPresent, ...noCatalog]) {
  assert.equal(unpublished.has(id), true, id);
}
assert.equal(unpublished.has("en"), false);
assert.equal(census.unpublished.length, SUPPORTED_LOCALES.length - 1);

const advertised = buildHreflangAlternates("https://example.invalid/").map((row) => row.hreflang);
assert.deepEqual(advertised.sort(), ["en", "x-default"]);
for (const id of census.unpublished) {
  assert.equal(advertised.includes(id), false, `${id} advertised`);
}

const evidence = {
  lane: "G3-l10n",
  startSha: "a6d686635c2b5ac12a8060a31657330afe90cbd3",
  pr80: "https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/80",
  published: census.published,
  unpublished: census.unpublished,
  worldwideLocalizationPass: census.worldwideLocalizationPass,
  records: census.records,
  hreflangAdvertised: advertised,
  note: "Catalogs for es, ar, ja, zh-Hans, and hi are present and are not byte-identical to English. They stay UNPUBLISHED because PUBLISHED_LOCALES is English-only and no shipped route was verified. pt-BR, de, and fr are registered with no catalog. No translations were added.",
  final: "HOLD",
};
const evidenceDir = join(repo, "evidence/lane-g3-l10n");
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(join(evidenceDir, "PUBLICATION_TRUTH.json"), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({
  ok: true,
  published: census.published,
  unpublished: census.unpublished,
  worldwideLocalizationPass: census.worldwideLocalizationPass,
}, null, 2));
