/**
 * Thin session adapter for spe.project-library.v1.
 *
 * Holds the public export bundle in memory. It does not read or write the library JSONL
 * journal, fsync, or crash recovery — those stay in
 * spe_runtime.storage.project_library.ProjectLibrary.
 *
 * spe_contract on every bundle is NOT_YET_BOUND. A library bundle is not a
 * .spe document. Canonical .spe bytes are not re-serialized here.
 */

const LIBRARY_SCHEMA = "spe.project-library.v1";
const SPE_CONTRACT = "NOT_YET_BOUND";
const MAX_BODY_BYTES = 1_048_576;
const ARTIFACT_TYPES = Object.freeze([
  "prompt",
  "transcript",
  "website",
  "code",
  "research_pack",
  "template",
]);

const TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const IDS = {
  prj: /^prj_[0-9a-f]{32}$/,
  art: /^art_[0-9a-f]{32}$/,
  rev: /^rev_[0-9a-f]{32}$/,
};
const REF = /^[A-Za-z0-9:._/-]+$/;
const LABEL = /^[A-Za-z0-9._-]{1,64}$/;
const TARGET = /^[A-Za-z0-9._:-]{1,64}$/;
const IDENTITY_KEYS = new Set([
  "email",
  "account",
  "account_id",
  "user_email",
  "user_id",
  "e_mail",
]);
const REVISION_KEYS = new Set([
  "kind",
  "revision_id",
  "artifact_id",
  "project_id",
  "parent_revision_id",
  "created_at",
  "artifact_type",
  "provider_target",
  "provenance_refs",
  "quality_evidence_refs",
  "body",
  "body_sha256",
  "version_label",
  "branched",
]);
const HEAD_MOVE_KEYS = new Set([
  "kind",
  "project_id",
  "artifact_id",
  "revision_id",
  "created_at",
  "reason",
]);

export { ARTIFACT_TYPES, LIBRARY_SCHEMA, SPE_CONTRACT };

