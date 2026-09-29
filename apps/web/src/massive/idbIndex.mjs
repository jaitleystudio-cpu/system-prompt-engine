/** IndexedDB metadata mirror. Bodies stay in OPFS. The journal remains source of truth. */

const DB_NAME = "spe_massive_v1";
const DB_VERSION = 1;

export function openMassiveDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "session_id" });
      if (!db.objectStoreNames.contains("chunks")) db.createObjectStore("chunks");
      if (!db.objectStoreNames.contains("evidence")) db.createObjectStore("evidence");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createIdbIndex(db) {
  return {
    async mirror(doc) {
      const tx = db.transaction(["sessions", "chunks", "evidence"], "readwrite");
      const sessions = tx.objectStore("sessions");
      const { chunks, evidence, ...session } = doc;
      await settle(sessions.put(session));
      const chunkStore = tx.objectStore("chunks");
      const evidenceStore = tx.objectStore("evidence");
      for (const meta of chunks || []) {
        const { rel, ...publicMeta } = meta;
        void rel;
        await settle(chunkStore.put(publicMeta, [doc.session_id, meta.index]));
      }
      await settle(evidenceStore.put(evidence || [], doc.session_id));
      await txDone(tx);
    },
    async readSession(sessionId) {
      const tx = db.transaction(["sessions"], "readonly");
      const value = await settle(tx.objectStore("sessions").get(sessionId));
      await txDone(tx);
      return value || null;
    },
  };
}

function settle(request) {
  if (request && typeof request.then === "function") return request;
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx) {
  if (tx.done && typeof tx.done.then === "function") return tx.done;
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("aborted"));
    tx.onerror = () => reject(tx.error);
  });
}

export function createMockDb() {
  const sessions = new Map();
  const chunks = new Map();
  const evidence = new Map();
  const tables = { sessions, chunks, evidence };

  function store(name) {
    const table = tables[name];
      return {
        put(value, key) {
          const id = key === undefined ? value.session_id : JSON.stringify(key);
          table.set(id, structuredClone(value));
          return Promise.resolve(id);
        },
        get(key) {
          const id = typeof key === "string" ? key : JSON.stringify(key);
          return Promise.resolve(table.get(id));
        },
      };
  }

  return {
    transaction(names) {
      const tx = {
        objectStore: store,
        done: Promise.resolve(),
      };
      void names;
      return tx;
    },
    dump() {
      return { sessions, chunks, evidence };
    },
  };
}
