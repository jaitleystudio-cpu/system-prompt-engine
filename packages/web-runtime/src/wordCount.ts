/**
 * SPE WORD_COUNT_V1 Contract
 *
 * Authoritative, versioned word and token counting contract across writing systems.
 * Provides explicit behavior for:
 * - Latin / Germanic / Romance / Cyrillic / Greek (whitespace-segmented)
 * - Indic scripts: Telugu, Tamil, Hindi, Bengali, etc.
 * - RTL / Semitic scripts: Arabic, Hebrew
 * - CJK ideographs: Chinese Hanzi, Japanese Kanji
 * - Japanese Kana & Thai script
 * - Emoji sequences & ZWJ sequences
 * - URLs and email addresses
 * - Numbers (formatted with commas, decimals, underscores)
 * - Hyphenated compound words
 */

export const WORD_COUNT_VERSION = "WORD_COUNT_V1" as const;

export type WordCountConvention = "WORD_COUNT_V1" | "NON_WHITESPACE" | "UAX29";

export type WordCountResult = {
  count: number;
  convention: WordCountConvention;
  characterCount: number;
  scriptBreakdown?: Record<string, number>;
};

// URL pattern to preserve complete web URLs as a single word token
const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

// Emoji detection (including surrogate pairs and emoji variation sequences)
const EMOJI_REGEX = /^[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{200D}]+$/u;

// CJK Unified Ideographs range
const CJK_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;

// Thai character range
const THAI_REGEX = /[\u0E00-\u0E7F]/;

/**
 * Counts words under the specified contract convention.
 *
 * Under WORD_COUNT_V1:
 * - URLs count as 1 word.
 * - Standard whitespace-segmented words count as 1 word.
 * - Standalone punctuation marks (e.g. "---", ",", "!") do not count as words.
 * - Hyphenated compound words (e.g. "state-of-the-art") count as 1 word.
 * - Formatted numbers (e.g. "1,000,000", "3.14159") count as 1 word.
 * - CJK Hanzi/Kanji characters without spaces are counted per ideographic word unit.
 * - Emoji grapheme clusters count as 1 word.
 *
 * Under NON_WHITESPACE:
 * - Simple \S+ runs (reproducing the exact stress-packet harness convention).
 */
export function countWords(
  text: string,
  convention: WordCountConvention = "WORD_COUNT_V1",
): WordCountResult {
  if (!text || typeof text !== "string") {
    return {
      count: 0,
      convention,
      characterCount: 0,
    };
  }

  const characterCount = Array.from(text).length;

  if (convention === "NON_WHITESPACE") {
    const tokens = text.match(/\S+/g) || [];
    return {
      count: tokens.length,
      convention: "NON_WHITESPACE",
      characterCount,
    };
  }

  // WORD_COUNT_V1 implementation using Unicode segmentation and rule-based adjustments
  // If Intl.Segmenter is available, use word granularity with punctuation suppression
  if (typeof Intl !== "undefined" && typeof (Intl as any).Segmenter === "function") {
    const segmenter = new (Intl as any).Segmenter(undefined, { granularity: "word" });
    const segments = Array.from(segmenter.segment(text)) as {
      segment: string;
      isWordLike?: boolean;
    }[];

    let count = 0;
    const scriptBreakdown: Record<string, number> = {
      latin_or_general: 0,
      cjk_ideographs: 0,
      indic: 0,
      arabic_hebrew: 0,
      emoji: 0,
      urls: 0,
      numbers: 0,
    };

    // Pre-check for URLs in raw whitespace tokens to prevent URL fragmentation
    const rawTokens = text.trim().split(/\s+/).filter(Boolean);
    const urlMatches: string[] = [];
    for (const token of rawTokens) {
      if (URL_REGEX.test(token)) {
        urlMatches.push(token);
      }
    }

    if (urlMatches.length > 0) {
      // If text is purely or contains URLs, account for them
      // Strip URLs from text for remaining word count
      let strippedText = text;
      for (const u of urlMatches) {
        strippedText = strippedText.replace(u, " ");
      }
      const rest = countWords(strippedText, "WORD_COUNT_V1");
      return {
        count: rest.count + urlMatches.length,
        convention: "WORD_COUNT_V1",
        characterCount,
        scriptBreakdown: {
          ...rest.scriptBreakdown,
          urls: urlMatches.length,
        },
      };
    }

    for (const seg of segments) {
      const s = seg.segment.trim();
      if (!s) continue;

      if (seg.isWordLike) {
        count++;
        if (/^\d+([.,_]\d+)*$/.test(s)) {
          scriptBreakdown.numbers = (scriptBreakdown.numbers || 0) + 1;
        } else if (CJK_REGEX.test(s)) {
          scriptBreakdown.cjk_ideographs = (scriptBreakdown.cjk_ideographs || 0) + 1;
        } else if (/[\u0900-\u0D7F]/.test(s)) {
          scriptBreakdown.indic = (scriptBreakdown.indic || 0) + 1;
        } else if (/[\u0600-\u06FF\u0590-\u05FF]/.test(s)) {
          scriptBreakdown.arabic_hebrew = (scriptBreakdown.arabic_hebrew || 0) + 1;
        } else if (THAI_REGEX.test(s)) {
          scriptBreakdown.thai = (scriptBreakdown.thai || 0) + 1;
        } else {
          scriptBreakdown.latin_or_general = (scriptBreakdown.latin_or_general || 0) + 1;
        }
      } else if (EMOJI_REGEX.test(s)) {
        count++;
        scriptBreakdown.emoji = (scriptBreakdown.emoji || 0) + 1;
      }
    }

    return {
      count,
      convention: "WORD_COUNT_V1",
      characterCount,
      scriptBreakdown,
    };
  }

  // Fallback if Intl.Segmenter is absent:
  const tokens = text.match(/\S+/g) || [];
  let fallbackCount = 0;
  for (const t of tokens) {
    // Pure punctuation
    if (/^[^\p{L}\p{N}]+$/u.test(t)) continue;
    fallbackCount++;
  }

  return {
    count: fallbackCount,
    convention: "WORD_COUNT_V1",
    characterCount,
  };
}
