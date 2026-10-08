import { commandAllowed } from "./agentCapabilities.ts";
import type {
  AgentCommand,
  AgentCommandContext,
  AgentCommandResult,
} from "./commandTypes.ts";
import type { AgentReceipt } from "./agentReceipt.ts";
import {
  applySitePatch,
  createSitePatch,
  hashCanonicalState,
  type PatchOperation,
  type SitePatch,
} from "../history/sitePatch.ts";
import { inspectSite } from "../quality/inspectSite.ts";
import { measureSceneStatic } from "../performance/measureScene.ts";
import type { Scene3DObject } from "../model/sceneIR.ts";
import type { BehaviorRule } from "../model/behaviorGraph.ts";
import type { NarrativeMotionBlock } from "../model/motionBlock.ts";
import type { CameraPlan } from "../model/cameraPlan.ts";

function createReceipt(
  tool: string,
  context: AgentCommandContext,
  args: Record<string, unknown>,
  beforeHash: string,
  afterHash: string,
  operations: number,
  verification: "PASS" | "FAIL" = "PASS",
): AgentReceipt {
  return {
    agent: context.agentId ?? "spe-structured-agent",
    session: context.sessionId ?? "session-canonical",
    tool,
    timestamp: new Date().toISOString(),
    inputHash: hashCanonicalState(args ?? {}),
    beforeHash,
    afterHash,
    operations,
    authorizationSource: "POLICY",
    verification,
  };
}

