/**
 * Closable predeploy QA — video depth, a11y/zoom, security/privacy, perf, jargon, adversarial contracts.
 * Speech real-device remains DEVICE_QUALIFICATION_PENDING (not claimed READY here).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "../..");
const src = join(root, "src");
const cases = [];

function check(name, fn) {
  fn();
  cases.push(name);
}

function read(rel) {
  return readFileSync(join(src, rel), "utf8");
}

function run(script) {
  const r = spawnSync("node", [join(root, "scripts", script)], { encoding: "utf8" });
  assert.equal(r.status, 0, script + "\n" + (r.stderr || r.stdout));
  return r.stdout;
}

// 1) Video scene quality (deep asserts live in dedicated script)
check("video_scene_quality", () => {
  const out = run("test-video-scenes.mjs");
  const j = JSON.parse(out.trim().split("\n").pop());
  assert.equal(j.ok, true);
  assert.equal(j.hasChangeSignals, true);
  assert.equal(j.hasKeyMoments, true);
  assert.ok(j.deduped < j.inputFrames);
});

// 2) Mobile / a11y / reduced-motion / zoom / viewport
check("a11y_viewport_meta", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  assert.match(html, /name="viewport"/);
  assert.match(html, /width=device-width/);
});
check("a11y_focus_visible", () => {
  const css = read("index.css");
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline:\s*2px/);
});
check("a11y_reduced_motion", () => {
  const css = read("index.css");
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /animation:\s*none/);
});
check("a11y_touch_targets", () => {
  const css = read("index.css");
  assert.match(css, /min-height:\s*44px/);
});
check("a11y_zoom_safe", () => {
  const css = read("index.css");
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /spe-zoom-safe|min-resolution|word-break:\s*break-word/);
});
check("a11y_landmarks", () => {
  const app = read("App.tsx");
  assert.match(app, /aria-labelledby=/);
  assert.match(app, /role="banner"|aria-label/);
});

// 3) Security / privacy
check("csp_headers", () => {
  const headers = readFileSync(join(root, "public/_headers"), "utf8");
  assert.match(headers, /Content-Security-Policy/);
  assert.match(headers, /default-src 'self'/);
  assert.match(headers, /connect-src 'self'/);
  assert.match(headers, /object-src 'none'/);
  assert.match(headers, /frame-ancestors 'none'/);
});
check("untrusted_boundary", () => {
  const u = read("media/untrusted.ts");
  assert.match(u, /UNTRUSTED_SOURCE/);
  assert.match(u, /NOT USER INTENT/);
});
check("clipboard_deny_message", () => {
  const app = read("App.tsx");
  assert.match(app, /navigator\.clipboard\.writeText/);
  assert.match(app, /Copy unavailable|Select the prompt text to copy/i);
});
check("spe_corrupt_reject", () => {
  const app = read("App.tsx");
  assert.match(app, /spe_format/);
  assert.match(app, /not in a supported SPE format|supported SPE format/i);
});
check("onnx_download_abortable", () => {
  const onnx = read("engine/onnxSemantic.ts");
  assert.match(onnx, /fetch\([^\)]*signal/);
  assert.match(onnx, /AbortSignal|signal\?\.aborted|AbortError/);
});
check("no_unexpected_third_party_connect", () => {
  const headers = readFileSync(join(root, "public/_headers"), "utf8");
  // connect-src must stay self-only (model packs are same-origin)
  assert.match(headers, /connect-src 'self'/);
  assert.doesNotMatch(headers, /connect-src[^;]*https?:\/\//);
});

// 4) Performance — huge media fail safely
check("media_limits_fail_closed", () => {
  const limits = read("media/limits.ts");
  assert.match(limits, /MAX_IMAGE_BYTES/);
  assert.match(limits, /MAX_VIDEO_BYTES/);
  assert.match(limits, /MAX_IMAGE_MEGAPIXELS/);
  assert.match(limits, /assertImageFileBounds/);
  assert.match(limits, /assertVideoFileBounds/);
  assert.match(limits, /too large|too high/i);
});

// 5) Adversarial leftovers
check("stale_abort_cleanup", () => {
  const composer = read("composer/UnifiedComposer.tsx");
  assert.match(composer, /AbortController/);
  assert.match(composer, /revokeObjectURL|URL\.revokeObjectURL/);
});
check("service_worker_present", () => {
  const pwa = read("pwa.ts");
  assert.match(pwa, /serviceWorker|service-worker/i);
});
check("speech_device_pending_honest", () => {
  const speech = read("input/SpeechInput.tsx");
  assert.match(speech, /DEVICE_QUALIFICATION_PENDING|NOT_TESTED/);
  const checklist = join(repo, "proofs/spe_v1_launch/SPEECH_DEVICE_QUALIFICATION_CHECKLIST.md");
  assert.ok(existsSync(checklist), "speech checklist artifact missing");
});

// 6) Visitor jargon ban (Rich Human English surfaces)
check("visitor_no_infra_jargon", () => {
  const surfaces = [
    read("App.tsx"),
    read("composer/UnifiedComposer.tsx"),
    read("landing/Hero.tsx"),
    read("pages/PrivacyProof.tsx"),
  ].join("\n");
  for (const banned of [
    "UIObservationIR",
    "ORT ",
    "MobileNet",
    "INT8",
    "modelBytes",
    "spe_runtime",
    "omega/",
    "XRAY_BRIEF",
  ]) {
    assert.ok(!surfaces.includes(banned), `visitor jargon leak: ${banned}`);
  }
});

console.log(JSON.stringify({ ok: true, cases }, null, 2));
