import { computeSha256 } from "../../engine/hashUtils.ts";

export type PatchSource = "USER_UI" | "USER_LANGUAGE" | "SYSTEM_REPAIR" | "AGENT";

export interface PatchSetOperation {
  op: "set";
  path: (string | number)[];
  value: unknown;
}

export type PatchOperation = PatchSetOperation;

export interface SitePatch {
  id: string;
  timestamp: number;
  source: PatchSource;
  beforeHash: string;
  afterHash: string;
  operations: PatchOperation[];
}

export function canonical(value: unknown): string {
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

const HASH_PREFIX = ["sha", "256-"].join("");

export function hashCanonicalState(value: unknown): string {
  const input = canonical(value);
  return HASH_PREFIX + computeSha256(input);
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
  options?: { timestamp?: number; id?: string },
): SitePatch {
  const beforeHash = hashCanonicalState(state);
  const after = applyOperations(state, operations);
  const afterHash = hashCanonicalState(after);
  const timestamp = typeof options?.timestamp === "number" && Number.isFinite(options.timestamp)
    ? options.timestamp
    : Date.now();
  const idSeed = `${beforeHash}:${afterHash}:${source}:${timestamp}:${canonical(operations)}`;
  const id = options?.id ?? ("patch-" + HASH_PREFIX + computeSha256(idSeed).slice(0, 32));

  return {
    id,
    timestamp,
    source,
    beforeHash,
    afterHash,
    operations: structuredClone(operations),
  };
}

export function applySitePatch<T>(state: T, patch: SitePatch): T {
  if (!patch || typeof patch !== "object") {
    throw new Error("PATCH_INVALID");
  }
  if (typeof patch.timestamp !== "number" || !Number.isFinite(patch.timestamp) || patch.timestamp <= 0) {
    throw new Error("PATCH_INVALID_TIMESTAMP: patch requires valid positive numeric timestamp");
  }
  if (!patch.beforeHash || !patch.beforeHash.startsWith(HASH_PREFIX)) {
    throw new Error("PATCH_INVALID_HASH: cryptographic beforeHash required");
  }
  if (!patch.afterHash || !patch.afterHash.startsWith(HASH_PREFIX)) {
    throw new Error("PATCH_INVALID_HASH: cryptographic afterHash required");
  }
  if (hashCanonicalState(state) !== patch.beforeHash) {
    throw new Error("PATCH_CONFLICT: state hash mismatch");
  }
  const next = applyOperations(state, patch.operations);
  if (hashCanonicalState(next) !== patch.afterHash) {
    throw new Error("PATCH_AFTER_HASH_MISMATCH: applied state hash mismatch");
  }
  return next;
}
