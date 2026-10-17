/**
 * Test: SPE Live Model Runner
 */
import {
  executeProviderCall,
  parseProviderModelString,
  estimateCostUsd,
} from "../src/engine/eval/liveModelRunner.ts";

async function main() {
  console.log("🚀 Testing SPE Live Multi-Provider Execution Runner...");

  // 1. Target Parsing
  const parsedOllama = parseProviderModelString("ollama:llama3:latest");
  if (parsedOllama.provider !== "ollama" || parsedOllama.model !== "llama3:latest") {
    throw new Error(`Failed to parse ollama target: ${JSON.stringify(parsedOllama)}`);
  }
  const parsedAnthropic = parseProviderModelString("anthropic:claude-3-7-sonnet-20250219");
  if (parsedAnthropic.provider !== "anthropic" || parsedAnthropic.model !== "claude-3-7-sonnet-20250219") {
    throw new Error(`Failed to parse anthropic target: ${JSON.stringify(parsedAnthropic)}`);
  }
  console.log("  ✓ Provider/Model target string parsing verified.");

  // 2. Cost Estimation
  const costGpt6 = estimateCostUsd("gpt-6-1-sol", 1000, 500);
  if (costGpt6 <= 0) {
    throw new Error(`Expected non-zero cost for gpt-6-1-sol, got ${costGpt6}`);
  }
  const costClaude = estimateCostUsd("claude-5-5-sonnet", 2000, 1000);
  if (costClaude <= 0) {
    throw new Error(`Expected non-zero cost for Claude Sonnet 5.5, got ${costClaude}`);
  }
  console.log(`  ✓ Cost estimation verified: GPT-6.1=$${costGpt6}, Claude 5.5=$${costClaude}`);

  // 3. Mock Execution with Streaming Callback
  let streamed = "";
  const mockRes = await executeProviderCall({
    provider: "mock",
    model: "mock-fast-1",
    systemPrompt: "You are a test agent.",
    userInput: "Summarize this payload.",
    onToken: (tok) => {
      streamed += tok;
    },
    mockResponse: {
      text: "Simulated stream output from mock runner.",
      latencyMs: 20,
    },
  });

  if (mockRes.status !== "success" || !mockRes.output.includes("Simulated stream output")) {
    throw new Error(`Mock runner failed: ${JSON.stringify(mockRes)}`);
  }
  if (!streamed.includes("Simulated stream output")) {
    throw new Error("Streaming callback failed to receive tokens.");
  }
  if (mockRes.totalTokens <= 0) {
    throw new Error("Total tokens should be positive.");
  }

  console.log(`  ✓ Mock execution & streaming verified (Latency: ${mockRes.latencyMs}ms, Tokens: ${mockRes.totalTokens}).`);

  // 4. Missing API Key error reporting
  const unauthRes = await executeProviderCall({
    provider: "openai",
    model: "gpt-4o",
    systemPrompt: "System",
    userInput: "User",
    apiKey: "", // explicit empty key
  });

  if (unauthRes.status !== "error" || !unauthRes.errorMessage?.includes("Missing API key")) {
    throw new Error(`Expected missing key error, got: ${JSON.stringify(unauthRes)}`);
  }
  console.log("  ✓ Missing API key graceful error handling verified.");

  console.log("✅ Live Model Runner verified healthy!");
}

main().catch((err) => {
  console.error("❌ Live Model Runner Test Failed:", err);
  process.exit(1);
});
