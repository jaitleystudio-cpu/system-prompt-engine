/**
 * Outcome 3: Speak-to-Fill Government & Benefit Forms
 *
 * Solves the emerging-market exclusion barrier:
 * Digitization scanned paper into complex web portals, but billions of citizens
 * cannot type or are illiterate. Benefits, identity documents, crop loss claims,
 * and rural loans are lost to paperwork friction.
 *
 * This engine maps natural, conversational spoken speech into structured form
 * schemas, calculates field confidence, flags ambiguities, and generates an oral
 * read-back script in the citizen's native language for informed consent.
 */

import { computeSha256 } from "../../hashUtils";
import type { AsrTimestampSegment } from "../types";
import type { FormFieldExtraction, GovFormType, SpeakToFillForm } from "./types";

interface FormExtractionInput {
  formType: GovFormType;
  spokenSegments?: AsrTimestampSegment[];
  spokenTranscript?: string;
  language?: string;
}

export class SpeakToFillFormEngine {
  /**
   * Initializes or creates an empty/template form instance.
   */
  createFormInstance(formType: GovFormType, language: string = "en"): SpeakToFillForm {
    return this.processForm({ formType, language });
  }

  /**
   * Maps spoken speech into structured form fields.
   */
  processForm(input: FormExtractionInput): SpeakToFillForm {
    const formType = input.formType;
    const language = input.language || "en";
    const transcript =
      input.spokenTranscript ||
      input.spokenSegments?.map((s) => s.text).join(" ") ||
      "";

    const fields = this.extractFieldsForForm(formType, transcript, input.spokenSegments);
    const completedFields = fields.filter((f) => f.extractedValue.length > 0);
    const completionPercentage = Math.round(
      (completedFields.length / Math.max(1, fields.length)) * 100,
    );

    const clarificationsNeeded: string[] = fields
      .filter((f) => f.required && (f.extractedValue.length === 0 || f.needsClarification))
      .map((f) => `Missing or unclear: ${f.label}`);

    const readBackScriptEnglish = this.generateReadBackScript(
      formType,
      fields,
      "en",
    );
    const readBackScriptNative = this.generateReadBackScript(
      formType,
      fields,
      language,
    );

    const formId = `form-${formType.toLowerCase()}-${computeSha256(transcript).substring(0, 12)}`;
    const receiptDigest = computeSha256(
      JSON.stringify({
        formId,
        formType,
        language,
        fields,
        completionPercentage,
      }),
    );

    return {
      formId,
      formType,
      language,
      fields,
      completionPercentage,
      readBackScriptNative,
      readBackScriptEnglish,
      clarificationsNeeded,
      receiptDigest,
      rawUserDataEgress: 0,
      draftStatus: "DRAFT_ONLY",
      requiresHumanConfirmation: true,
      noAutonomousSubmission: true,
      negativeAuthorities: {
        noEligibilityDecision: true,
        noAutonomousSubmission: true,
      },
    };
  }

  private extractFieldsForForm(
    formType: GovFormType,
    transcript: string,
    segments?: AsrTimestampSegment[],
  ): FormFieldExtraction[] {
    const text = transcript.toLowerCase();
    const defaultStart = segments?.[0]?.startSec || 0;
    const defaultEnd = segments?.[segments.length - 1]?.endSec || 5;

    // Common standard schemas per form type
    switch (formType) {
      case "PENSION_BENEFIT":
      default: {
        const nameMatch = transcript.match(/(?:my name is|i am|mera naam|నా పేరు|me llamo)\s+([a-zA-Z\u0900-\u097F\u0C00-\u0C7F\s]{2,30})/i);
        const ageMatch = text.match(/(?:age|years old|saal|వయస్సు|años)\s*(?:is|of)?\s*(\d{2})/i) || text.match(/(\d{2})\s*(?:years old|saal|వయస్సు|años)/i);
        const villageMatch = transcript.match(/(?:village|town|gram|district|ఊరు|గామం|pueblo)\s*(?:is|of)?\s*([a-zA-Z\u0900-\u097F\u0C00-\u0C7F\s]{2,25})/i);
        const idMatch = text.match(/(?:aadhaar|id|curp|national id|number)\s*(?:is)?\s*([0-9\s-]{4,16})/i);

        return [
          {
            fieldKey: "applicant_name",
            label: "Applicant Full Name",
            extractedValue: nameMatch ? nameMatch[1].trim() : "",
            confidence: nameMatch ? 0.92 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !nameMatch,
            required: true,
          },
          {
            fieldKey: "applicant_age",
            label: "Applicant Age",
            extractedValue: ageMatch ? ageMatch[1].trim() : "",
            confidence: ageMatch ? 0.95 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !ageMatch,
            required: true,
          },
          {
            fieldKey: "residence_location",
            label: "Village / Town / Municipality",
            extractedValue: villageMatch ? villageMatch[1].trim() : "",
            confidence: villageMatch ? 0.88 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !villageMatch,
            required: true,
          },
          {
            fieldKey: "identity_number",
            label: "National ID / Certificate Number",
            extractedValue: idMatch ? idMatch[1].trim() : "",
            confidence: idMatch ? 0.94 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !idMatch,
            required: true,
          },
        ];
      }

      case "CROP_COMPENSATION": {
        const cropMatch = transcript.match(/(?:crop|harvest|cultivation|పంట|फसल|cultivo)\s*(?:is|was)?\s*([a-zA-Z\u0900-\u097F\u0C00-\u0C7F\s]{3,20})/i);
        const acreMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:acres|hectares|bigha|ఎకరాలు|एकड़)/i);
        const causeMatch = text.match(/(?:flood|drought|rain|pest|storm|తుఫాను|వర్షం|बाढ़|सूखा|lluvia)/i);

        return [
          {
            fieldKey: "crop_type",
            label: "Damaged Crop Type",
            extractedValue: cropMatch ? cropMatch[1].trim() : "",
            confidence: cropMatch ? 0.91 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !cropMatch,
            required: true,
          },
          {
            fieldKey: "land_size",
            label: "Affected Land Size",
            extractedValue: acreMatch ? acreMatch[0].trim() : "",
            confidence: acreMatch ? 0.93 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !acreMatch,
            required: true,
          },
          {
            fieldKey: "damage_cause",
            label: "Cause of Damage",
            extractedValue: causeMatch ? causeMatch[0].trim() : "",
            confidence: causeMatch ? 0.96 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !causeMatch,
            required: true,
          },
        ];
      }

