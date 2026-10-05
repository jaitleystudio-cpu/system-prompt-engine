import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";
import { loadAndEvaluate } from "../src/engine/wasm-host.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "../..");

// 1. Bundle web-runtime
const bundle = await build({
  entryPoints: [join(repo, "packages/web-runtime/src/index.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const runtime = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// 2. Load current WASM
const wasmBytes = new Uint8Array(readFileSync(join(root, "public/spe_wasm.wasm")));
const expectedSha256 = JSON.parse(
  readFileSync(join(root, "public/spe_wasm.sha256.json"))
).sha256;

console.log("============================================================");
console.log("SPE R8 ADVERSARIAL UNICODE & GLOBAL-LANGUAGE QUALIFICATION");
console.log("============================================================");

async function runTestCase(testCategory, name, rawInput, options = {}) {
  const intent = runtime.defaultIntentLens(rawInput);
  const fixture = runtime.buildAbiFixture({
    category: "Writing",
    target: "any",
    userRequest: rawInput,
    ...intent,
  });

  const req = {
    spe_api: "k3",
    op: "select",
    protected: {
      ...fixture.payload,
      goal: rawInput,
    },
    category: { display_label: "Writing" },
    task: {},
  };

  const outcome = await loadAndEvaluate({
    wasmBytes,
    expectedSha256,
    jsonText: JSON.stringify(req),
  });

  assert.equal(outcome.error, null, `[${name}] WASM evaluation should not error`);
  const output = outcome.result?.output;
  const effectPlan = output?.prompt_effect_plan;

  assert.equal(effectPlan?.disposition, "BOUND", `[${name}] Generation disposition must be BOUND`);

  const returnedGoal = effectPlan?.protected_fields?.goal;

  // 1. RAW_REQUEST_IDENTITY Invariant: Byte-for-byte exact match
  assert.equal(
    returnedGoal,
    rawInput,
    `[${name}] Returned provenance goal must be byte-for-byte identical to raw user request: expected ${JSON.stringify(rawInput)}, got ${JSON.stringify(returnedGoal)}`
  );
  assert.equal(
    Buffer.from(returnedGoal).toString("hex"),
    Buffer.from(rawInput).toString("hex"),
    `[${name}] UTF-8 byte serialization must match exactly`
  );

  // 2. Renderer acceptance with identical request
  const rendered = runtime.renderPromptArtifact({
    category: "Writing",
    target: "any",
    userRequest: rawInput,
    envelopeOutput: fixture.payload,
    techniques: effectPlan?.techniques,
    effectPlan: effectPlan,
  });

  assert.ok(rendered.finalPrompt, `[${name}] Renderer must produce finalPrompt`);

  // 3. Renderer canonical tolerance (if canonical counterpart provided)
  if (options.canonicalCounterpart) {
    try {
      const renderedCounterpart = runtime.renderPromptArtifact({
        category: "Writing",
        target: "any",
        userRequest: options.canonicalCounterpart,
        envelopeOutput: fixture.payload,
        techniques: effectPlan?.techniques,
        effectPlan: effectPlan,
      });
      assert.ok(
        renderedCounterpart.finalPrompt,
        `[${name}] Renderer must accept canonically equivalent counterpart (${options.canonicalCounterpart})`
      );
    } catch (err) {
      console.error(`[${name}] ERROR in canonical counterpart:`, err.message);
      throw err;
    }
  }
}

// Suite 1: Canonical Equivalence Pairs (NFD raw inputs)
const canonicalCases = [
  ["nfd_e_acute", "e\u0301", "\u00E9"],
  ["nfd_a_ring", "A\u030A", "\u00C5"],
  ["nfd_n_tilde", "n\u0303", "\u00F1"],
  ["nfd_u_umlaut", "u\u0308", "\u00FC"],
  ["nfd_hangul_ga", "\u1100\u1161", "\uAC00"],
  ["nfd_multiple_marks", "q\u0307\u0323", "q\u0323\u0307"],
  ["greek_iota_subscript", "\u03C9\u0313\u0342\u0345", "\u1FA6"],
];

for (const [name, raw, counterpart] of canonicalCases) {
  await runTestCase("CANONICAL_EQUIVALENCE", name, raw, { canonicalCounterpart: counterpart });
}
console.log("PASS: Canonical equivalence pairs (7/7)");

// Suite 2: Global Scripts
const globalScripts = [
  ["hindi_devanagari", "नमस्ते दुनिया! क्या हाल है? प्रोग्रामिंग"],
  ["telugu", "తెలుగు అక్షరాలు మరియు మాటలు ప్రోగ్రామింగ్"],
  ["tamil", "தமிழ் எழுத்துக்கள் மற்றும் சொற்கள்"],
  ["kannada", "ಕನ್ನಡ ಸಾಹಿತ್ಯ ಮತ್ತು ಸಂಸ್ಕೃತಿ"],
  ["arabic_rtl", "مرحبا بك في محرك موجه النظام أهلاً وسهلاً"],
  ["hebrew_niqqud", "שָׁלוֹם עוֹלָם וּבְרוּכִים הַבָּאִים"],
  ["japanese_dakuten", "か\u3099んし\u3099 (が) こんにちは世界"],
  ["chinese_simplified", "系统提示工程与自动化测试"],
  ["chinese_traditional", "系統提示詞工程與自動化測試"],
  ["vietnamese_stacked", "tiếng Việt có dấu: ế, ờ, ặ, ỹ, chào thế giới"],
  ["thai_complex", "สวัสดีชาวโลกและวิศวกรรมข้อความแจ้งเตือน"],
];

for (const [name, raw] of globalScripts) {
  await runTestCase("GLOBAL_SCRIPTS", name, raw);
}
console.log("PASS: Global scripts (11/11)");

// Suite 3: Emoji and Complex Sequences
const emojiCases = [
  ["zwj_family", "👨‍👩‍👧‍👦"],
  ["flags", "🇮🇳 🇺🇸 🇬🇧 🇯🇵"],
  ["skin_tones", "👋🏽 👨🏼‍💻 👩🏾‍🔬"],
  ["variation_selectors", "❤️ ⭐ ☀️ ⚠️"],
  ["zwj_rainbow_flag", "🏳️‍🌈"],
];

for (const [name, raw] of emojiCases) {
  await runTestCase("EMOJI_SEQUENCES", name, raw);
}
console.log("PASS: Emoji and complex sequences (5/5)");

// Suite 4: NFKC Compatibility Characters (Must NOT undergo compatibility folding)
const compatibilityCases = [
  ["ligature_fi", "\uFB01"],
  ["ligature_fl", "\uFB02"],
  ["fullwidth_digits", "１２３"],
  ["fullwidth_latin", "ＡＢＣ"],
  ["circled_digits", "①②③"],
  ["fractions", "½ ⅓ ¼"],
  ["math_blackboard_bold", "ℂ ℝ ℕ ℤ"],
  ["roman_numerals", "Ⅰ Ⅱ Ⅲ Ⅳ"],
];

for (const [name, raw] of compatibilityCases) {
  await runTestCase("COMPATIBILITY_PRESERVATION", name, raw);
}
console.log("PASS: NFKC compatibility characters preservation (8/8)");

console.log("============================================================");
console.log("ALL 31 ADVERSARIAL UNICODE TEST CASES PASSED GREEN!");
console.log("============================================================");
