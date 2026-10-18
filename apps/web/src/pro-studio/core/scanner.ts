// Secret & personal-data scanner. Pattern matching only: it can miss things and can flag look-alikes.
export type FindingKind = "private-key" | "aws-access-key" | "openai-key" | "anthropic-key" | "github-token" | "slack-token" | "google-api-key" | "jwt" | "card-number" | "email" | "phone" | "ipv4" | "pan-india" | "iban";
export interface ScanFinding { kind: FindingKind; label: string; severity: "secret" | "personal"; index: number; length: number; preview: string }
interface Rule { kind: FindingKind; label: string; severity: "secret" | "personal"; re: RegExp; valid?: (m: string) => boolean }
export function luhn(digits: string): boolean {
  const d = digits.replace(/\D/g, ""); if (d.length < 13 || d.length > 19) return false;
  let sum = 0; for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; } return sum % 10 === 0;
}
const ipOk = (m: string) => m.split(".").every((p) => +p <= 255 && String(+p) === p);
export const RULES: Rule[] = [
  { kind: "private-key", label: "Private key block", severity: "secret", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/g },
  { kind: "aws-access-key", label: "AWS access key ID", severity: "secret", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: "anthropic-key", label: "Anthropic API key", severity: "secret", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { kind: "openai-key", label: "OpenAI-style API key", severity: "secret", re: /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{20,}/g },
  { kind: "github-token", label: "GitHub token", severity: "secret", re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/g },
  { kind: "slack-token", label: "Slack token", severity: "secret", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { kind: "google-api-key", label: "Google API key", severity: "secret", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { kind: "jwt", label: "JSON Web Token", severity: "secret", re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { kind: "card-number", label: "Payment card number (Luhn valid)", severity: "personal", re: /\b(?:\d[ -]?){12,18}\d\b/g, valid: luhn },
  { kind: "email", label: "Email address", severity: "personal", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { kind: "phone", label: "Phone number", severity: "personal", re: /(?<![\w])\+?\d{1,3}[ .-]?\(?\d{2,4}\)?[ .-]?\d{3,4}[ .-]?\d{3,4}(?![\w])/g, valid: (m) => !luhn(m) && m.replace(/\D/g, "").length >= 10 && m.replace(/\D/g, "").length <= 13 },
  { kind: "ipv4", label: "IPv4 address", severity: "personal", re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, valid: ipOk },
  { kind: "pan-india", label: "Indian PAN", severity: "personal", re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { kind: "iban", label: "IBAN", severity: "personal", re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?\b/g },
];
const mask = (s: string) => (s.length <= 8 ? "•".repeat(s.length) : `${s.slice(0, 4)}…${s.slice(-2)}`);
export function scan(text: string): ScanFinding[] {
  const out: ScanFinding[] = []; const taken: [number, number][] = [];
  for (const r of RULES) for (const m of text.matchAll(r.re)) {
    const i = m.index ?? 0, s = m[0];
    if (r.valid && !r.valid(s)) continue;
    if (taken.some(([a, b]) => i < b && i + s.length > a)) continue;
    taken.push([i, i + s.length]); out.push({ kind: r.kind, label: r.label, severity: r.severity, index: i, length: s.length, preview: mask(s) });
  }
  return out.sort((a, b) => a.index - b.index);
}
export function redact(text: string, findings = scan(text)): string {
  let t = text; for (const f of [...findings].sort((a, b) => b.index - a.index)) t = t.slice(0, f.index) + `[REDACTED:${f.kind}]` + t.slice(f.index + f.length); return t;
}
