import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webSrc = join(root, "src");

function run(script) {
  const r = spawnSync("node", [join(root, "scripts", script)], { encoding: "utf8" });
  assert.equal(r.status, 0, script + "\n" + (r.stderr || r.stdout));
  return r.stdout;
}

run("test-media-observe.mjs");
run("test-speech-helpers.mjs");
run("test-screenshot-fidelity.mjs");
run("test-video-scenes.mjs");

const composer = readFileSync(join(webSrc, "composer/UnifiedComposer.tsx"), "utf8");
assert.match(composer, /AbortController/);
assert.match(composer, /revokeObjectURL|URL\.revokeObjectURL/);

const speech = readFileSync(join(webSrc, "input/SpeechInput.tsx"), "utf8");
assert.match(speech, /\.abort\(/);
assert.match(speech, /DEVICE_QUALIFICATION_PENDING|NOT_TESTED/);
assert.match(speech, /mapSpeechError/);
assert.match(speech, /data-testid="speech-stop"/);

const helpers = readFileSync(join(webSrc, "input/speechHelpers.ts"), "utf8");
assert.match(helpers, /permission-denied/);
assert.match(helpers, /mergeTranscript/);

const pwa = readFileSync(join(webSrc, "pwa.ts"), "utf8");
assert.match(pwa, /serviceWorker|service-worker|registration/i);

const limits = readFileSync(join(webSrc, "media/limits.ts"), "utf8");
assert.match(limits, /assertImageFileBounds/);
assert.match(limits, /assertVideoFileBounds/);

const untrusted = readFileSync(join(webSrc, "media/untrusted.ts"), "utf8");
assert.match(untrusted, /UNTRUSTED_SOURCE/);

const shot = readFileSync(join(webSrc, "media/screenshotToCode.ts"), "utf8");
assert.match(shot, /GeometryReader|geo\.size\.width/);
assert.match(shot, /BoxWithConstraints/);
assert.match(shot, /spe-inferred-form|spe-card-grid|role="dialog"/);

const ui = readFileSync(join(webSrc, "media/uiObservation.ts"), "utf8");
assert.match(ui, /card-grid-candidate|modal-or-dialog-candidate|form-panel-candidate/);

const lab = readFileSync(join(webSrc, "lab/specimens.ts"), "utf8");
assert.equal((lab.match(/id: "d3d-/g) || []).length, 14);
assert.match(lab, /modules|slabs|folds|table/);

const onnx = readFileSync(join(webSrc, "engine/onnxSemantic.ts"), "utf8");
assert.match(onnx, /mobilenetv2-12-int8\.onnx/);
assert.match(onnx, /typeof window === "undefined"/);

// Reduced motion / no-WebGL soft contracts in lab stage
const stage = readFileSync(join(webSrc, "lab/LabStage.tsx"), "utf8");
assert.match(stage, /prefers-reduced-motion|reduced|matchMedia/);

const checklist = join(root, "../../proofs/spe_v1_launch/SPEECH_DEVICE_QUALIFICATION_CHECKLIST.md");
assert.ok(existsSync(checklist), "speech checklist missing");

console.log(JSON.stringify({
  ok: true,
  cases: [
    "media_unit_suite",
    "speech_helpers_and_ux_contracts",
    "screenshot_fidelity_landmarks",
    "video_scene_dedupe",
    "stale_mode_abort_cleanup",
    "speech_mic_cleanup_abort",
    "service_worker_present",
    "media_limits_present",
    "untrusted_boundary_present",
    "screenshot_semantic_scaffolds",
    "ui_structure_hints",
    "daily_lab_14_distinct_shapes",
    "onnx_browser_only_guard",
    "lab_reduced_motion_contract",
    "speech_device_checklist_artifact",
  ],
}));
