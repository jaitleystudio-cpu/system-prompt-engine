export interface ParsedSentenceResult {
  role: string;
  goal: string;
  constraint: string;
  output: string;
  phrases: {
    role: string;
    goal: string;
    constraint: string;
    output: string;
  };
}

export interface TextSegment {
  type: "plain" | "role" | "goal" | "constraint" | "output";
  text: string;
}

export function parseCustomSentence(raw: string): ParsedSentenceResult {
  const text = raw.trim();
  if (!text) {
    return {
      role: "General expert assistant",
      goal: "Fulfill instructions with precision",
      constraint: "Respect user context and security boundaries",
      output: "Structured, clear response",
      phrases: { role: "", goal: "", constraint: "", output: "" },
    };
  }

  let role = "Specialized AI domain assistant";
  let goal = "";
  let constraint = "Do not assume unstated facts or violate safety policies";
  let output = "Clear, structured text responses";

  let rolePhrase = "";
  let goalPhrase = "";
  let constraintPhrase = "";
  let outputPhrase = "";

  // 1. Role extraction
  const rolePattern = /(?:i need (?:a|an)?|act as (?:a|an)?|you are (?:a|an)?|work as (?:a|an)?|create (?:a|an)?|build (?:a|an)?|be (?:a|an)?|serve as (?:a|an)?)\s+([^.,;]+?)(?=\s+\b(?:that|who|which|to)\b|[.,;]|$)/i;
  const roleMatch = text.match(rolePattern);
  if (roleMatch && roleMatch[1]) {
    rolePhrase = roleMatch[1].trim();
    role = rolePhrase.charAt(0).toUpperCase() + rolePhrase.slice(1);
    if (!role.endsWith(".")) role += ".";
  }

  // 2. Output extraction
  const outputPattern = /(?:\band\s+)?\b(keep answers?[^.;]*|format\s+[^.;]*|return\s+(?:only)?[^.;]*|output\s+[^.;]*|produce\s+[^.;]*scripts?[^.;]*|list\s+fixes[^.;]*|provide\s+\d+\s+variations[^.;]*|in\s+\d+\s+(?:sentences|paragraphs|bullets?|words?)[^.;]*|under\s+\d+\s+(?:sentences|paragraphs|bullets?|words?)[^.;]*|into\s+\d+\s+(?:sentences|paragraphs|bullets?|words?)[^.;]*)/i;
  const outputMatch = text.match(outputPattern);
  if (outputMatch && outputMatch[1]) {
    outputPhrase = outputMatch[1].replace(/^(?:and\s+)/i, "").trim();
    output = outputPhrase.charAt(0).toUpperCase() + outputPhrase.slice(1);
    if (!output.endsWith(".")) output += ".";
  }

  // 3. Constraint extraction
  const constraintPattern = /\b(never\s+.+?|do not\s+.+?|don'\''t\s+.+?|avoid\s+.+?|without\s+.+?|must not\s+.+?)(?=\s*[,.;]?\s*(?:\band\b|\bkeep\b|\bformat\b|\breturn\b|\boutput\b|\blist\b|\bprovide\b|\bunder\b|\binto\b|[.;]|$))/i;
  const constraintMatch = text.match(constraintPattern);
  if (constraintMatch && constraintMatch[1]) {
    constraintPhrase = constraintMatch[1].trim().replace(/\s+(?:and|with)$/i, "").trim();
    constraint = constraintPhrase.charAt(0).toUpperCase() + constraintPhrase.slice(1);
    if (!constraint.endsWith(".")) constraint += ".";
  }

  // 4. Goal extraction
  const goalClausePattern = /\b(?:that|who|which)\s+(.+?)(?=\s*[,.;]?\s*(?:\bnever\b|\bdo not\b|\bdon'\''t\b|\bavoid\b|\bwithout\b|\bmust not\b|\bkeep\b|\bformat\b|\breturn\b|\boutput\b|\band\b|[.;]|$))/i;
  const goalClauseMatch = text.match(goalClausePattern);

  if (goalClauseMatch && goalClauseMatch[1]) {
    goalPhrase = goalClauseMatch[1].trim().replace(/\s+(?:and|with)$/i, "").trim();
    goal = goalPhrase.charAt(0).toUpperCase() + goalPhrase.slice(1);
  } else {
    // Check infinitive "to <verb>" or imperative start
    const toMatch = text.match(/\bto\s+([a-z]+[^.,;]+)(?=\s*[,.;]?\s*(?:\bnever\b|\bdo not\b|\bwithout\b|\bavoid\b|\bkeep\b|\bformat\b|$))/i);
    if (toMatch && toMatch[1] && !rolePhrase.includes(toMatch[1])) {
      goalPhrase = toMatch[1].trim();
      goal = goalPhrase.charAt(0).toUpperCase() + goalPhrase.slice(1);
    } else {
      let first = text.split(/[.;]/)[0] || text;
      if (outputPhrase && first.includes(outputPhrase)) {
        first = first.replace(outputPhrase, "");
      }
      if (constraintPhrase && first.includes(constraintPhrase)) {
        first = first.replace(constraintPhrase, "");
      }
      goalPhrase = first.replace(/\b(?:into|under|in|without|avoid)\s*$/i, "").trim();
      goal = goalPhrase;
    }
  }
  if (goal && !goal.endsWith(".")) goal += ".";

  return {
    role,
    goal,
    constraint,
    output,
    phrases: {
      role: rolePhrase,
      goal: goalPhrase,
      constraint: constraintPhrase,
      output: outputPhrase,
    },
  };
}

export function segmentCustomInput(
  text: string,
  phrases?: { role: string; goal: string; constraint: string; output: string }
): TextSegment[] {
  if (!phrases) return [{ type: "plain", text }];

  const spans: { start: number; end: number; type: "role" | "goal" | "constraint" | "output" }[] = [];
  const entries: { type: "role" | "goal" | "constraint" | "output"; phrase: string }[] = [
    { type: "role", phrase: phrases.role },
    { type: "goal", phrase: phrases.goal },
    { type: "constraint", phrase: phrases.constraint },
    { type: "output", phrase: phrases.output },
  ];

  for (const { type, phrase } of entries) {
    if (!phrase || phrase.trim().length === 0) continue;
    const clean = phrase.trim();
    const idx = text.toLowerCase().indexOf(clean.toLowerCase());
    if (idx !== -1) {
      spans.push({
        start: idx,
        end: idx + clean.length,
        type,
      });
    }
  }

  spans.sort((a, b) => a.start - b.start);

  const filtered: typeof spans = [];
  let lastEnd = 0;
  for (const s of spans) {
    if (s.start >= lastEnd) {
      filtered.push(s);
      lastEnd = s.end;
    }
  }

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const s of filtered) {
    if (s.start > cursor) {
      segments.push({ type: "plain", text: text.slice(cursor, s.start) });
    }
    segments.push({ type: s.type, text: text.slice(s.start, s.end) });
    cursor = s.end;
  }
  if (cursor < text.length) {
    segments.push({ type: "plain", text: text.slice(cursor) });
  }
  return segments;
}
