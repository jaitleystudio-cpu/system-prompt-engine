/**
 * Apply SR1-01..SR1-20 to a temporary copy of the search foundation.
 * The worktree donor is not modified. A mutant is killed only when an oracle
 * that passed on the donor fails on the mutant.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const PROOF = join(ROOT, "proofs/search_r1_20260930");
const DONOR_SHA = "975a0793726f4b7741beb19732ac01cea5e13198";
const FOUNDATION = "src/search/foundation.mjs";
const CWV = "scripts/measure-cwv.mjs";

const SITEMAP_RETURN = `  return \`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
\${urls}
</urlset>
\`;`;

function patches() {
  return {
    "SR1-01": {
      defect: "robots ignored",
      target: "robots_honored",
      file: FOUNDATION,
      from: `      .filter((route) => route.robots === "disallow")`,
      to: `      .filter((route) => false)`,
      also: [
        [
          `    ...PRIVATE_PREFIXES.filter((prefix) => prefix.path !== "/workspace").map(`,
          `    ...PRIVATE_PREFIXES.filter((prefix) => false).map(`,
        ],
      ],
    },
    "SR1-02": {
      defect: "404 treated as indexable",
      target: "not_found_not_indexable",
      file: FOUNDATION,
      from: `  h1: "Page not found",\n  robotsMeta: "noindex, follow",`,
      to: `  h1: "Page not found",\n  robotsMeta: "index, follow",`,
    },
    "SR1-03": {
      defect: "canonical invented",
      target: "canonicals_not_invented",
      file: FOUNDATION,
      from: `  if (!notFound) {\n    lines.push(\`<link rel="canonical" href="\${escapeHtml(url)}" />\`);\n  }`,
      to: "  lines.push('<link rel=\"canonical\" href=\"' + escapeHtml(notFound ? SITE_ORIGIN + '/page-not-found' : url) + '\" />');",
    },
    "SR1-04": {
      defect: "sitemap URL fabricated",
      target: "sitemap_urls_not_fabricated",
      file: FOUNDATION,
      from: SITEMAP_RETURN,
      to: `  return \`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
\${urls}
  <url><loc>https://systempromptengine.com/fabricated-search-url</loc></url>
</urlset>
\`;`,
    },
    "SR1-05": {
      defect: "missing metadata becomes a title",
      target: "metadata_not_invented",
      file: FOUNDATION,
      from: `  const title = notFound ? NOT_FOUND.title : route.title;`,
      to: `  const title = notFound ? NOT_FOUND.title : (route.h1 || "Untitled SPE page");`,
    },
    "SR1-06": {
      defect: "schema invented",
      target: "schema_not_invented",
      file: FOUNDATION,
      from: `  if (route.schemas.includes("Article")) graph.push(articleNode(route));\n  return { "@context": "https://schema.org", "@graph": graph };`,
      to: `  if (route.schemas.includes("Article")) graph.push(articleNode(route));\n  graph.push({ "@type": "FAQPage", name: route.title });\n  return { "@context": "https://schema.org", "@graph": graph };`,
    },
    "SR1-07": {
      defect: "CWV missing becomes zero",
      target: "cwv_omitted_not_pass",
      file: CWV,
      from: `  const lcpMs = Number(sample.lcpMs);\n  const cls = Number(sample.cls);\n  const inpMs = Number(sample.inpMs);`,
      to: `  const lcpMs = Number(sample.lcpMs ?? 0);\n  const cls = Number(sample.cls ?? 0);\n  const inpMs = Number(sample.inpMs ?? 0);`,
    },
    "SR1-08": {
      defect: "CWV missing becomes PASS",
      target: "cwv_slow_sample_fails",
      file: CWV,
      from: `    lcp: Number.isFinite(lcpMs) && lcpMs <= LCP_MS,\n    cls: Number.isFinite(cls) && cls <= CLS_MAX,\n    inp: Number.isFinite(inpMs) && inpMs <= INP_MS,`,
      to: `    lcp: true,\n    cls: true,\n    inp: true,`,
    },
    "SR1-09": {
      defect: "live SERP claimed",
      target: "live_serp_not_claimed",
      file: FOUNDATION,
      from: `    doNotSubmit: true,\n    index: publicIndexRoutes().map((route) => absoluteUrl(route.path)),`,
      to: `    doNotSubmit: true,\n    liveSerp: "PASS",\n    index: publicIndexRoutes().map((route) => absoluteUrl(route.path)),`,
    },
    "SR1-10": {
      defect: "Search Console claimed without evidence",
      target: "search_console_not_claimed",
      file: FOUNDATION,
      from: `    doNotSubmit: true,\n    index: publicIndexRoutes().map((route) => absoluteUrl(route.path)),`,
      to: `    doNotSubmit: false,\n    searchConsole: "VERIFIED",\n    index: publicIndexRoutes().map((route) => absoluteUrl(route.path)),`,
    },
    "SR1-11": {
      defect: "network enabled",
      target: "network_not_enabled",
      file: CWV,
      from: `export function assessLabVitals(sample) {\n  const lcpMs = Number(sample.lcpMs);`,
      to: `export function assessLabVitals(sample) {\n  fetch("https://www.google.com/search?q=spe");\n  const lcpMs = Number(sample.lcpMs);`,
    },
    "SR1-12": {
      defect: "private URL crawled",
      target: "private_url_not_indexed",
      file: FOUNDATION,
      from: `    id: "workspace",\n    path: "/workspace",\n    index: false,\n    nav: false,\n    navLabel: "Workspace",\n    robots: "disallow",\n    robotsMeta: "noindex, nofollow",`,
      to: `    id: "workspace",\n    path: "/workspace",\n    index: true,\n    nav: false,\n    navLabel: "Workspace",\n    robots: "allow",\n    robotsMeta: "index, follow",`,
    },
    "SR1-13": {
      defect: "credential URL retained",
      target: "credential_urls_rejected",
      file: FOUNDATION,
      from: "  return `${SITE_ORIGIN}${path}`;",
      to: "  return `https://user:secret@systempromptengine.com${path}`;",
    },
    "SR1-14": {
      defect: "duplicate URL silently collapsed as proven",
      target: "duplicates_not_proven",
      file: FOUNDATION,
      from: SITEMAP_RETURN,
      to: `  return \`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
\${urls}
<!-- duplicate-collapse: PROVEN -->
</urlset>
\`;`,
    },
    "SR1-15": {
      defect: "noindex becomes index",
      target: "noindex_stays_noindex",
      file: FOUNDATION,
      from: `    id: "my-work",\n    path: "/my-work",\n    index: false,`,
      to: `    id: "my-work",\n    path: "/my-work",\n    index: true,`,
      also: [[`    navLabel: "My Work",\n    robots: "allow",\n    robotsMeta: "noindex, follow",`, `    navLabel: "My Work",\n    robots: "allow",\n    robotsMeta: "index, follow",`]],
    },
    "SR1-16": {
      defect: "unknown route becomes 200",
      target: "unknown_route_404",
      file: FOUNDATION,
      from: `  lines.push("/*    /404.html   404");`,
      to: `  lines.push("/*    /404.html   200");`,
    },
    "SR1-17": {
      defect: "redirect loop marked complete",
      target: "redirects_not_a_completed_loop",
      file: FOUNDATION,
      from: `  lines.push("/*    /404.html   404");\n  return \`\${lines.join("\\n")}\\n\`;`,
      to: `  lines.push("/create    /code    301");\n  lines.push("/code    /create    301");\n  lines.push("# REDIRECT_LOOP_STATUS: COMPLETE");\n  lines.push("/*    /404.html   404");\n  return \`\${lines.join("\\n")}\\n\`;`,
    },
    "SR1-18": {
      defect: "trailing-slash identity forged",
      target: "trailing_slash_identity",
      file: FOUNDATION,
      from: `export function absoluteUrl(path) {\n  if (path === "/" || path === "") return \`\${SITE_ORIGIN}/\`;\n  return \`\${SITE_ORIGIN}\${path}\`;\n}`,
      to: `export function absoluteUrl(path) {\n  if (path === "/" || path === "") return \`\${SITE_ORIGIN}\`;\n  return \`\${SITE_ORIGIN}\${path}/\`;\n}`,
    },
    "SR1-19": {
      defect: "semantic authority elevated",
      target: "semantic_authority_none",
      file: FOUNDATION,
      from: `export function coverageExpectations() {\n  return {\n    revision: SEARCH_REVISION,\n    hosting: "NOT_AUTHORIZED",`,
      to: `export function coverageExpectations() {\n  return {\n    revision: SEARCH_REVISION,\n    hosting: "NOT_AUTHORIZED",\n    semanticAuthority: "ELEVATED",`,
    },
    "SR1-20": {
      defect: "gap removed without evidence",
      target: "known_gaps_remain",
      file: FOUNDATION,
      from: `    notFound: {\n      status: 404,\n      robots: NOT_FOUND.robotsMeta,\n      canonical: null,\n    },\n    removedStructuredData: ["FAQPage"],`,
      to: `    gaps: "NONE",`,
    },
  };
}

function sourcePath(file) {
  return file === CWV
    ? join(ROOT, "apps/web/scripts/measure-cwv.mjs")
    : join(ROOT, "apps/web/src/search/foundation.mjs");
}

function replacementList(spec) {
  const list = [[spec.from, spec.to]];
  for (const pair of spec.also ?? []) list.push(pair);
  return list;
}

function preflight() {
  const failures = [];
  for (const [id, spec] of Object.entries(patches())) {
    const text = readFileSync(sourcePath(spec.file), "utf8");
    for (const [from] of replacementList(spec)) {
      const found = text.split(from).length - 1;
      if (found !== 1) failures.push(`${id} found ${found}`);
    }
  }
  if (failures.length) throw new Error(failures.join("\n"));
}

function stage(dir, spec) {
  mkdirSync(join(dir, "src/search"), { recursive: true });
  mkdirSync(join(dir, "scripts"), { recursive: true });
  copyFileSync(
    join(ROOT, "apps/web/src/search/foundation.mjs"),
    join(dir, "src/search/foundation.mjs"),
  );
  copyFileSync(
    join(ROOT, "apps/web/src/search/vitePlugin.mjs"),
    join(dir, "src/search/vitePlugin.mjs"),
  );
  copyFileSync(
    join(ROOT, "apps/web/scripts/measure-cwv.mjs"),
    join(dir, "scripts/measure-cwv.mjs"),
  );
  const full = join(dir, spec.file);
  let text = readFileSync(full, "utf8");
  for (const [from, to] of replacementList(spec)) {
    const parts = text.split(from);
    if (parts.length - 1 !== 1) {
      throw new Error(`${spec.file} expected 1 of snippet, found ${parts.length - 1}`);
    }
    text = parts.join(to);
  }
  writeFileSync(full, text);
}

function runOracles(env) {
  const completed = spawnSync(process.execPath, [join(HERE, "oracles.mjs")], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 120000,
  });
  if (completed.status !== 0) {
    throw new Error((completed.stderr || completed.stdout || "oracle failed").slice(-2000));
  }
  const line = completed.stdout.trim().split("\n").at(-1);
  return JSON.parse(line);
}

function git(args) {
  return spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

function runtimeDirty() {
  const completed = git([
    "status",
    "--porcelain",
    "--",
    "apps/web/src/search",
    "apps/web/scripts/measure-cwv.mjs",
    "apps/web/scripts/emit-search-foundation.mjs",
    "apps/web/scripts/test-search-foundation.mjs",
    "apps/web/scripts/test-capabilities-seo.mjs",
    "apps/web/public",
    "apps/web/search-console",
    "apps/web/src/ui/SeoHead.tsx",
    "apps/web/src/routing.ts",
    "spe_runtime",
    "portable/spe-core-rs",
  ]);
  return completed.stdout.split("\n").filter((line) => line.trim());
}

function runCommand(command, args, logName) {
  const completed = spawnSync(command, args, {
    cwd: command === "npm" ? join(ROOT, "apps/web") : ROOT,
    encoding: "utf8",
    timeout: 180000,
  });
  const text = `${completed.stdout ?? ""}\n${completed.stderr ?? ""}`;
  writeFileSync(join(PROOF, logName), text);
  return { status: completed.status, text };
}

function reportMarkdown(payload) {
  const lines = [
    "# SPE CURSOR C6 SEARCH R1 REPORT",
    "",
    `DONOR_SHA: \`${payload.donor_sha}\``,
    `BRANCH: \`cursor/spe-search-r1q-20260930\``,
    `SOURCE_RUNTIME_MODIFIED: ${payload.source_runtime_modified}`,
    "LIVE_SERP: NO",
    "SEARCH_CONSOLE: NO",
    `SEMANTIC_AUTHORITY: ${payload.ledger.semanticAuthority}`,
    "",
    `FINAL: **${payload.verdict}**`,
    "",
  ];
  if (payload.baseline_failures.length) {
    lines.push("## Donor obligations that fail", "");
    for (const [name, failures] of Object.entries(payload.baseline_failure_detail)) {
      lines.push(`- \`${name}\``);
      for (const failure of failures) lines.push(`  - ${failure}`);
    }
    lines.push("");
  }
  lines.push("## Tests", "");
  lines.push(`Existing search foundation: exit ${payload.existing.searchFoundation}`);
  lines.push(`Existing capabilities SEO: exit ${payload.existing.capabilitiesSeo}`);
  lines.push(
    `New qualification suite: tests=${payload.qualification.tests} passed=${payload.qualification.passed} failed=${payload.qualification.failed}`,
  );
  lines.push("");
  lines.push("## Mutants", "");
  lines.push(
    `Defined SR1-01 through SR1-20. Killed ${payload.killed}. Survived ${payload.survived}. Broken ${payload.broken}.`,
    "",
  );
  lines.push("| ID | Defect | Result | Killed by |");
  lines.push("| --- | --- | --- | --- |");
  for (const row of payload.mutants) {
    const by = row.discriminating_failures.includes(row.target)
      ? row.target
      : row.discriminating_failures[0] ?? row.detail ?? "";
    lines.push(`| ${row.id} | ${row.defect} | ${row.status} | ${by} |`);
  }
  lines.push("");
  lines.push("## Ledger", "");
  lines.push("```json");
  lines.push(JSON.stringify(payload.ledger, null, 2));
  lines.push("```");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function qualificationCounts(junitPath) {
  const xml = readFileSync(junitPath, "utf8");
  const tests = Number(xml.match(/<!-- tests (\d+) -->/)?.[1] ?? 0);
  const failed = Number(xml.match(/<!-- fail (\d+) -->/)?.[1] ?? 0);
  const passed = Number(xml.match(/<!-- pass (\d+) -->/)?.[1] ?? 0);
  return { tests, failed, passed };
}

async function main() {
  preflight();
  if (process.argv.includes("--preflight")) {
    console.log("preflight ok");
    return;
  }
  mkdirSync(PROOF, { recursive: true });
  const head = git(["rev-parse", "HEAD"]).stdout.trim();
  const { runAll } = await import("./oracles.mjs");
  const baseline = await runAll();
  const baselinePass = new Set(
    Object.entries(baseline.checks)
      .filter(([, row]) => row.pass)
      .map(([name]) => name),
  );
  const baselineFailures = Object.fromEntries(
    Object.entries(baseline.checks)
      .filter(([, row]) => !row.pass)
      .map(([name, row]) => [name, row.failures]),
  );
  const defined = patches();
  const mutants = [];
  const temp = join(tmpdir(), `sr1-${process.pid}`);
  mkdirSync(temp, { recursive: true });
  for (const id of Object.keys(defined)) {
    const spec = defined[id];
    const dir = join(temp, id);
    try {
      stage(dir, spec);
      const report = runOracles({
        SR1_FOUNDATION: join(dir, "src/search/foundation.mjs"),
        SR1_CWV: join(dir, "scripts/measure-cwv.mjs"),
        SR1_PLUGIN: join(dir, "src/search/vitePlugin.mjs"),
      });
      const mutantFail = new Set(
        Object.entries(report.checks)
          .filter(([, row]) => !row.pass)
          .map(([name]) => name),
      );
      const discriminating = [...mutantFail].filter((name) => baselinePass.has(name)).sort();
      mutants.push({
        id,
        defect: spec.defect,
        target: spec.target,
        status: discriminating.length ? "KILLED" : "SURVIVED",
        discriminating_failures: discriminating,
        donor_exhibits_target: baseline.checks[spec.target]?.pass === false,
      });
    } catch (error) {
      mutants.push({
        id,
        defect: spec.defect,
        target: spec.target,
        status: "BROKEN",
        detail: error instanceof Error ? error.message : String(error),
        discriminating_failures: [],
        donor_exhibits_target: baseline.checks[spec.target]?.pass === false,
      });
    }
  }
  const search = runCommand(
    process.execPath,
    ["apps/web/scripts/test-search-foundation.mjs"],
    "existing-search-foundation.txt",
  );
  const capabilities = runCommand(
    process.execPath,
    ["apps/web/scripts/test-capabilities-seo.mjs"],
    "existing-capabilities-seo.txt",
  );
  const junit = join(PROOF, "junit.xml");
  const specLog = join(PROOF, "qualification-spec.txt");
  const qualification = spawnSync(
    process.execPath,
    [
      "--test",
      "--test-reporter=junit",
      `--test-reporter-destination=${junit}`,
      "--test-reporter=spec",
      `--test-reporter-destination=${specLog}`,
      "tests/search/test_search_r1_qualification.mjs",
    ],
    { cwd: ROOT, encoding: "utf8", timeout: 180000 },
  );
  const qualificationText = `${qualification.stdout ?? ""}\n${qualification.stderr ?? ""}`;
  writeFileSync(join(PROOF, "qualification-test.txt"), qualificationText);
  const counts = qualificationCounts(junit, qualificationText);
  const dirty = runtimeDirty();
  const killed = mutants.filter((row) => row.status === "KILLED").length;
  const survived = mutants.filter((row) => row.status === "SURVIVED").length;
  const broken = mutants.filter((row) => row.status === "BROKEN").length;
  const verdict =
    survived === 0 &&
    broken === 0 &&
    Object.keys(baselineFailures).length === 0 &&
    search.status === 0 &&
    capabilities.status === 0 &&
    counts.failed === 0 &&
    dirty.length === 0
      ? "SEARCH_R1_QUALIFICATION_PASS"
      : "HOLD";
  const payload = {
    donor_sha: DONOR_SHA,
    head,
    branch: "cursor/spe-search-r1q-20260930",
    defined: 20,
    killed,
    survived,
    broken,
    verdict,
    ledger: baseline.ledger,
    baseline_failures: Object.keys(baselineFailures),
    baseline_failure_detail: baselineFailures,
    baseline_passed: [...baselinePass].sort(),
    mutants,
    existing: {
      searchFoundation: search.status,
      capabilitiesSeo: capabilities.status,
    },
    qualification: { ...counts, exit: qualification.status },
    source_runtime_modified: dirty.length > 0,
    source_runtime_status: dirty,
    live_serp: "NO",
    search_console: "NO",
    semantic_authority: baseline.ledger.semanticAuthority,
  };
  writeFileSync(join(PROOF, "mutation_results.json"), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(join(PROOF, "baseline_oracles.json"), `${JSON.stringify(baseline, null, 2)}\n`);
  writeFileSync(join(PROOF, "REPORT.md"), reportMarkdown(payload));
  console.log(
    JSON.stringify(
      {
        verdict,
        killed,
        survived,
        broken,
        baseline_failures: payload.baseline_failures,
        existing: payload.existing,
        qualification: payload.qualification,
        source_runtime_modified: payload.source_runtime_modified,
      },
      null,
      2,
    ),
  );
  if (verdict !== "SEARCH_R1_QUALIFICATION_PASS") process.exitCode = 1;
}

await main();
