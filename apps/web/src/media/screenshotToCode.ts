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
  const ir = observeScreenshotIRLite(fakeImageDataFromObs(obs));
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
    layout: regions.some((r) => /rail|sidebar/i.test(r.roleGuess))
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

function hintsOf(spec: UiSpec): string {
  return [...spec.uncertainty, ...spec.regions.map((r) => r.notes)].join(" ");
}

function hasHint(spec: UiSpec, re: RegExp): boolean {
  return re.test(hintsOf(spec)) || spec.regions.some((r) => re.test(r.roleGuess));
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function regionStyle(r: UiRegion): string {
  const { x, y, w, h } = r.bounds;
  return `left:${pct(x)};top:${pct(y)};width:${pct(w)};height:${pct(h)}`;
}

function zoneAttr(r: UiRegion): string {
  const cx = r.bounds.x + r.bounds.w / 2;
  const cy = r.bounds.y + r.bounds.h / 2;
  const hz = cx < 0.33 ? "left" : cx > 0.66 ? "right" : "center";
  const vz = cy < 0.33 ? "top" : cy > 0.66 ? "bottom" : "mid";
  return `${vz}-${hz}`;
}

function paletteCss(obs: ImageObservation): string {
  return obs.dominantColors
    .slice(0, 4)
    .map((c, i) => `  --c${i + 1}: ${c.hex};`)
    .join("\n");
}

function structureFlags(spec: UiSpec) {
  return {
    rail: hasHint(spec, /rail|sidebar|side rail/i),
    form: hasHint(spec, /form-panel|Form \/ input/i),
    cards: hasHint(spec, /card-grid|Card \/ tile/i),
    modal: hasHint(spec, /modal-or-dialog|Modal \/ dialog/i),
    hero: hasHint(spec, /nav-hero|Hero \/ featured/i),
    toolbarList: hasHint(spec, /toolbar-list|Toolbar \/ tool|List \/ stacked|List row/i),
  };
}

function html(spec: UiSpec): string {
  const f = structureFlags(spec);
  const gridCols = f.rail ? "240px 1fr" : "1fr";
  const header = spec.regions.filter((r) => /header|top bar|nav/i.test(r.roleGuess));
  const rail = spec.regions.filter((r) => /rail|sidebar/i.test(r.roleGuess));
  const footer = spec.regions.filter((r) => /footer|bottom/i.test(r.roleGuess));
  const main = spec.regions.filter(
    (r) => !/header|footer|rail|sidebar/i.test(r.roleGuess),
  );
  const nav = header
    .map((r) => `      <a href="#${r.id}" data-zone="${zoneAttr(r)}">${r.roleGuess}</a>`)
    .join("\n");
  const railHtml = f.rail
    ? `  <aside class="spe-rail" role="navigation" aria-label="Side rail" data-structure="left-rail">\n` +
      rail
        .map((r) => `    <a href="#${r.id}" data-zone="${zoneAttr(r)}">${r.roleGuess}</a>`)
        .join("\n") +
      `\n  </aside>`
    : "  <!-- structure: no side rail -->";
  const sections = main
    .map(
      (r) =>
        `    <section id="${r.id}" class="spe-region" style="position:absolute;${regionStyle(r)}" data-role="${r.roleGuess}" data-zone="${zoneAttr(r)}" data-confidence="${r.confidence}" data-hierarchy="2">\n` +
        `      <h2>${r.roleGuess}</h2>\n` +
        `      <!-- evidence: ${r.notes.replace(/-->/g, "")} -->\n` +
        `    </section>`,
    )
    .join("\n");
  const formHtml = f.form
    ? `    <form class="spe-form" aria-label="Inferred form" data-structure="form" data-hierarchy="2">\n` +
      `      <label>Field <input name="field" type="text"/></label>\n` +
      `      <label>Field <input name="field2" type="text"/></label>\n` +
      `      <button type="submit">Continue</button>\n` +
      `    </form>`
    : "";
  const cardRegions = spec.regions.filter((r) => /Card \/ tile/i.test(r.roleGuess)).slice(0, 6);
  const cardsHtml = f.cards
    ? `    <div class="spe-card-grid" role="list" data-structure="card-grid" data-hierarchy="2">\n` +
      cardRegions
        .map(
          (r, i) =>
            `      <article class="spe to-card" role="listitem" id="${r.id}" data-zone="${zoneAttr(r)}" style="${regionStyle(r)}"><h3>Card ${i + 1}</h3></article>`.replace(
              "spe to-card",
              "spe-card",
            ),
        )
        .join("\n") +
      `\n    </div>`
    : "";
  const modalHtml = f.modal
    ? `    <div class="spe-modal" role="dialog" aria-modal="true" data-structure="modal" data-hierarchy="3">\n` +
      `      <h2>Dialog</h2>\n` +
      `      <p>Observed modal overlay — verify against screenshot.</p>\n` +
      `      <button type="button">Close</button>\n` +
      `    </div>`
    : "";
  const heroHtml = f.hero
    ? `    <section class="spe-hero" data-structure="nav-hero" data-hierarchy="2" data-zone="mid-center">\n` +
      `      <h1>Hero</h1>\n` +
      `      <p>Featured band under navigation</p>\n` +
      `    </section>`
    : "";
  const listRows = spec.regions.filter((r) => /List row/i.test(r.roleGuess));
  const listHtml = f.toolbarList
    ? `    <div class="spe-toolbar" role="toolbar" data-structure="toolbar-list" data-hierarchy="2" data-zone="top-center">Toolbar</div>\n` +
      `    <ul class="spe-list" data-structure="toolbar-list" data-hierarchy="2">\n` +
      listRows
        .map((r) => `      <li data-zone="${zoneAttr(r)}" style="${regionStyle(r)}">${r.roleGuess}</li>`)
        .join("\n") +
      `\n    </ul>`
    : "";
  const footerText = footer.map((r) => r.roleGuess).join(" · ") || "Footer";
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
    `main.spe-main{position:relative;background:var(--c2,#111);padding:1rem;min-height:50vh}\n` +
    `footer.spe-foot{grid-column:1/-1;background:var(--c3,#1a1a1a);padding:.75rem 1rem}\n` +
    `.spe-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:1rem}\n` +
    `.spe-card{border:1px solid rgba(255,255,255,.12);padding:12px;border-radius:8px}\n` +
    `.spe-modal{position:fixed;inset:18% 22%;background:#1a1d24;border:1px solid rgba(255,255,255,.25);padding:1rem;z-index:5}\n` +
    `.spe-hero{padding:2rem 1rem;background:rgba(255,255,255,.06);margin-bottom:1rem}\n` +
    `.spe-toolbar{padding:.5rem .75rem;background:#1c1f26;margin-bottom:.75rem}\n` +
    `.spe-list{list-style:none;padding:0;margin:0}\n` +
    `.spe-list li{padding:.75rem;border-bottom:1px solid rgba(255,255,255,.08)}\n` +
    `.spe-form{display:flex;flex-direction:column;gap:.75rem;max-width:28rem;margin:1rem auto;padding:1rem;background:rgba(255,255,255,.05)}\n` +
    `.spe-region{outline:1px dashed rgba(255,255,255,.12);padding:.5rem}\n` +
    `</style></head><body>\n` +
    `<!-- OBSERVATION scaffold: structure resemblance, not pixel-perfect reconstruction -->\n` +
    `<div class="shell" data-hierarchy="1">\n` +
    `  <header class="spe-top" role="banner" data-zone="top-center" data-hierarchy="2">\n` +
    `    <strong>App</strong>\n` +
    `    <nav aria-label="Primary">\n${nav || "      <!-- no header regions -->"}\n` +
    `    </nav>\n` +
    `  </header>\n` +
    `${railHtml}\n` +
    `  <main class="spe-main" role="main" data-zone="mid-center" data-hierarchy="2">\n` +
    `${heroHtml}\n` +
    `${sections}\n` +
    `${formHtml}\n` +
    `${cardsHtml}\n` +
    `${modalHtml}\n` +
    `${listHtml}\n` +
    `  </main>\n` +
    `  <footer class="spe-foot" role="contentinfo" data-zone="bottom-center" data-hierarchy="2">${footerText}</footer>\n` +
    `</div>\n` +
    `</body></html>\n`
  );
}

