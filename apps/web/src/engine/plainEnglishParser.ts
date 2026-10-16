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
  let constraint = "Preserve verified boundaries, strict safety, and zero hallucinations.";
  let output = "Clear, structured deliverables with concrete, verified steps.";

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
  } else {
    const low = text.toLowerCase();
    if (low.includes("full-stack") || low.includes("full stack") || low.includes("fullstack")) {
      role = "Full-Stack Software Architect.";
    } else if (low.includes("database") || low.includes("postgres") || low.includes("sql") || low.includes("schema")) {
      role = "Principal Systems & Database Architect.";
    } else if (low.includes("code") || low.includes("bug") || low.includes("refactor") || low.includes("security") || low.includes("test")) {
      role = "Senior Software & Security Architect.";
    } else if (low.includes("customer") || low.includes("support") || low.includes("ticket") || low.includes("triage")) {
      role = "Customer Experience & Support Lead.";
    } else if (low.includes("executive") || low.includes("metric") || low.includes("blocker") || low.includes("milestone") || low.includes("summary")) {
      role = "Executive Operations & Strategy Lead.";
    } else if (low.includes("design") || low.includes("ui") || low.includes("ux") || low.includes("layout")) {
      role = "Product Design & Frontend Systems Lead.";
    } else if (low.includes("plan") || low.includes("architect")) {
      role = "Principal Systems Architect.";
    }
  }

  // 2. Output extraction
  const outputPattern = /(?:\band\s+)?\b(rank\s+findings[^.;]*|include\s+[^.;]*|draft\s+[^.;]*drafts?[^.;]*|formatted\s+for[^.;]*|keep answers?[^.;]*|format\s+[^.;]*|return\s+(?:only)?[^.;]*|output\s+[^.;]*|produce\s+[^.;]*scripts?[^.;]*|list\s+fixes[^.;]*|provide\s+\d+\s+variations[^.;]*|in\s+\d+\s+(?:sentences|paragraphs|bullets?|words?)[^.;]*|under\s+\d+\s+(?:sentences|paragraphs|bullets?|words?)[^.;]*|into\s+\d+\s+(?:sentences|paragraphs|bullets?|words?)[^.;]*)/i;
  const outputMatch = text.match(outputPattern);
  if (outputMatch && outputMatch[1]) {
    outputPhrase = outputMatch[1].replace(/^(?:and\s+)/i, "").trim();
    output = outputPhrase.charAt(0).toUpperCase() + outputPhrase.slice(1);
    if (!output.endsWith(".")) output += ".";
  }

  // 3. Constraint extraction (captures affirmative directives like 'must reply warmly' as well as negative prohibitions)
  const affirmativePattern = /\b((?:must\s+(?!not\b)|shall\s+(?!not\b)|always\s+|strictly\s+|ensure\s+|reply\s+warmly\b)[^.;,]*?)(?=\s*[,.;]?\s*(?:\bnever\b|\bdo not\b|\bdon'\''t\b|\bavoid\b|\bwithout\b|\bmust not\b|\bformat\b|\breturn\b|\boutput\b|\blist\b|\bprovide\b|\bunder\b|\binto\b|[.;]|$))/i;
  const negativePattern = /\b(never\s+.+?|do not\s+.+?|don'\''t\s+.+?|avoid\s+.+?|without\s+.+?|must not\s+.+?|no\s+hallucinations?|omit\s+.+?|cannot\s+.+?)(?=\s*[,.;]?\s*(?:\band\b|\bkeep\b|\bformat\b|\breturn\b|\boutput\b|\blist\b|\bprovide\b|\bunder\b|\binto\b|[.;]|$))/i;

  const collectedConstraints: string[] = [];
  const affMatch = text.match(affirmativePattern);
  if (affMatch && affMatch[1]) {
    const cleanAff = affMatch[1].trim().replace(/\s+(?:and|with)$/i, "").trim();
    if (cleanAff && !cleanAff.toLowerCase().startsWith("be a") && !cleanAff.toLowerCase().startsWith("be an")) {
      collectedConstraints.push(cleanAff);
    }
  }

  const negMatch = text.match(negativePattern);
  if (negMatch && negMatch[1]) {
    const cleanNeg = negMatch[1].trim().replace(/\s+(?:and|with)$/i, "").trim();
    if (cleanNeg && !collectedConstraints.includes(cleanNeg)) {
      collectedConstraints.push(cleanNeg);
    }
  }

  if (collectedConstraints.length > 0) {
    constraintPhrase = collectedConstraints.join(", ");
    constraint = collectedConstraints
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
      .join(". ");
    if (!constraint.endsWith(".")) constraint += ".";
  }

  // 4. Goal extraction
  const goalClausePattern = /\b(?:that|who|which)\s+(.+?)(?=\s*[,.;]?\s*(?:\bnever\b|\bdo not\b|\bdon'\''t\b|\bavoid\b|\bwithout\b|\bmust not\b|\bmust\b|\bshall\b|\balways\b|\bstrictly\b|\breply\s+warmly\b|\bkeep\b|\bformat\b|\breturn\b|\boutput\b|\band\b|[.;]|$))/i;
  const goalClauseMatch = text.match(goalClausePattern);

  if (goalClauseMatch && goalClauseMatch[1]) {
    goalPhrase = goalClauseMatch[1].trim().replace(/\s+(?:and|with)$/i, "").trim();
    goal = goalPhrase.charAt(0).toUpperCase() + goalPhrase.slice(1);
  } else {
    // Check infinitive "to <verb>" or imperative start
    const toMatch = text.match(/\bto\s+([a-z]+[^.,;]+)(?=\s*[,.;]?\s*(?:\bnever\b|\bdo not\b|\bwithout\b|\bavoid\b|\bmust not\b|\bmust\b|\bshall\b|\balways\b|\bkeep\b|\bformat\b|$))/i);
    if (toMatch && toMatch[1] && !rolePhrase.includes(toMatch[1])) {
      goalPhrase = toMatch[1].trim();
      goal = goalPhrase.charAt(0).toUpperCase() + goalPhrase.slice(1);
    } else {
      let first = text.split(/[.;]/)[0] || text;
      if (outputPhrase && first.includes(outputPhrase)) {
        first = first.replace(outputPhrase, "");
      }
      for (const c of collectedConstraints) {
        if (first.includes(c)) {
          first = first.replace(c, "");
        }
      }
      goalPhrase = first.replace(/\b(?:into|under|in|without|avoid)\s*$/i, "").replace(/[,;\s]+and\s*$/i, "").replace(/[,;]\s*$/i, "").trim();
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
