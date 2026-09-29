/** Million-word intake session. Sealed output is a MassiveSourceIR, not a semantic pass. */

import { nextChunkEnd } from "./chunking.mjs";
import {
  HARD_CHARS,
  IR_VERSION,
  MAX_RESIDENT_CHARS,
  PROTOCOL,
  TARGET_CHARS,
  WORD_CAP,
} from "./constants.mjs";
import { MassiveError } from "./errors.mjs";
import { attachChunkIndexes, scanExplicitEvidence } from "./evidence.mjs";
import { createHasher, sha256Bytes, sha256Text, utf8Bytes } from "./hashing.mjs";
import { baseIr, buildSourceMap, freezeIr, memoryBlock } from "./ir.mjs";
import { stableStringify } from "./json.mjs";
import { codePoints, countWordStarts, slicePoints } from "./whitespace.mjs";

const decoder = new TextDecoder("utf-8", { fatal: true });

function cpLen(text) {
  return Array.from(text).length;
}

function emptyTail() {
  const digest = sha256Text("");
  return {
    sha256: digest,
    char_length: 0,
    byte_length: 0,
    start_inside_word: false,
    rel: `blobs/tails/${digest}.utf8`,
  };
}

function publicSpan(meta) {
  return {
    index: meta.index,
    char_start: meta.char_start,
    char_end: meta.char_end,
    byte_start: meta.byte_start,
    byte_end: meta.byte_end,
    word_start: meta.word_start,
    word_end: meta.word_end,
    sha256: meta.sha256,
    begins_inside_word: meta.begins_inside_word,
    ends_inside_word: meta.ends_inside_word,
    split_inside_word: meta.split_inside_word,
  };
}

export class MassiveSession {
  constructor(custody, sessionId, options = {}) {
    const target = options.targetChars ?? TARGET_CHARS;
    const hard = options.hardChars ?? HARD_CHARS;
    const maxResident = options.maxResidentChars ?? MAX_RESIDENT_CHARS;
    const wordCap = options.wordCap ?? WORD_CAP;
    if (!(1 <= target && target <= hard && hard <= maxResident)) {
      throw new MassiveError("BAD_CONFIG", "require 1 <= target <= hard <= max resident");
    }
    if (wordCap < 0) throw new MassiveError("BAD_CONFIG", "word cap cannot be negative");
    this.custody = custody;
    this.sessionId = sessionId;
    this.targetChars = target;
    this.hardChars = hard;
    this.maxResidentChars = maxResident;
    this.wordCap = wordCap;
    this.pressure = options.pressure || ((resident) => resident <= maxResident);
    this.index = options.index || null;
    this.status = "INCOMPLETE";
    this.pending = "";
    this.insideWord = false;
    this.charOrigin = 0;
    this.byteOrigin = 0;
    this.wordOrigin = 0;
    this.nextIndex = 0;
    this.chunkMetas = [];
    this.chunkChars = 0;
    this.chunkBytes = 0;
    this.committedWords = 0;
    this.tailSha256 = sha256Text("");
    this.acceptedSha256 = sha256Text("");
    this.peakPendingChars = 0;
    this.pressureEvents = [];
    this.spilledChunks = 0;
    this.unhashed = "";
    this.hasher = createHasher();
    this.hasherLive = true;
    this.countInside = false;
    this.attemptedWordCount = 0;
    this.attemptedCharCount = 0;
    this.attemptedSha256 = sha256Text("");
    this.attemptedSha256Status = "KNOWN";
    this.rejectedAny = false;
    this.blobsCleared = false;
    this.terminalIr = null;
    this.indexPersisted = true;
  }

  async append(text) {
    if (typeof text !== "string") throw new MassiveError("INVALID_TEXT", "append requires a string");
    if (["READY_FOR_F3E", "REFUSED", "CUSTODY_MISMATCH"].includes(this.status)) {
      throw new MassiveError("NOT_APPENDABLE", "session is terminal");
    }
    if (this.status === "MEMORY_PRESSURE_HALTED") {
      this.rejectedAny = true;
      return this.ack(cpLen(text));
    }
    if (this.status === "REFUSED_IN_PROGRESS") {
      await this.countOnly(text);
      return this.ack(0);
    }
    if (this.status !== "INCOMPLETE") throw new MassiveError("NOT_APPENDABLE", "session cannot accept text");
    if (text === "") return this.ack(0);
    const points = codePoints(text);
    let offset = 0;
    let rejected = 0;
    while (offset < points.length) {
      if (this.status !== "INCOMPLETE") {
        rejected += points.length - offset;
        break;
      }
      const room = this.maxResidentChars - cpLen(this.pending);
      if (room <= 0) {
        if (!(await this.drain(false))) {
          rejected += await this.halt(points.length - offset);
          break;
        }
        continue;
      }
      const take = Math.min(room, points.length - offset);
      const snap = this.snapshot();
      const piece = slicePoints(points, offset, offset + take);
      this.pending += piece;
      this.unhashed += piece;
      this.notePending();
      if (!this.pressureOk()) {
        this.restore(snap);
        rejected += await this.halt(points.length - offset);
        break;
      }
      let decision;
      try {
        decision = await this.persist(false);
      } catch (error) {
        this.restore(snap);
        throw error;
      }
      if (decision === "OVER") {
        await this.enterRefuse(slicePoints(points, offset + take, points.length));
        break;
      }
      if (decision === "HALT") {
        this.restore(snap);
        rejected += await this.halt(points.length - offset);
        break;
      }
      offset += take;
    }
    return this.ack(rejected);
  }

