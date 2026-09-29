/** spe.massive.whitespace.v1. Indexes are Unicode code points, matching Python. */

import { WHITESPACE_CODEPOINTS } from "./constants.mjs";

export function isWhitespace(ch) {
  return WHITESPACE_CODEPOINTS.has(ch.codePointAt(0));
}

export function codePoints(text) {
  return Array.from(text);
}

export function slicePoints(points, start, end) {
  return points.slice(start, end).join("");
}

export function countWordStarts(text, startInsideWord) {
  let inside = startInsideWord;
  let count = 0;
  for (const ch of text) {
    if (isWhitespace(ch)) {
      inside = false;
    } else {
      if (!inside) count += 1;
      inside = true;
    }
  }
  return [count, inside];
}

export function boundaryCuts(text, startInsideWord) {
  let inside = startInsideWord;
  const cuts = [];
  let i = 0;
  for (const ch of text) {
    if (isWhitespace(ch)) {
      if (inside) {
        inside = false;
        cuts.push(i);
      }
    } else {
      inside = true;
    }
    i += 1;
  }
  return cuts;
}
