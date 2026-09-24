import assert from "node:assert/strict";
import { build } from "../node_modules/esbuild/lib/main.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const dir = fileURLToPath(new URL("../src/input/", import.meta.url));
const source = readFileSync(join(dir, "speechHelpers.ts"), "utf8");
const bundled = await build({
  stdin: { contents: source, resolveDir: dir, sourcefile: "speechHelpers.ts", loader: "ts" },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64")
);

assert.equal(mod.mapSpeechError("not-allowed").kind, "permission-denied");
assert.equal(mod.mapSpeechError("no-speech").kind, "no-speech");
assert.equal(mod.mapSpeechError("audio-capture").kind, "audio-capture");
assert.match(mod.mapSpeechError("not-allowed").message, /denied|Allow/i);

assert.equal(mod.mergeTranscript("hello", "world"), "hello world");
assert.equal(mod.mergeTranscript("hello world", "hello world there"), "hello world there");
assert.equal(mod.mergeTranscript("", "typed"), "typed");

assert.equal(
  mod.nextSpeechPhase({ hasApi: true, consent: false, listening: false, transcript: "", error: "" }),
  "needs-consent",
);
assert.equal(
  mod.nextSpeechPhase({ hasApi: true, consent: true, listening: true, transcript: "", error: "" }),
  "listening",
);
assert.equal(
  mod.nextSpeechPhase({ hasApi: true, consent: true, listening: false, transcript: "hi", error: "" }),
  "review",
);

// SpeechInput source contracts
const speechUi = readFileSync(join(dir, "SpeechInput.tsx"), "utf8");
assert.match(speechUi, /data-testid="speech-start"/);
assert.match(speechUi, /data-testid="speech-stop"/);
assert.match(speechUi, /data-testid="speech-transcript"/);
assert.match(speechUi, /cleanupRecognition|active\.abort/);
assert.match(speechUi, /mergeTranscript/);
assert.match(speechUi, /mapSpeechError/);
assert.match(speechUi, /DEVICE_QUALIFICATION_PENDING/);
assert.match(speechUi, /mixed speech \+ typing|speech and typing mix/i);

console.log(JSON.stringify({ ok: true, cases: ["error-map", "merge", "phase", "ui-contracts"] }));
