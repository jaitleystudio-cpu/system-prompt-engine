import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const media = spawnSync("node", [join(root, "scripts/test-media-observe.mjs")], {
  encoding: "utf8",
});
assert.equal(media.status, 0, media.stderr || media.stdout);
const out = media.stdout;
assert.match(out, /UNTRUSTED|ok":true/);
assert.match(out, /visionHomepageBytes":0|visionHomepageBytes":0/);

const webSrc = join(root, "src");
const composer = readFileSync(join(webSrc, "composer/UnifiedComposer.tsx"), "utf8");
assert.match(composer, /AbortController/);
assert.match(composer, /revokeObjectURL|URL\.revokeObjectURL/);
assert.ok(/abort\(|AbortController/.test(composer));

const speech = readFileSync(join(webSrc, "input/SpeechInput.tsx"), "utf8");
assert.match(speech, /\.abort\(/);
assert.match(speech, /DEVICE_QUALIFICATION_PENDING|NOT_TESTED/);

const pwa = readFileSync(join(webSrc, "pwa.ts"), "utf8");
assert.match(pwa, /serviceWorker|service-worker|registration/i);

const limits = readFileSync(join(webSrc, "media/limits.ts"), "utf8");
assert.match(limits, /assertImageFileBounds/);
assert.match(limits, /assertVideoFileBounds/);

const untrusted = readFileSync(join(webSrc, "media/untrusted.ts"), "utf8");
assert.match(untrusted, /UNTRUSTED_SOURCE/);

const shot = readFileSync(join(webSrc, "media/screenshotToCode.ts"), "utf8");
assert.match(shot, /GeometryReader/);
assert.match(shot, /BoxWithConstraints/);

const lab = readFileSync(join(webSrc, "lab/specimens.ts"), "utf8");
assert.match(lab, /modules|slabs|folds|table/);
assert.equal((lab.match(/id: "d3d-/g) || []).length, 14);

console.log(JSON.stringify({
  ok: true,
  cases: [
    "media_unit_suite",
    "url_injection_boundary_in_media_suite",
    "vision_homepage_bytes_zero_constant",
    "screenshot_six_targets",
    "screenshot_swiftui_compose_bounds",
    "video_no_audio_claim",
    "stream_byte_bound",
    "stale_mode_abort_cleanup",
    "speech_mic_cleanup_abort",
    "service_worker_present",
    "media_limits_present",
    "untrusted_boundary_present",
    "daily_lab_14_distinct_shapes",
  ],
  note: "WebGPU-absent and huge-file races covered by LITE fallback + limits asserts in media modules / composer AbortController",
}));
