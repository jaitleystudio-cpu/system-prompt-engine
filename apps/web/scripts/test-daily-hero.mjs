import assert from "node:assert/strict";
import { build } from "esbuild";
const built = await build({
  entryPoints: [
    new URL("../src/landing/dailyHero.ts", import.meta.url).pathname,
  ],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { dailyHeadlines, dailyHeroIndex, nextLocalMidnight } = await import(
  "data:text/javascript;base64," +
    Buffer.from(built.outputFiles[0].text).toString("base64")
);
assert.equal(dailyHeadlines.length, 31);
assert.equal(new Set(dailyHeadlines.map((x) => x.join(" "))).size, 31);
for (const [title, accent] of dailyHeadlines) {
  assert.ok((title + " " + accent).split(/\s+/).length <= 13);
  assert.ok(title.length <= 27 && accent.length <= 27);
}
let checks = 2 + dailyHeadlines.length;
for (const zone of [
  "UTC",
  "Asia/Kolkata",
  "America/New_York",
  "Pacific/Auckland",
]) {
  process.env.TZ = zone;
  for (let day = 0; day < 800; day++) {
    const morning = new Date(2025, 0, 1 + day, 0, 0, 1),
      late = new Date(2025, 0, 1 + day, 23, 59, 59),
      next = new Date(2025, 0, 2 + day);
    assert.equal(dailyHeroIndex(morning), dailyHeroIndex(late));
    assert.notEqual(dailyHeroIndex(morning), dailyHeroIndex(next));
    assert.equal(nextLocalMidnight(morning), next.getTime());
    checks += 3;
  }
}
process.env.TZ = "America/New_York";
assert.equal(
  nextLocalMidnight(new Date(2026, 2, 8)) - new Date(2026, 2, 8).getTime(),
  23 * 3600000,
);
assert.equal(
  nextLocalMidnight(new Date(2026, 10, 1)) - new Date(2026, 10, 1).getTime(),
  25 * 3600000,
);
console.log(
  `PASS ${checks + 2} daily-title assertions: stable day, new next day, year/month/leap boundaries, four timezones and DST.`,
);
