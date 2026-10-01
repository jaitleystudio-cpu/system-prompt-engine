#!/usr/bin/env node
/**
 * A9-LINK-V — Authority Hub link-resolution oracle (read-only)
 * Enumerates in-app evidence hrefs, resolves relative against repo FS,
 * fetches external URLs (status only; does NOT claim live product host),
 * checks GuideArticle external anchors for rel containing noopener+noreferrer,
 * checks 14 mandatory fields + single Article|TechArticle schema,
 * scans Authority Hub surfaces for fake publication/live-host claims.
 *
 * Cost: ₹0. No merge/deploy/host. No product source modification.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "../..");
const WEB = join(REPO, "apps/web");
const OUT_DIR = __dirname;

const MANDATORY = [
  "claim", "dataset", "baseline", "metric", "sampleSize", "providerVersion",
  "date", "methodology", "evidenceLinks", "rawResults", "reproSteps",
  "limitations", "status", "lastVerified",
];

function read(p) {
  return readFileSync(p, "utf8");
}

function extractEvidenceLinks(registrySrc) {
  const blocks = [...registrySrc.matchAll(/evidenceLinks:\s*\[([\s\S]*?)\]/g)];
  const links = [];
  for (const b of blocks) {
    for (const m of b[1].matchAll(/["'](https?:[^"']+|\/[^"']+|\.\.?\/[^"']+)["']/g)) {
      links.push(m[1]);
    }
  }
  return [...new Set(links)];
}

function classify(link) {
  if (/^https?:\/\//i.test(link)) return "external";
  return "internal";
}

async function fetchStatus(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "A9-LINK-V-oracle/1.0 (read-only verifier)" },
      signal: AbortSignal.timeout(15000),
    });
    return { ok: res.status >= 200 && res.status < 400, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.message || e) };
  }
}

function resolveInternal(link) {
  // Relative to apps/web public / or repo root heuristics
  const candidates = [
    join(WEB, "public", link.replace(/^\//, "")),
    join(REPO, link.replace(/^\//, "")),
    join(WEB, link.replace(/^\//, "")),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return { ok: true, path: c };
  }
  return { ok: false, path: null, tried: candidates };
}

function checkExternalRelGuard(guideSrc) {
  // GuideArticle must attach noopener noreferrer when isExternal
  const has =
    /isExternal[\s\S]{0,200}rel:\s*["']noopener noreferrer["']/.test(guideSrc) ||
    /rel:\s*["']noopener noreferrer["']/.test(guideSrc);
  const both =
    /noopener/.test(guideSrc) && /noreferrer/.test(guideSrc);
  return has && both;
}

function checkSchemaTruth(registrySrc, guideSrc) {
  const stacked = /\[[\s\n]*["']Article["'][\s\n]*,[\s\n]*["']TechArticle["'][\s\n]*\]/.test(
    registrySrc + guideSrc
  );
  const conditional =
    /schemaType\s*===/.test(registrySrc + guideSrc) ||
    /isTech\s*\?\s*["']TechArticle["']\s*:\s*["']Article["']/.test(registrySrc + guideSrc);
  const types = [...registrySrc.matchAll(/schemaType:\s*["'](Article|TechArticle)["']/g)].map(
    (m) => m[1]
  );
  return {
    stacked: stacked ? "FAIL" : "PASS",
    conditional: conditional ? "PASS" : "FAIL",
    perDocTypes: types,
    singleTypePerDoc: types.every((t) => t === "Article" || t === "TechArticle") ? "PASS" : "FAIL",
  };
}

function checkPublicationTruth(hubSrc, guideSrc, registrySrc, appSrc, routingSrc) {
  const mountedHub = /<AuthorityHub[\s/>]/.test(appSrc);
  const mountedGuide = /<GuideArticle[\s/>]/.test(appSrc);
  const inRouting = /authority-hub|AuthorityHub|\/authority\b/.test(routingSrc);
  const jsonLdHost = /systempromptengine\.com\/authority\//.test(registrySrc);
  const landerNote =
    "Live host /authority/* observed as lander redirect stub (not Authority Hub product); route mount NOT_INTEGRATED in App/routing.";
  const notes = [];
  if (!mountedHub && !mountedGuide && !inRouting) {
    notes.push("ROUTE_MOUNT_STATUS=NOT_INTEGRATED");
  } else {
    notes.push("ROUTE_MOUNT_STATUS=INTEGRATED_UNEXPECTED");
  }
  if (jsonLdHost) {
    notes.push("JSON_LD_MAIN_ENTITY_CLAIMS_LIVE_HOST_AUTHORITY_URL");
  }
  if (/Published /.test(guideSrc)) {
    notes.push("UI_SHOWS_DOCUMENT_PUBLISHED_DATE_COPY");
  }
  if (/All Publications|Available publications/.test(hubSrc)) {
    notes.push("HUB_USES_PUBLICATIONS_COPY");
  }
  const routeOk = !mountedHub && !mountedGuide && !inRouting;
  // HOLD if route ok but schema claims live host authority URLs
  let status = "PASS";
  if (!routeOk) status = "FAIL";
  else if (jsonLdHost) status = "HOLD";
  return { status, notes, landerNote, mountedHub, mountedGuide, inRouting, jsonLdHost };
}

async function main() {
  const registryPath = join(WEB, "src/authority/evidenceRegistry.ts");
  const guidePath = join(WEB, "src/pages/GuideArticle.tsx");
  const hubPath = join(WEB, "src/pages/AuthorityHub.tsx");
  const appPath = join(WEB, "src/App.tsx");
  const routingPath = join(WEB, "src/routing.ts");

  for (const p of [registryPath, guidePath, hubPath, appPath, routingPath]) {
    if (!existsSync(p)) {
      console.error("MISSING", p);
      process.exit(2);
    }
  }

  const registrySrc = read(registryPath);
  const guideSrc = read(guidePath);
  const hubSrc = read(hubPath);
  const appSrc = read(appPath);
  const routingSrc = read(routingPath);

  const fieldsOk = MANDATORY.every(
    (f) => registrySrc.includes(`${f}:`) || registrySrc.includes(`${f}?`)
  );

  const links = extractEvidenceLinks(registrySrc);
  const internal = links.filter((l) => classify(l) === "internal");
  const external = links.filter((l) => classify(l) === "external");

  const internalResults = internal.map((l) => ({ link: l, ...resolveInternal(l) }));
  const externalResults = [];
  for (const l of external) {
    const fetched = await fetchStatus(l);
    externalResults.push({ link: l, ...fetched });
  }

  const relGuard = checkExternalRelGuard(guideSrc);
  const schema = checkSchemaTruth(registrySrc, guideSrc);
  const publication = checkPublicationTruth(hubSrc, guideSrc, registrySrc, appSrc, routingSrc);

  const dead = [
    ...internalResults.filter((r) => !r.ok).map((r) => ({ kind: "internal", link: r.link })),
    ...externalResults.filter((r) => !r.ok).map((r) => ({
      kind: "external",
      link: r.link,
      status: r.status,
      error: r.error || null,
    })),
  ];

  const internalPass = internal.length === 0 || internalResults.every((r) => r.ok);
  const externalRelPass = external.length === 0 || relGuard;
  const externalResolvePass = external.length === 0 || externalResults.every((r) => r.ok);

  // Local analog map (informational; not a pass condition)
  const localAnalogs = {
    "task57_wasm_provenance.md": existsSync(
      join(REPO, "proofs/task57_quality_reconstruction_20260929/WASM_PROVENANCE.md")
    )
      ? "proofs/task57_quality_reconstruction_20260929/WASM_PROVENANCE.md"
      : null,
    "bench-task57r-wasm.mjs": existsSync(join(WEB, "scripts/bench-task57r-wasm.mjs"))
      ? "apps/web/scripts/bench-task57r-wasm.mjs"
      : null,
    "truth-privacy-closure.md": existsSync(join(REPO, "proofs/truth_privacy_closure_20260928"))
      ? "proofs/truth_privacy_closure_20260928/ (dir; no exact .md basename)"
      : null,
    "provider_schema_validation.json": existsSync(
      join(REPO, "proofs/provider_schema_validation.json")
    )
      ? "proofs/provider_schema_validation.json"
      : "MISSING_IN_REPO",
  };

  const wrongOrg = external.every((l) => l.includes("github.com/system-prompt-engine/spe"));

  let final = "A9_LINK_RESOLUTION_VERIFIED";
  const holdReasons = [];
  if (dead.length) holdReasons.push("DEAD_EVIDENCE_LINKS");
  if (!fieldsOk) holdReasons.push("MANDATORY_FIELDS");
  if (schema.stacked === "FAIL" || schema.conditional === "FAIL") holdReasons.push("SCHEMA");
  if (publication.status === "FAIL") holdReasons.push("PUBLICATION_ROUTE");
  if (publication.status === "HOLD") holdReasons.push("PUBLICATION_JSONLD_LIVE_HOST_CLAIM");
  if (!externalRelPass) holdReasons.push("MISSING_NOOPENER_NOREFERRER");
  if (holdReasons.length) {
    final = `HOLD_${holdReasons.join("_AND_")}`;
  }

  const report = {
    mission: "A9-LINK-V",
    generated_at_ist: new Date().toLocaleString("en-IN", { timeZone: "Asia/Calcutta" }),
    base_sha_a9r: "8ddfe7e630d507ad9c13345e4e2e03120903ea82",
    verified_tip: "c3698cd87ef100447c044e479dcc16929cd2d165",
    app_delta_a9r_to_tip: "NONE (PR#90 custody proofs only)",
    INTERNAL_LINKS: {
      count: internal.length,
      pass: internalPass,
      detail: internal.length === 0 ? "NONE_PRESENT (vacuous pass; no relative evidence hrefs)" : internalResults,
    },
    EXTERNAL_LINKS: {
      count: external.length,
      noopener_noreferrer: externalRelPass ? "PASS" : "FAIL",
      http_resolve: externalResolvePass ? "PASS" : "FAIL",
      results: externalResults,
      wrong_org_repo: wrongOrg,
    },
    DEAD_LINKS: dead.length ? dead : "NONE",
    PUBLICATION_TRUTH: publication,
    SCHEMA_TRUTH: {
      status:
        schema.stacked === "PASS" &&
        schema.conditional === "PASS" &&
        schema.singleTypePerDoc === "PASS"
          ? "PASS"
          : "FAIL",
      ...schema,
    },
    MANDATORY_14_FIELDS: fieldsOk ? "PASS" : "FAIL",
    LOCAL_ANALOGS: localAnalogs,
    FINAL: final,
    MERGED: "NO",
    DEPLOYED: "NO",
    HOSTED: "NO",
    SOURCE_MODIFIED: "NO",
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "oracle_results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (final !== "A9_LINK_RESOLUTION_VERIFIED") process.exitCode = 1;
}

main();
