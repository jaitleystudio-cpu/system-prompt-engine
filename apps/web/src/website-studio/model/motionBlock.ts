export type MotionSemanticType =
  | "hero-arrival"
  | "product-reveal"
  | "orbit"
  | "detail-focus"
  | "assembly"
  | "transition"
  | "custom";

export interface MotionTrackRef {
  targetId: string;
  property: string;
}

export interface NarrativeMotionBlock {
  id: string;
  semanticType: MotionSemanticType;
  start: number;
  end: number;
  tracks: {
    camera?: MotionTrackRef[];
    objects?: MotionTrackRef[];
    lighting?: MotionTrackRef[];
    materials?: MotionTrackRef[];
    dom?: MotionTrackRef[];
  };
  mobileTransform?: { mode: "preserve" | "simplify" | "disable" };
  reducedMotionTransform?: { mode: "preserve" | "simplify" | "static" };
}

export function validateMotionBlock(block: NarrativeMotionBlock): void {
  if (!block.id) throw new Error("motion block id required");
  if (!Number.isFinite(block.start) || !Number.isFinite(block.end)) throw new Error("motion range must be finite");
  if (block.start < 0 || block.end > 1 || block.end < block.start) {
    throw new Error("motion block range must satisfy 0 <= start <= end <= 1");
  }
}
