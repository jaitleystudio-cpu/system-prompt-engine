export type LabInteraction = "orbit" | "scroll-story" | "parallax" | "hover-explode";

export type LabSpecimen = {
  id: string;
  title: string;
  blurb: string;
  /** Editorial story shown on the stage. */
  editorialStory: string;
  seedIdea: string;
  category: string;
  accent: string;
  publishDate: string; // YYYY-MM-DD
  interaction: LabInteraction;
  camera: { fov: number; position: [number, number, number]; target: [number, number, number] };
  scroll: { chapters: number; parallax: number };
  materials: { primary: string; secondary: string; finish: string };
  lighting: { key: string; fill: string; rim: string };
  buildPrompt: string;
  speArtifact: string;
  status: "published" | "preview";
  /** Shape hint for the stage preview. */
  shape: "torus" | "icosa" | "ribbon" | "pillars" | "orb-field" | "helix" | "modules" | "slabs" | "folds" | "table";
};

/**
 * Curated static queue of 14 premium daily 3D / interactive specimens.
 * Honest promise: 14 days — not endless. Rotation is local-date deterministic.
 */
export const DAILY_3D_QUEUE: LabSpecimen[] = [
  {
    id: "d3d-01",
    title: "Brushed orbit",
    blurb: "A metal ring that remembers your scroll.",
    editorialStory:
      "A single brushed-steel torus hangs in soft north light. Scroll to orbit; the rim catches a cool highlight while the void stays matte graphite.",
    seedIdea:
      "Design a quiet premium hero: brushed metal torus, soft north light, scroll-orbit interaction, restrained type. No stock photos.",
    category: "Website / 3D",
    accent: "#9ecbff",
    publishDate: "2026-09-11",
    interaction: "orbit",
    camera: { fov: 42, position: [2.4, 1.2, 3.2], target: [0, 0, 0] },
    scroll: { chapters: 3, parallax: 0.35 },
    materials: { primary: "brushed steel", secondary: "graphite", finish: "satin" },
    lighting: { key: "soft north", fill: "cool grey", rim: "cyan edge" },
    buildPrompt:
      "Build a WebGL/Three hero with a brushed torus, scroll-linked orbit, and editorial caption. Prefer understated motion.",
    speArtifact: "spe:daily3d:brushed-orbit",
    status: "published",
    shape: "torus",
  },
  {
    id: "d3d-02",
    title: "Glass chapters",
    blurb: "Frosted panes that page as you scroll.",
    editorialStory:
      "Four frosted glass plates stack in depth. Each scroll chapter brings one pane forward while type stays razor-thin and honest.",
    seedIdea:
      "Create a scroll-story landing with frosted glass panels, four chapters, and calm typography about local-first tools.",
    category: "Website / 3D",
    accent: "#b8f0e0",
    publishDate: "2026-09-12",
    interaction: "scroll-story",
    camera: { fov: 40, position: [0, 0.4, 4.2], target: [0, 0, 0] },
    scroll: { chapters: 4, parallax: 0.55 },
    materials: { primary: "frosted glass", secondary: "opal white", finish: "translucent" },
    lighting: { key: "diffuse sky", fill: "warm bounce", rim: "soft white" },
    buildPrompt:
      "Implement a scroll-driven chapter story with translucent planes and reduced-motion fallback.",
    speArtifact: "spe:daily3d:glass-chapters",
    status: "published",
    shape: "ribbon",
  },
  {
    id: "d3d-03",
    title: "Icosa seed",
    blurb: "A crystal that explodes into facets on hover.",
    editorialStory:
      "An icosahedron waits in dusk indigo. Hover and facets peel outward — a metaphor for ideas taking structure.",
    seedIdea:
      "IDEA→MEANING→STRUCTURE→PROMPT as a hover-explode icosahedron with indigo dusk lighting.",
    category: "Website / 3D",
    accent: "#c4b5fd",
    publishDate: "2026-09-13",
    interaction: "hover-explode",
    camera: { fov: 38, position: [1.8, 1.4, 2.8], target: [0, 0.1, 0] },
    scroll: { chapters: 2, parallax: 0.2 },
    materials: { primary: "crystal violet", secondary: "obsidian", finish: "clear-coat" },
    lighting: { key: "dusk indigo", fill: "violet bounce", rim: "magenta" },
    buildPrompt:
      "Hover explodes an icosahedron into labeled facets: Idea, Meaning, Structure, Prompt.",
    speArtifact: "spe:daily3d:icosa-seed",
    status: "published",
    shape: "icosa",
  },
  {
    id: "d3d-04",
    title: "Pillar grid",
    blurb: "Editorial columns you can parallax.",
    editorialStory:
      "Seven matte pillars stand like a type specimen. Parallax scroll shifts depth; captions name weight, leading, and quiet confidence.",
    seedIdea:
      "A typographic 3D specimen site: pillars as letterforms, parallax depth, editorial captions on craft.",
    category: "Website / 3D",
    accent: "#fde68a",
    publishDate: "2026-09-14",
    interaction: "parallax",
    camera: { fov: 45, position: [0, 1.6, 5], target: [0, 0.8, 0] },
    scroll: { chapters: 3, parallax: 0.7 },
    materials: { primary: "matte clay", secondary: "ink black", finish: "flat" },
    lighting: { key: "gallery spot", fill: "warm wall", rim: "amber" },
    buildPrompt:
      "Parallax pillar field with editorial type annotations and accessible scroll alternate.",
    speArtifact: "spe:daily3d:pillar-grid",
    status: "published",
    shape: "pillars",
  },
  {
    id: "d3d-05",
    title: "Orb constellation",
    blurb: "Soft orbs that map a product story.",
    editorialStory:
      "A field of luminous orbs drifts slowly. Each orb is a product beat — privacy, craft, review — linked by faint threads.",
    seedIdea:
      "Product story as an orb constellation with gentle drift and click-to-focus captions.",
    category: "Website / 3D",
    accent: "#7dd3fc",
    publishDate: "2026-09-15",
    interaction: "orbit",
    camera: { fov: 50, position: [0, 0, 4.5], target: [0, 0, 0] },
    scroll: { chapters: 5, parallax: 0.4 },
    materials: { primary: "emissive glass", secondary: "deep navy", finish: "glow" },
    lighting: { key: "ambient glow", fill: "blue night", rim: "sky cyan" },
    buildPrompt:
      "Constellation of orbs with focus states and reduced-motion static layout.",
    speArtifact: "spe:daily3d:orb-constellation",
    status: "published",
    shape: "orb-field",
  },
  {
    id: "d3d-06",
    title: "Helix brief",
    blurb: "A climbing helix for process narrative.",
    editorialStory:
      "A copper helix climbs through charcoal space. Scroll advances the narrative rung by rung — research, shape, prove, ship.",
    seedIdea:
      "Process narrative on a copper helix with scroll scrubbing and honest status labels.",
    category: "Website / 3D",
    accent: "#fdba74",
    publishDate: "2026-09-16",
    interaction: "scroll-story",
    camera: { fov: 36, position: [2.2, 2.0, 3.6], target: [0, 0.6, 0] },
    scroll: { chapters: 4, parallax: 0.45 },
    materials: { primary: "copper", secondary: "charcoal", finish: "patina" },
    lighting: { key: "warm key", fill: "brown bounce", rim: "orange" },
    buildPrompt:
      "Scroll-scrubbed helix with four process chapters and keyboard access.",
    speArtifact: "spe:daily3d:helix-brief",
    status: "published",
    shape: "helix",
  },
  {
    id: "d3d-07",
    title: "Soft machine",
    blurb: "Rounded modules that dock on hover.",
    editorialStory:
      "Pastel modules float like a soft machine. Hover docks them into a tidy instrument — Create as craft, not a form.",
    seedIdea:
      "Soft-machine UI metaphor in 3D: rounded modules dock into a Create instrument on hover.",
    category: "Website / 3D",
    accent: "#fbcfe8",
    publishDate: "2026-09-17",
    interaction: "hover-explode",
    camera: { fov: 40, position: [1.5, 1.2, 3.4], target: [0, 0, 0] },
    scroll: { chapters: 2, parallax: 0.25 },
    materials: { primary: "pastel resin", secondary: "chalk", finish: "soft gloss" },
    lighting: { key: "studio softbox", fill: "pink bounce", rim: "lavender" },
    buildPrompt:
      "Docking pastel modules with hover assembly and a clear Open in SPE CTA.",
    speArtifact: "spe:daily3d:soft-machine",
    status: "published",
    shape: "modules",
  },
  {
    id: "d3d-08",
    title: "Night ledger",
    blurb: "Dark UI slabs with moon rim light.",
    editorialStory:
      "Three dark slabs hold a ledger of intentions. Moon rim light skims edges; scroll reveals assumptions vs confirmed goals.",
    seedIdea:
      "Dark editorial 3D ledger for prompt intentions with moon rim lighting and scroll reveals.",
    category: "Website / 3D",
    accent: "#a5b4fc",
    publishDate: "2026-09-18",
    interaction: "scroll-story",
    camera: { fov: 44, position: [0, 1.0, 4.0], target: [0, 0.2, 0] },
    scroll: { chapters: 3, parallax: 0.5 },
    materials: { primary: "obsidian UI", secondary: "silver hairline", finish: "matte" },
    lighting: { key: "moon rim", fill: "deep blue", rim: "cool white" },
    buildPrompt:
      "Night ledger slabs with intention categories and accessible text equivalents.",
    speArtifact: "spe:daily3d:night-ledger",
    status: "published",
    shape: "slabs",
  },
  {
    id: "d3d-09",
    title: "Paper fold",
    blurb: "Origami planes for IA storytelling.",
    editorialStory:
      "Folded paper planes unfold an information architecture. Each fold is a destination — Home, Create, Lab — without jargon.",
    seedIdea:
      "Origami IA story: folded planes reveal product destinations with human labels only.",
    category: "Website / 3D",
    accent: "#bef264",
    publishDate: "2026-09-19",
    interaction: "parallax",
    camera: { fov: 42, position: [1.2, 1.8, 3.8], target: [0, 0.3, 0] },
    scroll: { chapters: 4, parallax: 0.6 },
    materials: { primary: "warm paper", secondary: "ink", finish: "fiber" },
    lighting: { key: "window light", fill: "cream", rim: "sun edge" },
    buildPrompt:
      "Folding paper IA with parallax and a reduced-motion flat map fallback.",
    speArtifact: "spe:daily3d:paper-fold",
    status: "published",
    shape: "folds",
  },
  {
    id: "d3d-10",
    title: "Signal ring",
    blurb: "A privacy-forward pulse ring.",
    editorialStory:
      "A single ring pulses only when you ask it to analyze media — a reminder that vision packs stay at zero bytes until invited.",
    seedIdea:
      "Privacy pulse ring visualizing on-demand local vision with zero homepage model bytes.",
    category: "Website / 3D",
    accent: "#6ee7b7",
    publishDate: "2026-09-20",
    interaction: "orbit",
    camera: { fov: 35, position: [0, 0.2, 3.0], target: [0, 0, 0] },
    scroll: { chapters: 2, parallax: 0.15 },
    materials: { primary: "anodized teal", secondary: "black", finish: "metal" },
    lighting: { key: "spot teal", fill: "dim", rim: "green" },
    buildPrompt:
      "Pulse ring tied to user-initiated analysis; document zero silent egress.",
    speArtifact: "spe:daily3d:signal-ring",
    status: "published",
    shape: "torus",
  },
  {
    id: "d3d-11",
    title: "Workshop table",
    blurb: "Tools arranged for craft, not dashboards.",
    editorialStory:
      "A low table holds calm instruments — lens, slate, thread. The scene argues Create is a workshop, not a settings panel.",
    seedIdea:
      "3D workshop table metaphor for Create: craft tools, soft light, no dashboard chrome.",
    category: "Website / 3D",
    accent: "#f9a8d4",
    publishDate: "2026-09-21",
    interaction: "parallax",
    camera: { fov: 48, position: [2.0, 2.2, 3.0], target: [0, 0.2, 0] },
    scroll: { chapters: 3, parallax: 0.4 },
    materials: { primary: "oak", secondary: "linen", finish: "oil" },
    lighting: { key: "warm workshop", fill: "amber", rim: "gold" },
    buildPrompt:
      "Workshop still-life with parallax and captions that avoid infrastructure jargon.",
    speArtifact: "spe:daily3d:workshop-table",
    status: "published",
    shape: "table",
  },
  {
    id: "d3d-12",
    title: "Tide ribbon",
    blurb: "A flowing ribbon for narrative pacing.",
    editorialStory:
      "A silk ribbon flows left to right like tide lines. Scroll pacing matches the copy rhythm — slow where meaning gathers.",
    seedIdea:
      "Narrative ribbon with scroll-linked pacing and tide-inspired materials.",
    category: "Website / 3D",
    accent: "#67e8f9",
    publishDate: "2026-09-22",
    interaction: "scroll-story",
    camera: { fov: 40, position: [0, 0.6, 4.4], target: [0, 0, 0] },
    scroll: { chapters: 5, parallax: 0.65 },
    materials: { primary: "silk cyan", secondary: "foam white", finish: "cloth" },
    lighting: { key: "overcast", fill: "sea green", rim: "white foam" },
    buildPrompt:
      "Ribbon path with chapter markers and keyboard chapter jumps.",
    speArtifact: "spe:daily3d:tide-ribbon",
    status: "published",
    shape: "ribbon",
  },
  {
    id: "d3d-13",
    title: "Facet mirror",
    blurb: "Mirrored facets reflecting intent atoms.",
    editorialStory:
      "Mirrored facets catch fragments of a prompt — goals, limits, unknowns. Turn the piece; nothing leaves the device.",
    seedIdea:
      "Mirrored icosahedron reflecting intent atoms with orbit controls and privacy caption.",
    category: "Website / 3D",
    accent: "#e9d5ff",
    publishDate: "2026-09-23",
    interaction: "orbit",
    camera: { fov: 37, position: [2.0, 1.0, 2.6], target: [0, 0, 0] },
    scroll: { chapters: 2, parallax: 0.2 },
    materials: { primary: "mirror chrome", secondary: "violet gel", finish: "reflect" },
    lighting: { key: "studio array", fill: "purple", rim: "specular" },
    buildPrompt:
      "Orbit mirror facets labeled with intent buckets; on-device only caption.",
    speArtifact: "spe:daily3d:facet-mirror",
    status: "published",
    shape: "icosa",
  },
  {
    id: "d3d-14",
    title: "Dawn coil",
    blurb: "A helix greeting the next day.",
    editorialStory:
      "The fourteenth piece closes the curated set: a dawn-lit coil that promises a new rotation tomorrow — still fourteen, still finite, still honest.",
    seedIdea:
      "Dawn helix closing a 14-day curated Daily 3D Lab queue with honest finite promise.",
    category: "Website / 3D",
    accent: "#fde047",
    publishDate: "2026-09-24",
    interaction: "scroll-story",
    camera: { fov: 39, position: [1.6, 1.8, 3.5], target: [0, 0.5, 0] },
    scroll: { chapters: 3, parallax: 0.5 },
    materials: { primary: "dawn gold", secondary: "mist", finish: "soft metal" },
    lighting: { key: "sunrise", fill: "peach", rim: "gold" },
    buildPrompt:
      "Dawn coil with finite-queue honesty copy and Open in SPE clean state.",
    speArtifact: "spe:daily3d:dawn-coil",
    status: "published",
    shape: "helix",
  },
];

/** @deprecated use DAILY_3D_QUEUE — kept for gallery migration aliases */
export const LAB_SPECIMENS = DAILY_3D_QUEUE;

export const DAILY_QUEUE_DAYS = DAILY_3D_QUEUE.length; // 14 — do not claim endless

/** Local-date pick: one featured specimen + two neighbors from the finite queue. */
export function specimensForDate(date = new Date(), count = 3): LabSpecimen[] {
  const start = new Date(DAILY_3D_QUEUE[0].publishDate + "T00:00:00");
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayMs = 86400000;
  const diff = Math.max(0, Math.floor((today.getTime() - start.getTime()) / dayMs));
  const idx = diff % DAILY_3D_QUEUE.length;
  const out: LabSpecimen[] = [];
  for (let i = 0; i < Math.min(count, DAILY_3D_QUEUE.length); i++) {
    out.push(DAILY_3D_QUEUE[(idx + i) % DAILY_3D_QUEUE.length]);
  }
  return out;
}

export function todaysLabDateLabel(date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function queueHonestyLine(): string {
  return `Curated queue of ${DAILY_QUEUE_DAYS} daily 3D experiences — not an endless feed. Today's piece is chosen on your device from this fixed set.`;
}
