/**
 * SPE Project Library Model (Lane A7)
 * Strictly matches schemas/project_library.schema.json (spe.project-library.v1).
 *
 * Invariants:
 * - schema: "spe.project-library.v1"
 * - visibility: "private"
 * - noindex: true
 * - indexing: "noindex"
 * - spe_contract: "NOT_YET_BOUND"
 * - Zero network / zero cloud sync / pure local private storage.
 */

export type ArtifactType =
  | "prompt"
  | "transcript"
  | "website"
  | "code"
  | "research_pack"
  | "template";

export interface Project {
  project_id: string; // pattern: ^prj_[0-9a-f]{32}$
  name: string;
  created_at: string;
  visibility: "private";
  noindex: true;
}

export interface Artifact {
  artifact_id: string; // pattern: ^art_[0-9a-f]{32}$
  project_id: string;
  artifact_type: ArtifactType;
  head_revision_id: string; // pattern: ^rev_[0-9a-f]{32}$
}

export interface Revision {
  kind: "REVISION";
  revision_id: string; // pattern: ^rev_[0-9a-f]{32}$
  artifact_id: string;
  project_id: string;
  parent_revision_id: string | null;
  created_at: string;
  artifact_type: ArtifactType;
  provider_target: string | null;
  provenance_refs: string[];
  quality_evidence_refs: string[];
  body: unknown;
  body_sha256: string; // pattern: ^[0-9a-f]{64}$
  version_label: string | null;
  branched: boolean;
}

export interface HeadMove {
  kind: "HEAD_MOVE";
  project_id: string;
  artifact_id: string;
  revision_id: string;
  created_at: string;
  reason: "ROLLBACK";
}

export type HistoryItem = Revision | HeadMove;

export interface ProjectLibraryBundle {
  schema: "spe.project-library.v1";
  visibility: "private";
  noindex: true;
  indexing: "noindex";
  spe_contract: "NOT_YET_BOUND";
  project: Project;
  artifacts: Artifact[];
  revisions: Revision[];
  history: HistoryItem[];
}

export const ROUTE_MOUNT_STATUS = "NOT_INTEGRATED" as const;

/**
 * Validates whether an imported object satisfies spe.project-library.v1 invariants.
 */
