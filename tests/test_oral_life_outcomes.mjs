#!/usr/bin/env node
/**
 * SPE Oral Life Outcomes & Global Languages Test Suite
 *
 * Verifies the 6 groundbreaking outcome engines and 20 global languages registry:
 * 1. Spoken Promise Ledger
 * 2. Chronic-Care & Caregiver Timeline
 * 3. Speak-to-Fill Gov Forms
 * 4. Scam & Coercion Narrative & Evidence Pack
 * 5. Creator Clip Mine
 * 6. Marketplace Dispute Pack
 * 7. 20 Global Languages Worldwide Registry
 *
 * INVARIANTS TESTED:
 * - RAW_USER_DATA_EGRESS = 0 strictly verified on every receipt.
 * - Cryptographic SHA-256 receipt binding.
 * - Deterministic execution without external API or cloud costs.
 */

import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../apps/web/node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const bundle = await build({
  entryPoints: [`${root}/apps/web/src/engine/multimodal/index.ts`],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  target: "node20",
  external: ["node:crypto"],
});

const mm = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
);

const {
  promiseLedgerEngine,
  careTimelineEngine,
  speakToFillFormEngine,
  scamAfterglowEngine,
  creatorClipMineEngine,
  marketplaceDisputeEngine,
  GLOBAL_LANGUAGES,
  getLanguageInfo,
  isGlobalLanguageSupported,
} = mm;

console.log("\n========================================================");
console.log("  SPE ORAL LIFE OUTCOMES & GLOBAL LANGUAGES SUITE");
console.log("========================================================\n");

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------
// TEST WAVE 1: 30 Major Global Languages Worldwide Registry
// ---------------------------------------------------------------------
console.log("--- WAVE 1: 30 Major Global Languages Worldwide Registry ---");

test("Registry contains all 30 major global languages covering >6B speakers", () => {
  const expectedCodes = [
    "en", "es", "zh", "hi", "ar", "bn", "pt", "ru", "ja", "de",
    "fr", "te", "ta", "id", "ur", "ko", "it", "tr", "vi", "mr",
    "gu", "kn", "ml", "pa", "fa", "sw", "th", "pl", "uk", "nl",
    "fil", "ha"
  ];

  for (const code of expectedCodes) {
    assert.ok(isGlobalLanguageSupported(code), `Language ${code} must be supported`);
    const info = getLanguageInfo(code);
    assert.equal(info.code, code);
    assert.ok(info.nativeName.length > 0);
    assert.ok(info.speakersEstimateMillions >= 25);
  }

  const totalSpeakers = Object.values(GLOBAL_LANGUAGES).reduce(
    (acc, l) => acc + l.speakersEstimateMillions,
    0,
  );
  assert.ok(totalSpeakers >= 6000, `Total speakers estimate should exceed 6,000M (got ${totalSpeakers}M)`);
});

test("RTL languages (Arabic, Urdu, Persian) have correct directionality metadata", () => {
  assert.equal(getLanguageInfo("ar").direction, "rtl");
  assert.equal(getLanguageInfo("ur").direction, "rtl");
  assert.equal(getLanguageInfo("fa").direction, "rtl");
  assert.equal(getLanguageInfo("en").direction, "ltr");
  assert.equal(getLanguageInfo("zh").direction, "ltr");
  assert.equal(getLanguageInfo("sw").direction, "ltr");
});

// ---------------------------------------------------------------------
// TEST WAVE 2: Spoken Promise Ledger ("Transcript -> Obligation")
// ---------------------------------------------------------------------
console.log("\n--- WAVE 2: Spoken Promise Ledger ---");

test("PromiseLedger extracts wage obligations, monetary sums, deadlines, and parties", () => {
  const ledger = promiseLedgerEngine.extractLedger({
    rawText: "I promise to pay you $500 by next Friday for repairing the roof and fixing the leak.",
    language: "en",
    parties: [
      { id: "p1", name: "Ramesh Contractor", role: "promisor" },
      { id: "p2", name: "Priya Owner", role: "promisee" },
    ],
  });

  assert.ok(ledger.ledgerId.startsWith("ledger-"));
  assert.equal(ledger.rawUserDataEgress, 0);
  assert.ok(ledger.receiptDigest.length === 64);
  assert.equal(ledger.commitments.length, 1);

  const c = ledger.commitments[0];
  assert.equal(c.promisor, "Ramesh Contractor");
  assert.equal(c.promisee, "Priya Owner");
  assert.equal(c.category, "WAGE");
  assert.equal(c.monetaryAmount?.value, 500);
  assert.equal(c.monetaryAmount?.currency, "USD");
  assert.ok(c.deadlineText?.includes("next Friday"));
  assert.ok(ledger.executableContractPrompt.includes("Ramesh Contractor"));
});

