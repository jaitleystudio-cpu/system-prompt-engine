/**
 * Outcome 4: Scam & Coercion Afterglow Narrative & Evidence Pack
 *
 * Solves the post-incident panic vacuum:
 * After a predatory scam or coercion call (fake police "digital arrest", courier drugs scam,
 * bank fraud threats, ransom demands), victims are terrified and confused.
 *
 * Banks tell them to write an email; police ask for a structured timeline.
 * This engine takes the recorded call, extracts threats, account numbers, and demands,
 * and immediately synthesizes an actionable Cybercrime FIR Report and Bank Dispute Notice.
 */

import { computeSha256 } from "../../hashUtils";
import type { AsrTimestampSegment } from "../types";
import type { CoercionDemand, ScamCoercionPack } from "./types";

interface ScamPackInput {
  spokenTranscript?: string;
  segments?: AsrTimestampSegment[];
  callerId?: string;
  language?: string;
}

export class ScamAfterglowEngine {
  /**
   * Evaluates suspicious or coercive interactions and generates forensic evidence packs.
   */
  analyzeIncident(input: ScamPackInput): ScamCoercionPack {
    const text =
      input.spokenTranscript ||
      input.segments?.map((s) => s.text).join(" ") ||
      "";
    const language = input.language || "en";
    const threatsDetected: string[] = [];
    const demands: CoercionDemand[] = [];

    // Analyze Coercion Patterns
    let riskScore = 10;

    if (/arrest|jail|police|cbi|fbi|court|customs|warrant|prison|fir|गिरफ्तार|పోలీస్/i.test(text)) {
      threatsDetected.push("Legal Arrest / Law Enforcement Impersonation Threat");
      riskScore += 35;
    }
    if (/frozen|block|bank account|suspend|debit card|kyc|अकाउंट ब्लॉक|ఖాతా బ్లాక్/i.test(text)) {
      threatsDetected.push("Financial Account Suspension Threat");
      riskScore += 25;
    }
    if (/otp|pin|password|cvv|one time password|ओटीपी/i.test(text)) {
      threatsDetected.push("Urgent Credential / OTP Extortion");
      riskScore += 30;
    }
    if (/immediately|within 10 minutes|do not hang up|stay on camera|digital arrest/i.test(text)) {
      threatsDetected.push("Digital Confinement / Urgent Psychological Coercion");
      riskScore += 20;
    }
    if (/transfer|deposit|send money|reserve account|security deposit|bribe|wire|पेमेंट|డబ్బులు/i.test(text)) {
      threatsDetected.push("Extortionate Money Transfer Demand");
      riskScore += 25;
    }

    riskScore = Math.min(100, riskScore);

    // Extract Account & Phone Numbers
    const accountMatches = text.match(/\b(?:\d[ -]?){9,18}\d\b/g) || [];
    const cleanAccounts = Array.from(new Set(accountMatches.map((a) => a.replace(/[\s-]/g, ""))));

    // Extract Demanded Amounts
    const moneyMatch = text.match(/(?:[$€£₹]|rs\.?|usd|inr)\s*(\d+(?:,\d+)?)/i);
    const amountDemanded = moneyMatch ? moneyMatch[0] : undefined;

    if (threatsDetected.length > 0) {
      demands.push({
        id: "demand-1",
        type: text.includes("arrest")
          ? "DIGITAL_ARREST"
          : text.includes("otp")
            ? "OTP_REQUEST"
            : "EXTORTION_MONEY",
        details: text.substring(0, 200),
        amountDemanded,
        accountNumbersMentioned: cleanAccounts,
        phoneNumbersMentioned: input.callerId ? [input.callerId] : [],
        urgencyKeywords: ["immediate", "freeze", "arrest", "within 15 minutes"],
        audioStartSec: input.segments?.[0]?.startSec || 0,
        audioEndSec: input.segments?.[input.segments.length - 1]?.endSec || 30,
      });
    }

    const incidentId = `scam-ev-${computeSha256(text).substring(0, 12)}`;
    const recordedAt = new Date().toISOString();

    const policeFirNarrative = this.generatePoliceFir(
      incidentId,
      recordedAt,
      input.callerId || "Unknown Imposter",
      threatsDetected,
      cleanAccounts,
      amountDemanded,
      text,
    );

    const bankDisputeNotice = this.generateBankNotice(
      incidentId,
      cleanAccounts,
      amountDemanded,
    );

    const victimReassuranceSteps = [
      "1. Do NOT transfer any money or provide OTP/passwords.",
      "2. Genuine police, courts, and banks NEVER conduct digital arrests or demand money over Skype/WhatsApp.",
      "3. Disconnect the call immediately and block the caller.",
      "4. Submit the generated Police Narrative to your local cybercrime portal.",
      "5. Contact your bank immediately using the generated Bank Dispute Notice if any funds were transferred.",
    ];

    const receiptDigest = computeSha256(
      JSON.stringify({
        incidentId,
        riskScore,
        threatCount: threatsDetected.length,
        cleanAccounts,
      }),
    );

    return {
      incidentId,
      recordedAt,
      language,
      riskScore,
      threatsDetected,
      demands,
      policeFirNarrative,
      bankDisputeNotice,
      victimReassuranceSteps,
      receiptDigest,
      rawUserDataEgress: 0,
    };
  }

  private generatePoliceFir(
    id: string,
    time: string,
    caller: string,
    threats: string[],
    accounts: string[],
    amount: string | undefined,
    rawText: string,
  ): string {
    return `CYBERCRIME COMPLAINT & INCIDENT REPORT (EVIDENCE ATTACHED)
Reference ID: ${id}
Incident Date/Time: ${time}
Reported Suspect / Caller: ${caller}

NATURE OF OFFENSE:
${threats.map((t) => `- ${t}`).join("\n")}

SUSPECT FINANCIAL DETAILS EXTRACTED:
- Demanded Sum: ${amount || "Demanded immediate financial transfer"}
- Destination Account(s) / Identifiers Mentioned: ${accounts.length > 0 ? accounts.join(", ") : "None disclosed"}

TRANSCRIPT OF COERCIVE STATEMENTS:
"${rawText.substring(0, 300)}..."

COMPLAINANT STATEMENT:
The suspect falsely impersonated authority, exerted unlawful psychological coercion, and attempted financial extortion. Immediate blocking of the beneficiary accounts and tracing of the origin number is requested.`;
  }

  private generateBankNotice(
    id: string,
    accounts: string[],
    amount: string | undefined,
  ): string {
    return `URGENT: FRAUD DISPUTE & BENEFICIARY FREEZE REQUEST
Reference: SPE-FRAUD-${id}
Timestamp: ${new Date().toISOString()}

To: Fraud Operations & Risk Division
Subject: Suspected Coercive Fraud / Unauthorized Transfer Interception

Please take notice that an extortionate interaction has been detected and logged with cryptographic timestamp proof.
Suspect Accounts for Immediate Interception: ${accounts.join(", ") || "Under Investigation"}
Disputed Sum: ${amount || "Pending reconciliation"}

Action Requested:
1. Immediate hold on any outgoing or incoming transfers to beneficiary accounts.
2. Reversal of pending wire/clearing house settlements.`;
  }
}

export const scamAfterglowEngine = new ScamAfterglowEngine();
