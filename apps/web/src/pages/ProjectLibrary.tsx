import { useMemo, useRef, useState } from "react";
import {
  ARTIFACT_TYPES,
  LibrarySessionError,
  SPE_CONTRACT,
  createProjectLibrarySession,
} from "../library/projectLibrarySession.mjs";
import "../library/library.css";

type ProjectLibrarySession = ReturnType<typeof createProjectLibrarySession>;

type ArtifactType = (typeof ARTIFACT_TYPES)[number];

type ProjectRow = {
  project_id: string;
  name: string;
  created_at: string;
  visibility: "private";
  noindex: true;
};

type ArtifactRow = {
  artifact_id: string;
  project_id: string;
  artifact_type: ArtifactType;
  head_revision_id: string;
};

type VersionRow = {
  revision_id: string;
  version_label: string | null;
  parent_revision_id: string | null;
  branched: boolean;
  created_at: string;
};

type ProvenanceRow = {
  revision_id: string;
  provider_target: string | null;
  provenance_refs: string[];
  quality_evidence_refs: string[];
  body_sha256: string;
  created_at: string;
  version_label: string | null;
  branched: boolean;
  parent_revision_id: string | null;
};

type HistoryRow =
  | {
      kind: "REVISION";
      revision_id: string;
      created_at: string;
      version_label: string | null;
      branched: boolean;
      artifact_id: string;
    }
  | {
      kind: "HEAD_MOVE";
      revision_id: string;
      created_at: string;
      artifact_id: string;
      reason: "ROLLBACK";
    };

type DiffChange = {
  op: string;
  path: string;
  before: unknown;
  after: unknown;
};

type SpeExport = {
  bundleContract: typeof SPE_CONTRACT;
  code: "NOT_YET_BOUND" | "VERIFIED_HEAD";
  reason: string;
};

const sessionApi = createProjectLibrarySession as () => ProjectLibrarySession;

function stamp(): string {
  return new Date().toISOString();
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new LibrarySessionError("CORRUPT_ENTRY", "body is not JSON");
  }
}

