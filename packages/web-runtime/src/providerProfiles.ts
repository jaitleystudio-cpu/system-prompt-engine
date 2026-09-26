/**
 * Thin TS mirror of Turn 2 provider profile registry for web display + record bind.
 *
 * Semantic owner remains Python: spe_runtime.providers.profiles / adapter.
 * This module does NOT invent a second brain — ids/versions/capabilities are
 * mirrored from data/provider_profiles_v1.json for local dry-run binding and UI.
 * WASM parity of select_profile is out of scope for Batch E Turn 4.
 */

export const PROVIDER_PROFILE_DISPLAY_SOURCE = "ts_mirror" as const;
export const PROVIDER_PROFILE_SEMANTIC_OWNER =
  "spe_runtime.providers.profiles+adapter" as const;

/** Batch H environment capability tags — mirrored for UI honesty (Python owns semantics). */
export const ENVIRONMENT_CAPABILITY_TAGS = [
  "repository_access",
  "file_access",
  "browser_computer_use",
] as const;
export type EnvironmentCapabilityTag =
  (typeof ENVIRONMENT_CAPABILITY_TAGS)[number];

export type MirroredProviderProfile = {
  profile_id: string;
  provider: string;
  profile_version: string;
  local_or_external: "local" | "external";
  requires_network: boolean;
  requires_credentials: boolean;
  capabilities: string[];
  authority_capabilities: string[];
  /** Precomputed via Python provider_profile_digest (canonical sha256). */
  profile_digest: string;
};

/** Local-first order — must match spe_runtime.providers.adapter._LOCAL_FIRST_ORDER. */
const LOCAL_FIRST_ORDER = [
  "DETERMINISTIC",
  "LOCAL_WASM",
  "EXTERNAL_OPTIONAL",
] as const;

/**
 * Static mirror of data/provider_profiles_v1.json (registry_version 1.1.0).
 * Digests verified against Python provider_profile_digest at Turn 4 bind time.
 */
export const MIRRORED_PROVIDER_PROFILES: readonly MirroredProviderProfile[] = [
  {
    profile_id: "DETERMINISTIC",
    provider: "spe.deterministic",
    profile_version: "1.0.0",
    local_or_external: "local",
    requires_network: false,
    requires_credentials: false,
    capabilities: [
      "deterministic_fixture",
      "replay",
      "offline",
      "test_double",
    ],
    authority_capabilities: ["read_status"],
    profile_digest:
      "241a3cd79fbfe921dc84835145e89639a8c90703574b87f77d06b158a93afe8d",
  },
  {
    profile_id: "LOCAL_WASM",
    provider: "spe.local_wasm",
    profile_version: "1.1.0",
    local_or_external: "local",
    requires_network: false,
    requires_credentials: false,
    capabilities: [
      "local_inference",
      "wasm_runtime",
      "deterministic_fixture",
      "offline",
      "file_access",
      "repository_access",
    ],
    authority_capabilities: [],
    profile_digest:
      "f21bf3293f8facbbea23bd8e70c6fc5452eeff53d4d7c86c5ec143c1d5eeb71b",
  },
  {
    profile_id: "EXTERNAL_OPTIONAL",
    provider: "spe.external_optional",
    profile_version: "1.1.0",
    local_or_external: "external",
    requires_network: true,
    requires_credentials: true,
    capabilities: [
      "external_optional",
      "network_optional",
      "compat_adapter",
      "browser_computer_use",
    ],
    authority_capabilities: [],
    profile_digest:
      "abfd8e8ebaeadc17ab92198bbe00dce2de4734fe907fb1c28ca0680b6645b639",
  },
] as const;

export type ProfileSelectionMirror = {
  profile_id: string | null;
  profile_version: string | null;
  profile_digest: string | null;
  status: "SELECTED" | "BLOCKED" | "UNAVAILABLE";
  reason: string;
  /** Always false — selection never mints authority. */
  authority_granted: false;
  network_enabled: false;
  credentials_released: false;
  display_source: typeof PROVIDER_PROFILE_DISPLAY_SOURCE;
  semantic_owner: typeof PROVIDER_PROFILE_SEMANTIC_OWNER;
};

export type MirrorRoutingPolicy = {
  allow_external?: boolean;
  allow_network?: boolean;
};

function byLocalFirst(): MirroredProviderProfile[] {
  const map = new Map(
    MIRRORED_PROVIDER_PROFILES.map((p) => [p.profile_id, p]),
  );
  const ordered: MirroredProviderProfile[] = [];
  for (const id of LOCAL_FIRST_ORDER) {
    const hit = map.get(id);
    if (hit) {
      ordered.push(hit);
      map.delete(id);
    }
  }
  for (const id of [...map.keys()].sort()) {
    ordered.push(map.get(id)!);
  }
  return ordered;
}

/**
 * Local-first selection mirror for web dry-run bind / UI.
 * EXTERNAL_OPTIONAL requires explicit allow_external — never silent remote.
 * Never grants authority, enables network, or releases credentials.
 */
export function selectMirroredProfile(
  policy: MirrorRoutingPolicy = {},
): ProfileSelectionMirror {
  const allowExternal = Boolean(policy.allow_external);
  const allowNetwork = Boolean(policy.allow_network || policy.allow_external);

  for (const profile of byLocalFirst()) {
    const isExternal =
      profile.local_or_external === "external" ||
      profile.profile_id === "EXTERNAL_OPTIONAL";
    if (isExternal && !allowExternal) {
      continue;
    }
    if (profile.requires_network && !allowNetwork) {
      continue;
    }
    return {
      profile_id: profile.profile_id,
      profile_version: profile.profile_version,
      profile_digest: profile.profile_digest,
      status: "SELECTED",
      reason: isExternal
        ? `selected ${profile.profile_id} after local profiles skipped; allow_external=true; selection is not an authority grant; network not auto-enabled (ts_mirror)`
        : `selected ${profile.profile_id} via local-first routing (preferred over external); selection is not an authority grant (ts_mirror)`,
      authority_granted: false,
      network_enabled: false,
      credentials_released: false,
      display_source: PROVIDER_PROFILE_DISPLAY_SOURCE,
      semantic_owner: PROVIDER_PROFILE_SEMANTIC_OWNER,
    };
  }

  if (!allowExternal) {
    return {
      profile_id: null,
      profile_version: null,
      profile_digest: null,
      status: "BLOCKED",
      reason:
        "EXTERNAL_OPTIONAL blocked: allow_external is false (no silent remote fallback) (ts_mirror)",
      authority_granted: false,
      network_enabled: false,
      credentials_released: false,
      display_source: PROVIDER_PROFILE_DISPLAY_SOURCE,
      semantic_owner: PROVIDER_PROFILE_SEMANTIC_OWNER,
    };
  }

  return {
    profile_id: null,
    profile_version: null,
    profile_digest: null,
    status: "UNAVAILABLE",
    reason: "no selectable provider profile under current policy (ts_mirror)",
    authority_granted: false,
    network_enabled: false,
    credentials_released: false,
    display_source: PROVIDER_PROFILE_DISPLAY_SOURCE,
    semantic_owner: PROVIDER_PROFILE_SEMANTIC_OWNER,
  };
}

export function getMirroredProviderProfile(
  profileId: string,
): MirroredProviderProfile | null {
  return (
    MIRRORED_PROVIDER_PROFILES.find((p) => p.profile_id === profileId) ?? null
  );
}
