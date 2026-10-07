#!/usr/bin/env node
/**
 * SPE qualification custody: freeze a candidate, then bind verifier receipts
 * to it from OUTSIDE the candidate worktree.
 *
 * Design law: CANDIDATE != VERIFIER RECEIPT.
 * - The candidate is identified by commit SHA + git tree SHA + a SHA-256 tree
 *   digest + lockfile digests + harness digest, all read from the committed
 *   tree (never from loose worktree files).
 * - A receipt names that identity as its subject. It is written to a
 *   directory outside every worktree of the repository and is never committed
 *   into the candidate. Committing it would change the subject it names.
 * - Validation compares a receipt with a frozen identity file. It never reads
 *   HEAD to decide what the subject "should" be, so a receipt cannot silently
 *   rebind to a newer commit.
 * - This module records and checks custody only. It never adjudicates
 *   qualification: every receipt carries qualification_verdict=NOT_ADJUDICATED.
 *
 * This is repository qualification tooling, not a product evidence store.
 * Product claim/evidence ledgers (apps/web/src/authority/evidenceRegistry.ts,
 * continuation oracleGuards) are not touched or duplicated.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CANDIDATE_SCHEMA = "spe.frozen-candidate/1";
export const RECEIPT_SCHEMA = "spe.verifier-receipt/1";
export const RECEIPT_DIR_ENV = "SPE_VERIFIER_RECEIPT_DIR";
export const FROZEN_CANDIDATE_ENV = "SPE_FROZEN_CANDIDATE";
const LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Cargo.lock",
  "uv.lock",
  "poetry.lock",
]);

export class CustodyError extends Error {
  constructor(code, detail) {
    super(`${code}${detail ? `: ${detail}` : ""}`);
    this.code = code;
  }
}

function git(repoRoot, args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: options.encoding === null ? null : "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

/** Deterministic JSON: object keys sorted recursively. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digestOf(value) {
  return `sha256:${sha256Hex(canonicalJson(value))}`;
}

export function repoToplevel(dir) {
  return realpathSync(git(dir, ["rev-parse", "--show-toplevel"]).trim());
}

/** Tracked or untracked-but-not-ignored changes. Ignored build output is not candidate source. */
export function worktreeStatus(repoRoot) {
  return git(repoRoot, ["status", "--porcelain=v1", "--untracked-files=all"]).trim();
}

function committedBlob(repoRoot, commit, relPath) {
  return git(repoRoot, ["cat-file", "blob", `${commit}:${relPath}`], { encoding: null });
}

/**
 * Freeze the checked-out candidate. Fails closed (CANDIDATE_DIRTY) when the
 * worktree has uncommitted or untracked source: such a state has no commit
 * that names it.
 */
export function freezeCandidate({ repoRoot, harnessFiles = [], repo } = {}) {
  if (!repoRoot) throw new CustodyError("MISSING_REPO_ROOT");
  const top = repoToplevel(repoRoot);
  const dirty = worktreeStatus(top);
  if (dirty) throw new CustodyError("CANDIDATE_DIRTY", dirty.split("\n").slice(0, 10).join("; "));
  const commit = git(top, ["rev-parse", "HEAD"]).trim();
  const treeSha = git(top, ["rev-parse", `${commit}^{tree}`]).trim();
  const listing = git(top, ["ls-tree", "-r", "-z", "--full-tree", commit], { encoding: null });
  const files = git(top, ["ls-tree", "-r", "-z", "--name-only", "--full-tree", commit])
    .split("\0")
    .filter(Boolean);
  const lockfileDigests = {};
  for (const file of files) {
    if (LOCKFILE_NAMES.has(path.posix.basename(file))) {
      lockfileDigests[file] = `sha256:${sha256Hex(committedBlob(top, commit, file))}`;
    }
  }
  const harness = {};
  for (const file of [...new Set(harnessFiles)].sort()) {
    if (!files.includes(file)) throw new CustodyError("HARNESS_FILE_NOT_COMMITTED", file);
    harness[file] = `sha256:${sha256Hex(committedBlob(top, commit, file))}`;
  }
  const identity = {
    schema: CANDIDATE_SCHEMA,
    repo: repo ?? null,
    commit_sha: commit,
    tree_sha: treeSha,
    tree_digest: `sha256:${sha256Hex(listing)}`,
    lockfile_digests: lockfileDigests,
    harness_files: harness,
    harness_digest: Object.keys(harness).length ? digestOf(harness) : null,
  };
  return { ...identity, identity_digest: digestOf(identity) };
}

