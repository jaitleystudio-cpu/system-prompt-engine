// One consistent 24px outline icon set (1.75 stroke, round caps). Several paths are adapted from Lucide
// (https://lucide.dev, ISC License, Copyright (c) Lucide Contributors); the rest are drawn to match. Inline SVG, no dependency.
import type { ToolId } from "./proRoutes.ts";
const RR = (x: number, y: number, w: number, h: number, r = 2) => `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1-${r} ${r}h-${w - 2 * r}a${r} ${r} 0 0 1-${r}-${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r}-${r}z`;
const C = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0-${2 * r} 0z`;
const SHIELD = "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z";
const FILE = "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z";
const P: Record<string, string[]> = {
  studio: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", "M8 8h8", "M8 12h5"],
  living: ["M21 12a9 9 0 1 1-2.64-6.36L21 8", "M21 3v5h-5", "M8.5 12.5l2.5 2.5 4.5-5"],
  blind: ["M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68", "M6.61 6.61A13.5 13.5 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.39-1.61", "M14.12 14.12a3 3 0 1 1-4.24-4.24", "M2 2l20 20"],
  portability: ["M8 3L4 7l4 4", "M4 7h16", "M16 21l4-4-4-4", "M20 17H4"],
  blueprint: [RR(3, 3, 8, 8), RR(13, 13, 8, 8), "M7 11v4a2 2 0 0 0 2 2h4"],
  regression: ["M22 12h-4l-3 9L9 3l-3 9H2"],
  releases: [SHIELD, "M9 12l2 2 4-4"],
  code: ["M16 18l6-6-6-6", "M8 6l-6 6 6 6"],
  batch: [RR(3, 3, 18, 18), "M3 9h18", "M3 15h18", "M9 9v12"],
  brand: ["M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3-3.5 3H16a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22z", "M7.5 10.5h.01", "M12 7h.01", "M16.5 10.5h.01"],
  formats: ["M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1", "M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"],
  cost: ["M12 2v20", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
  scanner: ["M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2", C(11, 11, 3), "M16 16l-2.8-2.8"],
  audit: [FILE, "M14 2v6h6", "M9 15l2 2 4-4"],
  library: ["M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"],
  report: ["M3 3v18h18", "M18 17V9", "M13 17V5", "M8 17v-3"],
  home: ["M3 10l9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"],
  plus: ["M12 5v14", "M5 12h14"],
  search: [C(11, 11, 8), "M21 21l-4.3-4.3"],
  sidebar: [RR(3, 3, 18, 18), "M9 3v18"],
  panel: [RR(3, 3, 18, 18), "M15 3v18"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  close: ["M18 6L6 18", "M6 6l12 12"],
  sun: [C(12, 12, 4), "M12 2v2", "M12 20v2", "M4.93 4.93l1.41 1.41", "M17.66 17.66l1.41 1.41", "M2 12h2", "M20 12h2", "M6.34 17.66l-1.41 1.41", "M19.07 4.93l-1.41 1.41"],
  moon: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"],
  folder: ["M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"],
  chat: ["M7.9 20A9 9 0 1 0 4 16.1L2 22z"],
  sparkles: ["M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z", "M20 3v4", "M22 5h-4"],
  lock: [RR(4, 11, 16, 11), "M8 11V7a4 4 0 0 1 8 0v4"],
  back: ["M15 18l-6-6 6-6"],
  chevron: ["M6 9l6 6 6-6"],
  right: ["M9 18l6-6-6-6"],
  keyboard: [RR(2, 5, 20, 14), "M6 9h.01", "M10 9h.01", "M14 9h.01", "M18 9h.01", "M7 15h10"],
  trash: ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"],
  edit: ["M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7", "M18.4 2.6a2 2 0 0 1 3 3L12 15l-4 1 1-4z"],
  send: ["M12 19V5", "M5 12l7-7 7 7"],
  stop: [RR(6, 6, 12, 12, 1.5)],
  play: ["M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"],
  check: ["M20 6L9 17l-5-5"],
  cert: [C(12, 9, 6), "M8.2 13.9L7 22l5-3 5 3-1.2-8.1"],
  alert: ["M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h.01"],
  target: [C(12, 12, 10), C(12, 12, 6), C(12, 12, 2)],
  terminal: ["M4 17l6-6-6-6", "M12 19h8"],
  shield: [SHIELD],
  filecode: [FILE, "M14 2v6h6", "M10 13l-2 2 2 2", "M14 17l2-2-2-2"],
  bot: ["M12 8V4H8", RR(4, 8, 16, 12), "M2 14h2", "M20 14h2", "M15 13v2", "M9 13v2"],
  info: [C(12, 12, 10), "M12 16v-4", "M12 8h.01"],
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  flask: ["M10 2v7.53a2 2 0 0 1-.21.9L4.72 20.55A1 1 0 0 0 5.62 22h12.76a1 1 0 0 0 .9-1.45l-5.07-10.12a2 2 0 0 1-.21-.9V2", "M8.5 2h7", "M7 16h10"],
  xcircle: [C(12, 12, 10), "M15 9l-6 6", "M9 9l6 6"],
  more: ["M12 12h.01", "M19 12h.01", "M5 12h.01"],
};
export function Icon({ name, size = 18 }: { name: ToolId | keyof typeof P | string; size?: number }) {
  return (<svg className="ps-ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{(P[name] ?? P.studio).map((d, i) => <path key={i} d={d} />)}</svg>);
}
