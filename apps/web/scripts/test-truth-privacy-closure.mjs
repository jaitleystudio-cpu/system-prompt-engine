/**
 * SPE truth / privacy / no-silent-loss closure contracts.
 * TDD: assert product truth matches runtime (CSP, bounds, claims).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const repo = join(root, "../..");

function read(rel) {
  return readFileSync(join(src, rel), "utf8");
}

async function bundleIsolated(relPath) {
  const full = join(src, relPath);
  const source = readFileSync(full, "utf8");
  const bundled = await build({
    stdin: {
      contents: source,
      resolveDir: dirname(full),
      sourcefile: relPath,
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(bundled.outputFiles[0].text).toString("base64")
  );
}

const cases = [];
function check(name, fn) {
  fn();
  cases.push(name);
}
async function checkAsync(name, fn) {
  await fn();
  cases.push(name);
}

// --- Bounded text helper (unit) ---
await checkAsync("bound_helper_limits", async () => {
  const b = await bundleIsolated("input/boundedText.ts");
  assert.equal(b.HOME_QUICK_START_MAX_CHARS, 20_000);
  assert.equal(b.DESIRED_OUTPUT_MAX_CHARS, 12_000);
  assert.equal(b.EXAMPLE_MAX_CHARS, 12_000);

  const under = b.applyTextBound("a".repeat(19_999), 20_000);
  assert.equal(under.attempted, 19_999);
  assert.equal(under.accepted, 19_999);
  assert.equal(under.overflow, false);
  assert.equal(under.silentLoss, false);
  assert.equal(under.notice, null);

  const exact = b.applyTextBound("a".repeat(20_000), 20_000);
  assert.equal(exact.accepted, 20_000);
  assert.equal(exact.overflow, false);

  const over = b.applyTextBound("a".repeat(20_001), 20_000, {
    createHint: true,
    fieldLabel: "Home quick-start",
  });
  assert.equal(over.attempted, 20_001);
  assert.equal(over.accepted, 20_000);
  assert.equal(over.value.length, 20_000);
  assert.equal(over.overflow, true);
  assert.equal(over.silentLoss, false);
  assert.match(over.notice, /20,001|20001/);
  assert.match(over.notice, /20,000|20000/);
  assert.match(over.notice, /Create/i);

  const huge = b.applyTextBound("x".repeat(100_000), 20_000, {
    createHint: true,
    fieldLabel: "Home quick-start",
  });
  assert.equal(huge.attempted, 100_000);
  assert.equal(huge.accepted, 20_000);
  assert.equal(huge.silentLoss, false);
  assert.ok(huge.notice);

  const desiredOver = b.applyTextBound("d".repeat(12_001), 12_000, {
    fieldLabel: "Desired output",
  });
  assert.equal(desiredOver.overflow, true);
  assert.equal(desiredOver.silentLoss, false);

  const exampleOver = b.applyTextBound("e".repeat(12_001), 12_000, {
    fieldLabel: "Example",
  });
  assert.equal(exampleOver.overflow, true);
  assert.equal(exampleOver.silentLoss, false);
});

// --- Home must not use silent HTML maxLength ---
check("home_no_silent_maxlength", () => {
  const hero = read("landing/Hero.tsx");
  assert.doesNotMatch(hero, /maxLength=\{20000\}/);
  assert.match(hero, /applyTextBound|HOME_QUICK_START_MAX_CHARS/);
  assert.match(hero, /role="status"|aria-live/);
  assert.match(hero, /\/\s*20,?000|20,?000 characters|char/i);
});

check("desired_example_no_silent_maxlength", () => {
  const composer = read("composer/UnifiedComposer.tsx");
  assert.doesNotMatch(composer, /maxLength=\{12000\}/);
  assert.match(composer, /DESIRED_OUTPUT_MAX_CHARS|applyTextBound/);
  assert.match(composer, /EXAMPLE_MAX_CHARS|applyTextBound/);
});

// --- URL / CSP honesty ---
check("csp_remains_connect_self", () => {
  const headers = readFileSync(join(root, "public/_headers"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");
  assert.match(headers, /connect-src 'self'/);
  assert.doesNotMatch(headers, /connect-src[^;]*\*/);
  assert.doesNotMatch(headers, /connect-src[^;]*https?:\/\//);
  assert.match(html, /connect-src 'self'/);
});

check("privacy_no_remote_fetch_overclaim", () => {
  const privacy = read("pages/PrivacyProof.tsx");
  assert.doesNotMatch(privacy, /Reading a website contacts the address you type/);
  assert.match(privacy, /reference|same-origin|does not (fetch|read) (arbitrary )?remote|CSP|security policy/i);
});

