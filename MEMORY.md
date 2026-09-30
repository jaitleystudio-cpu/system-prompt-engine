# Memory

## Map

- `tests/security/sec1_oracle.py` — updated 2026-09-30 — SEC1 pass/fail oracle for CSP, SBOM honesty, untrusted input, and zero-egress
- `tests/security/sec1_runtime.mjs` — updated 2026-09-30 — local URL and service-worker probe with fetch and sockets blocked
- `tests/security/sec1_register.mjs` — updated 2026-09-30 — TypeScript loader registration and socket block for the probe
- `tests/security/sec1_ts_loader.mjs` — updated 2026-09-30 — resolves extensionless TypeScript imports for the probe
- `tests/security/test_security_sec1.py` — updated 2026-09-30 — SEC1-01 through SEC1-20 mutation harness
- `proofs/security_r1_20260930/mutant_ledger.json` — updated 2026-09-30 — killed, survived, and donor-defect ledger

## Log

### 2026-09-30 — Security R1 qualification hold
- Why: Independent check of the Lane F security donor. Seventeen mutants die. Three donor behaviors already fail closed-checks, so the qualification holds.
- Files: `tests/security/sec1_oracle.py` (created), `tests/security/sec1_runtime.mjs` (created), `tests/security/sec1_register.mjs` (created), `tests/security/sec1_ts_loader.mjs` (created), `tests/security/test_security_sec1.py` (created), `proofs/security_r1_20260930/mutant_ledger.json` (created)
- Left: donor defects SEC1-14, SEC1-16, and SEC1-18 remain; this lane does not patch them