function react(spec: UiSpec): string {
  const f = structureFlags(spec);
  const regionJson = JSON.stringify(
    spec.regions.map((r) => ({
      id: r.id,
      role: r.roleGuess,
      confidence: r.confidence,
      bounds: r.bounds,
      zone: zoneAttr(r),
      evidence: r.notes,
    })),
    null,
    2,
  );
  const bg = spec.palette[0]?.hex ?? "#0b0d10";
  return (
    `export default function ScreenFromScreenshot() {\n` +
    `  // OBSERVATION scaffold — structure resemblance, not pixel-perfect\n` +
    `  const regions = ${regionJson};\n` +
    `  const hasRail = ${f.rail ? "true" : "false"};\n` +
    `  const structure = ${JSON.stringify({
      form: f.form,
      cards: f.cards,
      modal: f.modal,
      hero: f.hero,
      toolbarList: f.toolbarList,
    })};\n` +
    `  return (\n` +
    `    <div data-hierarchy="1" style={{ display: "grid", minHeight: "100vh", gridTemplateColumns: hasRail ? "240px 1fr" : "1fr", gridTemplateRows: "auto 1fr auto", fontFamily: "system-ui", background: "${bg}", color: "#f5f5f5" }}>\n` +
    `      <header role="banner" data-zone="top-center" data-hierarchy="2" style={{ gridColumn: "1 / -1", padding: 12, display: "flex", gap: 12 }}>\n` +
    `        <strong>App</strong>\n` +
    `        <nav aria-label="Primary">{regions.filter((r) => /header|top|nav|toolbar/i.test(r.role)).map((r) => <a key={r.id} href={"#" + r.id} data-zone={r.zone}>{r.role}</a>)}</nav>\n` +
    `      </header>\n` +
    `      {hasRail ? <aside role="navigation" aria-label="Side rail" data-structure="left-rail" data-hierarchy="2" style={{ padding: 12 }}>{regions.filter((r) => /rail|sidebar|side/i.test(r.role)).map((r) => <a key={r.id} href={"#" + r.id}>{r.role}</a>)}</aside> : null}\n` +
    `      <main role="main" data-zone="mid-center" data-hierarchy="2" style={{ position: "relative", padding: 12 }}>\n` +
    `        {structure.hero ? <section data-structure="nav-hero" data-hierarchy="2"><h1>Hero</h1></section> : null}\n` +
    `        {regions.map((r) => (\n` +
    `          <section key={r.id} id={r.id} aria-label={r.role} data-zone={r.zone} data-confidence={r.confidence} data-hierarchy="2" title={r.evidence} style={{ position: "absolute", left: \`\${r.bounds.x * 100}%\`, top: \`\${r.bounds.y * 100}%\`, width: \`\${r.bounds.w * 100}%\`, height: \`\${r.bounds.h * 100}%\`, padding: 12, outline: "1px dashed rgba(255,255,255,0.15)" }}>\n` +
    `            <h2 style={{ margin: 0, fontSize: 16 }}>{r.role}</h2>\n` +
    `          </section>\n` +
    `        ))}\n` +
    `        {structure.form ? <form aria-label="Inferred form" data-structure="form" data-hierarchy="2"><label>Field <input name="field" /></label><button type="submit">Continue</button></form> : null}\n` +
    `        {structure.cards ? <div role="list" data-structure="card-grid" data-hierarchy="2">{regions.filter((r) => /Card/i.test(r.role)).map((r) => <article key={r.id} role="listitem" data-zone={r.zone}>{r.role}</article>)}</div> : null}\n` +
    `        {structure.modal ? <div role="dialog" aria-modal="true" data-structure="modal" data-hierarchy="3"><h2>Dialog</h2><button type="button">Close</button></div> : null}\n` +
    `        {structure.toolbarList ? <><div role="toolbar" data-structure="toolbar-list" data-hierarchy="2">Toolbar</div><ul data-structure="toolbar-list">{regions.filter((r) => /List row/i.test(r.role)).map((r) => <li key={r.id}>{r.role}</li>)}</ul></> : null}\n` +
    `      </main>\n` +
    `      <footer role="contentinfo" data-zone="bottom-center" data-hierarchy="2" style={{ gridColumn: "1 / -1", padding: 12 }}>Footer</footer>\n` +
    `    </div>\n` +
    `  );\n` +
    `}\n`
  );
}

