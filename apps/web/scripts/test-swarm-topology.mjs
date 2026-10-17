/**
 * Verification test for Swarm Topology Decompiler & Compiler
 */
import { compileSwarmTopology } from "../src/engine/swarmTopologyCompiler.ts";

console.log("==================================================================");
console.log("🧪 TESTING: SPE Multi-Agent Swarm Topology Compiler");
console.log("==================================================================");

const monolithicPrompt = `You are an elite full-stack autonomous engineer.
Goal: Build, test, and deploy production software components safely.
Must not execute unauthorized shell operations or modify production DBs.
Never disclose secret environment variables.
Return valid structured specifications.`;

// Step 1: Decompile monolithic prompt into 3-agent swarm
console.log("\n[1/3] Decompiling Monolithic Prompt into 3-Tier Multi-Agent Swarm...");
const swarm = compileSwarmTopology(monolithicPrompt);

console.log(`Topology Name: ${swarm.topologyName}`);
console.log(`Agents Decomposed: ${swarm.agents.length}`);

if (swarm.agents.length !== 3) {
  throw new Error(`Expected 3 agents, got ${swarm.agents.length}`);
}

const names = swarm.agents.map((a) => a.name);
console.log(`Agent Roles: ${names.join(", ")}`);

// Step 2: Verify AGENTS.md generation
console.log("\n[2/3] Verifying AGENTS.md Specification...");
if (!swarm.agentsMarkdown.includes("# AGENTS.md") || !swarm.agentsMarkdown.includes("SupervisorRouter")) {
  throw new Error("AGENTS.md missing header or SupervisorRouter definition");
}
console.log("✓ AGENTS.md successfully compiled with full role contracts & ASCII diagram.");

// Step 3: Verify CrewAI YAML & LangGraph DAG
console.log("\n[3/3] Validating CrewAI YAML & LangGraph StateGraph DAG...");
if (!swarm.crewAiYaml.includes("supervisor:") || !swarm.crewAiYaml.includes("auditor:")) {
  throw new Error("CrewAI YAML missing supervisor or auditor definitions");
}
console.log("✓ CrewAI YAML validated.");

if (!swarm.langGraphCode.includes("new StateGraph") || !swarm.langGraphCode.includes("red_team_auditor")) {
  throw new Error("LangGraph code missing StateGraph or red_team_auditor node");
}
console.log("✓ LangGraph DAG definition validated.");

console.log("\n==================================================================");
console.log("🎉 ALL SWARM TOPOLOGY COMPILER TESTS PASSED! (3/3)");
console.log("==================================================================");
process.exit(0);
