/** In-memory custody with the same journal rules as the filesystem oracle. */

import { MassiveError } from "./errors.mjs";
import { stableStringify } from "./json.mjs";

const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;
const BLOB_REL = /^blobs\/(?:chunks\/\d{8}-[0-9a-f]{64}|tails\/[0-9a-f]{64})\.utf8$/;

export function validateSessionId(sessionId) {
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) {
    throw new MassiveError("INVALID_SESSION_ID", "session id is not a safe token");
  }
  return sessionId;
}

export function createMemoryCustody() {
  const journals = new Map();
  const blobs = new Map();
  const jsons = new Map();

  const key = (sessionId, rel) => `${validateSessionId(sessionId)}/${rel}`;

  return {
    kind: "memory",
    async exists(sessionId) {
      return journals.has(validateSessionId(sessionId));
    },
    async appendJournal(sessionId, record) {
      const id = validateSessionId(sessionId);
      const line = `${stableStringify(record)}\n`;
      journals.set(id, (journals.get(id) || "") + line);
    },
    async readJournal(sessionId) {
      const id = validateSessionId(sessionId);
      const text = journals.get(id);
      if (text == null) throw new MassiveError("SESSION_MISSING", "no journal for session");
      const out = [];
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
          out.push(JSON.parse(line));
        } catch {
          break;
        }
      }
      return out;
    },
    async writeBlob(sessionId, rel, data) {
      if (!BLOB_REL.test(rel)) throw new MassiveError("BAD_PATH", "blob path is not in the custody layout");
      blobs.set(key(sessionId, rel), new Uint8Array(data));
    },
    async readBlob(sessionId, rel) {
      if (!BLOB_REL.test(rel)) throw new MassiveError("BAD_PATH", "blob path is not in the custody layout");
      const data = blobs.get(key(sessionId, rel));
      return data ? new Uint8Array(data) : null;
    },
    async writeJson(sessionId, name, payload) {
      if (name !== "ir.json" && name !== "index.json") {
        throw new MassiveError("BAD_PATH", "refusing to write an unknown custody file");
      }
      jsons.set(key(sessionId, name), stableStringify(payload));
    },
    async readJson(sessionId, name) {
      if (name !== "ir.json" && name !== "index.json") {
        throw new MassiveError("BAD_PATH", "refusing to read an unknown custody file");
      }
      const raw = jsons.get(key(sessionId, name));
      return raw == null ? null : JSON.parse(raw);
    },
    async wipeBlobs(sessionId) {
      const prefix = `${validateSessionId(sessionId)}/blobs/`;
      for (const blobKey of [...blobs.keys()]) {
        if (blobKey.startsWith(prefix)) blobs.delete(blobKey);
      }
    },
    async blobCount(sessionId) {
      const prefix = `${validateSessionId(sessionId)}/blobs/`;
      let count = 0;
      for (const blobKey of blobs.keys()) if (blobKey.startsWith(prefix)) count += 1;
      return count;
    },
    injectTornTail(sessionId) {
      const id = validateSessionId(sessionId);
      journals.set(id, `${journals.get(id) || ""}{"kind":"COMMIT","torn":`);
    },
  };
}