export class LibrarySessionError extends Error {
  /**
   * @param {string} code
   * @param {string} reason
   */
  constructor(code, reason) {
    super(`${code}: ${reason}`);
    this.name = "LibrarySessionError";
    this.code = code;
    this.reason = reason;
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalJson(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new LibrarySessionError("CORRUPT_ENTRY", "body is not JSON");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = /** @type {Record<string, unknown>} */ (value);
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new LibrarySessionError("CORRUPT_ENTRY", "body is not JSON");
}

/**
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * @param {unknown} before
 * @param {unknown} after
 * @param {string} [path]
 * @returns {Array<{op: string, path: string, before: unknown, after: unknown}>}
 */
export function diffBodies(before, after, path = "") {
  if (sameJson(before, after)) return [];
  if (isPlainObject(before) && isPlainObject(after)) {
    const changes = [];
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      const child = path ? `${path}.${key}` : key;
      if (!Object.prototype.hasOwnProperty.call(before, key)) {
        changes.push({ op: "add", path: child, before: null, after: after[key] });
      } else if (!Object.prototype.hasOwnProperty.call(after, key)) {
        changes.push({ op: "remove", path: child, before: before[key], after: null });
      } else {
        changes.push(...diffBodies(before[key], after[key], child));
      }
    }
    return changes;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const changes = [];
    const width = Math.max(before.length, after.length);
    for (let index = 0; index < width; index += 1) {
      const child = `${path}[${index}]`;
      if (index >= before.length) {
        changes.push({ op: "add", path: child, before: null, after: after[index] });
      } else if (index >= after.length) {
        changes.push({ op: "remove", path: child, before: before[index], after: null });
      } else {
        changes.push(...diffBodies(before[index], after[index], child));
      }
    }
    return changes;
  }
  return [{ op: "replace", path: path || "$", before, after }];
}

/**
 * Gate for canonical .spe export. The bundle contract never changes.
 * This adapter does not re-serialize .spe bytes.
 *
 * @param {unknown} body
 * @returns {{ bundleContract: "NOT_YET_BOUND", code: "NOT_YET_BOUND" | "VERIFIED_HEAD", reason: string }}
 */
export function exportSpeDecision(body) {
  const bundleContract = SPE_CONTRACT;
  if (!isVerifiedSpeBody(body)) {
    return {
      bundleContract,
      code: "NOT_YET_BOUND",
      reason: "revision body is not a canonical spe artifact",
    };
  }
  return {
    bundleContract,
    code: "VERIFIED_HEAD",
    reason:
      "head body is already marked VERIFIED; library bundle stays NOT_YET_BOUND and this page does not re-serialize .spe text",
  };
}

/**
 * @returns {ProjectLibrarySession}
 */
export function createProjectLibrarySession() {
  /** @type {Map<string, ProjectRecord>} */
  const projects = new Map();
  /** @type {string[]} */
  const projectOrder = [];
  /** @type {Map<string, ArtifactRecord>} */
  const artifacts = new Map();
  /** @type {string[]} */
  const artifactOrder = [];
  /** @type {Map<string, RevisionRecord>} */
  const revisions = new Map();
  /** @type {Map<string, string[]>} */
  const revOrder = new Map();
  /** @type {HistoryEntry[]} */
  const history = [];

  /**
   * @param {string} artifactId
   * @param {string | null} parentRevisionId
   */
  function branched(artifactId, parentRevisionId) {
    if (parentRevisionId === null) return false;
    const artifact = artifacts.get(artifactId);
    const headId = artifact ? artifact.head_revision_id : null;
    let children = 0;
    for (const revisionId of revOrder.get(artifactId) ?? []) {
      const revision = revisions.get(revisionId);
      if (revision && revision.parent_revision_id === parentRevisionId) children += 1;
    }
    return parentRevisionId !== headId || children > 0;
  }

  /**
   * @param {unknown} body
   */
  async function acceptBody(body) {
    const normalized = normalizeBody(body);
    const encoded = canonicalJson(normalized);
    const size = new TextEncoder().encode(encoded).length;
    if (size > MAX_BODY_BYTES) {
      throw new LibrarySessionError("OVERSIZE_ENTRY", "body exceeds the local byte limit");
    }
    return { body: normalized, body_sha256: await sha256Hex(encoded) };
  }

  return {
    listProjects() {
      return projectOrder.map((id) => clone(projects.get(id)));
    },

    /**
     * @param {string} projectId
     */
    getProject(projectId) {
      const project = projects.get(projectId);
      if (!project) throw new LibrarySessionError("NOT_FOUND", "project not found");
      return clone(project);
    },

    /**
     * @param {string} name
     * @param {string} createdAt
     */
    createProject(name, createdAt) {
      if (typeof name !== "string" || !name.trim() || name.length > 200 || name.includes("\n")) {
        throw new LibrarySessionError("TYPE_REFUSED", "project name is empty or too long");
      }
      const stamp = requireTimestamp(createdAt);
      const project = {
        project_id: newId("prj"),
        name,
        created_at: stamp,
        visibility: /** @type {const} */ ("private"),
        noindex: /** @type {const} */ (true),
      };
      projects.set(project.project_id, project);
      projectOrder.push(project.project_id);
      return clone(project);
    },

    /**
     * @param {string} projectId
     */
    listArtifacts(projectId) {
      requireProject(projects, projectId);
      return artifactOrder
        .map((id) => artifacts.get(id))
        .filter((artifact) => artifact && artifact.project_id === projectId)
        .map((artifact) => clone(artifact));
    },

    /**
     * @param {string} projectId
     * @param {CreateArtifactInput} input
     */
    async createArtifact(projectId, input) {
      requireProject(projects, projectId);
      if (!ARTIFACT_TYPES.includes(input.artifactType)) {
        throw new LibrarySessionError(
          "UNKNOWN_ARTIFACT_TYPE",
          "artifact type is not in the library vocabulary",
        );
      }
      return writeRevision({
        projectId,
        artifactId: newId("art"),
        artifactType: input.artifactType,
        parentRevisionId: null,
        body: input.body,
        createdAt: input.createdAt,
        providerTarget: input.providerTarget ?? null,
        provenanceRefs: input.provenanceRefs ?? [],
        qualityEvidenceRefs: input.qualityEvidenceRefs ?? [],
        versionLabel: input.versionLabel ?? null,
      });
    },

    /**
     * @param {string} artifactId
     * @param {ReviseInput} input
     */
    async revise(artifactId, input) {
      const artifact = requireArtifact(artifacts, artifactId);
      const parentId = input.parentRevisionId ?? artifact.head_revision_id;
      const parent = requireRevision(revisions, parentId);
      if (parent.artifact_id !== artifactId) {
        throw new LibrarySessionError("NOT_FOUND", "parent revision is not on this artifact");
      }
      const target =
        input.providerTarget === undefined ? parent.provider_target : input.providerTarget;
      return writeRevision({
        projectId: artifact.project_id,
        artifactId,
        artifactType: artifact.artifact_type,
        parentRevisionId: parentId,
        body: input.body,
        createdAt: input.createdAt,
        providerTarget: target,
        provenanceRefs: input.provenanceRefs ?? [],
        qualityEvidenceRefs: input.qualityEvidenceRefs ?? [],
        versionLabel: input.versionLabel ?? null,
      });
    },

    /**
     * @param {string} fromRevisionId
     * @param {string} toRevisionId
     */
    diff(fromRevisionId, toRevisionId) {
      const before = requireRevision(revisions, fromRevisionId);
      const after = requireRevision(revisions, toRevisionId);
      if (before.artifact_id !== after.artifact_id) {
        throw new LibrarySessionError("NOT_FOUND", "revisions are not on the same artifact");
      }
      return {
        schema: "spe.project-library.diff.v1",
        from_revision_id: fromRevisionId,
        to_revision_id: toRevisionId,
        changes: diffBodies(before.body, after.body, ""),
      };
    },

    /**
     * @param {string} artifactId
     * @param {string} revisionId
     * @param {string} createdAt
     */
    rollback(artifactId, revisionId, createdAt) {
      const artifact = requireArtifact(artifacts, artifactId);
      const revision = requireRevision(revisions, revisionId);
      if (revision.artifact_id !== artifactId) {
        throw new LibrarySessionError("NOT_FOUND", "revision is not on this artifact");
      }
      const stamp = requireTimestamp(createdAt);
      if (artifact.head_revision_id !== revisionId) {
        history.push({
          kind: "HEAD_MOVE",
          project_id: artifact.project_id,
          artifact_id: artifactId,
          revision_id: revisionId,
          created_at: stamp,
          reason: "ROLLBACK",
        });
        artifact.head_revision_id = revisionId;
      }
      return clone(requireRevision(revisions, artifact.head_revision_id));
    },

    /**
     * @param {string} artifactId
     */
    head(artifactId) {
      const artifact = requireArtifact(artifacts, artifactId);
      return clone(requireRevision(revisions, artifact.head_revision_id));
    },

    /**
     * @param {string} revisionId
     */
    getRevision(revisionId) {
      return clone(requireRevision(revisions, revisionId));
    },

    /**
     * @param {string} artifactId
     */
    listVersions(artifactId) {
      requireArtifact(artifacts, artifactId);
      return (revOrder.get(artifactId) ?? []).map((revisionId) => {
        const revision = requireRevision(revisions, revisionId);
        return {
          revision_id: revision.revision_id,
          version_label: revision.version_label,
          parent_revision_id: revision.parent_revision_id,
          branched: revision.branched,
          created_at: revision.created_at,
        };
      });
    },

    /**
     * @param {string} revisionId
     */
    provenance(revisionId) {
      const revision = requireRevision(revisions, revisionId);
      return {
        revision_id: revision.revision_id,
        artifact_id: revision.artifact_id,
        provider_target: revision.provider_target,
        provenance_refs: [...revision.provenance_refs],
        quality_evidence_refs: [...revision.quality_evidence_refs],
        body_sha256: revision.body_sha256,
        created_at: revision.created_at,
        version_label: revision.version_label,
        branched: revision.branched,
        parent_revision_id: revision.parent_revision_id,
      };
    },

    /**
     * @param {string} projectId
     */
    exportProject(projectId) {
      const project = this.getProject(projectId);
      const projectArtifacts = this.listArtifacts(projectId);
      const projectHistory = history.filter((entry) => entry.project_id === projectId);
      const revisionRecords = projectHistory
        .filter((entry) => entry.kind === "REVISION")
        .map((entry) => publicRevision(/** @type {RevisionHistory} */ (entry)));
      return {
        schema: LIBRARY_SCHEMA,
        visibility: "private",
        noindex: true,
        indexing: "noindex",
        spe_contract: SPE_CONTRACT,
        project,
        artifacts: projectArtifacts,
        revisions: revisionRecords,
        history: projectHistory.map((entry) => clone(entry)),
      };
    },

    /**
     * @param {unknown} bundle
     */
    async importBundle(bundle) {
      const planned = await planImport(bundle);
      if (projects.has(planned.project.project_id)) {
        throw new LibrarySessionError("ID_COLLISION", "project already exists");
      }
      projects.set(planned.project.project_id, planned.project);
      projectOrder.push(planned.project.project_id);
      for (const artifact of planned.artifacts) {
        if (artifacts.has(artifact.artifact_id)) {
          throw new LibrarySessionError("ID_COLLISION", "artifact already exists");
        }
        artifacts.set(artifact.artifact_id, artifact);
        artifactOrder.push(artifact.artifact_id);
        revOrder.set(artifact.artifact_id, []);
      }
      for (const revision of planned.revisions) {
        if (revisions.has(revision.revision_id)) {
          throw new LibrarySessionError("ID_COLLISION", "revision already exists");
        }
        revisions.set(revision.revision_id, revision);
        const order = revOrder.get(revision.artifact_id);
        if (!order) throw new LibrarySessionError("CORRUPT_ENTRY", "revision has no artifact");
        order.push(revision.revision_id);
      }
      history.push(...planned.history);
      return clone(planned.project);
    },

    /**
     * @param {string} artifactId
     */
    exportSpe(artifactId) {
      const body = this.head(artifactId).body;
      return exportSpeDecision(body);
    },
  };

  /**
   * @param {WriteRevisionInput} input
   */
  async function writeRevision(input) {
    const parsed = await acceptBody(input.body);
    const label = normalizeLabel(input.versionLabel);
    refuseDuplicateLabel(revisions, revOrder, input.artifactId, label);
    const stamp = requireTimestamp(input.createdAt);
    const isBranched = branched(input.artifactId, input.parentRevisionId);
    /** @type {RevisionRecord} */
    const record = {
      revision_id: newId("rev"),
      artifact_id: input.artifactId,
      project_id: input.projectId,
      parent_revision_id: input.parentRevisionId,
      created_at: stamp,
      artifact_type: input.artifactType,
      provider_target: normalizeTarget(input.providerTarget),
      provenance_refs: normalizeRefs(input.provenanceRefs),
      quality_evidence_refs: normalizeRefs(input.qualityEvidenceRefs),
      body: parsed.body,
      body_sha256: parsed.body_sha256,
      version_label: label,
      branched: isBranched,
    };
    if (!artifacts.has(input.artifactId)) {
      if (input.parentRevisionId !== null) {
        throw new LibrarySessionError("CORRUPT_ENTRY", "first revision has a parent");
      }
      artifacts.set(input.artifactId, {
        artifact_id: input.artifactId,
        project_id: input.projectId,
        artifact_type: input.artifactType,
        head_revision_id: record.revision_id,
      });
      artifactOrder.push(input.artifactId);
      revOrder.set(input.artifactId, []);
    } else {
      const current = artifacts.get(input.artifactId);
      if (!current) throw new LibrarySessionError("NOT_FOUND", "artifact not found");
      current.head_revision_id = record.revision_id;
    }
    revisions.set(record.revision_id, record);
    revOrder.get(input.artifactId)?.push(record.revision_id);
    history.push({ kind: "REVISION", ...clone(record) });
    return clone(record);
  }
}

/**
 * @param {unknown} bundle
 */
async function planImport(bundle) {
  if (!isPlainObject(bundle)) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "bundle is not an object");
  }
  refuseIdentity(bundle);
  if (bundle.schema !== LIBRARY_SCHEMA) {
    throw new LibrarySessionError("UNKNOWN_SCHEMA", "bundle schema is not recognized");
  }
  if (bundle.visibility !== "private") {
    throw new LibrarySessionError("NOT_PRIVATE", "bundle is not private");
  }
  if (bundle.noindex !== true || bundle.indexing !== "noindex") {
    throw new LibrarySessionError("INDEXING_REFUSED", "bundle is not noindex");
  }
  if (bundle.spe_contract !== SPE_CONTRACT) {
    throw new LibrarySessionError("UNKNOWN_SCHEMA", "bundle spe contract is not recognized");
  }
  const projectRaw = bundle.project;
  const artifactRaw = bundle.artifacts;
  const revisionRaw = bundle.revisions;
  const historyRaw = bundle.history;
  if (!isPlainObject(projectRaw) || !Array.isArray(artifactRaw) || !Array.isArray(revisionRaw)) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "bundle is missing project history");
  }
  if (!Array.isArray(historyRaw)) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "bundle is missing project history");
  }
  refuseIdentity(projectRaw);
  const projectId = requireId(projectRaw.project_id, "prj");
  if (projectRaw.visibility !== "private" || projectRaw.noindex !== true) {
    throw new LibrarySessionError("NOT_PRIVATE", "project is not private");
  }
  const name = projectRaw.name;
  if (typeof name !== "string" || !name.trim() || name.length > 200 || name.includes("\n")) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "project name is missing");
  }
  /** @type {Map<string, string>} */
  const heads = new Map();
  /** @type {Map<string, string>} */
  const types = new Map();
  for (const artifact of artifactRaw) {
    if (!isPlainObject(artifact) || artifact.project_id !== projectId) {
      throw new LibrarySessionError("CORRUPT_ENTRY", "artifact is not in this project");
    }
    const artifactId = requireId(artifact.artifact_id, "art");
    if (heads.has(artifactId)) {
      throw new LibrarySessionError("CORRUPT_ENTRY", "artifact id repeated");
    }
    if (!ARTIFACT_TYPES.includes(/** @type {ArtifactType} */ (artifact.artifact_type))) {
      throw new LibrarySessionError(
        "UNKNOWN_ARTIFACT_TYPE",
        "artifact type is not in the library vocabulary",
      );
    }
    heads.set(artifactId, requireId(artifact.head_revision_id, "rev"));
    types.set(artifactId, String(artifact.artifact_type));
  }

  /** @type {Map<string, ArtifactRecord>} */
  const replayArtifacts = new Map();
  /** @type {Map<string, RevisionRecord>} */
  const replayRevisions = new Map();
  /** @type {Map<string, string[]>} */
  const replayOrder = new Map();
  /** @type {RevisionRecord[]} */
  const storedRevisions = [];
  /** @type {HistoryEntry[]} */
  const storedHistory = [];

  /**
   * @param {string} artifactId
   * @param {string | null} parentRevisionId
   */
  function replayBranched(artifactId, parentRevisionId) {
    if (parentRevisionId === null) return false;
    const artifact = replayArtifacts.get(artifactId);
    const headId = artifact ? artifact.head_revision_id : null;
    let children = 0;
    for (const revisionId of replayOrder.get(artifactId) ?? []) {
      const revision = replayRevisions.get(revisionId);
      if (revision && revision.parent_revision_id === parentRevisionId) children += 1;
    }
    return parentRevisionId !== headId || children > 0;
  }

  for (const raw of historyRaw) {
    if (!isPlainObject(raw)) {
      throw new LibrarySessionError("CORRUPT_ENTRY", "history entry is not an object");
    }
    refuseIdentity(raw);
    if (raw.kind === "REVISION") {
      assertKeys(raw, REVISION_KEYS, "revision has an unknown field");
      const revision = await checkedRevision(projectId, raw, types);
      if (!heads.has(revision.artifact_id)) {
        throw new LibrarySessionError("CORRUPT_ENTRY", "revision has no artifact");
      }
      if (revision.branched !== replayBranched(revision.artifact_id, revision.parent_revision_id)) {
        throw new LibrarySessionError("CORRUPT_ENTRY", "branch flag does not match history");
      }
      applyReplayRevision(replayArtifacts, replayRevisions, replayOrder, revision);
      storedRevisions.push(revision);
      storedHistory.push({ kind: "REVISION", ...clone(revision) });
    } else if (raw.kind === "HEAD_MOVE") {
      assertKeys(raw, HEAD_MOVE_KEYS, "head move has an unknown field");
      if (raw.project_id !== projectId) {
        throw new LibrarySessionError("CORRUPT_ENTRY", "head move is not in this project");
      }
      if (raw.reason !== "ROLLBACK") {
        throw new LibrarySessionError("CORRUPT_ENTRY", "head move reason is not recognized");
      }
      const artifactId = requireId(raw.artifact_id, "art");
      const revisionId = requireId(raw.revision_id, "rev");
      const artifact = replayArtifacts.get(artifactId);
      const revision = replayRevisions.get(revisionId);
      if (!artifact || !revision || revision.artifact_id !== artifactId) {
        throw new LibrarySessionError("CORRUPT_ENTRY", "head move target is missing");
      }
      requireTimestamp(raw.created_at);
      if (artifact.head_revision_id === revisionId) {
        throw new LibrarySessionError("CORRUPT_ENTRY", "head move does not change head");
      }
      artifact.head_revision_id = revisionId;
      storedHistory.push({
        kind: "HEAD_MOVE",
        project_id: projectId,
        artifact_id: artifactId,
        revision_id: revisionId,
        created_at: String(raw.created_at),
        reason: "ROLLBACK",
      });
    } else {
      throw new LibrarySessionError("CORRUPT_ENTRY", "history kind is not recognized");
    }
  }

  /** @type {RevisionRecord[]} */
  const fromRevisions = [];
  for (const raw of revisionRaw) {
    if (!isPlainObject(raw)) {
      throw new LibrarySessionError("CORRUPT_ENTRY", "revision is not an object");
    }
    refuseIdentity(raw);
    const allowed = new Set([...REVISION_KEYS].filter((key) => key !== "kind"));
    assertKeys(raw, allowed, "revision has an unknown field");
    fromRevisions.push(await checkedRevision(projectId, raw, types));
  }
  if (canonicalJson(fromRevisions) !== canonicalJson(storedRevisions)) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "history does not match revisions");
  }
  for (const [artifactId, headId] of heads) {
    const current = replayArtifacts.get(artifactId);
    if (!current || current.head_revision_id !== headId) {
      throw new LibrarySessionError("CORRUPT_ENTRY", "head revision does not match history");
    }
    if (current.artifact_type !== types.get(artifactId)) {
      throw new LibrarySessionError("CORRUPT_ENTRY", "artifact type does not match");
    }
  }
  return {
    project: {
      project_id: projectId,
      name,
      created_at: requireTimestamp(projectRaw.created_at),
      visibility: /** @type {const} */ ("private"),
      noindex: /** @type {const} */ (true),
    },
    artifacts: [...replayArtifacts.values()].map((artifact) => clone(artifact)),
    revisions: storedRevisions,
    history: storedHistory,
  };
}

