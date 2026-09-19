/**
 * .spe portable artifact — open / inspect / export / import / lineage / integrity.
 */

export type SpeArtifactV1 = {
  spe_format: "spe.artifact.v1";
  created_at_utc: string;
  user_request: string;
  category: string;
  target: string;
  envelope: unknown;
  wasm: {
    status: string | null;
    disposition: string | null;
    reason_code: string | null;
    sha256: string | null;
    imports: number | null;
    network_mode: "NONE";
    used_ts_fallback: false;
  };
  rendered_prompt: string;
  intent: {
    confirmed: { id: string; label: string; text: string }[];
    assumed: { id: string; label: string; text: string }[];
    unknowns: { id: string; label: string; text: string }[];
    conflicts: { id: string; label: string; text: string }[];
  };
  lineage: {
    engine: "spe_wasm.wasm → spe-core-rs";
    abi: "spe.universal-abi.v1";
    ui: "SPE-WEB-01";
    not_a_release: true;
  };
  integrity: {
    algorithm: "SHA-256";
    content_sha256: string;
    state: "COMPUTED" | "VERIFIED" | "MISMATCH";
  };
};

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildSpeArtifact(
  partial: Omit<SpeArtifactV1, "spe_format" | "integrity" | "lineage" | "created_at_utc"> & {
    created_at_utc?: string;
  },
): Promise<SpeArtifactV1> {
  const base = {
    spe_format: "spe.artifact.v1" as const,
    created_at_utc: partial.created_at_utc ?? new Date().toISOString(),
    user_request: partial.user_request,
    category: partial.category,
    target: partial.target,
    envelope: partial.envelope,
    wasm: partial.wasm,
    rendered_prompt: partial.rendered_prompt,
    intent: partial.intent,
    lineage: {
      engine: "spe_wasm.wasm → spe-core-rs" as const,
      abi: "spe.universal-abi.v1" as const,
      ui: "SPE-WEB-01" as const,
      not_a_release: true as const,
    },
  };
  const canonical = JSON.stringify(base);
  const digest = await sha256Hex(canonical);
  return {
    ...base,
    integrity: {
      algorithm: "SHA-256",
      content_sha256: digest,
      state: "COMPUTED",
    },
  };
}

export async function verifySpeArtifact(art: SpeArtifactV1): Promise<SpeArtifactV1> {
  const { integrity, ...body } = art;
  const digest = await sha256Hex(JSON.stringify(body));
  return {
    ...art,
    integrity: {
      algorithm: "SHA-256",
      content_sha256: integrity.content_sha256,
      state: digest === integrity.content_sha256 ? "VERIFIED" : "MISMATCH",
    },
  };
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
