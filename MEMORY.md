# Memory

## Map

- `apps/web/src/media/urlIngest.ts` — updated 2026-09-30 — refuses path traversal before fetch and fails closed when connect-src is missing
- `spe_runtime/grounding/firewall.py` — updated 2026-09-30 — strips untrusted authority fields so they never become grants
- `tests/security/sec1_oracle.py` — updated 2026-09-30 — SEC1 pass/fail oracle for CSP, SBOM honesty, untrusted input, and zero-egress
- `tests/security/sec1_runtime.mjs` — updated 2026-09-30 — local URL and service-worker probe with fetch and sockets blocked
- `tests/security/sec1_register.mjs` — updated 2026-09-30 — TypeScript loader registration and socket block for the probe
- `tests/security/sec1_ts_loader.mjs` — updated 2026-09-30 — resolves extensionless TypeScript imports for the probe
- `tests/security/test_security_sec1.py` — updated 2026-09-30 — SEC1-01 through SEC1-20 mutation harness
- `tests/security/test_sec1_repairs.py` — created 2026-09-30 — repair oracles for traversal, authority fields, and connect-src
- `proofs/security_r1_20260930/mutant_ledger.json` — updated 2026-09-30 — SEC1-01 through SEC1-20 killed after the three repairs

## Log

### 2026-09-30 — Security R1 qualification hold
- Why: Independent check of the Lane F security donor. Seventeen mutants die. Three donor behaviors already fail closed-checks, so the qualification holds.
- Files: `tests/security/sec1_oracle.py` (created), `tests/security/sec1_runtime.mjs` (created), `tests/security/sec1_register.mjs` (created), `tests/security/sec1_ts_loader.mjs` (created), `tests/security/test_security_sec1.py` (created), `proofs/security_r1_20260930/mutant_ledger.json` (created)
- Left: donor defects SEC1-14, SEC1-16, and SEC1-18 remain; this lane does not patch them

### 2026-09-30 — Security R1 donor repair
- Why: Same-origin dot-dot URLs were fetched, external authority booleans stayed effective, and a missing connect-src was treated as allow.
- Files: `apps/web/src/media/urlIngest.ts` (updated), `spe_runtime/grounding/firewall.py` (updated), `tests/security/sec1_oracle.py` (updated), `tests/security/sec1_runtime.mjs` (updated), `tests/security/test_security_sec1.py` (updated), `tests/security/test_sec1_repairs.py` (created), `proofs/security_r1_20260930/mutant_ledger.json` (updated)
- Left: none
