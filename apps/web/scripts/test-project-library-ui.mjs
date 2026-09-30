#!/usr/bin/env node
/** Project library UX session: contract shapes, privacy, and Python import round-trip. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SPE_CONTRACT,
  canonicalJson,
  createProjectLibrarySession,
  diffBodies,
  exportSpeDecision,
  sha256Hex,
} from "../src/library/projectLibrarySession.mjs";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "../..");
const T0 = "2026-09-30T00:00:00Z";
const T1 = "2026-09-30T00:00:01Z";
const T2 = "2026-09-30T00:00:02Z";
const T3 = "2026-09-30T00:00:03Z";
const T4 = "2026-09-30T00:00:04Z";

const sessionSource = readFileSync(join(webRoot, "src/library/projectLibrarySession.mjs"), "utf8");
const pageSource = readFileSync(join(webRoot, "src/pages/ProjectLibrary.tsx"), "utf8");
const robots = readFileSync(join(webRoot, "public/robots.txt"), "utf8");
const sitemap = readFileSync(join(webRoot, "public/sitemap.xml"), "utf8");
const routing = readFileSync(join(webRoot, "src/routing.ts"), "utf8");
const seo = readFileSync(join(webRoot, "src/ui/SeoHead.tsx"), "utf8");

assert.equal(SPE_CONTRACT, "NOT_YET_BOUND");
assert.match(robots, /Disallow:\s*\/library/);
assert.doesNotMatch(sitemap, /\/library/);
assert.match(routing, /library:\s*"\/library"/);
assert.match(seo, /view === "library"/);
assert.match(seo, /noindex, nofollow/);
assert.match(pageSource, /data-noindex="true"/);
assert.match(pageSource, /data-spe-contract=\{SPE_CONTRACT\}/);
assert.doesNotMatch(pageSource, /type="email"/);
assert.doesNotMatch(pageSource, /fetch\(|WebSocket|sendBeacon|gtag|telemetry/i);
assert.doesNotMatch(sessionSource, /from ["']node:fs["']|from ["']fs["']|fetch\(|WebSocket|sendBeacon/);
assert.match(sessionSource, /does not read or write the library JSONL/);

const encoded = canonicalJson({ title: "A", drop: 1, keep: true, note: "café" });
const digest = await sha256Hex(encoded);
const pyHash = spawnSync(
  "python3",
  [
    "-c",
    "import hashlib,json,sys; body=json.loads(sys.argv[1]); enc=json.dumps(body, sort_keys=True, ensure_ascii=False, separators=(',', ':')); print(enc); print(hashlib.sha256(enc.encode()).hexdigest())",
    encoded,
  ],
  { cwd: repoRoot, encoding: "utf8" },
);
assert.equal(pyHash.status, 0, pyHash.stderr);
const [pyEncoded, pyDigest] = pyHash.stdout.trim().split("\n");
assert.equal(pyEncoded, encoded);
assert.equal(pyDigest, digest);

const pyDiff = spawnSync(
  "python3",
  [
    "-c",
    `
import json, tempfile
from pathlib import Path
from spe_runtime.storage.project_library import ProjectLibrary
root = Path(tempfile.mkdtemp())
lib = ProjectLibrary(root / "library.jsonl")
project = lib.create_project("Studio", created_at="2026-09-30T00:00:00Z")
first = lib.create_artifact(project["project_id"], artifact_type="research_pack", body={"title":"A","drop":1,"keep":True}, created_at="2026-09-30T00:00:01Z")
second = lib.revise(first["artifact_id"], body={"title":"B","keep":True,"note":"added"}, created_at="2026-09-30T00:00:02Z")
print(json.dumps(lib.diff(first["revision_id"], second["revision_id"])["changes"]))
`,
  ],
  { cwd: repoRoot, encoding: "utf8" },
);
assert.equal(pyDiff.status, 0, pyDiff.stderr);
const pythonChanges = JSON.parse(pyDiff.stdout.trim());
const localChanges = diffBodies(
  { title: "A", drop: 1, keep: true },
  { title: "B", keep: true, note: "added" },
);
assert.deepEqual(localChanges, pythonChanges);

const session = createProjectLibrarySession();
const project = session.createProject("Studio", T0);
assert.equal(project.visibility, "private");
assert.equal(project.noindex, true);
assert.match(project.project_id, /^prj_[0-9a-f]{32}$/);
assert.equal(session.listProjects().length, 1);

const first = await session.createArtifact(project.project_id, {
  artifactType: "research_pack",
  body: { title: "A", drop: 1, keep: true },
  createdAt: T1,
  provenanceRefs: ["prov:local"],
  qualityEvidenceRefs: ["evidence:qr-1"],
  providerTarget: "local",
  versionLabel: "v1",
});
const second = await session.revise(first.artifact_id, {
  body: { title: "B", keep: true, note: "added" },
  createdAt: T2,
  provenanceRefs: ["prov:edit"],
  qualityEvidenceRefs: ["evidence:qr-2"],
  versionLabel: "v2",
});
assert.equal(second.parent_revision_id, first.revision_id);
assert.equal(second.branched, false);
assert.equal(session.head(first.artifact_id).revision_id, second.revision_id);
const diff = session.diff(first.revision_id, second.revision_id);
assert.equal(diff.schema, "spe.project-library.diff.v1");
assert.deepEqual(
  Object.fromEntries(diff.changes.map((change) => [change.path, change.op])),
  { title: "replace", drop: "remove", note: "add" },
);

const branch = await session.revise(first.artifact_id, {
  body: { title: "side" },
  createdAt: T4,
  parentRevisionId: first.revision_id,
  versionLabel: "v1.side",
  provenanceRefs: ["prov:branch"],
});
assert.equal(branch.branched, true);
assert.equal(session.head(first.artifact_id).revision_id, branch.revision_id);
const rolled = session.rollback(first.artifact_id, first.revision_id, T3);
assert.equal(rolled.revision_id, first.revision_id);
assert.equal(session.head(first.artifact_id).body.title, "A");
assert.equal(session.getRevision(second.revision_id).body.title, "B");
const provenance = session.provenance(second.revision_id);
assert.deepEqual(provenance.provenance_refs, ["prov:edit"]);
assert.deepEqual(provenance.quality_evidence_refs, ["evidence:qr-2"]);

const bundle = session.exportProject(project.project_id);
assert.equal(bundle.spe_contract, "NOT_YET_BOUND");
assert.equal(bundle.visibility, "private");
assert.equal(bundle.noindex, true);
assert.equal(bundle.indexing, "noindex");
assert.equal(bundle.history.some((entry) => entry.kind === "HEAD_MOVE"), true);
assert.equal(session.exportSpe(first.artifact_id).code, "NOT_YET_BOUND");
assert.equal(exportSpeDecision({ text: "plain" }).code, "NOT_YET_BOUND");

const verified = await session.createArtifact(project.project_id, {
  artifactType: "prompt",
  body: {
    spe_format: "spe.artifact.v1",
    integrity: { state: "VERIFIED", algorithm: "SHA-256", content_sha256: "abc" },
  },
  createdAt: T2,
});
const decision = session.exportSpe(verified.artifact_id);
assert.equal(decision.code, "VERIFIED_HEAD");
assert.equal(decision.bundleContract, "NOT_YET_BOUND");
assert.equal(session.exportProject(project.project_id).spe_contract, "NOT_YET_BOUND");
assert.equal("text" in decision, false);

const schemaCheck = spawnSync(
  "python3",
  [
    "-c",
    `
import json, sys, jsonschema
from pathlib import Path
bundle = json.load(sys.stdin)
schema = json.loads(Path("schemas/project_library.schema.json").read_text())
jsonschema.validate(bundle, schema)
from spe_runtime.storage.project_library import ProjectLibrary
import tempfile
lib = ProjectLibrary(Path(tempfile.mkdtemp()) / "imported.jsonl")
project = lib.import_bundle(bundle)
exported = lib.export_project(project["project_id"])
assert exported["spe_contract"] == "NOT_YET_BOUND"
assert exported["noindex"] is True
assert exported["indexing"] == "noindex"
head_ids = {item["artifact_id"]: item["head_revision_id"] for item in exported["artifacts"]}
assert head_ids
print("IMPORTED")
`,
  ],
  { cwd: repoRoot, encoding: "utf8", input: JSON.stringify(bundle) },
);
assert.equal(schemaCheck.status, 0, schemaCheck.stderr || schemaCheck.stdout);
assert.match(schemaCheck.stdout, /IMPORTED/);

const refused = spawnSync(
  "python3",
  [
    "-c",
    `
import json, sys
from spe_runtime.storage.project_library import LibraryError, ProjectLibrary
import tempfile
from pathlib import Path
bundle = json.load(sys.stdin)
bundle["project"] = dict(bundle["project"])
bundle["project"]["email"] = "person@example.com"
lib = ProjectLibrary(Path(tempfile.mkdtemp()) / "no.jsonl")
try:
    lib.import_bundle(bundle)
except LibraryError as exc:
    assert exc.code == "ACCOUNT_FORBIDDEN"
    print(exc.code)
else:
    raise SystemExit("identity was accepted")
`,
  ],
  {
    cwd: repoRoot,
    encoding: "utf8",
    input: JSON.stringify(session.exportProject(project.project_id)),
  },
);
assert.equal(refused.status, 0, refused.stderr);
assert.match(refused.stdout, /ACCOUNT_FORBIDDEN/);

await assert.rejects(
  () =>
    session.importBundle({
      ...bundle,
      project: { ...bundle.project, email: "person@example.com" },
    }),
  (error) => error.code === "ACCOUNT_FORBIDDEN",
);
await assert.rejects(
  () => session.importBundle({ ...bundle, spe_contract: "BOUND" }),
  (error) => error.code === "UNKNOWN_SCHEMA",
);

console.log("PASS project library UI session");