  async seal() {
    if (this.terminalIr) return this.terminalIr;
    if (this.status === "INCOMPLETE") {
      const decision = await this.persist(true);
      if (decision === "OVER") await this.enterRefuse("");
      else if (decision === "OK") return this.sealReady();
      else if (decision === "HALT") await this.halt(0);
    }
    if (this.status === "REFUSED_IN_PROGRESS") return this.sealRefused();
    if (this.status === "MEMORY_PRESSURE_HALTED") return this.sealHalted();
    if (this.status === "CUSTODY_MISMATCH") return this.sealMismatch();
    throw new MassiveError("NOT_SEALABLE", `session cannot be sealed from ${this.status}`);
  }

  statusView() {
    return this.ack(0);
  }

  async drain(seal) {
    const end = nextChunkEnd(this.pending, {
      target: this.targetChars,
      hard: this.hardChars,
      seal: false,
      startInsideWord: this.insideWord,
    });
    if (end == null && !seal) return false;
    const decision = await this.persist(seal);
    return decision === "OK" && end != null;
  }

  async persist(seal) {
    const snap = this.snapshot();
    let journaled = false;
    try {
      const newChunks = [];
      while (true) {
        const end = nextChunkEnd(this.pending, {
          target: this.targetChars,
          hard: this.hardChars,
          seal,
          startInsideWord: this.insideWord,
        });
        if (end == null) break;
        if (end <= 0 || end > cpLen(this.pending)) throw new MassiveError("CHUNK_STALL", "chunker made no progress");
        const preview = slicePoints(codePoints(this.pending), 0, end);
        const [words] = countWordStarts(preview, this.insideWord);
        if (this.committedWords + words > this.wordCap) {
          this.restore(snap);
          return "OVER";
        }
        newChunks.push(this.take(end));
      }
      const [pendingWords] = countWordStarts(this.pending, this.insideWord);
      if (this.committedWords + pendingWords > this.wordCap) {
        this.restore(snap);
        return "OVER";
      }
      if (seal && this.pending) throw new MassiveError("CHUNK_STALL", "seal left uncommitted text");
      if (!this.pressureOk()) {
        this.restore(snap);
        return "HALT";
      }
      await this.journalCommit(newChunks);
      journaled = true;
    } catch (error) {
      if (!journaled) this.restore(snap);
      if (error instanceof MassiveError) throw error;
      throw new MassiveError("PERSIST_FAILED", "custody write failed");
    }
    return "OK";
  }

  take(end) {
    const points = codePoints(this.pending);
    const text = slicePoints(points, 0, end);
    const begins = this.insideWord;
    const [words, ends] = countWordStarts(text, begins);
    const raw = utf8Bytes(text);
    const digest = sha256Bytes(raw);
    const meta = {
      index: this.nextIndex,
      char_start: this.charOrigin,
      char_end: this.charOrigin + cpLen(text),
      byte_start: this.byteOrigin,
      byte_end: this.byteOrigin + raw.length,
      word_start: this.wordOrigin,
      word_end: this.wordOrigin + words,
      sha256: digest,
      begins_inside_word: begins,
      ends_inside_word: ends,
      split_inside_word: Boolean(begins || ends),
      rel: `blobs/chunks/${String(this.nextIndex).padStart(8, "0")}-${digest}.utf8`,
    };
    this.pending = slicePoints(points, end, points.length);
    this.insideWord = ends;
    this.charOrigin = meta.char_end;
    this.byteOrigin = meta.byte_end;
    this.wordOrigin = meta.word_end;
    this.nextIndex += 1;
    this.committedWords += words;
    this.chunkChars += cpLen(text);
    this.chunkBytes += raw.length;
    this.spilledChunks += 1;
    this.pressureEvents.push({
      action: "SPILL",
      chunk_index: meta.index,
      pending_chars_after: cpLen(this.pending),
    });
    return [meta, raw];
  }