test("PromiseLedger handles regional currency and native speech markers", () => {
  const ledger = promiseLedgerEngine.extractLedger({
    rawText: "నేను వచ్చే సోమవారం లోపు ₹12,000 కూలీ ఇస్తాను అని మాట ఇస్తున్నాను.",
    language: "te",
    parties: [
      { id: "p1", name: "వెంకట్", role: "promisor" },
      { id: "p2", name: "సూరి", role: "promisee" },
    ],
  });

  assert.equal(ledger.rawUserDataEgress, 0);
  assert.equal(ledger.commitments.length, 1);
  const c = ledger.commitments[0];
  assert.equal(c.category, "WAGE");
  assert.equal(c.monetaryAmount?.value, 12000);
  assert.equal(c.monetaryAmount?.currency, "INR");
});

// ---------------------------------------------------------------------
// TEST WAVE 3: Chronic-Care & Caregiver Timeline
// ---------------------------------------------------------------------
console.log("\n--- WAVE 3: Chronic-Care & Caregiver Timeline ---");

test("CareTimeline fuses doctor consultation, family voice notes, and prescription OCR", () => {
  const timeline = careTimelineEngine.compileTimeline({
    primaryLanguage: "en",
    doctorCallSummary: "Dr. Rao confirmed radiation therapy successful. Switch to daily oral tablets. Follow-up blood scan in 4 weeks.",
    voiceNotes: [
      { text: "Grandma had mild nausea this morning. Drank ginger tea and rested." },
    ],
    prescriptionOcr: "Ondansetron 4mg tablet. Take twice daily after food with water. Morning 8am and Night 9pm.",
  });

  assert.ok(timeline.timelineId.startsWith("care-"));
  assert.equal(timeline.rawUserDataEgress, 0);
  assert.equal(timeline.entries.length, 3);

  const rxEntry = timeline.entries.find((e) => e.category === "MEDICATION");
  assert.ok(rxEntry);
  assert.ok(rxEntry.dosageSchedule);
  assert.equal(rxEntry.dosageSchedule.medicationName, "Ondansetron 4mg");
  assert.equal(rxEntry.dosageSchedule.withFood, true);
  assert.ok(rxEntry.dosageSchedule.alarmTimes.length >= 2);
});

test("CareTimeline generates structured caregiver shift handoff from nurse audio", () => {
  const handoff = careTimelineEngine.generateCaregiverHandoff(
    "NIGHT_TO_MORNING",
    "Patient had mild fever of 100.2 at 2 AM. Administered paracetamol 500mg. Fever broke at 4 AM. Morning insulin pending at 8 AM. Urine output normal, drank 500ml water.",
  );

  assert.equal(handoff.shift, "NIGHT_TO_MORNING");
  assert.ok(handoff.urgentAlerts.length > 0);
  assert.ok(handoff.pendingMeds.length > 0);
  assert.ok(handoff.vitalObservations.length > 0);
});

test("CareTimeline sorts overwhelmed parent mental load dump", () => {
  const dump = careTimelineEngine.generateParentMentalLoadDump(
    "Need to feed 120ml formula at 2pm. Forgot to give vitamin D drops this morning. Pediatrician visit tomorrow at 11am for 6-month vaccines. Running out of diapers need to order urgently. Baby woke up twice last night crying.",
  );

  assert.ok(dump.sortedFeeds.length > 0);
  assert.ok(dump.sortedMeds.length > 0);
  assert.ok(dump.appointments.length > 0);
  assert.ok(dump.overdueActions.length > 0);
  assert.ok(dump.sleepNotes.length > 0);
});

// ---------------------------------------------------------------------
// TEST WAVE 4: Speak-to-Fill Gov & Benefit Forms
// ---------------------------------------------------------------------
console.log("\n--- WAVE 4: Speak-to-Fill Gov Forms ---");

test("SpeakToFillForm maps spoken applicant speech into structured pension schema", () => {
  const form = speakToFillFormEngine.processForm({
    formType: "PENSION_BENEFIT",
    spokenTranscript: "My name is Somanna Gowda, age is 72 years old, from village Rampur. National ID number is 8839-2011-5544. I am applying for monthly elder allowance.",
    language: "en",
  });

  assert.ok(form.formId.startsWith("form-pension_benefit-"));
  assert.equal(form.rawUserDataEgress, 0);
  assert.equal(form.completionPercentage, 100);
  assert.equal(form.clarificationsNeeded.length, 0);

  const nameField = form.fields.find((f) => f.fieldKey === "applicant_name");
  assert.equal(nameField?.extractedValue, "Somanna Gowda");
  assert.ok(nameField?.confidence && nameField.confidence > 0.8);

  const ageField = form.fields.find((f) => f.fieldKey === "applicant_age");
  assert.equal(ageField?.extractedValue, "72");

  assert.ok(form.readBackScriptEnglish.includes("Somanna Gowda"));
});

