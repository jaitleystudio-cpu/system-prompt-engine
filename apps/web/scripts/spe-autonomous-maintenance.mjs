#!/usr/bin/env node
/**
 * apps/web/scripts/spe-autonomous-maintenance.mjs
 *
 * SPE Ω — Unified Autonomous Maintenance CLI Runner & Daily Watchdog
 *
 * Preferred Schedule:
 *   - 02:17 AM IST (20:47 UTC): Primary maintenance cycle (discover, test, qualify, release permitted)
 *   - 03:00 AM IST (21:30 UTC): Watchdog check (detect dropped or stalled jobs, catch up)
 *   - 06:00 AM IST (00:30 UTC): Morning receipt publication and health review
 *
 * Supported Flags:
 *   --run       : Execute the scheduled 02:17 AM IST maintenance cycle
 *   --watchdog  : Execute the watchdog check for missed or interrupted runs
 *   --status    : Display current maintenance ledger state and active production pointer
 *   --ci        : Run automated CI verification loop and exit 0 on clean completion
 *   --dry-run   : Run in simulation mode without staging releases
 */

import { resolve } from "node:path";
import {
  SpeMaintenanceController,
} from "../src/engine/maintenance/speMaintenanceController.ts";
import {
  getAsiaKolkataBusinessDate,
} from "../src/engine/maintenance/durableMaintenanceLedger.ts";

const args = process.argv.slice(2);
const isWatchdog = args.includes("--watchdog");
const isStatus = args.includes("--status");
const isDryRun = args.includes("--dry-run") || args.includes("--ci") || (!args.includes("--run") && !args.includes("--watchdog"));

console.log("══════════════════════════════════════════════════════════════════════════");
console.log("🛡️ SPE Ω — UNIFIED AUTONOMOUS MAINTENANCE CONTROLLER & WATCHDOG");
console.log("   Single-Authority Coordinator · Fenced Monotonic Leases · 8-Stage Loop");
console.log(`   Business Date: ${getAsiaKolkataBusinessDate()} (Asia/Kolkata)`);
console.log("══════════════════════════════════════════════════════════════════════════\n");

const controller = new SpeMaintenanceController();
const ledger = controller.getLedger();

if (isStatus) {
  const state = ledger.getState();
  console.log("📊 CURRENT MAINTENANCE LEDGER STATUS:");
  console.log(`   Ledger Version:           ${state.version}`);
  console.log(`   Highest Fencing Token:    ${state.highestFencingToken}`);
  console.log(`   Active Production Pointer:${state.activeProductionPointer}`);
  console.log(`   Rollback Target Pointer:  ${state.rollbackTargetPointer}`);
  console.log(`   Total Jobs in History:    ${state.history.length}`);
  if (state.activeLease) {
    console.log(`   ⚠️ Active Lease Held By:   ${state.activeLease.workerId} (expires: ${state.activeLease.expiresAtIso})`);
  } else {
    console.log(`   ✓ No Active Leases:       Idle & ready`);
  }

  const missedCheck = ledger.checkMissedRunStatus();
  console.log(`   Missed Run Status:        ${missedCheck.isMissed ? "MISSED/STALLED" : "OK"} (${missedCheck.reason})`);
  console.log("\n──────────────────────────────────────────────────────────────────────────");
  process.exit(0);
}

const triggerType = isWatchdog
  ? "WATCHDOG_0300_IST"
  : "SCHEDULED_0217_IST";

console.log(`▶ Initiating Maintenance Cycle: ${triggerType} (Mode: ${isDryRun ? "DRY RUN" : "PRODUCTION"})...\n`);

try {
  const receipt = await controller.executeMaintenanceCycle({
    triggerType,
    dryRun: isDryRun,
    workerId: `cli-${process.pid}`,
  });

  console.log("──────────────────────────────────────────────────────────────────────────");
  console.log(`🆔 Job ID:                ${receipt.jobId}`);
  console.log(`📅 Business Date:         ${receipt.businessDate} (${receipt.clockIst} / ${receipt.clockUtc})`);
  console.log(`🔒 Fencing Token:         ${receipt.fencingToken}`);
  console.log(`⚖️ Final Verdict:          ${receipt.finalVerdict}`);
  console.log(`🚀 Production Deployed:   ${receipt.executionMode === "PRODUCTION" && receipt.finalVerdict === "RELEASED_PERMITTED"}`);
  console.log(`🏷️ Active Release Pointer:${receipt.activeProductionPointer}`);
  console.log(`↩️ Rollback Target:       ${receipt.rollbackTargetPointer}`);
  console.log(`🔍 Discovered Changes:    ${receipt.discoveredChangesCount}`);
  console.log(`✅ Permitted Changes:     ${receipt.permittedChangesApplied}`);
  console.log(`👥 Gated for Human PR:    ${receipt.heldForHumanReviewCount}`);
  console.log(`💰 Cloud Compute Spend:   $${receipt.cloudComputeSpendUsd.toFixed(4)} (Zero Egress: ${receipt.zeroEgressPreserved})`);
  console.log(`📜 Receipt Digest:        ${receipt.receiptDigest}`);
  console.log("\n📋 SPECIALIST JOBS EXECUTION SUMMARY:");
  for (const [name, result] of Object.entries(receipt.specialistJobResults)) {
    const icon = result.status === "PASSED" || result.status === "NO_CHANGES_NEEDED" || result.status === "REPAIRED" ? "✓" : "✗";
    console.log(`   ${icon} [${name}]: ${result.status} — ${result.summary}`);
  }
  console.log("──────────────────────────────────────────────────────────────────────────\n");
  console.log(`✨ ${receipt.truthDisclosure}\n`);
  console.log("🎉 MAINTENANCE CYCLE COMPLETED SUCCESSFULLY.");
  process.exit(0);
} catch (err) {
  console.error("❌ [FATAL] Maintenance cycle failed:", err);
  process.exit(1);
}