  async journalCommit(newChunks) {
    const tailRaw = utf8Bytes(this.pending);
    const tailSha = sha256Bytes(tailRaw);
    const tail = {
      sha256: tailSha,
      char_length: cpLen(this.pending),
      byte_length: tailRaw.length,
      start_inside_word: this.insideWord,
      rel: `blobs/tails/${tailSha}.utf8`,
    };
    const hasher = this.hasher.copy();
    if (this.unhashed) hasher.update(utf8Bytes(this.unhashed));
    for (const [meta, raw] of newChunks) await this.custody.writeBlob(this.sessionId, meta.rel, raw);
    await this.custody.writeBlob(this.sessionId, tail.rel, tailRaw);
    const accepted = hasher.hexdigest();
    const record = {
      kind: "COMMIT",
      chunks: newChunks.map(([meta]) => meta),
      tail,
      committed_words: this.committedWords,
      chunk_chars: this.chunkChars,
      chunk_bytes: this.chunkBytes,
      accepted_sha256: accepted,
      silent_truncation: false,
    };
    try {
      await this.custody.appendJournal(this.sessionId, record);
    } catch (error) {
      throw new MassiveError("PERSIST_FAILED", "journal append failed");
    }
    this.hasher = hasher;
    this.unhashed = "";
    this.chunkMetas.push(...record.chunks);
    this.tailSha256 = tailSha;
    this.acceptedSha256 = accepted;
    const [pendingWords] = countWordStarts(this.pending, this.insideWord);
    this.attemptedWordCount = this.committedWords + pendingWords;
    this.attemptedCharCount = this.chunkChars + cpLen(this.pending);
    this.attemptedSha256 = accepted;
    this.attemptedSha256Status = "KNOWN";
    await this.writeIndex();
  }

  async enterRefuse(unconsumed) {
    const [pendingWords, insideAfter] = countWordStarts(this.pending, this.insideWord);
    const [restWords, countInside] = countWordStarts(unconsumed, insideAfter);
    this.countInside = countInside;
    const attemptedWords = this.committedWords + pendingWords + restWords;
    const attemptedChars = this.chunkChars + cpLen(this.pending) + cpLen(unconsumed);
    const hasher = this.hasher.copy();
    if (this.unhashed) hasher.update(utf8Bytes(this.unhashed));
    if (unconsumed) hasher.update(utf8Bytes(unconsumed));
    const contentSha = this.hasherLive ? hasher.hexdigest() : null;
    const contentStatus = this.hasherLive ? "KNOWN" : "UNKNOWN";
    await this.custody.appendJournal(this.sessionId, {
      kind: "REFUSE",
      code: "WORD_BUDGET_EXCEEDED",
      attempted_word_count: attemptedWords,
      attempted_char_count: attemptedChars,
      attempted_sha256: contentSha,
      attempted_sha256_status: contentStatus,
      count_inside: countInside,
      silent_truncation: false,
      stored_body: false,
    });
    await this.custody.wipeBlobs(this.sessionId);
    await this.custody.appendJournal(this.sessionId, { kind: "BLOBS_CLEARED", silent_truncation: false });
    this.status = "REFUSED_IN_PROGRESS";
    this.chunkMetas = [];
    this.pending = "";
    this.unhashed = "";
    this.insideWord = false;
    this.countInside = countInside;
    this.chunkChars = 0;
    this.chunkBytes = 0;
    this.committedWords = 0;
    this.nextIndex = 0;
    this.charOrigin = 0;
    this.byteOrigin = 0;
    this.wordOrigin = 0;
    this.tailSha256 = sha256Text("");
    this.acceptedSha256 = sha256Text("");
    this.attemptedWordCount = attemptedWords;
    this.attemptedCharCount = attemptedChars;
    this.attemptedSha256 = contentSha;
    this.attemptedSha256Status = contentStatus;
    this.hasher = hasher;
    this.hasherLive = contentStatus === "KNOWN";
    this.blobsCleared = true;
    this.rejectedAny = true;
    await this.writeIndex();
  }

  async countOnly(text) {
    const [words, inside] = countWordStarts(text, this.countInside);
    this.countInside = inside;
    this.attemptedWordCount += words;
    this.attemptedCharCount += cpLen(text);
    let shaStatus;
    if (this.hasherLive && this.attemptedSha256Status === "KNOWN") {
      this.hasher.update(utf8Bytes(text));
      this.attemptedSha256 = this.hasher.hexdigest();
      shaStatus = "KNOWN";
    } else {
      this.attemptedSha256 = null;
      this.attemptedSha256Status = "UNKNOWN";
      shaStatus = "UNKNOWN";
      this.hasherLive = false;
    }
    await this.custody.appendJournal(this.sessionId, {
      kind: "COUNT",
      attempted_word_count: this.attemptedWordCount,
      attempted_char_count: this.attemptedCharCount,
      attempted_sha256: this.attemptedSha256,
      attempted_sha256_status: shaStatus,
      count_inside: this.countInside,
      added_chars: cpLen(text),
      silent_truncation: false,
    });
    await this.writeIndex();
  }

