#!/usr/bin/env node
/**
 * SPE Ω — Founder Independent Release Signing Utility
 *
 * External cryptographic release authorization tool.
 * Runs strictly with external founder credentials (never embedded in repo or client bundles).
 * Emits cryptographically bound, single-use, timestamped ReleaseApprovalProof.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { generateReleaseAuthorityProof } from "../apps/web/src/engine/evolution/releaseSafetyGovernor.ts";

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const proposalId = getArg("--proposal") || "PROP-DEFAULT";
const candidateDigest = getArg("--digest") || "digest-default";
const targetEnvironment = getArg("--env") || "production";
const authorizedAction = getArg("--action") || "RELEASE_PROMOTION";
const approver = getArg("--approver") || "founder_release_authority";
const keyFile = getArg("--key-file");

let privateKeyPem = process.env.SPE_FOUNDER_SIGNING_PRIVATE_KEY;
if (!privateKeyPem && keyFile && existsSync(resolve(keyFile))) {
  privateKeyPem = readFileSync(resolve(keyFile), "utf-8");
}

if (!privateKeyPem) {
  console.error("❌ ERROR: External release signing key not provided.");
  console.error("   Release authority private keys must be held externally by the human founder/oracle.");
  console.error("   Set SPE_FOUNDER_SIGNING_PRIVATE_KEY in environment or pass --key-file <path>.");
  console.error("   Autonomous agents cannot self-sign or manufacture releases.");
  process.exit(1);
}

try {
  const proof = generateReleaseAuthorityProof(
    proposalId,
    approver,
    { privateKeyPem },
    candidateDigest,
    targetEnvironment,
    authorizedAction
  );

  console.log(JSON.stringify(proof, null, 2));
} catch (err) {
  console.error("❌ Failed to generate release authorization proof:", err.message);
  process.exit(1);
}
