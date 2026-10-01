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
    }
  }

  private generateReadBackScript(
    formType: GovFormType,
    fields: FormFieldExtraction[],
    lang: string,
  ): string {
    const filled = fields.filter((f) => f.extractedValue.length > 0);
    const summaryItems = filled.map((f) => `${f.label}: ${f.extractedValue}`).join(". ");

    if (lang === "te") {
      return `మీరు చెప్పిన వివరాలు: ${formType} దరఖాస్తు కొరకు. ${summaryItems}. ఈ వివరాలు సరిగ్గా ఉన్నాయా? నిర్ధారించడానికి అవును అని చెప్పండి.`;
    }
    if (lang === "hi") {
      return `आपके द्वारा दी गई जानकारी: ${formType} आवेदन के लिए। ${summaryItems}। क्या यह सही है? पुष्टि के लिए हाँ बोलें।`;
    }
    if (lang === "es") {
      return `Resumen de su solicitud para ${formType}: ${summaryItems}. ¿Son correctos estos datos? Diga sí para confirmar.`;
    }

    return `Summary for your ${formType} application: ${summaryItems}. Is this information correct? Say yes to confirm.`;
  }
}

export const speakToFillFormEngine = new SpeakToFillFormEngine();
