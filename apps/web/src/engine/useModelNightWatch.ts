/**
 * useModelNightWatch React Hook
 *
 * Provides real-time reactive binding to the in-browser NightWatch engine.
 * Ensures client sessions automatically migrate legacy model selections,
 * stay synchronized with the active 2026 frontier registry, and receive
 * background currency attestations.
 */

import { useState, useEffect, useCallback } from "react";
import {
  FRONTIER_ACTIVE_YEAR,
  getActiveFrontierModels,
  autoUpgradeLegacyModel,
  isModelCurrent,
} from "./modelCurrencyGovernor";
import type { AiModelEntry } from "./modelAtlas/modelAtlasSchema";

export interface NightWatchState {
  isActive: boolean;
  activeYear: number;
  activeModelsCount: number;
  lastSyncTimestamp: string;
  recentlyUpgraded: boolean;
  upgradeNotice: string | null;
  activeModels: AiModelEntry[];
}

const STORAGE_KEYS_TO_AUDIT = [
  "spe_selected_model",
  "spe_target_platform",
  "spe_eval_model",
  "spe_last_compiled_dialect",
  "spe_preferred_model_id",
];

export function useModelNightWatch(): NightWatchState & {
  verifyAndUpgradeModel: (modelId: string) => { upgradedId: string; wasLegacy: boolean };
} {
  const [state, setState] = useState<NightWatchState>({
    isActive: true,
    activeYear: FRONTIER_ACTIVE_YEAR,
    activeModelsCount: 18,
    lastSyncTimestamp: new Date().toISOString(),
    recentlyUpgraded: false,
    upgradeNotice: null,
    activeModels: getActiveFrontierModels(),
  });

  // Client-side local storage migration
  const auditAndMigrateStorage = useCallback(() => {
    if (typeof window === "undefined" || !window.localStorage) return;

    let upgradedAny = false;
    let latestNotice: string | null = null;

    for (const key of STORAGE_KEYS_TO_AUDIT) {
      try {
        const storedVal = window.localStorage.getItem(key);
        if (storedVal && !isModelCurrent(storedVal)) {
          const upgrade = autoUpgradeLegacyModel(storedVal);
          if (upgrade.wasLegacy) {
            window.localStorage.setItem(key, upgrade.upgradedId);
            upgradedAny = true;
            latestNotice = upgrade.upgradeNotice || `Migrated '${storedVal}' to '${upgrade.upgradedId}'`;
          }
        }
      } catch {
        // Storage might be restricted
      }
    }

    if (upgradedAny) {
      setState((prev) => ({
        ...prev,
        recentlyUpgraded: true,
        upgradeNotice: latestNotice,
      }));
    }
  }, []);

  useEffect(() => {
    auditAndMigrateStorage();

    // Listen to cross-tab synchronization via BroadcastChannel
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("spe-model-currency");
      channel.onmessage = (event) => {
        if (event.data?.type === "NIGHTWATCH_TICK") {
          setState((prev) => ({
            ...prev,
            lastSyncTimestamp: event.data.report?.timestamp || new Date().toISOString(),
          }));
        }
      };
    }

    // Tab visibility listener (re-audits when user switches back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        auditAndMigrateStorage();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (channel) channel.close();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [auditAndMigrateStorage]);

  const verifyAndUpgradeModel = useCallback((modelId: string) => {
    const upgrade = autoUpgradeLegacyModel(modelId);
    return {
      upgradedId: upgrade.upgradedId,
      wasLegacy: upgrade.wasLegacy,
    };
  }, []);

  return {
    ...state,
    verifyAndUpgradeModel,
  };
}