export function validateProjectLibraryBundle(
  data: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Bundle must be a non-null object"] };
  }

  const b = data as Partial<ProjectLibraryBundle>;

  if (b.schema !== "spe.project-library.v1") {
    errors.push(`Invalid schema: expected "spe.project-library.v1", got "${b.schema}"`);
  }
  if (b.visibility !== "private") {
    errors.push(`Invalid visibility: expected "private", got "${b.visibility}"`);
  }
  if (b.noindex !== true) {
    errors.push(`Invalid noindex: expected true, got ${b.noindex}`);
  }
  if (b.indexing !== "noindex") {
    errors.push(`Invalid indexing: expected "noindex", got "${b.indexing}"`);
  }
  if (b.spe_contract !== "NOT_YET_BOUND") {
    errors.push(
      `Invalid spe_contract: expected "NOT_YET_BOUND", got "${b.spe_contract}"`
    );
  }

  if (!b.project || typeof b.project !== "object") {
    errors.push("Missing project metadata");
  } else {
    if (!/^prj_[0-9a-f]{32}$/.test(b.project.project_id || "")) {
      errors.push("Project ID must match ^prj_[0-9a-f]{32}$");
    }
  }

  if (!Array.isArray(b.artifacts)) {
    errors.push("artifacts must be an array");
  }
  if (!Array.isArray(b.revisions)) {
    errors.push("revisions must be an array");
  }
  if (!Array.isArray(b.history)) {
    errors.push("history must be an array");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Synthetic schema fixture. References and fingerprints are examples, not measured evidence.
 */
export const SAMPLE_PROJECT_LIBRARY_BUNDLE: ProjectLibraryBundle = {
  schema: "spe.project-library.v1",
  visibility: "private",
  noindex: true,
  indexing: "noindex",
  spe_contract: "NOT_YET_BOUND",
  project: {
    project_id: "prj_0123456789abcdef0123456789abcdef",
    name: "Synthetic Library Example",
    created_at: "2026-09-30T10:00:00Z",
    visibility: "private",
    noindex: true,
  },
  artifacts: [
    {
      artifact_id: "art_a1000000000000000000000000000001",
      project_id: "prj_0123456789abcdef0123456789abcdef",
      artifact_type: "prompt",
      head_revision_id: "rev_00000000000000000000000000000002",
    },
    {
      artifact_id: "art_b2000000000000000000000000000002",
      project_id: "prj_0123456789abcdef0123456789abcdef",
      artifact_type: "code",
      head_revision_id: "rev_10000000000000000000000000000001",
    },
  ],
  revisions: [
    {
      kind: "REVISION",
      revision_id: "rev_00000000000000000000000000000001",
      artifact_id: "art_a1000000000000000000000000000001",
      project_id: "prj_0123456789abcdef0123456789abcdef",
      parent_revision_id: null,
      created_at: "2026-09-30T10:05:00Z",
      artifact_type: "prompt",
      provider_target: "anthropic:claude-3-5-sonnet",
      provenance_refs: ["prov:prompt_v1_seed"],
      quality_evidence_refs: ["example:syntax_not_verified"],
      body: {
        system: "You are an enterprise system architect.",
        template: "Review the system specification according to ISO 25010.",
      },
      body_sha256: "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
      version_label: "v1.0.0",
      branched: false,
    },
    {
      kind: "REVISION",
      revision_id: "rev_00000000000000000000000000000002",
      artifact_id: "art_a1000000000000000000000000000001",
      project_id: "prj_0123456789abcdef0123456789abcdef",
      parent_revision_id: "rev_00000000000000000000000000000001",
      created_at: "2026-09-30T10:20:00Z",
      artifact_type: "prompt",
      provider_target: "anthropic:claude-3-5-sonnet",
      provenance_refs: ["prov:prompt_v1_seed", "example:eval_not_run"],
      quality_evidence_refs: ["example:syntax_not_verified", "example:cwv_not_measured"],
      body: {
        system: "You are an enterprise system architect specializing in low-latency systems.",
        template: "Review the system specification according to ISO 25010 with p99 < 50ms constraint.",
      },
      body_sha256: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
      version_label: "v1.1.0",
      branched: false,
    },
    {
      kind: "REVISION",
      revision_id: "rev_10000000000000000000000000000001",
      artifact_id: "art_b2000000000000000000000000000002",
      project_id: "prj_0123456789abcdef0123456789abcdef",
      parent_revision_id: null,
      created_at: "2026-09-30T10:30:00Z",
      artifact_type: "code",
      provider_target: "openai:gpt-4o",
      provenance_refs: ["prov:code_spec_init"],
      quality_evidence_refs: ["example:typecheck_not_run"],
      body: {
        entrypoint: "src/index.ts",
        language: "typescript",
        snippet: "export const initEngine = () => ({ status: 'ready' });",
      },
      body_sha256: "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9",
      version_label: "v1.0.0",
      branched: false,
    },
  ],
  history: [
    {
      kind: "REVISION",
      revision_id: "rev_00000000000000000000000000000001",
      artifact_id: "art_a1000000000000000000000000000001",
      project_id: "prj_0123456789abcdef0123456789abcdef",
      parent_revision_id: null,
      created_at: "2026-09-30T10:05:00Z",
      artifact_type: "prompt",
      provider_target: "anthropic:claude-3-5-sonnet",
      provenance_refs: ["prov:prompt_v1_seed"],
      quality_evidence_refs: ["example:syntax_not_verified"],
      body: {
        system: "You are an enterprise system architect.",
        template: "Review the system specification according to ISO 25010.",
      },
      body_sha256: "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
      version_label: "v1.0.0",
      branched: false,
    },
    {
      kind: "REVISION",
      revision_id: "rev_00000000000000000000000000000002",
      artifact_id: "art_a1000000000000000000000000000001",
      project_id: "prj_0123456789abcdef0123456789abcdef",
      parent_revision_id: "rev_00000000000000000000000000000001",
      created_at: "2026-09-30T10:20:00Z",
      artifact_type: "prompt",
      provider_target: "anthropic:claude-3-5-sonnet",
      provenance_refs: ["prov:prompt_v1_seed", "example:eval_not_run"],
      quality_evidence_refs: ["example:syntax_not_verified", "example:cwv_not_measured"],
      body: {
        system: "You are an enterprise system architect specializing in low-latency systems.",
        template: "Review the system specification according to ISO 25010 with p99 < 50ms constraint.",
      },
      body_sha256: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
      version_label: "v1.1.0",
      branched: false,
    },
    {
      kind: "HEAD_MOVE",
      project_id: "prj_0123456789abcdef0123456789abcdef",
      artifact_id: "art_a1000000000000000000000000000001",
      revision_id: "rev_00000000000000000000000000000001",
      created_at: "2026-09-30T10:25:00Z",
      reason: "ROLLBACK",
    },
    {
      kind: "REVISION",
      revision_id: "rev_10000000000000000000000000000001",
      artifact_id: "art_b2000000000000000000000000000002",
      project_id: "prj_0123456789abcdef0123456789abcdef",
      parent_revision_id: null,
      created_at: "2026-09-30T10:30:00Z",
      artifact_type: "code",
      provider_target: "openai:gpt-4o",
      provenance_refs: ["prov:code_spec_init"],
      quality_evidence_refs: ["example:typecheck_not_run"],
      body: {
        entrypoint: "src/index.ts",
        language: "typescript",
        snippet: "export const initEngine = () => ({ status: 'ready' });",
      },
      body_sha256: "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9",
      version_label: "v1.0.0",
      branched: false,
    },
  ],
};
