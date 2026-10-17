import { ReleaseSafetyGovernor } from "../src/engine/evolution/releaseSafetyGovernor.ts";

const nonce = process.argv[2];
const gov = new ReleaseSafetyGovernor();
try {
  const result = gov.consumeNonceAtomic(nonce, "PROP-RACE-01", "founder_release_authority");
  process.stdout.write(JSON.stringify({ pid: process.pid, ...result }) + "\n");
} catch (err) {
  process.stdout.write(JSON.stringify({ pid: process.pid, allowed: false, error: err.message }) + "\n");
}
