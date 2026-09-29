/** Lexical explicit evidence. Not an XCAT category and not a semantic pass. */

import { EVIDENCE_LINE_MAX } from "./constants.mjs";
import { sha256Text } from "./hashing.mjs";

const MUST_NOT = /\b(?:must not|shall not|do not|don't|never)\b/i;
const MUST = /\b(?:must|shall|required)\b/i;
const LABELED = /^(?:constraint|requirement|rule)\s*[:\-]\s*\S/i;
const QUOTE = /"([^"\n]{12,400})"/g;
const IMPERATIVE = /\b(?:must|shall|do not|don't|include|exclude|return|preserve|avoid|never)\b/i;

const PRIORITY = {
  EXPLICIT_MUST_NOT: 4,
  LABELED_CONSTRAINT: 3,
  QUOTED_DIRECTIVE: 2,
  EXPLICIT_MUST: 1,
};

export function scanExplicitEvidence(chunks, lineMax = EVIDENCE_LINE_MAX) {
  const items = [];
  let skipped = 0;
  let absBase = 0;
  let carry = "";
  let carryStart = 0;
  let skipping = false;

  const flushLine = (line, start) => {
    if (skipping) return;
    if (Array.from(line).length > lineMax) {
      skipped += 1;
      return;
    }
    items.push(...lineCandidates(line, start));
  };

  for (const [, text] of chunks) {
    const points = Array.from(text);
    let i = 0;
    while (i < points.length) {
      let nl = -1;
      for (let j = i; j < points.length; j += 1) {
        if (points[j] === "\n") {
          nl = j;
          break;
        }
      }
      if (nl < 0) {
        const piece = points.slice(i).join("");
        if (skipping) break;
        if (!carry) carryStart = absBase + i;
        carry += piece;
        if (Array.from(carry).length > lineMax) {
          skipped += 1;
          carry = "";
          skipping = true;
        }
        break;
      }
      const piece = points.slice(i, nl).join("");
      if (skipping) {
        skipping = false;
      } else {
        if (!carry) carryStart = absBase + i;
        carry += piece;
        flushLine(carry, carryStart);
        carry = "";
      }
      i = nl + 1;
    }
    absBase += points.length;
  }

  if (skipping) skipping = false;
  else if (carry) flushLine(carry, carryStart);

  const chosen = resolveOverlaps(items);
  chosen.forEach((item, n) => {
    item.evidence_id = `E${String(n + 1).padStart(4, "0")}`;
  });
  let evidenceStatus;
  let scanStatus;
  if (skipped && chosen.length === 0) {
    evidenceStatus = "NOT_SCANNED";
    scanStatus = "PARTIAL";
  } else if (skipped) {
    evidenceStatus = "PRESENT";
    scanStatus = "PARTIAL";
  } else if (chosen.length) {
    evidenceStatus = "PRESENT";
    scanStatus = "COMPLETE";
  } else {
    evidenceStatus = "ABSENT";
    scanStatus = "COMPLETE";
  }
  return {
    explicit_evidence: chosen,
    evidence_status: evidenceStatus,
    evidence_scan_status: scanStatus,
    evidence_lines_skipped: skipped,
  };
}

function lineCandidates(line, start) {
  const found = [];
  if (MUST_NOT.test(line)) found.push(span("EXPLICIT_MUST_NOT", line, start, 0, Array.from(line).length));
  else if (MUST.test(line)) found.push(span("EXPLICIT_MUST", line, start, 0, Array.from(line).length));
  MUST_NOT.lastIndex = 0;
  MUST.lastIndex = 0;
  if (LABELED.test(line)) found.push(span("LABELED_CONSTRAINT", line, start, 0, Array.from(line).length));
  LABELED.lastIndex = 0;
  const points = Array.from(line);
  const unitLine = line;
  QUOTE.lastIndex = 0;
  let match = QUOTE.exec(unitLine);
  while (match) {
    const inner = match[1];
    if (IMPERATIVE.test(inner)) {
      const relStart = Array.from(unitLine.slice(0, match.index)).length;
      const relEnd = relStart + Array.from(match[0]).length;
      found.push(span("QUOTED_DIRECTIVE", points.join(""), start, relStart, relEnd));
    }
    IMPERATIVE.lastIndex = 0;
    match = QUOTE.exec(unitLine);
  }
  return found;
}

function span(rule, line, lineStart, relStart, relEnd) {
  const points = Array.from(line);
  const text = points.slice(relStart, relEnd).join("");
  return {
    rule,
    char_start: lineStart + relStart,
    char_end: lineStart + relEnd,
    text,
    text_sha256: sha256Text(text),
    priority: PRIORITY[rule],
  };
}

function resolveOverlaps(items) {
  const ordered = [...items].sort((a, b) => {
    if (a.char_start !== b.char_start) return a.char_start - b.char_start;
    if (a.priority !== b.priority) return b.priority - a.priority;
    const lenA = a.char_end - a.char_start;
    const lenB = b.char_end - b.char_start;
    if (lenA !== lenB) return lenB - lenA;
    return a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0;
  });
  const chosen = [];
  for (const item of ordered) {
    const overlaps = chosen.some(
      (prev) => item.char_start < prev.char_end && item.char_end > prev.char_start,
    );
    if (overlaps) continue;
    chosen.push({
      rule: item.rule,
      char_start: item.char_start,
      char_end: item.char_end,
      text: item.text,
      text_sha256: item.text_sha256,
    });
  }
  chosen.sort((a, b) => a.char_start - b.char_start || (a.rule < b.rule ? -1 : 1));
  return chosen;
}

export function attachChunkIndexes(evidence, spans) {
  for (const item of evidence) {
    let chunkIndex = null;
    for (const spanItem of spans) {
      if (spanItem.char_start <= item.char_start && item.char_start < spanItem.char_end) {
        chunkIndex = spanItem.index;
        break;
      }
    }
    if (chunkIndex == null && spans.length && item.char_start === spans[spans.length - 1].char_end) {
      chunkIndex = spans[spans.length - 1].index;
    }
    item.chunk_index = chunkIndex;
  }
}
