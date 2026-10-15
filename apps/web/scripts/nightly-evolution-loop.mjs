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

const scheduler = new NightlyEvolutionScheduler();

try {
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
  console.log(`🚀 Low-Risk Auto-Deploy: ${receipt.proposalsAutoReleased}`);
  console.log(`👥 Gated for Human PR:   ${receipt.proposalsHeldForHumanReview}`);
  console.log(`❌ Proposals Rejected:   ${receipt.proposalsRejected}`);
  console.log(`📜 Summary Digest:       ${receipt.summaryReceiptDigest}`);
  console.log("──────────────────────────────────────────────────────────────────────────\n");
  console.log("🎉 NIGHTLY EVOLUTION CYCLE COMPLETED SUCCESSFULLY.");
} catch (err) {
  console.error("❌ [FATAL] Nightly evolution cycle failed:", err);
  process.exit(1);
}
