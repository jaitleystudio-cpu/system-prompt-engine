import { observationToPromptBlock } from "./imageObserve";
import { semanticToPromptBlock } from "./semanticCompose";
import type { UIObservationIR } from "./semanticTypes";
import type {
  CodeScaffold,
  ImageObservation,
  UiRegion,
  UiSpec,
} from "./types";
import { observeScreenshotIRLite } from "./uiObservation";

export const CODE_TARGETS = [
  "html-css-js",
  "react",
  "swiftui",
  "compose",
  "flutter",
  "react-native",
] as const;

export type CodeTarget = (typeof CODE_TARGETS)[number];

export const CODE_TARGET_LABELS: Record<CodeTarget, string> = {
  "html-css-js": "HTML / CSS / JavaScript",
  react: "React",
  swiftui: "SwiftUI",
  compose: "Jetpack Compose",
  flutter: "Flutter",
  "react-native": "React Native",
};

const LABELS = CODE_TARGET_LABELS;

/** Bridge legacy UiRegion API from IR. */
export function inferUiRegions(obs: ImageObservation): UiRegion[] {
  const ir = observeScreenshotIRLite(
    // Synthetic ImageData unavailable here — fall back to brightness bands
    fakeImageDataFromObs(obs),
  );
  return ir.regions.map((r) => ({
    id: r.id,
    roleGuess: r.roleGuess,
    bounds: r.bounds,
    confidence: r.confidence,
    notes: r.evidence,
  }));
}

function fakeImageDataFromObs(obs: ImageObservation): ImageData {
  const w = Math.max(3, Math.min(96, obs.width));
  const h = Math.max(3, Math.min(96, obs.height));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cell = obs.grid.find((g) => g.row === row && g.col === col);
      const bright = cell?.meanBrightness ?? 128;
      const x0 = Math.floor((col * w) / 3);
      const x1 = Math.floor(((col + 1) * w) / 3);
      const y0 = Math.floor((row * h) / 3);
      const y1 = Math.floor(((row + 1) * h) / 3);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = bright;
          data[i + 3] = 255;
        }
      }
    }
  }
  return new ImageData(data, w, h);
}

export function buildUiSpec(obs: ImageObservation): UiSpec {
  const regions = inferUiRegions(obs);
  return {
    frameworkTargets: CODE_TARGETS,
    layout: regions.some((r) => r.id === "region-rail")
      ? "Possible sidebar + content columns (uncertain)"
      : "Stacked header / main / footer with projection columns (uncertain)",
    regions,
    palette: obs.dominantColors,
    observations: obs,
    uncertainty: [
      ...obs.uncertainty,
      "Region roles include evidence strings — verify against screenshot.",
      "Scaffolds reflect IR structure when strong; otherwise honest starter + build prompt.",
    ],
  };
}

export function buildUiSpecFromIR(ir: UIObservationIR): UiSpec {
  return {
    frameworkTargets: CODE_TARGETS,
    layout: `IR: ${ir.columns} cols × ${ir.rows} rows; density ${ir.typography.density}; confidence ${ir.confidence}`,
    regions: ir.regions.map((r) => ({
      id: r.id,
      roleGuess: r.roleGuess,
      bounds: r.bounds,
      confidence: r.confidence,
      notes: r.evidence,
    })),
    palette: ir.palette,
    observations: ir.semantic.lite,
    uncertainty: ir.uncertainty,
  };
}

function paletteCss(obs: ImageObservation): string {
  return obs.dominantColors
    .slice(0, 4)
    .map((c, i) => `  --c${i + 1}: ${c.hex};`)
    .join("\n");
}

function regionStyle(r: UiRegion): string {
  const { x, y, w, h } = r.bounds;
  return `position:absolute;left:${(x * 100).toFixed(1)}%;top:${(y * 100).toFixed(1)}%;width:${(w * 100).toFixed(1)}%;height:${(h * 100).toFixed(1)}%;`;
}