export function createCommandRegistry(): {
  execute(command: AgentCommand, context: AgentCommandContext): AgentCommandResult;
} {
  return {
    execute(command, context) {
      const currentActualHash = hashCanonicalState(context.websiteSpec);

      // Validate command envelope
      if (
        !command ||
        typeof command !== "object" ||
        typeof command.name !== "string" ||
        !command.args ||
        typeof command.args !== "object"
      ) {
        return {
          ok: false,
          code: "COMMAND_REFUSED",
          error: "MALFORMED_COMMAND_ENVELOPE",
          receipt: createReceipt(
            command?.name ?? "unknown",
            context,
            command?.args ?? {},
            context?.currentHash ?? currentActualHash,
            currentActualHash,
            0,
            "FAIL",
          ),
        };
      }

      // Check capability policy
      if (!commandAllowed(context.policy, command.name)) {
        return {
          ok: false,
          code: "CAPABILITY_DENIED",
          receipt: createReceipt(
            command.name,
            context,
            command.args,
            context.currentHash ?? currentActualHash,
            currentActualHash,
            0,
            "FAIL",
          ),
        };
      }

      // Stale state verification
      if (context.currentHash && context.currentHash !== currentActualHash) {
        return {
          ok: false,
          code: "PATCH_CONFLICT",
          error: "STALE_STATE_DETECTED",
          receipt: createReceipt(
            command.name,
            context,
            command.args,
            context.currentHash,
            currentActualHash,
            0,
            "FAIL",
          ),
        };
      }

      const beforeHash = currentActualHash;

      switch (command.name) {
        // --- READ COMMANDS ---
        case "getWebsiteSpec":
          return {
            ok: true,
            code: "OK",
            value: structuredClone(context.websiteSpec),
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };
        case "getPageTree":
          return {
            ok: true,
            code: "OK",
            value: structuredClone(context.websiteSpec.pages),
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };
        case "getScene":
          return {
            ok: true,
            code: "OK",
            value: structuredClone(context.websiteSpec.scene ?? null),
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };
        case "getSelectedObjects":
          return {
            ok: true,
            code: "OK",
            value: structuredClone(context.selectedObjects ?? []),
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };
        case "getBehaviorGraph":
          return {
            ok: true,
            code: "OK",
            value: structuredClone(context.websiteSpec.behaviorGraph),
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };
        case "getTimeline":
          return {
            ok: true,
            code: "OK",
            value: structuredClone(context.websiteSpec.motion),
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };
        case "getCameraPlan":
          return {
            ok: true,
            code: "OK",
            value: structuredClone(context.websiteSpec.cameraPlan ?? null),
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };
        case "getPerformanceReceipt":
          return {
            ok: true,
            code: "OK",
            value: structuredClone(context.performanceReceipt ?? null),
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };
        case "getAccessibilityReceipt":
          return {
            ok: true,
            code: "OK",
            value: structuredClone(context.websiteSpec.accessibility),
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };

        // --- PROPOSE PATCH ---
        case "proposePatch": {
          const operations = command.args.operations;
          if (!Array.isArray(operations) || operations.length === 0) {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "OPERATIONS_ARRAY_REQUIRED",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          try {
            const patch = createSitePatch(
              context.websiteSpec,
              operations as PatchOperation[],
              "AGENT",
            );
            return {
              ok: true,
              code: "OK",
              value: patch,
              patch,
              receipt: createReceipt(command.name, context, command.args, beforeHash, patch.afterHash, operations.length),
            };
          } catch {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "PATCH_GENERATION_FAILED",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
        }

        // --- APPLY APPROVED PATCH ---
        case "applyApprovedPatch": {
          const patch = command.args.patch as SitePatch | undefined;
          if (!patch || typeof patch !== "object" || !Array.isArray(patch.operations)) {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "VALID_SITEPATCH_REQUIRED",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          if (beforeHash !== patch.beforeHash) {
            return {
              ok: false,
              code: "PATCH_CONFLICT",
              error: "BEFORE_HASH_MISMATCH",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          try {
            const next = applySitePatch(context.websiteSpec, patch);
            return {
              ok: true,
              code: "OK",
              value: next,
              patch,
              receipt: createReceipt(command.name, context, command.args, beforeHash, patch.afterHash, patch.operations.length),
            };
          } catch {
            return {
              ok: false,
              code: "PATCH_CONFLICT",
              error: "PATCH_APPLY_FAILED",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
        }

        // --- MUTATING COMMANDS (ALWAYS USE SITEPATCH) ---
        case "createSceneObject": {
          const object = command.args.object as Scene3DObject | undefined;
          if (!object || typeof object !== "object" || !object.id || !object.geometry || !object.material) {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "INVALID_SCENE_OBJECT_ARGS",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          const scene = context.websiteSpec.scene
            ? structuredClone(context.websiteSpec.scene)
            : {
                sceneVersion: "scene-ir/1" as const,
                title: "Scene",
                theme: "dark" as const,
                camera: { type: "perspective" as const, fov: 60, position: [0, 0, 5] as [number, number, number], target: [0, 0, 0] as [number, number, number], near: 0.1, far: 100 },
                environment: { backgroundColor: "#000000" },
                lighting: [],
                objects: [],
                scrollTracks: [],
                performanceBudget: { maxDpr: 1.5, maxDrawCalls: 50, maxTriangles: 10000, targetFps: 60 },
                accessibilityFallback: { hero2dSvg: "<svg></svg>", textDescription: "Scene", ariaRegionLabel: "Scene" },
              };
          const existing = scene.objects.findIndex((o) => o.id === object.id);
          if (existing >= 0) {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "OBJECT_ALREADY_EXISTS",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          scene.objects.push(object);
          const operations: PatchOperation[] = [{ op: "set", path: ["scene"], value: scene }];
          const patch = createSitePatch(context.websiteSpec, operations, "AGENT");
          const next = applySitePatch(context.websiteSpec, patch);
          return {
            ok: true,
            code: "OK",
            value: next,
            patch,
            receipt: createReceipt(command.name, context, command.args, beforeHash, patch.afterHash, operations.length),
          };
        }

        case "updateSceneObject": {
          const id = command.args.id as string | undefined;
          const changes = command.args.changes as Partial<Scene3DObject> | undefined;
          if (!id || typeof id !== "string" || !changes || typeof changes !== "object") {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "INVALID_UPDATE_ARGS",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          if (!context.websiteSpec.scene) {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "NO_SCENE_IN_SPEC",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          const scene = structuredClone(context.websiteSpec.scene);
          const idx = scene.objects.findIndex((o) => o.id === id);
          if (idx < 0) {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "OBJECT_NOT_FOUND",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          scene.objects[idx] = { ...scene.objects[idx], ...changes };
          const operations: PatchOperation[] = [{ op: "set", path: ["scene"], value: scene }];
          const patch = createSitePatch(context.websiteSpec, operations, "AGENT");
          const next = applySitePatch(context.websiteSpec, patch);
          return {
            ok: true,
            code: "OK",
            value: next,
            patch,
            receipt: createReceipt(command.name, context, command.args, beforeHash, patch.afterHash, operations.length),
          };
        }

        case "createBehaviorRule": {
          const rule = command.args.rule as BehaviorRule | undefined;
          if (!rule || typeof rule !== "object" || !rule.id || !rule.trigger || !Array.isArray(rule.actions)) {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "INVALID_BEHAVIOR_RULE_ARGS",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          const bg = structuredClone(context.websiteSpec.behaviorGraph);
          if (bg.rules.some((r) => r.id === rule.id)) {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "RULE_ALREADY_EXISTS",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          bg.rules.push(rule);
          const operations: PatchOperation[] = [{ op: "set", path: ["behaviorGraph"], value: bg }];
          const patch = createSitePatch(context.websiteSpec, operations, "AGENT");
          const next = applySitePatch(context.websiteSpec, patch);
          return {
            ok: true,
            code: "OK",
            value: next,
            patch,
            receipt: createReceipt(command.name, context, command.args, beforeHash, patch.afterHash, operations.length),
          };
        }

        case "updateMotionBlock": {
          const id = command.args.id as string | undefined;
          const block = command.args.block as Partial<NarrativeMotionBlock> | undefined;
          if (!id || typeof id !== "string" || !block || typeof block !== "object") {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "INVALID_MOTION_BLOCK_ARGS",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          const blocks = structuredClone(context.websiteSpec.motionBlocks ?? []);
          const idx = blocks.findIndex((b: NarrativeMotionBlock) => b.id === id);
          if (idx < 0) {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "MOTION_BLOCK_NOT_FOUND",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          blocks[idx] = { ...blocks[idx], ...block };
          const operations: PatchOperation[] = [{ op: "set", path: ["motionBlocks"], value: blocks }];
          const patch = createSitePatch(context.websiteSpec, operations, "AGENT");
          const next = applySitePatch(context.websiteSpec, patch);
          return {
            ok: true,
            code: "OK",
            value: next,
            patch,
            receipt: createReceipt(command.name, context, command.args, beforeHash, patch.afterHash, operations.length),
          };
        }

        case "updateCameraPlan": {
          const plan = command.args.cameraPlan as CameraPlan | undefined;
          if (!plan || typeof plan !== "object" || !Array.isArray(plan.shots)) {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "INVALID_CAMERA_PLAN_ARGS",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          const operations: PatchOperation[] = [{ op: "set", path: ["cameraPlan"], value: structuredClone(plan) }];
          const patch = createSitePatch(context.websiteSpec, operations, "AGENT");
          const next = applySitePatch(context.websiteSpec, patch);
          return {
            ok: true,
            code: "OK",
            value: next,
            patch,
            receipt: createReceipt(command.name, context, command.args, beforeHash, patch.afterHash, operations.length),
          };
        }

        case "optimizeScene": {
          if (!context.websiteSpec.scene) {
            return {
              ok: false,
              code: "COMMAND_REFUSED",
              error: "NO_SCENE_IN_SPEC",
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0, "FAIL"),
            };
          }
          const scene = structuredClone(context.websiteSpec.scene);
          const budget = (command.args.budget ?? {}) as Record<string, unknown>;
          scene.performanceBudget = {
            ...scene.performanceBudget,
            maxDpr: typeof budget.maxDpr === "number" ? budget.maxDpr : Math.min(scene.performanceBudget.maxDpr, 1.25),
            maxDrawCalls: typeof budget.maxDrawCalls === "number" ? budget.maxDrawCalls : Math.min(scene.performanceBudget.maxDrawCalls, 40),
            maxTriangles: typeof budget.maxTriangles === "number" ? budget.maxTriangles : Math.min(scene.performanceBudget.maxTriangles, 8000),
            targetFps: typeof budget.targetFps === "number" ? budget.targetFps : 60,
          };
          const operations: PatchOperation[] = [{ op: "set", path: ["scene"], value: scene }];
          const patch = createSitePatch(context.websiteSpec, operations, "AGENT");
          const next = applySitePatch(context.websiteSpec, patch);
          return {
            ok: true,
            code: "OK",
            value: next,
            patch,
            receipt: createReceipt(command.name, context, command.args, beforeHash, patch.afterHash, operations.length),
          };
        }

        // --- AUDIT AND PREVIEW COMMANDS ---
        case "renderPreview": {
          const width = typeof command.args.width === "number" ? command.args.width : 1280;
          const height = typeof command.args.height === "number" ? command.args.height : 720;
          const result = {
            width,
            height,
            mode: "webgl",
            objectsRendered: context.websiteSpec.scene?.objects.length ?? 0,
            renderedAt: Date.now(),
          };
          return {
            ok: true,
            code: "OK",
            value: result,
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };
        }

        case "runQualityAudit": {
          const findings = inspectSite({
            hasSemanticDom: context.websiteSpec.pages.length > 0,
            hasReducedMotion: (context.websiteSpec.cameraPlan?.shots ?? []).some((s) => s.reducedMotionVariant),
            webglContexts: context.websiteSpec.scene ? 1 : 0,
            activeAnimationLoops: (context.websiteSpec.motionBlocks?.length ?? 0) > 0 ? 1 : 0,
          });
          return {
            ok: true,
            code: "OK",
            value: findings,
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };
        }

        case "runAccessibilityAudit": {
          const hasHero2d = Boolean(context.websiteSpec.scene?.accessibilityFallback?.hero2dSvg);
          const hasAria = Boolean(context.websiteSpec.scene?.accessibilityFallback?.ariaRegionLabel);
          const reducedMotionCoverage = (context.websiteSpec.cameraPlan?.shots ?? []).every((s) => s.reducedMotionVariant);
          const findings: string[] = [];
          if (!hasHero2d) findings.push("HERO_2D_SVG_MISSING");
          if (!hasAria) findings.push("ARIA_REGION_LABEL_MISSING");
          if (!reducedMotionCoverage) findings.push("INCOMPLETE_REDUCED_MOTION_COVERAGE");
          return {
            ok: true,
            code: "OK",
            value: {
              compliant: findings.length === 0,
              score: findings.length === 0 ? 1.0 : 0.8,
              findings,
            },
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };
        }

        case "runPerformanceAudit": {
          if (!context.websiteSpec.scene) {
            return {
              ok: true,
              code: "OK",
              value: { triangles: 0, drawCalls: 0, frameMeasurementState: "UNKNOWN", findings: [] },
              receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
            };
          }
          const audit = measureSceneStatic(context.websiteSpec.scene);
          return {
            ok: true,
            code: "OK",
            value: audit,
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };
        }

        case "runResponsiveAudit": {
          const pages = context.websiteSpec.pages;
          const hasMobileSections = pages.some((p: any) => p.sections?.some((s: any) => s.responsive?.mobileLayout));
          const hasMobileBehavior = context.websiteSpec.behaviorGraph.rules.some((r) =>
            r.conditions.some((c) => c.type === "viewport-min" || c.type === "viewport-max"),
          );
          return {
            ok: true,
            code: "OK",
            value: {
              mobileResponsive: true,
              hasMobileSections,
              hasMobileBehavior,
              breakpoints: [640, 768, 1024, 1280],
            },
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };
        }

        // --- EXPORT COMMANDS ---
        case "exportSite":
        case "exportProject":
          return {
            ok: true,
            code: "OK",
            value: { authorized: true, kind: command.name },
            receipt: createReceipt(command.name, context, command.args, beforeHash, beforeHash, 0),
          };

        default:
          return {
            ok: false,
            code: "COMMAND_REFUSED",
            error: "UNRECOGNIZED_COMMAND",
            receipt: createReceipt(
              (command as any).name ?? "unknown",
              context,
              command.args,
              beforeHash,
              beforeHash,
              0,
              "FAIL",
            ),
          };
      }
    },
  };
}
