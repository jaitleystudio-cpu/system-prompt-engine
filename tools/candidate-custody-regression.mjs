#!/usr/bin/env node
/**
 * Regression for tools/candidate-custody.mjs (frozen candidate + external
 * verifier receipt binding). Uses a throwaway git repository under the OS
 * temp dir; the SPE checkout is only read, never written.
 * Custody mechanism only. This does not qualify any candidate.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const custodyPath = path.join(here, "candidate-custody.mjs");
const custody = await import(process.env.SPE_CUSTODY_MODULE_PATH || custodyPath);
const {
  freezeCandidate,
  assertCandidateUnchanged,
  resolveExternalReceiptDir,
  writeFrozenCandidate,
  loadFrozenCandidate,
  createVerifierReceipt,
  writeVerifierReceipt,
  validateReceiptBinding,
  worktreeStatus,
} = custody;

const sandbox = mkdtempSync(path.join(os.tmpdir(), "spe-custody-"));
const repo = path.join(sandbox, "candidate");
const external = path.join(sandbox, "receipts");
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

try {
  mkdirSync(path.join(repo, "apps/web/scripts"), { recursive: true });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "custody@example.invalid");
  git("config", "user.name", "custody-test");
  writeFileSync(path.join(repo, "apps/web/package-lock.json"), '{"lockfileVersion":3}\n');
  writeFileSync(path.join(repo, "apps/web/scripts/harness.mjs"), "export const harness = 1;\n");
  writeFileSync(path.join(repo, "src.txt"), "candidate v1\n");
  writeFileSync(path.join(repo, ".gitignore"), "node_modules/\n");
  git("add", "-A");
  git("commit", "-q", "-m", "candidate");
  const harnessFiles = ["apps/web/scripts/harness.mjs"];

  const identity = freezeCandidate({ repoRoot: repo, harnessFiles, repo: "example/candidate" });
  const frozenSha = git("rev-parse", "HEAD");

  check("freeze records commit, tree, tree digest, lockfile and harness digests", () => {
    assert.equal(identity.commit_sha, frozenSha);
    assert.equal(identity.tree_sha, git("rev-parse", "HEAD^{tree}"));
    assert.match(identity.tree_digest, /^sha256:[0-9a-f]{64}$/);
    assert.ok(identity.lockfile_digests["apps/web/package-lock.json"]);
    assert.match(identity.harness_digest, /^sha256:[0-9a-f]{64}$/);
    assert.match(identity.identity_digest, /^sha256:[0-9a-f]{64}$/);
  });

  check("receipt dir is required and may not sit inside the candidate", () => {
    assert.throws(() => resolveExternalReceiptDir({ candidateRoot: repo }), /RECEIPT_DIR_REQUIRED/);
    assert.throws(
      () => resolveExternalReceiptDir({ cliValue: path.join(repo, "evidence/out"), candidateRoot: repo }),
      /RECEIPT_DIR_INSIDE_CANDIDATE/,
    );
    assert.throws(
      () => resolveExternalReceiptDir({ cliValue: path.join(repo, ".git/receipts"), candidateRoot: repo }),
      /RECEIPT_DIR_INSIDE_CANDIDATE/,
    );
  });

  const receiptDir = resolveExternalReceiptDir({ envValue: external, candidateRoot: repo });
  const candidateFile = writeFrozenCandidate(receiptDir, identity);
  const statusBefore = worktreeStatus(repo);

  // A stand-in qualification run: does work, then writes a receipt externally.
  const run = {
    verifier: { id: "custody-regression", type: "TEST_FIXTURE" },
    environment: { node: process.version, platform: process.platform },
    command: "node harness.mjs",
    exitCode: 0,
    results: { frames: { state: "MEASURED_FIXTURE" } },
    artifacts: [{ label: "log", sha256: "0".repeat(64) }],
    startedAt: new Date().toISOString(),
  };
  assertCandidateUnchanged(repo, identity);
  const receipt = createVerifierReceipt(loadFrozenCandidate(candidateFile), run);
  const receiptFile = writeVerifierReceipt(receiptDir, receipt, "fixture-run");

  check("1. candidate SHA unchanged after qualification", () => {
    assert.equal(git("rev-parse", "HEAD"), frozenSha);
    assert.doesNotThrow(() => assertCandidateUnchanged(repo, identity));
  });

  check("2. receipt subject SHA equals frozen candidate", () => {
    const stored = JSON.parse(readFileSync(receiptFile, "utf8"));
    assert.equal(stored.subject.commit_sha, identity.commit_sha);
    assert.equal(stored.subject.tree_digest, identity.tree_digest);
    assert.equal(stored.qualification_verdict, "NOT_ADJUDICATED");
    assert.deepEqual(validateReceiptBinding(stored, identity), { state: "BOUND", reasons: [] });
  });

  check("3. tree digest mismatch fails closed", () => {
    const forged = structuredClone(receipt);
    forged.subject.tree_digest = `sha256:${"1".repeat(64)}`;
    const result = validateReceiptBinding(forged, identity);
    assert.equal(result.state, "INVALID");
    assert.ok(result.reasons.includes("TREE_DIGEST_MISMATCH"));
    assert.ok(result.reasons.includes("RECEIPT_TAMPERED"));
    const forgedIdentity = { ...identity, tree_digest: `sha256:${"2".repeat(64)}` };
    assert.throws(() => assertCandidateUnchanged(repo, forgedIdentity), /TREE_DIGEST_MISMATCH/);
  });

  check("4. receipt cannot silently rebind to HEAD", () => {
    writeFileSync(path.join(repo, "src.txt"), "candidate v2\n");
    assert.throws(() => assertCandidateUnchanged(repo, identity), /CANDIDATE_DRIFT/);
    git("commit", "-q", "-am", "post-freeze change");
    assert.throws(() => assertCandidateUnchanged(repo, identity), /CANDIDATE_DRIFT/);
    const headIdentity = freezeCandidate({ repoRoot: repo, harnessFiles, repo: "example/candidate" });
    const result = validateReceiptBinding(receipt, headIdentity);
    assert.equal(result.state, "INVALID");
    assert.ok(result.reasons.includes("SUBJECT_COMMIT_MISMATCH"));
    // Editing the subject SHA string to the new HEAD is detected as tampering.
    const chased = structuredClone(receipt);
    chased.subject.commit_sha = headIdentity.commit_sha;
    const chasedResult = validateReceiptBinding(chased, headIdentity);
    assert.equal(chasedResult.state, "INVALID");
    assert.ok(chasedResult.reasons.includes("RECEIPT_TAMPERED"));
    // A second write to the same receipt path with different bytes is refused.
    assert.throws(
      () => writeVerifierReceipt(receiptDir, { ...receipt, exit_code: 1 }, "fixture-run"),
      /RECEIPT_IMMUTABLE/,
    );
    git("reset", "-q", "--hard", frozenSha);
  });

  check("5. missing subject identity is HOLD / invalid", () => {
    const missing = structuredClone(receipt);
    delete missing.subject.commit_sha;
    assert.deepEqual(validateReceiptBinding(missing, identity), {
      state: "HOLD",
      reasons: ["MISSING_SUBJECT_IDENTITY"],
    });
    assert.equal(validateReceiptBinding(receipt, undefined).state, "HOLD");
    assert.throws(() => createVerifierReceipt({}, run), /MISSING_SUBJECT_IDENTITY/);
    assert.throws(
      () => createVerifierReceipt({ ...identity, commit_sha: "f".repeat(40) }, run),
      /IDENTITY_DIGEST_INVALID/,
    );
    const selfPromoted = structuredClone(receipt);
    selfPromoted.qualification_verdict = "PASS";
    assert.equal(validateReceiptBinding(selfPromoted, identity).state, "INVALID");
  });

  check("6. generated receipt does not modify candidate worktree", () => {
    assert.equal(worktreeStatus(repo), statusBefore);
    assert.equal(worktreeStatus(repo), "");
    assert.equal(git("rev-parse", "HEAD"), frozenSha);
    assert.deepEqual(readdirSync(repo).sort(), [".git", ".gitignore", "apps", "src.txt"]);
    assert.ok(!receiptFile.startsWith(repo));
  });

  check("dirty candidate cannot be frozen", () => {
    writeFileSync(path.join(repo, "untracked.txt"), "x\n");
    assert.throws(() => freezeCandidate({ repoRoot: repo, harnessFiles }), /CANDIDATE_DIRTY/);
    rmSync(path.join(repo, "untracked.txt"));
  });

  check("CLI freeze/verify binds externally and exits non-zero on mismatch", () => {
    const cliDir = path.join(sandbox, "cli-receipts");
    const frozen = spawnSync(
      process.execPath,
      [
        custodyPath,
        "freeze",
        "--repo",
        repo,
        "--repo-name",
        "example/candidate",
        "--receipt-dir",
        cliDir,
        "--harness",
        harnessFiles[0],
      ],
      { encoding: "utf8" },
    );
    assert.equal(frozen.status, 0, frozen.stderr);
    const cliCandidate = JSON.parse(frozen.stdout).frozen;
    const ok = spawnSync(process.execPath, [custodyPath, "verify", "--candidate", cliCandidate, "--receipt", receiptFile], {
      encoding: "utf8",
    });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const inside = spawnSync(
      process.execPath,
      [custodyPath, "freeze", "--repo", repo, "--receipt-dir", path.join(repo, "out")],
      { encoding: "utf8" },
    );
    assert.equal(inside.status, 2);
    assert.match(inside.stderr, /RECEIPT_DIR_INSIDE_CANDIDATE/);
    assert.equal(worktreeStatus(repo), "");
  });

  console.log(`\nTESTED_LOCALLY: candidate custody regression ${passed} checks (mechanism only; no qualification verdict).`);
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
