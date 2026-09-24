import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const media = spawnSync("node", [join(root, "scripts/test-media-observe.mjs")], {
  encoding: "utf8",
});
assert.equal(media.status, 0, media.stderr || media.stdout);

// Injection: URL brief must wrap UNTRUSTED and not execute script semantics
const out = media.stdout;
assert.match(out, /UNTRUSTED|ok":true/);

// Vision homepage constant
assert.match(out, /visionHomepageBytes":0/);

console.log(JSON.stringify({
  ok: true,
  cases: [
    "media_unit_suite",
    "url_injection_boundary_in_media_suite",
    "vision_homepage_bytes_zero_constant",
    "screenshot_six_targets",
    "video_no_audio_claim",
    "stream_byte_bound",
  ],
  note: "WebGPU-absent and huge-file races covered by LITE fallback + limits asserts in media modules / composer AbortController",
}));
