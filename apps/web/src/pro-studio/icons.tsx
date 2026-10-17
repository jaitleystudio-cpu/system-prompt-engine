import type { ToolId } from "./proRoutes.ts";
const P: Record<string, string> = {
  studio: "M4 5h16M4 12h10M4 19h16", brand: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z",
  formats: "M8 6l-5 6 5 6M16 6l5 6-5 6", blueprint: "M5 6h4v4H5zM15 14h4v4h-4zM15 4h4v4h-4zM9 8h6M9 8l6 8",
  regression: "M4 18l5-6 4 3 7-9M15 6h5v5", releases: "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM9 12l2 2 4-4",
  code: "M9 8l-4 4 4 4M15 8l4 4-4 4M13 5l-2 14", batch: "M4 5h16v4H4zM4 11h16v4H4zM4 17h16v2H4z",
  cost: "M12 3v18M16 7H10a3 3 0 000 6h4a3 3 0 010 6H8", scanner: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5M8 11h6",
  audit: "M6 3h9l4 4v14H6zM9 10h7M9 14h7M9 18h4", library: "M4 4h5v16H4zM10 4h5v16h-5zM16 5l4 1-3 14-4-1z",
  report: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h3",
  living: "M20 12a8 8 0 11-2.3-5.7M20 4v4h-4M8.5 12.5l2.5 2.5 4.5-5", blind: "M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM4 4l16 16",
  portability: "M4 7h7v10H4zM13 7h7v10h-7zM11 12h2", stop: "M7 7h10v10H7z", play: "M8 5l11 7-11 7z", check: "M5 12l4 4 10-10", cert: "M7 3h10v12l-5-3-5 3zM9 7h6",
  home: "M4 11l8-7 8 7v9h-5v-6H9v6H4z", plus: "M12 5v14M5 12h14", search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5",
  sidebar: "M4 4h16v16H4zM9 4v16", panel: "M4 4h16v16H4zM15 4v16", menu: "M4 6h16M4 12h16M4 18h16", close: "M6 6l12 12M18 6L6 18",
  sun: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 7a5 5 0 100 10 5 5 0 000-10z",
  moon: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z", folder: "M3 6h6l2 2h10v11H3z", chat: "M4 5h16v11H8l-4 4z",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 018 0v4", back: "M15 6l-6 6 6 6", keyboard: "M3 7h18v10H3zM7 11h1M11 11h1M15 11h1M8 14h8",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13", edit: "M4 20h4L19 9l-4-4L4 16z", send: "M5 12h13M13 6l6 6-6 6",
};
export function Icon({ name, size = 18 }: { name: ToolId | keyof typeof P | string; size?: number }) {
  return (<svg className="ps-ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={P[name] ?? P.studio} /></svg>);
}
