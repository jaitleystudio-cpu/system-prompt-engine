import { boundaryCuts, codePoints } from "./whitespace.mjs";

export function nextChunkEnd(text, { target, hard, seal, startInsideWord }) {
  const points = typeof text === "string" ? codePoints(text) : text;
  const n = points.length;
  if (n === 0) return null;
  if (target < 1 || hard < 1 || hard < target) {
    throw new Error("chunk bounds require 1 <= target <= hard");
  }
  if (seal && n <= hard) return n;
  if (!seal && n <= target) return null;
  const joined = typeof text === "string" ? text : points.join("");
  const cuts = boundaryCuts(joined, startInsideWord);
  const underTarget = cuts.filter((c) => c > 0 && c <= target);
  if (underTarget.length && (n > target || seal)) return underTarget[underTarget.length - 1];
  const underHard = cuts.filter((c) => c > 0 && c <= hard);
  if (underHard.length && (n > target || seal)) return underHard[underHard.length - 1];
  if (n >= hard || (seal && n > hard)) return Math.min(hard, n);
  if (seal) return n;
  return null;
}