function parseRefs(text: string): string[] {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function errorText(error: unknown): string {
  if (error instanceof LibrarySessionError) return `${error.code}: ${error.reason}`;
  return "The library session refused that action.";
}

function downloadBundle(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ProjectLibraryPage() {
  const sessionRef = useRef<ProjectLibrarySession | null>(null);
  if (sessionRef.current === null) sessionRef.current = sessionApi();
  const session = sessionRef.current;

  const [generation, setGeneration] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [diffFrom, setDiffFrom] = useState("");
  const [diffTo, setDiffTo] = useState("");
  const [projectName, setProjectName] = useState("");
  const [artifactType, setArtifactType] = useState<ArtifactType>("prompt");
  const [bodyText, setBodyText] = useState('{"text":""}');
  const [provenanceText, setProvenanceText] = useState("prov:local");
  const [evidenceText, setEvidenceText] = useState("");
  const [providerTarget, setProviderTarget] = useState("local");
  const [versionLabel, setVersionLabel] = useState("");
  const [status, setStatus] = useState("");
  const [speExport, setSpeExport] = useState<SpeExport | null>(null);

  const refresh = () => setGeneration((value) => value + 1);

  const projects = useMemo(() => session.listProjects() as ProjectRow[], [session, generation]);
  const artifacts = useMemo(
    () => (projectId ? (session.listArtifacts(projectId) as ArtifactRow[]) : []),
    [session, projectId, generation],
  );
  const versions = useMemo(
    () => (artifactId ? (session.listVersions(artifactId) as VersionRow[]) : []),
    [session, artifactId, generation],
  );
  const provenance = useMemo(() => {
    if (!revisionId) return null;
    try {
      return session.provenance(revisionId) as ProvenanceRow;
    } catch {
      return null;
    }
  }, [session, revisionId, generation]);
  const history = useMemo(() => {
    if (!projectId) return [];
    const bundle = session.exportProject(projectId) as { history: HistoryRow[] };
    return bundle.history;
  }, [session, projectId, generation]);
  const diff = useMemo(() => {
    if (!diffFrom || !diffTo) return null;
    try {
      return session.diff(diffFrom, diffTo) as {
        schema: string;
        from_revision_id: string;
        to_revision_id: string;
        changes: DiffChange[];
      };
    } catch (error) {
      return { error: errorText(error) };
    }
  }, [session, diffFrom, diffTo, generation]);

  const selectProject = (id: string) => {
    setProjectId(id);
    setArtifactId(null);
    setRevisionId(null);
    setDiffFrom("");
    setDiffTo("");
    setSpeExport(null);
  };

  const selectArtifact = (id: string) => {
    setArtifactId(id);
    const head = session.head(id) as { revision_id: string };
    setRevisionId(head.revision_id);
    setDiffFrom("");
    setDiffTo("");
    setSpeExport(null);
  };

  const onCreateProject = () => {
    try {
      const project = session.createProject(projectName, stamp()) as ProjectRow;
      setProjectName("");
      selectProject(project.project_id);
      setStatus("Project saved in this private session.");
      refresh();
    } catch (error) {
      setStatus(errorText(error));
    }
  };

  const onCreateArtifact = async () => {
    if (!projectId) return;
    try {
      const revision = (await session.createArtifact(projectId, {
        artifactType,
        body: parseBody(bodyText),
        createdAt: stamp(),
        providerTarget: providerTarget.trim() ? providerTarget.trim() : null,
        provenanceRefs: parseRefs(provenanceText),
        qualityEvidenceRefs: parseRefs(evidenceText),
        versionLabel: versionLabel.trim() ? versionLabel.trim() : null,
      })) as { artifact_id: string; revision_id: string };
      setArtifactId(revision.artifact_id);
      setRevisionId(revision.revision_id);
      setVersionLabel("");
      setSpeExport(null);
      setStatus("Artifact revision stored in this session.");
      refresh();
    } catch (error) {
      setStatus(errorText(error));
    }
  };

  const onRevise = async () => {
    if (!artifactId) return;
    try {
      const revision = (await session.revise(artifactId, {
        body: parseBody(bodyText),
        createdAt: stamp(),
        provenanceRefs: parseRefs(provenanceText),
        qualityEvidenceRefs: parseRefs(evidenceText),
        providerTarget: providerTarget.trim() ? providerTarget.trim() : null,
        versionLabel: versionLabel.trim() ? versionLabel.trim() : null,
      })) as { revision_id: string };
      setRevisionId(revision.revision_id);
      setVersionLabel("");
      setSpeExport(null);
      setStatus("New revision stored. Earlier revisions stay in history.");
      refresh();
    } catch (error) {
      setStatus(errorText(error));
    }
  };

  const onRollback = (targetRevisionId: string) => {
    if (!artifactId) return;
    try {
      const head = session.rollback(artifactId, targetRevisionId, stamp()) as {
        revision_id: string;
      };
      setRevisionId(head.revision_id);
      setSpeExport(null);
      setStatus("Head now points at the selected revision. Later revisions remain.");
      refresh();
    } catch (error) {
      setStatus(errorText(error));
    }
  };

  const onExportProject = () => {
    if (!projectId) return;
    const bundle = session.exportProject(projectId) as { spe_contract: string; project: { project_id: string } };
    if (bundle.spe_contract !== SPE_CONTRACT) {
      setStatus("NOT_YET_BOUND: export contract was refused.");
      return;
    }
    downloadBundle(`project-${bundle.project.project_id}.json`, bundle);
    setStatus("Project bundle downloaded. spe_contract is NOT_YET_BOUND. Nothing was uploaded.");
  };

  const onExportSpe = () => {
    if (!artifactId) return;
    const decision = session.exportSpe(artifactId) as SpeExport;
    setSpeExport(decision);
    setStatus(
      decision.code === "NOT_YET_BOUND"
        ? "NOT_YET_BOUND: this head is not a verified SPE artifact, so no .spe file was written."
        : "Head body is already marked VERIFIED. The library bundle stays NOT_YET_BOUND. This page does not re-serialize .spe text.",
    );
  };

  const onImport = async (file: File) => {
    try {
      const parsed = parseBody(await file.text());
      const project = (await session.importBundle(parsed)) as ProjectRow;
      selectProject(project.project_id);
      setStatus("Bundle imported into this private session. The library journal was not opened.");
      refresh();
    } catch (error) {
      setStatus(errorText(error));
    }
  };

  return (
    <section className="spe-library" aria-labelledby="library-title" data-noindex="true" data-spe-contract={SPE_CONTRACT}>
      <p className="spe-kicker">Project library</p>
      <h1 id="library-title">Projects on this device</h1>
      <div className="spe-library-banner">
        <p className="spe-library-contract" data-contract={SPE_CONTRACT}>
          spe_contract {SPE_CONTRACT}
        </p>
        <p>
          Private and noindex. No account and no email. This page does not upload a project, and it does not open the library journal. It keeps a session copy of the export bundle until you download one.
        </p>
        <p className="spe-library-note">
          A library bundle is not a .spe document. Canonical .spe text stays with the local library, and only when a revision body is already a verified SPE artifact.
        </p>
      </div>

      <div className="spe-library-layout">
        <div className="spe-library-panel">
          <h2>Projects</h2>
          <label className="spe-field">
            <span>Project name</span>
            <input
              type="text"
              value={projectName}
              maxLength={200}
              onChange={(event) => setProjectName(event.target.value)}
            />
          </label>
          <div className="spe-actions">
            <button type="button" className="spe-build" data-ready={projectName.trim() ? "true" : "false"} onClick={onCreateProject}>
              Create project
            </button>
          </div>
          {projects.length === 0 ? (
            <p role="status">No projects in this session yet.</p>
          ) : (
            <ul className="spe-library-list">
              {projects.map((project) => (
                <li key={project.project_id}>
                  <button
                    type="button"
                    className={project.project_id === projectId ? "spe-ghost is-active" : "spe-ghost"}
                    onClick={() => selectProject(project.project_id)}
                  >
                    {project.name}
                    <span> private · noindex</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="spe-field">
            <span>Open a project bundle</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onImport(file);
                event.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="spe-library-panel">
          <h2>Artifacts</h2>
          {!projectId ? (
            <p>Select a project to see its artifacts.</p>
          ) : (
            <>
              <ul className="spe-library-list">
                {artifacts.length === 0 ? <li>No artifacts yet.</li> : null}
                {artifacts.map((artifact) => (
                  <li key={artifact.artifact_id}>
                    <button
                      type="button"
                      className={artifact.artifact_id === artifactId ? "spe-ghost is-active" : "spe-ghost"}
                      onClick={() => selectArtifact(artifact.artifact_id)}
                    >
                      {artifact.artifact_type}
                      <span> {artifact.artifact_id.slice(0, 12)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <label className="spe-field">
                <span>Artifact type</span>
                <select
                  value={artifactType}
                  onChange={(event) => setArtifactType(event.target.value as ArtifactType)}
                >
                  {ARTIFACT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="spe-field">
                <span>Revision body (JSON)</span>
                <textarea value={bodyText} rows={6} onChange={(event) => setBodyText(event.target.value)} />
              </label>
              <label className="spe-field">
                <span>Provenance refs</span>
                <input
                  type="text"
                  value={provenanceText}
                  onChange={(event) => setProvenanceText(event.target.value)}
                />
              </label>
              <label className="spe-field">
                <span>Quality evidence refs</span>
                <input type="text" value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} />
              </label>
              <label className="spe-field">
                <span>Provider target</span>
                <input
                  type="text"
                  value={providerTarget}
                  onChange={(event) => setProviderTarget(event.target.value)}
                />
              </label>
              <label className="spe-field">
                <span>Version label</span>
                <input type="text" value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} />
              </label>
              <div className="spe-actions">
                <button type="button" className="spe-build" data-ready="true" onClick={() => void onCreateArtifact()}>
                  Add artifact
                </button>
                <button type="button" className="spe-ghost" disabled={!artifactId} onClick={() => void onRevise()}>
                  Revise head
                </button>
                <button type="button" className="spe-ghost" disabled={!projectId} onClick={onExportProject}>
                  Export bundle
                </button>
                <button type="button" className="spe-ghost" disabled={!artifactId} onClick={onExportSpe}>
                  Export .spe
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {artifactId && (
        <div className="spe-library-history">
          <h2>Revision history</h2>
          <ol>
            {versions.map((version) => (
              <li key={version.revision_id}>
                <button type="button" className="spe-ghost" onClick={() => setRevisionId(version.revision_id)}>
                  <code>{version.revision_id.slice(0, 16)}</code>
                </button>
                <span>
                  {" "}
                  {version.version_label ?? "unlabeled"}
                  {version.branched ? " · branch" : ""}
                  {" · "}
                  {version.created_at}
                </span>
                <button type="button" className="spe-ghost" onClick={() => onRollback(version.revision_id)}>
                  Roll back head
                </button>
              </li>
            ))}
          </ol>
          <h3>Provenance</h3>
          {provenance ? (
            <dl className="spe-library-meta">
              <div>
                <dt>Provider target</dt>
                <dd>{provenance.provider_target ?? "none"}</dd>
              </div>
              <div>
                <dt>Provenance refs</dt>
                <dd>{provenance.provenance_refs.join(", ") || "none"}</dd>
              </div>
              <div>
                <dt>Quality evidence</dt>
                <dd>{provenance.quality_evidence_refs.join(", ") || "none"}</dd>
              </div>
              <div>
                <dt>Body sha256</dt>
                <dd>
                  <code>{provenance.body_sha256}</code>
                </dd>
              </div>
              <div>
                <dt>Parent</dt>
                <dd>{provenance.parent_revision_id ?? "root"}</dd>
              </div>
            </dl>
          ) : (
            <p>Select a revision to see provenance.</p>
          )}
        </div>
      )}

      {projectId && (
        <div className="spe-library-history">
          <h2>Bundle history</h2>
          <ol>
            {history.map((entry, index) => (
              <li key={`${entry.kind}-${entry.revision_id}-${index}`}>
                {entry.kind === "HEAD_MOVE"
                  ? `Rollback to ${entry.revision_id.slice(0, 16)} at ${entry.created_at}`
                  : `Revision ${entry.revision_id.slice(0, 16)}${entry.branched ? " (branch)" : ""}`}
              </li>
            ))}
          </ol>
        </div>
      )}

      {artifactId && versions.length > 1 && (
        <div className="spe-library-diff">
          <h2>Diff</h2>
          <label className="spe-field">
            <span>From revision</span>
            <select value={diffFrom} onChange={(event) => setDiffFrom(event.target.value)}>
              <option value="">Choose</option>
              {versions.map((version) => (
                <option key={version.revision_id} value={version.revision_id}>
                  {version.revision_id.slice(0, 16)}
                </option>
              ))}
            </select>
          </label>
          <label className="spe-field">
            <span>To revision</span>
            <select value={diffTo} onChange={(event) => setDiffTo(event.target.value)}>
              <option value="">Choose</option>
              {versions.map((version) => (
                <option key={version.revision_id} value={version.revision_id}>
                  {version.revision_id.slice(0, 16)}
                </option>
              ))}
            </select>
          </label>
          {diff && "error" in diff ? <p role="alert">{diff.error}</p> : null}
          {diff && "changes" in diff ? (
            <ul>
              {diff.changes.length === 0 ? <li>No changes.</li> : null}
              {diff.changes.map((change) => (
                <li key={`${change.op}-${change.path}`}>
                  <code>
                    {change.op} {change.path}
                  </code>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {speExport && (
        <p className="spe-status-line" role="status" data-spe-export={speExport.code}>
          {speExport.bundleContract}: {speExport.reason}
        </p>
      )}
      {status && (
        <p className="spe-status-line" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
