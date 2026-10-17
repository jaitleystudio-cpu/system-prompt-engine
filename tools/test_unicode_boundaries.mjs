import { readFileSync } from "node:fs";
import { loadAndEvaluate } from "../apps/web/src/engine/wasm-host.mjs";
import { build } from "../apps/web/node_modules/esbuild/lib/main.js";



// Bundle web-runtime to test renderer
const bundle = await build({
  entryPoints: ["packages/web-runtime/src/index.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const webRuntime = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const wasmBytes = new Uint8Array(readFileSync("apps/web/public/spe_wasm.wasm"));
const expectedSha256 = JSON.parse(
  readFileSync("apps/web/public/spe_wasm.sha256.json")
).sha256;

function analyze(label, str) {
  if (typeof str !== "string") {
    console.log(`${label}: <not a string: ${typeof str}>`);
    return;
  }
  const buf = Buffer.from(str, "utf8");
  const bytesHex = [...buf].map((b) => b.toString(16).padStart(2, "0")).join(" ");
  const codepoints = [...str]
    .map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"))
    .join(" ");
  const scalars = [...str].length;
  let form = "UNKNOWN";
  if (str === str.normalize("NFC") && str === str.normalize("NFD")) form = "NFC=NFD";
  else if (str === str.normalize("NFC")) form = "NFC";
  else if (str === str.normalize("NFD")) form = "NFD";
  console.log(`--- ${label} ---`);
  console.log(`  text: ${JSON.stringify(str)}`);
  console.log(`  bytes (${buf.length}): [${bytesHex}]`);
  console.log(`  scalars (${scalars}): ${codepoints}`);
  console.log(`  form: ${form}`);
}

console.log("============================================================");
console.log("BOUNDARY ANALYSIS: NFD e\\u0301");
console.log("============================================================");

// 1. Browser/user input
const b1_userInput = "e\u0301";
analyze("1. Browser/user input", b1_userInput);

// 2. JS request object
const intent = webRuntime.defaultIntentLens(b1_userInput);
const fixture = webRuntime.buildAbiFixture({
  category: "Writing",
  target: "any",
  userRequest: b1_userInput,
  ...intent,
});

const b2_jsRequest = {
  spe_api: "k3",
  op: "select",
  protected: {
    ...fixture.payload,
    goal: b1_userInput,
  },
  category: { display_label: "Writing" },
  task: {},
};

analyze("2. JS request object (protected.goal)", b2_jsRequest.protected.goal);

// 3. JSON serialization
const b3_jsonText = JSON.stringify(b2_jsRequest);
const goalMatch = b3_jsonText.match(/"goal":"([^"]+)"/);
analyze("3. JSON serialization (extracted goal string)", goalMatch ? goalMatch[1] : "");

// 4. UTF-8 bytes entering WASM
const b4_bytes = new TextEncoder().encode(b3_jsonText);
console.log(`--- 4. UTF-8 bytes entering WASM ---`);
console.log(`  total bytes: ${b4_bytes.length}`);
let foundNfd = false;
for (let i = 0; i < b4_bytes.length - 2; i++) {
  if (b4_bytes[i] === 0x65 && b4_bytes[i + 1] === 0xcc && b4_bytes[i + 2] === 0x81) {
    foundNfd = true;
    break;
  }
}
console.log(`  contains NFD [65 cc 81]: ${foundNfd}`);

// Run WASM evaluation
const wasmRes = await loadAndEvaluate({
  wasmBytes,
  expectedSha256,
  jsonText: b3_jsonText,
});

const out = wasmRes.result?.output;
const effectPlan = out?.prompt_effect_plan;
const outGoal = effectPlan?.protected_fields?.goal;
const compiledPrompt = effectPlan?.compiled_prompt;

// 10. JSON serialization back to JS (parsed output)
analyze("10. WASM output (protected_fields.goal)", outGoal);
analyze("10. WASM output (compiled_prompt snippet)", compiledPrompt ? compiledPrompt.slice(0, 40) : "");

// 11. JS result parser
analyze("11. JS parsed goal", outGoal);

// 12. Renderer mismatch validator
console.log("--- 12. Renderer mismatch validator ---");
console.log(`  brief.goal: ${JSON.stringify(b1_userInput)}`);
console.log(`  effectPlan.protected_fields.goal: ${JSON.stringify(outGoal)}`);
console.log(`  compiled_prompt includes brief.goal: ${compiledPrompt?.includes(b1_userInput)}`);
console.log(`  planGoal === brief.goal: ${outGoal === b1_userInput}`);

try {
  webRuntime.renderPromptArtifact({
    category: "Writing",
    target: "any",
    userRequest: b1_userInput,
    envelopeOutput: fixture.payload,
    techniques: effectPlan?.techniques,
    effectPlan: effectPlan,
  });
  console.log("  renderer result: SUCCESS");
} catch (err) {
  console.log(`  renderer result: THREW ${err.name}: ${err.message}`);
}

