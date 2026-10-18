#!/usr/bin/env node
/**
 * R5 CI isolation checks in a non-root, read-only, no-egress container.
 * Not a production isolation attestation; untrusted code must not receive
 * Docker controls, host mounts, process secrets, or image-build authority.
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";

assert.ok(typeof process.getuid === "function" && process.getuid() !== 0,
  "Rootless browser executor required");
const proc = await readFile("/proc/self/status", "utf8");
assert.match(proc, /^NoNewPrivs:\s+1\s*$/m);
assert.match(proc, /^CapEff:\s+0+\s*$/m);
const net = networkInterfaces();
const nonLoopback = Object.entries(net)
  .filter(([, interfaces]) => interfaces?.some(x => !x.internal));
assert.deepEqual(nonLoopback, [], "No egress-capable interfaces permitted");
assert.equal(process.env.SPE_ALLOW_MODEL_EXECUTION, undefined);
assert.equal(process.env.SPE_MODEL_COMMAND_JSON, undefined);
assert.equal(process.env.GITHUB_TOKEN, undefined);
assert.equal(process.env.OPENAI_API_KEY, undefined);

let denied = false;
try {
  await writeFile("/opt/spe/apps/web/spe-escape-probe", "ATTACK");
} catch (e) {
  denied = ["EROFS", "EACCES", "EPERM"].includes(e?.code);
}
assert.equal(denied, true, "The application installation must not be writable");

const mounts = await readFile("/proc/mounts", "utf8");
const rootMount = mounts.split("\n").map(x => x.split(" "))
  .find(x => x[1] === "/");
assert.ok(rootMount && rootMount[3].split(",").includes("ro"),
  "Root filesystem must be mounted read-only");

const mem = (await readFile("/sys/fs/cgroup/memory.max", "utf8").catch(() => "")).trim();
if (mem) assert.ok(/^\d+$/.test(mem) && Number(mem) <= 1024 * 1024 * 1024,
  "Container memory must be bounded to <=1GiB");
const pids = (await readFile("/sys/fs/cgroup/pids.max", "utf8").catch(() => "")).trim();
if (pids) assert.ok(/^\d+$/.test(pids) && Number(pids) <= 256,
  "Container PID count must be bounded to <=256");

console.log("PASS R5: non-root uid, no-new-privileges, zero effective capabilities");
console.log("PASS R5: no nonloopback interface, no secrets, read-only root filesystem");
console.log("PASS R5: bounded memory/pids when available under cgroup v2");
console.log("PROOF_SCOPE: CONTAINER_FIXTURE_ONLY_NOT_PRODUCTION_SANDBOX");