  async halt(rejectedChars) {
    this.restorePendingOnlyIfNeeded();
    await this.custody.appendJournal(this.sessionId, {
      kind: "HALT",
      code: "MEMORY_PRESSURE",
      rejected_char_count: rejectedChars,
      silent_truncation: false,
      durable_char_end: this.chunkChars + cpLen(this.pending),
    });
    this.status = "MEMORY_PRESSURE_HALTED";
    this.rejectedAny = true;
    this.pressureEvents.push({
      action: "HALT",
      pending_chars: cpLen(this.pending),
      rejected_char_count: rejectedChars,
    });
    await this.writeIndex();
    return rejectedChars;
  }

  restorePendingOnlyIfNeeded() {
    if (!this.unhashed) return;
    if (!this.pending.endsWith(this.unhashed)) {
      throw new MassiveError("CUSTODY_MISMATCH", "pending diverged from the durable tail");
    }
    this.pending = this.pending.slice(0, this.pending.length - this.unhashed.length);
    this.unhashed = "";
  }

  async sealReady() {
    if (this.pending) throw new MassiveError("CHUNK_STALL", "ready seal requires an empty tail");
    if (this.unhashed) throw new MassiveError("CHUNK_STALL", "unhashed text remained at seal");
    const rebuilt = createHasher();
    let wordInside = false;
    let words = 0;
    let chars = 0;
    const payloads = [];
    for (const meta of this.chunkMetas) {
      const blob = await this.custody.readBlob(this.sessionId, meta.rel);
      if (!blob || sha256Bytes(blob) !== meta.sha256) {
        this.status = "CUSTODY_MISMATCH";
        return this.sealMismatch();
      }
      rebuilt.update(blob);
      const text = decoder.decode(blob);
      payloads.push([meta.index, text]);
      const counted = countWordStarts(text, wordInside);
      wordInside = counted[1];
      words += counted[0];
      chars += cpLen(text);
    }
    if (rebuilt.hexdigest() !== this.acceptedSha256 || words !== this.committedWords || chars !== this.chunkChars) {
      this.status = "CUSTODY_MISMATCH";
      return this.sealMismatch();
    }
    if (words > this.wordCap) {
      await this.enterRefuse("");
      return this.sealRefused();
    }
    const evidence = scanExplicitEvidence(payloads);
    const spans = this.chunkMetas.map(publicSpan);
    attachChunkIndexes(evidence.explicit_evidence, spans);
    const sourceMap = buildSourceMap(spans, {
      charLength: chars,
      byteLength: this.chunkBytes,
      wordCount: words,
      sourceSha256: this.acceptedSha256,
    });
    if (sourceMap.coverage !== "COMPLETE") {
      this.status = "CUSTODY_MISMATCH";
      return this.sealMismatch();
    }
    const ir = baseIr({
      sessionId: this.sessionId,
      status: "READY_FOR_F3E",
      wordCap: this.wordCap,
      attemptedWordCount: words,
      attemptedCharCount: chars,
      attemptedSha256: this.acceptedSha256,
      memory: this.memory(),
    });
    Object.assign(ir, {
      attempted_sha256_status: "KNOWN",
      loss_disclosed: false,
      loss_kind: null,
      word_count: words,
      char_count: chars,
      byte_count: this.chunkBytes,
      source_sha256: this.acceptedSha256,
      chain_sha256: sourceMap.chain_sha256,
      stored_body: true,
      accepted_lossless: true,
      intake_complete: true,
      source_complete: true,
      prefix_only: false,
      reconstructable: true,
      source_map: sourceMap,
      explicit_evidence: evidence.explicit_evidence,
      evidence_status: evidence.evidence_status,
      evidence_scan_status: evidence.evidence_scan_status,
      evidence_lines_skipped: evidence.evidence_lines_skipped,
      chunk_count: spans.length,
      refusal: null,
    });
    return this.finalize(ir);
  }