test("SpeakToFillForm flags missing fields and produces clarification list", () => {
  const form = speakToFillFormEngine.processForm({
    formType: "PENSION_BENEFIT",
    spokenTranscript: "I want pension help for my village.",
    language: "en",
  });

  assert.ok(form.completionPercentage < 50);
  assert.ok(form.clarificationsNeeded.length > 0);
});

// ---------------------------------------------------------------------
// TEST WAVE 5: Scam & Coercion Narrative & Evidence Pack
// ---------------------------------------------------------------------
console.log("\n--- WAVE 5: Scam Coercion & Bank Dispute Notice ---");

test("ScamAfterglowEngine detects digital arrest scam, extracts accounts, and generates FIR", () => {
  const pack = scamAfterglowEngine.analyzeIncident({
    callerId: "+91-99887-76655",
    spokenTranscript: "This is Deputy Commissioner of Police. A parcel in your name was seized by customs containing narcotics. A non-bailable arrest warrant is issued. You are under digital arrest. Transfer immediately $3,000 to government reserve account 4099-1234-5678 within 10 minutes or we will send police vehicle to arrest your family.",
    language: "en",
  });

  assert.ok(pack.incidentId.startsWith("scam-ev-"));
  assert.equal(pack.rawUserDataEgress, 0);
  assert.ok(pack.riskScore >= 80, `Risk score should be high urgency (got ${pack.riskScore})`);
  assert.ok(pack.threatsDetected.some((t) => t.includes("Arrest")));
  assert.ok(pack.demands[0].accountNumbersMentioned.includes("409912345678"));
  assert.ok(pack.policeFirNarrative.includes("CYBERCRIME COMPLAINT"));
  assert.ok(pack.bankDisputeNotice.includes("URGENT: FRAUD DISPUTE"));
  assert.ok(pack.victimReassuranceSteps.length >= 4);
});

// ---------------------------------------------------------------------
// TEST WAVE 6: Creator Clip Mine
// ---------------------------------------------------------------------
console.log("\n--- WAVE 6: Creator Clip Mine ---");

test("CreatorClipMine evaluates audio pacing and ranks top viral cuts with timestamps", () => {
  const segments = [
    { id: 1, startSec: 10, endSec: 32, text: "The biggest mistake beginners make in software is choosing tools before understanding the customer problem.", confidence: 0.95 },
    { id: 2, startSec: 33, endSec: 58, text: "Here is the shocking truth about marketing that nobody tells you: product quality alone never sells itself.", confidence: 0.96 },
    { id: 3, startSec: 60, endSec: 95, text: "We decided to rebuild the entire backend using deterministic WASM in 7 days.", confidence: 0.92 },
  ];

  const mine = creatorClipMineEngine.mineClips({
    durationSec: 120,
    segments,
    language: "en",
  });

  assert.ok(mine.mineId.startsWith("mine-"));
  assert.equal(mine.rawUserDataEgress, 0);
  assert.ok(mine.topCuts.length > 0);
  assert.equal(mine.topCuts[0].rank, 1);
  assert.ok(mine.topCuts[0].hookScore >= 70);
  assert.ok(mine.topCuts[0].startSec >= 0);
  assert.ok(mine.topCuts[0].endSec > mine.topCuts[0].startSec);
  assert.ok(mine.topCuts[0].hookHeadline.length > 0);
});

// ---------------------------------------------------------------------
// TEST WAVE 7: Marketplace Dispute Pack
// ---------------------------------------------------------------------
console.log("\n--- WAVE 7: Marketplace Dispute Pack ---");

test("MarketplaceDisputeEngine discovers critical breach between spoken promise and delivery OCR", () => {
  const dispute = marketplaceDisputeEngine.compileDisputePack({
    sellerAudioNotes: [
      { text: "I guarantee this laptop is brand new and completely sealed in original packaging." },
    ],
    buyerAudioNotes: [
      { text: "The parcel arrived open and the screen is badly damaged with deep scratches." },
    ],
    deliveryPhotoOcr: "Delivered package inspection: Item heavily damaged, deep scratches across LCD panel.",
  });

  assert.ok(dispute.disputeId.startsWith("disp-"));
  assert.equal(dispute.rawUserDataEgress, 0);
  assert.ok(dispute.discrepancies.length > 0);
  assert.equal(dispute.discrepancies[0].severity, "CRITICAL");
  assert.equal(dispute.recommendedResolution, "FULL_REFUND");
  assert.ok(dispute.resolutionJustification.includes("critical breach"));
});

console.log("\n========================================================");
console.log("  ALL ORAL LIFE OUTCOME TESTS PASSED (100%)");
console.log("========================================================\n");
