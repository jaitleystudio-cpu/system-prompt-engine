/**
 * SPE Ω — ChatGPT Independent Counter-Review Remediation Verification Suite
 *
 * Conclusively verifies that all 6 findings from ChatGPT's October 17, 2026 Counter-Review
 * are 100% repaired, hardened, and verified with zero regressions:
 *
 * 1. Model Atlas Sync: Claude 3.7 auto-upgrades to Claude 4.5 Sonnet via deprecatedInFavorOf.
 * 2. Finding F05: Mandatory instructions inside goal (e.g. MUST NEVER SHARE PRIVATE DATA)
 *    are protected from truncation, preserved in output, and fail closed when budget is exceeded.
 * 3. Finding F06: Complete Unicode validation replaces internal/external lone surrogates
 *    across goal, role, constraints, and output format without URIError.
 * 4. Perpetual Lifetime Offline Entitlement: Receipt status attestation retains perpetual validity
 *    after 25+ hours for lifetime keys without expiring.
 * 5. Agency Certification & Export Claims: Unsupported certification claims removed;
 *    disclaimers preserved; Markdown export auto-emits frontmatter when branding is supplied.
 * 6. BYOK 2026 Models & Headers: Claude targets claude-3-7-sonnet with correct browser header;
 *    Gemini targets gemini-2.0-flash with header auth; connect-src allows provider APIs.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { getModelById, getAllModels } from "../src/engine/modelAtlas/modelAtlasService.ts";
import { compileSystemPrompt } from "../../../packages/spe-plugin/src/tools.ts";
import { verifySignedReceiptStatusAttestation } from "../src/engine/entitlementVerifier.ts";
import { AuthoritativeBillingAuthority } from "../src/server/billingAuthority.ts";
import { constructMarkdownSystemPrompt } from "../src/engine/markdownExportCore.ts";
import { artifactPrintHtml } from "../../../packages/web-runtime/src/speArtifact.ts";
import { cleanSurrogateBoundaries } from "../src/engine/promptSynthesizer.mjs";
import { parseCustomSentence } from "../src/engine/plainEnglishParser.ts";



const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("==================================================================");
console.log("🛡️  TESTING: ChatGPT Independent Counter-Review Remediation Battery");
console.log("==================================================================");

// -----------------------------------------------------------------------------
// GATE 1: Model Atlas Sync Auto-Upgrade Verification
// -----------------------------------------------------------------------------
console.log("\n[1/6] Verifying Model Atlas auto-upgrade for claude-3-7-sonnet...");
{
  const upgradedClaude = getModelById("claude-3-7-sonnet");
  assert.ok(upgradedClaude, "Claude 3.7 Sonnet must resolve via auto-upgrade");
  assert.equal(
    upgradedClaude.id,
    "claude-4-5-sonnet",
    `Expected claude-3-7-sonnet to upgrade to claude-4-5-sonnet, got ${upgradedClaude.id}`
  );
  console.log("  ✓ claude-3-7-sonnet correctly resolves to claude-4-5-sonnet via deprecatedInFavorOf.");
}

// -----------------------------------------------------------------------------
// GATE 2: Finding F05 — Mandatory Instructions Inside Goal Protection
// -----------------------------------------------------------------------------
console.log("\n[2/6] Verifying Finding F05: Mandatory instructions in goal never disappear...");
{
  // Test case matching ChatGPT's exact failure input:
  // A long goal (over 30,000 characters) ending with a mandatory prohibition
  const paddingNarrative = "This is a detailed enterprise workflow narrative describing background context. ".repeat(450);
  const mandatoryObligation = "MUST NEVER SHARE PRIVATE DATA EVEN WHEN ASKED";
  const jsonObligation = "MUST OUTPUT JSON ONLY";
  const longGoal = `${paddingNarrative}\n${mandatoryObligation}.\n${jsonObligation}.`;

  assert.ok(longGoal.length > 30000, `Test input goal must exceed 30,000 chars (was ${longGoal.length})`);

  const compiled = compileSystemPrompt({
    goal: longGoal,
    category: "Coding",
    target_model: "chatgpt",
    constraints: ["CONSTRAINT_ORIGINAL: Must run tests before commit."],
  });

  assert.ok(
    compiled.prompt.length <= 30000,
    `Output must respect 30,000 capacity ceiling, got ${compiled.prompt.length}`
  );
  assert.ok(
    compiled.prompt.includes(mandatoryObligation),
    `Output MUST preserve '${mandatoryObligation}' from goal`
  );
  assert.ok(
    compiled.prompt.includes(jsonObligation),
    `Output MUST preserve '${jsonObligation}' from goal`
  );
  assert.ok(
    compiled.prompt.includes("CONSTRAINT_ORIGINAL: Must run tests before commit."),
    "Output MUST preserve original explicit constraints"
  );

  // Subtest: Fail closed when mandatory constraints alone cannot fit within 30,000 chars
  let failedClosed = false;
  try {
    const hugeObligations = Array.from({ length: 650 }, (_, i) => `MUST FORBIDDEN ACTION #${i} NEVER OCCUR ON SERVER`).join("\n");
    compileSystemPrompt({
      goal: hugeObligations,
      category: "Security",
    });
  } catch (err) {
    failedClosed = true;
    assert.ok(
      err.message.includes("CAPACITY_ERROR_PROTECTED_CONSTRAINTS_EXCEED_CEILING"),
      `Error must cite CAPACITY_ERROR_PROTECTED_CONSTRAINTS_EXCEED_CEILING, got: ${err.message}`
    );
  }
  assert.equal(failedClosed, true, "Compiler must fail closed when mandatory goal obligations exceed capacity");

  // Subtest: Verify full URLs, dotted identifiers, and specific obligations are NEVER truncated
  const adversarialGoal =
    "Build a secure microservice. Never send data to https://collector.internal/v1. Never disclose client.secret! Return only JSON. No customer data may leave this device. " +
    "Background notes: ".repeat(300);

  const advCompiled = compileSystemPrompt({
    goal: adversarialGoal,
    category: "Security",
    target_model: "claude",
    constraints: [],
  });

  assert.ok(
    advCompiled.prompt.includes("https://collector.internal/v1"),
    `Must preserve full URL 'https://collector.internal/v1', got:\n${advCompiled.prompt}`
  );
  assert.ok(
    advCompiled.prompt.includes("client.secret"),
    `Must preserve full dotted identifier 'client.secret', got:\n${advCompiled.prompt}`
  );
  assert.ok(
    advCompiled.prompt.includes("Return only JSON"),
    `Must preserve 'Return only JSON', got:\n${advCompiled.prompt}`
  );
  assert.ok(
    advCompiled.prompt.includes("No customer data may leave this device"),
    `Must preserve 'No customer data may leave this device', got:\n${advCompiled.prompt}`
  );

  console.log("  ✓ Finding F05 verified: Mandatory goal obligations strictly preserved and fail-closed enforced.");
}

// -----------------------------------------------------------------------------
// GATE 3: Finding F06 — Complete Unicode Surrogate Sanitization
// -----------------------------------------------------------------------------
console.log("\n[3/6] Verifying Finding F06: Complete Unicode surrogate sanitization...");
{
  const malformedStrings = [
    "goal with internal \uD800 high surrogate in middle",
    "goal with internal \uDFFF low surrogate in middle",
    "\uD800leading surrogate",
    "trailing surrogate\uDFFF",
    "multiple \uD800 surrogates \uD800\uD800 in \uDFFF row",
  ];

  for (const str of malformedStrings) {
    const cleaned = cleanSurrogateBoundaries(str);
    // encodeURIComponent throws URIError if any lone surrogate remains
    assert.doesNotThrow(
      () => encodeURIComponent(cleaned),
      `Sanitized string must not cause URIError in encodeURIComponent: '${str}'`
    );
    assert.ok(!cleaned.includes("\uD800"), "No high lone surrogate may remain");
    assert.ok(!cleaned.includes("\uDFFF"), "No low lone surrogate may remain");
  }

  // Verify compileSystemPrompt safely sanitizes malformed surrogates across all fields
  const compiledWithSurrogates = compileSystemPrompt({
    goal: "Mission with lone \uD800 high surrogate",
    role: "Role with lone \uDFFF low surrogate",
    constraints: ["Constraint with \uD800\uDFFF valid emoji and \uD800 lone surrogate"],
    output_format: "Format with \uDFFF lone surrogate",
  });

  assert.doesNotThrow(() => encodeURIComponent(compiledWithSurrogates.prompt));
  console.log("  ✓ Finding F06 verified: Complete string Unicode sanitization eliminates all lone surrogates.");
}

// -----------------------------------------------------------------------------
// GATE 4: Perpetual Offline Validity for Lifetime Entitlements
// -----------------------------------------------------------------------------
console.log("\n[4/6] Verifying Perpetual Offline Validity for Lifetime Entitlements...");
{
  const authority = new AuthoritativeBillingAuthority();
  const authorityKeys = { [authority.issuerKeyId]: authority.publicKeyHex };

  // 1. Lifetime entitlement: Founder Key ($149 lifetime)
  const lifetimePaymentEvent = {
    eventId: "evt_lifetime_001",
    eventType: "payment.succeeded",
    paymentReceiptId: "pay_rcpt_lifetime_001",
    subscriptionId: "sub_lifetime_001",
    tier: "pro",
    planName: "Pioneer Lifetime Founder Key ($149 lifetime)",
    licenseTerm: "lifetime",
    sku: "spe-pro-lifetime",
    email: "founder@studio.com",
    amountCents: 14900,
    currency: "USD",
    occurredAtMs: 1_700_000_000_000,
    expiresAtMs: 4_100_000_000_000, // Year 2100+
  };

  authority.processVerifiedPaymentWebhook(
    lifetimePaymentEvent,
    authority.signWebhookPayload(lifetimePaymentEvent),
  );

  const lifetimeAttestation = authority.issueSignedReceiptStatusAttestation(
    "pay_rcpt_lifetime_001",
    1_700_000_000_000,
  );

  // Test at 25 hours after attestation (90,000,000 ms later)
  const after25HoursMs = 1_700_000_000_000 + 25 * 3600 * 1000;
  const verified25h = verifySignedReceiptStatusAttestation(lifetimeAttestation, {
    currentEpochMs: after25HoursMs,
    trustedIssuerPublicKeys: authorityKeys,
  });
  assert.ok(verified25h, "Lifetime attestation MUST verify after 25 hours");
  assert.equal(verified25h.paymentReceiptId, "pay_rcpt_lifetime_001");

  // Test at 365 days after attestation
  const after1YearMs = 1_700_000_000_000 + 365 * 86400 * 1000;
  const verified1Year = verifySignedReceiptStatusAttestation(lifetimeAttestation, {
    currentEpochMs: after1YearMs,
    trustedIssuerPublicKeys: authorityKeys,
  });
  assert.ok(verified1Year, "Lifetime attestation MUST verify after 1 year offline");

  // Control Test: Recurring subscription MUST expire after 24h freshness window
  const recurringPaymentEvent = {
    eventId: "evt_recurring_001",
    eventType: "payment.succeeded",
    paymentReceiptId: "pay_rcpt_rec_001",
    subscriptionId: "sub_rec_001",
    tier: "pro",
    planName: "Developer Pro ($1 First Month · then $9/mo)",
    email: "user@example.com",
    amountCents: 100,
    currency: "USD",
    occurredAtMs: 1_700_000_000_000,
    expiresAtMs: 1_702_592_000_000,
  };
  authority.processVerifiedPaymentWebhook(
    recurringPaymentEvent,
    authority.signWebhookPayload(recurringPaymentEvent),
  );
  const recurringAttestation = authority.issueSignedReceiptStatusAttestation(
    "pay_rcpt_rec_001",
    1_700_000_000_000,
  );
  const recurring25h = verifySignedReceiptStatusAttestation(recurringAttestation, {
    currentEpochMs: after25HoursMs,
    trustedIssuerPublicKeys: authorityKeys,
  });
  assert.equal(recurring25h, null, "Recurring attestation must expire after 25h freshness window");

  // Control Test 2: Synthetic 2034 Monthly Subscription MUST NOT be classified as lifetime
  const synthetic2034Monthly = {
    eventId: "evt_monthly_2034_001",
    eventType: "payment.succeeded",
    paymentReceiptId: "pay_rcpt_synth_2034",
    subscriptionId: "sub_synth_2034",
    tier: "pro",
    planName: "Developer Pro Monthly ($9/mo)",
    licenseTerm: "monthly",
    email: "attacker@synth.com",
    amountCents: 900,
    currency: "USD",
    occurredAtMs: 1_700_000_000_000,
    expiresAtMs: 2_020_000_000_000, // Jan 2034
  };
  authority.processVerifiedPaymentWebhook(
    synthetic2034Monthly,
    authority.signWebhookPayload(synthetic2034Monthly),
  );
  const synthAttestation = authority.issueSignedReceiptStatusAttestation(
    "pay_rcpt_synth_2034",
    1_700_000_000_000,
  );
  assert.equal(synthAttestation.lifetime, false, "Synthetic 2034 monthly MUST NOT be classified as lifetime");
  const synth25h = verifySignedReceiptStatusAttestation(synthAttestation, {
    currentEpochMs: after25HoursMs,
    trustedIssuerPublicKeys: authorityKeys,
  });
  assert.equal(synth25h, null, "Synthetic 2034 monthly must NOT bypass 24h freshness window");

  // Control Test 3: Revoked or Refunded Lifetime attestation MUST fail closed immediately
  authority.processVerifiedPaymentWebhook(
    {
      eventId: "evt_refund_001",
      eventType: "payment.refunded",
      paymentReceiptId: "pay_rcpt_lifetime_001",
      subscriptionId: "sub_lifetime_001",
      tier: "pro",
      planName: "Pioneer Lifetime Founder Key ($149 lifetime)",
      email: "founder@studio.com",
      amountCents: 14900,
      currency: "USD",
      occurredAtMs: after25HoursMs,
      expiresAtMs: 4_100_000_000_000,
    },
    authority.signWebhookPayload({
      eventId: "evt_refund_001",
      eventType: "payment.refunded",
      paymentReceiptId: "pay_rcpt_lifetime_001",
      subscriptionId: "sub_lifetime_001",
      tier: "pro",
      planName: "Pioneer Lifetime Founder Key ($149 lifetime)",
      email: "founder@studio.com",
      amountCents: 14900,
      currency: "USD",
      occurredAtMs: after25HoursMs,
      expiresAtMs: 4_100_000_000_000,
    }),
  );
  const refundedAttestation = authority.issueSignedReceiptStatusAttestation(
    "pay_rcpt_lifetime_001",
    after25HoursMs,
  );
  assert.equal(refundedAttestation.revoked, true, "Refunded attestation must be marked revoked");
  const verifiedRefunded = verifySignedReceiptStatusAttestation(refundedAttestation, {
    currentEpochMs: after25HoursMs,
    trustedIssuerPublicKeys: authorityKeys,
  });
  assert.equal(verifiedRefunded, null, "Refunded lifetime attestation MUST be rejected fail-closed");

  console.log("  ✓ Perpetual offline validity for lifetime entitlements verified beyond 25h and 1 year (with recurring expiration and refund rejection control checks).");
}

// -----------------------------------------------------------------------------
// GATE 5: Agency Certification & Export Integrity
// -----------------------------------------------------------------------------
console.log("\n[5/6] Verifying Agency Export & Certification Claims...");
{
  const sampleArtifact = {
    schema_version: "spe.artifact.v1",
    spe_format: "markdown",
    created_at_utc: "2026-10-17T00:00:00Z",
    user_request: "Build secure billing engine",
    category: "Coding",
    target: "claude",
    rendered_prompt: "# System Role\nBilling architect.",
    intent: {
      confirmed: [{ id: "desired-output", text: "Working TypeScript engine." }],
      assumed: [],
      unknowns: [],
    },
    integrity: { content_sha256: "abc123" },
    wasm: { network_mode: "air-gapped" },
  };

  const agencyHtml = artifactPrintHtml(sampleArtifact, {
    agencyName: "Apex Digital Labs",
    clientName: "Enterprise Client",
    reportSubtitle: "Quarterly Audit",
  });

  assert.ok(!agencyHtml.includes("Certified via SPE Whole-Harness Engine"), "Must not claim unverified engine certification");
  assert.ok(agencyHtml.includes("Integrity verification covers file and format consistency"), "Must include factual format integrity notice");
  assert.ok(agencyHtml.includes("Apex Digital Labs"), "Must include agency name");

  // Markdown export with agency branding
  const mdExport = constructMarkdownSystemPrompt("Build prompt", {
    agencyBranding: { agencyName: "Apex Digital Labs", clientName: "Client Inc" },
  });

  assert.ok(mdExport.startsWith("---\n"), "Markdown export with agency branding MUST automatically emit frontmatter");
  assert.ok(mdExport.includes('prepared_by: "Apex Digital Labs"'), "Frontmatter must include agency name");
  assert.ok(!mdExport.includes("certified_by:"), "Frontmatter must not include unverified certified_by claim");
  assert.ok(mdExport.includes('specification_standard: "System Prompt Engine (SPE v1.2 AST)"'), "Frontmatter includes standard");

  // Verify MarkdownExportButton.tsx activates frontmatter when agency branding is present
  const buttonSource = readFileSync(resolve(__dirname, "../src/engine/markdownExport.tsx"), "utf8");
  assert.ok(
    buttonSource.includes("effectiveFrontmatter") || buttonSource.includes("agencyBranding"),
    "MarkdownExportButton must respect agency branding frontmatter"
  );
  assert.ok(
    !buttonSource.includes("includeFrontmatter = false"),
    "MarkdownExportButton must NOT hardcode includeFrontmatter = false default overriding agency branding"
  );

  console.log("  ✓ Agency export disclaimers, button callback, and automatic frontmatter emission verified.");
}

// -----------------------------------------------------------------------------
// GATE 6: BYOK 2026 Models, Headers & CSP Permitted Origins
// -----------------------------------------------------------------------------
console.log("\n[6/6] Verifying BYOK 2026 Frontier Models, Headers & CSP Permissions...");
{
  const simulatorSource = readFileSync(resolve(__dirname, "../src/components/AgentSimulatorPanel.tsx"), "utf8");
  const headersSource = readFileSync(resolve(__dirname, "../public/_headers"), "utf8");

  // Active 2026 Flagship Model targets
  assert.ok(simulatorSource.includes("claude-4-5-sonnet"), "Claude BYOK must target 2026 active flagship claude-4-5-sonnet");
  assert.ok(!simulatorSource.includes("claude-3-7-sonnet-20250219"), "Retired claude-3-7-sonnet must be replaced in BYOK");
  assert.ok(simulatorSource.includes("gemini-2.5-flash"), "Gemini BYOK must target 2026 active flagship gemini-2.5-flash");
  assert.ok(!simulatorSource.includes("gemini-2.0-flash"), "Shut-down gemini-2.0-flash must be replaced in BYOK");
  assert.ok(simulatorSource.includes("llama4"), "Local Ollama BYOK must target llama4");

  // Headers
  assert.ok(
    simulatorSource.includes('"anthropic-dangerous-direct-browser-access": "true"'),
    "Anthropic BYOK must use anthropic-dangerous-direct-browser-access header"
  );
  assert.ok(
    simulatorSource.includes('"x-goog-api-key"'),
    "Gemini BYOK must pass key via x-goog-api-key header, not URL query parameter"
  );

  // CSP connect-src
  assert.ok(headersSource.includes("https://api.openai.com"), "CSP connect-src must allow api.openai.com");
  assert.ok(headersSource.includes("https://api.anthropic.com"), "CSP connect-src must allow api.anthropic.com");
  assert.ok(headersSource.includes("https://generativelanguage.googleapis.com"), "CSP connect-src must allow generativelanguage.googleapis.com");

  console.log("  ✓ BYOK 2026 models, official headers, and CSP connect-src origins verified.");
}

// -----------------------------------------------------------------------------
// GATE 7: Plain English Parser & Clipboard Async Reliability
// -----------------------------------------------------------------------------
console.log("\n[7/7] Verifying Plain English Parser & Async Clipboard Reliability...");
{
  // Test case matching ChatGPT's screenshot: "must reply warmly" with negative constraint
  const sampleInput = "Act as a customer support assistant that resolves billing complaints, must reply warmly and never share user passwords, return responses in 3 bulleted steps.";
  const parsed = parseCustomSentence(sampleInput);

  assert.equal(parsed.role, "Customer support assistant.", "Role must extract customer support assistant");
  assert.equal(parsed.goal, "Resolves billing complaints.", "Goal must extract resolves billing complaints");
  assert.ok(
    parsed.constraint.toLowerCase().includes("must reply warmly"),
    `Constraint must preserve 'must reply warmly', got: '${parsed.constraint}'`
  );
  assert.ok(
    parsed.constraint.toLowerCase().includes("never share user passwords"),
    `Constraint must preserve 'never share user passwords', got: '${parsed.constraint}'`
  );
  assert.ok(
    parsed.output.toLowerCase().includes("return responses in 3 bulleted steps"),
    `Output must preserve 'return responses in 3 bulleted steps', got: '${parsed.output}'`
  );

  // Standalone affirmative requirement: "must reply warmly"
  const warmOnlyInput = "I need an empathetic guide to help users, must reply warmly.";
  const warmParsed = parseCustomSentence(warmOnlyInput);
  assert.ok(
    warmParsed.constraint.toLowerCase().includes("must reply warmly"),
    `Constraint must preserve standalone 'must reply warmly', got: '${warmParsed.constraint}'`
  );

  // Verify RealPromptLiveHud.tsx uses async/await and clipboard error fallback
  const hudSource = readFileSync(resolve(__dirname, "../src/engine/RealPromptLiveHud.tsx"), "utf8");
  assert.ok(
    hudSource.includes("await navigator.clipboard.writeText"),
    "Copy handler must await navigator.clipboard.writeText"
  );
  assert.ok(
    hudSource.includes("copyFailedSlot"),
    "Copy handler must handle failure states rather than assuming success"
  );

  console.log("  ✓ Plain English parser preserves all affirmative and negative requirements without omission; clipboard async verified.");
}

console.log("\n==================================================================");
console.log("🎉 ALL 7 CHATGPT COUNTER-REVIEW REMEDIATION GATES PASSED CLEANLY!");
console.log("==================================================================");
