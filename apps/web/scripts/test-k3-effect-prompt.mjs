import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "../..");
const renderSource = readFileSync(join(repo, "packages/web-runtime/src/render.ts"), "utf8");
assert.equal(renderSource.includes("senior software engineer"), false);
assert.equal(renderSource.includes("think step by step"), false);
assert.equal(renderSource.includes("PROMPT_GUIDANCE"), false);
assert.equal(renderSource.includes("select_prompt_techniques"), false);
assert.match(renderSource, /compiled_prompt/);

const bundle = await build({
  entryPoints: [join(repo, "packages/web-runtime/src/index.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const runtime = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

function planFor(techniques, protectedBody) {
  const code = `
import json
from spe_runtime.k3.effect import bind_prompt_effects
from spe_runtime.requirements.project import build_requirement_graph
protected = json.loads(${JSON.stringify(JSON.stringify(protectedBody))})
techniques = json.loads(${JSON.stringify(JSON.stringify(techniques))})
graph = build_requirement_graph(protected, None)
selection = {
  "disposition": "SELECTED",
  "techniques": techniques,
  "selection_id": "tsel-render",
  "notes": ["SELECTED"],
  "deferred_techniques": [],
  "protected_binding": {
    "goal": protected.get("goal") or "",
    "hard_constraints": list(protected.get("hard_constraints") or []),
    "budget": protected.get("budget", None),
    "desired_output": protected.get("desired_output", None),
    "facts": list(protected.get("facts") or []),
    "authority_state": dict(protected.get("authority_state") or {}),
    "provenance": list(protected.get("provenance") or []),
  },
  "requirement_graph": graph,
  "claims_pass": False,
}
print(json.dumps(bind_prompt_effects(selection)))
`;
  const proc = spawnSync("python3", ["-c", code], { cwd: repo, encoding: "utf8" });
  if (proc.status !== 0) throw new Error(proc.stderr);
  return JSON.parse(proc.stdout);
}

const protectedBody = {
  goal: "Summarize the supplied notes.",
  hard_constraints: [{ constraint_id: "c1", statement: "Do not add obligations." }],
  budget: { amount: 2000, currency: "USD", hard: true },
  desired_output: "A short summary.",
  facts: [
    { fact_id: "f-user-request", statement: "Summarize the supplied notes." },
    { fact_id: "f1", statement: "Notes exist." },
  ],
  authority_state: { level: 0, status: "NONE", grants: [] },
  provenance: [{ provenance_id: "p1", source: "user" }],
  user_preferences: [],
  uncertainties: [],
};

function envelope() {
  return {
    facts: protectedBody.facts,
    hard_constraints: protectedBody.hard_constraints,
    user_preferences: [],
    uncertainties: [],
  };
}

const direct = planFor(["ZERO_SHOT"], protectedBody);
const decomposed = planFor(["DECOMPOSE_PLAN_SOLVE", "ZERO_SHOT"], protectedBody);
const directPrompt = runtime.renderPromptArtifact({
  userRequest: protectedBody.goal,
  category: "Writing",
  target: "any",
  envelopeOutput: envelope(),
  techniques: direct.techniques,
  effectPlan: direct,
});
const decomposedPrompt = runtime.renderPromptArtifact({
  userRequest: protectedBody.goal,
  category: "Writing",
  target: "any",
  envelopeOutput: envelope(),
  techniques: decomposed.techniques,
  effectPlan: decomposed,
});
assert.equal(directPrompt.finalPrompt.includes("## Effect: DIRECT"), true);
assert.equal(directPrompt.finalPrompt.includes("## Effect: DECOMPOSE"), false);
assert.equal(decomposedPrompt.finalPrompt.includes("## Effect: DECOMPOSE"), true);
assert.equal(directPrompt.finalPrompt.split("## Effect:")[0], decomposedPrompt.finalPrompt.split("## Effect:")[0]);
assert.equal(directPrompt.finalPrompt.includes(protectedBody.goal), true);
assert.equal(directPrompt.finalPrompt.includes("Do not add obligations."), true);
assert.equal(decomposedPrompt.techniques.includes("DECOMPOSE_PLAN_SOLVE"), true);
assert.throws(
  () =>
    runtime.renderPromptArtifact({
      userRequest: protectedBody.goal,
      category: "Writing",
      target: "any",
      envelopeOutput: envelope(),
      techniques: ["DECOMPOSE_PLAN_SOLVE"],
      effectPlan: direct,
    }),
  /does not match the engine/,
);
const fewShot = planFor(["FEW_SHOT"], protectedBody);
assert.throws(
  () =>
    runtime.renderPromptArtifact({
      userRequest: protectedBody.goal,
      category: "Writing",
      target: "any",
      envelopeOutput: envelope(),
      techniques: [],
      effectPlan: fewShot,
    }),
  /did not authorize/,
);
assert.equal(JSON.stringify(fewShot).includes("Pattern"), false);

const refused = {
  disposition: "REFUSED",
  renderable: false,
  compiled_prompt: null,
  techniques: [],
  operations: [],
  notes: ["REFUSED", "UNKNOWN"],
};
assert.throws(
  () =>
    runtime.renderPromptArtifact({
      userRequest: protectedBody.goal,
      category: "Writing",
      target: "any",
      envelopeOutput: envelope(),
      effectPlan: refused,
    }),
  /did not authorize/,
);

const baseInput = {
  userRequest: protectedBody.goal,
  category: "Writing",
  target: "any",
  envelopeOutput: envelope(),
};

function assertNoPrompt(effectPlan) {
  assert.throws(
    () => runtime.renderPromptArtifact({ ...baseInput, effectPlan }),
    (error) => {
      assert.equal(error.name, "PromptBriefError");
      assert.equal("finalPrompt" in error, false);
      return true;
    },
  );
}

assertNoPrompt(null);
assertNoPrompt(undefined);
assertNoPrompt({});
assertNoPrompt({ disposition: "UNKNOWN", renderable: true, compiled_prompt: "Success." });
assertNoPrompt({ disposition: "REFUSED", renderable: false, compiled_prompt: null });
assertNoPrompt({ disposition: "DEFERRED", renderable: false, compiled_prompt: null });
assertNoPrompt({ disposition: "BOUND", renderable: false, compiled_prompt: direct.compiled_prompt });
assertNoPrompt({ disposition: "BOUND", renderable: true, compiled_prompt: null });
assertNoPrompt({ disposition: "BOUND", renderable: true });
assertNoPrompt("not-a-plan");

const transportBundle = await build({
  entryPoints: [join(root, "src/engine/k3Transport.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const transport = await import(
  `data:text/javascript;base64,${Buffer.from(transportBundle.outputFiles[0].text).toString("base64")}`
);
const thrown = await transport.requestK3Binding(
  { compile: async () => { throw new Error("wasm down"); } },
  { payload: {} },
  "Writing",
  protectedBody.goal,
);
assert.equal(thrown.status, "UNAVAILABLE");
assert.equal(thrown.effectPlan, null);
assert.throws(() => transport.requireBoundEffectPlan(thrown), /effect plan/);
const missingPlan = await transport.requestK3Binding(
  {
    compile: async () => ({
      error: null,
      result: {
        status: "VALID",
        output: {
          disposition: "SAFE_DEFAULT",
          techniques: ["ZERO_SHOT"],
          claims_pass: false,
        },
      },
    }),
  },
  { payload: {} },
  "Writing",
  protectedBody.goal,
);
assert.equal(missingPlan.status, "MISSING_EFFECT_PLAN");
assert.throws(() => transport.requireBoundEffectPlan(missingPlan), /effect plan/);

function mutantM11(input) {
  try {
    return runtime.renderPromptArtifact(input);
  } catch {
    return { finalPrompt: "TypeScript fallback prompt" };
  }
}
const missingInput = { ...baseInput, effectPlan: null };
let productionPrompt = null;
try {
  productionPrompt = runtime.renderPromptArtifact(missingInput).finalPrompt;
} catch {
  productionPrompt = null;
}
assert.equal(productionPrompt, null);
assert.equal(mutantM11(missingInput).finalPrompt, "TypeScript fallback prompt");

const appSource = readFileSync(join(root, "src/App.tsx"), "utf8");
assert.equal(appSource.includes("renderNonProductionEnvelopePreview"), false);
assert.match(appSource, /requireBoundEffectPlan\(k3\)/);

console.log("PASS k3 effect prompt render");
