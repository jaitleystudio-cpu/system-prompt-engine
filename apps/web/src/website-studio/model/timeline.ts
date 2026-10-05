export interface TimelineKeyframe {
  at: number;
  value: number | string | [number, number, number];
}

export interface TimelineTrack {
  id: string;
  targetId: string;
  property: string;
  keyframes: TimelineKeyframe[];
}

export interface MotionSpec {
  tracks: TimelineTrack[];
}
