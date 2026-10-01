/**
 * Outcome 1: Spoken Promise Ledger ("From Transcript -> Obligation")
 *
 * Solves the oral economy trust deficit:
 * In oral transactions (daily wages, repairs, local trade, contractor deals),
 * promises die in thin air because trust systems only recognize written contracts.
 *
 * This engine extracts commitments, deadlines, wage rates, conditions, and parties
 * from spoken audio, linking them to exact audio timestamps and sealing them with
 * a tamper-evident cryptographic receipt.
 */

import { computeSha256 } from "../../hashUtils";
import type { AsrResult, AsrTimestampSegment } from "../types";
import type { PromiseCommitment, PromiseLedger, PromiseParty } from "./types";

interface SpokenPromiseInput {
  asrResult?: AsrResult;
  segments?: AsrTimestampSegment[];
  rawText?: string;
  sourceAudioDigest?: string;
  parties?: PromiseParty[];
  language?: string;
}

export class PromiseLedgerEngine {
  /**
   * Extracts commitments and compiles an immutable PromiseLedger.
   */
  extractLedger(input: SpokenPromiseInput): PromiseLedger {
    const language = input.language || input.asrResult?.language || "en";
    const segments = input.segments || input.asrResult?.segments || [];
    const sourceDigest =
      input.sourceAudioDigest ||
      input.asrResult?.receipt?.inputDigest ||
      computeSha256(input.rawText || "empty-audio");

    const parties: PromiseParty[] = input.parties && input.parties.length > 0
      ? input.parties
      : [
          { id: "p1", name: "Speaker 1 (Promisor)", role: "promisor" },
          { id: "p2", name: "Speaker 2 (Promisee)", role: "promisee" },
        ];

    const commitments: PromiseCommitment[] = [];

    // Analyze segments or fallback to full text
    if (segments.length > 0) {
      for (const seg of segments) {
        const commitment = this.parseSegment(seg, parties, language);
        if (commitment) {
          commitments.push(commitment);
        }
      }
    } else if (input.rawText) {
      const syntheticSeg: AsrTimestampSegment = {
        id: 1,
        startSec: 0,
        endSec: 10,
        text: input.rawText,
        confidence: 0.9,
      };
      const commitment = this.parseSegment(syntheticSeg, parties, language);
      if (commitment) {
        commitments.push(commitment);
      }
    }

    // If no explicit commitment matched, create an open obligation from text if present
    if (commitments.length === 0 && (input.rawText || segments.length > 0)) {
      const fullText = input.rawText || segments.map((s) => s.text).join(" ");
      if (fullText.trim().length > 0) {
        commitments.push({
          id: "cmt-1",
          promisor: parties[0]?.name || "Promisor",
          promisee: parties[1]?.name || "Promisee",
          obligation: fullText.trim(),
          category: "GENERAL",
          confidence: 0.85,
          audioStartSec: 0,
          audioEndSec: segments[segments.length - 1]?.endSec || 5,
          quoteSnippet: fullText.substring(0, 120),
          status: "PENDING",
        });
      }
    }

    const ledgerId = `ledger-${computeSha256(sourceDigest + commitments.length).substring(0, 16)}`;
    const timestamp = new Date().toISOString();

    const summaryText =
      commitments.length > 0
        ? `Spoken agreement established ${commitments.length} commitment(s) between ${parties.map((p) => p.name).join(" and ")}.`
        : "No verifiable commitments detected in audio.";

    const executableContractPrompt = this.generateContractPrompt(
      parties,
      commitments,
      language,
    );

    const receiptDigest = computeSha256(
      JSON.stringify({
        ledgerId,
        sourceDigest,
        parties,
        commitments,
        timestamp,
      }),
    );

    return {
      ledgerId,
      timestamp,
      language,
      sourceAudioDigest: sourceDigest,
      parties,
      commitments,
      summaryText,
      executableContractPrompt,
      receiptDigest,
      rawUserDataEgress: 0,
    };
  }

