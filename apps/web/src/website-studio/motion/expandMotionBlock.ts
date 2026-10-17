import type { NarrativeMotionBlock } from "../model/motionBlock.ts";
import type { TimelineTrack } from "../model/timeline.ts";

export function expandMotionBlock(block: NarrativeMotionBlock): TimelineTrack[] {
  const groups = [
    ...(block.tracks.camera ?? []),
    ...(block.tracks.objects ?? []),
    ...(block.tracks.lighting ?? []),
    ...(block.tracks.materials ?? []),
    ...(block.tracks.dom ?? []),
  ];
  return groups.map((track, index) => ({
    id: block.id + "-track-" + index,
    targetId: track.targetId,
    property: track.property,
    keyframes: [
      { at: block.start, value: 0 },
      { at: block.end, value: 1 },
    ],
  }));
}

export function reconcileMotionBlocks(
  blocks: NarrativeMotionBlock[],
): TimelineTrack[] {
  return blocks
    .slice()
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
    .flatMap(expandMotionBlock);
}
