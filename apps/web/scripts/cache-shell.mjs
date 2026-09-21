/** Precache the exact production shell, including lazy 3D and Worker chunks. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const root = new URL("../dist/", import.meta.url);
const assets = readdirSync(new URL("assets/", root)).map((p) => "/assets/" + p);
const list = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/art/intent-core.webp",
  "/spe_wasm.wasm",
  "/spe_wasm.sha256.json",
  ...assets,
];
const digest = createHash("sha256")
  .update(JSON.stringify(list))
  .update(readFileSync(new URL("art/intent-core.webp", root)))
  .update(readFileSync(new URL("spe_wasm.sha256.json", root)))
  .digest("hex")
  .slice(0, 12);
let sw = readFileSync(new URL("sw.js", root), "utf8");
sw = sw
  .replace(/const CACHE = .*?;/, `const CACHE = "spe-web03-${digest}";`)
  .replace(
    /const PRECACHE = \[[\s\S]*?\];/,
    `const PRECACHE = ${JSON.stringify(list, null, 2)};`,
  );
writeFileSync(new URL("sw.js", root), sw);
console.log(`Precached ${list.length} same-origin shell assets; no user data.`);