  async sealRefused() {
    if ((await this.custody.blobCount(this.sessionId)) !== 0) {
      return this.finalize(this.incompleteRefusal("CUSTODY_CLEANUP_INCOMPLETE"));
    }
    const ir = baseIr({
      sessionId: this.sessionId,
      status: "REFUSED",
      wordCap: this.wordCap,
      attemptedWordCount: this.attemptedWordCount,
      attemptedCharCount: this.attemptedCharCount,
      attemptedSha256: this.attemptedSha256 || "",
      memory: this.memory(),
    });
    Object.assign(ir, {
      attempted_sha256: this.attemptedSha256,
      attempted_sha256_status: this.attemptedSha256Status,
      loss_disclosed: true,
      loss_kind: "REFUSED_OVER_BUDGET_BODY_DISCARDED",
      word_count: 0,
      char_count: 0,
      byte_count: 0,
      source_sha256: null,
      chain_sha256: null,
      stored_body: false,
      accepted_lossless: false,
      intake_complete: true,
      source_complete: false,
      prefix_only: false,
      reconstructable: false,
      source_map: buildSourceMap([], {
        charLength: 0,
        byteLength: 0,
        wordCount: 0,
        sourceSha256: null,
        coverageOverride: "REFUSED",
      }),
      explicit_evidence: [],
      evidence_status: "NOT_SCANNED",
      evidence_scan_status: "NOT_SCANNED",
      evidence_lines_skipped: 0,
      chunk_count: 0,
      refusal: {
        code: "WORD_BUDGET_EXCEEDED",
        stored_body: false,
        recoverable: false,
        silent_truncation: false,
      },
    });
    return this.finalize(ir);
  }

  incompleteRefusal(code) {
    const ir = baseIr({
      sessionId: this.sessionId,
      status: "REFUSED_IN_PROGRESS",
      wordCap: this.wordCap,
      attemptedWordCount: this.attemptedWordCount,
      attemptedCharCount: this.attemptedCharCount,
      attemptedSha256: this.attemptedSha256 || "",
      memory: this.memory(),
    });
    Object.assign(ir, {
      attempted_sha256: this.attemptedSha256,
      attempted_sha256_status: this.attemptedSha256Status,
      loss_disclosed: true,
      loss_kind: code,
      word_count: 0,
      char_count: 0,
      byte_count: 0,
      source_sha256: null,
      chain_sha256: null,
      stored_body: true,
      accepted_lossless: false,
      intake_complete: false,
      source_complete: false,
      prefix_only: false,
      reconstructable: false,
      source_map: buildSourceMap([], {
        charLength: 0,
        byteLength: 0,
        wordCount: 0,
        sourceSha256: null,
        coverageOverride: "REFUSED",
      }),
      explicit_evidence: [],
      evidence_status: "NOT_SCANNED",
      evidence_scan_status: "NOT_SCANNED",
      evidence_lines_skipped: 0,
      chunk_count: 0,
      refusal: { code, stored_body: true, recoverable: false, silent_truncation: false },
    });
    return ir;
  }

  async sealHalted() {
    if (!(await this.verifyPrefix())) {
      this.status = "CUSTODY_MISMATCH";
      return this.sealMismatch();
    }
    const spans = this.chunkMetas.map(publicSpan);
    const sourceMap = buildSourceMap(spans, {
      charLength: this.chunkChars,
      byteLength: this.chunkBytes,
      wordCount: this.committedWords,
      sourceSha256: null,
      coverageOverride: "PARTIAL",
    });
    const ir = baseIr({
      sessionId: this.sessionId,
      status: "MEMORY_PRESSURE_HALTED",
      wordCap: this.wordCap,
      attemptedWordCount: this.committedWords,
      attemptedCharCount: this.chunkChars + cpLen(this.pending),
      attemptedSha256: this.acceptedSha256,
      memory: this.memory(),
    });
    Object.assign(ir, {
      attempted_sha256_status: "KNOWN",
      loss_disclosed: true,
      loss_kind: "ENGINE_HALTED_UNACCEPTED_TEXT",
      word_count: this.committedWords,
      char_count: this.chunkChars,
      byte_count: this.chunkBytes,
      source_sha256: null,
      chain_sha256: sourceMap.chain_sha256,
      stored_body: Boolean(this.chunkMetas.length || this.pending),
      accepted_lossless: true,
      intake_complete: false,
      source_complete: false,
      prefix_only: true,
      reconstructable: false,
      source_map: sourceMap,
      explicit_evidence: [],
      evidence_status: "NOT_SCANNED",
      evidence_scan_status: "NOT_SCANNED",
      evidence_lines_skipped: 0,
      chunk_count: spans.length,
      refusal: {
        code: "MEMORY_PRESSURE",
        stored_body: Boolean(this.chunkMetas.length),
        recoverable: true,
        silent_truncation: false,
      },
    });
    return this.finalize(ir);
  }

