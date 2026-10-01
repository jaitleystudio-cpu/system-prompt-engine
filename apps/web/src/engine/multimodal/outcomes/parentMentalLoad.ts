/**
 * MM-Ω Outcome Engine: New-Parent Mental-Load Organizer
 *
 * Converts rapid, unstructured spoken venting / streams of consciousness
 * into clean, prioritized, stress-reducing action buckets:
 * - Urgent & Overdue Actions (Immediate)
 * - Feeds & Nursing
 * - Medications & Vitamins
 * - Pediatrician & Vaccination Appointments
 * - Supplies & Restock Needs
 * - Partner / Co-Caregiver Delegation
 *
 * INVARIANTS:
 * - RAW_USER_DATA_EGRESS = 0
 * - 100% offline, private, zero judgment.
 */

import { computeSha256 } from "../../hashUtils";

export interface ParentActionItem {
  id: string;
  category: "FEEDS" | "MEDS" | "APPOINTMENTS" | "URGENT_OVERDUE" | "SUPPLIES" | "PARTNER_DELEGATION";
  description: string;
  targetTime?: string;
  priority: "HIGH" | "MEDIUM" | "NORMAL";
  status: "PENDING" | "DONE";
}

export interface ParentMentalLoadSummary {
  summaryId: string;
  totalItems: number;
  urgentCount: number;
  calmingReadbackText: string;
  feeds: ParentActionItem[];
  meds: ParentActionItem[];
  appointments: ParentActionItem[];
  urgentOverdue: ParentActionItem[];
  supplies: ParentActionItem[];
  partnerDelegation: ParentActionItem[];
  receiptDigest: string;
  createdAt: string;
  rawUserDataEgress: 0;
}

