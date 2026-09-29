/** Node checks for Large Paste intake. No browser, no semantic engine. */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MassiveError,
  chainUpdate,
  countWordStarts,
  createHandleCustody,
  createIdbIndex,
  createMemoryCustody,
  createMockDb,
  handleIngestMessage,
  isSemanticPass,
  nextChunkEnd,
  openSession,
  resumeSession,
  scanExplicitEvidence,
  sha256Text,
} from "../src/massive/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const vectors = JSON.parse(readFileSync(resolve(root, "data/massive/vectors.json"), "utf8"));
let failed = 0;

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok ${name}`);
    })
    .catch((error) => {
      failed += 1;
      console.error(`not ok ${name}`);
      console.error(error);
    });
}

class MemDir {
  constructor() {
    this.entries = new Map();
    this.kind = "directory";
  }

  async getDirectoryHandle(name, opts = {}) {
    const cur = this.entries.get(name);
    if (!cur) {
      if (!opts.create) throw new Error("NotFound");
      const dir = new MemDir();
      this.entries.set(name, { kind: "dir", dir });
      return dir;
    }
    if (cur.kind !== "dir") throw new Error("TypeMismatch");
    return cur.dir;
  }

  async getFileHandle(name, opts = {}) {
    let cur = this.entries.get(name);
    if (!cur) {
      if (!opts.create) throw new Error("NotFound");
      cur = { kind: "file", data: new Uint8Array() };
      this.entries.set(name, cur);
    }
    if (cur.kind !== "file") throw new Error("TypeMismatch");
    return fileHandle(cur);
  }

  async removeEntry(name) {
    if (!this.entries.has(name)) throw new Error("NotFound");
    this.entries.delete(name);
  }

  async *values() {
    for (const [name, entry] of this.entries) {
      if (entry.kind === "dir") {
        entry.dir.name = name;
        yield entry.dir;
      } else {
        yield { kind: "file", name };
      }
    }
  }
}

function fileHandle(cur) {
  return {
    async createSyncAccessHandle() {
      return {
        getSize() {
          return cur.data.length;
        },
        read(buf, opts) {
          const at = opts.at;
          const slice = cur.data.subarray(at, at + buf.length);
          buf.set(slice);
          return slice.length;
        },
        write(bytes, opts) {
          const at = opts.at;
          const next = new Uint8Array(Math.max(cur.data.length, at + bytes.length));
          next.set(cur.data);
          next.set(bytes, at);
          cur.data = next;
        },
        truncate(size) {
          cur.data = cur.data.slice(0, size);
        },
        flush() {},
        close() {},
      };
    },
    async getFile() {
      const copy = new Uint8Array(cur.data);
      return { async arrayBuffer() { return copy.buffer; } };
    },
  };
}

await check("sha256 matches node crypto and frozen vectors", async () => {
  for (const [text, digest] of Object.entries(vectors.sha256)) {
    assert.equal(sha256Text(text), digest);
    assert.equal(createHash("sha256").update(text, "utf8").digest("hex"), digest);
  }
  let prev = null;
  for (const step of vectors.chain) {
    prev = chainUpdate(prev, step.sha256);
    assert.equal(prev, step.chain);
  }
});

await check("whitespace, chunks, and evidence match the oracle vectors", async () => {
  for (const row of vectors.words) {
    const [count, inside] = countWordStarts(row.text, row.start_inside);
    assert.equal(count, row.count);
    assert.equal(inside, row.inside);
  }
  for (const row of vectors.chunks) {
    const end = nextChunkEnd(row.text, {
      target: row.target,
      hard: row.hard,
      seal: row.seal,
      startInsideWord: row.start_inside_word,
    });
    assert.equal(end, row.end);
  }
  for (const row of vectors.evidence) {
    const scanned = scanExplicitEvidence([[0, row.text]], row.line_max);
    assert.equal(scanned.evidence_status, row.evidence_status);
    assert.equal(scanned.evidence_scan_status, row.evidence_scan_status);
    assert.deepEqual(
      scanned.explicit_evidence.map((item) => item.rule),
      row.items.map((item) => item.rule),
    );
    assert.deepEqual(
      scanned.explicit_evidence.map((item) => [item.char_start, item.char_end, item.text]),
      row.items.map((item) => [item.char_start, item.char_end, item.text]),
    );
  }
});

await check("memory sessions match oracle IR fields", async () => {
  for (const row of vectors.sessions) {
    const custody = createMemoryCustody();
    const session = await openSession(custody, row.id, {
      wordCap: row.word_cap,
      targetChars: row.target,
      hardChars: row.hard,
      maxResidentChars: row.max,
    });
    for (const part of row.parts) await session.append(part);
    const ir = await session.seal();
    assert.equal(ir.status, row.expect.status);
    assert.equal(ir.word_count, row.expect.word_count);
    assert.equal(ir.attempted_word_count, row.expect.attempted_word_count);
    assert.equal(ir.source_sha256, row.expect.source_sha256);
    assert.equal(ir.attempted_sha256, row.expect.attempted_sha256);
    assert.equal(ir.stored_body, row.expect.stored_body);
    assert.equal(ir.silent_truncation, false);
    assert.equal(ir.semantic_judgment, "NOT_A_PASS");
    assert.equal(isSemanticPass(ir), false);
    assert.equal(ir.source_map.coverage, row.expect.coverage);
    assert.equal(ir.chain_sha256, row.expect.chain_sha256);
    assert.deepEqual(
      ir.source_map.spans.map((span) => [span.char_start, span.char_end, span.sha256]),
      row.expect.spans.map((span) => [span.char_start, span.char_end, span.sha256]),
    );
    const again = await session.seal();
    assert.equal(again, ir);
  }
});

await check("resume, torn tail, corrupt blob, and pressure", async () => {
  const custody = createMemoryCustody();
  const session = await openSession(custody, "sess-live1", {
    wordCap: 20,
    targetChars: 8,
    hardChars: 12,
    maxResidentChars: 12,
  });
  await session.append("alpha beta");
  custody.injectTornTail("sess-live1");
  const resumed = await resumeSession(custody, "sess-live1");
  assert.equal(resumed.status, "INCOMPLETE");
  await resumed.append(" gamma");
  const sealed = await resumed.seal();
  assert.equal(sealed.status, "READY_FOR_F3E");
  assert.equal(sealed.silent_truncation, false);

  const brokenCustody = createMemoryCustody();
  const broken = await openSession(brokenCustody, "sess-miss1", {
    wordCap: 10,
    targetChars: 4,
    hardChars: 8,
    maxResidentChars: 8,
  });
  await broken.append("alpha beta gamma");
  const index = await brokenCustody.readJson("sess-miss1", "index.json");
  const rel = index.chunks[0].rel;
  brokenCustody.writeBlob = async () => {
    throw new Error("nope");
  };
  const original = brokenCustody.readBlob;
  brokenCustody.readBlob = async (id, path) => (path === rel ? null : original(id, path));
  const mismatch = await resumeSession(brokenCustody, "sess-miss1");
  assert.equal(mismatch.status, "CUSTODY_MISMATCH");
  const mismatchIr = await mismatch.seal();
  assert.equal(mismatchIr.status, "CUSTODY_MISMATCH");
  assert.notEqual(mismatchIr.status, "READY_FOR_F3E");

  const pressured = await openSession(createMemoryCustody(), "sess-halt1", {
    wordCap: 10,
    targetChars: 4,
    hardChars: 8,
    maxResidentChars: 8,
    pressure: (resident) => resident <= 6,
  });
  const ack = await pressured.append("hello world");
  assert.equal(ack.status, "MEMORY_PRESSURE_HALTED");
  assert.equal(ack.rejected_char_count, "hello world".length);
  assert.equal(ack.silent_truncation, false);
  const more = await pressured.append("more");
  assert.equal(more.rejected_char_count, 4);
  const halted = await pressured.seal();
  assert.equal(halted.status, "MEMORY_PRESSURE_HALTED");
  assert.equal(halted.intake_complete, false);
  assert.equal(halted.semantic_judgment, "NOT_A_PASS");
});

await check("over-budget refusal keeps no body and unknown sha after resume", async () => {
  const custody = createMemoryCustody();
  const session = await openSession(custody, "sess-over1", {
    wordCap: 2,
    targetChars: 32,
    hardChars: 64,
    maxResidentChars: 64,
  });
  await session.append("one two");
  const ack = await session.append(" three");
  assert.equal(ack.status, "REFUSED_IN_PROGRESS");
  assert.equal(ack.stored_body, false);
  assert.equal(await custody.blobCount("sess-over1"), 0);
  const resumed = await resumeSession(custody, "sess-over1");
  await resumed.append(" four");
  const ir = await resumed.seal();
  assert.equal(ir.attempted_word_count, 4);
  assert.equal(ir.attempted_sha256_status, "UNKNOWN");
  assert.equal(ir.attempted_sha256, null);
  assert.equal(ir.semantic_judgment, "NOT_A_PASS");
});

await check("protocol host and idb mirror do not store bodies", async () => {
  const db = createMockDb();
  const index = createIdbIndex(db);
  const host = {
    kind: "memory",
    custody: createMemoryCustody(),
    sessions: new Map(),
    index,
    pressure: null,
  };
  const opened = await handleIngestMessage(host, {
    protocol: "spe.massive-ingest.v1",
    op: "open",
    session_id: "sess-host1",
    word_cap: 5,
    target_chars: 8,
    hard_chars: 16,
    max_resident_chars: 16,
  });
  assert.equal(opened.ok, true);
  assert.equal(opened.semantic_judgment, "NOT_A_PASS");
  const appended = await handleIngestMessage(host, {
    protocol: "spe.massive-ingest.v1",
    op: "append",
    session_id: "sess-host1",
    text: "must keep words",
  });
  assert.equal(appended.ok, true);
  assert.equal(appended.silent_truncation, false);
  const sealed = await handleIngestMessage(host, {
    protocol: "spe.massive-ingest.v1",
    op: "seal",
    session_id: "sess-host1",
  });
  assert.equal(sealed.ir.status, "READY_FOR_F3E");
  assert.equal(isSemanticPass(sealed.ir), false);
  const mirrored = await index.readSession("sess-host1");
  assert.equal(mirrored.session_id, "sess-host1");
  assert.equal(JSON.stringify(db.dump()).includes("must keep words"), false);
  const bad = await handleIngestMessage(host, { protocol: "nope", op: "open" });
  assert.equal(bad.ok, false);
  assert.equal(bad.semantic_judgment, "NOT_A_PASS");
});

await check("opfs handle custody round-trips a chunk", async () => {
  const custody = createHandleCustody(new MemDir());
  const session = await openSession(custody, "sess-opfs1", {
    wordCap: 8,
    targetChars: 4,
    hardChars: 8,
    maxResidentChars: 8,
  });
  await session.append("alpha beta");
  const ir = await session.seal();
  assert.equal(ir.status, "READY_FOR_F3E");
  const resumed = await resumeSession(custody, "sess-opfs1");
  assert.equal(resumed.terminalIr.source_sha256, ir.source_sha256);
  assert.equal(await custody.blobCount("sess-opfs1") > 0, true);
});

await check("bad session id and pass status are refused", async () => {
  await assert.rejects(openSession(createMemoryCustody(), "short"), (error) => {
    assert.equal(error instanceof MassiveError, true);
    assert.equal(error.code, "INVALID_SESSION_ID");
    return true;
  });
});

await check("worker source stays outside lane A", async () => {
  const worker = readFileSync(resolve(root, "apps/web/src/massive/ingest.worker.mjs"), "utf8");
  const tree = readFileSync(resolve(root, "apps/web/src/massive/session.mjs"), "utf8");
  for (const token of ["spe_runtime/xcat", "spe_runtime/k3", "spe_runtime/quality", "engine.worker", "PromptEffectPlan"]) {
    assert.equal(worker.includes(token), false);
    assert.equal(tree.includes(token), false);
  }
});

await check("default limits stream one hundred thousand words without truncation", async () => {
  const custody = createMemoryCustody();
  const session = await openSession(custody, "sess-stream");
  const piece = "w ".repeat(20_000);
  for (let i = 0; i < 5; i += 1) {
    const ack = await session.append(piece);
    assert.equal(ack.status, "INCOMPLETE");
    assert.equal(ack.rejected_char_count, 0);
    assert.equal(ack.silent_truncation, false);
  }
  const ir = await session.seal();
  assert.equal(ir.status, "READY_FOR_F3E");
  assert.equal(ir.word_count, 100_000);
  assert.equal(ir.source_map.coverage, "COMPLETE");
  assert.equal(ir.semantic_judgment, "NOT_A_PASS");
  assert.equal(session.peakPendingChars <= session.maxResidentChars, true);
});

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("massive ingest ok");
