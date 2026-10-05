import {
  validateBehaviorGraph,
  type BehaviorGraph,
} from "../model/behaviorGraph.ts";

export function validateBehaviorGraphAdvanced(graph: BehaviorGraph): void {
  validateBehaviorGraph(graph);
  for (const rule of graph.rules) {
    for (const action of rule.actions) {
      const selfTarget =
        action.targetId &&
        rule.trigger.targetId &&
        action.targetId === rule.trigger.targetId;
      const selfReplay =
        action.type === "timeline-play" &&
        typeof action.value === "string" &&
        action.value === rule.id;
      if (selfTarget && selfReplay) {
        throw new Error("BEHAVIOR_CYCLE_REFUSED: direct self cycle");
      }
    }
  }
}
