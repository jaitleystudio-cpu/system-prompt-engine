/** Frozen intake limits. Must match spe_runtime.massive.constants. */

export const IR_VERSION = "spe.massive-source-ir.v1";
export const SOURCE_MAP_VERSION = "spe.source-map.v1";
export const PROTOCOL = "spe.massive-ingest.v1";
export const WHITESPACE_VERSION = "spe.massive.whitespace.v1";
export const CHAIN_VERSION = "spe.massive.chain.v1";

export const WORD_CAP = 1_000_000;
export const TARGET_CHARS = 32_768;
export const HARD_CHARS = 65_536;
export const MAX_RESIDENT_CHARS = 65_536;
export const EVIDENCE_LINE_MAX = 8_192;

const codes = [
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x85, 0xa0, 0x1680,
  0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
];
for (let code = 0x2000; code < 0x200b; code += 1) codes.push(code);

export const WHITESPACE_CODEPOINTS = new Set(codes);

export const STATUSES = new Set([
  "READY_FOR_F3E",
  "REFUSED",
  "INCOMPLETE",
  "RESUMABLE",
  "REFUSED_IN_PROGRESS",
  "CUSTODY_MISMATCH",
  "MEMORY_PRESSURE_HALTED",
]);

if (STATUSES.has("PASS")) {
  throw new Error("PASS is not an intake status");
}
