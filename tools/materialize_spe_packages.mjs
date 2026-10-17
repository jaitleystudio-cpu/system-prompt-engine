/**
 * tools/materialize_spe_packages.mjs
 *
 * Materializes all advertised .spe packages and bundles into apps/web/public/packages/
 * with genuine JSON specifications, AST schemas, and cryptographic SHA-256 integrity digests.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";

const ROOT = resolve(process.cwd());
const PACKAGES_DIR = resolve(ROOT, "apps/web/public/packages");
const PROMPTS_JSON_PATH = resolve(ROOT, "apps/web/public/api/v1/prompts/index.json");
const PROMPT_PACKS_JSON_PATH = resolve(ROOT, "apps/web/public/api/v1/prompt-packs/index.json");
const GATEWAY_API_TS_PATH = resolve(ROOT, "apps/web/src/engine/gateway/promptGatewayApi.ts");

if (!existsSync(PACKAGES_DIR)) {
  mkdirSync(PACKAGES_DIR, { recursive: true });
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

// 1. Materialize individual prompt packages
const promptsData = JSON.parse(readFileSync(PROMPTS_JSON_PATH, "utf-8"));
const promptChecksumMap = new Map();

for (const prompt of promptsData.prompts) {
  const filename = prompt.spePackageUri.replace(/^\/packages\//, "");
  const filePath = resolve(PACKAGES_DIR, filename);

  const spePackage = {
    format: "spe-package-v1",
    id: prompt.id,
    title: prompt.title,
    domain: prompt.domain,
    description: prompt.description,
    version: prompt.version,
    license: prompt.license,
    canonicalPrompt: prompt.canonicalPrompt,
    astSchema: prompt.astSchema,
    variables: prompt.variables,
    supportedDialects: prompt.supportedDialects,
    authorityCeiling: prompt.authorityCeiling,
    manifest: {
      engine: "SPE Ω",
      engineRelease: "2026.10-omega",
      wasmCompatibility: "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d",
      contentSha256: sha256(prompt.canonicalPrompt),
      generatedAt: "2026-10-17T00:00:00Z"
    },
    discovery: {
      protocol: "spe-agent-invitation/v1",
      officialUrl: "https://systempromptengine.com",
      agentInvitationUrl: "https://systempromptengine.com/.well-known/spe-agent-invitation.json",
      capabilitiesUrl: "https://systempromptengine.com/.well-known/spe-capabilities.json",
      invitationMessage: "AI agents and assistants are welcome to discover SPE's Free tools for prompt engineering, software development, design, and workflow automation.",
      freeWebOutputCeilingCharacters: 30000,
      mcpEndpoint: "https://systempromptengine.com/api/v1/mcp",
      promptIntegrityLaw: "Prompt text is strictly preserved byte-for-byte; no hidden Unicode watermarks or prompt injection."
    }
  };

  const fileContent = JSON.stringify(spePackage, null, 2) + "\n";
  writeFileSync(filePath, fileContent, "utf-8");

  const fileDigest = sha256(fileContent);
  prompt.verificationChecksum = fileDigest;
  promptChecksumMap.set(prompt.id, fileDigest);
  console.log(`✓ Materialized prompt package: ${filename} (${fileDigest.slice(0, 16)}...)`);
}

// Save updated prompts JSON
writeFileSync(PROMPTS_JSON_PATH, JSON.stringify(promptsData, null, 2) + "\n", "utf-8");
// Also update alias prompts.json
const promptsAliasPath = resolve(ROOT, "apps/web/public/api/v1/prompts.json");
if (existsSync(promptsAliasPath)) {
  writeFileSync(promptsAliasPath, JSON.stringify(promptsData, null, 2) + "\n", "utf-8");
}

// 2. Materialize prompt packs bundles
const packsData = JSON.parse(readFileSync(PROMPT_PACKS_JSON_PATH, "utf-8"));
const packChecksumMap = new Map();

for (const pack of packsData.packs) {
  const filename = pack.speBundleUri.replace(/^\/packages\//, "");
  const filePath = resolve(PACKAGES_DIR, filename);

  const speBundle = {
    format: "spe-bundle-v1",
    id: pack.id,
    name: pack.name,
    description: pack.description,
    domain: pack.domain,
    promptsCount: pack.promptsCount,
    prompts: pack.prompts,
    totalInvariants: pack.totalInvariants,
    license: pack.license,
    manifest: {
      engine: "SPE Ω",
      engineRelease: "2026.10-omega",
      wasmCompatibility: "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d",
      contentSha256: sha256(JSON.stringify(pack.prompts)),
      generatedAt: "2026-10-17T00:00:00Z"
    }
  };

  const fileContent = JSON.stringify(speBundle, null, 2) + "\n";
  writeFileSync(filePath, fileContent, "utf-8");

  const fileDigest = sha256(fileContent);
  pack.verificationChecksum = fileDigest;
  packChecksumMap.set(pack.id, fileDigest);
  console.log(`✓ Materialized pack bundle: ${filename} (${fileDigest.slice(0, 16)}...)`);
}

// Save updated packs JSON
writeFileSync(PROMPT_PACKS_JSON_PATH, JSON.stringify(packsData, null, 2) + "\n", "utf-8");
const packsAliasPath = resolve(ROOT, "apps/web/public/api/v1/prompt-packs.json");
if (existsSync(packsAliasPath)) {
  writeFileSync(packsAliasPath, JSON.stringify(packsData, null, 2) + "\n", "utf-8");
}

// 3. Update verificationChecksums in promptGatewayApi.ts
let gatewaySrc = readFileSync(GATEWAY_API_TS_PATH, "utf-8");
for (const [id, checksum] of promptChecksumMap.entries()) {
  const regex = new RegExp(`(id:\\s*"${id}"[\\s\\S]*?verificationChecksum:\\s*)"[a-f0-9]{64}"`, "m");
  gatewaySrc = gatewaySrc.replace(regex, `$1"${checksum}"`);
}
for (const [id, checksum] of packChecksumMap.entries()) {
  const regex = new RegExp(`(id:\\s*"${id}"[\\s\\S]*?verificationChecksum:\\s*)"[a-f0-9]{64}"`, "m");
  gatewaySrc = gatewaySrc.replace(regex, `$1"${checksum}"`);
}
writeFileSync(GATEWAY_API_TS_PATH, gatewaySrc, "utf-8");
console.log("✓ Updated verificationChecksums in promptGatewayApi.ts");
console.log("🎉 All .spe packages materialized successfully.");
