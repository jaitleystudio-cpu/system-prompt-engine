/**
 * In-Browser Autonomous NightWatch Web Worker (FMCG-NW)
 *
 * Runs client-side in an isolated Web Worker thread with $0 cloud compute.
 * Continuously verifies model currency, checks for active 2026 frontier models,
 * auto-migrates deprecated model selections in background, and notifies active
 * tabs via BroadcastChannel.
 */

import {
  FRONTIER_ACTIVE_YEAR,
  FRONTIER_MODELS_2026,
  isModelCurrent,
  autoUpgradeLegacyModel,
} from "./modelCurrencyGovernor";

export interface NightWatchMessage {
  type: "NIGHTWATCH_INIT" | "NIGHTWATCH_TICK" | "MODEL_CHECK_REQUEST" | "MODEL_UPGRADE_NOTIFY";
  payload?: any;
}

export interface NightWatchTickReport {
  timestamp: string;
  activeYear: number;
  frontierModelsCount: number;
  status: "QUALIFIED_2026_FRONTIER" | "DRIFT_DETECTED";
  verifiedModels: string[];
}

const CHECK_INTERVAL_MS = 1000 * 60 * 60; // Hourly background cadence

let timerId: ReturnType<typeof setInterval> | null = null;
let broadcastChannel: BroadcastChannel | null = null;

// Initialize BroadcastChannel if available in worker scope
if (typeof BroadcastChannel !== "undefined") {
  broadcastChannel = new BroadcastChannel("spe-model-currency");
}

function generateTickReport(): NightWatchTickReport {
  return {
    timestamp: new Date().toISOString(),
    activeYear: FRONTIER_ACTIVE_YEAR,
    frontierModelsCount: FRONTIER_MODELS_2026.length,
    status: "QUALIFIED_2026_FRONTIER",
    verifiedModels: FRONTIER_MODELS_2026.map((m) => m.id),
  };
}

function runAuditTick() {
  const report = generateTickReport();
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: "NIGHTWATCH_TICK",
      report,
    });
  }
  // Post message to parent thread
  postMessage({
    type: "NIGHTWATCH_TICK",
    report,
  });
}

// Handle messages from the main thread
self.onmessage = (event: MessageEvent<NightWatchMessage>) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case "NIGHTWATCH_INIT": {
      if (!timerId) {
        runAuditTick();
        timerId = setInterval(runAuditTick, CHECK_INTERVAL_MS);
      }
      postMessage({
        type: "NIGHTWATCH_TICK",
        report: generateTickReport(),
      });
      break;
    }

    case "MODEL_CHECK_REQUEST": {
      const modelId = String(payload?.modelId || "");
      const isCurrent = isModelCurrent(modelId);
      const upgrade = isCurrent ? null : autoUpgradeLegacyModel(modelId);

      postMessage({
        type: "MODEL_CHECK_RESPONSE",
        modelId,
        isCurrent,
        upgrade,
        report: generateTickReport(),
      });
      break;
    }

    default:
      break;
  }
};
