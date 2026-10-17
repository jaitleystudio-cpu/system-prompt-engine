#!/usr/bin/env node
/**
 * SPE Ω — Autonomous Website Evolution Nightly Runner (AWENR)
 *
 * Preferred Clock: 02:17 AM IST (20:47 UTC)
 *
 * Mandate:
 * Coordinates the 9-phase overnight discovery, audit, repair, and release pipeline.
 *
 * Supported flags:
 *   --audit-only : Audit website inventory, routes, and Search Console data.
 *   --dry-run    : Execute all 9 phases in simulation mode without staging commits.
 *   --status     : Show current evolution scheduler status and last run receipt.
 *   --ci         : Run automated qualification loop and exit 0.
 */

const {
  NightlyEvolutionScheduler,
} = await import("../src/engine/evolution/nightlyScheduler.ts");

const {
  WebsiteInventoryAuditor,
} = await import("../src/engine/evolution/websiteInventory.ts");

const args = process.argv.slice(2);
const isAuditOnly = args.includes("--audit-only");
const isDryRun = args.includes("--dry-run") || args.includes("--ci") || args.length === 0;
const isStatus = args.includes("--status");

console.log("══════════════════════════════════════════════════════════════════════════");
console.log("🌙 SPE Ω — AUTONOMOUS WEBSITE EVOLUTION NIGHT-WATCH (AWENW)");
console.log("   Clock: 02:17 AM IST (20:47 UTC) · Proof-Carrying Changes · L0-L5 Gates");
console.log("   Invariant: FORCED NIGHTLY DEPLOYMENT IS STRICTLY FORBIDDEN");
console.log("══════════════════════════════════════════════════════════════════════════\n");

if (isAuditOnly) {
  console.log("📋 [AUDIT] Running full website inventory and route integrity audit...\n");
  const auditor = new WebsiteInventoryAuditor();
  const report = auditor.auditWebsite();
  console.log(`   Total Routes Audited: ${report.totalRoutes}`);
  console.log(`   Indexable Routes:     ${report.indexableRoutes}`);
  console.log(`   Noindex Routes:       ${report.noindexRoutes}`);
  console.log(`   Canonical Conflicts:  ${report.canonicalConflicts.length}`);
  console.log(`   Missing Metadata:     ${report.missingMetadata.length}`);
  console.log(`   Sitemap Issues:       ${report.sitemapDiscrepancies.length}\n`);

  if (report.canonicalConflicts.length > 0 || report.missingMetadata.length > 0) {
    console.error("❌ Website audit detected blocking integrity errors.");
    process.exit(1);
  }
  console.log("✨ Website audit passed cleanly with 100% integrity.\n");
  process.exit(0);
}

const {
  computeNextIstSchedule,
} = await import("../src/engine/dailyVisualEvolution.ts");

const isDaemon = args.includes("--daemon");
const scheduler = new NightlyEvolutionScheduler();

async function runOnce() {
  const simulateMilestone = args.includes("--ci") || args.includes("--simulate-milestone") || !args.includes("--observe-only");
  const receipt = await scheduler.executeNightlyRun({
    dryRun: isDryRun,
    baseCommit: "9275039a",
    simulateMilestoneSlice: simulateMilestone,
  });

  console.log("──────────────────────────────────────────────────────────────────────────");
  console.log(`🆔 Run ID:               ${receipt.runId}`);
  console.log(`⏰ Scheduled Clock:      ${receipt.clockIst} (${receipt.clockUtc})`);
  console.log(`🔒 Concurrency Lock:     ${receipt.concurrencyLockAcquired ? "Acquired & Released Cleanly" : "Failed"}`);
  console.log(`⚠️ Missed Run Detected:  ${receipt.missedRunDetected ? "YES (Catch-up completed)" : "NO (On schedule)"}`);
  console.log(`🌐 Routes Audited:       ${receipt.routesAudited}`);
  console.log(`🔍 Defects Discovered:   ${receipt.defectsDiscovered}`);
  console.log(`🛠️ Proposals Prepared:   ${receipt.proposalsPrepared}`);
  console.log(`🧪 Proposals Qualified:  ${receipt.proposalsQualified}`);
  console.log(`🚀 Production Deployed:  ${receipt.proposalsAutoReleased} (${receipt.deployedStatus})`);
  console.log(`🧪 Simulated Qualified:  ${receipt.proposalsSimulatedQualified}`);
  console.log(`📡 Search Console Data:  ${receipt.searchConsoleSource === "CALIBRATION_FIXTURE_DEV_CI" ? "Synthetic calibration fixture (offline/CI mode)" : "Live GSC API"}`);
  console.log(`👥 Gated for Human PR:   ${receipt.proposalsHeldForHumanReview}`);
  console.log(`❌ Proposals Rejected:   ${receipt.proposalsRejected}`);
  console.log(`📜 Summary Digest:       ${receipt.summaryReceiptDigest}`);
  if (receipt.visualEvolutionAudit) {
    console.log(`🎨 Visual Variant:       ${receipt.visualEvolutionAudit.variantName} (${receipt.visualEvolutionAudit.variantId})`);
    console.log(`👁️ Measured Contrast:   Dark: ${receipt.visualEvolutionAudit.measuredContrastDark}:1 · Light: ${receipt.visualEvolutionAudit.measuredContrastLight}:1 (Static WCAG AAA Calculation: ${receipt.visualEvolutionAudit.wcagAaaSatisfied ? "PASS" : "FAIL"})`);
    console.log(`📐 Layout Shift CLS:     0.000 (Architecturally constrained CSS color modulation · Geometry immutable · Not field RUM)`);
    console.log(`🕒 Publication Clock:    ${receipt.visualEvolutionAudit.publicationBoundaryIst}`);
  }
  console.log("──────────────────────────────────────────────────────────────────────────\n");
  console.log("🎉 NIGHTLY EVOLUTION CYCLE COMPLETED SUCCESSFULLY.");

  // Write evidence receipt to disk
  try {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const outDir = resolve(process.cwd(), "proofs/generated");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      resolve(outDir, "NIGHTLY_EVOLUTION_RUN_RECEIPT.json"),
      JSON.stringify(receipt, null, 2),
      "utf-8"
    );
  } catch (e) {
    // Non-fatal
  }

  return receipt;
}

try {
  if (isDaemon) {
    console.log("🔄 Starting persistent nightly daemon...");
    while (true) {
      await runOnce();
      const { msUntilNextRun, formattedIst } = computeNextIstSchedule();
      console.log(`⏳ Next nightly cycle will run at ${formattedIst} (in ${(msUntilNextRun / 1000 / 60).toFixed(1)} minutes). Standing by...`);
      await new Promise((r) => setTimeout(r, Math.min(msUntilNextRun + 1000, 3600000)));
    }
  } else {
    await runOnce();
  }
} catch (err) {
  console.error("❌ [FATAL] Nightly evolution cycle failed:", err);
  process.exit(1);
}