      case "RURAL_LOAN": {
        const amountMatch = text.match(/(?:loan|amount|rs|inr|\$|₹|rupees|ऋण|అప్పు|కార్యకలాపాలు)\s*(?:is|of)?\s*([\d,.]+)/i);
        const purposeMatch = transcript.match(/(?:purpose|for|seeds|tractor|cattle|fertilizer|పంట|విత్తనాలు|బీజ|ట్రాక్టర్|tractor|semillas)\s*(?:is|for)?\s*([a-zA-Z\u0900-\u097F\u0C00-\u0C7F\s]{3,30})/i);
        const tenureMatch = text.match(/(\d+)\s*(?:months|years|saal|महीने|నెలలు|meses)/i);

        return [
          {
            fieldKey: "loan_amount",
            label: "Requested Loan Amount",
            extractedValue: amountMatch ? amountMatch[1].trim() : "",
            confidence: amountMatch ? 0.94 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !amountMatch,
            required: true,
          },
          {
            fieldKey: "loan_purpose",
            label: "Purpose of Micro-Loan",
            extractedValue: purposeMatch ? purposeMatch[1].trim() : "",
            confidence: purposeMatch ? 0.88 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !purposeMatch,
            required: true,
          },
          {
            fieldKey: "repayment_tenure",
            label: "Repayment Tenure",
            extractedValue: tenureMatch ? tenureMatch[0].trim() : "",
            confidence: tenureMatch ? 0.85 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: false,
            required: false,
          },
        ];
      }

      case "DISABILITY_CLAIM": {
        const disTypeMatch = transcript.match(/(?:disability|condition|locomotor|visual|hearing|दिव्यांग|వైకల్యం|discapacidad)\s*(?:is)?\s*([a-zA-Z\u0900-\u097F\u0C00-\u0C7F\s]{3,30})/i);
        const percentMatch = text.match(/(\d{1,3})\s*(?:%|percent|प्रतिशत|శాతం)/i);
        const certMatch = text.match(/(?:udid|certificate|card|number)\s*(?:is)?\s*([0-9a-zA-Z\s/-]{4,20})/i);

        return [
          {
            fieldKey: "disability_type",
            label: "Nature of Disability",
            extractedValue: disTypeMatch ? disTypeMatch[1].trim() : "",
            confidence: disTypeMatch ? 0.9 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !disTypeMatch,
            required: true,
          },
          {
            fieldKey: "disability_percentage",
            label: "Certified Disability Percentage",
            extractedValue: percentMatch ? `${percentMatch[1]}%` : "",
            confidence: percentMatch ? 0.95 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !percentMatch,
            required: true,
          },
          {
            fieldKey: "udid_certificate_number",
            label: "UDID / Medical Certificate Number",
            extractedValue: certMatch ? certMatch[1].trim() : "",
            confidence: certMatch ? 0.92 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !certMatch,
            required: true,
          },
        ];
      }

