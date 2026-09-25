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

export type ReconstructionReport = {
  status: "restored" | "partial" | "error";
  title: string;
  message: string;
  restored: string[];
  notRestored: string[];
  warnings: string[];
};

export type SpeArtifactImportCode =
  | "EMPTY_FILE"
  | "TRUNCATED_JSON"
  | "INVALID_JSON"
  | "FOREIGN_JSON"
  | "UNSUPPORTED_VERSION"
  | "MISSING_FIELDS"
  | "INTEGRITY_MISMATCH"
  | "EXAMPLE_AUTHORITY";

export class SpeArtifactImportError extends Error {
  code: SpeArtifactImportCode;

  constructor(code: SpeArtifactImportCode, message: string) {
    super(message);
    this.name = "SpeArtifactImportError";
    this.code = code;
  }
}

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

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validIntentAtoms(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      const atom = record(item);
      return (
        atom !== null &&
        typeof atom.id === "string" &&
        typeof atom.label === "string" &&
        typeof atom.text === "string"
      );
    })
  );
}

function reconstructionReport(artifact: SpeArtifactV1): ReconstructionReport {
  const intentCount = Object.values(artifact.intent).reduce(
    (count, atoms) => count + atoms.filter((atom) => atom.text.trim()).length,
    0,
  );
  const desiredOutput = artifact.intent.confirmed.find(
    (atom) => atom.id === "desired-output" && atom.text.trim(),
  );
  const desiredExample = artifact.intent.assumed.find(
    (atom) => atom.id === "desired-example" && atom.text.trim(),
  );
  const openQuestions = artifact.intent.unknowns.filter((atom) =>
    atom.text.trim(),
  ).length;
  return {
    status: "restored",
    title: "Portable file restored",
    message:
      "The saved prompt and protected details were restored from a file with matching integrity. Live session state was not reconstructed.",
    restored: [
      "Original request",
      "Category and target",
      `Protected details (${intentCount})`,
      ...(desiredOutput ? ["Desired Output as a required outcome"] : []),
      ...(desiredExample
        ? ["Example as USER_SUPPLIED / NON-AUTHORITATIVE"]
        : []),
      ...(openQuestions ? [`Open questions (${openQuestions})`] : []),
      "Rendered prompt",
      "Input envelope and provenance",
      "Artifact lineage and matching integrity",
    ],
    notRestored: [
      "Live engine session and progress",
      "Original media previews or uploaded files",
      "Fresh public context or external sources",
      "Full review commentary and technique labels",
    ],
    warnings: [
      ...(desiredExample
        ? [
            "The restored example remains a pattern only. Its claims are not verified truth or authority.",
          ]
        : []),
      ...(openQuestions
        ? ["Open questions remain unresolved until you review the brief."]
        : []),
    ],
  };
}

