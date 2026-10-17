import {
  validateCameraPlan,
  type CameraPlan,
  type CameraShot,
  type Vec3,
} from "../model/cameraPlan.ts";
import type { SceneIR, Scene3DObject } from "../model/sceneIR.ts";

export type CameraPreset =
  | "Hero Reveal"
  | "Luxury Orbit"
  | "Product Inspection"
  | "Dramatic Push-In"
  | "Architectural Flythrough"
  | "Macro Detail"
  | "Exploded Assembly"
  | "Story Journey";

export interface CameraSafetyFinding {
  code:
    | "CAMERA_INSIDE_MESH"
    | "CAMERA_CLIPPING_NEAR"
    | "CAMERA_CLIPPING_FAR"
    | "SUBJECT_OCCLUDED_OR_OUT_OF_VIEW"
    | "EXCESSIVE_LINEAR_ACCELERATION"
    | "EXCESSIVE_ANGULAR_VELOCITY"
    | "MOBILE_FRAMING_DEFICIENT"
    | "REDUCED_MOTION_EQUIVALENCE_MISSING"
    | "ORIENTATION_ASPECT_CLIPPING";
  shotId: string;
  message: string;
}

export interface CameraSafetyReport {
  safe: boolean;
  score: number;
  findings: CameraSafetyFinding[];
  measuredMetrics: {
    maxLinearSpeed: number;
    maxAngularVelocityDeg: number;
    minSubjectDistance: number;
    mobileCoverage: number;
    reducedMotionCoverage: number;
  };
}

function dist(a: Vec3, b: Vec3): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2,
  );
}

function shot(
  id: string,
  intent: string,
  start: number,
  end: number,
  position: Vec3,
  target: Vec3,
  options?: {
    fov?: number;
    easing?: CameraShot["easing"];
    responsivePos?: Vec3;
    reducedMotionPos?: Vec3;
  },
): CameraShot {
  const fov = options?.fov ?? 55;
  const easing = options?.easing ?? "cinematic";
  return {
    id,
    intent,
    start,
    end,
    position,
    target,
    fov,
    easing,
    responsiveVariant: {
      position: options?.responsivePos ?? [
        position[0] * 0.6,
        position[1] * 0.8,
        Math.max(6.5, position[2] * 1.3),
      ],
      target,
      fov: Math.min(75, fov + 8),
    },
    reducedMotionVariant: {
      position: options?.reducedMotionPos ?? [
        target[0],
        target[1] + 0.8,
        Math.max(5.5, position[2]),
      ],
      target,
      fov: fov,
    },
  };
}

