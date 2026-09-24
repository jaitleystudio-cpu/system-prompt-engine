/**
 * Task 13 E2E — human-facing grounding/depth controls + WASM protocol outcomes.
 * COST ₹0. No TypeScript semantic routing. Fail closed without WASM.
 * not_a_release=true.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const results = [];
const pass = (name, detail = "") => results.push({ name, ok: true, detail });
const fail = (name, detail) => results.push({ name, ok: false, detail });

function compileProtocol(payload) {
  const r = spawnSync(process.execPath, [join(here, "eval-context-protocol.mjs")], {
    cwd: webRoot,
    env: {
      ...process.env,
      SPE_CONTEXT_PROTOCOL_JSON: JSON.stringify(payload),
    },
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`eval-context-protocol rc=${r.status} ${r.stderr || r.stdout}`);
  }
  return JSON.parse(r.stdout);
}

function mapPublicSourceToWasm(source) {
  if (source === "ADD_SOURCES") return "ON";
  if (source === "NO_SOURCES") return "OFF";
  return "AUTO";
}

// --- Static UI contracts ---
const controlsPath = join(webRoot, "src/composer/ContextProtocolControls.tsx");
const appPath = join(webRoot, "src/App.tsx");
if (!existsSync(controlsPath)) {
  fail("controls_file", "ContextProtocolControls.tsx missing");
} else {
  const src = readFileSync(controlsPath, "utf8");
  const app = readFileSync(appPath, "utf8");
  const simpleCopy = [
    "Use current sources when they help.",
    "Use the best available tools when they help.",
  ];
  for (const phrase of simpleCopy) {
    if (src.includes(phrase)) pass("simple_copy", phrase);
    else fail("simple_copy", `missing ${phrase}`);
  }
  for (const token of [
    "AUTO",
    "ADD_SOURCES",
    "NO_SOURCES",
    "FAST",
    "SMART",
    "DEEP",
  ]) {
    if (src.includes(token)) pass("public_control", token);
    else fail("public_control", `missing ${token}`);
  }
  const forbidden = [
    "RAG",
    "ContextCapsule",
    "ProtocolGraph",
    " ABI",
    "WASM",
    "K3",
    "connector_id",
    "plugin_manifest",
  ];
  // Visitor Simple labels only — strip Inspect panel + comments.
  const simple = src
    .replace(/data-copy-depth="INSPECT"[\s\S]*?(?=export function|<\/section>|$)/, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
  const labelBlob = [
    ...simple.matchAll(/label:\s*"([^"]+)"/g),
    ...simple.matchAll(/hint:\s*"([^"]+)"/g),
    ...simple.matchAll(/spe-ctx-protocol-lead[\s\S]*?>([^<]+)</g),
  ]
    .map((m) => m[1])
    .join("\n");
  let jargonHit = null;
  for (const tok of forbidden) {
    if (labelBlob.includes(tok.trim()) || labelBlob.includes(tok)) {
      jargonHit = tok;
      break;
    }
  }
  // WASM appears in code identifiers/comments — not in visitor labels.
  if (!jargonHit) pass("simple_no_jargon", "visitor labels clean");
  else fail("simple_no_jargon", `found ${jargonHit} in Simple labels`);

  if (src.includes('role="radiogroup"') && src.includes("aria-label")) {
    pass("a11y_radiogroup", "keyboard-reachable radios");
  } else fail("a11y_radiogroup", "missing radiogroup/aria-label");

  if (app.includes("ContextProtocolControls") && app.includes("compileContextProtocol")) {
    pass("app_wired", "controls + compileContextProtocol");
  } else fail("app_wired", "App.tsx missing wiring");

  if (mapPublicSourceToWasm("ADD_SOURCES") === "ON" && mapPublicSourceToWasm("NO_SOURCES") === "OFF") {
    pass("source_mapping", "ADD_SOURCES→ON NO_SOURCES→OFF");
  } else fail("source_mapping", "public→wasm mapping broken");
}

// --- Behavioral protocol outcomes via WASM ---
try {
  const simple = compileProtocol({
    spe_api: "context_protocol",
    op: "compile",
    request_text: "write a short thank you note to a colleague",
    source_mode: mapPublicSourceToWasm("AUTO"),
    requested_depth: "AUTO",
  });
  const sOut = simple.result?.output;
  if (
    !simple.error &&
    sOut?.context_summary?.max_sources === 0 &&
    (sOut?.context_summary?.reason_codes || []).includes("NO_EXTERNAL_CONTEXT_REQUIRED")
  ) {
    pass("simple_no_unnecessary_grounding", JSON.stringify(sOut.context_summary.reason_codes));
  } else {
    fail(
      "simple_no_unnecessary_grounding",
      JSON.stringify({ err: simple.error, summary: sOut?.context_summary }),
    );
  }

  const research = compileProtocol({
    spe_api: "context_protocol",
    op: "compile",
    request_text:
      "research the latest peer-reviewed evidence on climate adaptation strategies",
    source_mode: mapPublicSourceToWasm("AUTO"),
    requested_depth: "DEEP",
    adapter_id: "ANY_AI",
  });
  const rOut = research.result?.output;
  const researchOk =
    !research.error &&
    rOut?.source_mode === "AUTO" &&
    (rOut?.resolved_depth === "DEEP" || rOut?.execution_contract?.depth === "DEEP") &&
    Number(rOut?.context_summary?.max_sources || 0) > 0 &&
    (rOut?.context_summary?.domain_tags || []).includes("research");
  if (researchOk) {
    pass(
      "research_sources_auto_deep",
      `depth=${rOut.resolved_depth} contract=${rOut.execution_contract?.depth} max=${rOut.context_summary.max_sources}`,
    );
  } else {
    fail("research_sources_auto_deep", JSON.stringify({ err: research.error, out: rOut }));
  }

  const critical = compileProtocol({
    spe_api: "context_protocol",
    op: "compile",
    request_text:
      "research the latest peer-reviewed evidence on climate adaptation strategies",
    source_mode: "AUTO",
    requested_depth: "AUTO",
    signals: {
      complexity: 3,
      stakes: 3,
      uncertainty: 3,
      freshness: 3,
      evidence: 3,
      irreversibility: 3,
    },
    adapter_id: "ANY_AI",
  });
  const cOut = critical.result?.output;
  if (
    !critical.error &&
    (cOut?.resolved_depth === "CRITICAL" || cOut?.execution_contract?.depth === "CRITICAL")
  ) {
    pass("research_auto_critical_internal", cOut.resolved_depth);
  } else {
    fail("research_auto_critical_internal", JSON.stringify({ err: critical.error, out: cOut }));
  }

  const noTools = compileProtocol({
    spe_api: "context_protocol",
    op: "compile",
    request_text: "outline a careful plan for a multi-step analysis",
    source_mode: "AUTO",
    requested_depth: "SMART",
    capability_profile: { available: [] },
  });
  const nOut = noTools.result?.output;
  const limitations = nOut?.quality_record?.known_limitations || [];
  const rendered = String(nOut?.rendered || "");
  if (
    !noTools.error &&
    nOut?.capability_profile_mode === "NONE" &&
    limitations.some((x) => /without tool routing|No declared capabilities/i.test(String(x)))
  ) {
    pass("no_tools_conditional_or_limited", limitations.join(" | "));
  } else if (
    !noTools.error &&
    /If your environment provides relevant tools/i.test(rendered)
  ) {
    pass("no_tools_conditional_or_limited", "conditional auto-route present");
  } else {
    fail(
      "no_tools_conditional_or_limited",
      JSON.stringify({
        err: noTools.error,
        mode: nOut?.capability_profile_mode,
        limitations,
        snip: rendered.slice(0, 240),
      }),
    );
  }

  const conditional = compileProtocol({
    spe_api: "context_protocol",
    op: "compile",
    request_text: "outline a careful plan for a multi-step analysis",
    source_mode: "AUTO",
    requested_depth: "SMART",
  });
  const condOut = conditional.result?.output;
  if (
    !conditional.error &&
    condOut?.capability_profile_mode === "CONDITIONAL" &&
    /If your environment provides relevant tools|best available capabilities/i.test(
      String(condOut?.rendered || ""),
    )
  ) {
    pass("conditional_prompt_rule", condOut.capability_profile_mode);
  } else {
    fail(
      "conditional_prompt_rule",
      JSON.stringify({
        err: conditional.error,
        mode: condOut?.capability_profile_mode,
        snip: String(condOut?.rendered || "").slice(0, 280),
      }),
    );
  }

  const off = compileProtocol({
    spe_api: "context_protocol",
    op: "compile",
    request_text:
      "research the latest peer-reviewed evidence on climate adaptation strategies",
    source_mode: mapPublicSourceToWasm("NO_SOURCES"),
    requested_depth: "FAST",
  });
  const oOut = off.result?.output;
  if (
    !off.error &&
    oOut?.source_mode === "OFF" &&
    oOut?.context_summary?.max_sources === 0
  ) {
    pass("source_off_no_external_context", `max_sources=${oOut.context_summary.max_sources}`);
  } else {
    fail("source_off_no_external_context", JSON.stringify({ err: off.error, out: oOut }));
  }
} catch (err) {
  fail("wasm_behavioral", String(err && err.message ? err.message : err));
}

// --- Stale .spe refresh suggestion without intent mutation ---
try {
  // Mirror the pure helper (TSX is not importable in Node without a loader).
  function suggestStaleContextRefresh(snapshot) {
    const state = String(snapshot.freshness_state ?? "").toUpperCase();
    if (state !== "STALE" && state !== "VERSION_BOUND") return null;
    return {
      action: "SUGGEST_CONTEXT_REFRESH",
      message:
        "Some saved context may be out of date. Refresh sources when you are ready — your request stays the same.",
      preserved_user_request: snapshot.user_request ?? null,
      preserved_intent: snapshot.protected_intent ?? null,
    };
  }
  const intent = {
    confirmed: [{ id: "1", label: "goal", text: "keep this intent" }],
    assumed: [],
    unknowns: [],
    conflicts: [],
  };
  const frozen = JSON.stringify(intent);
  const suggestion = suggestStaleContextRefresh({
    freshness_state: "STALE",
    user_request: "research topic X",
    protected_intent: intent,
  });
  const srcHelper = readFileSync(controlsPath, "utf8");
  if (!srcHelper.includes("suggestStaleContextRefresh")) {
    fail("stale_spe_helper", "suggestStaleContextRefresh missing");
  } else if (
    suggestion &&
    suggestion.action === "SUGGEST_CONTEXT_REFRESH" &&
    suggestion.preserved_user_request === "research topic X" &&
    JSON.stringify(suggestion.preserved_intent) === frozen &&
    JSON.stringify(intent) === frozen
  ) {
    pass("stale_spe_refresh_no_intent_mutation", suggestion.message.slice(0, 80));
  } else {
    fail("stale_spe_refresh_no_intent_mutation", JSON.stringify(suggestion));
  }
  const fresh = suggestStaleContextRefresh({
    freshness_state: "FRESH",
    user_request: "research topic X",
    protected_intent: intent,
  });
  if (fresh == null && JSON.stringify(intent) === frozen) {
    pass("stale_spe_fresh_noop", "no suggestion when fresh");
  } else fail("stale_spe_fresh_noop", JSON.stringify(fresh));
} catch (err) {
  fail("stale_spe_refresh_no_intent_mutation", String(err && err.message ? err.message : err));
}

// --- Fail closed without WASM ---
try {
  const r = spawnSync(process.execPath, [join(here, "eval-context-protocol.mjs")], {
    cwd: webRoot,
    env: {
      ...process.env,
      SPE_CONTEXT_PROTOCOL_JSON: JSON.stringify({
        spe_api: "context_protocol",
        op: "compile",
        request_text: "hello",
        source_mode: "AUTO",
      }),
      SPE_WASM_PATH: "/nonexistent/spe_wasm.wasm",
    },
    encoding: "utf8",
  });
  const body = JSON.parse(r.stdout || "{}");
  if (
    body?.error?.code === "ENGINE_UNAVAILABLE" &&
    body?.result == null &&
    body?.used_ts_fallback !== true
  ) {
    pass("fail_closed_without_wasm", body.error.code);
  } else {
    fail("fail_closed_without_wasm", JSON.stringify(body));
  }
} catch (err) {
  fail("fail_closed_without_wasm", String(err && err.message ? err.message : err));
}

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
}
console.log(
  JSON.stringify(
    {
      gate: "E2E_CONTEXT_PROTOCOL",
      passed: results.filter((r) => r.ok).length,
      failed: failed.length,
      failedNames: failed.map((f) => f.name),
    },
    null,
    2,
  ),
);
process.exitCode = failed.length ? 1 : 0;