function structureComments(spec: UiSpec): string {
  const f = structureFlags(spec);
  const bits = [
    f.hero ? "nav-hero" : null,
    f.form ? "form" : null,
    f.cards ? "card-grid" : null,
    f.modal ? "modal" : null,
    f.rail ? "left-rail" : null,
    f.toolbarList ? "toolbar-list" : null,
  ].filter(Boolean);
  return bits.length ? `// data-structure=${bits.join(",")}` : "// data-structure=generic-stack";
}

function swiftui(spec: UiSpec): string {
  return `import SwiftUI
// OBSERVATION scaffold — structure resemblance, not pixel-perfect
${structureComments(spec)}
struct ScreenFromScreenshot: View {
  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .topLeading) {
${spec.regions
  .map(
    (r) => `        VStack(alignment: .leading) {
          Text("${r.roleGuess}")
            .font(.headline)
          Text("zone=${zoneAttr(r)} ${r.confidence}")
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
// OBSERVATION scaffold — structure resemblance, not pixel-perfect
${structureComments(spec)}
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
      Text("zone=${zoneAttr(r)} ${r.confidence}")
    }`,
  )
  .join("\n")}
  }
}
`;
}

function flutter(spec: UiSpec): string {
  return `import 'package:flutter/material.dart';
// OBSERVATION scaffold — structure resemblance, not pixel-perfect
${structureComments(spec)}
class ScreenFromScreenshot extends StatelessWidget {
  const ScreenFromScreenshot({super.key});
  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return Scaffold(
      backgroundColor: const Color(0xFF0B0D10),
      body: Stack(children: [
${spec.regions
  .map(
    (r) => `        Positioned(
          left: size.width * ${r.bounds.x.toFixed(3)},
          top: size.height * ${r.bounds.y.toFixed(3)},
          width: size.width * ${r.bounds.w.toFixed(3)},
          height: size.height * ${r.bounds.h.toFixed(3)},
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Text('${r.roleGuess} (zone=${zoneAttr(r)})', style: const TextStyle(color: Colors.white)),
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
  const f = structureFlags(spec);
  return `import { View, Text, useWindowDimensions } from "react-native";
// OBSERVATION scaffold — structure resemblance, not pixel-perfect
${structureComments(spec)}
export default function ScreenFromScreenshot() {
  const { width, height } = useWindowDimensions();
  const regions = ${JSON.stringify(
    spec.regions.map((r) => ({
      id: r.id,
      role: r.roleGuess,
      bounds: r.bounds,
      zone: zoneAttr(r),
      confidence: r.confidence,
    })),
  )};
  const structure = ${JSON.stringify(f)};
  return (
    <View style={{ flex: 1, backgroundColor: "${spec.palette[0]?.hex ?? "#0b0d10"}" }}>
      {structure.rail ? <Text>left-rail</Text> : null}
      {structure.form ? <Text>form</Text> : null}
      {structure.cards ? <Text>card-grid</Text> : null}
      {structure.modal ? <Text>modal</Text> : null}
      {structure.toolbarList ? <Text>toolbar-list</Text> : null}
      {structure.hero ? <Text>nav-hero</Text> : null}
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
          <Text style={{ color: "#fff", fontSize: 16 }}>{r.role} ({r.zone})</Text>
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
          ? "Starter scaffold materially mirrors observed region bounds from UIObservationIR — verify every region against the screenshot. This is structure resemblance, not a pixel-perfect clone."
          : "Honest structured spec + starter: region geometry was weak; treat scaffold as a build prompt seed, not a pixel clone.",
        "",
        structuredSpec,
        "",
        ir ? semanticToPromptBlock(ir.semantic) : observationToPromptBlock(spec.observations),
        "",
        `Layout guess: ${spec.layout}`,
        ...spec.regions.map(
          (r) =>
            `- ${r.id}: ${r.roleGuess} [${r.confidence}] (${r.bounds.x.toFixed(2)},${r.bounds.y.toFixed(2)},${r.bounds.w.toFixed(2)},${r.bounds.h.toFixed(2)}) zone=${zoneAttr(r)} — ${r.notes}`,
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
