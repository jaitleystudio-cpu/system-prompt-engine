import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "../node_modules/esbuild/lib/main.js";

const src = fileURLToPath(new URL("../src/", import.meta.url));

async function loadFoundation() {
  const bundled = await build({
    entryPoints: [join(src, "visual/candidateFoundation.ts")],
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

async function loadPanel() {
  const bundled = await build({
    entryPoints: [join(src, "visual/CandidateUiPanel.tsx")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    jsx: "automatic",
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(bundled.outputFiles[0].text).toString("base64")
  );
}

const foundation = await loadFoundation();
const panel = await loadPanel();

const {
  candidateFromImage,
  candidateFromScreenshot,
  candidateInvariantViolations,
} = foundation;
const { CandidateUiPanel } = panel;

function assertHonest(view, label) {
  const problems = candidateInvariantViolations(view);
  assert.deepEqual(problems, [], `${label}: ${problems.join(", ")}`);
}

const image = candidateFromImage({
  summary: "A dark landscape with a bright center.",
  sourceWidth: 1440,
  sourceHeight: 900,
  paletteCount: 3,
  ocrBlocks: [],
  fidelityEpistemic: "MODEL_JUDGMENT",
  openQuestions: ["Subject labels are judgments, not facts."],
});
assertHonest(image, "image");
assert.deepEqual(image.flow, ["Image", "Visual"]);
assert.equal(image.candidatePreview, null);
assert.equal(image.truth.find((item) => item.axis === "ocr").epistemic, "ABSENT");
assert.equal(image.authorityDeltaFromMedia, 0);
assert.match(image.visualSummary, /1440×900/);

const textLike = candidateFromImage({
  summary: "A poster.",
  sourceWidth: 800,
  sourceHeight: 600,
  paletteCount: 2,
  ocrBlocks: [
    { text: "[text-like band ~10%–18%]", method: "ocr-textlikeness" },
  ],
  fidelityEpistemic: "OBSERVATION",
  openQuestions: [],
});
assertHonest(textLike, "text-like");
const ocr = textLike.truth.find((item) => item.axis === "ocr");
assert.equal(ocr.verdict, "UNKNOWN");
assert.equal(ocr.epistemic, "MODEL_JUDGMENT");
assert.match(ocr.statement, /not read/i);

const supplied = candidateFromScreenshot({
  sourceWidth: 390,
  sourceHeight: 844,
  columns: 1,
  rows: 4,
  paletteCount: 1,
  regions: [
    {
      id: "r1",
      roleGuess: "Header",
      bounds: { x: 0, y: 0, w: 1, h: 0.12 },
      confidence: "medium",
      evidence: "Top band is darker",
    },
    {
      id: "r2",
      roleGuess: "Main",
      bounds: { x: 0, y: 0.12, w: 1, h: 0 },
      confidence: "low",
      evidence: "Height collapsed",
    },
  ],
  ocrBlocks: [{ text: "Sign in", method: "ocr-tesseract" }],
  openQuestions: ["Roles are guesses."],
});
assertHonest(supplied, "screenshot");
assert.deepEqual(supplied.flow, ["Screenshot", "Structure", "Candidate UI"]);
assert.equal(supplied.candidatePreview.placedCount, 1);
assert.equal(supplied.candidatePreview.unplacedCount, 1);
assert.equal(
  supplied.truth.find((item) => item.axis === "ocr").epistemic,
  "SUPPLIED_UNTRUSTED",
);
assert.equal(
  supplied.truth.find((item) => item.axis === "responsive").epistemic,
  "ABSENT",
);
assert.equal(
  supplied.truth.find((item) => item.axis === "assets").verdict,
  "UNKNOWN",
);
assert.match(supplied.limits.join(" "), /not a compiled app/i);

const empty = candidateFromScreenshot({
  sourceWidth: 0,
  sourceHeight: Number.NaN,
  columns: 0,
  rows: 0,
  paletteCount: 0,
  regions: [],
  ocrBlocks: [],
  openQuestions: ["", "  "],
});
assertHonest(empty, "empty-screenshot");
assert.equal(empty.candidatePreview.regions.length, 0);
assert.match(empty.visualSummary, /unrecorded size/);
assert.equal(empty.openQuestions.length, 0);
assert.match(
  empty.truth.find((item) => item.axis === "fidelity").statement,
  /frame stays empty/i,
);

const laundered = {
  ...image,
  truth: image.truth.map((label) =>
    label.axis === "fidelity" ? { ...label, verdict: "PASS" } : label,
  ),
};
assert.ok(
  candidateInvariantViolations(laundered).some((item) => item.includes("pass-refused")),
);

const absentFail = {
  ...image,
  truth: image.truth.map((label) =>
    label.axis === "assets" ? { ...label, verdict: "FAIL" } : label,
  ),
};
assert.ok(
  candidateInvariantViolations(absentFail).some((item) =>
    item.includes("absent-not-unknown"),
  ),
);

function markup(view) {
  return renderToStaticMarkup(createElement(CandidateUiPanel, { view }));
}

const imageHtml = markup(image);
assert.match(imageHtml, /data-candidate-source="image"/);
assert.match(imageHtml, /Image/);
assert.match(imageHtml, /Visual/);
assert.match(imageHtml, /data-axis="ocr"/);
assert.match(imageHtml, /data-verdict="UNKNOWN"/);
assert.match(imageHtml, /Not verified/);
assert.match(imageHtml, /Not present in this pass/);
assert.doesNotMatch(imageHtml, /spe-candidate-frame/);
assert.doesNotMatch(imageHtml, /data-verdict="PASS"/);
assert.doesNotMatch(imageHtml, /UIObservationIR|WebsiteSpec|spe_runtime|MobileNet|100%/);

const shotHtml = markup(supplied);
assert.match(shotHtml, /Screenshot/);
assert.match(shotHtml, /Structure/);
assert.match(shotHtml, /Candidate UI/);
assert.match(shotHtml, /data-axis="fidelity"/);
assert.match(shotHtml, /not a pixel-perfect recreation/i);
assert.match(shotHtml, /Header/);
assert.match(shotHtml, /stronger guess|unsure|weak guess/);
assert.match(shotHtml, /left:0.0%/);
assert.match(shotHtml, /no drawable area/i);
assert.match(shotHtml, /Untrusted text/);
assert.doesNotMatch(shotHtml, /data-verdict="PASS"/);
assert.doesNotMatch(shotHtml, /pixel-perfect copy|100% match|exact replica/i);

const composer = readFileSync(join(src, "composer/UnifiedComposer.tsx"), "utf8");
assert.match(composer, /CandidateUiPanel/);
assert.match(composer, /candidateFromSemantic/);
assert.match(composer, /candidateFromObservationIR/);
assert.match(composer, /not an in-product compiler/);
assert.doesNotMatch(composer, /UIObservationIR|WebsiteSpec|spe_runtime/);

const foundationSource = readFileSync(
  join(src, "visual/candidateFoundation.ts"),
  "utf8",
);
assert.doesNotMatch(
  foundationSource,
  /from ["'][^"']*(spe_runtime|portable\/spe-core|wasm)/,
);
assert.match(foundationSource, /notWebsiteSpec: true/);
assert.match(foundationSource, /authorityDeltaFromMedia: 0/);

console.log(
  JSON.stringify(
    {
      ok: true,
      cases: [
        "image-to-visual",
        "text-like-ocr-unknown",
        "screenshot-to-candidate",
        "empty-screenshot-stays-unknown",
        "pass-launder-rejected",
        "absent-fail-rejected",
        "panel-markup",
        "composer-wiring",
      ],
      flows: {
        image: image.flow,
        screenshot: supplied.flow,
      },
      verdicts: supplied.truth.map((label) => ({
        axis: label.axis,
        verdict: label.verdict,
        epistemic: label.epistemic,
      })),
    },
    null,
    2,
  ),
);
