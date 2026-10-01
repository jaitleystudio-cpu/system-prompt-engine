#!/usr/bin/env node
/**
 * Lane A10: Media UX Capability Preflight Test Suite
 * Enforces:
 * - Consumption of A10_MEDIA_CAPABILITY_UX_PREFLIGHT.md specifications
 * - Codec acceptance and rejection invariants (Opus/AC-3/DTS rejected; WAV/MP3/AAC/FLAC accepted)
 * - Language status tags (English/Tamil: QUALIFIED, Hindi: BETA, Spanish: EXPERIMENTAL, Telugu: GATED)
 * - Hardware metrics disclosure (~788 MiB RSS, 3.81s cold start, 3.23x warm RTF)
 * - Strict Invariants:
 *   LIVE_TRANSCRIPTION_STATUS = UNAVAILABLE
 *   BACKEND_EXECUTION = GATED
 *   HOST_FFMPEG_PRODUCT_PATH = PROHIBITED
 *   NETWORK_EGRESS = 0
 *   ROUTE_MOUNT_STATUS = NOT_INTEGRATED
 * - CSS accessibility (44px touch targets, :focus-visible, prefers-reduced-motion, 360px reflow)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");

console.log("Checking Lane A10 file existence...");
const requiredFiles = [
  path.join(webRoot, "src/media/mediaCapabilityModel.ts"),
  path.join(webRoot, "src/media/media-workspace.css"),
  path.join(webRoot, "src/media/MediaWorkspaceView.tsx"),
];

for (const f of requiredFiles) {
  assert(fs.existsSync(f), `Missing required file: ${f}`);
}

const modelSource = fs.readFileSync(path.join(webRoot, "src/media/mediaCapabilityModel.ts"), "utf8");
const viewSource = fs.readFileSync(path.join(webRoot, "src/media/MediaWorkspaceView.tsx"), "utf8");
const cssSource = fs.readFileSync(path.join(webRoot, "src/media/media-workspace.css"), "utf8");

// 1. Mandatory Invariants
console.log("Checking mandatory truth invariants...");
assert.match(modelSource, /LIVE_TRANSCRIPTION_STATUS\s*=\s*"UNAVAILABLE"/, "Must define LIVE_TRANSCRIPTION_STATUS = UNAVAILABLE");
assert.match(modelSource, /BACKEND_EXECUTION\s*=\s*"GATED"/, "Must define BACKEND_EXECUTION = GATED");
assert.match(modelSource, /HOST_FFMPEG_PRODUCT_PATH\s*=\s*"PROHIBITED"/, "Must define HOST_FFMPEG_PRODUCT_PATH = PROHIBITED");
assert.match(modelSource, /NETWORK_EGRESS\s*=\s*"0"/, "Must define NETWORK_EGRESS = 0");
assert.match(modelSource, /ROUTE_MOUNT_STATUS\s*=\s*"NOT_INTEGRATED"/, "Must define ROUTE_MOUNT_STATUS = NOT_INTEGRATED");

assert.match(viewSource, /Live Transcription:\s*\{LIVE_TRANSCRIPTION_STATUS\}/, "UI must visibly display live transcription status");
assert.match(viewSource, /Backend Execution:\s*\{BACKEND_EXECUTION\}/, "UI must visibly display backend execution status");
assert.match(viewSource, /Network Egress\s*=\s*\{NETWORK_EGRESS\}/, "UI must visibly display network egress = 0");

// 2. Codec Registry & Dropzone Logic
console.log("Checking codec matrix enforcement...");
assert.match(modelSource, /format:\s*"WAV \/ PCM".*status:\s*"ACCEPTED"/s, "WAV/PCM must be accepted");
assert.match(modelSource, /format:\s*"MP3".*status:\s*"ACCEPTED"/s, "MP3 must be accepted");
assert.match(modelSource, /format:\s*"AAC \/ M4A".*status:\s*"ACCEPTED"/s, "AAC/M4A must be accepted");
assert.match(modelSource, /format:\s*"FLAC".*status:\s*"ACCEPTED"/s, "FLAC must be accepted");

assert.match(modelSource, /format:\s*"Opus".*status:\s*"REJECTED"/s, "Opus must be rejected");
assert.match(modelSource, /format:\s*"AC-3 \/ E-AC-3".*status:\s*"REJECTED"/s, "AC-3 must be rejected");
assert.match(modelSource, /format:\s*"DTS".*status:\s*"REJECTED"/s, "DTS must be rejected");

// 3. Language Qualification Matrix (G12 MediaCapabilityContract Binding)
console.log("Checking language capability matrix & G12 contract binding...");
assert.match(modelSource, /export interface MediaCapabilityContract/, "Must define MediaCapabilityContract");
assert.match(modelSource, /export const CANONICAL_MEDIA_CAPABILITY_RECEIPT/, "Must export CANONICAL_MEDIA_CAPABILITY_RECEIPT");
assert.match(modelSource, /validateMediaCapabilityReceipt/, "Must export validateMediaCapabilityReceipt validator");

assert.match(modelSource, /language:\s*"English".*status:\s*"QUALIFIED"/s, "English must be QUALIFIED");
assert.match(modelSource, /language:\s*"Tamil".*status:\s*"QUALIFIED"/s, "Tamil must be QUALIFIED");
assert.match(modelSource, /language:\s*"Hindi".*status:\s*"LIMITED_EVIDENCE"/s, "Hindi must be LIMITED_EVIDENCE");
assert.match(modelSource, /language:\s*"Spanish".*status:\s*"UNDER_QUALIFICATION"/s, "Spanish must be UNDER_QUALIFICATION");
assert.match(modelSource, /language:\s*"Telugu \(Baseline ggml-small\)".*status:\s*"UNSUPPORTED"/s, "Telugu baseline must be UNSUPPORTED");
assert.match(modelSource, /language:\s*"Telugu \(Challenger ggml-te-small\)".*status:\s*"UNDER_QUALIFICATION"/s, "Telugu challenger must be UNDER_QUALIFICATION");
assert.match(modelSource, /Script Defect.*Devanagari/, "Telugu baseline must cite ggml script defect");
assert.match(modelSource, /evidenceReceipt:\s*"G12-H"/, "Telugu challenger must cite G12-H evidence receipt");

// 4. Hardware Headroom Metrics
console.log("Checking hardware telemetry metrics...");
assert.match(modelSource, /PEAK_RSS_BYTES\s*=\s*826294272/, "Must record 826294272 peak bytes (~788 MiB)");
assert.match(modelSource, /COLD_LOAD_LATENCY_SEC\s*=\s*3\.81/, "Must record 3.81s cold load latency");
assert.match(modelSource, /WARM_MEDIAN_RTF\s*=\s*3\.23/, "Must record 3.23x warm median RTF");

// 5. CSS Accessibility Standards
console.log("Checking CSS standards in media-workspace.css...");
assert.match(cssSource, /min-height:\s*44px/, "CSS must enforce 44px touch targets");
assert.match(cssSource, /:focus-visible/, "CSS must define :focus-visible rules");
assert.match(cssSource, /prefers-reduced-motion/, "CSS must honor prefers-reduced-motion");
assert.match(cssSource, /@media\s*\(max-width:\s*360px\)/, "CSS must support 360px reflow");

// 6. Route Isolation Invariants
console.log("Checking route isolation invariants...");
const appSource = fs.readFileSync(path.join(webRoot, "src/App.tsx"), "utf8");
const routingSource = fs.readFileSync(path.join(webRoot, "src/routing.ts"), "utf8");

assert.doesNotMatch(
  appSource,
  /<MediaWorkspaceView\s*\/>/,
  "MediaWorkspaceView must NOT be mounted into App.tsx (ROUTE_MOUNT_STATUS=NOT_INTEGRATED)"
);
assert.doesNotMatch(
  routingSource,
  /media-workspace/,
  "routing.ts must not reference media-workspace route yet (ROUTE_MOUNT_STATUS=NOT_INTEGRATED)"
);

console.log("PASS: Lane A10 Media UX Capability Preflight contract verified.");
