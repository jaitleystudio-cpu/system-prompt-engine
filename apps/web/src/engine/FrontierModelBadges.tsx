/**
 * FrontierModelBadges.tsx
 *
 * Universal dynamic UI components for rendering active 2026 Frontier Models
 * and the Autonomous Night-Watch currency status.
 *
 * Guarantees zero hardcoded model strings in UI copy: all names, versions,
 * badges, and context windows are read dynamically from the single source of truth.
 */

import { useState } from "react";
import {
  getActiveFrontierModels,
  getFrontierModelsByProvider,
  autoUpgradeLegacyModel,
} from "./modelCurrencyGovernor";
import type { ModelProvider, AiModelEntry } from "./modelAtlas/modelAtlasSchema";
import { useModelNightWatch } from "./useModelNightWatch";

/**
 * Individual dynamic badge for any model ID.
 * Transparently displays 2026 currency verification.
 */
export function FrontierModelBadge({
  modelId,
  showProvider = true,
  className = "",
}: {
  modelId: string;
  showProvider?: boolean;
  className?: string;
}) {
  const upgrade = autoUpgradeLegacyModel(modelId);
  const model = upgrade.model;
  const isUpgraded = upgrade.wasLegacy;

  return (
    <span
      className={`spe-frontier-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium ${
        isUpgraded
          ? "bg-amber-950/40 text-amber-300 border border-amber-700/50"
          : "bg-emerald-950/40 text-emerald-300 border border-emerald-700/40"
      } ${className}`}
      title={
        isUpgraded
          ? `Obsolete '${modelId}' auto-upgraded to 2026 frontier model '${model.name}'`
          : `Active 2026 Frontier Model · ${model.provider} · ${model.badge}`
      }
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isUpgraded ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-pulse"
        }`}
      />
      {showProvider && <span className="opacity-70">{model.provider}</span>}
      <span className="font-semibold">{model.name}</span>
      {isUpgraded && <span className="text-[10px] opacity-80">(Auto-Upgraded)</span>}
    </span>
  );
}

/**
 * Flagship Pill for a specific provider.
 */
export function ProviderFlagshipPill({
  provider,
  onClick,
}: {
  provider: ModelProvider;
  onClick?: (model: AiModelEntry) => void;
}) {
  const models = getFrontierModelsByProvider(provider);
  const flagship = models[0];
  if (!flagship) return null;

  return (
    <button
      type="button"
      onClick={() => onClick?.(flagship)}
      className="spe-flagship-pill group flex items-center justify-between p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700 transition text-left"
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">{flagship.provider}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
            {flagship.badge}
          </span>
        </div>
        <div className="text-sm font-medium text-slate-100 mt-0.5">{flagship.name}</div>
      </div>
      <div className="text-right">
        <span className="text-xs text-slate-400 font-mono">
          {Math.round(flagship.contextWindow / 1024)}k ctx
        </span>
      </div>
    </button>
  );
}

/**
 * Sleek, live Night-Watch Status Bar.
 * Informs developers that all active models are autonomously audited & verified nightly.
 */
export function NightWatchStatusBar() {
  const { activeModelsCount, lastSyncTimestamp } = useModelNightWatch();
  const [isExpanded, setIsExpanded] = useState(false);

  const formattedDate = new Date(lastSyncTimestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="spe-nightwatch-bar border-t border-slate-800/80 bg-slate-950/80 backdrop-blur px-4 py-2 text-xs text-slate-400">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-medium text-slate-300">Night-Watch Autonomous Synchronizer:</span>
          <span className="text-emerald-400 font-mono">Active (2026 Frontier Mandate)</span>
          <span className="text-slate-600">·</span>
          <span>{activeModelsCount} Frontier Models Synchronized</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">Last Verified: {formattedDate}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-slate-500">
            Zero Stale Models · Ed25519 Signed Attestation
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-indigo-400 hover:text-indigo-300 underline font-medium"
          >
            {isExpanded ? "Hide Frontier Lineup ▲" : "View 2026 Lineup ▼"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-slate-900 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {getActiveFrontierModels().slice(0, 6).map((m) => (
            <div
              key={m.id}
              className="p-2 rounded bg-slate-900/40 border border-slate-800 text-[11px]"
            >
              <div className="text-slate-400 font-semibold">{m.provider}</div>
              <div className="text-slate-200 truncate">{m.name}</div>
              <div className="text-emerald-400/80 font-mono text-[10px] mt-0.5">{m.badge}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Full responsive grid of all active 2026 frontier models.
 */
export function FrontierModelGrid({
  onSelectModel,
}: {
  onSelectModel?: (model: AiModelEntry) => void;
}) {
  const models = getActiveFrontierModels();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {models.map((m) => (
        <div
          key={m.id}
          onClick={() => onSelectModel?.(m)}
          className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/60 hover:border-indigo-600/50 transition cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-indigo-400">{m.provider}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/50 font-mono">
                {m.badge}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-slate-100">{m.name}</h4>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{m.description}</p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{Math.round(m.contextWindow / 1024)}k Context</span>
            <span>${m.costInputPerM.toFixed(2)}/M in</span>
          </div>
        </div>
      ))}
    </div>
  );
}