/**
 * @param {Map<string, ArtifactRecord>} replayArtifacts
 * @param {Map<string, RevisionRecord>} replayRevisions
 * @param {Map<string, string[]>} replayOrder
 * @param {RevisionRecord} revision
 */
function applyReplayRevision(replayArtifacts, replayRevisions, replayOrder, revision) {
  if (replayRevisions.has(revision.revision_id)) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "revision id repeated");
  }
  const parentId = revision.parent_revision_id;
  if (parentId !== null && !replayRevisions.has(parentId)) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "parent revision is missing");
  }
  if (!replayArtifacts.has(revision.artifact_id)) {
    if (parentId !== null) {
      throw new LibrarySessionError("CORRUPT_ENTRY", "first revision has a parent");
    }
    replayArtifacts.set(revision.artifact_id, {
      artifact_id: revision.artifact_id,
      project_id: revision.project_id,
      artifact_type: revision.artifact_type,
      head_revision_id: revision.revision_id,
    });
    replayOrder.set(revision.artifact_id, []);
  } else {
    if (parentId === null) {
      throw new LibrarySessionError("CORRUPT_ENTRY", "artifact has two roots");
    }
    const parent = replayRevisions.get(parentId);
    if (!parent || parent.artifact_id !== revision.artifact_id) {
      throw new LibrarySessionError("CORRUPT_ENTRY", "parent revision is not on this artifact");
    }
    const current = replayArtifacts.get(revision.artifact_id);
    if (!current) throw new LibrarySessionError("CORRUPT_ENTRY", "artifact is not in this project");
    if (current.artifact_type !== revision.artifact_type || current.project_id !== revision.project_id) {
      throw new LibrarySessionError("CORRUPT_ENTRY", "artifact identity changed");
    }
    current.head_revision_id = revision.revision_id;
  }
  const label = revision.version_label;
  if (label !== null) {
    for (const existingId of replayOrder.get(revision.artifact_id) ?? []) {
      if (replayRevisions.get(existingId)?.version_label === label) {
        throw new LibrarySessionError("CORRUPT_ENTRY", "version label repeated");
      }
    }
  }
  replayRevisions.set(revision.revision_id, revision);
  replayOrder.get(revision.artifact_id)?.push(revision.revision_id);
}

