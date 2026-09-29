/** Worker protocol spe.massive-ingest.v1. Does not call the semantic engine. */

import { PROTOCOL } from "./constants.mjs";
import { MassiveError } from "./errors.mjs";
import { createMemoryCustody } from "./memoryStore.mjs";
import { openSession, resumeSession } from "./session.mjs";

export function createMemoryHost(options = {}) {
  return {
    kind: "memory",
    custody: options.custody || createMemoryCustody(),
    sessions: new Map(),
    index: options.index || null,
    pressure: options.pressure,
  };
}

export async function handleIngestMessage(host, message) {
  try {
    if (!message || message.protocol !== PROTOCOL) {
      throw new MassiveError("BAD_PROTOCOL", "unexpected ingest protocol");
    }
    const op = message.op;
    if (op === "open") return ok(await openHost(host, message));
    if (op === "append") return ok(await appendHost(host, message));
    if (op === "seal") return ok(await sealHost(host, message));
    if (op === "resume") return ok(await resumeHost(host, message));
    if (op === "status") return ok(await statusHost(host, message));
    throw new MassiveError("BAD_OP", "unsupported ingest op");
  } catch (error) {
    const code = error instanceof MassiveError ? error.code : "FAILED";
    const reason = error instanceof MassiveError ? error.reason : "ingest failed";
    return {
      protocol: PROTOCOL,
      ok: false,
      op: message?.op || null,
      code,
      reason,
      silent_truncation: false,
      semantic_judgment: "NOT_A_PASS",
      semantic_engine: "NOT_INTEGRATED",
    };
  }
}

function ok(body) {
  return { protocol: PROTOCOL, ok: true, silent_truncation: false, semantic_judgment: "NOT_A_PASS", ...body };
}

function opts(host, message) {
  return {
    targetChars: message.target_chars,
    hardChars: message.hard_chars,
    maxResidentChars: message.max_resident_chars,
    wordCap: message.word_cap,
    pressure: host.pressure,
    index: host.index,
  };
}

async function openHost(host, message) {
  const session = await openSession(host.custody, message.session_id, opts(host, message));
  host.sessions.set(message.session_id, session);
  return { op: "open", ...session.statusView() };
}

async function appendHost(host, message) {
  const session = await live(host, message.session_id);
  const ack = await session.append(message.text ?? "");
  return { op: "append", ...ack };
}

async function sealHost(host, message) {
  const session = await live(host, message.session_id);
  const ir = await session.seal();
  return {
    op: "seal",
    session_id: message.session_id,
    status: ir.status,
    ir,
  };
}

async function resumeHost(host, message) {
  const session = await resumeSession(host.custody, message.session_id, opts(host, message));
  host.sessions.set(message.session_id, session);
  return { op: "resume", ...session.statusView() };
}

async function statusHost(host, message) {
  const session = await live(host, message.session_id);
  return { op: "status", ...session.statusView() };
}

async function live(host, sessionId) {
  const existing = host.sessions.get(sessionId);
  if (existing) return existing;
  const session = await resumeSession(host.custody, sessionId, { index: host.index, pressure: host.pressure });
  host.sessions.set(sessionId, session);
  return session;
}
