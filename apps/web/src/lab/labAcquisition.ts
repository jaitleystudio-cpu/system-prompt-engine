/**
 * Daily Lab → Create acquisition handoff (single owner).
 * Maps LabSpecimen | GalleryCard → Create seed state.
 * Honest provenance only — no endless-feed claims.
 */

import type { LabSpecimen } from "./specimens";
import { DAILY_3D_QUEUE } from "./specimens";
import type { GalleryCard } from "./gallery/promptGallery";
import { PROMPT_GALLERY } from "./gallery/promptGallery";

export type LabAcquisitionSource = "daily_3d" | "prompt_gallery";

export type LabAcquisitionSeed = {
  id: string;
  title: string;
  source: LabAcquisitionSource;
  /** Idea / build prompt for Create request field. */
  userRequest: string;
  /** Raw category string; App maps via mapLabCategory. */
  categoryRaw: string;
  /** Visible chip: "From Daily Lab: …" / "From Prompt Gallery: …". */
  provenanceLabel: string;
  /** Suggested Desired Output when Create field is empty (Batch B surface). */
  desiredOutputSeed: string | null;
  mode: "simple";
  intentProvenance: "AUTO_DERIVED_INTENT";
  /** Caller must invalidate() prior Create draft before applying. */
  clearPriorDraft: true;
};

export function isLabSpecimen(
  item: LabSpecimen | GalleryCard,
): item is LabSpecimen {
  return "buildPrompt" in item && typeof (item as LabSpecimen).buildPrompt === "string";
}

export function provenanceLabelFor(
  source: LabAcquisitionSource,
  title: string,
): string {
  return source === "daily_3d"
    ? `From Daily Lab: ${title}`
    : `From Prompt Gallery: ${title}`;
}

/** Map a Daily 3D specimen or Prompt Gallery card into Create seed state. */
export function acquisitionSeedFromLabItem(
  item: LabSpecimen | GalleryCard,
): LabAcquisitionSeed {
  const specimen = isLabSpecimen(item);
  const source: LabAcquisitionSource = specimen ? "daily_3d" : "prompt_gallery";
  const userRequest = specimen
    ? String(item.buildPrompt || item.seedIdea || "").trim()
    : String(item.seedIdea || "").trim();
  const desiredFromBlurb = String(item.blurb || "").trim();
  const desiredFromStory =
    specimen && "editorialStory" in item
      ? String(item.editorialStory || "").trim()
      : "";
  const desiredOutputSeed =
    desiredFromBlurb ||
    (desiredFromStory
      ? desiredFromStory.slice(0, 280) + (desiredFromStory.length > 280 ? "…" : "")
      : "") ||
    null;

  return {
    id: item.id,
    title: item.title,
    source,
    userRequest,
    categoryRaw: item.category,
    provenanceLabel: provenanceLabelFor(source, item.title),
    desiredOutputSeed: desiredOutputSeed || null,
    mode: "simple",
    intentProvenance: "AUTO_DERIVED_INTENT",
    clearPriorDraft: true,
  };
}

/** Resolve `?specimen=<id>` against the finite Daily 3D queue (not gallery). */
export function specimenIdFromSearch(
  search = typeof window !== "undefined" ? window.location.search : "",
): string | null {
  const raw = new URLSearchParams(search).get("specimen");
  if (!raw) return null;
  return DAILY_3D_QUEUE.some((s) => s.id === raw) ? raw : null;
}

/** Find specimen by id in the finite queue. */
export function findSpecimenById(id: string): LabSpecimen | undefined {
  return DAILY_3D_QUEUE.find((s) => s.id === id);
}

/** Find gallery card by id. */
export function findGalleryCardById(id: string): GalleryCard | undefined {
  return PROMPT_GALLERY.find((c) => c.id === id);
}

/**
 * Keep `?specimen=` on /daily-lab without a router dependency.
 * No-op when pathname is not the lab route.
 */
export function replaceLabSpecimenParam(specimenId: string): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/daily-lab") return;
  const url = new URL(window.location.href);
  url.searchParams.set("specimen", specimenId);
  const next = `${url.pathname}?${url.searchParams.toString()}`;
  const cur = `${window.location.pathname}${window.location.search}`;
  if (next !== cur) {
    window.history.replaceState(window.history.state, "", next);
  }
}