/**
 * @param {string} projectId
 * @param {Record<string, unknown>} raw
 * @param {Map<string, string>} types
 * @returns {Promise<RevisionRecord>}
 */
async function checkedRevision(projectId, raw, types) {
  const artifactId = requireId(raw.artifact_id, "art");
  if (raw.project_id !== projectId) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "revision is not in this project");
  }
  const artifactType = raw.artifact_type;
  if (artifactType !== types.get(artifactId)) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "artifact type does not match");
  }
  const parent = raw.parent_revision_id;
  const parentId = parent === null ? null : requireId(parent, "rev");
  const body = normalizeBody(raw.body);
  const encoded = canonicalJson(body);
  const size = new TextEncoder().encode(encoded).length;
  if (size > MAX_BODY_BYTES) {
    throw new LibrarySessionError("OVERSIZE_ENTRY", "stored body exceeds the local byte limit");
  }
  const digest = raw.body_sha256;
  if (typeof digest !== "string" || digest !== (await sha256Hex(encoded))) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "body digest does not match");
  }
  if (raw.branched !== true && raw.branched !== false) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "branch flag is missing");
  }
  return {
    revision_id: requireId(raw.revision_id, "rev"),
    artifact_id: artifactId,
    project_id: projectId,
    parent_revision_id: parentId,
    created_at: requireTimestamp(raw.created_at),
    artifact_type: /** @type {ArtifactType} */ (artifactType),
    provider_target: normalizeTarget(raw.provider_target),
    provenance_refs: normalizeRefs(raw.provenance_refs),
    quality_evidence_refs: normalizeRefs(raw.quality_evidence_refs),
    body,
    body_sha256: digest,
    version_label: normalizeLabel(raw.version_label),
    branched: raw.branched,
  };
}