      case "HEALTH_INSURANCE": {
        const hospMatch = transcript.match(/(?:hospital|clinic|ఆసుపత్రి|अस्पताल|hôpital|hospital)\s*(?:is|at)?\s*([a-zA-Z\u0900-\u097F\u0C00-\u0C7F\s]{3,30})/i);
        const claimMatch = text.match(/(?:claim|bill|amount|ఖర్చు|खर्च|frais)\s*(?:is)?\s*([0-9,.]+)/i);
        const policyMatch = text.match(/(?:policy|card|ayushman|abha|insur|number)\s*(?:is)?\s*([0-9a-zA-Z\s/-]{4,20})/i);

        return [
          {
            fieldKey: "hospital_name",
            label: "Healthcare Provider / Hospital",
            extractedValue: hospMatch ? hospMatch[1].trim() : "",
            confidence: hospMatch ? 0.92 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !hospMatch,
            required: true,
          },
          {
            fieldKey: "claim_amount",
            label: "Insurance Claim Amount",
            extractedValue: claimMatch ? claimMatch[1].trim() : "",
            confidence: claimMatch ? 0.94 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !claimMatch,
            required: true,
          },
          {
            fieldKey: "policy_number",
            label: "Policy / Beneficiary ID Number",
            extractedValue: policyMatch ? policyMatch[1].trim() : "",
            confidence: policyMatch ? 0.91 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !policyMatch,
            required: true,
          },
        ];
      }

      case "IDENTITY_CERTIFICATE": {
        const appNameMatch = transcript.match(/(?:my name is|i am|mera naam|నా పేరు|me llamo)\s+([a-zA-Z\u0900-\u097F\u0C00-\u0C7F\s]{2,30})/i);
        const parentMatch = transcript.match(/(?:father|mother|parent|తండ్రి|पिता|padre|père)\s*(?:name is|is)?\s*([a-zA-Z\u0900-\u097F\u0C00-\u0C7F\s]{2,30})/i);
        const dobMatch = text.match(/(?:dob|born|birth|పుట్టిన తేదీ|जन्म)\s*(?:on|is)?\s*([0-9a-zA-Z\s/-]{4,20})/i);

        return [
          {
            fieldKey: "applicant_name",
            label: "Applicant Full Name",
            extractedValue: appNameMatch ? appNameMatch[1].trim() : "",
            confidence: appNameMatch ? 0.92 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !appNameMatch,
            required: true,
          },
          {
            fieldKey: "parent_name",
            label: "Parent / Guardian Name",
            extractedValue: parentMatch ? parentMatch[1].trim() : "",
            confidence: parentMatch ? 0.91 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !parentMatch,
            required: true,
          },
          {
            fieldKey: "date_of_birth",
            label: "Date of Birth",
            extractedValue: dobMatch ? dobMatch[1].trim() : "",
            confidence: dobMatch ? 0.93 : 0.0,
            audioProofStartSec: defaultStart,
            audioProofEndSec: defaultEnd,
            needsClarification: !dobMatch,
            required: true,
          },
        ];
      }
    }
  }

  private generateReadBackScript(
    formType: GovFormType,
    fields: FormFieldExtraction[],
    lang: string,
  ): string {
    const filled = fields.filter((f) => f.extractedValue.length > 0);
    const summaryItems = filled.map((f) => `${f.label}: ${f.extractedValue}`).join(". ");

    switch (lang) {
      case "te":
        return `మీరు చెప్పిన వివరాలు: ${formType} దరఖాస్తు కొరకు. ${summaryItems}. ఈ వివరాలు సరిగ్గా ఉన్నాయా? నిర్ధారించడానికి అవును అని చెప్పండి.`;
      case "hi":
        return `आपके द्वारा दी गई जानकारी: ${formType} आवेदन के लिए। ${summaryItems}। क्या यह सही है? पुष्टि के लिए हाँ बोलें।`;
      case "es":
        return `Resumen de su solicitud para ${formType}: ${summaryItems}. ¿Son correctos estos datos? Diga sí para confirmar.`;
      case "fr":
        return `Résumé de votre demande pour ${formType} : ${summaryItems}. Ces informations sont-elles exactes ? Dites oui pour confirmer.`;
      case "ar":
        return `ملخص طلبك لـ ${formType}: ${summaryItems}. هل هذه المعلومات صحيحة؟ قل نعم للتأكيد.`;
      case "zh":
        return `您提交的 ${formType} 申请摘要：${summaryItems}。此信息准确无误吗？确认请回答“是”。`;
      case "pt":
        return `Resumo da sua solicitação para ${formType}: ${summaryItems}. Essas informações estão corretas? Diga sim para confirmar.`;
      case "ru":
        return `Сводка вашей заявки на ${formType}: ${summaryItems}. Данные верны? Скажите да для подтверждения.`;
      case "de":
        return `Zusammenfassung Ihres Antrags für ${formType}: ${summaryItems}. Sind diese Angaben korrekt? Sagen Sie Ja zur Bestätigung.`;
      default:
        return `Summary for your ${formType} application: ${summaryItems}. Is this information correct? Say yes to confirm.`;
    }
  }
}

export const speakToFillFormEngine = new SpeakToFillFormEngine();
export const speakToFillEngine = speakToFillFormEngine;
