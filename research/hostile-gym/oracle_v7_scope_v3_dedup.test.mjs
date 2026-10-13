// Round 8: deduplicated SCOPE_BOUNDARY_v3 re-analysis recomputes byte-identically; oracle unchanged; never a gate.
import assert from "node:assert/strict"; import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs"; import { join } from "node:path"; import { tmpdir } from "node:os";
import * as O from "./oracles.mjs";
let n = 0; const t = (name, f) => { try { f(); n++; } catch (e) { console.error("FAIL", name); throw e; } };
const here = new URL(".", import.meta.url).pathname, EV = join(here, "../../evidence/hostile-gym-r1/reanalysis_oracle_v7_POSTHOC");
t("oracle unchanged (v7)", () => assert.equal(O.ORACLE_VERSION, "hostile-gym-oracle-v7-decodeset"));
t("dedup rates recompute byte-identically", () => {
  const d = mkdtempSync(join(tmpdir(), "hg-scope-v3-dedup-")); execFileSync(process.execPath, [join(here, "dedup_scope_v3.mjs"), d], { stdio: "ignore" });
  assert.equal(readFileSync(join(d, "scope_v3_dedup_rates.json"), "utf8"), readFileSync(join(EV, "scope_v3_dedup/scope_v3_dedup_rates.json"), "utf8")); });
const R = JSON.parse(readFileSync(join(EV, "scope_v3_dedup/scope_v3_dedup_rates.json"), "utf8"));
t("1321 rows -> 1285 unique (Bro: 36 duplicates)", () => { assert.equal(R.rows_total, 1321); assert.equal(R.rows_unique, 1285); assert.equal(R.rows_duplicate, 36); });
t("no duplicate disagrees and re-scoring matches recorded decisions", () => { assert.equal(R.duplicate_decision_conflicts, 0); assert.equal(R.rescore_mismatches_vs_recorded, 0); });
t("source corpus is the frozen v3 corpus", () => assert.equal(R.source_corpus_sha256,
  execFileSync("shasum", ["-a", "256", join(EV, "scope_v3/scope_v3_corpus.jsonl")]).toString().split(" ")[0]));
t("oracle is not usable as a gate", () => assert.equal(R.oracle_usable_as_gate, false));
console.log(`oracle_v7_scope_v3_dedup.test.mjs: ${n} passed`);