/**
 * @param {unknown} body
 * @returns {boolean}
 */
function isVerifiedSpeBody(body) {
  if (!isPlainObject(body)) return false;
  if (body.spe_format !== "spe.artifact.v1" && body.spe_format !== "spe.artifact.v2") return false;
  if (!isPlainObject(body.integrity)) return false;
  return body.integrity.state === "VERIFIED";
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function normalizeBody(value) {
  if (value === null || value === undefined) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "body is missing");
  }
  let encoded;
  try {
    encoded = canonicalJson(value);
  } catch (error) {
    if (error instanceof LibrarySessionError) throw error;
    throw new LibrarySessionError("CORRUPT_ENTRY", "body is not JSON");
  }
  const parsed = JSON.parse(encoded);
  if (
    isPlainObject(parsed) ||
    Array.isArray(parsed) ||
    typeof parsed === "string" ||
    typeof parsed === "number" ||
    typeof parsed === "boolean"
  ) {
    return parsed;
  }
  throw new LibrarySessionError("CORRUPT_ENTRY", "body is not JSON");
}

/**
 * @param {unknown} values
 * @returns {string[]}
 */
function normalizeRefs(values) {
  if (values === undefined || values === null) return [];
  if (typeof values === "string" || !Array.isArray(values)) {
    throw new LibrarySessionError("TYPE_REFUSED", "refs must be a list of reference strings");
  }
  if (values.length > 32) throw new LibrarySessionError("OVERSIZE_ENTRY", "too many refs");
  return values.map((item) => {
    if (typeof item !== "string" || !REF.test(item) || item.length > 128) {
      throw new LibrarySessionError("TYPE_REFUSED", "ref must be a short reference token");
    }
    return item;
  });
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeTarget(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !TARGET.test(value)) {
    throw new LibrarySessionError("TYPE_REFUSED", "provider target is not a token");
  }
  return value;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeLabel(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !LABEL.test(value)) {
    throw new LibrarySessionError("TYPE_REFUSED", "version label is not a token");
  }
  return value;
}

