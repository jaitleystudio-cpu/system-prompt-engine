/**
 * Reconciles high-level NarrativeMotionBlocks with low-level manual track edits.
 * Ensures time bounds synchronize without creating dual conflicting state.
 */
import type { NarrativeMotionBlock } from "../model/motionBlock.ts";

export function reconcileMotionBlocks(
  blocks: NarrativeMotionBlock[],
  modifiedTracks: any,
): NarrativeMotionBlock[] {
  let maxTime = 0;

  if (modifiedTracks?.camera?.keyframes) {
    for (const kf of modifiedTracks.camera.keyframes) {
      if (typeof kf.time === "number" && Number.isFinite(kf.time)) {
        const t = Math.max(0, kf.time);
        if (t > maxTime) maxTime = t;
      }
    }
  }

  if (Array.isArray(modifiedTracks?.objects)) {
    for (const track of modifiedTracks.objects) {
      if (Array.isArray(track?.keyframes)) {
        for (const kf of track.keyframes) {
          if (typeof kf.time === "number" && Number.isFinite(kf.time)) {
            const t = Math.max(0, kf.time);
            if (t > maxTime) maxTime = t;
          }
        }
      }
    }
  }

  if (blocks.length === 0 && maxTime > 0) {
    return [
      {
        id: "block-custom-timeline",
        semanticType: "product-reveal",
        start: 0,
        end: maxTime,
        tracks: modifiedTracks,
      },
    ];
  }

  return blocks.map((block, index) => {
    if (index === blocks.length - 1 && maxTime > block.start) {
      return {
        ...block,
        end: Math.max(block.end, maxTime),
        tracks: modifiedTracks,
      };
    }
    return {
      ...block,
      tracks: modifiedTracks,
    };
  });
}