check("url_ui_no_fake_fetch_claim", () => {
  const composer = read("composer/UnifiedComposer.tsx");
  assert.doesNotMatch(composer, />Fetch in browser</);
  assert.match(composer, /url_reference_only|URL reference|reference only/i);
});

await checkAsync("url_ingest_reference_only_and_bounds", async () => {
  const url = await bundleIsolated("media/urlIngest.ts");
  assert.equal(
    typeof url.connectSrcAllowsRemoteHost,
    "function",
    "connectSrcAllowsRemoteHost export required",
  );
  assert.equal(
    url.connectSrcAllowsRemoteHost("'self'", "https://app.example", new URL("https://other.test")),
    false,
  );
  assert.equal(
    url.connectSrcAllowsRemoteHost("'self'", "https://app.example", new URL("https://app.example/page")),
    true,
  );

  const ref = await url.ingestUrl("https://example.com/docs", {
    networkPolicy: {
      pageOrigin: "https://systempromptengine.com",
      connectSrc: "'self'",
    },
  });
  assert.equal(ref.status, "url_reference_only");
  assert.match(ref.message, /not read|reference|same-origin|security policy/i);
  const block = url.urlResultToPromptBlock(ref);
  assert.ok(block);
  assert.match(block, /UNTRUSTED_SOURCE|URL reference|not read/i);
  assert.doesNotMatch(block, /Title:|Excerpt:/);

  // Truncation provenance on HTML path
  const big = "a".repeat(250_000);
  const file = {
    name: "big.html",
    size: big.length,
    async text() {
      return `<html><body>${big}</body></html>`;
    },
  };
  const htmlResult = await url.ingestHtmlFile(file);
  assert.equal(htmlResult.status, "ok");
  assert.ok(htmlResult.sourceBounds);
  assert.equal(htmlResult.sourceBounds.truncated, true);
  assert.ok(htmlResult.sourceBounds.used_size <= htmlResult.sourceBounds.limit);
  assert.ok(htmlResult.sourceBounds.original_size > htmlResult.sourceBounds.used_size);
  assert.match(
    htmlResult.notes.join(" "),
    /first|used|limit|truncat|bytes/i,
  );
});

check("url_source_truncation_disclosed_in_ui", () => {
  const composer = read("composer/UnifiedComposer.tsx");
  assert.match(composer, /sourceBounds|truncated|Only the first|processing limit/i);
});

// --- Screenshot → code claim boundary ---
check("screenshot_code_claims_truthful", () => {
  const app = read("App.tsx");
  const composer = read("composer/UnifiedComposer.tsx");
  const routing = read("routing.ts");
  const surfaces = [app, composer, routing].join("\n");
  assert.doesNotMatch(surfaces, /SPE compiled your React/i);
  assert.doesNotMatch(surfaces, /SPE (is|acts as) an in-product (code )?compiler/i);
  // Positive overclaim: asserting SPE compiles target apps in-product.
  assert.doesNotMatch(
    surfaces,
    /(?<!not an )(?<!not a )in-product (code )?compiler(?! —)/i,
  );
  assert.match(surfaces, /scaffold|prompt|coding AI|starter/i);
  assert.match(app, /starting points|not a finished|coding AI|implementation prompt/i);
  assert.match(composer, /not an in-product compiler/i);
});

// --- Privacy / network wording contract ---
check("privacy_matrix_contract_copy", () => {
  const privacy = read("pages/PrivacyProof.tsx");
  assert.match(privacy, /optional/i);
  assert.match(privacy, /history|this browser|on this device/i);
  assert.match(privacy, /analytics|tracking/i);
  // Must not claim absolute "everything always"
  assert.doesNotMatch(privacy, /everything always stays/i);
  assert.doesNotMatch(privacy, /never leaves this device under any circumstance/i);
});

check("studio_trust_offline_claim_scoped", () => {
  const hero = read("landing/Hero.tsx");
  // Keep local claims but Home must disclose quick-start limit somewhere nearby
  assert.match(hero, /HOME_QUICK_START|quick-start|20,?000/i);
});

console.log(
  JSON.stringify(
    {
      ok: true,
      cases,
      artifacts: {
        boundedText: existsSync(join(src, "input/boundedText.ts")),
        proofsDir: "proofs/truth_privacy_closure_20260928/",
      },
    },
    null,
    2,
  ),
);