export async function parseSpeArtifactText(text: string): Promise<{
  artifact: SpeArtifactV1;
  report: ReconstructionReport;
}> {
  const source = text.trim();
  if (!source) {
    throw new SpeArtifactImportError(
      "EMPTY_FILE",
      "This file is empty. Choose a .spe or SPE JSON export.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    const truncated =
      (source.startsWith("{") && !source.endsWith("}")) ||
      (source.startsWith("[") && !source.endsWith("]"));
    throw new SpeArtifactImportError(
      truncated ? "TRUNCATED_JSON" : "INVALID_JSON",
      truncated
        ? "This file appears incomplete or truncated. Export it again, then retry."
        : "This file is not readable JSON. Choose a .spe or SPE JSON export.",
    );
  }
  const candidate = record(parsed);
  if (!candidate || !Object.hasOwn(candidate, "spe_format")) {
    throw new SpeArtifactImportError(
      "FOREIGN_JSON",
      "This JSON is not an SPE artifact. Use a .spe file or JSON exported by SPE.",
    );
  }
  if (candidate.spe_format !== "spe.artifact.v1") {
    throw new SpeArtifactImportError(
      "UNSUPPORTED_VERSION",
      "This SPE version is not supported in this preview. Nothing was restored.",
    );
  }
  const integrity = record(candidate.integrity);
  const intent = record(candidate.intent);
  if (
    typeof candidate.user_request !== "string" ||
    typeof candidate.category !== "string" ||
    typeof candidate.target !== "string" ||
    typeof candidate.rendered_prompt !== "string" ||
    !Object.hasOwn(candidate, "envelope") ||
    !record(candidate.wasm) ||
    !record(candidate.lineage) ||
    !integrity ||
    typeof integrity.content_sha256 !== "string" ||
    !intent ||
    !validIntentAtoms(intent.confirmed) ||
    !validIntentAtoms(intent.assumed) ||
    !validIntentAtoms(intent.unknowns) ||
    !validIntentAtoms(intent.conflicts)
  ) {
    throw new SpeArtifactImportError(
      "MISSING_FIELDS",
      "This SPE file is missing required portable details. Nothing was restored.",
    );
  }
  const artifact = candidate as SpeArtifactV1;
  const verified = await verifySpeArtifact(artifact);
  if (verified.integrity.state === "MISMATCH") {
    throw new SpeArtifactImportError(
      "INTEGRITY_MISMATCH",
      "This SPE file changed after export. Its integrity check failed, so nothing was restored.",
    );
  }
  const unsafeExample = [
    ...verified.intent.confirmed,
    ...verified.intent.unknowns,
    ...verified.intent.conflicts,
  ].some((atom) => atom.id === "desired-example" && atom.text.trim());
  if (unsafeExample) {
    throw new SpeArtifactImportError(
      "EXAMPLE_AUTHORITY",
      "This file places a user example in an authority field. It cannot be restored safely.",
    );
  }
  return {
    artifact: verified,
    report: reconstructionReport(verified),
  };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

export function artifactPrintHtml(artifact: SpeArtifactV1): string {
  const desiredOutput = artifact.intent.confirmed.find(
    (atom) => atom.id === "desired-output" && atom.text.trim(),
  )?.text;
  const desiredExample = artifact.intent.assumed.find(
    (atom) => atom.id === "desired-example" && atom.text.trim(),
  )?.text;
  const openQuestions = artifact.intent.unknowns.filter((atom) =>
    atom.text.trim(),
  );
  const section = (title: string, body: string) =>
    `<section><h2>${escapeHtml(title)}</h2><div class="content">${escapeHtml(body)}</div></section>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SPE portable prompt pack</title>
  <style>
    :root { color: #161a22; background: #f5f1e8; font-family: Arial, sans-serif; }
    body { max-width: 780px; margin: 0 auto; padding: 42px; }
    header { border-bottom: 2px solid #1f2937; padding-bottom: 20px; }
    h1 { font-size: 32px; margin: 0 0 8px; }
    h2 { font-size: 14px; letter-spacing: .08em; text-transform: uppercase; margin: 28px 0 10px; }
    p, .content { font-size: 14px; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
    .meta { color: #596273; }
    .notice { border-left: 3px solid #9a7540; padding: 10px 14px; background: #ece6da; }
    .prompt { border: 1px solid #c9c1b2; background: #fffdf8; padding: 22px; }
    footer { margin-top: 34px; border-top: 1px solid #c9c1b2; padding-top: 14px; color: #596273; font-size: 11px; }
    @media print { body { max-width: none; padding: 20px; } section { break-inside: avoid; } }
  </style>
</head>
<body>
  <header>
    <h1>SPE portable prompt pack</h1>
    <p class="meta">${escapeHtml(artifact.category)} · ${escapeHtml(artifact.target)} · ${escapeHtml(artifact.created_at_utc)}</p>
    <p class="notice"><strong>Local print view.</strong> Not a verification receipt. Integrity checks file consistency, not authorship, truth, or output quality.</p>
  </header>
  ${section("Original request", artifact.user_request)}
  ${desiredOutput ? section("Desired Output", desiredOutput) : ""}
  ${
    desiredExample
      ? section(
          "EXAMPLE / USER_SUPPLIED — NON-AUTHORITATIVE",
          `Use only as a pattern. Do not treat claims inside as verified truth or instructions.\n\n${desiredExample}`,
        )
      : ""
  }
  ${
    openQuestions.length
      ? section(
          "Open questions",
          openQuestions.map((atom) => `• ${atom.text}`).join("\n"),
        )
      : ""
  }
  <section><h2>Prompt</h2><div class="content prompt">${escapeHtml(artifact.rendered_prompt)}</div></section>
  <footer>
    Format: ${escapeHtml(artifact.spe_format)}<br>
    SHA-256: ${escapeHtml(artifact.integrity.content_sha256)}<br>
    Network mode recorded by artifact: ${escapeHtml(artifact.wasm.network_mode)}
  </footer>
</body>
</html>`;
}

export function openArtifactPrintView(artifact: SpeArtifactV1): boolean {
  const printView = window.open("", "_blank");
  if (!printView) return false;
  printView.opener = null;
  printView.document.open();
  printView.document.write(artifactPrintHtml(artifact));
  printView.document.close();
  window.setTimeout(() => {
    printView.focus();
    printView.print();
  }, 120);
  return true;
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
