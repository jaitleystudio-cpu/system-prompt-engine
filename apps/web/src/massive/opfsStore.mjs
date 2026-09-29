/** OPFS custody. Journal append uses a sync access handle when the worker provides one. */

import { MassiveError } from "./errors.mjs";
import { stableStringify } from "./json.mjs";
import { validateSessionId } from "./memoryStore.mjs";

const BLOB_REL = /^blobs\/(?:chunks\/\d{8}-[0-9a-f]{64}|tails\/[0-9a-f]{64})\.utf8$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: false });

async function sessionDir(root, sessionId) {
  const sessions = await root.getDirectoryHandle("sessions", { create: true });
  return sessions.getDirectoryHandle(validateSessionId(sessionId), { create: true });
}

async function nestedDir(dir, parts, create) {
  let current = dir;
  for (const part of parts) current = await current.getDirectoryHandle(part, { create });
  return current;
}

function splitRel(rel) {
  if (!BLOB_REL.test(rel)) throw new MassiveError("BAD_PATH", "blob path is not in the custody layout");
  const parts = rel.split("/");
  return { dirParts: parts.slice(0, -1), name: parts[parts.length - 1] };
}

async function readFileBytes(fileHandle) {
  if (fileHandle.createSyncAccessHandle) {
    const access = await fileHandle.createSyncAccessHandle();
    try {
      const size = access.getSize();
      const buf = new Uint8Array(size);
      if (size) access.read(buf, { at: 0 });
      return buf;
    } finally {
      access.close();
    }
  }
  const file = await fileHandle.getFile();
  return new Uint8Array(await file.arrayBuffer());
}

async function writeFileBytes(fileHandle, bytes) {
  if (fileHandle.createSyncAccessHandle) {
    const access = await fileHandle.createSyncAccessHandle();
    try {
      access.truncate(0);
      if (bytes.length) access.write(bytes, { at: 0 });
      access.flush();
    } finally {
      access.close();
    }
    return;
  }
  const writable = await fileHandle.createWritable();
  await writable.write(bytes);
  await writable.close();
}

async function appendFileBytes(fileHandle, bytes) {
  if (fileHandle.createSyncAccessHandle) {
    const access = await fileHandle.createSyncAccessHandle();
    try {
      const at = access.getSize();
      access.write(bytes, { at });
      access.flush();
    } finally {
      access.close();
    }
    return;
  }
  const existing = await readFileBytes(fileHandle);
  const joined = new Uint8Array(existing.length + bytes.length);
  joined.set(existing, 0);
  joined.set(bytes, existing.length);
  await writeFileBytes(fileHandle, joined);
}

export function createHandleCustody(root) {
  return {
    kind: "opfs",
    async exists(sessionId) {
      try {
        const sessions = await root.getDirectoryHandle("sessions");
        const dir = await sessions.getDirectoryHandle(validateSessionId(sessionId));
        await dir.getFileHandle("journal.jsonl");
        return true;
      } catch {
        return false;
      }
    },
    async appendJournal(sessionId, record) {
      const dir = await sessionDir(root, sessionId);
      const handle = await dir.getFileHandle("journal.jsonl", { create: true });
      await appendFileBytes(handle, encoder.encode(`${stableStringify(record)}\n`));
    },
    async readJournal(sessionId) {
      const dir = await sessionDir(root, sessionId);
      let handle;
      try {
        handle = await dir.getFileHandle("journal.jsonl");
      } catch {
        throw new MassiveError("SESSION_MISSING", "no journal for session");
      }
      const text = decoder.decode(await readFileBytes(handle));
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
      const { dirParts, name } = splitRel(rel);
      const dir = await nestedDir(await sessionDir(root, sessionId), dirParts, true);
      const handle = await dir.getFileHandle(name, { create: true });
      await writeFileBytes(handle, data instanceof Uint8Array ? data : new Uint8Array(data));
    },
    async readBlob(sessionId, rel) {
      const { dirParts, name } = splitRel(rel);
      try {
        const dir = await nestedDir(await sessionDir(root, sessionId), dirParts, false);
        const handle = await dir.getFileHandle(name);
        return readFileBytes(handle);
      } catch (error) {
        if (error instanceof MassiveError) throw error;
        return null;
      }
    },
    async writeJson(sessionId, name, payload) {
      if (name !== "ir.json" && name !== "index.json") {
        throw new MassiveError("BAD_PATH", "refusing to write an unknown custody file");
      }
      const dir = await sessionDir(root, sessionId);
      const handle = await dir.getFileHandle(name, { create: true });
      await writeFileBytes(handle, encoder.encode(stableStringify(payload)));
    },
    async readJson(sessionId, name) {
      if (name !== "ir.json" && name !== "index.json") {
        throw new MassiveError("BAD_PATH", "refusing to read an unknown custody file");
      }
      try {
        const dir = await sessionDir(root, sessionId);
        const handle = await dir.getFileHandle(name);
        return JSON.parse(decoder.decode(await readFileBytes(handle)));
      } catch {
        return null;
      }
    },
    async wipeBlobs(sessionId) {
      const dir = await sessionDir(root, sessionId);
      try {
        await dir.removeEntry("blobs", { recursive: true });
      } catch {
        /* already gone */
      }
    },
    async blobCount(sessionId) {
      try {
        const dir = await sessionDir(root, sessionId);
        const blobs = await dir.getDirectoryHandle("blobs");
        return countFiles(blobs);
      } catch {
        return 0;
      }
    },
  };
}

async function countFiles(dir) {
  let count = 0;
  for await (const entry of dir.values()) {
    if (entry.kind === "file") count += 1;
    else if (entry.kind === "directory") count += await countFiles(entry);
  }
  return count;
}

export async function openBrowserRoot() {
  const storage = globalThis.navigator?.storage;
  if (!storage?.getDirectory) {
    throw new MassiveError("OPFS_UNAVAILABLE", "origin private file system is not available");
  }
  const root = await storage.getDirectory();
  const spe = await root.getDirectoryHandle("spe-massive", { create: true });
  return createHandleCustody(spe);
}
