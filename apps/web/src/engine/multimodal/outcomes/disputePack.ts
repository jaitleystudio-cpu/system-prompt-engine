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

    const discrepancies: DiscrepancyItem[] = [];

    // Analyze mismatches
    sellerPromises.forEach((promise, idx) => {
      const lowerPromise = promise.toLowerCase();

      // Check condition (e.g. "brand new", "original", "sealed")
      if (/new|sealed|original|unopened|కొత్త|नया|nuevo/i.test(lowerPromise)) {
        if (/used|scratched|broken|damaged|fake|పాడైపోయింది|खराब|usado/i.test(photoText) ||
            buyerClaims.some((c) => /broken|scratched|used/i.test(c))) {
          discrepancies.push({
            id: `disc-${idx + 1}`,
            feature: "Condition & Quality",
            spokenPromise: promise,
            spokenAudioStartSec: input.sellerAudioNotes?.[idx]?.startSec || 0,
            spokenAudioEndSec: input.sellerAudioNotes?.[idx]?.endSec || 10,
            actualDeliveredEvidence: photoText || "Buyer photo evidence indicates wear or damage.",
            discrepancyType: "DAMAGED",
            severity: "CRITICAL",
          });
        }
      }

      // Check color or model mismatch
      if (/blue|red|black|white|128gb|256gb|xl|large|small/i.test(lowerPromise)) {
        if (buyerClaims.some((c) => /wrong color|wrong model|wrong size/i.test(c))) {
          discrepancies.push({
            id: `disc-model-${idx + 1}`,
            feature: "Model / Specification Mismatch",
            spokenPromise: promise,
            spokenAudioStartSec: input.sellerAudioNotes?.[idx]?.startSec || 0,
            spokenAudioEndSec: input.sellerAudioNotes?.[idx]?.endSec || 10,
            actualDeliveredEvidence: "Delivered product differs from spoken configuration.",
            discrepancyType: "MISMATCH",
            severity: "CRITICAL",
          });
        }
      }
    });

    // Determine Resolution Recommendation
    let recommendedResolution: MarketplaceDisputePack["recommendedResolution"] = "RELEASE_TO_SELLER";
    let resolutionJustification = "No material breach between spoken agreement and delivered evidence.";

    const criticalCount = discrepancies.filter((d) => d.severity === "CRITICAL").length;
    if (criticalCount > 0) {
      recommendedResolution = "FULL_REFUND";
      resolutionJustification = `Found ${criticalCount} critical breach(es) where delivered goods materially contradict spoken seller promises.`;
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
    };
  }
}

export const marketplaceDisputeEngine = new MarketplaceDisputeEngine();
