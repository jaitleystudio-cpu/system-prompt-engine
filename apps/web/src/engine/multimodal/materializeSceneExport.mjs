import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPORT_THREE_ARTIFACT,
  EXPORT_THREE_INTEGRITY,
  EXPORT_THREE_SHA256,
  EXPORT_THREE_VERSION,
  SceneCompiler,
} from "./sceneCompiler.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Confirms the vendored file is the already-installed lockfile pin. Does not download. */
export function assertPackagedThree() {
  const vendorPath = path.join(here, "vendor/three.min.js");
  const installedPath = path.join(webRoot, "node_modules/three/build/three.module.min.js");
  const vendor = readFileSync(vendorPath);
  const installed = readFileSync(installedPath);
  const vendorHash = sha256(vendor);
  const installedHash = sha256(installed);
  if (vendorHash !== installedHash || vendorHash !== EXPORT_THREE_SHA256) {
    throw new Error(
      `three artifact mismatch vendor=${vendorHash} installed=${installedHash} pin=${EXPORT_THREE_SHA256}`,
    );
  }
  const pkg = JSON.parse(readFileSync(path.join(webRoot, "node_modules/three/package.json"), "utf8"));
  if (pkg.version !== EXPORT_THREE_VERSION) {
    throw new Error(`installed three ${pkg.version} != ${EXPORT_THREE_VERSION}`);
  }
  const lock = JSON.parse(readFileSync(path.join(webRoot, "package-lock.json"), "utf8"));
  const locked = lock.packages?.["node_modules/three"];
  if (!locked || locked.version !== EXPORT_THREE_VERSION || locked.integrity !== EXPORT_THREE_INTEGRITY) {
    throw new Error("lockfile three pin mismatch");
  }
  return {
    version: EXPORT_THREE_VERSION,
    sha256: vendorHash,
    integrity: locked.integrity,
    resolved: locked.resolved,
    bytes: vendor.length,
    artifact: EXPORT_THREE_ARTIFACT,
    source: "node_modules/three/build/three.module.min.js",
  };
}

export function materializeSceneExport(dir, ir) {
  const pin = assertPackagedThree();
  const compiled = new SceneCompiler().compile(ir);
  if (
    compiled.webglExecution === "PASS" ||
    compiled.webglExecution === "EXECUTED" ||
    String(compiled.webglExecution).startsWith("EXECUTED") ||
    !String(compiled.webglExecution).startsWith("EVIDENCE:/tmp/spe-webgl-r6c/")
  ) {
    throw new Error("compile must not claim WebGL execution");
  }
  if (compiled.threeVersion !== EXPORT_THREE_VERSION) {
    throw new Error(`compile threeVersion ${compiled.threeVersion} drifted`);
  }
  if (compiled.standaloneHtml.includes("putImageData")) {
    throw new Error("export must not paint with putImageData");
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.join(dir, "vendor"), { recursive: true });
  writeFileSync(path.join(dir, "index.html"), compiled.standaloneHtml);
  copyFileSync(path.join(here, "vendor/three.min.js"), path.join(dir, "vendor/three.min.js"));
  const copied = sha256(readFileSync(path.join(dir, "vendor/three.min.js")));
  if (copied !== pin.sha256) throw new Error("copied artifact hash drifted");
  const manifest = {
    threeVersion: pin.version,
    threeArtifactSha256: pin.sha256,
    packageIntegrity: pin.integrity,
    resolved: pin.resolved,
    bytes: pin.bytes,
    artifact: "vendor/three.min.js",
    webglExecution: "NOT_RUN",
    note: "Compile does not execute WebGL. A runtime record is written only after a headless Chrome frame.",
  };
  writeFileSync(path.join(dir, "export-manifest.json"), JSON.stringify(manifest, null, 2));
  return { compiled, pin, manifest, htmlPath: path.join(dir, "index.html") };
}
