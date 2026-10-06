export type PatchSource = "USER_UI" | "USER_LANGUAGE" | "SYSTEM_REPAIR" | "AGENT";

export interface PatchSetOperation {
  op: "set";
  path: (string | number)[];
  value: unknown;
}

export type PatchOperation = PatchSetOperation;

export interface SitePatch {
  id: string;
  source: PatchSource;
  beforeHash: string;
  afterHash: string;
  operations: PatchOperation[];
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const object = value as Record<string, unknown>;
  return (
    "{" +
    Object.keys(object)
      .sort()
      .map((key) => JSON.stringify(key) + ":" + canonical(object[key]))
      .join(",") +
    "}"
  );
}

export function hashCanonicalState(value: unknown): string {
  const input = canonical(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return "fnv1a32-" + (hash >>> 0).toString(16).padStart(8, "0");
}

function applyOperations<T>(state: T, operations: PatchOperation[]): T {
  const next = structuredClone(state);
  for (const operation of operations) {
    if (operation.op !== "set" || operation.path.length === 0) {
      throw new Error("PATCH_OPERATION_REFUSED");
    }
    let cursor: any = next;
    for (let i = 0; i < operation.path.length - 1; i += 1) {
      const key = operation.path[i];
      if (cursor[key] == null || typeof cursor[key] !== "object") {
        throw new Error("PATCH_PATH_REFUSED");
      }
      cursor = cursor[key];
    }
    cursor[operation.path[operation.path.length - 1]] = structuredClone(operation.value);
  }
  return next;
}

export function createSitePatch<T>(
  state: T,
  operations: PatchOperation[],
  source: PatchSource,
): SitePatch {
  const beforeHash = hashCanonicalState(state);
  const after = applyOperations(state, operations);
  return {
    id: beforeHash + "-" + source + "-" + operations.length,
    source,
    beforeHash,
    afterHash: hashCanonicalState(after),
    operations: structuredClone(operations),
  };
}

export function applySitePatch<T>(state: T, patch: SitePatch): T {
  if (hashCanonicalState(state) !== patch.beforeHash) {
    throw new Error("PATCH_CONFLICT");
  }
  const next = applyOperations(state, patch.operations);
  if (hashCanonicalState(next) !== patch.afterHash) {
    throw new Error("PATCH_AFTER_HASH_MISMATCH");
  }
  return next;
}
