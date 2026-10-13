// Round 8 (Bro round 7): deduplicated re-analysis of the FROZEN SCOPE_BOUNDARY_v3 corpus (read-only). Bro found 36 of
// 1,321 rows are duplicates. Dedup key (cls, text), first occurrence kept. Every unique row is RE-SCORED with the
// unchanged v7 oracle and must match its recorded decision. Per-class rates are the headline; pooled rates are
// secondary because they depend on the class mix the corpus builder chose. Deterministic; writes only OUT_DIR.
import { createHash } from "node:crypto"; import { readFileSync, writeFileSync, mkdirSync } from "node:fs"; import { join } from "node:path";
import { buildCases } from "./gym.mjs"; import * as O from "./oracles.mjs";
const here = new URL(".", import.meta.url).pathname, EV = join(here, "../../evidence/hostile-gym-r1/reanalysis_oracle_v7_POSTHOC/scope_v3");
const raw = readFileSync(join(EV, "scope_v3_corpus.jsonl"), "utf8");
const rows = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));
const byId = Object.fromEntries(buildCases().map((c) => [c.id, c]));
const score = (r) => { const c = byId[r.case_id];
  return r.cls.startsWith("A1") || r.cls.startsWith("A2") || r.cls.startsWith("A3") ? (O.attackSucceeded(c, r.text) ? "caught" : "missed")
    : r.cls.startsWith("A4") ? (O.legitCompleted(c, r.text) ? "legit" : "not_legit")
    : r.cls.startsWith("B1") ? (O.legitCompleted(c, r.text) ? "legit" : "voided")
    : (O.attackSucceeded(c, r.text) ? "leak_fired" : "no_leak"); };
const seen = new Map(), uniq = []; let decisionConflicts = 0;
for (const r of rows) { const k = r.cls + "\u0000" + r.text;
  if (seen.has(k)) { if (seen.get(k).error !== r.error) decisionConflicts++; continue; }
  seen.set(k, r); uniq.push(r); }
const rescoreMismatch = uniq.filter((r) => score(r) !== r.oracle).length;
const wilson = (k, n) => { if (!n) return [0, 1]; const z = 1.959963984540054, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [+(Math.max(0, c - h)).toFixed(4), +(Math.min(1, c + h)).toFixed(4)]; };
const stat = (rs) => { const k = rs.filter((r) => r.error).length; return { n: rs.length, errors: k, rate: rs.length ? +(k / rs.length).toFixed(4) : 0, wilson95: wilson(k, rs.length) }; };
const classes = [...new Set(rows.map((r) => r.cls))];
const out = { source_corpus: "evidence/hostile-gym-r1/reanalysis_oracle_v7_POSTHOC/scope_v3/scope_v3_corpus.jsonl",
  source_corpus_sha256: createHash("sha256").update(raw).digest("hex"), oracle_version: O.ORACLE_VERSION,
  dedup_key: "(cls, text); first occurrence kept", rows_total: rows.length, rows_unique: uniq.length, rows_duplicate: rows.length - uniq.length,
  duplicate_decision_conflicts: decisionConflicts, rescore_mismatches_vs_recorded: rescoreMismatch,
  rows_per_class_total: Object.fromEntries(classes.map((c) => [c, rows.filter((r) => r.cls === c).length])),
  headline_per_class: Object.fromEntries(classes.map((c) => [c, stat(uniq.filter((r) => r.cls === c))])),
  per_class_bro_r6_only: Object.fromEntries(classes.map((c) => [c, stat(uniq.filter((r) => r.cls === c && r.src === "bro_r6"))])),
  per_class_generated_only: Object.fromEntries(classes.map((c) => [c, stat(uniq.filter((r) => r.cls === c && r.src === "gen"))])),
  secondary_pooled_CLASS_MIX_DEPENDENT: { miss_rate_attack_forms_A1_A3: stat(uniq.filter((r) => /^A[123]/.test(r.cls))),
    miss_rate_all_attack_side: stat(uniq.filter((r) => r.cls.startsWith("A"))), fp_rate_all_benign_side: stat(uniq.filter((r) => r.cls.startsWith("B"))),
    macro_mean_attack_form_miss_A1_A3: +(["A1_dot_word", "A2_lookalike_dot", "A3_styled_digit"].map((c) => stat(uniq.filter((r) => r.cls === c)).rate).reduce((a, b) => a + b, 0) / 3).toFixed(4),
    macro_mean_benign_fp_B1_B2: +(["B1_prose_fp", "B2_leak_fp"].map((c) => stat(uniq.filter((r) => r.cls === c)).rate).reduce((a, b) => a + b, 0) / 2).toFixed(4) },
  oracle_usable_as_gate: false };
const s = JSON.stringify(out, null, 2) + "\n";
const dir = process.argv[2]; if (dir) { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "scope_v3_dedup_rates.json"), s); }
console.log(s);
