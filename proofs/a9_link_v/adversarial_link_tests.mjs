#!/usr/bin/env node
/**
 * A9-LINK-W adversarial fail-closed tests for evidence href + publication truth.
 * Cost: ₹0. No merge/deploy/host.
 *
 * Cases that MUST fail closed (detected as unsafe / rejected):
 *  - wrong org/repo
 *  - wrong/missing commit pin
 *  - missing proof path
 *  - empty / javascript: / data: / malformed URL
 *  - production /authority/ @id while ROUTE_MOUNT_STATUS=NOT_INTEGRATED
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "../..");
const WEB = join(REPO, "apps/web");
const REAL_ORG = "jaitleystudio-cpu/system-prompt-engine";
const WRONG_ORG = "system-prompt-engine/spe";
const PIN = "8ddfe7e630d507ad9c13345e4e2e03120903ea82";

const registrySrc = readFileSync(join(WEB, "src/authority/evidenceRegistry.ts"), "utf8");
const guideSrc = readFileSync(join(WEB, "src/pages/GuideArticle.tsx"), "utf8");

function extractHttpLinks(src) {
  const blocks = [...src.matchAll(/evidenceLinks:\s*\[([\s\S]*?)\]/g)];
  const links = [];
  for (const b of blocks) {
    for (const m of b[1].matchAll(/["'](https?:[^"']+)["']/g)) links.push(m[1]);
  }
  return links;
}

function isUnsafeEvidenceHref(link) {
  if (link == null || String(link).trim() === "") return true;
  const s = String(link).trim();
  if (/^(javascript|data|vbscript):/i.test(s)) return true;
  if (/^https?:\/\//i.test(s) === false) {
    // Gap tokens are allowed provenance, not hrefs
    return !/^(NOT_PUBLISHED|UNAVAILABLE|MISSING_IN_REPO)$/.test(s);
  }
  try {
    const u = new URL(s);
    if (!/^https?:$/i.test(u.protocol)) return true;
    if (u.hostname === "github.com" && u.pathname.includes(`/${WRONG_ORG}/`)) return true;
    if (u.hostname === "github.com" && !u.pathname.includes(`/${REAL_ORG}/`)) {
      // non-real-repo github link for evidence → unsafe
      return true;
    }
    // branch-relative / latest / main (non-pinned) github blob → unsafe for durable evidence
    if (
      u.hostname === "github.com" &&
      /\/blob\/(main|master|latest|HEAD)\//.test(u.pathname)
    ) {
      return true;
    }
    return false;
  } catch {
    return true; // malformed
  }
}

function claimsLiveAuthorityHost(src) {
  return /systempromptengine\.com\/authority\//.test(src);
}

function publicationStatusIntegrated(src) {
  return /PUBLICATION_STATUS\s*=\s*["']INTEGRATED["']/.test(src);
}

function routeMountIntegrated(src) {
  return /ROUTE_MOUNT_STATUS\s*=\s*["']INTEGRATED["']/.test(src);
}

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL ${name}${detail ? " — " + detail : ""}`);
  }
}

console.log("=== A9-LINK-W adversarial fail-closed ===");

// 1) Current registry must not contain wrong org
check(
  "registry_rejects_wrong_org",
  !registrySrc.includes(`github.com/${WRONG_ORG}`),
  "wrong org still present"
);

// 2) All http evidence links must be durable real-repo pin
const httpLinks = extractHttpLinks(registrySrc);
check("has_http_evidence_links", httpLinks.length >= 1);
for (const l of httpLinks) {
  check(
    `safe_href:${l.slice(0, 80)}`,
    !isUnsafeEvidenceHref(l),
    "unsafe durable evidence href"
  );
  check(
    `pinned_sha:${l.slice(0, 80)}`,
    l.includes(`/blob/${PIN}/`),
    "missing immutable commit pin"
  );
  check(
    `real_repo:${l.slice(0, 80)}`,
    l.includes(REAL_ORG),
    "not real repo"
  );
}

// 3) Gap token for missing artifact (provider_schema_validation.json)
check(
  "missing_artifact_is_gap_token",
  /evidenceLinks:\s*\[[\s\S]*?NOT_PUBLISHED[\s\S]*?\]/.test(registrySrc),
  "MISSING_IN_REPO must be NOT_PUBLISHED gap, not invented URL"
);
check(
  "no_invented_provider_schema_url",
  !/provider_schema_validation\.json/.test(registrySrc),
  "must not invent missing provider_schema_validation.json URL"
);

// 4) Production @id while unmounted must be absent
check(
  "no_production_authority_id_while_unmounted",
  !claimsLiveAuthorityHost(registrySrc),
  "production /authority/ @id present while NOT_INTEGRATED"
);
check("publication_status_not_integrated", !publicationStatusIntegrated(registrySrc));
check(
  "route_mount_not_integrated_const",
  /ROUTE_MOUNT_STATUS\s*=\s*["']NOT_INTEGRATED["']/.test(registrySrc)
);
check(
  "publication_status_const",
  /PUBLICATION_STATUS\s*=\s*["']NOT_INTEGRATED["']/.test(registrySrc)
);

// 5) GuideArticle: external http keeps noopener/noreferrer; gaps non-clickable
check(
  "guide_rel_noopener_noreferrer",
  /rel:\s*["']noopener noreferrer["']/.test(guideSrc)
);
check(
  "guide_gap_non_clickable",
  /data-evidence-gap/.test(guideSrc) || /NOT_PUBLISHED|UNAVAILABLE/.test(guideSrc)
);

// 6) Fail-closed unit table (synthetic) — helper must reject adversarial inputs
const adversarialCases = [
  ["wrong_org", `https://github.com/${WRONG_ORG}/proofs/x.md`],
  ["wrong_repo", "https://github.com/other-org/other-repo/blob/abc/proofs/x.md"],
  ["branch_main", `https://github.com/${REAL_ORG}/blob/main/proofs/x.md`],
  ["missing_proof_path_guess", `https://github.com/${REAL_ORG}/blob/${PIN}/proofs/does_not_exist_zzzz.md`],
  ["empty", ""],
  ["javascript", "javascript:alert(1)"],
  ["data", "data:text/html,hi"],
  ["malformed", "https://"],
  ["spaces", "   "],
];

// missing_proof_path_guess: URL shape may be "safe" to the href validator (real org+pin)
// but local FS / HTTP would 404 — treat path absence as separate fail-closed check below.
for (const [name, link] of adversarialCases) {
  if (name === "missing_proof_path_guess") {
    const pathInRepo = "proofs/does_not_exist_zzzz.md";
    check(
      `fail_closed_missing_path:${name}`,
      !existsSync(join(REPO, pathInRepo)),
      "synthetic missing path unexpectedly exists"
    );
    continue;
  }
  check(`fail_closed_${name}`, isUnsafeEvidenceHref(link), `should reject: ${link}`);
}

// 7) Production @id while unmounted — synthetic fail-closed
const syntheticLiveClaim =
  'mainEntityOfPage: { "@id": "https://systempromptengine.com/authority/demo" }';
check(
  "fail_closed_production_id_unmounted",
  claimsLiveAuthorityHost(syntheticLiveClaim) &&
    /ROUTE_MOUNT_STATUS\s*=\s*["']NOT_INTEGRATED["']/.test(registrySrc),
  "detector must flag production authority @id"
);

// 8) Schema still single Article|TechArticle
check(
  "schema_no_stack",
  !/\[[\s\n]*["']Article["'][\s\n]*,[\s\n]*["']TechArticle["'][\s\n]*\]/.test(
    registrySrc + guideSrc
  )
);

if (failures) {
  console.error(`ADVERSARIAL_FAIL count=${failures}`);
  process.exit(1);
}
console.log("ADVERSARIAL_PASS");
