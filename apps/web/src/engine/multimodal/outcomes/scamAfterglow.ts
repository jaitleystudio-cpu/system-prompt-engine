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
import { parseDialogueTurns } from "./globalLanguages";
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

    // Analyze Coercion Patterns across multi-turn dialogues
    const turns = parseDialogueTurns(text);
    let riskScore = 10;

    const lowerText = text.toLowerCase();

    // Threat 1: Law Enforcement Impersonation & Digital Arrest
    if (/arrest|jail|police|cbi|fbi|court|customs|warrant|prison|fir|narcotics|dhl parcel|fedex illegal|गिरफ्तार|పోలీస్|கைது/i.test(text)) {
      threatsDetected.push("Legal Arrest / Law Enforcement Impersonation Threat");
      riskScore += 35;
    }

    // Threat 2: Account Suspension & Freezing
    if (/frozen|block|bank account|suspend|debit card|kyc|deactivation|seized|अकाउंट ब्लॉक|ఖాతా బ్లాక్/i.test(text)) {
      threatsDetected.push("Financial Account Suspension Threat");
      riskScore += 25;
    }

    // Threat 3: Credential & OTP Extortion
    if (/otp|pin|password|cvv|one time password|verification code|ओटीपी|పాస్‌వర్డ్/i.test(text)) {
      threatsDetected.push("Urgent Credential / OTP Extortion");
      riskScore += 30;
    }

    // Threat 4: Psychological Confinement / Urgency
    if (/immediately|within 10 minutes|within 15 minutes|do not hang up|stay on camera|digital arrest|surveillance|disconnecting means arrest/i.test(text)) {
      threatsDetected.push("Digital Confinement / Urgent Psychological Coercion");
      riskScore += 20;
    }

    // Threat 5: Money Transfer Extortion
    if (/transfer|deposit|send money|reserve account|security deposit|bribe|wire|penalty fee|clearance fee|पेमेंट|డబ్బులు|பணம்/i.test(text)) {
      threatsDetected.push("Extortionate Money Transfer Demand");
      riskScore += 25;
    }

    riskScore = Math.min(100, riskScore);

    // Extract Account & Phone Numbers & UPI IDs
    const accountMatches = text.match(/\b(?:\d[ -]?){9,18}\d\b/g) || [];
    const cleanAccounts = Array.from(new Set(accountMatches.map((a) => a.replace(/[\s-]/g, ""))));

    // Extract Phone Numbers
    const phoneMatches = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g) || [];
    const cleanPhones = Array.from(
      new Set([
        ...(input.callerId ? [input.callerId] : []),
        ...phoneMatches.map((p) => p.trim()).filter((p) => p.replace(/\D/g, "").length >= 7),
      ]),
    );

    // Extract UPI IDs (e.g. name@okhdfcbank, scammer@upi, verify@paytm)
    const upiMatches = text.match(/\b[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}\b/g) || [];
    const cleanUpis = Array.from(new Set(upiMatches.map((u) => u.toLowerCase())));

    // Extract Demanded Amounts
    const moneyMatch = text.match(/(?:[$€£₹]|rs\.?|usd|inr|eur|gbp|aed)\s*(\d+(?:,\d+)?)/i);
    const amountDemanded = moneyMatch ? moneyMatch[0] : undefined;

    // Build Demands from detected threats and turns
    if (threatsDetected.length > 0) {
      if (turns.length > 1) {
        // Multi-turn coercion breakdown
        turns.forEach((turn, idx) => {
          const tLower = turn.text.toLowerCase();
          const hasCoercion =
            /arrest|jail|block|otp|transfer|money|camera|immediately|police|cbi/i.test(tLower);
          if (hasCoercion) {
            demands.push({
              id: `demand-${idx + 1}`,
              type: /arrest|police|cbi|customs/i.test(tLower)
                ? "DIGITAL_ARREST"
                : /otp|pin|password/i.test(tLower)
                  ? "OTP_REQUEST"
                  : "EXTORTION_MONEY",
              details: turn.text.substring(0, 200),
              amountDemanded,
              accountNumbersMentioned: cleanAccounts,
              phoneNumbersMentioned: cleanPhones,
              upiIdsMentioned: cleanUpis,
              urgencyKeywords: ["immediate", "freeze", "arrest", "within 15 minutes"],
              audioStartSec: input.segments?.[idx]?.startSec || idx * 10,
              audioEndSec: input.segments?.[idx]?.endSec || (idx + 1) * 10,
              turnIndex: idx + 1,
            });
          }
        });
      }

      if (demands.length === 0) {
        demands.push({
          id: "demand-1",
          type: lowerText.includes("arrest")
            ? "DIGITAL_ARREST"
            : lowerText.includes("otp")
              ? "OTP_REQUEST"
              : "EXTORTION_MONEY",
          details: text.substring(0, 200),
          amountDemanded,
          accountNumbersMentioned: cleanAccounts,
          phoneNumbersMentioned: cleanPhones,
          upiIdsMentioned: cleanUpis,
          urgencyKeywords: ["immediate", "freeze", "arrest", "within 15 minutes"],
          audioStartSec: input.segments?.[0]?.startSec || 0,
          audioEndSec: input.segments?.[input.segments.length - 1]?.endSec || 30,
        });
      }
    }

    // Determine Statutory Penal Sections
    const statutorySections: string[] = [];
    if (threatsDetected.some((t) => t.includes("Impersonation"))) {
      statutorySections.push("BNS § 204 / IPC § 170 (Impersonating a public servant)");
      statutorySections.push("IT Act 2000 § 66D (Cheating by personation using computer resource)");
    }
    if (threatsDetected.some((t) => t.includes("Extortion") || t.includes("Confinement"))) {
      statutorySections.push("BNS § 308 / IPC § 384 (Extortion)");
      statutorySections.push("BNS § 351 (Criminal Intimidation)");
    }
    if (threatsDetected.some((t) => t.includes("OTP") || t.includes("Financial") || t.includes("Transfer"))) {
      statutorySections.push("BNS § 318(4) / IPC § 420 (Cheating and dishonestly inducing delivery)");
      statutorySections.push("IT Act 2000 § 66C (Identity theft / Credential fraud)");
    }
    statutorySections.push("Cross-Border / US Counterpart: 18 U.S.C. § 1343 (Wire Fraud)");

    const incidentId = `scam-ev-${computeSha256(text).substring(0, 12)}`;
    const recordedAt = new Date().toISOString();

    const policeFirNarrative = this.generatePoliceFir(
      incidentId,
      recordedAt,
      input.callerId || cleanPhones[0] || "Unknown Imposter",
      threatsDetected,
      cleanAccounts,
      cleanPhones,
      cleanUpis,
      amountDemanded,
      statutorySections,
      text,
      turns,
    );

    const bankDisputeNotice = this.generateBankNotice(
      incidentId,
      cleanAccounts,
      cleanUpis,
      amountDemanded,
    );

    const victimReassuranceSteps = this.getLocalizedReassuranceSteps(language);

    const receiptDigest = computeSha256(
      JSON.stringify({
        incidentId,
        riskScore,
        threatCount: threatsDetected.length,
        cleanAccounts,
        cleanPhones,
        cleanUpis,
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
      statutorySections,
      draftStatus: "DRAFT_ONLY",
      requiresHumanConfirmation: true,
      noAutonomousSubmission: true,
      noLegalConclusion: true,
      noBankingAuthority: true,
      safetyDisclaimer:
        "DRAFT ONLY: Narrative assistance for statutory FIR reporting and bank dispute. Does not constitute formal legal counsel, filed report, or autonomous banking transaction authority. Must be reviewed and submitted manually by victim or legal advocate.",
      receiptDigest,
      rawUserDataEgress: 0,
    };
  }

  /**
   * High-consequence safety invariant: autonomous submission is strictly blocked.
   */
  attemptAutonomousSubmission(_pack: ScamCoercionPack): never {
    throw new Error(
      "SAFETY VIOLATION: Autonomous submission of high-consequence police FIR or bank dispute notice is strictly blocked. Human confirmation is mandatory under SPE Law.",
    );
  }

  private generatePoliceFir(
    id: string,
    time: string,
    caller: string,
    threats: string[],
    accounts: string[],
    phones: string[],
    upis: string[],
    amount: string | undefined,
    statutorySections: string[],
    rawText: string,
    turns: Array<{ speaker: string; text: string }>,
  ): string {
    const turnBreakdown = turns.length > 1
      ? `\nCHRONOLOGICAL DIALOGUE BREAKDOWN:\n` +
        turns.map((t, idx) => `[Turn ${idx + 1}] ${t.speaker}: "${t.text}"`).join("\n")
      : "";

    return `CYBERCRIME COMPLAINT & INCIDENT REPORT (EVIDENCE ATTACHED)
Reference ID: ${id}
Incident Date/Time: ${time}
Reported Suspect / Caller: ${caller}
Suspect Phone Numbers: ${phones.length > 0 ? phones.join(", ") : caller}

NATURE OF OFFENSE:
${threats.map((t) => `- ${t}`).join("\n")}

STATUTORY PROVISIONS INVOKED:
${statutorySections.map((s) => `- ${s}`).join("\n")}

SUSPECT FINANCIAL DETAILS EXTRACTED:
- Demanded Sum: ${amount || "Demanded immediate financial transfer"}
- Destination Account(s) Mentioned: ${accounts.length > 0 ? accounts.join(", ") : "None disclosed"}
- Destination UPI Handle(s): ${upis.length > 0 ? upis.join(", ") : "None disclosed"}
${turnBreakdown}

TRANSCRIPT OF COERCIVE STATEMENTS:
"${rawText.substring(0, 300)}..."

COMPLAINANT STATEMENT:
The suspect falsely impersonated authority, exerted unlawful psychological coercion, and attempted financial extortion. Immediate blocking of the beneficiary accounts/UPI handles and tracing of the origin number is requested.`;
  }

  private generateBankNotice(
    id: string,
    accounts: string[],
    upis: string[],
    amount: string | undefined,
  ): string {
    return `URGENT: FRAUD DISPUTE & BENEFICIARY FREEZE REQUEST
Reference: SPE-FRAUD-${id}
Timestamp: ${new Date().toISOString()}

To: Fraud Operations & Risk Division
Subject: Suspected Coercive Fraud / Unauthorized Transfer Interception

Please take notice that an extortionate interaction has been detected and logged with cryptographic timestamp proof.
Suspect Accounts for Immediate Interception: ${accounts.join(", ") || "Under Investigation"}
Suspect UPI Handles for Interception: ${upis.join(", ") || "Under Investigation"}
Disputed Sum: ${amount || "Pending reconciliation"}

Action Requested:
1. Immediate hold on any outgoing or incoming transfers to beneficiary accounts.
2. Instant suspension and blacklist of identified suspect UPI handles.
3. Reversal of pending wire/clearing house settlements.`;
  }

  private getLocalizedReassuranceSteps(language: string): string[] {
    const lang = (language || "en").toLowerCase().slice(0, 2);
    if (lang === "hi") {
      return [
        "1. कोई भी पैसा ट्रांसफर न करें और ओटीपी/पासवर्ड साझा न करें।",
        "2. असली पुलिस, अदालतें या बैंक कभी भी वीडियो कॉल पर डिजिटल अरेस्ट नहीं करते और न ही पैसे मांगते हैं।",
        "3. तुरंत कॉल काट दें और कॉलर को ब्लॉक करें।",
        "4. तैयार की गई पुलिस एफआईआर रिपोर्ट को cybercrime.gov.in या स्थानीय थाने में जमा करें।",
        "5. यदि कोई धनराशि ट्रांसफर हुई है तो तुरंत अपने बैंक को नोटिस देकर खाता फ्रीज कराएं।",
      ];
    }
    if (lang === "te") {
      return [
        "1. ఎటువంటి డబ్బు బదిలీ చేయవద్దు మరియు ఓటీపీ లేదా పాస్‌వర్డ్ చెప్పవద్దు.",
        "2. నిజమైన పోలీసులు, కోర్టులు లేదా బ్యాంకులు ఎప్పుడూ డిజిటల్ అరెస్ట్ చేయవు, వీడియో కాల్‌లో డబ్బు డిమాండ్ చేయవు.",
        "3. వెంటనే కాల్ కట్ చేసి నంబర్ బ్లాక్ చేయండి.",
        "4. తయారు చేసిన ఫిర్యాదును సైబర్ క్రైమ్ పోర్టల్ లేదా పోలీస్ స్టేషన్‌లో సమర్పించండి.",
        "5. ఏదైనా సొమ్ము బదిలీ అయితే వెంటనే బ్యాంక్ ఖాతా ఫ్రీజ్ చేయాలని బ్యాంకును సంప్రదించండి.",
      ];
    }
    if (lang === "es") {
      return [
        "1. NO transfiera dinero ni proporcione códigos OTP o contraseñas.",
        "2. La policía o bancos legítimos NUNCA realizan arrestos digitales ni exigen dinero por videollamada.",
        "3. Cuelgue la llamada de inmediato y bloquee el número.",
        "4. Presente el informe policial generado ante las autoridades de delitos cibernéticos.",
        "5. Comuníquese de inmediato con su banco para congelar transacciones sospechosas.",
      ];
    }
    return [
      "1. Do NOT transfer any money or provide OTP/passwords.",
      "2. Genuine police, courts, and banks NEVER conduct digital arrests or demand money over Skype/WhatsApp.",
      "3. Disconnect the call immediately and block the caller.",
      "4. Submit the generated Police Narrative to your local cybercrime portal.",
      "5. Contact your bank immediately using the generated Bank Dispute Notice if any funds were transferred.",
    ];
  }
}

export const scamAfterglowEngine = new ScamAfterglowEngine();
