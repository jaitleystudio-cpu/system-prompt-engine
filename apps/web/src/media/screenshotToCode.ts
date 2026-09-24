import { observationToPromptBlock } from "./imageObserve";
import type {
  CodeScaffold,
  ImageObservation,
  UiRegion,
  UiSpec,
} from "./types";

export const CODE_TARGETS = [
  "html-css-js",
  "react",
  "swiftui",
  "compose",
  "flutter",
  "react-native",
] as const;

export type CodeTarget = (typeof CODE_TARGETS)[number];

const LABELS: Record<CodeTarget, string> = {
  "html-css-js": "HTML / CSS / JS",
  react: "React",
  swiftui: "SwiftUI",
  compose: "Jetpack Compose",
  flutter: "Flutter",
  "react-native": "React Native",
};

export function inferUiRegions(obs: ImageObservation): UiRegion[] {
  const top = obs.grid.filter((g) => g.row === 0);
  const mid = obs.grid.filter((g) => g.row === 1);
  const bot = obs.grid.filter((g) => g.row === 2);
  const avg = (xs: typeof top) =>
    xs.reduce((s, g) => s + g.meanBrightness, 0) / (xs.length || 1);
  const regions: UiRegion[] = [
    {
      id: "top-bar",
      roleGuess: "Top bar / header",
      bounds: { x: 0, y: 0, w: 1, h: 1 / 3 },
      confidence: "medium",
      notes: `Mean brightness ${avg(top).toFixed(0)}. Likely navigation or title band.`,
    },
    {
      id: "main",
      roleGuess: "Main content",
      bounds: { x: 0, y: 1 / 3, w: 1, h: 1 / 3 },
      confidence: "medium",
      notes: `Mean brightness ${avg(mid).toFixed(0)}. Primary body region guess.`,
    },
    {
      id: "bottom",
      roleGuess: "Footer / actions",
      bounds: { x: 0, y: 2 / 3, w: 1, h: 1 / 3 },
      confidence: "low",
      notes: `Mean brightness ${avg(bot).toFixed(0)}. May be footer, tabs, or empty space.`,
    },
  ];
  const left = obs.grid.filter((g) => g.col === 0);
  const right = obs.grid.filter((g) => g.col === 2);
  if (Math.abs(avg(left) - avg(right)) > 40) {
    regions.push({
      id: "side-rail",
      roleGuess: "Side rail / panel",
      bounds: { x: avg(left) < avg(right) ? 0 : 2 / 3, y: 0, w: 1 / 3, h: 1 },
      confidence: "low",
      notes: "Left/right brightness diverge — possible sidebar. Uncertain.",
    });
  }
  return regions;
}

export function buildUiSpec(obs: ImageObservation): UiSpec {
  const regions = inferUiRegions(obs);
  return {
    frameworkTargets: CODE_TARGETS,
    layout: regions.some((r) => r.id === "side-rail")
      ? "Possible sidebar + content columns (uncertain)"
      : "Stacked top / main / bottom bands (uncertain)",
    regions,
    palette: obs.dominantColors,
    observations: obs,
    uncertainty: [
      ...obs.uncertainty,
      "Region roles are brightness heuristics, not ML detection.",
      "Typography, icons, and exact spacing are not measured.",
    ],
  };
}

function paletteCss(obs: ImageObservation): string {
  return obs.dominantColors
    .slice(0, 4)
    .map((c, i) => `  --c${i + 1}: ${c.hex};`)
    .join("\n");
}

function html(spec: UiSpec): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>SPE UI scaffold</title>
<style>
:root {
${paletteCss(spec.observations)}
}
body{margin:0;font:16px/1.45 system-ui,sans-serif;background:#0b0d10;color:#e8eaed}
.top-bar{min-height:56px;background:var(--c1,#222)}
.main{min-height:50vh;background:var(--c2,#111);padding:1.25rem}
.bottom{min-height:64px;background:var(--c3,#1a1a1a)}
.side-rail{min-height:40vh;background:var(--c4,#161616)}
</style></head><body>
${spec.regions.map((r) => `  <section class="${r.id}" data-confidence="${r.confidence}"><!-- ${r.roleGuess}: ${r.notes} --></section>`).join("\n")}
</body></html>
`;
}

function react(spec: UiSpec): string {
  return `export default function ScreenFromScreenshot() {
  return (
    <div style={{ fontFamily: "system-ui", background: "${spec.palette[0]?.hex ?? "#0b0d10"}", color: "#f5f5f5", minHeight: "100vh" }}>
${spec.regions.map((r) => `      <section aria-label="${r.roleGuess}" data-confidence="${r.confidence}" style={{ padding: 16 }}>
        {/* ${r.notes} */}
        <h2>${r.roleGuess}</h2>
      </section>`).join("\n")}
    </div>
  );
}
`;
}

function swiftui(spec: UiSpec): string {
  return `import SwiftUI
struct ScreenFromScreenshot: View {
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
${spec.regions.map((r) => `        Text("${r.roleGuess}") // ${r.confidence}: ${r.notes}`).join("\n")}
      }.padding()
    }.background(Color.black)
  }
}
`;
}

function compose(spec: UiSpec): string {
  return `@Composable
fun ScreenFromScreenshot() {
  Column(Modifier.fillMaxSize().padding(16.dp)) {
${spec.regions.map((r) => `    Text("${r.roleGuess}") // ${r.confidence}: ${r.notes}`).join("\n")}
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
    return Scaffold(body: ListView(padding: const EdgeInsets.all(16), children: [
${spec.regions.map((r) => `      Text('${r.roleGuess}'), // ${r.confidence}: ${r.notes}`).join("\n")}
    ]));
  }
}
`;
}

function rn(spec: UiSpec): string {
  return `import { ScrollView, Text, View } from "react-native";
export default function ScreenFromScreenshot() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: "${spec.palette[0]?.hex ?? "#0b0d10"}" }}>
${spec.regions.map((r) => `      <View style={{ padding: 16 }}><Text style={{ color: "#fff", fontSize: 18 }}>${r.roleGuess}</Text></View>`).join("\n")}
    </ScrollView>
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

export function buildScaffolds(
  spec: UiSpec,
  targets: CodeTarget[] = [...CODE_TARGETS],
): CodeScaffold[] {
  return targets.map((target) => {
    const code = BUILDERS[target](spec);
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
        "Treat region roles as uncertain screenshot guesses — verify against the image.",
        "",
        observationToPromptBlock(spec.observations),
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
      ].join("\n"),
    };
  });
}

export function screenshotToCodePackage(obs: ImageObservation) {
  const spec = buildUiSpec(obs);
  return { spec, scaffolds: buildScaffolds(spec) };
}