function html(spec: UiSpec): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>SPE UI scaffold from screenshot IR</title>
<style>
:root {
${paletteCss(spec.observations)}
}
*{box-sizing:border-box}
body{margin:0;font:16px/1.45 system-ui,sans-serif;background:#0b0d10;color:#e8eaed}
.stage{position:relative;min-height:100vh;background:var(--c2,#111)}
section{outline:1px dashed rgba(255,255,255,.12);padding:.75rem}
.region-header{background:var(--c1,#222)}
.region-main{background:var(--c2,#111)}
.region-footer{background:var(--c3,#1a1a1a)}
.region-rail{background:var(--c4,#161616)}
</style></head><body>
<div class="stage">
${spec.regions
  .map(
    (r) =>
      `  <section class="${r.id}" style="${regionStyle(r)}" data-confidence="${r.confidence}" title="${r.notes.replace(/"/g, "'")}">
    <strong>${r.roleGuess}</strong>
    <!-- evidence: ${r.notes.replace(/-->/g, "")} -->
  </section>`,
  )
  .join("\n")}
</div>
</body></html>
`;
}

function react(spec: UiSpec): string {
  return `export default function ScreenFromScreenshot() {
  const regions = ${JSON.stringify(
    spec.regions.map((r) => ({
      id: r.id,
      role: r.roleGuess,
      confidence: r.confidence,
      bounds: r.bounds,
      evidence: r.notes,
    })),
    null,
    2,
  )};
  return (
    <div style={{ position: "relative", minHeight: "100vh", fontFamily: "system-ui", background: "${spec.palette[0]?.hex ?? "#0b0d10"}", color: "#f5f5f5" }}>
      {regions.map((r) => (
        <section
          key={r.id}
          aria-label={r.role}
          data-confidence={r.confidence}
          title={r.evidence}
          style={{
            position: "absolute",
            left: \`\${r.bounds.x * 100}%\`,
            top: \`\${r.bounds.y * 100}%\`,
            width: \`\${r.bounds.w * 100}%\`,
            height: \`\${r.bounds.h * 100}%\`,
            padding: 12,
            outline: "1px dashed rgba(255,255,255,0.15)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>{r.role}</h2>
        </section>
      ))}
    </div>
  );
}
`;
}

function swiftui(spec: UiSpec): string {
  return `import SwiftUI
struct ScreenFromScreenshot: View {
  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .topLeading) {
${spec.regions
  .map(
    (r) => `        VStack(alignment: .leading) {
          Text("${r.roleGuess}")
            .font(.headline)
          Text("${r.confidence}: ${r.notes.replace(/"/g, "'").slice(0, 80)}")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(width: geo.size.width * ${r.bounds.w.toFixed(3)}, height: geo.size.height * ${r.bounds.h.toFixed(3)}, alignment: .topLeading)
        .offset(x: geo.size.width * ${r.bounds.x.toFixed(3)}, y: geo.size.height * ${r.bounds.y.toFixed(3)})`,
  )
  .join("\n")}
      }
    }
    .background(Color.black)
  }
}
`;
}

function compose(spec: UiSpec): string {
  return `@Composable
fun ScreenFromScreenshot() {
  BoxWithConstraints(Modifier.fillMaxSize().background(Color(0xFF0B0D10))) {
${spec.regions
  .map(
    (r) => `    Column(
      Modifier
        .offset(x = maxWidth * ${r.bounds.x.toFixed(3)}f, y = maxHeight * ${r.bounds.y.toFixed(3)}f)
        .width(maxWidth * ${r.bounds.w.toFixed(3)}f)
        .height(maxHeight * ${r.bounds.h.toFixed(3)}f)
        .padding(12.dp)
    ) {
      Text("${r.roleGuess}")
      Text("${r.confidence}: ${r.notes.replace(/"/g, "'").slice(0, 72)}")
    }`,
  )
  .join("\n")}
  }
}
`;
}

function flutter(spec: UiSpec): string {
  return `import 'package:flutter/material.dart';
class ScreenFromScreenshot extends StatelessWidget {
  const ScreenFromScreenshot({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0D10),
      body: Stack(children: [
${spec.regions
  .map(
    (r) => `        Positioned(
          left: MediaQuery.of(context).size.width * ${r.bounds.x.toFixed(3)},
          top: MediaQuery.of(context).size.height * ${r.bounds.y.toFixed(3)},
          width: MediaQuery.of(context).size.width * ${r.bounds.w.toFixed(3)},
          height: MediaQuery.of(context).size.height * ${r.bounds.h.toFixed(3)},
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Text('${r.roleGuess}', style: const TextStyle(color: Colors.white)),
          ),
        ),`,
  )
  .join("\n")}
      ]),
    );
  }
}
`;
}

function rn(spec: UiSpec): string {
  return `import { View, Text, useWindowDimensions } from "react-native";
export default function ScreenFromScreenshot() {
  const { width, height } = useWindowDimensions();
  const regions = ${JSON.stringify(
    spec.regions.map((r) => ({
      id: r.id,
      role: r.roleGuess,
      bounds: r.bounds,
      confidence: r.confidence,
    })),
  )};
  return (
    <View style={{ flex: 1, backgroundColor: "${spec.palette[0]?.hex ?? "#0b0d10"}" }}>
      {regions.map((r) => (
        <View
          key={r.id}
          style={{
            position: "absolute",
            left: width * r.bounds.x,
            top: height * r.bounds.y,
            width: width * r.bounds.w,
            height: height * r.bounds.h,
            padding: 12,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16 }}>{r.role}</Text>
        </View>
      ))}
    </View>
  );
}
`;
}

const BUILDERS: Record<CodeTarget, (s: UiSpec) => string> = {
  "html-css-js": html,
  react,
  swiftui,
  compose,
  flutter,
  "react-native": rn,
};

function materialReflectsStructure(spec: UiSpec): boolean {
  return (
    spec.regions.length >= 2 &&
    spec.regions.some((r) => r.bounds.h > 0 && r.bounds.w > 0) &&
    spec.regions.every((r) => r.notes && r.notes.length > 0)
  );
}

export function buildScaffolds(
  spec: UiSpec,
  targets: CodeTarget[] = [...CODE_TARGETS],
  ir?: UIObservationIR | null,
): CodeScaffold[] {
  const reflects = materialReflectsStructure(spec);
  return targets.map((target) => {
    const code = BUILDERS[target](spec);
    const structuredSpec = ir
      ? [
          "STRUCTURED UI OBSERVATION IR:",
          `viewport: ${ir.viewport.sourceWidth}×${ir.viewport.sourceHeight} (analysis ${ir.viewport.width}×${ir.viewport.height})`,
          `layout: ${ir.columns} columns × ${ir.rows} rows; density ${ir.typography.density}`,
          `palette: ${ir.palette.map((c) => c.hex).join(", ")}`,
          `textBlocks: ${ir.textBlocks.length}; controls: ${ir.controls.length}; images: ${ir.images.length}`,
          ...ir.regions.map(
            (r) =>
              `- ${r.id}: ${r.roleGuess} [${r.confidence}] evidence=${r.evidence}`,
          ),
        ].join("\n")
      : null;
    return {
      target,
      label: LABELS[target],
      language:
        target === "html-css-js"
          ? "html"
          : target === "swiftui"
            ? "swift"
            : target === "compose"
              ? "kotlin"
              : target === "flutter"
                ? "dart"
                : "tsx",
      code,
      prompt: [
        `Rebuild this UI in ${LABELS[target]}.`,
        reflects
          ? "Starter scaffold materially mirrors observed region bounds from UIObservationIR — verify every region against the screenshot."
          : "Honest structured spec + starter: region geometry was weak; treat scaffold as a build prompt seed, not a pixel clone.",
        "",
        structuredSpec,
        "",
        ir ? semanticToPromptBlock(ir.semantic) : observationToPromptBlock(spec.observations),
        "",
        `Layout guess: ${spec.layout}`,
        ...spec.regions.map(
          (r) =>
            `- ${r.id}: ${r.roleGuess} [${r.confidence}] (${r.bounds.x.toFixed(2)},${r.bounds.y.toFixed(2)},${r.bounds.w.toFixed(2)},${r.bounds.h.toFixed(2)}) — ${r.notes}`,
        ),
        "",
        "Starter scaffold:",
        "```",
        code,
        "```",
      ]
        .filter((line) => line != null)
        .join("\n"),
    };
  });
}

export function screenshotToCodePackage(obs: ImageObservation) {
  const ir = observeScreenshotIRLite(fakeImageDataFromObs(obs));
  const spec = buildUiSpecFromIR(ir);
  return { spec, scaffolds: buildScaffolds(spec, [...CODE_TARGETS], ir), ir };
}

export function screenshotIRToCodePackage(ir: UIObservationIR) {
  const spec = buildUiSpecFromIR(ir);
  return { spec, scaffolds: buildScaffolds(spec, [...CODE_TARGETS], ir), ir };
}
