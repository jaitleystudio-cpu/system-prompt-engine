// Builds both Pro preview entries and merges them into dist-pro-all (no public homepage pages are copied).
import { execSync } from "node:child_process"; import { rmSync, cpSync, mkdirSync } from "node:fs";
for (const c of ["vite.redesign.config.ts", "vite.pro-studio.config.ts"]) execSync(`npx vite build -c ${c}`, { stdio: "inherit" });
rmSync("dist-pro-all", { recursive: true, force: true }); mkdirSync("dist-pro-all");
cpSync("dist-redesign/pro", "dist-pro-all/pro", { recursive: true }); cpSync("dist-redesign/assets", "dist-pro-all/assets", { recursive: true });
for (const p of ["redesign/icon.svg", "redesign/fonts"]) cpSync(`dist-redesign/${p}`, `dist-pro-all/${p}`, { recursive: true });
cpSync("dist-pro-studio", "dist-pro-all", { recursive: true });
console.log("dist-pro-all ready");