function identityCore(identity) {
  const { identity_digest: _digest, frozen_at: _frozenAt, ...core } = identity;
  return core;
}

export function identityDigestValid(identity) {
  return Boolean(identity?.identity_digest) && identity.identity_digest === digestOf(identityCore(identity));
}

/**
 * Re-observe the checkout and fail closed if it no longer IS the frozen
 * candidate (new commit, amended commit, dirty files, harness drift).
 */
export function assertCandidateUnchanged(repoRoot, identity) {
  if (!identity?.commit_sha || !identity?.tree_digest) {
    throw new CustodyError("MISSING_SUBJECT_IDENTITY");
  }
  let observed;
  try {
    observed = freezeCandidate({
      repoRoot,
      harnessFiles: Object.keys(identity.harness_files ?? {}),
      repo: identity.repo,
    });
  } catch (error) {
    if (error instanceof CustodyError && error.code === "CANDIDATE_DIRTY") {
      throw new CustodyError("CANDIDATE_DRIFT", `worktree changed: ${error.message}`);
    }
    throw error;
  }
  if (observed.commit_sha !== identity.commit_sha) {
    throw new CustodyError("CANDIDATE_DRIFT", `HEAD ${observed.commit_sha} != frozen ${identity.commit_sha}`);
  }
  if (observed.tree_digest !== identity.tree_digest || observed.tree_sha !== identity.tree_sha) {
    throw new CustodyError("TREE_DIGEST_MISMATCH");
  }
  if (observed.harness_digest !== identity.harness_digest) {
    throw new CustodyError("HARNESS_DIGEST_MISMATCH");
  }
  return observed;
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function realpathOrParent(target) {
  let current = path.resolve(target);
  const suffix = [];
  while (!existsSync(current)) {
    suffix.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.join(realpathSync(current), ...suffix);
}

/** Every worktree path and the shared git dir of the candidate repository. */
export function protectedRepositoryPaths(repoRoot) {
  const top = repoToplevel(repoRoot);
  const paths = new Set([top]);
  const list = git(top, ["worktree", "list", "--porcelain"]);
  for (const line of list.split("\n")) {
    if (line.startsWith("worktree ")) {
      const wt = line.slice("worktree ".length).trim();
      if (existsSync(wt)) paths.add(realpathSync(wt));
    }
  }
  const common = git(top, ["rev-parse", "--git-common-dir"]).trim();
  const commonAbs = path.isAbsolute(common) ? common : path.join(top, common);
  if (existsSync(commonAbs)) paths.add(realpathSync(commonAbs));
  return [...paths];
}

/**
 * Receipts must live outside the candidate. Required explicitly via CLI
 * argument or SPE_VERIFIER_RECEIPT_DIR; there is no in-tree default.
 */
export function resolveExternalReceiptDir({ cliValue, envValue, candidateRoot }) {
  const chosen = cliValue || envValue;
  if (!chosen) {
    throw new CustodyError(
      "RECEIPT_DIR_REQUIRED",
      `pass --receipt-dir <dir> or set ${RECEIPT_DIR_ENV} to a directory outside the candidate worktree`,
    );
  }
  const resolved = realpathOrParent(chosen);
  for (const protectedPath of protectedRepositoryPaths(candidateRoot)) {
    if (isInside(resolved, protectedPath)) {
      throw new CustodyError("RECEIPT_DIR_INSIDE_CANDIDATE", `${resolved} is inside ${protectedPath}`);
    }
  }
  mkdirSync(resolved, { recursive: true });
  return realpathSync(resolved);
}

/** Write once. An existing file with different bytes is a custody failure. */
function writeOnce(file, text) {
  if (existsSync(file)) {
    if (readFileSync(file, "utf8") === text) return file;
    throw new CustodyError("RECEIPT_IMMUTABLE", `${file} already exists with different content`);
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text, { flag: "wx" });
  return file;
}

export function writeFrozenCandidate(receiptDir, identity) {
  if (!identityDigestValid(identity)) throw new CustodyError("IDENTITY_DIGEST_INVALID");
  return writeOnce(
    path.join(receiptDir, identity.commit_sha, "candidate.json"),
    `${JSON.stringify(identity, null, 2)}\n`,
  );
}

export function loadFrozenCandidate(file) {
  const identity = JSON.parse(readFileSync(file, "utf8"));
  if (identity.schema !== CANDIDATE_SCHEMA) throw new CustodyError("CANDIDATE_SCHEMA_INVALID");
  if (!identityDigestValid(identity)) throw new CustodyError("IDENTITY_DIGEST_INVALID");
  return identity;
}

export function fileArtifactDigest(file, label) {
  return { label: label ?? path.basename(file), sha256: sha256Hex(readFileSync(file)) };
}

/**
 * Bind a verifier run to the frozen identity. The subject is copied from the
 * identity object only; it is never re-read from HEAD.
 */
export function createVerifierReceipt(identity, run) {
  if (!identity?.commit_sha || !identity?.tree_sha || !identity?.tree_digest) {
    throw new CustodyError("MISSING_SUBJECT_IDENTITY");
  }
  if (!identityDigestValid(identity)) throw new CustodyError("IDENTITY_DIGEST_INVALID");
  if (!run?.verifier?.id || !run?.verifier?.type) throw new CustodyError("MISSING_VERIFIER_IDENTITY");
  if (!run.command) throw new CustodyError("MISSING_COMMAND");
  if (!Number.isInteger(run.exitCode)) throw new CustodyError("MISSING_EXIT_CODE");
  const body = {
    schema: RECEIPT_SCHEMA,
    subject: {
      repo: identity.repo,
      commit_sha: identity.commit_sha,
      tree_sha: identity.tree_sha,
      tree_digest: identity.tree_digest,
      lockfile_digests: identity.lockfile_digests,
      harness_digest: identity.harness_digest,
      identity_digest: identity.identity_digest,
    },
    verifier: { id: run.verifier.id, type: run.verifier.type },
    harness_digest: identity.harness_digest,
    environment: run.environment ?? {},
    command: run.command,
    exit_code: run.exitCode,
    results: run.results ?? {},
    artifact_digests: run.artifacts ?? [],
    started_at: run.startedAt ?? null,
    finished_at: run.finishedAt ?? new Date().toISOString(),
    qualification_verdict: "NOT_ADJUDICATED",
  };
  return { ...body, receipt_digest: digestOf(body) };
}

export function writeVerifierReceipt(receiptDir, receipt, name) {
  const safe = String(name || `${receipt.verifier.type}-${receipt.finished_at}`).replace(/[^A-Za-z0-9._-]/g, "_");
  return writeOnce(
    path.join(receiptDir, receipt.subject.commit_sha, "receipts", `${safe}.json`),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
}

/**
 * BOUND means the receipt names exactly this frozen candidate and is intact.
 * It is a custody result, not a qualification verdict. Missing identity is
 * HOLD; any disagreement is INVALID. There is no PASS state here.
 */
export function validateReceiptBinding(receipt, identity) {
  const reasons = [];
  if (!identity?.commit_sha || !identity?.tree_digest) {
    return { state: "HOLD", reasons: ["MISSING_FROZEN_CANDIDATE"] };
  }
  const subject = receipt?.subject;
  if (!subject?.commit_sha || !subject?.tree_digest || !subject?.tree_sha) {
    return { state: "HOLD", reasons: ["MISSING_SUBJECT_IDENTITY"] };
  }
  if (!identityDigestValid(identity)) reasons.push("IDENTITY_DIGEST_INVALID");
  if (receipt.schema !== RECEIPT_SCHEMA) reasons.push("RECEIPT_SCHEMA_INVALID");
  const { receipt_digest: claimed, ...body } = receipt;
  if (claimed !== digestOf(body)) reasons.push("RECEIPT_TAMPERED");
  if (subject.commit_sha !== identity.commit_sha) reasons.push("SUBJECT_COMMIT_MISMATCH");
  if (subject.tree_sha !== identity.tree_sha) reasons.push("TREE_SHA_MISMATCH");
  if (subject.tree_digest !== identity.tree_digest) reasons.push("TREE_DIGEST_MISMATCH");
  if (subject.identity_digest !== identity.identity_digest) reasons.push("IDENTITY_DIGEST_MISMATCH");
  if (canonicalJson(subject.lockfile_digests ?? {}) !== canonicalJson(identity.lockfile_digests ?? {})) {
    reasons.push("LOCKFILE_DIGEST_MISMATCH");
  }
  if (receipt.harness_digest !== identity.harness_digest) reasons.push("HARNESS_DIGEST_MISMATCH");
  if (receipt.qualification_verdict !== "NOT_ADJUDICATED") reasons.push("RECEIPT_SELF_ADJUDICATED");
  return { state: reasons.length ? "INVALID" : "BOUND", reasons };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { _: [], harness: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--harness") args.harness.push(argv[++i]);
    else if (arg.startsWith("--")) args[arg.slice(2)] = argv[++i];
    else args._.push(arg);
  }
  return args;
}

function cli(argv) {
  const args = parseArgs(argv);
  const command = args._[0];
  if (command === "freeze") {
    const repoRoot = repoToplevel(args.repo || process.cwd());
    const receiptDir = resolveExternalReceiptDir({
      cliValue: args["receipt-dir"],
      envValue: process.env[RECEIPT_DIR_ENV],
      candidateRoot: repoRoot,
    });
    const identity = freezeCandidate({ repoRoot, harnessFiles: args.harness, repo: args["repo-name"] ?? null });
    const file = writeFrozenCandidate(receiptDir, identity);
    console.log(JSON.stringify({ frozen: file, commit_sha: identity.commit_sha, tree_digest: identity.tree_digest }, null, 2));
    return 0;
  }
  if (command === "verify") {
    const identity = loadFrozenCandidate(args.candidate);
    const receipt = JSON.parse(readFileSync(args.receipt, "utf8"));
    const result = validateReceiptBinding(receipt, identity);
    console.log(JSON.stringify(result, null, 2));
    return result.state === "BOUND" ? 0 : 3;
  }
  if (command === "check") {
    const identity = loadFrozenCandidate(args.candidate);
    assertCandidateUnchanged(repoToplevel(args.repo || process.cwd()), identity);
    console.log(JSON.stringify({ unchanged: true, commit_sha: identity.commit_sha }, null, 2));
    return 0;
  }
  console.error(
    "usage: candidate-custody.mjs freeze --receipt-dir DIR [--repo PATH] [--harness FILE ...]\n" +
      "       candidate-custody.mjs check --candidate candidate.json [--repo PATH]\n" +
      "       candidate-custody.mjs verify --candidate candidate.json --receipt receipt.json",
  );
  return 64;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  try {
    process.exitCode = cli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof CustodyError ? error.message : error);
    process.exitCode = 2;
  }
}
