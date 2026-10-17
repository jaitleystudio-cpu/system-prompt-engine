#!/usr/bin/env node
/**
 * SPE Ω — Cryptographic Proof Receipt Verifier
 * 
 * Verifies RFC 8785 canonical digest and Ed25519 signatures on SPE proof receipts.
 * Downstream CI steps must use this verifier rather than grepping for string markers.
 * 
 * Usage:
 *   node scripts/verify-receipt-signature.mjs <receipt-file> [--require-signed] [--public-key <hex>]
 */

import { readFileSync, existsSync } from 'node:fs';
import { createHash, verify, createPublicKey } from 'node:crypto';
import { resolve } from 'node:path';

// RFC 8785 Recursive Canonicalizer
export function canonicalize(val) {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return '[' + val.map(canonicalize).join(',') + ']';
  const keys = Object.keys(val).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(val[k])).join(',') + '}';
}

export function verifyReceiptFile(receiptPath, options = {}) {
  const fullPath = resolve(process.cwd(), receiptPath);
  if (!existsSync(fullPath)) {
    throw new Error(`Receipt file not found: ${fullPath}`);
  }

  const rawJson = readFileSync(fullPath, 'utf8');
  let receipt;
  try {
    receipt = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(`Failed to parse receipt JSON: ${err.message}`);
  }

  return verifyReceiptObject(receipt, options);
}

export function verifyReceiptObject(receipt, options = {}) {
  // 1. Schema check
  if (!receipt.schemaVersion || !receipt.schemaVersion.startsWith('spe.proof-receipt.')) {
    throw new Error(`Invalid receipt schema version: ${receipt.schemaVersion}`);
  }

  // 2. Extract recorded digest and signature
  const recordedDigest = receipt.receiptDigest;
  if (!recordedDigest || !/^[0-9a-fA-F]{64}$/.test(recordedDigest)) {
    throw new Error(`Receipt missing valid 64-character SHA-256 digest`);
  }

  const recordedSignature = receipt.signatureHex || null;
  const authMode = receipt.evidenceProvenance?.authenticationMode || 'UNAUTHENTICATED';

  // 3. Recompute canonical digest
  // The digest is computed over the receipt object without the receiptDigest, signatureHex, and signatureError fields.
  const payloadToDigest = { ...receipt };
  delete payloadToDigest.receiptDigest;
  delete payloadToDigest.signatureHex;
  delete payloadToDigest.signatureError;

  const canonicalJson = canonicalize(payloadToDigest);
  const recomputedDigest = createHash('sha256').update(canonicalJson).digest('hex');

  if (recomputedDigest !== recordedDigest) {
    throw new Error(
      `RECEIPT_TAMPERING_DETECTED: Canonical digest mismatch!\n` +
      `  Recorded:   ${recordedDigest}\n` +
      `  Recomputed: ${recomputedDigest}`
    );
  }

  // 4. Check overall verdict
  const overallVerdict = receipt.overallVerdict;
  const isPass = overallVerdict === 'PASS';

  // 5. Signature verification
  let signatureVerified = false;
  if (authMode === 'ED25519_AUTHENTICATED' || options.requireSigned) {
    if (!recordedSignature) {
      throw new Error(`RECEIPT_UNSIGNED: Receipt claims ED25519_AUTHENTICATED but signatureHex is missing.`);
    }

    if (!/^[0-9a-fA-F]{128}$/.test(recordedSignature)) {
      throw new Error(`INVALID_SIGNATURE_FORMAT: Signature must be 128 hex characters (64 bytes).`);
    }

    if (options.publicKey) {
      let pubKeyBuffer;
      const rawPub = options.publicKey.trim();
      if (/^[0-9a-fA-F]{64}$/.test(rawPub)) {
        // 32-byte raw Ed25519 public key -> wrap with SPKI DER prefix
        // SPKI prefix for Ed25519: 302a300506032b6570032100 (12 bytes)
        const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
        pubKeyBuffer = Buffer.concat([spkiPrefix, Buffer.from(rawPub, 'hex')]);
      } else if (/^[0-9a-fA-F]{88}$/.test(rawPub)) {
        // 44-byte SPKI DER
        pubKeyBuffer = Buffer.from(rawPub, 'hex');
      } else {
        throw new Error(`Invalid public key format. Expected 64 hex chars (32-byte raw) or 88 hex chars (SPKI DER).`);
      }

      const pubKey = createPublicKey({
        key: pubKeyBuffer,
        format: 'der',
        type: 'spki'
      });

      const validSig = verify(
        null,
        Buffer.from(recordedDigest, 'hex'),
        pubKey,
        Buffer.from(recordedSignature, 'hex')
      );

      if (!validSig) {
        throw new Error(`CRYPTOGRAPHIC_SIGNATURE_INVALID: Ed25519 signature verification failed against authorized public key.`);
      }
      signatureVerified = true;
    }
  }

  return {
    verified: true,
    isPass,
    digest: recomputedDigest,
    authenticationMode: authMode,
    signatureVerified,
    hardGates: receipt.hardGates
  };
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('verify-receipt-signature.mjs')) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
SPE Ω Proof Receipt Cryptographic Verifier
Usage: node scripts/verify-receipt-signature.mjs <receipt.json> [options]

Options:
  --require-signed       Require that receipt is ED25519_AUTHENTICATED with non-empty signature
  --public-key <hex>     Verify Ed25519 signature against this trusted public key (64-char hex)
`);
    process.exit(0);
  }

  const receiptPath = args[0];
  const requireSigned = args.includes('--require-signed');
  let publicKey = null;
  const pkIdx = args.indexOf('--public-key');
  if (pkIdx !== -1 && args[pkIdx + 1]) {
    publicKey = args[pkIdx + 1];
  }

  try {
    const result = verifyReceiptFile(receiptPath, { requireSigned, publicKey });
    console.log('✅ SPE Proof Receipt Cryptographically Verified:');
    console.log(`  Digest:              ${result.digest}`);
    console.log(`  Authentication Mode: ${result.authenticationMode}`);
    console.log(`  Overall Verdict:     ${result.isPass ? 'PASS' : 'FAIL'}`);
    if (result.signatureVerified) {
      console.log(`  Ed25519 Signature:   VALID (matches authorized public key)`);
    }
    if (!result.isPass) {
      console.error('❌ Receipt records FAIL verdict.');
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error(`❌ Receipt Verification FAILED: ${err.message}`);
    process.exit(1);
  }
}