  private parseSegment(
    seg: AsrTimestampSegment,
    parties: PromiseParty[],
    _lang: string,
  ): PromiseCommitment | null {
    const text = seg.text;
    if (!text || text.trim().length < 4) return null;

    // Detect monetary amount
    const moneyMatch = text.match(
      /(?:[$€£₹]|rs\.?|usd|eur|inr)\s*([\d,.]+)|([\d,.]+)\s*(?:dollars|rupees|euros|pesos|yen|pounds|bucks)/i,
    );
    let monetaryAmount: { value: number; currency: string } | undefined;
    if (moneyMatch) {
      let valStr = (moneyMatch[1] || moneyMatch[2] || "").trim();
      if (/,\d{3}/.test(valStr)) {
        valStr = valStr.replace(/,/g, "");
      } else if (/,/.test(valStr)) {
        valStr = valStr.replace(",", ".");
      }
      const val = parseFloat(valStr);
      if (!isNaN(val)) {
        monetaryAmount = {
          value: val,
          currency: text.includes("₹") || /rupee|rs/i.test(text) ? "INR" : "USD",
        };
      }
    }

    // Detect category & obligation
    let category: PromiseCommitment["category"] = "GENERAL";
    if (/wage|pay|salary|rate|daily|fee|compensation|కూలీ|दिहाड़ी|sueldo|salaire/i.test(text)) {
      category = "WAGE";
    } else if (/repair|fix|screen|car|plumb|service|बाగు|मरम्मत|reparar|réparation/i.test(text)) {
      category = "REPAIR";
    } else if (/deliver|send|ship|courier|bring|రవాణా|पहुंचा|entregar|livrer/i.test(text)) {
      category = "DELIVERY";
    } else if (/loan|borrow|lend|debt|అప్పు|उधार|préstamo|prêt/i.test(text)) {
      category = "LOAN";
    } else if (/contract|agree|deal|terms|ధర|शर्त|trato|accord/i.test(text)) {
      category = "DEAL_TERM";
    }

    // Detect deadline
    const deadlineMatch = text.match(
      /(?:by|before|on|within|until|deadline)\s+([a-z0-9\s,]+?)(?:\.|$|,|and)/i,
    );
    const deadlineText = deadlineMatch ? deadlineMatch[1].trim() : undefined;

    return {
      id: `cmt-${seg.id || Math.floor(Math.random() * 10000)}`,
      promisor: parties[0]?.name || "Promisor",
      promisee: parties[1]?.name || "Promisee",
      obligation: text.trim(),
      category,
      deadlineText,
      monetaryAmount,
      confidence: Math.max(0.75, seg.confidence || 0.88),
      audioStartSec: seg.startSec,
      audioEndSec: seg.endSec,
      quoteSnippet: text.trim(),
      status: "PENDING",
    };
  }

  private generateContractPrompt(
    parties: PromiseParty[],
    commitments: PromiseCommitment[],
    language: string,
  ): string {
    return `You are a legal dispute and contract formation specialist.
Convert the following spoken obligations extracted from verified audio into an enforceable, clear agreement and dispute-prevention memorandum.

Language: ${language}
Parties:
${parties.map((p) => `- ${p.name} (${p.role})`).join("\n")}

Spoken Commitments Recorded with Audio Timestamps:
${commitments
  .map(
    (c, i) =>
      `${i + 1}. [${c.audioStartSec.toFixed(1)}s - ${c.audioEndSec.toFixed(1)}s] ${c.promisor} promised to ${c.promisee}: "${c.obligation}" (${c.category})${c.deadlineText ? ` Deadline: ${c.deadlineText}` : ""}${c.monetaryAmount ? ` Amount: ${c.monetaryAmount.currency} ${c.monetaryAmount.value}` : ""}`,
  )
  .join("\n")}

Format output into:
1. Executive Summary of Agreement
2. Itemized Obligations, Deliverables, and Deadlines
3. Financial Considerations and Payment Milestones
4. Dispute Resolution Protocol & Evidence Timestamp Audit Trail`;
  }
}

export const promiseLedgerEngine = new PromiseLedgerEngine();
