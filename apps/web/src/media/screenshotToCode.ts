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


function regionsByRole(spec: UiSpec) {
  const find = (re: RegExp) => spec.regions.filter((r) => re.test(r.roleGuess));
  return {
    header: find(/header|top bar|nav|toolbar/i),
    rail: find(/rail|sidebar|side/i),
    main: find(/main|content|hero/i),
    footer: find(/footer|bottom|action/i),
    all: spec.regions,
  };
}

function regionDomId(r: UiRegion): string {
  return r.id.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function corpus(spec: UiSpec): string {
  return spec.regions.map((r) => `${r.roleGuess} ${r.notes}`).join(" ");
}

function html(spec: UiSpec): string {
  const by = regionsByRole(spec);
  const hasRail = by.rail.length > 0;
  const blob = corpus(spec);
  const navItems = by.header
    .map((r) => `      <a href="#${regionDomId(r)}">${r.roleGuess}</a>`)
    .join("\n");
  const railLinks = by.rail
    .map((r) => `    <a href="#${regionDomId(r)}">${r.roleGuess}</a>`)
    .join("\n");
  const mainSource = by.main.length
    ? by.main
    : by.all.filter((r) => !/header|footer|rail|sidebar/i.test(r.roleGuess));
  const mainBlocks = mainSource
    .map(
      (r) =>
        `    <section id="${regionDomId(r)}" class="${r.id}" style="${regionStyle(r)}" data-role="${r.roleGuess}" data-confidence="${r.confidence}">\n` +
        `      <h2>${r.roleGuess}</h2>\n` +
        `      <!-- evidence: ${r.notes.replace(/-->/g, "")} -->\n` +
        `    </section>`,
    )
    .join("\n");
  const formHint = /form|input|search|sign-in|sign in/i.test(blob)
    ? `    <form class="spe-inferred-form" aria-label="Inferred form from screenshot">\n      <label>Field <input name="field" type="text"/></label>\n      <button type="submit">Continue</button>\n    </form>`
    : "";
  const cardHint = /card|grid|tile/i.test(blob)
    ? `    <div class="spe-card-grid" role="list">\n      <article class="spe-card" role="listitem"><h3>Card A</h3></article>\n      <article class="spe-card" role="listitem"><h3>Card B</h3></article>\n      <article class="spe-card" role="listitem"><h3>Card C</h3></article>\n    </div>`
    : "";
  const modalHint = /modal|dialog|overlay/i.test(blob)
    ? `    <div class="spe-modal" role="dialog" aria-modal="true"><h2>Dialog</h2><button type="button">Close</button></div>`
    : "";
  const gridCols = hasRail ? "240px 1fr" : "1fr";
  const railBlock = hasRail
    ? `  <aside class="spe-rail" role="navigation" aria-label="Side rail">\n${railLinks}\n  </aside>`
    : "  <!-- no side rail -->";
  const footerText = by.footer.map((r) => r.roleGuess).join(" · ") || "Footer";
  return (
    `<!doctype html>\n` +
    `<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>\n` +
    `<title>SPE UI scaffold from screenshot IR</title>\n` +
    `<style>\n:root {\n${paletteCss(spec.observations)}\n}\n` +
    `*{box-sizing:border-box}\n` +
    `body{margin:0;font:16px/1.45 system-ui,sans-serif;background:#0b0d10;color:#e8eaed}\n` +
    `.shell{display:grid;min-height:100vh;grid-template-columns:${gridCols};grid-template-rows:auto 1fr auto}\n` +
    `header.spe-top{grid-column:1/-1;background:var(--c1,#222);padding:.75rem 1rem;display:flex;gap:1rem;align-items:center}\n` +
    `aside.spe-rail{background:var(--c4,#161616);padding:1rem;display:flex;flex-direction:column;gap:.5rem}\n` +
    `main.spe-main{position:relative;background:var(--c2,#111);padding:1rem}\n` +
    `footer.spe-foot{grid-column:1/-1;background:var(--c3,#1a1a1a);padding:.75rem 1rem}\n` +
    `.spe-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:1rem}\n` +
    `.spe-card{border:1px solid rgba(255,255,255,.12);padding:12px;border-radius:8px}\n` +
    `.spe-modal{position:fixed;inset:20% 25%;background:#1a1d24;border:1px solid rgba(255,255,255,.2);padding:1rem;z-index:5}\n` +
    `section{outline:1px dashed rgba(255,255,255,.12);padding:.75rem}\n` +
    `</style></head><body>\n` +
    `<div class="shell">\n` +
    `  <header class="spe-top" role="banner">\n` +
    `    <strong>App</strong>\n` +
    `    <nav aria-label="Primary">\n${navItems || "      <!-- no header regions -->"}\n` +
    `    </nav>\n` +
    `  </header>\n` +
    `${railBlock}\n` +
    `  <main class="spe-main" role="main">\n` +
    `${mainBlocks}\n` +
    `${formHint}\n` +
    `${cardHint}\n` +
    `${modalHint}\n` +
    `  </main>\n` +
    `  <footer class="spe-foot" role="contentinfo">${footerText}</footer>\n` +
    `</div>\n` +
    `</body></html>\n`
  );
}

function react(spec: UiSpec): string {
  const by = regionsByRole(spec);
  const hasRail = by.rail.length > 0;
  const blob = corpus(spec);
  const wantsForm = /form|input|search|sign-in|sign in/i.test(blob);
  const wantsCards = /card|grid|tile/i.test(blob);
  const wantsModal = /modal|dialog|overlay/i.test(blob);
  const regionJson = JSON.stringify(
    spec.regions.map((r) => ({
      id: r.id,
      role: r.roleGuess,
      confidence: r.confidence,
      bounds: r.bounds,
      evidence: r.notes,
    })),
    null,
    2,
  );
  const formJsx = wantsForm
    ? `<form aria-label="Inferred form"><label>Field <input name="field" /></label><button type="submit">Continue</button></form>`
    : "";
  const cardsJsx = wantsCards
    ? `<div role="list" className="spe-card-grid"><article role="listitem">Card A</article><article role="listitem">Card B</article><article role="listitem">Card C</article></div>`
    : "";
  const modalJsx = wantsModal
    ? `<div role="dialog" aria-modal="true"><h2>Dialog</h2><button type="button">Close</button></div>`
    : "";
  const bg = spec.palette[0]?.hex ?? "#0b0d10";
  return (
    `export default function ScreenFromScreenshot() {\n` +
    `  const regions = ${regionJson};\n` +
    `  const hasRail = ${hasRail ? "true" : "false"};\n` +
    `  return (\n` +
    `    <div style={{ display: "grid", minHeight: "100vh", gridTemplateColumns: hasRail ? "240px 1fr" : "1fr", gridTemplateRows: "auto 1fr auto", fontFamily: "system-ui", background: "${bg}", color: "#f5f5f5" }}>\n` +
    `      <header role="banner" style={{ gridColumn: "1 / -1", padding: 12, display: "flex", gap: 12 }}>\n` +
    `        <strong>App</strong>\n` +
    `        <nav aria-label="Primary">{regions.filter((r) => /header|top|nav|toolbar/i.test(r.role)).map((r) => <a key={r.id} href={"#" + r.id}>{r.role}</a>)}</nav>\n` +
    `      </header>\n` +
    `      {hasRail ? <aside role="navigation" aria-label="Side rail" style={{ padding: 12 }}>{regions.filter((r) => /rail|sidebar|side/i.test(r.role)).map((r) => <a key={r.id} href={"#" + r.id}>{r.role}</a>)}</aside> : null}\n` +
    `      <main role="main" style={{ position: "relative", padding: 12 }}>\n` +
    `        {regions.map((r) => (\n` +
    `          <section key={r.id} id={r.id} aria-label={r.role} data-confidence={r.confidence} title={r.evidence} style={{ position: "absolute", left: \`\${r.bounds.x * 100}%\`, top: \`\${r.bounds.y * 100}%\`, width: \`\${r.bounds.w * 100}%\`, height: \`\${r.bounds.h * 100}%\`, padding: 12, outline: "1px dashed rgba(255,255,255,0.15)" }}>\n` +
    `            <h2 style={{ margin: 0, fontSize: 16 }}>{r.role}</h2>\n` +
    `          </section>\n` +
    `        ))}\n` +
    `        ${formJsx}\n` +
    `        ${cardsJsx}\n` +
    `        ${modalJsx}\n` +
    `      </main>\n` +
    `      <footer role="contentinfo" style={{ gridColumn: "1 / -1", padding: 12 }}>Footer</footer>\n` +
    `    </div>\n` +
    `  );\n` +
    `}\n`
  );
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
