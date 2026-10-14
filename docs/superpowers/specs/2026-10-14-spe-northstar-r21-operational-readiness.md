# SPE Ω North Star R21 — Read-Only Operator Release-Readiness Audit

**Scope:** Candidate-only local preflight, NO live network, deployment, paid-provider requests, public publishing, G6-H or private prompt access.
Stack base: R20 PR #175, prior R19 #173 and R11/R12/R18 custody.

## Why this exists
A GitHub workflow with two environment toggles is not a durable live
monitoring platform. Before activating public incident observation, an
operator needs a machine-readable report of each missing prerequisite.
The R11 state file alone does not independently authenticate the journal;
the R18 metadata checkpoint interface needs a separate owner trust root,
a monotonic floor and a valid signature. Those prerequisites were not
integrated into an operational inspection command.

## Implemented in existing owners
- `spe_runtime/failure_genome/operational_readiness.py` accepts only the
  actual approved SourceAuthority, validated R11 journal, owner grant flags,
  monotonic floor and owner-signed checkpoint receipt; reuses R18's
  `verify_owner_checkpoint` for signature, age, prefix ancestry and digest.
- `tools/spe_northstar_preflight.py` inspects local host-provided files and
  prints non-sensitive reason-coded JSON without making any network call.
- Input files must be absolute, private-mode, regular, single-link and
  non-symlinked, with restrictive immediate parent directory. Same-path
  aliasing among state, keys, receipt and floor is refused.
- Source ID is from the R19 exact allowlist (Claude/OpenAI), never a
  provider-controlled URL or CLI-supplied arbitrary host.
- Owner source grant, persistent-host operator attestation, trust roots
  and signed receipt are distinct gates. Absent items are HOLD.
- Under success, the only permitted result is
  `LOCAL_CUSTODY_CHECKS_PASS_OWNER_REVIEW_REQUIRED`; all network,
  production monitoring and publication authority flags remain FALSE.

## Example safe use (only after owner provisions trusted files)
```sh
python -m tools.spe_northstar_preflight --source claude-status \
  --state-file /OWNER_HOST/private/claude.json \
  --owner-receipt-file /OWNER_HOST/independent/receipt.json \
  --owner-trust-keys-file /OWNER_HOST/independent/keys.json \
  --owner-floor-file /OWNER_HOST/independent/floor.json
```
Without inputs it reports HOLD and performs zero network calls.
These example paths are placeholders, not actual known server locations.

## No self-certification
The host CLI can check syntax, local permissions, journal reconstruction
and a cryptographic Ed25519 receipt, but even four separate files on the
same computer do NOT establish that the floor and public keys originated
from another trusted owner domain. An independent owner must provision
and attest the trust root, separate monotonic storage and recovery
procedure. No R21 field ever claims that happened.

## Verification gates
1. R20 full exact-commit CI and editorial governance PASS.
2. R21 standalone security tests: default HOLD; good local crypto check
   remains review-only; wrong key, bad signature or digest HOLD; withheld
   source approval and missing host attestation HOLD; unsafe permissions
   or symlink HOLD; source/path alias HOLD; no network proof.
3. Full Python regressions, network-egress, web copy/TypeScript and
   canonical WASM/CLI all PASS on R21 exact commit.
4. Independent security review and production host qualification remain
   owner-controlled. STOP before deployment/publication.