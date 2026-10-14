/**
 * Hybrid IndexedDB + LocalStorage Persistence for UIDrop Snap Library
 * Supports large 1440x900 base64 screenshots without hitting the 5MB LocalStorage limit.
 */

import type { DesignSystemSnap } from "../../types/design-system";

const DB_NAME = "spe_uidrop_db";
const DB_VERSION = 1;
const STORE_NAME = "snaps";
const LOCAL_STORAGE_KEY = "spe_uidrop_snaps";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB unavailable"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("domain", "domain", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a design snap to IndexedDB with LocalStorage fallback.
 */
export async function saveSnap(snap: DesignSystemSnap): Promise<void> {
  // Try IndexedDB first
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(snap);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // IndexedDB failed or in private browsing, fall back to LocalStorage
  }

  // Also update LocalStorage (compacted if necessary to avoid QuotaExceededError)
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const existing: DesignSystemSnap[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((s) => s.id !== snap.id && s.domain !== snap.domain);
    const updated = [snap, ...filtered].slice(0, 20);

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (quotaErr) {
      // If quota exceeded, strip screenshotBase64 from older items
      const pruned = updated.map((s, idx) =>
        idx === 0 ? s : { ...s, screenshotBase64: "" },
      );
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pruned));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Loads all saved snaps, preferring IndexedDB if available.
 */
export async function loadSnaps(): Promise<DesignSystemSnap[]> {
  try {
    const db = await openDb();
    const snaps = await new Promise<DesignSystemSnap[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (snaps && snaps.length > 0) {
      return snaps.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    }
  } catch {
    // Fall back to LocalStorage
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  return [];
}

/**
 * Deletes a snap by id from both IndexedDB and LocalStorage.
 */
export async function deleteSnap(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const existing: DesignSystemSnap[] = JSON.parse(raw);
      const updated = existing.filter((s) => s.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}
}
