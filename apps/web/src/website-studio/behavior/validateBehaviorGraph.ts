import {
  validateBehaviorGraph,
  type BehaviorGraph,
  type BehaviorRule,
  type BehaviorAction,
} from "../model/behaviorGraph.ts";

export interface CycleDetectionResult {
  hasCycle: boolean;
  cyclePaths: string[][];
}

/**
 * Builds a directed adjacency list representing rule dependencies in a BehaviorGraph.
 * An edge ruleA -> ruleB exists if ruleA's actions can trigger ruleB's trigger.
 */
export function buildBehaviorDependencyGraph(graph: BehaviorGraph): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const rule of graph.rules) {
    adj.set(rule.id, new Set<string>());
  }

  for (const ruleA of graph.rules) {
    const targetsAffected = new Set<string>();
    const ruleIdsAffected = new Set<string>();
    const dataKeysAffected = new Set<string>();
    let triggersTimelinePlay = false;

    for (const action of ruleA.actions) {
      if (action.targetId) {
        targetsAffected.add(action.targetId);
      }
      if (typeof action.value === "string") {
        ruleIdsAffected.add(action.value);
      }
      if (action.type === "data-set" && action.targetId) {
        dataKeysAffected.add(action.targetId);
      }
      if (action.type === "timeline-play") {
        triggersTimelinePlay = true;
      }
    }

    // Direct self-cycle check
    if (
      ruleA.trigger.targetId &&
      targetsAffected.has(ruleA.trigger.targetId) &&
      (triggersTimelinePlay || ruleIdsAffected.has(ruleA.id))
    ) {
      adj.get(ruleA.id)!.add(ruleA.id);
    }

    for (const ruleB of graph.rules) {
      if (ruleA.id === ruleB.id) continue;

      let dependent = false;

      // 1. Direct rule ID target
      if (ruleIdsAffected.has(ruleB.id) || targetsAffected.has(ruleB.id)) {
        dependent = true;
      }

      // 2. Data binding cycle: ruleA sets data key that ruleB triggers on
      if (ruleB.trigger.type === "data" && ruleB.trigger.targetId && dataKeysAffected.has(ruleB.trigger.targetId)) {
        dependent = true;
      }

      // 3. Scene target overlap: ruleA mutates object that ruleB listens to
      if (
        (ruleB.trigger.type === "scene" || ruleB.trigger.type === "click" || ruleB.trigger.type === "hover") &&
        ruleB.trigger.targetId &&
        targetsAffected.has(ruleB.trigger.targetId)
      ) {
        dependent = true;
      }

      // 4. Timeline trigger matching
      if (triggersTimelinePlay && (ruleB.trigger.type === "scene" || ruleB.trigger.type === "scroll")) {
        if (ruleB.trigger.targetId && targetsAffected.has(ruleB.trigger.targetId)) {
          dependent = true;
        }
      }

      if (dependent) {
        adj.get(ruleA.id)!.add(ruleB.id);
      }
    }
  }

  return adj;
}

/**
 * Finds all cycles in a directed graph using DFS.
 */
export function detectBehaviorCycles(graph: BehaviorGraph): CycleDetectionResult {
  const adj = buildBehaviorDependencyGraph(graph);
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const currentPath: string[] = [];
  const cyclePaths: string[][] = [];

  function dfs(node: string) {
    visited.add(node);
    inStack.add(node);
    currentPath.push(node);

    const neighbors = adj.get(node) ?? new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (inStack.has(neighbor)) {
        // Cycle found
        const cycleStartIndex = currentPath.indexOf(neighbor);
        if (cycleStartIndex >= 0) {
          const cycle = currentPath.slice(cycleStartIndex).concat(neighbor);
          cyclePaths.push(cycle);
        }
      }
    }

    currentPath.pop();
    inStack.delete(node);
  }

  for (const ruleId of adj.keys()) {
    if (!visited.has(ruleId)) {
      dfs(ruleId);
    }
  }

  return {
    hasCycle: cyclePaths.length > 0,
    cyclePaths,
  };
}

/**
 * Validates that 3D/motion rules provide accessible fallback actions or reduced-motion conditions.
 */
export function validateRuleAccessibility(rule: BehaviorRule): void {
  const is3DOrMotion = rule.actions.some((a) =>
    [
      "scene-rotate",
      "scene-translate",
      "camera-dolly",
      "camera-orbit",
      "material-set",
      "timeline-play",
    ].includes(a.type),
  );

  if (!is3DOrMotion) return;

  const hasReducedMotionCondition = rule.conditions.some(
    (c) => c.type === "prefers-reduced-motion",
  );

  const hasFallback = Array.isArray(rule.fallback) && rule.fallback.length > 0;

  if (!hasReducedMotionCondition && !hasFallback) {
    throw new Error(
      `BEHAVIOR_FALLBACK_REQUIRED: rule '${rule.id}' performs 3D motion without reduced-motion condition or accessible fallback`,
    );
  }
}

/**
 * Comprehensive BehaviorGraph validator with multi-node cycle detection,
 * fallback validation, and mobile guardrails.
 */
export function validateBehaviorGraphAdvanced(graph: BehaviorGraph): void {
  validateBehaviorGraph(graph);

  // 1. Multi-node cycle detection (A->A, A->B->A, A->B->C->A, etc.)
  const cycleResult = detectBehaviorCycles(graph);
  if (cycleResult.hasCycle) {
    const sample = cycleResult.cyclePaths[0].join(" -> ");
    throw new Error(`BEHAVIOR_CYCLE_REFUSED: dependency cycle detected: ${sample}`);
  }

  // 2. Accessibility fallback validation
  for (const rule of graph.rules) {
    validateRuleAccessibility(rule);
  }
}

/**
 * Executes rules with deterministic event ordering and a strict replay depth budget.
 */
export function executeBehaviorGraphWithBudget(
  graph: BehaviorGraph,
  initialEvents: Array<{ trigger: BehaviorRule["trigger"]; payload?: unknown }>,
  dispatch: (action: BehaviorAction) => void,
  options?: { maxReplayDepth?: number },
): { dispatchedCount: number; replayDepthReached: number } {
  const maxDepth = options?.maxReplayDepth ?? 8;
  let dispatchedCount = 0;
  let currentDepth = 0;

  let queue = initialEvents.map((evt) => ({ ...evt, depth: 0 }));

  while (queue.length > 0) {
    // Deterministic ordering: sort by depth, then trigger type, then targetId
    queue.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      if (a.trigger.type !== b.trigger.type) return a.trigger.type.localeCompare(b.trigger.type);
      return (a.trigger.targetId ?? "").localeCompare(b.trigger.targetId ?? "");
    });

    const nextQueue: typeof queue = [];

    for (const item of queue) {
      if (item.depth > maxDepth) {
        throw new Error(
          `BEHAVIOR_REPLAY_DEPTH_EXCEEDED: cascade exceeded maximum replay depth of ${maxDepth}`,
        );
      }
      currentDepth = Math.max(currentDepth, item.depth);

      for (const rule of graph.rules) {
        if (rule.trigger.type === item.trigger.type && rule.trigger.targetId === item.trigger.targetId) {
          for (const action of rule.actions) {
            dispatch(action);
            dispatchedCount += 1;

            // Cascade data-set to data trigger
            if (action.type === "data-set" && action.targetId) {
              nextQueue.push({
                trigger: { type: "data", targetId: action.targetId, value: action.value as any },
                payload: action.value,
                depth: item.depth + 1,
              });
            }
          }
        }
      }
    }

    queue = nextQueue;
  }

  return { dispatchedCount, replayDepthReached: currentDepth };
}
