import {
  createEmptyBehaviorGraph,
  validateBehaviorGraph,
  type BehaviorAction,
  type BehaviorGraph,
  type BehaviorRule,
  type BehaviorTrigger,
} from "../model/behaviorGraph.ts";

function triggerFor(lower: string): BehaviorTrigger {
  const seconds = lower.match(/after\s+(\d+(?:\.\d+)?)\s+seconds?/);
  if (seconds) return { type: "timer", value: Number(seconds[1]) * 1000 };
  if (/hover|pointer enter|mouse over/.test(lower)) {
    return { type: "hover", targetId: /product|motorcycle/.test(lower) ? "product" : "selection" };
  }
  if (/click|tap/.test(lower)) {
    return { type: "click", targetId: /product|motorcycle/.test(lower) ? "product" : "selection" };
  }
  if (/reach|enters? (?:the )?viewport|comes? into view|visible/.test(lower)) {
    return { type: "visibility", targetId: /product|motorcycle/.test(lower) ? "product" : "section" };
  }
  if (/scroll/.test(lower)) return { type: "scroll", targetId: "page" };
  if (/stock|inventory|data/.test(lower)) return { type: "data", targetId: "data" };
  return { type: "scene", targetId: "selection" };
}

function actionsFor(lower: string): BehaviorAction[] {
  const actions: BehaviorAction[] = [];
  if (/rotate|orbit/.test(lower)) {
    actions.push({ type: "scene-rotate", targetId: /motorcycle|product/.test(lower) ? "product" : "selection", value: "gentle" });
  }
  if (/camera|move closer|dolly/.test(lower)) {
    actions.push({ type: "camera-dolly", targetId: "camera", value: "closer" });
  }
  if (/reveal|show|sold out|specifications|call to action|cta/.test(lower)) {
    actions.push({ type: "dom-show", targetId: /specifications/.test(lower) ? "specifications" : /sold out/.test(lower) ? "sold-out" : "cta" });
  }
  return actions.length ? actions : [{ type: "dom-show", targetId: "selection" }];
}

export function compileBehaviorIntent(raw: string): BehaviorGraph {
  const clean = raw.trim();
  const lower = clean.toLowerCase();
  if (!clean) return createEmptyBehaviorGraph();

  const rule: BehaviorRule = {
    id: "intent-rule-1",
    trigger: triggerFor(lower),
    conditions: [],
    actions: actionsFor(lower),
  };

  if (/only on desktop|desktop only/.test(lower)) {
    rule.conditions.push({ type: "viewport-min", value: 768 });
  }
  if (/reduced[- ]motion/.test(lower)) {
    rule.conditions.push({ type: "prefers-reduced-motion", value: true });
  }
  if (/mobile/.test(lower)) {
    rule.fallback = [{ type: "dom-show", targetId: "mobile-lightweight-reveal", value: "fade" }];
  }

  const graph: BehaviorGraph = { version: "behavior-graph/1", rules: [rule] };
  validateBehaviorGraph(graph);
  return graph;
}
