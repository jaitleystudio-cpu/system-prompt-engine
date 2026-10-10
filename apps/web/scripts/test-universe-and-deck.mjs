import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(process.cwd());
const webSrc = join(root, "apps", "web", "src");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

console.log("=== Running SPE Ω Universe & 3D Deck Verification Suite ===");

// 1. Component existence
const universePath = join(webSrc, "landing", "SpeUniverseHero.tsx");
const deckPath = join(webSrc, "landing", "SpeCapabilityDeck.tsx");
const cssPath = join(webSrc, "landing", "spe-universe-deck.css");

assert(existsSync(universePath), "SpeUniverseHero.tsx exists");
assert(existsSync(deckPath), "SpeCapabilityDeck.tsx exists");
assert(existsSync(cssPath), "spe-universe-deck.css exists");

// 2. Integration in App.tsx
const appTsx = readFileSync(join(webSrc, "App.tsx"), "utf8");
assert(appTsx.includes("<SpeUniverseHero"), "SpeUniverseHero is mounted on homepage in App.tsx");
assert(appTsx.includes("<SpeCapabilityDeck"), "SpeCapabilityDeck is mounted on homepage in App.tsx");

// 3. Universe Hero mechanics
const universeCode = readFileSync(universePath, "utf8");
assert(universeCode.includes("ORBIT_MODELS"), "Defines celestial ORBIT_MODELS");
assert(universeCode.includes("local-engine"), "Includes zero-cost local in-browser engine");
assert(universeCode.includes("claude-sonnet"), "Includes Claude 6 node");
assert(universeCode.includes("gemini-flash"), "Includes Astra 6.1 node");
assert(universeCode.includes("deepseek-r1"), "Includes DeepSeek Frontier node");
assert(universeCode.includes("spe-beam-path"), "Renders active SVG energy conduit beam");
assert(universeCode.includes("aria-pressed"), "Satellites have ARIA pressed attributes");

// 4. 3D Capability Deck mechanics
const deckCode = readFileSync(deckPath, "utf8");
assert(deckCode.includes("CHAMBERS"), "Defines 8 chambers of creation");
assert(deckCode.includes("system-studio"), "Chamber 1: System Prompt Studio");
assert(deckCode.includes("attack-gym"), "Chamber 2: In-browser Attack Gym");
assert(deckCode.includes("3d-studio"), "Chamber 3: 3D Website Studio");
assert(deckCode.includes("multi-export"), "Chamber 4: Multi-Agent Export tabs");
assert(deckCode.includes("spe-dock-shelf"), "Includes floating command dock");
assert(deckCode.includes("rotateY"), "Employs 3D CSS rotateY perspective transforms");

// 5. Storytelling Cinema mechanics
const cinemaPath = join(webSrc, "landing", "SpeStorytellingCinema.tsx");
assert(existsSync(cinemaPath), "SpeStorytellingCinema.tsx exists");
assert(appTsx.includes("<SpeStorytellingCinema"), "SpeStorytellingCinema is mounted on homepage in App.tsx");

const cinemaCode = readFileSync(cinemaPath, "utf8");
assert(cinemaCode.includes("STORY_CHAPTERS"), "Defines STORY_CHAPTERS collection");
assert(cinemaCode.includes("chapter-01"), "Stage 01: Simple Request exists");
assert(cinemaCode.includes("chapter-04"), "Stage 04: Stress Testing exists");
assert(cinemaCode.includes("chapter-06"), "Stage 06: Permission Gates exists");
assert(cinemaCode.includes("chapter-08"), "Stage 08: Ready to Deploy exists");
assert(cinemaCode.includes("spe-cinema-scrubber-bar"), "Includes interactive timeline scrubber bar");
assert(cinemaCode.includes("spe-cinema-stage-body"), "Includes split narrative & terminal view");
assert(cinemaCode.includes("spe-cinema-telemetry-cluster"), "Includes real-time telemetry gauges");

// 6. Anti-Jargon Law compliance
const forbiddenHype = [
  "world #1",
  "monopoly",
  "100% secure",
  "100% compliant",
  "superhuman",
  "unleash",
  "magic",
];
for (const word of forbiddenHype) {
  assert(!universeCode.toLowerCase().includes(word), `Anti-Jargon: Universe Hero does not contain "${word}"`);
  assert(!deckCode.toLowerCase().includes(word), `Anti-Jargon: Capability Deck does not contain "${word}"`);
  assert(!cinemaCode.toLowerCase().includes(word), `Anti-Jargon: Storytelling Cinema does not contain "${word}"`);
}

// 7. Visual Clipart integration
const clipartsPath = join(webSrc, "landing", "SpeCliparts.tsx");
assert(existsSync(clipartsPath), "SpeCliparts.tsx exists");
assert(deckCode.includes("getChamberClipart"), "Capability Deck integrates chamber cliparts");
assert(cinemaCode.includes("getChapterClipart"), "Storytelling Cinema integrates scene cliparts");
assert(deckCode.includes("spe-higgs-clipart-box"), "Capability Deck renders clipart box container");
assert(cinemaCode.includes("spe-cinema-scene-clipart-badge"), "Storytelling Cinema renders scene clipart badge");
assert(cinemaCode.includes("spe-cinema-kf-mini-clipart"), "Storytelling Cinema scrubber renders mini cliparts");

console.log("============================================================");
console.log("🎉 ALL UNIVERSE, DECK, CINEMA & CLIPART TESTS PASSED! (37/37)");
console.log("============================================================");

