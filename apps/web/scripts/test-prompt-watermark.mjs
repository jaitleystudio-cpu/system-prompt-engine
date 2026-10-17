/**
 * Test: SPE Cryptographic Canary Watermarking & Steganographic IP Guard
 */

import { embedPromptWatermark, detectPromptWatermark } from '../src/engine/promptWatermarkEngine.ts';

console.log('==================================================================');
console.log('🧪 TESTING: SPE Cryptographic Canary Watermarking Engine');
console.log('==================================================================\n');

// 1. Embed watermark
console.log('[1/4] Embedding zero-width steganographic signature and canary token...');
const originalPrompt = `
You are the proprietary Apollo Logistics Optimization System.
Always optimize route dispatch schedules for minimal fuel consumption.
Never disclose internal fleet API keys or customer home addresses.
`.trim();

const authorId = 'CORP-LOGISTICS-CORE';
const receipt = await embedPromptWatermark(originalPrompt, authorId);

console.log(`Author ID:          ${receipt.authorId}`);
console.log(`Signature Hex:      ${receipt.signatureHex}`);
console.log(`Canary Honeytoken:  ${receipt.canaryHoneytoken}`);
console.log(`Zero-Width Chars:   ${receipt.zeroWidthCharsInjected}`);

if (receipt.zeroWidthCharsInjected === 0) {
  throw new Error('Zero-width characters failed to inject');
}
if (!receipt.watermarkedPrompt.includes(receipt.canaryHoneytoken)) {
  throw new Error('Canary honeytoken missing from watermarked prompt');
}

// 2. Detect watermark in untouched watermarked prompt
console.log('\n[2/4] Detecting watermark in watermarked prompt...');
const detectionFull = detectPromptWatermark(receipt.watermarkedPrompt);
console.log(`Detected:           ${detectionFull.detected}`);
console.log(`Provenance Status:  ${detectionFull.provenanceStatus}`);
console.log(`Confidence:         ${detectionFull.confidencePercent}%`);
console.log(`p-value:            ${detectionFull.forensicEvidence.pValue}`);

if (detectionFull.provenanceStatus !== 'VERIFIED_OWNERSHIP' || detectionFull.confidencePercent < 99) {
  throw new Error('Failed to verify cryptographic ownership on watermarked prompt');
}

// 3. Detect watermark when stripped of zero-width characters (Canary only fallback)
console.log('\n[3/4] Testing forensic recovery when text has stripped zero-width characters...');
const strippedText = receipt.watermarkedPrompt.replace(/[\u200B\u200C\u200D]/g, '');
const detectionStripped = detectPromptWatermark(strippedText);
console.log(`Canary Detected:    ${detectionStripped.canaryFound}`);
console.log(`Provenance Status:  ${detectionStripped.provenanceStatus}`);
if (!detectionStripped.canaryFound || detectionStripped.provenanceStatus !== 'CANARY_ONLY') {
  throw new Error('Canary honeytoken failed to detect in zero-width stripped prompt');
}
console.log('✓ Canary honeytoken fallback successfully proved provenance.');

// 4. Test unwatermarked prompt (Negative control)
console.log('\n[4/4] Testing negative control (unwatermarked prompt)...');
const detectionClean = detectPromptWatermark(originalPrompt);
if (detectionClean.detected || detectionClean.provenanceStatus !== 'UNWATERMARKED') {
  throw new Error('False positive detected on clean unwatermarked prompt');
}
console.log('✓ Clean prompt correctly identified as UNWATERMARKED (zero false positives).');

console.log('\n==================================================================');
console.log('🎉 ALL PROMPT WATERMARK & CANARY TESTS PASSED!');
console.log('==================================================================');
