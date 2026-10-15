/**
 * SPE Ω — WebMCP Imperative API Specification Conformance Test
 * 
 * Tests compliance against:
 * 1. Official document.modelContext mounting (Chrome 150+ spec)
 * 2. Backward-compatible navigator.modelContext with deprecation warning
 * 3. Graceful degradation in unsupported browser environments
 * 4. Permissions-Policy gating (ai-model-context / model-context)
 * 5. Execution of a real WebMCP tool invocation
 */

import { WebMcpAgentGateway } from "../src/engine/agentGateway/webmcpAgentGateway.ts";

console.log("========================================================================");
console.log("🤖 SPE Ω — WEBMCP IMPERATIVE API CONFORMANCE BATTERY (Chrome 150+ Spec)");
console.log("========================================================================");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function testWebMcpImperativeSpec() {
  const gateway = new WebMcpAgentGateway();

  // Test 1: Unsupported environment safe handling (Node environment where window is undefined)
  // Ensure mountBrowserGlobals returns false cleanly without crashing
  const initialMount = gateway.mountBrowserGlobals();
  assert(initialMount === false, "Unsupported environment (no window) fails safely with false");

  // Test 2: Simulate browser environment with modern document.modelContext (Chrome 150+)
  const mockWindow = {};
  const mockDocument = {};

  globalThis.window = mockWindow;
  globalThis.document = mockDocument;
  // In Node 22, globalThis.navigator is built-in; delete existing modelContext if present
  delete globalThis.navigator.modelContext;

  const mounted = gateway.mountBrowserGlobals();
  assert(mounted === true, "mountBrowserGlobals returns true when window/document are present");
  assert(typeof mockWindow.WebMCP === "object", "Exposes window.WebMCP");
  assert(typeof mockDocument.modelContext === "object", "Official document.modelContext is mounted (Chrome 150+)");
  assert(mockDocument.modelContext.spec.includes("Chrome 150+"), "document.modelContext identifies as official Chrome 150+ spec");
  assert(Array.isArray(mockDocument.modelContext.tools), "document.modelContext.tools contains tool list");
  assert(typeof mockDocument.modelContext.call === "function", "document.modelContext.call is an executable function");

  // Test 3: Backward compatibility on navigator.modelContext with deprecation warning
  let warnLogged = false;
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args.some((a) => String(a).includes("[WebMCP Deprecation]"))) {
      warnLogged = true;
    }
  };

  const navModelContext = globalThis.navigator.modelContext;
  console.warn = originalWarn;

  assert(warnLogged === true, "Accessing navigator.modelContext logs deprecation warning per Chrome 150+");
  assert(typeof navModelContext.call === "function", "navigator.modelContext maintains functioning fallback proxy");

  // Test 4: Real WebMCP tool call through document.modelContext
  const token = gateway["shield"].mintLocalToken("test-chrome-agent", ["spe:compile", "spe:governance"]);
  const toolResult = await mockDocument.modelContext.call(
    "spe_compile_prompt",
    { taskBrief: "Design air-gapped cryptography engine" },
    token
  );

  assert(toolResult.status === "SUCCESS", "Real invocation through document.modelContext returns SUCCESS");
  assert(toolResult.output.offlineProof === true, "Tool output confirms offline WebAssembly execution ($0 spend)");
  assert(typeof toolResult.executionLatencyMs === "number" && toolResult.executionLatencyMs >= 0, "Execution latency accurately measured");

  // Test 4b: WebMCP spe_model_governance integration with real governance
  const govResultInvented = await mockDocument.modelContext.call(
    "spe_model_governance",
    { modelId: "gpt-5" },
    token
  );
  assert(govResultInvented.status === "SUCCESS", "Governance tool invocation returns SUCCESS");
  assert(govResultInvented.output.status === "UNSUPPORTED_REJECTED", "WebMCP rejects speculative model 'gpt-5'");
  assert(govResultInvented.output.isAuthoritative === false, "WebMCP flags 'gpt-5' as not authoritative");

  const govResultOlder = await mockDocument.modelContext.call(
    "spe_model_governance",
    { modelId: "gpt-4" },
    token
  );
  assert(govResultOlder.output.status === "AUTHORIZED_PRESERVED_OLDER", "WebMCP preserves older model 'gpt-4' verbatim");
  assert(govResultOlder.output.targetPreserved === true, "WebMCP confirms targetPreserved: true for 'gpt-4'");
  assert(govResultOlder.output.suggestedAlternative === "gpt-4o", "WebMCP suggests active alternative 'gpt-4o'");

  const govResultAdapted = await mockDocument.modelContext.call(
    "spe_model_governance",
    { modelId: "gpt-4", explicitUserConsent: true },
    token
  );
  assert(govResultAdapted.output.status === "ADAPTED_WITH_CONSENT", "WebMCP adapts 'gpt-4' to 'gpt-4o' with explicit consent");
  assert(govResultAdapted.output.effectiveModelId === "gpt-4o", "WebMCP effective model is 'gpt-4o' under authorized adaptation");

  // Test 5: Permissions-Policy blocking
  const restrictedDoc = {
    permissionsPolicy: {
      allowsFeature: (feat) => feat !== "model-context",
    },
  };
  globalThis.document = restrictedDoc;
  globalThis.window = {};
  delete globalThis.navigator.modelContext;

  const restrictedGateway = new WebMcpAgentGateway();
  const policyBlocked = restrictedGateway.mountBrowserGlobals();
  assert(policyBlocked === false, "Permissions-Policy disallowing 'model-context' fail-closes and returns false");

  // Cleanup globals
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.navigator;

  console.log("------------------------------------------------------------------------");
  console.log(`Results: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

testWebMcpImperativeSpec().catch((err) => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});