/**
 * @param {Map<string, RevisionRecord>} revisionMap
 * @param {Map<string, string[]>} orderMap
 * @param {string} artifactId
 * @param {string | null} label
 */
function refuseDuplicateLabel(revisionMap, orderMap, artifactId, label) {
  if (label === null) return;
  for (const revisionId of orderMap.get(artifactId) ?? []) {
    if (revisionMap.get(revisionId)?.version_label === label) {
      throw new LibrarySessionError("DUPLICATE_VERSION", "version label already exists");
    }
  }
}

/**
 * @param {Record<string, unknown>} mapping
 */
function refuseIdentity(mapping) {
  for (const key of Object.keys(mapping)) {
    if (IDENTITY_KEYS.has(key.toLowerCase())) {
      throw new LibrarySessionError("ACCOUNT_FORBIDDEN", "identity fields are not accepted");
    }
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function requireTimestamp(value) {
  if (typeof value !== "string" || !TIMESTAMP.test(value)) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "timestamp is not ISO-8601");
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {"prj" | "art" | "rev"} kind
 */
function requireId(value, kind) {
  if (typeof value !== "string" || !IDS[kind].test(value)) {
    throw new LibrarySessionError("CORRUPT_ENTRY", "identifier is not a library id");
  }
  return value;
}

/**
 * @param {Record<string, unknown>} record
 * @param {Set<string>} allowed
 * @param {string} reason
 */
function assertKeys(record, allowed, reason) {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new LibrarySessionError("CORRUPT_ENTRY", reason);
  }
}

/**
 * @param {Map<string, ProjectRecord>} projectMap
 * @param {string} projectId
 */
function requireProject(projectMap, projectId) {
  const project = projectMap.get(projectId);
  if (!project) throw new LibrarySessionError("NOT_FOUND", "project not found");
  return project;
}

/**
 * @param {Map<string, ArtifactRecord>} artifactMap
 * @param {string} artifactId
 */
function requireArtifact(artifactMap, artifactId) {
  const artifact = artifactMap.get(artifactId);
  if (!artifact) throw new LibrarySessionError("NOT_FOUND", "artifact not found");
  return artifact;
}

/**
 * @param {Map<string, RevisionRecord>} revisionMap
 * @param {string} revisionId
 */
function requireRevision(revisionMap, revisionId) {
  const revision = revisionMap.get(revisionId);
  if (!revision) throw new LibrarySessionError("NOT_FOUND", "revision not found");
  return revision;
}

/**
 * @param {RevisionHistory} entry
 * @returns {RevisionRecord}
 */
function publicRevision(entry) {
  return {
    revision_id: entry.revision_id,
    artifact_id: entry.artifact_id,
    project_id: entry.project_id,
    parent_revision_id: entry.parent_revision_id,
    created_at: entry.created_at,
    artifact_type: entry.artifact_type,
    provider_target: entry.provider_target,
    provenance_refs: [...entry.provenance_refs],
    quality_evidence_refs: [...entry.quality_evidence_refs],
    body: clone(entry.body),
    body_sha256: entry.body_sha256,
    version_label: entry.version_label,
    branched: entry.branched,
  };
}

/**
 * @param {string} prefix
 */
function newId(prefix) {
  const hex = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${hex}`;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} left
 * @param {unknown} right
 */
function sameJson(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => sameJson(item, right[index]));
  }
  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) return false;
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(
      (key) => Object.prototype.hasOwnProperty.call(right, key) && sameJson(left[key], right[key]),
    );
  }
  return false;
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return structuredClone(value);
}

/**
 * @typedef {"prompt" | "transcript" | "website" | "code" | "research_pack" | "template"} ArtifactType
 */

/**
 * @typedef {{
 *   project_id: string,
 *   name: string,
 *   created_at: string,
 *   visibility: "private",
 *   noindex: true,
 * }} ProjectRecord
 */

/**
 * @typedef {{
 *   artifact_id: string,
 *   project_id: string,
 *   artifact_type: ArtifactType,
 *   head_revision_id: string,
 * }} ArtifactRecord
 */

/**
 * @typedef {{
 *   revision_id: string,
 *   artifact_id: string,
 *   project_id: string,
 *   parent_revision_id: string | null,
 *   created_at: string,
 *   artifact_type: ArtifactType,
 *   provider_target: string | null,
 *   provenance_refs: string[],
 *   quality_evidence_refs: string[],
 *   body: unknown,
 *   body_sha256: string,
 *   version_label: string | null,
 *   branched: boolean,
 * }} RevisionRecord
 */

/**
 * @typedef {RevisionRecord & { kind: "REVISION" }} RevisionHistory
 */

/**
 * @typedef {{
 *   kind: "HEAD_MOVE",
 *   project_id: string,
 *   artifact_id: string,
 *   revision_id: string,
 *   created_at: string,
 *   reason: "ROLLBACK",
 * }} HeadMove
 */

/**
 * @typedef {RevisionHistory | HeadMove} HistoryEntry
 */

/**
 * @typedef {{
 *   artifactType: ArtifactType,
 *   body: unknown,
 *   createdAt: string,
 *   providerTarget?: string | null,
 *   provenanceRefs?: string[],
 *   qualityEvidenceRefs?: string[],
 *   versionLabel?: string | null,
 * }} CreateArtifactInput
 */

/**
 * @typedef {{
 *   body: unknown,
 *   createdAt: string,
 *   parentRevisionId?: string | null,
 *   providerTarget?: string | null,
 *   provenanceRefs?: string[],
 *   qualityEvidenceRefs?: string[],
 *   versionLabel?: string | null,
 * }} ReviseInput
 */

/**
 * @typedef {{
 *   projectId: string,
 *   artifactId: string,
 *   artifactType: ArtifactType,
 *   parentRevisionId: string | null,
 *   body: unknown,
 *   createdAt: string,
 *   providerTarget: string | null,
 *   provenanceRefs: string[],
 *   qualityEvidenceRefs: string[],
 *   versionLabel: string | null,
 * }} WriteRevisionInput
 */

/**
 * @typedef {ReturnType<typeof createProjectLibrarySession>} ProjectLibrarySession
 */