  async sealMismatch() {
    this.status = "CUSTODY_MISMATCH";
    const stored = (await this.custody.blobCount(this.sessionId)) > 0;
    const ir = baseIr({
      sessionId: this.sessionId,
      status: "CUSTODY_MISMATCH",
      wordCap: this.wordCap,
      attemptedWordCount: this.attemptedWordCount,
      attemptedCharCount: this.attemptedCharCount,
      attemptedSha256: this.attemptedSha256 || "",
      memory: this.memory(),
    });
    Object.assign(ir, {
      attempted_sha256: this.attemptedSha256,
      attempted_sha256_status: "UNKNOWN",
      loss_disclosed: true,
      loss_kind: "CUSTODY_MISMATCH",
      word_count: 0,
      char_count: 0,
      byte_count: 0,
      source_sha256: null,
      chain_sha256: null,
      stored_body: stored,
      accepted_lossless: false,
      intake_complete: false,
      source_complete: false,
      prefix_only: false,
      reconstructable: false,
      source_map: buildSourceMap([], {
        charLength: 0,
        byteLength: 0,
        wordCount: 0,
        sourceSha256: null,
        coverageOverride: "MISMATCH",
      }),
      explicit_evidence: [],
      evidence_status: "NOT_SCANNED",
      evidence_scan_status: "NOT_SCANNED",
      evidence_lines_skipped: 0,
      chunk_count: 0,
      refusal: { code: "CUSTODY_MISMATCH", stored_body: stored, recoverable: false, silent_truncation: false },
    });
    return this.finalize(ir);
  }

  async verifyPrefix() {
    const rebuilt = createHasher();
    for (const meta of this.chunkMetas) {
      const blob = await this.custody.readBlob(this.sessionId, meta.rel);
      if (!blob || sha256Bytes(blob) !== meta.sha256) return false;
      rebuilt.update(blob);
    }
    const tailRel = `blobs/tails/${this.tailSha256}.utf8`;
    const tail = await this.custody.readBlob(this.sessionId, tailRel);
    if (!tail) return this.tailSha256 === sha256Text("") && this.pending === "";
    if (sha256Bytes(tail) !== this.tailSha256) return false;
    rebuilt.update(tail);
    return rebuilt.hexdigest() === this.acceptedSha256 && decoder.decode(tail) === this.pending;
  }

  async finalize(ir) {
    const frozen = freezeIr(ir);
    const encoded = utf8Bytes(stableStringify(frozen));
    await this.custody.writeJson(this.sessionId, "ir.json", frozen);
    await this.custody.appendJournal(this.sessionId, {
      kind: "SEAL",
      terminal_status: frozen.status,
      ir_sha256: sha256Bytes(encoded),
      silent_truncation: false,
    });
    this.status = frozen.status;
    this.terminalIr = frozen;
    await this.writeIndex();
    return frozen;
  }

  memory() {
    return memoryBlock({
      maxResidentChars: this.maxResidentChars,
      peakPendingChars: this.peakPendingChars,
      pressureEvents: this.pressureEvents.map((event) => ({ ...event })),
      spilledChunks: this.spilledChunks,
    });
  }

  async writeIndex() {
    const doc = {
      session_id: this.sessionId,
      status: this.status,
      silent_truncation: false,
      semantic_judgment: "NOT_A_PASS",
      chunk_count: this.chunkMetas.length,
      chunks: this.chunkMetas,
      tail_sha256: this.tailSha256,
      attempted_word_count: this.attemptedWordCount,
      attempted_char_count: this.attemptedCharCount,
      attempted_sha256_status: this.attemptedSha256Status,
      stored_body: this.status !== "REFUSED" && this.status !== "REFUSED_IN_PROGRESS",
      evidence: (this.terminalIr || {}).explicit_evidence || [],
    };
    await this.custody.writeJson(this.sessionId, "index.json", doc);
    if (!this.index) {
      this.indexPersisted = true;
      return;
    }
    try {
      await this.index.mirror(doc);
      this.indexPersisted = true;
    } catch {
      this.indexPersisted = false;
    }
  }

  pressureOk() {
    try {
      return Boolean(this.pressure(cpLen(this.pending)));
    } catch (error) {
      throw new MassiveError("PRESSURE_HOOK_FAILED", "pressure hook failed closed");
    }
  }

  notePending() {
    this.peakPendingChars = Math.max(this.peakPendingChars, cpLen(this.pending));
  }

  ack(rejectedCharCount) {
    const [pendingWords] = countWordStarts(this.pending, this.insideWord);
    const storedBody =
      ((this.chunkMetas.length > 0 || this.pending.length > 0) &&
        this.status !== "REFUSED" &&
        this.status !== "REFUSED_IN_PROGRESS") ||
      false;
    return {
      protocol: PROTOCOL,
      session_id: this.sessionId,
      status: this.status,
      silent_truncation: false,
      stored_body: this.status === "REFUSED" || this.status === "REFUSED_IN_PROGRESS" ? false : storedBody,
      durable_char_end: this.chunkChars + cpLen(this.pending),
      rejected_char_count: rejectedCharCount,
      attempted_word_count: this.status === "INCOMPLETE" ? this.committedWords + pendingWords : this.attemptedWordCount,
      semantic_judgment: "NOT_A_PASS",
      semantic_engine: "NOT_INTEGRATED",
      waits_for: "F3E_FREEZE",
      index_persisted: this.indexPersisted,
    };
  }

