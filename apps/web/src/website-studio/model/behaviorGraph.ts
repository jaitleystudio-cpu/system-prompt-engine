export type BehaviorTriggerType =
  | "scroll"
  | "hover"
  | "click"
  | "pointer"
  | "visibility"
  | "timer"
  | "data"
  | "scene";

export type BehaviorActionType =
  | "dom-show"
  | "dom-hide"
  | "scene-rotate"
  | "scene-translate"
  | "camera-dolly"
  | "camera-orbit"
  | "material-set"
  | "timeline-play"
  | "data-set";

export interface BehaviorTrigger {
  type: BehaviorTriggerType;
  targetId?: string;
  value?: string | number | boolean;
}

export interface BehaviorCondition {
  type: "viewport-min" | "viewport-max" | "prefers-reduced-motion" | "data-equals";
  value: string | number | boolean;
}

export interface BehaviorAction {
  type: BehaviorActionType;
  targetId?: string;
  value?: unknown;
}

export interface BehaviorRule {
  id: string;
  trigger: BehaviorTrigger;
  conditions: BehaviorCondition[];
  actions: BehaviorAction[];
  fallback?: BehaviorAction[];
}

export interface BehaviorGraph {
  version: "behavior-graph/1";
  rules: BehaviorRule[];
}

export function createEmptyBehaviorGraph(): BehaviorGraph {
  return { version: "behavior-graph/1", rules: [] };
}

export function validateBehaviorGraph(graph: BehaviorGraph): void {
  if (!graph || graph.version !== "behavior-graph/1" || !Array.isArray(graph.rules)) {
    throw new Error("invalid BehaviorGraph");
  }
  const ids = new Set<string>();
  for (const rule of graph.rules) {
    if (!rule.id || ids.has(rule.id)) throw new Error("behavior rule ids must be unique");
    ids.add(rule.id);
    if (!rule.trigger || !rule.trigger.type) throw new Error("behavior trigger required");
    if (!Array.isArray(rule.conditions) || !Array.isArray(rule.actions)) {
      throw new Error("behavior conditions/actions must be arrays");
    }
  }
}
