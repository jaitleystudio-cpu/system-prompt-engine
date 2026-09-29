import { IR_VERSION, SOURCE_MAP_VERSION, STATUSES } from "./constants.mjs";
import { MassiveError } from "./errors.mjs";
import { chainUpdate } from "./hashing.mjs";

export function isSemanticPass(_ir) {
  return false;
}

export function buildSourceMap(spans, { charLength, byteLength, wordCount, sourceSha256, coverageOverride = null }) {
  const gaps = [];
  const overlaps = [];
  let cursor = 0;
  let byteCursor = 0;
  let wordCursor = 0;
  let coordinateMismatch = false;
  let chain = null;
  for (const span of spans) {
    const start = span.char_start;
    const end = span.char_end;
    if (start > cursor) gaps.push([cursor, start]);
    else if (start < cursor) overlaps.push([start, cursor]);
    if (span.byte_start !== byteCursor || span.word_start !== wordCursor) coordinateMismatch = true;
    cursor = end;
    byteCursor = span.byte_end;
    wordCursor = span.word_end;
    chain = chainUpdate(chain, span.sha256);
  }
  if (cursor < charLength) gaps.push([cursor, charLength]);
  if (cursor > charLength || byteCursor !== byteLength || wordCursor !== wordCount) coordinateMismatch = true;
  let coverage;
  if (coverageOverride) coverage = coverageOverride;
  else if (!spans.length && charLength === 0) coverage = "COMPLETE";
  else if (!gaps.length && !overlaps.length && !coordinateMismatch && cursor === charLength) coverage = "COMPLETE";
  else coverage = "PARTIAL";
  return {
    version: SOURCE_MAP_VERSION,
    coverage,
    source_sha256: sourceSha256,
    char_length: charLength,
    byte_length: byteLength,
    word_count: wordCount,
    chain_sha256: chain,
    coordinate_mismatch: coordinateMismatch,
    spans,
    gaps,
    overlaps,
  };
}

export function memoryBlock({ maxResidentChars, peakPendingChars, pressureEvents, spilledChunks }) {
  return {
    max_resident_chars: maxResidentChars,
    peak_pending_chars: peakPendingChars,
    pressure_events: pressureEvents,
    spilled_chunks: spilledChunks,
  };
}

export function freezeIr(ir) {
  const status = ir.status;
  if (status === "PASS" || ir.semantic_judgment === "PASS") {
    throw new MassiveError("PASS_FORBIDDEN", "intake must not report PASS");
  }
  if (!STATUSES.has(status)) throw new MassiveError("BAD_STATUS", "status is outside the intake vocabulary");
  if (ir.semantic_judgment !== "NOT_A_PASS") {
    throw new MassiveError("PASS_FORBIDDEN", "semantic judgment must stay NOT_A_PASS");
  }
  if (ir.semantic_engine !== "NOT_INTEGRATED") {
    throw new MassiveError("INTEGRATION_FORBIDDEN", "semantic engine is not integrated");
  }
  if (ir.waits_for !== "F3E_FREEZE") {
    throw new MassiveError("INTEGRATION_FORBIDDEN", "integration waits for F3E freeze");
  }
  if (ir.silent_truncation !== false) throw new MassiveError("SILENT_TRUNCATION", "silent truncation is forbidden");
  if (ir.ir_version !== IR_VERSION) throw new MassiveError("BAD_VERSION", "unexpected IR version");
  if (status === "READY_FOR_F3E") {
    if (ir.source_map.coverage !== "COMPLETE") {
      throw new MassiveError("MAP_INCOMPLETE", "READY_FOR_F3E requires a complete source map");
    }
    if (ir.intake_complete !== true || ir.accepted_lossless !== true) {
      throw new MassiveError("NOT_LOSSLESS", "READY_FOR_F3E requires lossless accepted text");
    }
    if (ir.stored_body !== true) throw new MassiveError("NOT_LOSSLESS", "READY_FOR_F3E requires a stored body");
    if (ir.truncation_applied !== false) {
      throw new MassiveError("SILENT_TRUNCATION", "READY_FOR_F3E cannot apply truncation");
    }
    if (ir.word_count > ir.word_cap) throw new MassiveError("WORD_BUDGET_EXCEEDED", "ready IR exceeds the word cap");
  }
  return ir;
}

export function baseIr({ sessionId, status, wordCap, attemptedWordCount, attemptedCharCount, attemptedSha256, memory }) {
  return {
    ir_version: IR_VERSION,
    session_id: sessionId,
    status,
    semantic_engine: "NOT_INTEGRATED",
    semantic_judgment: "NOT_A_PASS",
    waits_for: "F3E_FREEZE",
    silent_truncation: false,
    truncation_applied: false,
    word_cap: wordCap,
    attempted_word_count: attemptedWordCount,
    attempted_char_count: attemptedCharCount,
    attempted_sha256: attemptedSha256,
    memory,
  };
}