export class ParentMentalLoadEngine {
  sortMentalDump(spokenRant: string, language: string = "en"): ParentMentalLoadSummary {
    const text = spokenRant.trim();
    const sentences = text
      .split(/(?<=[.?!,\n])\s+|\s+(?:and\s+then|and\s+also|and\s+we|and\s+i|and\s+need|and\s+my|and\s+you|and\s+the|also|plus|then)\s+/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);

    const feeds: ParentActionItem[] = [];
    const meds: ParentActionItem[] = [];
    const appointments: ParentActionItem[] = [];
    const urgentOverdue: ParentActionItem[] = [];
    const supplies: ParentActionItem[] = [];
    const partnerDelegation: ParentActionItem[] = [];

    let idCounter = 1;

    for (const s of sentences) {
      const lower = s.toLowerCase();
      const id = `item-${idCounter++}`;

      const isHighPriority =
        lower.includes("urgent") ||
        lower.includes("emergency") ||
        lower.includes("fever") ||
        lower.includes("forgot") ||
        lower.includes("overdue") ||
        lower.includes("immediately");

      // Check Partner Delegation first if speaker delegates to spouse/partner
      if (
        /ask\s+[A-Za-z]+|tell\s+(?:my\s+)?(?:husband|wife|partner|spouse|dad|mom|grandma)|delegate|can\s+you\s+(?:pick|get|handle)|husband\s+will|partner\s+should|ఆయనకి|చెప్పు|पति\s+को|पत्नी\s+को|dile\s+a/i.test(
          lower,
        )
      ) {
        partnerDelegation.push({
          id,
          category: "PARTNER_DELEGATION",
          description: s,
          priority: isHighPriority ? "HIGH" : "NORMAL",
          status: "PENDING",
        });
      } else if (lower.includes("fever") || lower.includes("emergency")) {
        urgentOverdue.push({
          id,
          category: "URGENT_OVERDUE",
          description: s,
          priority: "HIGH",
          status: "PENDING",
        });
      } else if (
        lower.includes("doctor") ||
        lower.includes("pediatrician") ||
        lower.includes("clinic") ||
        lower.includes("vaccine") ||
        lower.includes("appointment") ||
        lower.includes("checkup")
      ) {
        appointments.push({
          id,
          category: "APPOINTMENTS",
          description: s,
          priority: isHighPriority ? "HIGH" : "MEDIUM",
          status: "PENDING",
        });
      } else if (
        lower.includes("feed") ||
        lower.includes("milk") ||
        lower.includes("formula") ||
        lower.includes("nurse") ||
        lower.includes("oz") ||
        lower.includes("bottle")
      ) {
        feeds.push({
          id,
          category: "FEEDS",
          description: s,
          priority: isHighPriority ? "HIGH" : "NORMAL",
          status: "PENDING",
        });
      } else if (
        lower.includes("drop") ||
        lower.includes("vitamin") ||
        lower.includes("med") ||
        lower.includes("syrup") ||
        lower.includes("dose") ||
        lower.includes("tylenol") ||
        lower.includes("calpol")
      ) {
        meds.push({
          id,
          category: "MEDS",
          description: s,
          priority: isHighPriority ? "HIGH" : "NORMAL",
          status: "PENDING",
        });
      } else if (
        lower.includes("buy") ||
        lower.includes("diaper") ||
        lower.includes("wipe") ||
        lower.includes("cream") ||
        lower.includes("ran out") ||
        lower.includes("grocery")
      ) {
        supplies.push({
          id,
          category: "SUPPLIES",
          description: s,
          priority: isHighPriority ? "HIGH" : "NORMAL",
          status: "PENDING",
        });
      } else if (isHighPriority) {
        urgentOverdue.push({
          id,
          category: "URGENT_OVERDUE",
          description: s,
          priority: "HIGH",
          status: "PENDING",
        });
      } else {
        supplies.push({
          id,
          category: "SUPPLIES",
          description: s,
          priority: "NORMAL",
          status: "PENDING",
        });
      }
    }

    const total =
      feeds.length +
      meds.length +
      appointments.length +
      urgentOverdue.length +
      supplies.length +
      partnerDelegation.length;

    let calming = "";
    if (language.startsWith("hi")) {
      calming = `चिंता मत कीजिए, हमने आपकी सारी बातें ${total} ज़रूरी कामों में सुलझा दी हैं। सबसे पहले ${urgentOverdue.length} ज़रूरी कामों पर ध्यान दें${partnerDelegation.length > 0 ? ` और ${partnerDelegation.length} काम अपने साथी को सौंप दें` : ""}।`;
    } else if (language.startsWith("te")) {
      calming = `ఆందోళన చెందకండి, మీ ఆలోచనలను ${total} ముఖ్యమైన పనులుగా విభజించాము. మొదట ${urgentOverdue.length} అత్యవసర పనులను పూర్తి చేయండి${partnerDelegation.length > 0 ? ` మరియు ${partnerDelegation.length} పనులను సహాయకుడికి అప్పగించండి` : ""}.`;
    } else if (language.startsWith("es")) {
      calming = `Tranquilo(a), hemos organizado tus pensamientos en ${total} tareas claras. Primero atiende los ${urgentOverdue.length} asuntos urgentes${partnerDelegation.length > 0 ? ` y delega ${partnerDelegation.length} tareas a tu pareja` : ""}.`;
    } else {
      calming = `Take a deep breath. We sorted your thoughts into ${total} organized tasks. You have ${urgentOverdue.length} urgent items to handle first${partnerDelegation.length > 0 ? `, and ${partnerDelegation.length} items ready to delegate to your partner` : ""}.`;
    }

    const receiptDigest = computeSha256(
      `PARENT-DUMP:${text}:${total}:${urgentOverdue.length}:${partnerDelegation.length}`,
    );

    return {
      summaryId: `parent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      totalItems: total,
      urgentCount: urgentOverdue.length,
      calmingReadbackText: calming,
      feeds,
      meds,
      appointments,
      urgentOverdue,
      supplies,
      partnerDelegation,
      receiptDigest,
      createdAt: new Date().toISOString(),
      rawUserDataEgress: 0,
    };
  }
}

export const parentMentalLoadEngine = new ParentMentalLoadEngine();
