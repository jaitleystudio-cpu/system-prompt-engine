/**
 * Outcome 6: Marketplace Dispute Pack ("What was Promised vs What was Delivered")
 *
 * Solves informal commerce dispute deadlock:
 * Billions in commerce occur over WhatsApp voice notes, Facebook marketplace,
 * freelance gigs, and local delivery. When an item arrives broken, counterfeit, or wrong,
 * parties argue in chaotic chats.
 *
 * This engine cross-references spoken seller promises against buyer voice claims
 * and delivery photo OCR, outputting an unalterable evidence dossier with an
 * objective resolution recommendation.
 */

import { computeSha256 } from "../../hashUtils";
import type { OcrResult } from "../types";
import type { DiscrepancyItem, MarketplaceDisputePack } from "./types";

interface DisputeInput {
  sellerAudioNotes?: { text: string; startSec?: number; endSec?: number }[];
  buyerAudioNotes?: { text: string; startSec?: number; endSec?: number }[];
  deliveryPhotoOcr?: OcrResult | string;
  itemDescription?: string;
}

export class MarketplaceDisputeEngine {
  /**
   * Reconciles spoken buyer/seller promises against delivered goods proof.
   */
  compileDisputePack(input: DisputeInput): MarketplaceDisputePack {
    const sellerPromises = input.sellerAudioNotes?.map((n) => n.text) || [];
    const buyerClaims = input.buyerAudioNotes?.map((n) => n.text) || [];
    const photoText =
      typeof input.deliveryPhotoOcr === "string"
        ? input.deliveryPhotoOcr
        : input.deliveryPhotoOcr?.fullText || "";

    const combinedProof = `${photoText} ${buyerClaims.join(" ")}`.toLowerCase();
    const discrepancies: DiscrepancyItem[] = [];

    // Analyze mismatches across key commercial dimensions
    sellerPromises.forEach((promise, idx) => {
      const lowerPromise = promise.toLowerCase();

      // Dimension 1: Condition & Quality (New / Sealed vs Used / Damaged / Broken)
      if (/new|sealed|original|unopened|flawless|mint condition|కొత్త|नया|nuevo|neuf|novo/i.test(lowerPromise)) {
        if (
          /used|scratched|broken|damaged|dent|cracked|shattered|wear|పాడైపోయింది|खराब|usado|cassé/i.test(combinedProof)
        ) {
          discrepancies.push({
            id: `disc-condition-${idx + 1}`,
            feature: "Condition & Physical Integrity",
            spokenPromise: promise,
            spokenAudioStartSec: input.sellerAudioNotes?.[idx]?.startSec || 0,
            spokenAudioEndSec: input.sellerAudioNotes?.[idx]?.endSec || 10,
            actualDeliveredEvidence: photoText || "Delivered photo evidence shows structural damage or prior wear.",
            discrepancyType: "DAMAGED",
            severity: "CRITICAL",
          });
        }
      }

      // Dimension 2: Authenticity & Genuine Brand vs Counterfeit
      if (/genuine|authentic|100% original|certified|brand new in box|asli|అసలైన/i.test(lowerPromise)) {
        if (/fake|counterfeit|replica|copy|clone|nakli|నకిలీ|falso/i.test(combinedProof)) {
          discrepancies.push({
            id: `disc-auth-${idx + 1}`,
            feature: "Authenticity & Genuine Brand",
            spokenPromise: promise,
            spokenAudioStartSec: input.sellerAudioNotes?.[idx]?.startSec || 0,
            spokenAudioEndSec: input.sellerAudioNotes?.[idx]?.endSec || 10,
            actualDeliveredEvidence: "Item inspection indicates non-genuine counterfeit markings.",
            discrepancyType: "MISMATCH",
            severity: "CRITICAL",
          });
        }
      }

      // Dimension 3: Model, Capacity, Color, or Size Mismatch
      const capacityPromise = lowerPromise.match(/\b(64gb|128gb|256gb|512gb|1tb)\b/i)?.[1];
      const capacityInProof = combinedProof.match(/\b(64gb|128gb|256gb|512gb|1tb)\b/i)?.[1];
      const hasCapacityMismatch =
        Boolean(capacityPromise && capacityInProof && capacityPromise.toLowerCase() !== capacityInProof.toLowerCase());

      if (
        hasCapacityMismatch ||
        ((/blue|red|black|white|silver|gold|xl|large|small|medium|42mm|46mm/i.test(lowerPromise)) &&
          /wrong color|wrong model|wrong size|different model|different color|received|only|reads/i.test(combinedProof))
      ) {
        discrepancies.push({
          id: `disc-spec-${idx + 1}`,
          feature: "Model / Specification Mismatch",
          spokenPromise: promise,
          spokenAudioStartSec: input.sellerAudioNotes?.[idx]?.startSec || 0,
          spokenAudioEndSec: input.sellerAudioNotes?.[idx]?.endSec || 10,
          actualDeliveredEvidence: "Delivered product differs in color, capacity, or form factor from agreed specifications.",
          discrepancyType: "MISMATCH",
          severity: "CRITICAL",
        });
      }

      // Dimension 4: Inclusions & Accessories (Charger, Warranty, Box, Cables)
      if (/charger included|with box|all accessories|with warranty card|bill included/i.test(lowerPromise)) {
        if (/missing charger|no box|missing accessories|no cable|no bill/i.test(combinedProof)) {
          discrepancies.push({
            id: `disc-acc-${idx + 1}`,
            feature: "Included Accessories & Documentation",
            spokenPromise: promise,
            spokenAudioStartSec: input.sellerAudioNotes?.[idx]?.startSec || 0,
            spokenAudioEndSec: input.sellerAudioNotes?.[idx]?.endSec || 10,
            actualDeliveredEvidence: "Expected companion accessories or proof of purchase absent in package.",
            discrepancyType: "MISSING_ITEM",
            severity: "MODERATE",
          });
        }
      }

      // Dimension 5: Quantity Mismatch (e.g. 2 units vs 1 received)
      if (/\b(?:2|3|4|5|10)\s*(?:pieces|pcs|units|items|bottles)\b/i.test(lowerPromise)) {
        if (/received only 1|missing pieces|short shipment|only one/i.test(combinedProof)) {
          discrepancies.push({
            id: `disc-qty-${idx + 1}`,
            feature: "Unit Quantity Delivered",
            spokenPromise: promise,
            spokenAudioStartSec: input.sellerAudioNotes?.[idx]?.startSec || 0,
            spokenAudioEndSec: input.sellerAudioNotes?.[idx]?.endSec || 10,
            actualDeliveredEvidence: "Delivered package contains fewer units than orally agreed.",
            discrepancyType: "MISSING_ITEM",
            severity: "CRITICAL",
          });
        }
      }
    });

    // Determine Resolution Recommendation
    let recommendedResolution: MarketplaceDisputePack["recommendedResolution"] = "RELEASE_TO_SELLER";
    let resolutionJustification = "No material breach between spoken agreement and delivered evidence.";

    const criticalCount = discrepancies.filter((d) => d.severity === "CRITICAL").length;
    const moderateCount = discrepancies.filter((d) => d.severity === "MODERATE").length;

    if (criticalCount > 0) {
      recommendedResolution = "FULL_REFUND";
      resolutionJustification = `Found ${criticalCount} critical breach(es) (e.g., physical damage, counterfeit, or wrong model) where delivered goods materially contradict spoken seller promises.`;
    } else if (moderateCount > 0) {
      recommendedResolution = "PARTIAL_REFUND";
      resolutionJustification = `Delivered goods are functional but missing oral contract accessories/inclusions (${moderateCount} moderate defect(s)). 20-30% compensation recommended.`;
    } else if (discrepancies.length > 0) {
      recommendedResolution = "PARTIAL_REFUND";
      resolutionJustification = "Minor discrepancy detected between spoken notes and delivered goods.";
    }

    const disputeId = `disp-${computeSha256(JSON.stringify(input)).substring(0, 12)}`;
    const receiptDigest = computeSha256(
      JSON.stringify({
        disputeId,
        sellerPromises,
        buyerClaims,
        discrepancies,
        recommendedResolution,
      }),
    );

    return {
      disputeId,
      buyerClaims,
      sellerPromises,
      discrepancies,
      recommendedResolution,
      resolutionJustification,
      receiptDigest,
      rawUserDataEgress: 0,
      draftStatus: "DRAFT_ONLY",
      requiresHumanConfirmation: true,
      noAutonomousSubmission: true,
      negativeAuthorities: {
        noLegalConclusion: true,
      },
    };
  }
}

export const marketplaceDisputeEngine = new MarketplaceDisputeEngine();
