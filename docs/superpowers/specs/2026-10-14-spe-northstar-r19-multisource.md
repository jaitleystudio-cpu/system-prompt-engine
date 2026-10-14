# SPE Ω North Star R19 — Second Official AI Status Source

**State: Draft; no live production monitoring, publication or paid API calls.**
Parent: R18 PR #172 at 2860945097f7c4530bf5f90676d2e89f5eabe209.

## Supported official public JSON endpoints
- Claude: https://status.claude.com/api/v2/incidents.json
- OpenAI: https://status.openai.com/api/v2/incidents.json
Both are public Statuspage-style incident feeds. Official provider status
does NOT establish a model-specific prompt failure, verified causal mechanism,
tested prompt repair, or source-first coverage of every AI headline.

## R19 owner boundaries
Existing R6 CLI continues to use Claude by default; the new explicit option
`--source openai-status` selects only status.openai.com, never an arbitrary
hostname, scheme, path, query or provider-supplied redirect. It requires
the existing global opt-in and a NEW source-specific owner grant:
SPE_PUBLIC_INCIDENT_OPENAI_OWNER_APPROVED=true.

Before any network fetch, each source must have its own reviewed durable
POSIX state file path. Claude keeps SPE_PUBLIC_INCIDENT_STATE_PATH;
OpenAI requires SPE_PUBLIC_INCIDENT_OPENAI_STATE_PATH. If they resolve
to the same path, OpenAI processing HALTS before network. R11 additionally
validates the pinned source allowlist and rejects ownership mismatch.

The existing R17 stale-revision/archival checks apply to both sources.
Production source paths and trusted keys must not be entered into public
repository history, CI logs or user prompts. Configure an approved
persistent host and verify the independent R12/R18 metadata floor.

## Test proof
- Existing Claude default/zero-network behavior preserved.
- OpenAI requires extra owner grant; absence refuses all fetches.
- Missing persistent path refuses all fetches.
- Shared state path refuses cross-provider namespace collision.
- Provider IDs can coincide but remain isolated in independent journals.
- Two sources re-observed on fake transports: duplicate handling persists
  across invocations without raw incident bodies or model calls.
- Arbitrary user-supplied --source hostname is refused.
- Full exact-commit Python and canonical WASM, security and egress CI.

## Unresolved
No deployed persistent runner, live authorized source polling, agreed
source licensing/review policy, externally held monotonic checkpoint floor,
or independent latency benchmarks. Google indexing and global #1 claims
cannot be inferred from this expansion. Review, merge and deployment
authority remain with the owner.
