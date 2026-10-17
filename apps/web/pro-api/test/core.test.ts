import { test } from "node:test";
import assert from "node:assert/strict";
import { exportCode, CODE_TARGETS } from "../../src/pro-studio/core/codeExport.ts";
import { batchFill } from "../../src/pro-studio/core/csvBatch.ts";
import { scan, redact } from "../../src/pro-studio/core/scanner.ts";
import { appendEntry, verifyChain } from "../../src/pro-studio/core/audit.ts";
import { convert } from "../../src/pro-studio/core/formats.ts";
import { estimateCost } from "../../src/pro-studio/core/cost.ts";
import { parseCommand } from "../../src/pro-studio/core/coworkie.ts";
import { MemoryStore } from "../store.ts";
import { hitRate } from "../ratelimit.ts";

test("export to code: tricky prompt survives in every target", () => {
  const prompt = `He said "don't"\nnew line \\ backslash $HOME \`tick\``;
  for (const t of CODE_TARGETS) { const c = exportCode(t.id, prompt, "my-model", "Hi"); assert.ok(c.length > 20, t.id); assert.ok(!c.includes("\n" + "new line \\ backslash $HOME") || t.id.includes("python"), t.id); }
  const js = exportCode("js-openai", prompt, "m", "Hi"); const m = js.match(/const SYSTEM_PROMPT = (".*?");\n/s); assert.ok(m, "js has system const"); assert.equal(JSON.parse(m![1]), prompt);
});
test("CSV batch: quoted commas and newlines, missing values reported", () => {
  const r = batchFill("Hi {{name}} from {{city}}", 'name,city\n"Doe, J","New\nYork"\nAnn,');
  assert.equal(r.rows.length, 2); assert.equal(r.rows[0].output, "Hi Doe, J from New\nYork"); assert.deepEqual(r.rows[1].missing, ["city"]);
});
test("scanner finds planted secrets, Luhn rejects fake cards, redaction removes all", () => {
  const t = "AKIAABCDEFGHIJKLMNOP and 4111 1111 1111 1111 and 4111 1111 1111 1112 and a@b.co";
  const f = scan(t); const labels = f.map((x) => x.label).join("|");
  assert.match(labels, /AWS/); assert.equal(f.filter((x) => /card/i.test(x.label)).length, 1);
  const red = redact(t, f); assert.ok(!red.includes("AKIAABCDEFGHIJKLMNOP") && !red.includes("a@b.co"));
});
test("audit chain detects an edit at the right index", async () => {
  let log = await appendEntry([], "a", "1"); log = await appendEntry(log, "b", "2"); log = await appendEntry(log, "c", "3");
  assert.equal((await verifyChain(log)).ok, true);
  const bad = structuredClone(log); bad[1].detail = "changed"; const r = await verifyChain(bad); assert.equal(r.ok, false); assert.equal(r.brokenAt, 2);
});
test("formats: xml escaped, json parseable", () => {
  const bs = [{ kind: "rules" as const, title: "Rules", text: "a < b & c > d" }];
  assert.ok(!convert(bs, "xml").includes("a < b")); JSON.parse(convert(bs, "json"));
});
test("cost: rejects negative input", () => {
  const r = estimateCost({ promptTokens: -1, inputTokensPerCall: 1, outputTokensPerCall: 1, pricePerMInput: 1, pricePerMOutput: 1, callsPerDay: 1, contextWindow: null }) as any;
  assert.ok(r.warnings.some((w: string) => /promptTokens must be a number of 0 or more/.test(w)), JSON.stringify(r));
});
test("coworkie parses living-loop commands", () => {
  const i = parseCommand("open living project"); assert.equal(i.type, "open"); assert.equal((i as any).tool, "living");
  assert.equal((parseCommand("blind compare") as any).tool, "blind");
});
test("rate limiter: fixed window per subject", async () => {
  const s = new MemoryStore(); const now = 1_000_000;
  for (let n = 0; n < 2; n++) assert.equal((await hitRate(s, "a", "all", 2, now)).ok, true);
  const r = await hitRate(s, "a", "all", 2, now); assert.equal(r.ok, false); assert.ok(r.retryAfter > 0);
  assert.equal((await hitRate(s, "a", "all", 2, now + 60_000)).ok, true);
});
