import type { WebsiteSpec } from "../../builder/websiteSpecModel";
import type { SceneIR } from "./types";

function detectLanguage(text: string): string {
  if (/[\u0C00-\u0C7F]/.test(text)) return "te"; // Telugu
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta"; // Tamil
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Hindi
  if (/[\u0600-\u06FF]/.test(text)) return "ar"; // Arabic
  if (/[\u0590-\u05FF]/.test(text)) return "he"; // Hebrew
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh"; // Chinese
  if (/[\u3040-\u30FF]/.test(text)) return "ja"; // Japanese
  return "en";
}

export function compileFreeTextToWebsite(prompt: string): {
  spec: WebsiteSpec;
  sceneDefinition: SceneIR;
} {
  const clean = prompt.trim();
  const rawTitle = clean.split(/[\n.!?]/)[0] || "Interactive Presentation";
  // Preserve Unicode letters, combining marks (Indic/Arabic/Hebrew/etc.), and numbers; do not fold or delete non-ASCII scripts.
  const sanitized = rawTitle.replace(/[^\p{L}\p{M}\p{N}\s-]/gu, "").replace(/\s+/g, " ").trim();
  const title =
    sanitized.length <= 60
      ? sanitized || "Interactive Presentation"
      : sanitized.slice(0, 57).trim() + "...";

  const lower = clean.toLowerCase();
  const lang = detectLanguage(clean);
  const wantsDark =
    lower.includes("dark") ||
    lower.includes("space") ||
    lower.includes("night") ||
    lower.includes("cyber") ||
    lower.includes("luxury");
  const theme = wantsDark ? "dark" : "light";

  // Adaptive geometry selection based on prompt
  let geomType: "sphere" | "box" | "torus" | "cylinder" | "wave-mesh" = "sphere";
  let geomParams: Record<string, number> = { radius: 1.5 };
  let primaryColor = wantsDark ? "#818cf8" : "#6366f1";

  if (lower.includes("box") || lower.includes("cube") || lower.includes("card")) {
    geomType = "box";
    geomParams = { width: 2, height: 2, depth: 2 };
  } else if (lower.includes("torus") || lower.includes("ring") || lower.includes("donut")) {
    geomType = "torus";
    geomParams = { radius: 1.5, tube: 0.4 };
  } else if (lower.includes("cylinder") || lower.includes("column") || lower.includes("pillar")) {
    geomType = "cylinder";
    geomParams = { radiusTop: 1, radiusBottom: 1, height: 2 };
  } else if (lower.includes("wave") || lower.includes("mesh") || lower.includes("terrain")) {
    geomType = "wave-mesh";
    geomParams = { width: 4, height: 4 };
  }

  if (lower.includes("finance") || lower.includes("gold")) {
    primaryColor = "#eab308";
  } else if (lower.includes("nature") || lower.includes("green") || lower.includes("eco")) {
    primaryColor = "#22c55e";
  } else if (lower.includes("space") || lower.includes("cosmic")) {
    primaryColor = "#38bdf8";
  }

  const spec: WebsiteSpec = {
    spec_version: "website-spec/1",
    title,
    language: lang,
    summary: `Local static website compiled from prompt.`,
    theme,
    pages: [
      {
        path: "index.html",
        title: "Home",
        sections: [
          {
            kind: "hero",
            heading: title,
            body: clean,
          },
          {
            kind: "prose",
            heading: "Overview",
            body: `Structured static site representation generated offline from user prompt.`,
          },
          {
            kind: "cta",
            heading: "Explore",
            cta_label: "Overview",
            cta_href: "#overview",
          },
        ],
      },
    ],
  };

  const sceneDefinition: SceneIR = {
    sceneVersion: "scene-ir/1",
    title,
    theme: wantsDark ? "dark" : "light",
    camera: {
      type: "perspective",
      fov: 60,
      position: [0, 2, 8],
      target: [0, 0, 0],
      near: 0.1,
      far: 1000,
    },
    environment: {
      backgroundColor: wantsDark ? "#05070a" : "#f8fafc",
      fogColor: wantsDark ? "#05070a" : "#f8fafc",
      fogDensity: 0.04,
    },
    lighting: [
      { id: "ambient", type: "ambient", color: "#ffffff", intensity: 0.6 },
      {
        id: "key",
        type: "directional",
        color: primaryColor,
        intensity: 1.2,
        position: [5, 10, 5],
        castShadow: true,
      },
    ],
    objects: [
      {
        id: "hero-geometry",
        name: "Interactive Object",
        geometry: { type: geomType, parameters: geomParams },
        material: {
          type: "standard",
          color: primaryColor,
          roughness: 0.2,
          metalness: 0.8,
        },
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    ],
    scrollTracks: [
      {
        objectId: "hero-geometry",
        property: "rotation.y",
        startScrollRatio: 0.0,
        endScrollRatio: 1.0,
        fromValue: 0.0,
        toValue: 6.28,
      },
    ],
    performanceBudget: {
      maxDpr: 1.5,
      maxDrawCalls: 50,
      maxTriangles: 10000,
      targetFps: 60,
    },
    accessibilityFallback: {
      hero2dSvg:
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${primaryColor}"/></svg>`,
      textDescription: `Interactive 3D representation for ${title}`,
      ariaRegionLabel: "Interactive 3D Scene",
    },
  };

  return { spec, sceneDefinition };
}