  snapshot() {
    return {
      pending: this.pending,
      insideWord: this.insideWord,
      charOrigin: this.charOrigin,
      byteOrigin: this.byteOrigin,
      wordOrigin: this.wordOrigin,
      nextIndex: this.nextIndex,
      chunkMetas: this.chunkMetas.map((meta) => ({ ...meta })),
      chunkChars: this.chunkChars,
      chunkBytes: this.chunkBytes,
      committedWords: this.committedWords,
      tailSha256: this.tailSha256,
      acceptedSha256: this.acceptedSha256,
      peakPendingChars: this.peakPendingChars,
      pressureEvents: this.pressureEvents.map((event) => ({ ...event })),
      spilledChunks: this.spilledChunks,
      unhashed: this.unhashed,
      hasher: this.hasher.copy(),
      countInside: this.countInside,
    };
  }

  restore(snap) {
    this.pending = snap.pending;
    this.insideWord = snap.insideWord;
    this.charOrigin = snap.charOrigin;
    this.byteOrigin = snap.byteOrigin;
    this.wordOrigin = snap.wordOrigin;
    this.nextIndex = snap.nextIndex;
    this.chunkMetas = snap.chunkMetas.map((meta) => ({ ...meta }));
    this.chunkChars = snap.chunkChars;
    this.chunkBytes = snap.chunkBytes;
    this.committedWords = snap.committedWords;
    this.tailSha256 = snap.tailSha256;
    this.acceptedSha256 = snap.acceptedSha256;
    this.peakPendingChars = Math.max(this.peakPendingChars, snap.peakPendingChars);
    this.pressureEvents = snap.pressureEvents.map((event) => ({ ...event }));
    this.spilledChunks = snap.spilledChunks;
    this.unhashed = snap.unhashed;
    this.hasher = snap.hasher.copy();
    this.countInside = snap.countInside;
  }
}

export async function openSession(custody, sessionId, options = {}) {
  if (await custody.exists(sessionId)) throw new MassiveError("SESSION_EXISTS", "session already has a journal");
  const session = new MassiveSession(custody, sessionId, options);
  await custody.appendJournal(sessionId, {
    kind: "OPEN",
    session_id: sessionId,
    ir_version: IR_VERSION,
    word_cap: session.wordCap,
    target_chars: session.targetChars,
    hard_chars: session.hardChars,
    max_resident_chars: session.maxResidentChars,
    silent_truncation: false,
  });
  await session.journalCommit([]);
  return session;
}

export async function resumeSession(custody, sessionId, options = {}) {
  const records = await custody.readJournal(sessionId);
  const folded = foldJournal(records);
  const target = options.targetChars ?? folded.target_chars;
  const hard = options.hardChars ?? folded.hard_chars;
  const maxResident = options.maxResidentChars ?? folded.max_resident_chars;
  const wordCap = options.wordCap ?? folded.word_cap;
  if (
    target !== folded.target_chars ||
    hard !== folded.hard_chars ||
    maxResident !== folded.max_resident_chars ||
    wordCap !== folded.word_cap
  ) {
    throw new MassiveError("CONFIG_MISMATCH", "resume config does not match OPEN");
  }
  const session = new MassiveSession(custody, sessionId, {
    targetChars: target,
    hardChars: hard,
    maxResidentChars: maxResident,
    wordCap,
    pressure: options.pressure,
    index: options.index,
  });
  session.status = folded.status;
  session.chunkMetas = folded.chunks.map((meta) => ({ ...meta }));
  session.chunkChars = folded.chunk_chars;
  session.chunkBytes = folded.chunk_bytes;
  session.committedWords = folded.committed_words;
  session.tailSha256 = folded.tail.sha256;
  session.acceptedSha256 = folded.accepted_sha256;
  session.attemptedWordCount = folded.attempted_word_count;
  session.attemptedCharCount = folded.attempted_char_count;
  session.attemptedSha256 = folded.attempted_sha256;
  session.attemptedSha256Status = folded.attempted_sha256_status;
  session.hasherLive = false;
  session.blobsCleared = folded.blobs_cleared;
  session.countInside = Boolean(folded.count_inside);
  session.nextIndex = session.chunkMetas.length;
  session.charOrigin = session.chunkChars;
  session.byteOrigin = session.chunkBytes;
  session.wordOrigin = session.committedWords;
  session.insideWord = Boolean(folded.tail.start_inside_word);
  if (session.status === "REFUSED_IN_PROGRESS" && !session.blobsCleared) {
    await custody.wipeBlobs(sessionId);
    await custody.appendJournal(sessionId, { kind: "BLOBS_CLEARED", silent_truncation: false });
    session.blobsCleared = true;
  }
  if (folded.terminal_ir_sha) {
    const ir = await custody.readJson(sessionId, "ir.json");
    if (!ir) session.status = "CUSTODY_MISMATCH";
    else {
      const encoded = utf8Bytes(stableStringify(ir));
      if (sha256Bytes(encoded) !== folded.terminal_ir_sha) session.status = "CUSTODY_MISMATCH";
      else {
        session.terminalIr = ir;
        session.status = ir.status;
      }
    }
  } else if (session.status === "INCOMPLETE" || session.status === "MEMORY_PRESSURE_HALTED") {
    const tailBlob = await custody.readBlob(sessionId, folded.tail.rel);
    session.pending = tailBlob ? decoder.decode(tailBlob) : "";
    session.hasher = createHasher();
    let prefixOk = true;
    for (const meta of session.chunkMetas) {
      const blob = await custody.readBlob(sessionId, meta.rel);
      if (!blob || sha256Bytes(blob) !== meta.sha256) {
        prefixOk = false;
        break;
      }
      session.hasher.update(blob);
    }
    if (tailBlob) {
      if (sha256Bytes(tailBlob) !== session.tailSha256) prefixOk = false;
      else session.hasher.update(tailBlob);
    } else if (session.tailSha256 !== sha256Text("")) prefixOk = false;
    if (!prefixOk || session.hasher.hexdigest() !== session.acceptedSha256) session.status = "CUSTODY_MISMATCH";
    else session.hasherLive = true;
  }
  return session;
}

