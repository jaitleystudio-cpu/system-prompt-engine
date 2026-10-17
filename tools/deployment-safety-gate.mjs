#!/usr/bin/env node
/**
 * Deployment safety gate — FAILS CLOSED.
 * Does NOT deploy. HOSTING=FORBIDDEN until founder unlocks with evidence.
 *
 * Required before any future public host:
 *  - DDoS protection
 *  - Hard bandwidth / spend ceiling
 *  - TLS
 *  - Security headers
 *  - Cache policy
 *  - Abuse protection
 *  - No unlimited surprise billing
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const proofDir = join(repo, "proofs/spe_v1_gap_closure");
mkdirSync(proofDir, { recursive: true });

const ENV = {
  DDOS_PROTECTION_PROVEN: process.env.SPE_DDOS_PROTECTION_PROVEN === "1",
  BANDWIDTH_CEILING_PROVEN: process.env.SPE_BANDWIDTH_CEILING_PROVEN === "1",
  TLS_PROVEN: process.env.SPE_TLS_PROVEN === "1",
  SECURITY_HEADERS_PROVEN: process.env.SPE_SECURITY_HEADERS_PROVEN === "1",
  CACHE_POLICY_PROVEN: process.env.SPE_CACHE_POLICY_PROVEN === "1",
  ABUSE_PROTECTION_PROVEN: process.env.SPE_ABUSE_PROTECTION_PROVEN === "1",
  NO_UNLIMITED_BILLING_PROVEN: process.env.SPE_NO_UNLIMITED_BILLING_PROVEN === "1",
  FOUNDER_HOSTING_UNLOCK: process.env.SPE_FOUNDER_HOSTING_UNLOCK === "1",
};

const headersPath = join(repo, "apps/web/public/_headers");
const headersOk =
  existsSync(headersPath) &&
  /Content-Security-Policy/.test(readFileSync(headersPath, "utf8")) &&
  /frame-ancestors 'none'/.test(readFileSync(headersPath, "utf8")) &&
  /nosniff/.test(readFileSync(headersPath, "utf8"));

const checks = [
  {
    id: "ddos_protection",
    ok: ENV.DDOS_PROTECTION_PROVEN,
    detail: "Requires SPE_DDOS_PROTECTION_PROVEN=1 with provider evidence",
  },
  {
    id: "bandwidth_spend_ceiling",
    ok: ENV.BANDWIDTH_CEILING_PROVEN,
    detail: "Requires SPE_BANDWIDTH_CEILING_PROVEN=1 hard cap evidence",
  },
  {
    id: "tls",
    ok: ENV.TLS_PROVEN,
    detail: "Requires SPE_TLS_PROVEN=1 for apex HTTPS",
  },
  {
    id: "security_headers_artifact",
    ok: headersOk,
    detail: headersOk
      ? "apps/web/public/_headers present with CSP/frame-ancestors/nosniff"
      : "Missing hardened _headers",
  },
  {
    id: "security_headers_live",
    ok: ENV.SECURITY_HEADERS_PROVEN,
    detail: "Requires SPE_SECURITY_HEADERS_PROVEN=1 live response proof",
  },
  {
    id: "cache_policy",
    ok: ENV.CACHE_POLICY_PROVEN,
    detail: "Requires SPE_CACHE_POLICY_PROVEN=1 (shell vs immutable assets)",
  },
  {
    id: "abuse_protection",
    ok: ENV.ABUSE_PROTECTION_PROVEN,
    detail: "Requires SPE_ABUSE_PROTECTION_PROVEN=1 (rate limits / WAF)",
  },
  {
    id: "no_unlimited_billing",
    ok: ENV.NO_UNLIMITED_BILLING_PROVEN,
    detail: "Requires SPE_NO_UNLIMITED_BILLING_PROVEN=1 spend ceiling",
  },
  {
    id: "founder_unlock",
    ok: ENV.FOUNDER_HOSTING_UNLOCK,
    detail: "Requires SPE_FOUNDER_HOSTING_UNLOCK=1 — default FORBIDDEN",
  },
];

const failed = checks.filter((c) => !c.ok);
const report = {
  gate: "deployment-safety",
  HOSTING: "FORBIDDEN",
  WORLD_NUMBER_1: "NOT_PROVEN",
  fail_closed: true,
  would_allow_deploy: failed.length === 0,
  checks,
  failed: failed.map((f) => f.id),
  at: new Date().toISOString(),
};

writeFileSync(join(proofDir, "deployment_safety_gate.json"), JSON.stringify(report, null, 2));
writeFileSync(
  join(proofDir, "DEPLOYMENT_SAFETY_GATE.md"),
  [
    "# Deployment safety gate (FAIL CLOSED)",
    "",
    "**HOSTING=FORBIDDEN.** This gate does not deploy.",
    "**WORLD#1=NOT_PROVEN.**",
    "",
    "| Requirement | Status | Detail |",
    "|---|---|---|",
    ...checks.map(
      (c) => `| ${c.id} | ${c.ok ? "PASS" : "**FAIL**"} | ${c.detail} |`,
    ),
    "",
    failed.length
      ? `Gate result: **FAIL CLOSED** (${failed.length} unmet). Do not host.`
      : "Gate result: all env proofs set — still requires explicit founder action outside this script.",
    "",
  ].join("\n"),
);

console.log(JSON.stringify({ ok: failed.length === 0, failed: report.failed, HOSTING: "FORBIDDEN" }, null, 2));
process.exit(failed.length ? 2 : 0);
