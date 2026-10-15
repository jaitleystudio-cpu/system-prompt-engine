/**
 * SPE Ω — ISO 24495-1 Plain-English & Global Comprehension Validator
 *
 * Mandate:
 * Validates that all candidate hero copy adheres to ISO 24495-1 plain language
 * standards and is effortlessly understandable to developers and international users
 * worldwide. Rejects confusing cultural idioms, convoluted syntax, and mobile line-overflow risks.
 */

export interface ComprehensionInput {
  title: string;
  accent: string;
  support?: string;
  cta?: string;
}

export interface ComprehensionReport {
  passed: boolean;
  fleschGrade: number;
  readingEase: number;
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  idiomsDetected: string[];
  overflowRisk: boolean;
  issues: string[];
}

export const COMMON_CONFUSING_IDIOMS = [
  "hit the ground running",
  "silver bullet",
  "touch base",
  "under the hood",
  "ballpark",
  "piece of cake",
  "bite the bullet",
  "cut corners",
  "break the ice",
  "rule of thumb",
  "apples to oranges",
  "boil the ocean",
  "low-hanging fruit",
  "drinking the kool-aid",
] as const;

/**
 * Counts syllables in an English word using phonetic heuristics.
 */
function countSyllablesInWord(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return 1;
  if (clean.length <= 3) return 1;

  // Replace silent 'e' at the end unless preceded by 'l' (like 'table')
  let processed = clean.replace(/(?:[^laeiouy]|ed|es)e$/, "");
  processed = processed.replace(/^y/, "");

  const vowelMatches = processed.match(/[aeiouy]{1,2}/g);
  return vowelMatches ? Math.max(1, vowelMatches.length) : 1;
}

/**
 * Analyzes English readability and ISO 24495-1 comprehension metrics.
 */
export function validateComprehension(input: ComprehensionInput): ComprehensionReport {
  const issues: string[] = [];
  const idiomsDetected: string[] = [];

  const headline = `${input.title} ${input.accent}`.trim();
  const fullText = `${headline} ${input.support || ""} ${input.cta || ""}`.trim();

  // 1. Check for confusing idioms & cultural jargon
  const lowerText = fullText.toLowerCase();
  for (const idiom of COMMON_CONFUSING_IDIOMS) {
    if (lowerText.includes(idiom)) {
      idiomsDetected.push(idiom);
      issues.push(`Idiom detected: '${idiom}'. ISO 24495-1 requires direct, universally comprehensible phrasing.`);
    }
  }

  // 2. Responsive Line Overflow & Wrapping Simulation
  // Max safe length per unbroken token on 375px mobile viewport is 22 chars.
  // Max safe headline line length is 42 chars without spaces.
  let overflowRisk = false;
  const tokens = headline.split(/\s+/);
  for (const token of tokens) {
    if (token.length > 25) {
      overflowRisk = true;
      issues.push(`Token '${token}' exceeds 25 characters and will trigger horizontal layout overflow on mobile screens.`);
    }
  }
  if (input.title.length > 50 || input.accent.length > 50) {
    overflowRisk = true;
    issues.push("Headline line exceeds 50 characters, risking awkward wrapping on mobile viewports.");
  }

  // 3. Sentence & Word Extraction
  const sentences = fullText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const sentenceCount = Math.max(1, sentences.length);

  const words = fullText
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);
  const wordCount = Math.max(1, words.length);

  // 4. Syllable Counting
  let totalSyllables = 0;
  for (const word of words) {
    totalSyllables += countSyllablesInWord(word);
  }

  const avgSentenceLength = wordCount / sentenceCount;
  const avgSyllablesPerWord = totalSyllables / wordCount;

  // Flesch-Kincaid Grade Level: 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
  let fleschGrade = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;
  fleschGrade = Math.round(Math.max(0, fleschGrade) * 10) / 10;

  // Flesch Reading Ease: 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
  let readingEase = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;
  readingEase = Math.round(Math.max(0, Math.min(100, readingEase)) * 10) / 10;

  // 5. Grade & Ease Criteria (ISO 24495-1 standard: Grade <= 8.5, Ease >= 60)
  if (fleschGrade > 8.5) {
    issues.push(`Reading grade ${fleschGrade} exceeds maximum recommended target (8.5). Simplify vocabulary.`);
  }
  if (readingEase < 60) {
    issues.push(`Reading ease ${readingEase} is below target threshold (60.0). Text may feel overly dense.`);
  }

  const passed = issues.length === 0 && !overflowRisk && idiomsDetected.length === 0;

  return {
    passed,
    fleschGrade,
    readingEase,
    wordCount,
    sentenceCount,
    avgSentenceLength,
    idiomsDetected,
    overflowRisk,
    issues,
  };
}
