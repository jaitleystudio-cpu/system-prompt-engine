#!/usr/bin/env node
import assert from "node:assert/strict";
import { generateProductionSdkCode } from "../src/engine/sdkCodeGenerator.ts";

console.log("==================================================================");
console.log("🧪 TESTING: SPE Production SDK Code Generator (Prompt-to-Code)");
console.log("==================================================================");

const samplePrompt = `
You are a senior DevOps engineer.
Ensure zero unverified cloud mutations.
Never reveal root credentials.
Responses must be JSON.
`;

console.log("\n[1/4] Testing TypeScript Vercel AI SDK Code Generation...");
const tsVercel = generateProductionSdkCode(samplePrompt, {
  promptName: "CloudGuard",
  target: "typescript-vercel",
  pageSize: 32,
});
console.log(`Generated: ${tsVercel.filename}`);
assert.ok(tsVercel.code.includes("import { generateText, streamText } from 'ai';"), "Includes Vercel AI SDK import");
assert.ok(tsVercel.code.includes("export const CloudGuardInputSchema = z.object({"), "Includes Zod input schema");
assert.ok(tsVercel.code.includes("export const CloudGuardOutputSchema = z.object({"), "Includes Zod output schema");
assert.ok(tsVercel.code.includes("COMPILED_SYSTEM_PROMPT"), "Includes compiled prompt");
console.log("✓ TypeScript Vercel AI SDK code verified.");

console.log("\n[2/4] Testing TypeScript Anthropic SDK Code Generation...");
const tsAnthropic = generateProductionSdkCode(samplePrompt, {
  promptName: "CloudGuard",
  target: "typescript-anthropic",
  pageSize: 32,
});
console.log(`Generated: ${tsAnthropic.filename}`);
assert.ok(tsAnthropic.code.includes("import Anthropic from '@anthropic-ai/sdk';"), "Includes Anthropic SDK import");
assert.ok(tsAnthropic.code.includes("export async function callCloudGuard("), "Includes typed invocation function");
console.log("✓ TypeScript Anthropic SDK code verified.");

console.log("\n[3/4] Testing Python LangChain Code Generation...");
const pyLangChain = generateProductionSdkCode(samplePrompt, {
  promptName: "CloudGuard",
  target: "python-langchain",
  pageSize: 32,
});
console.log(`Generated: ${pyLangChain.filename}`);
assert.ok(pyLangChain.code.includes("from pydantic import BaseModel, Field"), "Includes Pydantic import");
assert.ok(pyLangChain.code.includes("class CloudGuardInput(BaseModel):"), "Includes Pydantic input model");
assert.ok(pyLangChain.code.includes("class CloudGuardOutput(BaseModel):"), "Includes Pydantic output model");
assert.ok(pyLangChain.code.includes("from langchain_core.prompts import ChatPromptTemplate"), "Includes LangChain prompt template");
console.log("✓ Python LangChain code verified.");

console.log("\n[4/4] Testing Python OpenAI SDK Code Generation...");
const pyOpenAI = generateProductionSdkCode(samplePrompt, {
  promptName: "CloudGuard",
  target: "python-openai",
  pageSize: 32,
});
console.log(`Generated: ${pyOpenAI.filename}`);
assert.ok(pyOpenAI.code.includes("from openai import OpenAI"), "Includes OpenAI SDK import");
assert.ok(pyOpenAI.code.includes("def execute_cloudguard("), "Includes typed runner function");
console.log("✓ Python OpenAI SDK code verified.");

console.log("\n==================================================================");
console.log("🎉 ALL SDK CODE GENERATOR TESTS PASSED! (4/4 TARGETS)");
console.log("==================================================================");