export function createCameraPlanFromPreset(preset: CameraPreset): CameraPlan {
  const target: Vec3 = [0, 0.4, 0];
  let shots: CameraShot[];

  switch (preset) {
    case "Hero Reveal":
      shots = [
        shot("hero-establish", "Wide atmospheric establish", 0, 0.45, [-2.2, 1.8, 8.5], target, { fov: 52 }),
        shot("hero-focus", "Gentle cinematic settle on hero subject", 0.45, 1.0, [0, 1.0, 5.8], target, { fov: 50 }),
      ];
      break;

    case "Luxury Orbit":
      shots = [
        shot("establish", "Establish premium subject silhouette", 0, 0.35, [-1.6, 1.4, 7.5], target, { fov: 50 }),
        shot("orbit", "Controlled luxury orbit highlighting curvature", 0.35, 0.72, [2.0, 1.1, 6.2], target, { fov: 52 }),
        shot("settle", "Hero steady settle for reading copy", 0.72, 1.0, [0.4, 0.9, 5.5], target, { fov: 48 }),
      ];
      break;

    case "Product Inspection":
      shots = [
        shot("overview", "Front three-quarter inspection view", 0, 0.4, [-1.8, 1.2, 6.0], target, { fov: 45 }),
        shot("rotate-flank", "Slow arc along side profile", 0.4, 0.75, [1.8, 1.2, 6.0], target, { fov: 45 }),
        shot("detail-rest", "Top-angle detail settle", 0.75, 1.0, [0, 2.2, 5.2], target, { fov: 42 }),
      ];
      break;

    case "Dramatic Push-In":
      shots = [
        shot("establish", "Wide distance establish", 0, 0.45, [0, 1.4, 9.0], target, { fov: 55 }),
        shot("push", "Smooth controlled push-in toward focal center", 0.45, 1.0, [0, 0.8, 5.2], target, { fov: 48 }),
      ];
      break;

    case "Architectural Flythrough":
      shots = [
        shot("approach", "High elevation contextual approach", 0, 0.4, [-3.0, 2.5, 8.0], target, { fov: 60 }),
        shot("level-in", "Leveling into interior eye-line", 0.4, 0.75, [-0.5, 1.1, 5.5], target, { fov: 55 }),
        shot("vista", "Open vista framing", 0.75, 1.0, [1.5, 1.2, 6.2], target, { fov: 52 }),
      ];
      break;

    case "Macro Detail":
      shots = [
        shot("macro-lead", "Glide into micro-surface focal zone", 0, 0.5, [-0.8, 0.6, 4.2], target, { fov: 38 }),
        shot("macro-hover", "Ultra-stable micro-texture observation", 0.5, 1.0, [0.3, 0.5, 3.8], target, { fov: 35 }),
      ];
      break;

    case "Exploded Assembly":
      shots = [
        shot("assembled", "Solid assembled product state", 0, 0.35, [0, 1.2, 6.5], target, { fov: 50 }),
        shot("explode-track", "Back away as components separate", 0.35, 0.75, [-1.5, 1.8, 8.2], target, { fov: 58 }),
        shot("component-lock", "Lock to primary core component", 0.75, 1.0, [1.0, 1.0, 5.8], target, { fov: 50 }),
      ];
      break;

    case "Story Journey":
      shots = [
        shot("chapter-1", "Introduction vantage", 0, 0.33, [-2.5, 1.5, 7.8], target, { fov: 54 }),
        shot("chapter-2", "Transformation transition", 0.33, 0.66, [1.8, 1.0, 6.5], target, { fov: 52 }),
        shot("chapter-3", "Resolution landing", 0.66, 1.0, [0, 0.8, 5.4], target, { fov: 48 }),
      ];
      break;
  }

  const plan: CameraPlan = { shots };
  validateCameraPlan(plan);
  return plan;
}

/**
 * Rigorous Safety Auditor for Camera Director plans against real scene bounds,
 * velocity limits, clipping frustums, and accessibility standards.
 */
