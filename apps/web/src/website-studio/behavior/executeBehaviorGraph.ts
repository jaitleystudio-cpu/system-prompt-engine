/**
 * Runtime execution engine for BehaviorGraph.
 */
import type { BehaviorGraph, BehaviorTrigger, BehaviorAction } from "../model/behaviorGraph.ts";
import { executeSceneAction } from "./executeSceneAction.ts";
import type { MutableSceneContext } from "./executeSceneAction.ts";

export interface MutableDomElement {
  opacity?: number;
  classes?: string[];
  text?: string;
}

export interface BehaviorExecutionContext {
  viewportWidth: number;
  reducedMotion: boolean;
  scene?: MutableSceneContext;
  dom?: Map<string, MutableDomElement>;
}

export function executeBehaviorGraph(
  graph: BehaviorGraph,
  event: BehaviorTrigger,
  ctx: BehaviorExecutionContext
): void {
  for (const rule of graph.rules) {
    if (!matchesTrigger(rule.trigger, event)) {
      continue;
    }

    const conditionsMet = checkConditions(rule.conditions || [], ctx);

    const actionsToExecute: BehaviorAction[] = conditionsMet
      ? rule.actions
      : (rule.fallback || []);

    for (const action of actionsToExecute) {
      dispatchAction(action, ctx);
    }
  }
}

function matchesTrigger(ruleTrigger: BehaviorTrigger, event: BehaviorTrigger): boolean {
  if (ruleTrigger.type !== event.type) return false;

  if (ruleTrigger.type === "scroll" && event.type === "scroll") {
    return ruleTrigger.targetSection === event.targetSection;
  }
  if (ruleTrigger.type === "hover" && event.type === "hover") {
    return ruleTrigger.targetId === event.targetId;
  }
  if (ruleTrigger.type === "click" && event.type === "click") {
    return ruleTrigger.targetId === event.targetId;
  }
  if (ruleTrigger.type === "visibility" && event.type === "visibility") {
    return ruleTrigger.targetSection === event.targetSection;
  }
  return true;
}

function checkConditions(
  conditions: NonNullable<BehaviorGraph["rules"][0]["conditions"]>,
  ctx: BehaviorExecutionContext
): boolean {
  for (const cond of conditions) {
    if (cond.type === "viewport-width") {
      const val = ctx.viewportWidth;
      if (cond.operator === ">=" && val < cond.value) return false;
      if (cond.operator === "<=" && val > cond.value) return false;
      if (cond.operator === "==" && val !== cond.value) return false;
    } else if (cond.type === "prefers-reduced-motion") {
      if (ctx.reducedMotion !== cond.value) return false;
    }
  }
  return true;
}

function dispatchAction(action: BehaviorAction, ctx: BehaviorExecutionContext): void {
  switch (action.type) {
    case "rotate-object":
    case "scale-object":
    case "translate-object":
    case "set-object-visibility": {
      if (ctx.scene) {
        executeSceneAction(action, ctx.scene);
      }
      break;
    }

    case "dom-fade": {
      if (ctx.dom) {
        const el = ctx.dom.get(action.targetId);
        if (el) {
          el.opacity = action.opacity;
        } else {
          ctx.dom.set(action.targetId, { opacity: action.opacity });
        }
      }
      break;
    }

    case "dom-set-text": {
      if (ctx.dom) {
        const el = ctx.dom.get(action.targetId);
        if (el) {
          el.text = action.text;
        } else {
          ctx.dom.set(action.targetId, { text: action.text });
        }
      }
      break;
    }

    default:
      break;
  }
}
