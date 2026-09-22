import ts from "../apps/web/node_modules/typescript/lib/typescript.js";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, relative } from "node:path";
export const root = resolve(new URL("..", import.meta.url).pathname);
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
}
export function inventory() {
  const paths = walk(`${root}/apps/web/src`).filter(
    (p) => /\.[jt]sx?$/.test(p) && !p.includes("/engine/"),
  );
  paths.push(`${root}/packages/human-perspective/src/copy.ts`);
  const entries = new Map();
  for (const path of paths) {
    const file = relative(root, path),
      source = ts.createSourceFile(
        file,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
    const inspect = (node) => {
      let text;
      if (ts.isJsxText(node)) text = node.text.replace(/\s+/g, " ").trim();
      else if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        if (
          ts.isImportDeclaration(node.parent) ||
          ts.isLiteralTypeNode(node.parent)
        )
          return;
        if (ts.isPropertyAssignment(node.parent) && node.parent.name === node)
          return;
        let p = node.parent,
          attr;
        while (p && !ts.isSourceFile(p)) {
          if (ts.isJsxAttribute(p)) {
            attr = p;
            break;
          }
          p = p.parent;
        }
        if (
          attr &&
          ![
            "aria-label",
            "aria-description",
            "title",
            "placeholder",
            "alt",
          ].includes(attr.name.getText(source))
        )
          return;
        if (
          node.text.startsWith("./") ||
          node.text.startsWith("../") ||
          node.text.startsWith("@spe/")
        )
          return;
        text = node.text.trim();
      }
      if (text && /\p{L}/u.test(text)) {
        let depth = "PRODUCT",
          p = node.parent;
        if (/ui\/(TrustPanel|PrivacyIndicator)\.tsx$/.test(file))
          depth = "PROOF";
        while (p) {
          if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) {
            const attrs = (ts.isJsxElement(p) ? p.openingElement : p).attributes
              .properties;
            const attribute = attrs.find(
              (a) =>
                ts.isJsxAttribute(a) &&
                a.name.getText(source) === "data-copy-depth",
            );
            if (
              attribute?.initializer &&
              ts.isStringLiteral(attribute.initializer)
            )
              depth = attribute.initializer.text;
          }
          if (
            ts.isVariableDeclaration(p) &&
            p.name.getText(source) === "heroLibrary"
          )
            depth = "EXPERIENCE";
          if (
            ts.isVariableDeclaration(p) &&
            p.name.getText(source) === "copyMeanings"
          )
            return;
          p = p.parent;
        }
        const id = createHash("sha256")
          .update(`${file}\0${depth}\0${text}`)
          .digest("hex")
          .slice(0, 20);
        entries.set(id, { id, file, depth, text });
      }
      ts.forEachChild(node, inspect);
    };
    inspect(source);
  }
  const html = readFileSync(`${root}/apps/web/index.html`, "utf8");
  const metadata = [
    ...html.matchAll(
      /<title>([^<]+)<\/title>|name="description"\s+content="([^"]+)"/g,
    ),
  ].map((m) => m[1] || m[2]);
  const manifest = JSON.parse(
    readFileSync(`${root}/apps/web/public/manifest.webmanifest`),
  );
  for (const [file, texts] of [
    ["apps/web/index.html", metadata],
    [
      "apps/web/public/manifest.webmanifest",
      [manifest.name, manifest.short_name, manifest.description],
    ],
  ])
    for (const text of texts) {
      const depth = "EXPERIENCE";
      const id = createHash("sha256")
        .update(`${file}\0${depth}\0${text}`)
        .digest("hex")
        .slice(0, 20);
      entries.set(id, { id, file, depth, text });
    }
  return [...entries.values()].sort(
    (a, b) => a.file.localeCompare(b.file) || a.id.localeCompare(b.id),
  );
}
if (process.argv[1] === new URL(import.meta.url).pathname)
  console.log(JSON.stringify(inventory(), null, 2));