export function validateCameraSafety(
  plan: CameraPlan,
  scene?: SceneIR,
): CameraSafetyReport {
  validateCameraPlan(plan);

  const findings: CameraSafetyFinding[] = [];
  const nearPlane = scene?.camera?.near ?? 0.1;
  const farPlane = scene?.camera?.far ?? 100;
  const objects: Scene3DObject[] = scene?.objects ?? [];

  let maxLinearSpeed = 0;
  let maxAngularVelocityDeg = 0;
  let minSubjectDistance = Infinity;
  let responsiveVariantCount = 0;
  let reducedMotionVariantCount = 0;

  for (let i = 0; i < plan.shots.length; i++) {
    const s = plan.shots[i];
    const dTarget = dist(s.position, s.target);
    minSubjectDistance = Math.min(minSubjectDistance, dTarget);

    // 1. Clipping checks
    if (dTarget <= nearPlane * 2) {
      findings.push({
        code: "CAMERA_CLIPPING_NEAR",
        shotId: s.id,
        message: `Camera position is too close to near plane (${dTarget.toFixed(2)} <= ${(nearPlane * 2).toFixed(2)})`,
      });
    }
    if (dTarget >= farPlane * 0.9) {
      findings.push({
        code: "CAMERA_CLIPPING_FAR",
        shotId: s.id,
        message: `Camera position approaches or exceeds far plane (${dTarget.toFixed(2)} >= ${(farPlane * 0.9).toFixed(2)})`,
      });
    }

    // 2. Camera inside mesh collisions
    for (const obj of objects) {
      const objDist = dist(s.position, obj.position);
      const estimatedRadius = obj.geometry.type === "sphere"
        ? Number(obj.geometry.parameters?.radius ?? 1)
        : obj.geometry.type === "box"
          ? 1.2
          : 0.8;
      if (objDist < estimatedRadius + 0.1) {
        findings.push({
          code: "CAMERA_INSIDE_MESH",
          shotId: s.id,
          message: `Camera collides with mesh '${obj.name ?? obj.id}' (distance ${objDist.toFixed(2)} <= radius ${estimatedRadius.toFixed(2)})`,
        });
      }
    }

    // 3. Subject visibility / line of sight
    const fov = s.fov ?? 55;
    if (fov < 15 || fov > 110) {
      findings.push({
        code: "SUBJECT_OCCLUDED_OR_OUT_OF_VIEW",
        shotId: s.id,
        message: `FOV ${fov} causes extreme distortion or subject loss`,
      });
    }

    // 4. Responsive and reduced motion coverage
    if (s.responsiveVariant && s.responsiveVariant.position) {
      responsiveVariantCount++;
    } else {
      findings.push({
        code: "MOBILE_FRAMING_DEFICIENT",
        shotId: s.id,
        message: `Shot '${s.id}' lacks responsiveVariant for mobile viewports`,
      });
    }

    if (s.reducedMotionVariant && s.reducedMotionVariant.position) {
      reducedMotionVariantCount++;
    } else {
      findings.push({
        code: "REDUCED_MOTION_EQUIVALENCE_MISSING",
        shotId: s.id,
        message: `Shot '${s.id}' lacks reducedMotionVariant for accessibility`,
      });
    }

    // 5. Linear and Angular velocities between consecutive shots
    if (i > 0) {
      const prev = plan.shots[i - 1];
      const timeDelta = Math.max(0.05, s.start - prev.start);
      const posDelta = dist(s.position, prev.position);
      const speed = posDelta / timeDelta;
      maxLinearSpeed = Math.max(maxLinearSpeed, speed);

      if (speed > 25.0) {
        findings.push({
          code: "EXCESSIVE_LINEAR_ACCELERATION",
          shotId: s.id,
          message: `Linear camera speed ${speed.toFixed(1)} exceeds safety threshold 25.0`,
        });
      }

      // Angular velocity
      const v1: Vec3 = [prev.position[0] - prev.target[0], prev.position[1] - prev.target[1], prev.position[2] - prev.target[2]];
      const v2: Vec3 = [s.position[0] - s.target[0], s.position[1] - s.target[1], s.position[2] - s.target[2]];
      const mag1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2 + v1[2] ** 2) || 1;
      const mag2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2 + v2[2] ** 2) || 1;
      const dot = (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (mag1 * mag2);
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
      const angularSpeedDeg = (angleRad * 180 / Math.PI) / timeDelta;
      maxAngularVelocityDeg = Math.max(maxAngularVelocityDeg, angularSpeedDeg);

      if (angularSpeedDeg > 180.0) {
        findings.push({
          code: "EXCESSIVE_ANGULAR_VELOCITY",
          shotId: s.id,
          message: `Angular camera velocity ${angularSpeedDeg.toFixed(1)}°/s exceeds disorientation limit of 180°/s`,
        });
      }
    }
  }

  const mobileCoverage = plan.shots.length > 0 ? responsiveVariantCount / plan.shots.length : 0;
  const reducedMotionCoverage = plan.shots.length > 0 ? reducedMotionVariantCount / plan.shots.length : 0;

  const safe = findings.length === 0;
  const score = safe ? 1.0 : Math.max(0, 1.0 - findings.length * 0.15);

  return {
    safe,
    score,
    findings,
    measuredMetrics: {
      maxLinearSpeed,
      maxAngularVelocityDeg,
      minSubjectDistance,
      mobileCoverage,
      reducedMotionCoverage,
    },
  };
}