export function foldJournal(records) {
  if (!records.length || records[0].kind !== "OPEN") {
    throw new MassiveError("SESSION_MISSING", "journal has no OPEN record");
  }
  const opened = records[0];
  const state = {
    target_chars: opened.target_chars,
    hard_chars: opened.hard_chars,
    max_resident_chars: opened.max_resident_chars,
    word_cap: opened.word_cap,
    status: "INCOMPLETE",
    chunks: [],
    tail: emptyTail(),
    committed_words: 0,
    chunk_chars: 0,
    chunk_bytes: 0,
    accepted_sha256: sha256Text(""),
    attempted_word_count: 0,
    attempted_char_count: 0,
    attempted_sha256: sha256Text(""),
    attempted_sha256_status: "KNOWN",
    blobs_cleared: false,
    count_inside: false,
    terminal_ir_sha: null,
  };
  for (const record of records.slice(1)) {
    const kind = record.kind;
    if (kind === "COMMIT") {
      if (state.status !== "INCOMPLETE") state.status = "CUSTODY_MISMATCH";
      else {
        state.chunks = state.chunks.concat(record.chunks);
        state.tail = record.tail;
        state.committed_words = record.committed_words;
        state.chunk_chars = record.chunk_chars;
        state.chunk_bytes = record.chunk_bytes;
        state.accepted_sha256 = record.accepted_sha256;
        state.attempted_sha256 = record.accepted_sha256;
        state.attempted_word_count = record.committed_words;
        state.attempted_char_count = record.chunk_chars + record.tail.char_length;
      }
    } else if (kind === "REFUSE") {
      state.status = "REFUSED_IN_PROGRESS";
      state.chunks = [];
      state.tail = emptyTail();
      state.committed_words = 0;
      state.chunk_chars = 0;
      state.chunk_bytes = 0;
      state.accepted_sha256 = sha256Text("");
      state.attempted_word_count = record.attempted_word_count;
      state.attempted_char_count = record.attempted_char_count;
      state.attempted_sha256 = record.attempted_sha256 ?? null;
      state.attempted_sha256_status = record.attempted_sha256_status || "UNKNOWN";
      state.count_inside = Boolean(record.count_inside);
      state.blobs_cleared = false;
    } else if (kind === "BLOBS_CLEARED") {
      if (state.status !== "REFUSED_IN_PROGRESS") state.status = "CUSTODY_MISMATCH";
      else state.blobs_cleared = true;
    } else if (kind === "COUNT") {
      if (state.status !== "REFUSED_IN_PROGRESS") state.status = "CUSTODY_MISMATCH";
      else {
        state.attempted_word_count = record.attempted_word_count;
        state.attempted_char_count = record.attempted_char_count;
        state.attempted_sha256 = record.attempted_sha256 ?? null;
        state.attempted_sha256_status = record.attempted_sha256_status || "UNKNOWN";
        state.count_inside = Boolean(record.count_inside);
      }
    } else if (kind === "HALT") {
      if (state.status !== "INCOMPLETE") state.status = "CUSTODY_MISMATCH";
      else state.status = "MEMORY_PRESSURE_HALTED";
    } else if (kind === "SEAL") {
      state.status = record.terminal_status;
      state.terminal_ir_sha = record.ir_sha256;
    } else state.status = "CUSTODY_MISMATCH";
  }
  return state;
}
